// ═══════════════════════════════════════════════════════════════════
// charEdge — GapBackfill Unit Tests
//
// Tests:
//   1. detectGaps — finds gaps in bar arrays
//   2. mergeBars — deduplicates and merges backfill bars
//   3. backfillGaps — end-to-end backfill flow
//   4. Edge cases (empty, single, overlapping timestamps)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import { detectGaps, mergeBars, backfillGaps } from '../../data/engine/GapBackfill.ts';

// ─── Helpers ──────────────────────────────────────────────────────

const MINUTE = 60_000;
const HOUR = 3_600_000;

/** Create a bar at a given time. */
function bar(time, close = 100) {
    return { time, open: close - 1, high: close + 1, low: close - 2, close, volume: 1000 };
}

/** Create N sequential bars starting at `start` with interval `intervalMs`. */
function sequentialBars(n, { start = 1_700_000_000_000, intervalMs = MINUTE, baseClose = 100 } = {}) {
    return Array.from({ length: n }, (_, i) => bar(start + i * intervalMs, baseClose + i * 0.1));
}

/** Create bars with a gap: 10 bars, then gap, then 10 more bars. */
function barsWithGap(gapDurationMs, intervalMs = MINUTE) {
    const start = 1_700_000_000_000;
    const before = sequentialBars(10, { start, intervalMs });
    const afterStart = before[before.length - 1].time + gapDurationMs;
    const after = sequentialBars(10, { start: afterStart, intervalMs, baseClose: 101 });
    return [...before, ...after];
}

// ═══════════════════════════════════════════════════════════════════

describe('GapBackfill', () => {

    // ─── detectGaps ─────────────────────────────────────────────

    describe('detectGaps()', () => {
        it('returns [] for empty array', () => {
            expect(detectGaps([], MINUTE)).toEqual([]);
        });

        it('returns [] for single bar', () => {
            expect(detectGaps([bar(1000)], MINUTE)).toEqual([]);
        });

        it('returns [] for contiguous bars (no gap)', () => {
            const bars = sequentialBars(20);
            expect(detectGaps(bars, MINUTE)).toEqual([]);
        });

        it('detects a single gap', () => {
            const bars = barsWithGap(10 * MINUTE); // 10-min gap between groups
            const gaps = detectGaps(bars, MINUTE);
            expect(gaps.length).toBe(1);
            expect(gaps[0].from).toBeLessThan(gaps[0].to);
        });

        it('detects multiple gaps', () => {
            const start = 1_700_000_000_000;
            const bars = [
                ...sequentialBars(5, { start }),
                // 10-min gap
                ...sequentialBars(5, { start: start + 15 * MINUTE }),
                // 20-min gap
                ...sequentialBars(5, { start: start + 40 * MINUTE }),
            ];
            const gaps = detectGaps(bars, MINUTE);
            expect(gaps.length).toBe(2);
        });

        it('respects tolerance parameter', () => {
            // Gap of 2.5 minutes with 1-minute interval
            const start = 1_700_000_000_000;
            const bars = [
                bar(start),
                bar(start + 2.5 * MINUTE), // 2.5x interval
            ];
            // Default tolerance 1.5 → this should be a gap
            expect(detectGaps(bars, MINUTE, 1.5).length).toBe(1);
            // High tolerance 3.0 → not a gap
            expect(detectGaps(bars, MINUTE, 3.0).length).toBe(0);
        });

        it('gap.from is after last bar + interval, gap.to is before next bar - interval', () => {
            const bars = barsWithGap(10 * MINUTE);
            const gaps = detectGaps(bars, MINUTE);
            expect(gaps[0].from).toBe(bars[9].time + MINUTE);
            expect(gaps[0].to).toBe(bars[10].time - MINUTE);
        });
    });

    // ─── mergeBars ──────────────────────────────────────────────

    describe('mergeBars()', () => {
        it('returns existing if backfill is empty', () => {
            const existing = sequentialBars(5);
            expect(mergeBars(existing, [])).toBe(existing);
        });

        it('returns backfill if existing is empty', () => {
            const backfill = sequentialBars(5);
            expect(mergeBars([], backfill)).toBe(backfill);
        });

        it('deduplicates bars with same timestamp', () => {
            const existing = sequentialBars(5);
            const backfill = [{ ...existing[2] }, { ...existing[3] }]; // duplicate timestamps
            const merged = mergeBars(existing, backfill);
            expect(merged.length).toBe(5); // no duplicates
        });

        it('merges non-overlapping bars in sorted order', () => {
            const start = 1_700_000_000_000;
            const existing = sequentialBars(3, { start });
            const backfill = sequentialBars(3, { start: start + 10 * MINUTE });
            const merged = mergeBars(existing, backfill);
            expect(merged.length).toBe(6);
            // Should be sorted
            for (let i = 1; i < merged.length; i++) {
                expect(merged[i].time).toBeGreaterThan(merged[i - 1].time);
            }
        });

        it('handles interleaved timestamps correctly', () => {
            const merged = mergeBars(
                [bar(100), bar(300), bar(500)],
                [bar(200), bar(400)],
            );
            expect(merged.map(b => b.time)).toEqual([100, 200, 300, 400, 500]);
        });
    });

    // ─── backfillGaps ───────────────────────────────────────────

    describe('backfillGaps()', () => {
        it('returns existing bars if gap < minGapMs', async () => {
            const now = Date.now();
            const existing = [
                bar(now - 60_000),
                bar(now - 30_000), // 30s ago — < 2min min gap
            ];
            const config = {
                minGapMs: 2 * MINUTE,
                maxGapMs: 24 * HOUR,
                fetchBars: vi.fn().mockResolvedValue([]),
            };
            const result = await backfillGaps(existing, 'AAPL', '1m', MINUTE, config);
            expect(result).toBe(existing);
            expect(config.fetchBars).not.toHaveBeenCalled();
        });

        it('returns existing bars if gap > maxGapMs', async () => {
            const now = Date.now();
            const existing = [
                bar(now - 48 * HOUR),
                bar(now - 48 * HOUR + MINUTE), // 48h ago — > 24h max
            ];
            const config = {
                minGapMs: 2 * MINUTE,
                maxGapMs: 24 * HOUR,
                fetchBars: vi.fn().mockResolvedValue([]),
            };
            const result = await backfillGaps(existing, 'AAPL', '1m', MINUTE, config);
            expect(result).toBe(existing);
            expect(config.fetchBars).not.toHaveBeenCalled();
        });

        it('returns existing bars for < 2 bars', async () => {
            const config = {
                minGapMs: 2 * MINUTE,
                maxGapMs: 24 * HOUR,
                fetchBars: vi.fn().mockResolvedValue([]),
            };
            const result = await backfillGaps([bar(1000)], 'AAPL', '1m', MINUTE, config);
            expect(result).toEqual([bar(1000)]);
        });

        it('calls fetchBars and merges result for valid gap', async () => {
            const now = Date.now();
            const lastBarTime = now - 10 * MINUTE;
            const existing = [bar(lastBarTime - MINUTE), bar(lastBarTime)];
            const backfillBars = [bar(lastBarTime + MINUTE), bar(lastBarTime + 2 * MINUTE)];

            const config = {
                minGapMs: 2 * MINUTE,
                maxGapMs: 24 * HOUR,
                fetchBars: vi.fn().mockResolvedValue(backfillBars),
            };

            const result = await backfillGaps(existing, 'AAPL', '1m', MINUTE, config);
            expect(config.fetchBars).toHaveBeenCalledOnce();
            expect(result.length).toBe(4); // 2 existing + 2 backfill
        });

        it('handles fetchBars returning empty array', async () => {
            const now = Date.now();
            const existing = [bar(now - 10 * MINUTE), bar(now - 9 * MINUTE)];
            const config = {
                minGapMs: 2 * MINUTE,
                maxGapMs: 24 * HOUR,
                fetchBars: vi.fn().mockResolvedValue([]),
            };
            const result = await backfillGaps(existing, 'AAPL', '1m', MINUTE, config);
            expect(result).toBe(existing);
        });

        it('handles fetchBars throwing an error gracefully', async () => {
            const now = Date.now();
            const existing = [bar(now - 10 * MINUTE), bar(now - 9 * MINUTE)];
            const config = {
                minGapMs: 2 * MINUTE,
                maxGapMs: 24 * HOUR,
                fetchBars: vi.fn().mockRejectedValue(new Error('Network error')),
            };
            const result = await backfillGaps(existing, 'AAPL', '1m', MINUTE, config);
            expect(result).toBe(existing); // graceful fallback
        });
    });
});
