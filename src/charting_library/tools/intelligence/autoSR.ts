// ═══════════════════════════════════════════════════════════════════
// charEdge — Auto S/R Level Detection  (Sprint 11)
// Scans recent bars for swing highs/lows, clusters nearby pivots,
// and returns the strongest support/resistance levels.
// ═══════════════════════════════════════════════════════════════════

/**
 * A detected support/resistance level.
 */
export interface SRLevel {
  price: number;
  strength: number;      // 0-1, normalized score
  touchCount: number;    // how many times price tested this level
  lastTouchIdx: number;  // index of most recent touch (0 = latest bar)
  type: 'support' | 'resistance' | 'both';
  id: string;            // stable hash for dismiss tracking
}

interface Bar {
  open: number;
  high: number;
  low: number;
  close: number;
  time: number;
  volume?: number;
}

interface SRConfig {
  lookback: number;        // number of bars to scan (default 200)
  swingWindow: number;     // bars on each side for swing detection (default 5)
  clusterThreshold: number; // % of price range to cluster pivots (default 0.005 = 0.5%)
  maxLevels: number;       // max levels to return (default 5)
  touchThreshold: number;  // % proximity to count as a "touch" (default 0.002 = 0.2%)
}

const DEFAULT_CONFIG: SRConfig = {
  lookback: 200,
  swingWindow: 5,
  clusterThreshold: 0.005,
  maxLevels: 5,
  touchThreshold: 0.002,
};

/**
 * Detect support/resistance levels from bar data.
 * @param bars - Array of OHLC bars (oldest first)
 * @param config - Detection configuration
 * @returns Array of SRLevel sorted by strength (strongest first)
 */
export function detectSRLevels(bars: Bar[], config: Partial<SRConfig> = {}): SRLevel[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  if (!bars || bars.length < cfg.swingWindow * 2 + 1) return [];

  // Use last N bars
  const recentBars = bars.slice(-cfg.lookback);
  const n = recentBars.length;
  const priceRange = Math.max(...recentBars.map(b => b.high)) - Math.min(...recentBars.map(b => b.low));
  if (priceRange <= 0) return [];

  // ── Step 1: Find swing points ──
  const pivots: { price: number; idx: number; type: 'high' | 'low' }[] = [];

  for (let i = cfg.swingWindow; i < n - cfg.swingWindow; i++) {
    // Swing high: highest high in window
    let isSwingHigh = true;
    let isSwingLow = true;
    const bar = recentBars[i]!;
    for (let j = 1; j <= cfg.swingWindow; j++) {
      if (bar.high <= recentBars[i - j]!.high || bar.high <= recentBars[i + j]!.high) {
        isSwingHigh = false;
      }
      if (bar.low >= recentBars[i - j]!.low || bar.low >= recentBars[i + j]!.low) {
        isSwingLow = false;
      }
    }
    if (isSwingHigh) pivots.push({ price: bar.high, idx: i, type: 'high' });
    if (isSwingLow) pivots.push({ price: bar.low, idx: i, type: 'low' });
  }

  if (pivots.length === 0) return [];

  // ── Step 2: Cluster nearby pivots ──
  const clusterDist = priceRange * cfg.clusterThreshold;
  const used = new Set<number>();
  const clusters: { price: number; pivots: typeof pivots }[] = [];

  // Sort pivots by price
  const sortedPivots = [...pivots].sort((a, b) => a.price - b.price);

  for (let i = 0; i < sortedPivots.length; i++) {
    if (used.has(i)) continue;
    const cluster = [sortedPivots[i]];
    used.add(i);
    for (let j = i + 1; j < sortedPivots.length; j++) {
      if (used.has(j)) continue;
      if (Math.abs(sortedPivots[j]!.price - sortedPivots[i]!.price) <= clusterDist) {
        cluster.push(sortedPivots[j]!);
        used.add(j);
      }
    }
    // Cluster price = average
    const avgPrice = cluster.reduce((sum, p) => sum + p.price, 0) / cluster.length;
    clusters.push({ price: avgPrice, pivots: cluster as typeof pivots });
  }

  // ── Step 3: Score each cluster ──
  const touchDist = priceRange * cfg.touchThreshold;
  const currentPrice = recentBars[n - 1].close;

  const levels: SRLevel[] = clusters.map(cluster => {
    // Count all bar touches (not just pivots)
    let touchCount = 0;
    let lastTouchIdx = -1;
    for (let i = 0; i < n; i++) {
      const bar = recentBars[i]!;
      if (
        Math.abs(bar.high - cluster.price) <= touchDist ||
        Math.abs(bar.low - cluster.price) <= touchDist ||
        Math.abs(bar.close - cluster.price) <= touchDist ||
        Math.abs(bar.open - cluster.price) <= touchDist
      ) {
        touchCount++;
        lastTouchIdx = i;
      }
    }

    // Recency weight: more recent touches score higher
    const recencyScore = lastTouchIdx >= 0 ? (lastTouchIdx + 1) / n : 0;
    
    // Touch count weight
    const touchScore = Math.min(touchCount / 8, 1); // cap at 8 touches = max

    // Pivot count bonus
    const pivotBonus = Math.min(cluster.pivots.length / 4, 1);

    // Combined strength
    const strength = touchScore * 0.5 + recencyScore * 0.3 + pivotBonus * 0.2;

    // Determine type
    const type: SRLevel['type'] = cluster.price > currentPrice
      ? 'resistance'
      : cluster.price < currentPrice
        ? 'support'
        : 'both';

    // Stable ID based on price (rounded to avoid float jitter)
    const id = `sr_${Math.round(cluster.price * 100)}`;

    return {
      price: cluster.price,
      strength,
      touchCount,
      lastTouchIdx: lastTouchIdx >= 0 ? n - 1 - lastTouchIdx : n,
      type,
      id,
    };
  });

  // Sort by strength descending, take top N
  levels.sort((a, b) => b.strength - a.strength);
  return levels.slice(0, cfg.maxLevels);
}

/**
 * Hash a level's price for dismiss tracking.
 */
export function srLevelHash(price: number): string {
  return `sr_${Math.round(price * 100)}`;
}
