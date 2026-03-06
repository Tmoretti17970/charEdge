// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — TimeSeriesStore (Task 5.1.1 + 5.1.6 + 2.3.3)
//
// OPFS-backed block storage for OHLCV bar data.
// Provides in-memory LRU cache with automatic eviction and
// transparent OPFS persistence via OPFSBarStore (binary format).
//
// Block architecture:
//   - Bars are stored in blocks of BLOCK_SIZE (1000 bars)
//   - Key: `{symbol}:{interval}:{blockIdx}`
//   - In-memory LRU cache holds MAX_CACHED_BLOCKS blocks
//   - Overflow persisted to OPFS (48 bytes/bar binary)
//
// Migration: Prior IndexedDB backend replaced with OPFS (Task 2.3.3)
// for ~50% storage savings and direct binary read/write performance.
//
// Usage:
//   import { TimeSeriesStore } from './TimeSeriesStore.js';
//   const store = new TimeSeriesStore();
//   await store.init();
//   await store.write('BTC', '1m', bars);
//   const result = await store.read('BTC', '1m', startT, endT);
// ═══════════════════════════════════════════════════════════════════

import { opfsBarStore } from './infra/OPFSBarStore.js';

/** @typedef {{ t: number, o: number, h: number, l: number, c: number, v: number }} Bar */

const BLOCK_SIZE = 1000;
const MAX_CACHED_BLOCKS = 50;

/**
 * LRU cache for bar blocks.
 * @template V
 */
class LRUCache {
    /** @param {number} maxSize */
    constructor(maxSize) {
        /** @type {Map<string, V>} */
        this._map = new Map();
        this._maxSize = maxSize;
    }

    /**
     * @param {string} key
     * @returns {V | undefined}
     */
    get(key) {
        if (!this._map.has(key)) return undefined;
        const value = this._map.get(key);
        // Move to end (most recently used)
        this._map.delete(key);
        this._map.set(key, value);
        return value;
    }

    /**
     * @param {string} key
     * @param {V} value
     */
    set(key, value) {
        if (this._map.has(key)) this._map.delete(key);
        this._map.set(key, value);

        // Evict LRU if over capacity
        while (this._map.size > this._maxSize) {
            const firstKey = this._map.keys().next().value;
            this._map.delete(firstKey);
        }
    }

    /** @param {string} key */
    has(key) {
        return this._map.has(key);
    }

    clear() {
        this._map.clear();
    }

    get size() {
        return this._map.size;
    }
}

// ─── Format converters ──────────────────────────────────────────
// TimeSeriesStore uses compact {t,o,h,l,c,v} internally.
// OPFSBarStore uses {time(ISO),open,high,low,close,volume}.

/** Convert compact bar to OPFS format */
function _toOPFS(bar) {
    return {
        time: new Date(bar.t).toISOString(),
        open: bar.o, high: bar.h, low: bar.l, close: bar.c, volume: bar.v,
    };
}

/** Convert OPFS format to compact bar */
function _fromOPFS(bar) {
    return {
        t: typeof bar.time === 'number' ? bar.time : new Date(bar.time).getTime(),
        o: bar.open, h: bar.high, l: bar.low, c: bar.close, v: bar.volume || 0,
    };
}

/**
 * OPFS-backed time series store with in-memory LRU cache.
 */
export class TimeSeriesStore {
    constructor() {
        /** @type {LRUCache<Bar[]>} */
        this._cache = new LRUCache(MAX_CACHED_BLOCKS);
        this._initialized = false;
    }

    /**
     * Initialize the store. Lightweight — OPFS init is lazy.
     * Call once before any read/write operations.
     */
    async init() {
        this._initialized = true;
    }

    /**
     * Generate a block key for a given symbol, interval, and block index.
     * @param {string} symbol
     * @param {string} interval
     * @param {number} blockIdx
     * @returns {string}
     */
    _blockKey(symbol, interval, blockIdx) {
        return `${symbol}:${interval}:${blockIdx}`;
    }

    /**
     * Write bars to the store. Bars are split into blocks.
     *
     * @param {string} symbol
     * @param {string} interval
     * @param {Bar[]} bars - Sorted by timestamp ascending
     */
    async write(symbol, interval, bars) {
        if (!bars.length) return;

        // Sort by timestamp
        const sorted = [...bars].sort((a, b) => a.t - b.t);

        // Split into blocks and cache
        for (let i = 0; i < sorted.length; i += BLOCK_SIZE) {
            const block = sorted.slice(i, i + BLOCK_SIZE);
            const blockIdx = Math.floor(i / BLOCK_SIZE);
            const key = this._blockKey(symbol, interval, blockIdx);

            // Write to LRU cache
            this._cache.set(key, block);
        }

        // Persist to OPFS (binary format, fire-and-forget for performance)
        const opfsBars = sorted.map(_toOPFS);
        try {
            await opfsBarStore.putCandles(symbol, interval, opfsBars);
        } catch (_) {
            // OPFS write failure is non-fatal — data is still in LRU cache
        }
    }

    /**
     * Read bars within a time range.
     *
     * @param {string} symbol
     * @param {string} interval
     * @param {number} startTime - Start timestamp (ms, inclusive)
     * @param {number} endTime - End timestamp (ms, inclusive)
     * @returns {Promise<Bar[]>}
     */
    async read(symbol, interval, startTime, endTime) {
        const result = [];

        // Fast path: scan LRU cache blocks
        let foundInCache = false;
        for (let blockIdx = 0; blockIdx < 10000; blockIdx++) {
            const key = this._blockKey(symbol, interval, blockIdx);
            const block = this._cache.get(key);
            if (!block) break;

            foundInCache = true;
            for (const bar of block) {
                if (bar.t >= startTime && bar.t <= endTime) {
                    result.push(bar);
                }
                if (bar.t > endTime) break;
            }

            if (block.length > 0 && block[block.length - 1].t > endTime) break;
        }

        if (foundInCache && result.length > 0) return result;

        // Cache miss: read from OPFS and warm cache
        try {
            const opfsBars = await opfsBarStore.getCandles(symbol, interval);
            if (!opfsBars.length) return result;

            // Convert and split into blocks for caching
            const compactBars = opfsBars.map(_fromOPFS);
            for (let i = 0; i < compactBars.length; i += BLOCK_SIZE) {
                const block = compactBars.slice(i, i + BLOCK_SIZE);
                const blockIdx = Math.floor(i / BLOCK_SIZE);
                const key = this._blockKey(symbol, interval, blockIdx);
                this._cache.set(key, block);
            }

            // Filter to requested range
            for (const bar of compactBars) {
                if (bar.t >= startTime && bar.t <= endTime) {
                    result.push(bar);
                }
                if (bar.t > endTime) break;
            }
        } catch (_) {
            // OPFS read failure — return whatever we have from cache
        }

        return result;
    }

    /**
     * Get metadata about stored data.
     * @param {string} symbol
     * @param {string} interval
     * @returns {{ blockCount: number, cachedBlocks: number }}
     */
    getMetadata(symbol, interval) {
        let cachedBlocks = 0;
        for (let i = 0; i < 10000; i++) {
            if (this._cache.has(this._blockKey(symbol, interval, i))) {
                cachedBlocks++;
            } else {
                break;
            }
        }
        return { blockCount: cachedBlocks, cachedBlocks };
    }

    /** Clear all cached and persisted data. */
    async clear() {
        this._cache.clear();
        try {
            await opfsBarStore.clear();
        } catch (_) {
            // OPFS clear failure is non-fatal
        }
    }

    /**
     * Check if OPFS persistence is available.
     * @returns {boolean}
     */
    get isOPFS() {
        return opfsBarStore.isAvailable();
    }
}

// Export for testing
export { LRUCache, BLOCK_SIZE, MAX_CACHED_BLOCKS };
export default TimeSeriesStore;

