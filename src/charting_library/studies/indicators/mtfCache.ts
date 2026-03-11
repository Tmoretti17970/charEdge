// ═══════════════════════════════════════════════════════════════════
// charEdge — MTF Aggregation Cache (Phase 4)
// Caches aggregated BarDataBuffers by source + target TF
// ═══════════════════════════════════════════════════════════════════

import type { BarDataBuffer } from '../../core/BarDataBuffer.ts';

interface CacheEntry {
    buffer: BarDataBuffer;
    stamp: number;       // Data version stamp
    sourceLen: number;   // Length of source buffer when cached
}

const _cache = new Map<string, CacheEntry>();
const MAX_ENTRIES = 20;

/**
 * Get or compute a cached aggregation.
 * Returns cached buffer if source data hasn't changed.
 *
 * @param key           - Cache key (e.g. "BTC-1m-to-60m")
 * @param sourceLen     - Current source buffer length (invalidation check)
 * @param stamp         - Data version stamp (from last append/update)
 * @param computeFn     - Function to build the aggregated buffer if cache miss
 */
export function getCachedAggregation(
    key: string,
    sourceLen: number,
    stamp: number,
    computeFn: () => BarDataBuffer,
): BarDataBuffer {
    const existing = _cache.get(key);

    // Cache hit: same data length and stamp
    if (existing && existing.sourceLen === sourceLen && existing.stamp === stamp) {
        return existing.buffer;
    }

    // Cache miss: compute and store
    const buffer = computeFn();
    _cache.set(key, { buffer, stamp, sourceLen });

    // Evict oldest if over limit
    if (_cache.size > MAX_ENTRIES) {
        const firstKey = _cache.keys().next().value;
        if (firstKey) _cache.delete(firstKey);
    }

    return buffer;
}

/** Clear all cached aggregations. */
export function clearMtfCache(): void {
    _cache.clear();
}

/** Get cache stats for debugging. */
export function getMtfCacheStats(): { size: number; keys: string[] } {
    return { size: _cache.size, keys: Array.from(_cache.keys()) };
}
