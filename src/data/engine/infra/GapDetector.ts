// ═══════════════════════════════════════════════════════════════════
// charEdge — Gap Detector & Backfiller (P4-2)
//
// Detects missing bars in a time series based on expected interval,
// and provides backfill via re-fetch from the adapter.
// ═══════════════════════════════════════════════════════════════════

import type { CanonicalBar } from '../types/canonical.js';
import { logger } from '@/observability/logger.js';
import { sortedMergeBars } from './sortedMerge.js';

// ─── Types ───────────────────────────────────────────────────────

export interface Gap {
    /** Start of gap (timestamp of last bar before gap) */
    afterTime: number;
    /** End of gap (timestamp of first bar after gap) */
    beforeTime: number;
    /** Number of bars missing */
    missingCount: number;
    /** Expected interval in ms */
    intervalMs: number;
}

export interface BackfillResult {
    gapsFound: number;
    gapsFilled: number;
    barsInserted: number;
}

// ─── Timeframe → ms mapping ─────────────────────────────────────

const TF_MS: Record<string, number> = {
    '1m': 60_000,
    '3m': 180_000,
    '5m': 300_000,
    '15m': 900_000,
    '30m': 1_800_000,
    '1h': 3_600_000,
    '2h': 7_200_000,
    '4h': 14_400_000,
    '6h': 21_600_000,
    '8h': 28_800_000,
    '12h': 43_200_000,
    '1D': 86_400_000,
    '1d': 86_400_000,
    '3D': 259_200_000,
    '1W': 604_800_000,
    '1w': 604_800_000,
    '1M': 2_592_000_000, // ~30 days
};

/**
 * Resolve a timeframe string to milliseconds.
 */
export function tfToMs(tf: string): number {
    return TF_MS[tf] || 3_600_000; // Default to 1h
}

// ─── Gap Detection ───────────────────────────────────────────────

/**
 * Detect gaps in a sorted bar array.
 *
 * A gap is defined as 2+ consecutive missing bars based on the
 * expected interval. Single missing bars are tolerated (exchange
 * downtime during low-volume hours).
 *
 * @param bars     - Sorted ascending by time
 * @param tf       - Timeframe string (e.g. '1h')
 * @param tolerance - Allow up to N missing bars before flagging (default: 1)
 * @returns Array of detected gaps
 */
export function detectGaps(
    bars: Pick<CanonicalBar, 'time'>[],
    tf: string,
    tolerance = 1,
): Gap[] {
    const intervalMs = tfToMs(tf);
    const gaps: Gap[] = [];

    for (let i = 1; i < bars.length; i++) {
        const prev = bars[i - 1]!;
        const curr = bars[i]!;
        const delta = curr.time - prev.time;
        const expectedDelta = intervalMs;

        // How many bars are missing?
        const missing = Math.round(delta / expectedDelta) - 1;

        if (missing > tolerance) {
            gaps.push({
                afterTime: prev.time,
                beforeTime: curr.time,
                missingCount: missing,
                intervalMs,
            });
        }
    }

    return gaps;
}

// ─── Backfill ────────────────────────────────────────────────────

type FetchBarsFn = (
    symbol: string,
    tf: string,
    startMs: number,
    endMs: number,
) => Promise<CanonicalBar[]>;

/**
 * Fill detected gaps by re-fetching from the adapter.
 *
 * @param bars     - Original sorted bar array
 * @param gaps     - Detected gaps
 * @param symbol   - Trading pair
 * @param tf       - Timeframe
 * @param fetcher  - Function to fetch bars for a time range
 * @returns Merged bar array (sorted, deduped) + backfill stats
 */
export async function backfillGaps(
    bars: CanonicalBar[],
    gaps: Gap[],
    symbol: string,
    tf: string,
    fetcher: FetchBarsFn,
): Promise<{ bars: CanonicalBar[]; result: BackfillResult }> {
    const result: BackfillResult = {
        gapsFound: gaps.length,
        gapsFilled: 0,
        barsInserted: 0,
    };

    if (gaps.length === 0) return { bars, result };

    // Collect all backfilled bars
    const backfilled: CanonicalBar[] = [];

    // Fetch all gaps in parallel — they are independent time ranges
    const fetchResults = await Promise.allSettled(
        gaps.map(gap => fetcher(symbol, tf, gap.afterTime, gap.beforeTime))
    );

    for (let i = 0; i < fetchResults.length; i++) {
        const r = fetchResults[i]!;
        if (r.status === 'fulfilled' && r.value.length > 0) {
            backfilled.push(...r.value);
            result.gapsFilled++;
            result.barsInserted += r.value.length;
        } else if (r.status === 'rejected') {
            logger.data.warn(`Gap backfill failed for ${symbol} ${gaps[i]!.afterTime}-${gaps[i]!.beforeTime}`, r.reason);
        }
    }

    // O(n) two-pointer merge — both input and backfilled are sorted ascending
    backfilled.sort((a, b) => a.time - b.time);
    const deduped = sortedMergeBars(bars, backfilled, b => b.time, 'b');

    return { bars: deduped, result };
}

/**
 * Get gap markers for chart visualization.
 * Returns { time, label } objects that can be rendered as vertical markers.
 */
export function getGapMarkers(gaps: Gap[]): { time: number; label: string }[] {
    return gaps.map(g => ({
        time: g.afterTime + (g.beforeTime - g.afterTime) / 2,
        label: `${g.missingCount} bars missing`,
    }));
}
