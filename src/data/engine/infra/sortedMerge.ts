// ═══════════════════════════════════════════════════════════════════
// charEdge — Sorted Merge Utility (Sprint 12, Task #95)
//
// O(n) two-pointer merge for pre-sorted bar arrays.
// Replaces Set+filter+sort patterns across the codebase.
// ═══════════════════════════════════════════════════════════════════

/**
 * Merge two sorted arrays into one, deduplicating by timestamp.
 *
 * Both inputs MUST be sorted ascending by the timestamp extracted via `getTime`.
 * When duplicates exist, the bar from the `prefer` side is kept.
 *
 * Complexity: O(n + m) time, O(n + m) space — no sort needed.
 *
 * @param a        - First sorted array
 * @param b        - Second sorted array
 * @param getTime  - Extract timestamp from a bar
 * @param prefer   - Which side to keep on duplicate: 'a' or 'b' (default: 'b')
 */
export function sortedMergeBars<T>(
    a: T[],
    b: T[],
    getTime: (bar: T) => number,
    prefer: 'a' | 'b' = 'b',
): T[] {
    if (a.length === 0) return b;
    if (b.length === 0) return a;

    const result: T[] = [];
    let i = 0;
    let j = 0;

    while (i < a.length && j < b.length) {
        const tA = getTime(a[i]!);
        const tB = getTime(b[j]!);

        if (tA < tB) {
            result.push(a[i]!);
            i++;
        } else if (tB < tA) {
            result.push(b[j]!);
            j++;
        } else {
            // Duplicate timestamp — keep preferred side
            result.push(prefer === 'a' ? a[i]! : b[j]!);
            i++;
            j++;
        }
    }

    // Append remaining items from whichever side isn't exhausted
    while (i < a.length) {
        result.push(a[i]!);
        i++;
    }
    while (j < b.length) {
        result.push(b[j]!);
        j++;
    }

    return result;
}
