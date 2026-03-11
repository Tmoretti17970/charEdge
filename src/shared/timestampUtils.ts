// ═══════════════════════════════════════════════════════════════════
// charEdge — Timestamp Utilities (A6.1)
// Centralized UTC timestamp normalization to prevent local/UTC
// mismatches across journal, trade forms, and data pipeline.
// ═══════════════════════════════════════════════════════════════════

/**
 * Convert any date-like value to a millisecond epoch.
 * Handles Date objects, ISO strings, and numeric timestamps.
 * @param date - Date | string | number
 * @returns Millisecond epoch
 */
export function toEpoch(date: Date | string | number): number {
    if (typeof date === 'number') return date;
    if (date instanceof Date) return date.getTime();
    return new Date(date).getTime();
}

/**
 * Convert epoch to a YYYY-MM-DD string in UTC.
 * Use this instead of toLocaleDateString() for journal grouping.
 * @param epoch - Millisecond timestamp
 * @returns UTC date string, e.g. "2026-03-06"
 */
export function toUTCDateStr(epoch: number): string {
    const d = new Date(epoch);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Get the epoch at UTC midnight (00:00:00.000) for a given timestamp.
 * @param epoch - Millisecond timestamp
 * @returns Epoch at start of UTC day
 */
export function utcStartOfDay(epoch: number): number {
    const d = new Date(epoch);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Get the epoch at UTC end of day (23:59:59.999) for a given timestamp.
 * @param epoch - Millisecond timestamp
 * @returns Epoch at end of UTC day
 */
export function utcEndOfDay(epoch: number): number {
    return utcStartOfDay(epoch) + 86_400_000 - 1;
}

/**
 * Group an array of items by UTC date using a timestamp accessor.
 * Replaces local-timezone grouping to fix A6.2 (trades after 6pm CST on wrong day).
 * @param items - Array of items to group
 * @param getTime - Accessor function returning epoch for each item
 * @returns Map<string, T[]> keyed by UTC date string
 */
export function groupByUTCDate<T>(
    items: T[],
    getTime: (item: T) => number,
): Map<string, T[]> {
    const groups = new Map<string, T[]>();
    for (const item of items) {
        const key = toUTCDateStr(getTime(item));
        const group = groups.get(key);
        if (group) {
            group.push(item);
        } else {
            groups.set(key, [item]);
        }
    }
    return groups;
}
