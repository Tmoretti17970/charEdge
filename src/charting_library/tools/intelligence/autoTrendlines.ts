// ═══════════════════════════════════════════════════════════════════
// charEdge — Auto Trendline Detection  (Sprint 12)
// Connects swing highs and swing lows to detect support/resistance
// trendlines. Updates as new candles form.
// ═══════════════════════════════════════════════════════════════════

export interface TrendLine {
  startPoint: { price: number; time: number; idx: number };
  endPoint: { price: number; time: number; idx: number };
  direction: 'up' | 'down';
  touches: number;
  score: number;
  id: string;
}

interface Bar {
  open: number;
  high: number;
  low: number;
  close: number;
  time: number;
}

interface TrendConfig {
  lookback: number;       // bars to scan (default 200)
  swingWindow: number;    // bars for swing detection (default 5)
  maxLines: number;       // max trendlines to return (default 3)
  touchThreshold: number; // % of range to count as touch (default 0.003)
  minSwingDist: number;   // minimum bars between two swing points on a line (default 10)
}

const DEFAULT_CONFIG: TrendConfig = {
  lookback: 200,
  swingWindow: 5,
  maxLines: 3,
  touchThreshold: 0.003,
  minSwingDist: 10,
};

/**
 * Detect trendlines from bar data.
 * Returns top ascending support lines and descending resistance lines.
 */
export function detectTrendlines(bars: Bar[], config: Partial<TrendConfig> = {}): TrendLine[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (!bars || bars.length < cfg.swingWindow * 2 + cfg.minSwingDist) return [];

  const recentBars = bars.slice(-cfg.lookback);
  const n = recentBars.length;
  const priceRange = Math.max(...recentBars.map(b => b.high)) - Math.min(...recentBars.map(b => b.low));
  if (priceRange <= 0) return [];

  // ── Step 1: Find swing points ──
  const swingHighs: { price: number; time: number; idx: number }[] = [];
  const swingLows: { price: number; time: number; idx: number }[] = [];

  for (let i = cfg.swingWindow; i < n - cfg.swingWindow; i++) {
    const bar = recentBars[i]!;
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= cfg.swingWindow; j++) {
      if (bar.high <= recentBars[i - j]!.high || bar.high <= recentBars[i + j]!.high) isHigh = false;
      if (bar.low >= recentBars[i - j]!.low || bar.low >= recentBars[i + j]!.low) isLow = false;
    }
    if (isHigh) swingHighs.push({ price: bar.high, time: bar.time, idx: i });
    if (isLow) swingLows.push({ price: bar.low, time: bar.time, idx: i });
  }

  const touchDist = priceRange * cfg.touchThreshold;
  const candidates: TrendLine[] = [];

  // ── Step 2: Try pairwise swing lows → ascending support ──
  for (let i = 0; i < swingLows.length - 1; i++) {
    for (let j = i + 1; j < swingLows.length; j++) {
      const a = swingLows[i]!;
      const b = swingLows[j]!;
      if (b.idx - a.idx < cfg.minSwingDist) continue;
      if (b.price <= a.price) continue; // ascending only

      const slope = (b.price - a.price) / (b.idx - a.idx);
      let touches = 0;
      let broken = false;

      for (let k = 0; k < n; k++) {
        const expectedPrice = a.price + slope * (k - a.idx);
        const bar = recentBars[k]!;
        if (Math.abs(bar.low - expectedPrice) <= touchDist) touches++;
        // Line is broken if price goes significantly below
        if (bar.close < expectedPrice - touchDist * 3 && k > b.idx) broken = true;
      }

      if (touches >= 2 && !broken) {
        const recency = (a.idx + b.idx) / (2 * n);
        const angleBonus = 1 / (1 + Math.abs(slope) / (priceRange / n)); // prefer shallow
        const score = touches * 0.4 + recency * 0.3 + angleBonus * 0.3;
        candidates.push({
          startPoint: a, endPoint: b, direction: 'up',
          touches, score,
          id: `tl_up_${a.idx}_${b.idx}`,
        });
      }
    }
  }

  // ── Step 3: Try pairwise swing highs → descending resistance ──
  for (let i = 0; i < swingHighs.length - 1; i++) {
    for (let j = i + 1; j < swingHighs.length; j++) {
      const a = swingHighs[i]!;
      const b = swingHighs[j]!;
      if (b.idx - a.idx < cfg.minSwingDist) continue;
      if (b.price >= a.price) continue; // descending only

      const slope = (b.price - a.price) / (b.idx - a.idx);
      let touches = 0;
      let broken = false;

      for (let k = 0; k < n; k++) {
        const expectedPrice = a.price + slope * (k - a.idx);
        const bar = recentBars[k]!;
        if (Math.abs(bar.high - expectedPrice) <= touchDist) touches++;
        if (bar.close > expectedPrice + touchDist * 3 && k > b.idx) broken = true;
      }

      if (touches >= 2 && !broken) {
        const recency = (a.idx + b.idx) / (2 * n);
        const angleBonus = 1 / (1 + Math.abs(slope) / (priceRange / n));
        const score = touches * 0.4 + recency * 0.3 + angleBonus * 0.3;
        candidates.push({
          startPoint: a, endPoint: b, direction: 'down',
          touches, score,
          id: `tl_dn_${a.idx}_${b.idx}`,
        });
      }
    }
  }

  // ── Step 4: Sort by score, take top N ──
  candidates.sort((a, b) => b.score - a.score);

  // Ensure mix: take best support + best resistance, then fill
  const upLines = candidates.filter(c => c.direction === 'up');
  const downLines = candidates.filter(c => c.direction === 'down');
  const result: TrendLine[] = [];
  if (upLines[0]) result.push(upLines[0]);
  if (downLines[0]) result.push(downLines[0]);

  // Fill remaining slots
  for (const c of candidates) {
    if (result.length >= cfg.maxLines) break;
    if (!result.some(r => r.id === c.id)) result.push(c);
  }

  return result;
}
