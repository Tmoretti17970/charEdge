// ═══════════════════════════════════════════════════════════════════
// charEdge — Reconnection Gap Backfill (Task 2.3.11)
//
// When a WebSocket connection drops and reconnects, there may be
// missing candles in the time gap. This module detects the gap and
// fills it via a REST request, then merges the backfilled bars into
// the existing dataset without duplicates.
// ═══════════════════════════════════════════════════════════════════

import { logger } from '@/observability/logger.js';
import { detectGaps as _detectGapsCanonical } from './infra/GapDetector.js';
import { sortedMergeBars } from './infra/sortedMerge.js';

// ─── Types ───────────────────────────────────────────────────────

export interface GapBackfillConfig {
  /** Minimum gap size in ms before triggering backfill. Default: 2 minutes */
  minGapMs: number;
  /** Maximum gap size in ms to attempt backfill. Default: 24 hours */
  maxGapMs: number;
  /** REST fetch function: (symbol, interval, startTime, endTime) → bars */
  fetchBars: (symbol: string, interval: string, startTime: number, endTime: number) => Promise<Bar[]>;
}

interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── Core ────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Partial<GapBackfillConfig> = {
  minGapMs: 2 * 60_000,     // 2 minutes
  maxGapMs: 24 * 3600_000,  // 24 hours
};

/**
 * Detect gaps in a sorted bar array.
 * Returns array of { from, to } timestamps representing missing regions.
 *
 * Delegates to canonical GapDetector.ts — this wrapper adapts the return shape
 * for backward compatibility with existing callers.
 */
export function detectGaps(bars: Bar[], intervalMs: number, tolerance = 1.5): Array<{ from: number; to: number }> {
  if (bars.length < 2) return [];

  // Convert tolerance from multiplier to missing-bar count for the canonical API.
  // Canonical tolerance=1 means "allow 1 missing bar" ≈ multiplier 2.0.
  // Our multiplier-based tolerance: threshold = intervalMs * tolerance.
  // A gap of `threshold` means ~(tolerance - 1) missing bars at that interval,
  // but the canonical API uses `missing > tolerance` so we pass floor(tolerance - 1).
  const toleranceBars = Math.max(0, Math.floor(tolerance - 0.5));

  // Synthesize a "tf" string from intervalMs for the canonical API
  const tfMap: Record<number, string> = {
    60000: '1m', 180000: '3m', 300000: '5m', 900000: '15m', 1800000: '30m',
    3600000: '1h', 7200000: '2h', 14400000: '4h', 21600000: '6h',
    28800000: '8h', 43200000: '12h', 86400000: '1D',
    259200000: '3D', 604800000: '1W', 2592000000: '1M',
  };
  const tf = tfMap[intervalMs] || '1h';

  const canonicalGaps = _detectGapsCanonical(bars, tf, toleranceBars);

  // Adapt from Gap shape to {from, to} shape
  return canonicalGaps.map(g => ({
    from: g.afterTime + intervalMs,
    to: g.beforeTime - intervalMs,
  }));
}

/**
 * Merge backfilled bars into existing bars, deduplicating by timestamp.
 * Both arrays must be sorted ascending by time.
 */
export function mergeBars(existing: Bar[], backfill: Bar[]): Bar[] {
  // O(n) two-pointer merge — both arrays are pre-sorted ascending
  return sortedMergeBars(existing, backfill, b => b.time, 'b');
}

/**
 * Perform gap backfill after a WebSocket reconnection.
 *
 * @param existingBars Current bar dataset (sorted ascending)
 * @param symbol Trading symbol
 * @param interval Timeframe string
 * @param intervalMs Interval duration in ms
 * @param config Backfill configuration (must include fetchBars)
 * @returns Updated bar array with gaps filled
 */
export async function backfillGaps(
  existingBars: Bar[],
  symbol: string,
  interval: string,
  intervalMs: number,
  config: GapBackfillConfig,
): Promise<Bar[]> {
  const minGapMs = config.minGapMs ?? DEFAULT_CONFIG.minGapMs!;
  const maxGapMs = config.maxGapMs ?? DEFAULT_CONFIG.maxGapMs!;

  if (existingBars.length < 2) return existingBars;

  // Check gap between last bar and now
  const lastBar = existingBars[existingBars.length - 1];
  const now = Date.now();
  const gapMs = now - lastBar.time;

  if (gapMs < minGapMs) {
    return existingBars; // Gap too small, not worth backfilling
  }

  if (gapMs > maxGapMs) {
    logger.engine.warn(`[GapBackfill] Gap too large (${(gapMs / 3600_000).toFixed(1)}h) — full reload needed`);
    return existingBars;
  }

  try {
    logger.engine.info(
      `[GapBackfill] Filling ${(gapMs / 60_000).toFixed(0)}min gap for ${symbol} ${interval}`
    );

    const backfilledBars = await config.fetchBars(
      symbol,
      interval,
      lastBar.time + intervalMs,
      now,
    );

    if (!backfilledBars?.length) {
      logger.engine.warn('[GapBackfill] No bars returned from REST');
      return existingBars;
    }

    const merged = mergeBars(existingBars, backfilledBars);
    logger.engine.info(
      `[GapBackfill] Merged ${backfilledBars.length} backfilled bars → ${merged.length} total`
    );

    return merged;
  } catch (err) {
    logger.engine.warn('[GapBackfill] REST backfill failed:', (err as Error)?.message);
    return existingBars;
  }
}
