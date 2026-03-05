// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — TimeSeriesStore (Task 5.1.1 + 5.1.6)
//
// IndexedDB-backed block storage for OHLCV bar data.
// Provides in-memory LRU cache with automatic eviction and
// transparent IndexedDB persistence for historical data.
//
// Block architecture:
//   - Bars are stored in blocks of BLOCK_SIZE (1000 bars)
//   - Key: `{symbol}:{interval}:{blockIdx}`
//   - In-memory LRU cache holds MAX_CACHED_BLOCKS blocks
//   - Overflow spills to IndexedDB
//
// Usage:
//   import { TimeSeriesStore } from './TimeSeriesStore.js';
//   const store = new TimeSeriesStore();
//   await store.init();
//   await store.write('BTC', '1m', bars);
//   const result = await store.read('BTC', '1m', startT, endT);
// ═══════════════════════════════════════════════════════════════════

/** @typedef {{ t: number, o: number, h: number, l: number, c: number, v: number }} Bar */

const DB_NAME = 'charEdge-timeseries';
const DB_VERSION = 1;
const STORE_NAME = 'blocks';
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

/**
 * IndexedDB-backed time series store with in-memory LRU cache.
 */
export class TimeSeriesStore {
    constructor() {
        /** @type {IDBDatabase | null} */
        this._db = null;
        /** @type {LRUCache<Bar[]>} */
        this._cache = new LRUCache(MAX_CACHED_BLOCKS);
        this._initialized = false;
    }

    /**
     * Initialize the IndexedDB connection.
     * Call once before any read/write operations.
     */
    async init() {
        if (this._initialized) return;

        // Skip IndexedDB in environments without it (Node.js tests)
        if (typeof indexedDB === 'undefined') {
            this._initialized = true;
            return;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this._db = request.result;
                this._initialized = true;
                resolve(undefined);
            };

            request.onupgradeneeded = (event) => {
                const db = /** @type {IDBOpenDBRequest} */ (event.target).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
        });
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

        // Split into blocks
        for (let i = 0; i < sorted.length; i += BLOCK_SIZE) {
            const block = sorted.slice(i, i + BLOCK_SIZE);
            const blockIdx = Math.floor(i / BLOCK_SIZE);
            const key = this._blockKey(symbol, interval, blockIdx);

            // Write to LRU cache
            this._cache.set(key, block);

            // Persist to IndexedDB
            await this._writeIDB(key, block);
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

        // Scan blocks (try cache first, then IDB)
        for (let blockIdx = 0; blockIdx < 10000; blockIdx++) {
            const key = this._blockKey(symbol, interval, blockIdx);

            let block = this._cache.get(key);
            if (!block) {
                block = await this._readIDB(key);
                if (!block) break; // No more blocks
                this._cache.set(key, block); // Warm cache
            }

            // Filter bars in range
            for (const bar of block) {
                if (bar.t >= startTime && bar.t <= endTime) {
                    result.push(bar);
                }
                // Optimization: if we've passed endTime, stop early
                if (bar.t > endTime) break;
            }

            // If we found bars past endTime, no need to check more blocks
            if (block.length > 0 && block[block.length - 1].t > endTime) break;
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
        if (this._db) {
            return new Promise((resolve, reject) => {
                const tx = this._db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const req = store.clear();
                req.onsuccess = () => resolve(undefined);
                req.onerror = () => reject(req.error);
            });
        }
    }

    // ─── Private IndexedDB helpers ────────────────────────────────

    /**
     * @param {string} key
     * @param {Bar[]} block
     */
    async _writeIDB(key, block) {
        if (!this._db) return;
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(block, key);
            req.onsuccess = () => resolve(undefined);
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * @param {string} key
     * @returns {Promise<Bar[] | null>}
     */
    async _readIDB(key) {
        if (!this._db) return null;
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }
}

// Export for testing
export { LRUCache, BLOCK_SIZE, MAX_CACHED_BLOCKS };
export default TimeSeriesStore;
