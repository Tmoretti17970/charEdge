// ═══════════════════════════════════════════════════════════════════
// charEdge — Reconnection Gap Backfill (Task 2.3.11)
//
// When a WebSocket connection drops and reconnects, there may be
// missing candles in the time gap. This module detects the gap and
// fills it via a REST request, then merges the backfilled bars into
// the existing dataset without duplicates.
// ═══════════════════════════════════════════════════════════════════

import { logger } from '../../utils/logger.js';

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
 */
export function detectGaps(bars: Bar[], intervalMs: number, tolerance = 1.5): Array<{ from: number; to: number }> {
  if (bars.length < 2) return [];

  const gaps: Array<{ from: number; to: number }> = [];
  const threshold = intervalMs * tolerance;

  for (let i = 1; i < bars.length; i++) {
    const dt = bars[i].time - bars[i - 1].time;
    if (dt > threshold) {
      gaps.push({
        from: bars[i - 1].time + intervalMs,
        to: bars[i].time - intervalMs,
      });
    }
  }

  return gaps;
}

/**
 * Merge backfilled bars into existing bars, deduplicating by timestamp.
 * Both arrays must be sorted ascending by time.
 */
export function mergeBars(existing: Bar[], backfill: Bar[]): Bar[] {
  if (!backfill.length) return existing;
  if (!existing.length) return backfill;

  // Build a Set of existing timestamps for O(1) dedup
  const existingTimes = new Set(existing.map(b => b.time));

  // Filter backfill to only new bars
  const newBars = backfill.filter(b => !existingTimes.has(b.time));
  if (!newBars.length) return existing;

  // Merge and sort
  const merged = [...existing, ...newBars];
  merged.sort((a, b) => a.time - b.time);

  return merged;
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
