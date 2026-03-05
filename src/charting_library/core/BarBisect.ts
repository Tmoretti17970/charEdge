// ═══════════════════════════════════════════════════════════════════
// charEdge — BarBisect
//
// O(log n) binary search utilities for bar data.
// Works with both BarDataBuffer (typed arrays) and plain bar arrays.
//
// Usage:
//   import { barBisect, barRange } from './BarBisect.ts';
//   const idx = barBisect(buffer.time, targetTime);
//   const [start, end] = barRange(buffer.time, t0, t1);
// ═══════════════════════════════════════════════════════════════════

/**
 * Binary search for the insertion point of `target` in a sorted numeric array.
 * Returns the index of the first element >= target (left bisect).
 *
 * Works with Float64Array (BarDataBuffer.time) or number[].
 *
 * @param arr   Sorted array or typed array
 * @param target Value to search for
 * @param lo    Start of search range (default 0)
 * @param hi    End of search range (default arr.length)
 * @returns     Index where target would be inserted (0 <= result <= hi)
 */
export function barBisectLeft(
    arr: ArrayLike<number>,
    target: number,
    lo: number = 0,
    hi: number = arr.length,
): number {
    while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (arr[mid] < target) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}

/**
 * Binary search returning the index of the first element > target (right bisect).
 *
 * @param arr   Sorted array or typed array
 * @param target Value to search for
 * @param lo    Start of search range
 * @param hi    End of search range
 * @returns     Index of first element > target
 */
export function barBisectRight(
    arr: ArrayLike<number>,
    target: number,
    lo: number = 0,
    hi: number = arr.length,
): number {
    while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (arr[mid] <= target) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}

/**
 * Find the nearest bar index to a target timestamp.
 * Returns the index of the bar whose time is closest to `target`.
 *
 * @param arr    Sorted time array
 * @param target Target timestamp
 * @param length Number of valid elements (for BarDataBuffer)
 * @returns      Nearest index, or -1 if array is empty
 */
export function barNearest(
    arr: ArrayLike<number>,
    target: number,
    length: number = arr.length,
): number {
    if (length === 0) return -1;
    if (length === 1) return 0;

    const idx = barBisectLeft(arr, target, 0, length);

    if (idx === 0) return 0;
    if (idx >= length) return length - 1;

    // Compare distance to neighbors
    const dLeft = target - arr[idx - 1];
    const dRight = arr[idx] - target;
    return dLeft <= dRight ? idx - 1 : idx;
}

/**
 * Find the [start, end) index range covering timestamps [t0, t1].
 * Inclusive of bars at t0, exclusive past t1.
 * Useful for viewport-based bar slicing.
 *
 * @param arr    Sorted time array
 * @param t0     Start timestamp (inclusive)
 * @param t1     End timestamp (inclusive)
 * @param length Number of valid elements
 * @returns      [startIdx, endIdx) tuple
 */
export function barRange(
    arr: ArrayLike<number>,
    t0: number,
    t1: number,
    length: number = arr.length,
): [number, number] {
    const start = barBisectLeft(arr, t0, 0, length);
    const end = barBisectRight(arr, t1, start, length);
    return [start, end];
}

/**
 * Convenience: find a bar by exact timestamp.
 * Returns the index if found, or -1 if no exact match.
 *
 * @param arr    Sorted time array
 * @param time   Exact timestamp to find
 * @param length Number of valid elements
 * @returns      Index of exact match, or -1
 */
export function barIndexOf(
    arr: ArrayLike<number>,
    time: number,
    length: number = arr.length,
): number {
    const idx = barBisectLeft(arr, time, 0, length);
    if (idx < length && arr[idx] === time) return idx;
    return -1;
}
