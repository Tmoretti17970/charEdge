// ═══════════════════════════════════════════════════════════════════
// charEdge — Time Aggregator (Task 2.3.2)
//
// Locally aggregates 1m bars into any higher timeframe (5m, 15m, 1h,
// 4h, 1D, 1W). Eliminates network round-trips when switching TFs —
// if 1m data is cached, higher-TF views are computed in < 5ms.
//
// Key design decisions:
// - Purely functional: takes Bar[] in, returns Bar[] out
// - Handles incomplete final bars (forming candle)
// - Timeframe boundaries align to UTC for consistency
// ═══════════════════════════════════════════════════════════════════

import type { Bar } from '../../types/data.js';

// ─── Timeframe Duration Map ──────────────────────────────────────

/** Duration in milliseconds per timeframe */
const TF_DURATION_MS: Record<string, number> = {
  '1m':  60_000,
  '3m':  3 * 60_000,
  '5m':  5 * 60_000,
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h':  60 * 60_000,
  '2h':  2 * 60 * 60_000,
  '4h':  4 * 60 * 60_000,
  '6h':  6 * 60 * 60_000,
  '8h':  8 * 60 * 60_000,
  '12h': 12 * 60 * 60_000,
  '1D':  24 * 60 * 60_000,
  '1d':  24 * 60 * 60_000,
  '3D':  3 * 24 * 60 * 60_000,
  '3d':  3 * 24 * 60 * 60_000,
  '1W':  7 * 24 * 60 * 60_000,
  '1w':  7 * 24 * 60 * 60_000,
};

// ─── Core Aggregation ────────────────────────────────────────────

/**
 * Align a timestamp to the boundary of a given timeframe.
 * For intraday TFs: floor to nearest multiple.
 * For daily+: floor to UTC day boundary.
 */
function alignTimestamp(ts: number, tfMs: number): number {
  if (tfMs >= 86_400_000) {
    // Daily or above: align to UTC midnight
    const d = new Date(ts);
    d.setUTCHours(0, 0, 0, 0);
    // For weekly: align to Monday
    if (tfMs >= 604_800_000) {
      const day = d.getUTCDay();
      const diff = day === 0 ? 6 : day - 1; // Monday = 0
      d.setUTCDate(d.getUTCDate() - diff);
    }
    return d.getTime();
  }
  // Intraday: floor to nearest tfMs boundary
  return Math.floor(ts / tfMs) * tfMs;
}

/**
 * Aggregate an array of bars (assumed sorted ascending by time)
 * from a source timeframe into a target timeframe.
 *
 * @param bars Source bars (e.g. 1m bars)
 * @param targetTf Target timeframe string (e.g. '5m', '1h', '4h', '1D')
 * @returns Aggregated bars
 *
 * @example
 * ```ts
 * const hourlyBars = aggregateBars(minuteBars, '1h');
 * ```
 */
export function aggregateBars(bars: Bar[], targetTf: string): Bar[] {
  const tfMs = TF_DURATION_MS[targetTf];
  if (!tfMs) {
    console.warn(`[TimeAggregator] Unknown timeframe: ${targetTf}`);
    return bars;
  }

  if (!bars.length) return [];

  const result: Bar[] = [];
  let currentBar: Bar | null = null;
  let currentBucket = -1;

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const bucket = alignTimestamp(b.time, tfMs);

    if (bucket !== currentBucket) {
      // Start a new aggregated bar
      if (currentBar) result.push(currentBar);
      currentBucket = bucket;
      currentBar = {
        time: bucket,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
      };
    } else if (currentBar) {
      // Merge into current aggregated bar
      currentBar.high = Math.max(currentBar.high, b.high);
      currentBar.low = Math.min(currentBar.low, b.low);
      currentBar.close = b.close;
      currentBar.volume += b.volume;
    }
  }

  // Don't forget the final bar
  if (currentBar) result.push(currentBar);

  return result;
}

/**
 * Check if a target timeframe can be derived from a source timeframe.
 * E.g., '1h' can be derived from '1m' (60:1 ratio), but not the reverse.
 */
export function canAggregate(sourceTf: string, targetTf: string): boolean {
  const sourceMs = TF_DURATION_MS[sourceTf];
  const targetMs = TF_DURATION_MS[targetTf];
  if (!sourceMs || !targetMs) return false;
  return targetMs > sourceMs && targetMs % sourceMs === 0;
}

/**
 * Get the aggregation ratio (how many source bars per target bar).
 */
export function getAggregationRatio(sourceTf: string, targetTf: string): number {
  const sourceMs = TF_DURATION_MS[sourceTf];
  const targetMs = TF_DURATION_MS[targetTf];
  if (!sourceMs || !targetMs || targetMs <= sourceMs) return 1;
  return targetMs / sourceMs;
}

/**
 * Get all timeframes that can be derived from the given source TF.
 */
export function getDeriveableTimeframes(sourceTf: string): string[] {
  const sourceMs = TF_DURATION_MS[sourceTf];
  if (!sourceMs) return [];
  return Object.entries(TF_DURATION_MS)
    .filter(([tf, ms]) => ms > sourceMs && ms % sourceMs === 0)
    .map(([tf]) => tf)
    // Deduplicate case variants (1D/1d)
    .filter((tf, i, arr) => arr.indexOf(tf) === i);
}

// Re-export for testing
export { TF_DURATION_MS, alignTimestamp };
