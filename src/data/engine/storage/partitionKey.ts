// ═══════════════════════════════════════════════════════════════════
// charEdge — Time-Partitioned Bar Keys
//
// Sprint 18 #113: Partition bar data by quarterly time buckets.
//
// Key format: `SYMBOL:INTERVAL:YYYY-QN`
// e.g. `BTCUSDT:1h:2024-Q1`, `ETHUSDT:1D:2025-Q4`
//
// This enables efficient range queries by only scanning relevant
// partitions instead of loading all blocks for a symbol.
// ═══════════════════════════════════════════════════════════════════

/**
 * Get the quarter string for a timestamp.
 * @param timestamp - Unix milliseconds
 * @returns e.g. "2024-Q1", "2025-Q4"
 */
export function quarterFromTimestamp(timestamp: number): string {
    const d = new Date(timestamp);
    const year = d.getUTCFullYear();
    const quarter = Math.floor(d.getUTCMonth() / 3) + 1;
    return `${year}-Q${quarter}`;
}

/**
 * Build a partitioned series key.
 * @param symbol - e.g. "BTCUSDT"
 * @param interval - e.g. "1h"
 * @param timestamp - Unix ms to determine the quarter
 * @returns e.g. "BTCUSDT:1h:2024-Q1"
 */
export function partitionKey(symbol: string, interval: string, timestamp: number): string {
    return `${symbol}:${interval}:${quarterFromTimestamp(timestamp)}`;
}

/**
 * Get the start timestamp (ms) of a quarter.
 * @param quarter - e.g. "2024-Q1"
 * @returns Unix ms of the first moment of that quarter
 */
export function quarterStartMs(quarter: string): number {
    const match = quarter.match(/^(\d{4})-Q([1-4])$/);
    if (!match) return 0;
    const year = parseInt(match[1]!, 10);
    const q = parseInt(match[2]!, 10);
    const month = (q - 1) * 3; // 0-indexed
    return Date.UTC(year, month, 1);
}

/**
 * Get the end timestamp (ms) of a quarter (exclusive).
 * @param quarter - e.g. "2024-Q1"
 * @returns Unix ms just past the last moment of that quarter
 */
export function quarterEndMs(quarter: string): number {
    const match = quarter.match(/^(\d{4})-Q([1-4])$/);
    if (!match) return 0;
    const year = parseInt(match[1]!, 10);
    const q = parseInt(match[2]!, 10);
    const nextMonth = q * 3; // Month after the quarter ends (0-indexed)
    if (nextMonth >= 12) {
        return Date.UTC(year + 1, 0, 1);
    }
    return Date.UTC(year, nextMonth, 1);
}

/**
 * List all quarterly partition keys that overlap a time range.
 * @param symbol - e.g. "BTCUSDT"
 * @param interval - e.g. "1h"
 * @param startTime - Range start (ms)
 * @param endTime - Range end (ms)
 * @returns Array of partition keys, e.g. ["BTCUSDT:1h:2024-Q3", "BTCUSDT:1h:2024-Q4"]
 */
export function partitionsForRange(
    symbol: string,
    interval: string,
    startTime: number,
    endTime: number,
): string[] {
    const keys: string[] = [];

    // Start from the quarter containing startTime
    let cursor = quarterStartMs(quarterFromTimestamp(startTime));

    while (cursor <= endTime) {
        const q = quarterFromTimestamp(cursor);
        keys.push(`${symbol}:${interval}:${q}`);

        // Advance to the next quarter
        const end = quarterEndMs(q);
        if (end <= cursor) break; // Safety: avoid infinite loop
        cursor = end;
    }

    return keys;
}

/**
 * Parse a partitioned key back into its components.
 * @param key - e.g. "BTCUSDT:1h:2024-Q1"
 * @returns Parsed components, or null if not a partitioned key
 */
export function parsePartitionKey(key: string): {
    symbol: string;
    interval: string;
    quarter: string;
} | null {
    const parts = key.split(':');
    if (parts.length !== 3 || !parts[2]?.match(/^\d{4}-Q[1-4]$/)) {
        return null;
    }
    return {
        symbol: parts[0]!,
        interval: parts[1]!,
        quarter: parts[2]!,
    };
}

/**
 * Check if a key is a legacy (non-partitioned) key.
 * Legacy format: "SYMBOL:INTERVAL" (2 parts)
 * Partitioned format: "SYMBOL:INTERVAL:YYYY-QN" (3 parts)
 */
export function isLegacyKey(key: string): boolean {
    const parts = key.split(':');
    return parts.length === 2;
}

/**
 * Group bars into quarterly partitions.
 * @param symbol - e.g. "BTCUSDT"
 * @param interval - e.g. "1h"
 * @param bars - Array of bars (must have .t field)
 * @returns Map of partitionKey → bars
 */
export function groupBarsByPartition<T extends { t: number }>(
    symbol: string,
    interval: string,
    bars: T[],
): Map<string, T[]> {
    const partitions = new Map<string, T[]>();

    for (const bar of bars) {
        const key = partitionKey(symbol, interval, bar.t);
        let partition = partitions.get(key);
        if (!partition) {
            partition = [];
            partitions.set(key, partition);
        }
        partition.push(bar);
    }

    return partitions;
}
