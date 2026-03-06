// ═══════════════════════════════════════════════════════════════════
// charEdge — TimeSeriesStore Tests
// Covers: Block splitting, B-tree range queries, LRU cache,
//         binary encode/decode, CRC32, quota enforcement
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import {
    TimeSeriesStore,
    LRUCache,
    BLOCK_SIZE,
    encodeBlock,
    decodeBlock,
} from '../../data/engine/TimeSeriesStore.ts';

// ─── LRU Cache ──────────────────────────────────────────────────

describe('LRUCache', () => {
    it('stores and retrieves values', () => {
        const cache = new LRUCache(3);
        cache.set('a', [1]);
        cache.set('b', [2]);
        expect(cache.get('a')).toEqual([1]);
        expect(cache.get('b')).toEqual([2]);
    });

    it('evicts least-recently-used when over capacity', () => {
        const cache = new LRUCache(2);
        cache.set('a', [1]);
        cache.set('b', [2]);
        cache.set('c', [3]); // should evict 'a'
        expect(cache.has('a')).toBe(false);
        expect(cache.has('b')).toBe(true);
        expect(cache.has('c')).toBe(true);
    });

    it('promotes accessed items to most-recently-used', () => {
        const cache = new LRUCache(2);
        cache.set('a', [1]);
        cache.set('b', [2]);
        cache.get('a'); // promote 'a'
        cache.set('c', [3]); // should evict 'b' (now LRU)
        expect(cache.has('a')).toBe(true);
        expect(cache.has('b')).toBe(false);
        expect(cache.has('c')).toBe(true);
    });

    it('tracks size correctly', () => {
        const cache = new LRUCache(5);
        cache.set('a', 1);
        cache.set('b', 2);
        expect(cache.size).toBe(2);
        cache.clear();
        expect(cache.size).toBe(0);
    });

    it('overwrites existing keys without increasing size', () => {
        const cache = new LRUCache(2);
        cache.set('a', 1);
        cache.set('a', 2);
        expect(cache.size).toBe(1);
        expect(cache.get('a')).toBe(2);
    });

    it('returns undefined for missing keys', () => {
        const cache = new LRUCache(2);
        expect(cache.get('nonexistent')).toBeUndefined();
    });
});

// ─── Binary Encode/Decode ───────────────────────────────────────

describe('encodeBlock / decodeBlock', () => {
    const bars = [
        { t: 1000000, o: 100, h: 110, l: 95, c: 105, v: 1000 },
        { t: 1060000, o: 105, h: 115, l: 100, c: 110, v: 1500 },
        { t: 1120000, o: 110, h: 120, l: 105, c: 115, v: 2000 },
    ];

    it('round-trips bars through encode → decode', () => {
        const encoded = encodeBlock(bars);
        const decoded = decodeBlock(encoded);
        expect(decoded).not.toBeNull();
        expect(decoded).toHaveLength(3);
        expect(decoded[0].t).toBe(1000000);
        expect(decoded[0].o).toBe(100);
        expect(decoded[2].v).toBe(2000);
    });

    it('produces exactly BYTES_PER_BAR * count + CRC32 bytes', () => {
        const encoded = encodeBlock(bars);
        // 3 bars × 48 bytes + 4 CRC = 148
        expect(encoded.byteLength).toBe(3 * 48 + 4);
    });

    it('detects CRC32 corruption', () => {
        const encoded = encodeBlock(bars);
        // Corrupt a byte
        const view = new Uint8Array(encoded);
        view[10] ^= 0xFF;
        const decoded = decodeBlock(encoded);
        expect(decoded).toBeNull();
    });

    it('handles empty bars', () => {
        const encoded = encodeBlock([]);
        // 0 bars + 4 CRC = 4 bytes
        expect(encoded.byteLength).toBe(4);
    });

    it('handles single bar', () => {
        const single = [{ t: 500, o: 10, h: 20, l: 5, c: 15, v: 100 }];
        const encoded = encodeBlock(single);
        const decoded = decodeBlock(encoded);
        expect(decoded).toHaveLength(1);
        expect(decoded[0].t).toBe(500);
    });
});

// ─── TimeSeriesStore ────────────────────────────────────────────

describe('TimeSeriesStore', () => {
    let store;

    beforeEach(() => {
        store = new TimeSeriesStore();
    });

    it('initializes successfully', async () => {
        await store.init();
        expect(store.isOPFS).toBeDefined();
    });

    it('returns empty array for unknown series', async () => {
        await store.init();
        const result = await store.read('UNKNOWN', '1m', 0, Date.now());
        expect(result).toEqual([]);
    });

    it('returns empty metadata for unknown series', () => {
        const meta = store.getMetadata('UNKNOWN', '1m');
        expect(meta.blockCount).toBe(0);
        expect(meta.totalBars).toBe(0);
    });

    it('writes and reads bars correctly', async () => {
        await store.init();
        const bars = Array.from({ length: 50 }, (_, i) => ({
            t: 1000 + i * 60000,
            o: 100 + i, h: 110 + i, l: 95 + i, c: 105 + i, v: 1000 + i,
        }));

        await store.write('TEST', '1m', bars);
        const result = await store.read('TEST', '1m', 1000, 1000 + 49 * 60000);
        expect(result).toHaveLength(50);
        expect(result[0].t).toBe(1000);
        expect(result[49].t).toBe(1000 + 49 * 60000);
    });

    it('supports range queries', async () => {
        await store.init();
        const bars = Array.from({ length: 100 }, (_, i) => ({
            t: 1000 + i * 60000,
            o: 100 + i, h: 110 + i, l: 95 + i, c: 105 + i, v: 1000 + i,
        }));

        await store.write('RANGE', '1m', bars);

        // Query middle 20 bars
        const start = 1000 + 40 * 60000;
        const end = 1000 + 59 * 60000;
        const result = await store.read('RANGE', '1m', start, end);
        expect(result).toHaveLength(20);
        expect(result[0].t).toBe(start);
        expect(result[19].t).toBe(end);
    });

    it('handles block boundaries correctly', async () => {
        await store.init();
        // Write exactly BLOCK_SIZE bars + 1 to force two blocks
        const bars = Array.from({ length: BLOCK_SIZE + 1 }, (_, i) => ({
            t: 1000 + i * 60000,
            o: 100 + i, h: 110 + i, l: 95 + i, c: 105 + i, v: 1000 + i,
        }));

        await store.write('BLOCKS', '1m', bars);
        const meta = store.getMetadata('BLOCKS', '1m');
        expect(meta.blockCount).toBe(2);
        expect(meta.totalBars).toBe(BLOCK_SIZE + 1);

        // Read across block boundary
        const result = await store.read('BLOCKS', '1m', 1000, 1000 + BLOCK_SIZE * 60000);
        expect(result).toHaveLength(BLOCK_SIZE + 1);
    });

    it('merges new bars with existing data', async () => {
        await store.init();

        // Write first batch
        const batch1 = Array.from({ length: 10 }, (_, i) => ({
            t: 1000 + i * 60000,
            o: 100, h: 110, l: 95, c: 105, v: 1000,
        }));
        await store.write('MERGE', '1m', batch1);

        // Write overlapping + new bars
        const batch2 = Array.from({ length: 10 }, (_, i) => ({
            t: 1000 + (i + 8) * 60000, // overlap last 2, then 8 new
            o: 200, h: 210, l: 195, c: 205, v: 2000,
        }));
        await store.write('MERGE', '1m', batch2);

        // Should have 18 bars total (10 + 8 new, 2 updated)
        const result = await store.read('MERGE', '1m', 0, Infinity);
        expect(result).toHaveLength(18);
        // Overlapping bars should use new data
        const bar8 = result.find(b => b.t === 1000 + 8 * 60000);
        expect(bar8?.o).toBe(200);
    });

    it('clears all data', async () => {
        await store.init();
        const bars = [{ t: 1000, o: 100, h: 110, l: 95, c: 105, v: 1000 }];
        await store.write('CLEAR', '1m', bars);
        await store.clear();
        const result = await store.read('CLEAR', '1m', 0, Infinity);
        expect(result).toEqual([]);
    });

    it('removes a specific series', async () => {
        await store.init();
        const bars = [{ t: 1000, o: 100, h: 110, l: 95, c: 105, v: 1000 }];
        await store.write('REMOVE', '1m', bars);
        await store.write('KEEP', '1m', bars);

        await store.removeSeries('REMOVE', '1m');

        const removed = await store.read('REMOVE', '1m', 0, Infinity);
        const kept = await store.read('KEEP', '1m', 0, Infinity);
        expect(removed).toEqual([]);
        expect(kept).toHaveLength(1);
    });

    it('provides storage stats', async () => {
        await store.init();
        const stats = store.getStats();
        expect(stats).toHaveProperty('totalBytes');
        expect(stats).toHaveProperty('quotaBytes');
        expect(stats).toHaveProperty('usagePercent');
        expect(stats).toHaveProperty('series');
    });

    it('sorts bars by timestamp on write', async () => {
        await store.init();
        const unsorted = [
            { t: 3000, o: 103, h: 113, l: 98, c: 108, v: 1003 },
            { t: 1000, o: 100, h: 110, l: 95, c: 105, v: 1000 },
            { t: 2000, o: 102, h: 112, l: 97, c: 107, v: 1002 },
        ];
        await store.write('SORT', '1m', unsorted);
        const result = await store.read('SORT', '1m', 0, Infinity);
        expect(result[0].t).toBe(1000);
        expect(result[1].t).toBe(2000);
        expect(result[2].t).toBe(3000);
    });

    it('readAll returns all bars', async () => {
        await store.init();
        const bars = Array.from({ length: 25 }, (_, i) => ({
            t: 1000 + i * 60000,
            o: 100 + i, h: 110 + i, l: 95 + i, c: 105 + i, v: 1000 + i,
        }));
        await store.write('ALL', '5m', bars);
        const result = await store.readAll('ALL', '5m');
        expect(result).toHaveLength(25);
    });
});
