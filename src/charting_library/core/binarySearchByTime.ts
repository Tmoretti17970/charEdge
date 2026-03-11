// ═══════════════════════════════════════════════════════════════════
// charEdge — binarySearchByTime
//
// Sprint 11 B11: O(log n) lookup for synced crosshair time matching.
// Replaces linear scan in drawSyncedCrosshair for better performance
// when bar arrays are large (10k+ candles from history loading).
// ═══════════════════════════════════════════════════════════════════

export interface TimeBar {
    time: number;
    [key: string]: unknown;
}

/**
 * Binary search for the bar closest to `targetTime`.
 *
 * @param bars - Array of bar objects sorted by ascending `time`
 * @param targetTime - The timestamp to search for (ms or s)
 * @returns Index of the closest bar, or -1 if the array is empty
 */
export function binarySearchByTime(bars: TimeBar[], targetTime: number): number {
    if (!bars || bars.length === 0) return -1;

    let lo = 0;
    let hi = bars.length - 1;

    // Edge cases: target is outside the range
    if (targetTime <= bars[lo]!.time) return lo;
    if (targetTime >= bars[hi]!.time) return hi;

    while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        const midTime = bars[mid]!.time;

        if (midTime === targetTime) return mid;
        if (midTime < targetTime) {
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }

    // lo > hi: targetTime is between bars[hi] and bars[lo]
    // Return whichever is closer
    if (hi < 0) return 0;
    if (lo >= bars.length) return bars.length - 1;

    const dLo = Math.abs(bars[lo]!.time - targetTime);
    const dHi = Math.abs(bars[hi]!.time - targetTime);
    return dLo <= dHi ? lo : hi;
}
