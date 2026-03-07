// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Ghost Overlay (G2.1)
//
// Proactive S/R zone detection using pivot-point analysis +
// harmonic pattern scanner. Renders translucent zones on chart
// with confidence scores.
// ═══════════════════════════════════════════════════════════════════

export interface SRZone {
  /** Price level */
  price: number;
  /** 'support' | 'resistance' */
  type: 'support' | 'resistance';
  /** Confidence score 0-1 */
  confidence: number;
  /** Number of touches */
  touches: number;
  /** Zone width (price range) */
  width: number;
  /** Source: 'pivot' | 'cluster' | 'harmonic' */
  source: string;
}

export interface HarmonicPattern {
  type: 'gartley' | 'butterfly' | 'bat' | 'crab' | 'shark';
  points: Array<{ x: number; y: number }>;
  confidence: number;
  projectedReversal: number;
}

const PIVOT_LOOKBACK = 5;  // Bars to check for pivot highs/lows
const CLUSTER_TOLERANCE = 0.002; // 0.2% price tolerance for clustering
const MIN_CONFIDENCE = 0.3;

/**
 * Detect pivot highs and lows from OHLC data.
 */
export function findPivots(
  data: Array<{ high: number; low: number }>,
  lookback: number = PIVOT_LOOKBACK,
): { highs: Array<{ index: number; price: number }>; lows: Array<{ index: number; price: number }> } {
  const highs: Array<{ index: number; price: number }> = [];
  const lows: Array<{ index: number; price: number }> = [];

  for (let i = lookback; i < data.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    const bar = data[i]!;

    for (let j = 1; j <= lookback; j++) {
      const left = data[i - j]!;
      const right = data[i + j]!;
      if (bar.high <= left.high || bar.high <= right.high) isHigh = false;
      if (bar.low >= left.low || bar.low >= right.low) isLow = false;
    }

    if (isHigh) highs.push({ index: i, price: bar.high });
    if (isLow) lows.push({ index: i, price: bar.low });
  }

  return { highs, lows };
}

/**
 * Cluster nearby price levels into S/R zones.
 */
export function clusterLevels(
  levels: Array<{ price: number; type: 'support' | 'resistance' }>,
  tolerance: number = CLUSTER_TOLERANCE,
): SRZone[] {
  if (!levels.length) return [];

  // Sort by price
  const sorted = [...levels].sort((a, b) => a.price - b.price);
  const zones: SRZone[] = [];
  let cluster = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!;
    const clusterAvg = cluster.reduce((s, l) => s + l.price, 0) / cluster.length;

    if (Math.abs(current.price - clusterAvg) / clusterAvg <= tolerance) {
      cluster.push(current);
    } else {
      zones.push(createZone(cluster));
      cluster = [current];
    }
  }
  zones.push(createZone(cluster));

  return zones.filter((z) => z.confidence >= MIN_CONFIDENCE);
}

function createZone(
  cluster: Array<{ price: number; type: 'support' | 'resistance' }>,
): SRZone {
  const prices = cluster.map((l) => l.price);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const width = Math.max(...prices) - Math.min(...prices);
  const touches = cluster.length;

  // More touches = higher confidence (logarithmic scale)
  const confidence = Math.min(1, Math.log2(touches + 1) / 3);

  // Majority type
  const supportCount = cluster.filter((l) => l.type === 'support').length;
  const type = supportCount >= cluster.length / 2 ? 'support' : 'resistance';

  return {
    price: avgPrice,
    type,
    confidence,
    touches,
    width,
    source: 'cluster',
  };
}

/**
 * Detect S/R zones from OHLC data.
 * Main entry point for the AI Ghost Overlay.
 */
export function detectSRZones(
  data: Array<{ open: number; high: number; low: number; close: number }>,
  lookback?: number,
): SRZone[] {
  if (data.length < 20) return [];

  const { highs, lows } = findPivots(data, lookback);

  const levels = [
    ...highs.map((h) => ({ price: h.price, type: 'resistance' as const })),
    ...lows.map((l) => ({ price: l.price, type: 'support' as const })),
  ];

  return clusterLevels(levels);
}

/**
 * Render S/R zones on canvas.
 */
export function renderSRZones(
  ctx: CanvasRenderingContext2D,
  zones: SRZone[],
  priceToY: (price: number) => number,
  canvasWidth: number,
  dpr: number = 1,
): void {
  ctx.save();
  ctx.scale(dpr, dpr);

  for (const zone of zones) {
    const y = priceToY(zone.price);
    const halfWidth = priceToY(zone.price - zone.width / 2) - y;
    const alpha = zone.confidence * 0.25; // Max 25% opacity

    // Zone fill
    const color = zone.type === 'support' ? '45, 212, 160' : '242, 92, 92';
    ctx.fillStyle = `rgba(${color}, ${alpha})`;
    ctx.fillRect(0, y - Math.abs(halfWidth), canvasWidth / dpr, Math.abs(halfWidth) * 2);

    // Zone line
    ctx.strokeStyle = `rgba(${color}, ${alpha + 0.1})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasWidth / dpr, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Confidence label
    if (zone.confidence > 0.5) {
      ctx.font = '500 9px var(--tf-mono, monospace)';
      ctx.fillStyle = `rgba(${color}, ${Math.min(1, alpha + 0.4)})`;
      ctx.textAlign = 'right';
      ctx.fillText(
        `${zone.type === 'support' ? 'S' : 'R'} ${(zone.confidence * 100).toFixed(0)}%`,
        canvasWidth / dpr - 8,
        y - 4,
      );
    }
  }

  ctx.restore();
}

export default {
  findPivots,
  clusterLevels,
  detectSRZones,
  renderSRZones,
};
