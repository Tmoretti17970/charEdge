import { logger } from '../utils/logger';

// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — barBisect (Task 5.1.3)
//
// O(log n) binary search for OHLCV bar arrays sorted by timestamp.
// Replaces O(n) findIndex() lookups throughout the chart engine.
//
// Usage:
//   import { barBisect } from './barBisect.js';
//   const idx = barBisect(bars, targetTimestamp);
//   // idx is the index of the bar with matching timestamp,
//   // or the insertion point if no exact match.
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {{ t: number, [key: string]: any }} Bar
 */

/**
 * Binary search for a bar by timestamp in a sorted bar array.
 *
 * @param {Bar[]} bars - Sorted array of bars (ascending by `t`)
 * @param {number} timestamp - Target timestamp (ms since epoch)
 * @returns {number} Index of exact match, or insertion point (negative: ~insertIdx)
 *
 * @example
 * const idx = barBisect(bars, 1704067200000);
 * if (idx >= 0) {
 *   logger.ui.info('Exact match:', bars[idx]);
 * } else {
 *   logger.ui.info('Would insert at:', ~idx);
 * }
 */
export function barBisect(bars, timestamp) {
    let lo = 0;
    let hi = bars.length - 1;

    while (lo <= hi) {
        const mid = (lo + hi) >>> 1; // unsigned right shift = floor division
        const midT = bars[mid].t;

        if (midT === timestamp) return mid;
        if (midT < timestamp) lo = mid + 1;
        else hi = mid - 1;
    }

    // No exact match — return bitwise complement of insertion point
    return ~lo;
}

/**
 * Find the nearest bar index to a given timestamp.
 * Always returns a valid index (0 to bars.length-1).
 *
 * @param {Bar[]} bars - Sorted array of bars (ascending by `t`)
 * @param {number} timestamp - Target timestamp (ms since epoch)
 * @returns {number} Index of nearest bar
 */
export function barNearest(bars, timestamp) {
    if (bars.length === 0) return -1;
    if (bars.length === 1) return 0;

    const idx = barBisect(bars, timestamp);

    // Exact match
    if (idx >= 0) return idx;

    // Insertion point
    const insertAt = ~idx;

    if (insertAt === 0) return 0;
    if (insertAt >= bars.length) return bars.length - 1;

    // Compare distance to neighbors
    const distBefore = timestamp - bars[insertAt - 1].t;
    const distAfter = bars[insertAt].t - timestamp;

    return distBefore <= distAfter ? insertAt - 1 : insertAt;
}

/**
 * Find all bars within a time range [startTime, endTime] inclusive.
 * Returns { startIdx, endIdx } representing a slice of the array.
 *
 * @param {Bar[]} bars - Sorted array of bars (ascending by `t`)
 * @param {number} startTime - Start of range (ms)
 * @param {number} endTime - End of range (ms)
 * @returns {{ startIdx: number, endIdx: number, count: number }}
 */
export function barRange(bars, startTime, endTime) {
    if (bars.length === 0) return { startIdx: 0, endIdx: 0, count: 0 };

    let startIdx = barBisect(bars, startTime);
    if (startIdx < 0) startIdx = ~startIdx;

    let endIdx = barBisect(bars, endTime);
    if (endIdx < 0) endIdx = ~endIdx - 1;
    else endIdx = endIdx; // exact match, include it

    // Clamp
    startIdx = Math.max(0, startIdx);
    endIdx = Math.min(bars.length - 1, endIdx);

    const count = endIdx >= startIdx ? endIdx - startIdx + 1 : 0;
    return { startIdx, endIdx, count };
}
