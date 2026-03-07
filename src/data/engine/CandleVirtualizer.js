// ═══════════════════════════════════════════════════════════════════
// charEdge — Candle Virtualizer (Task B4.1)
//
// Sliding window manager — keeps only N bars in memory, evicts older
// bars to IndexedDB, and restores them on scroll-back. This prevents
// unbounded memory growth for assets with deep history.
//
// Usage:
//   const v = new CandleVirtualizer({ windowSize: 5000 });
//   v.setData('BTCUSDT', '1h', bars);     // Initial load
//   v.appendBar('BTCUSDT', '1h', newBar); // Real-time updates
//   const restored = await v.restoreLeft('BTCUSDT', '1h', 500);
//
// ═══════════════════════════════════════════════════════════════════

import { logger } from '../../utils/logger.js';

// ─── Constants ─────────────────────────────────────────────────

const DEFAULT_WINDOW_SIZE = 5_000;      // Bars in memory
const DEFAULT_EVICTION_BATCH = 1_000;   // Bars per eviction write
const DEFAULT_RESTORE_BATCH = 500;      // Bars per restore read
const DB_NAME = 'charEdge_candleCache';
const DB_VERSION = 1;
const STORE_NAME = 'bars';

// ─── IndexedDB Helpers ─────────────────────────────────────────

/**
 * Open the candle cache database.
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Build a storage key for a set of bars.
 * @param {string} symbol
 * @param {string} tf
 * @param {number} chunkIndex - Sequential chunk number
 * @returns {string}
 */
function storageKey(symbol, tf, chunkIndex) {
  return `${symbol}:${tf}:chunk_${chunkIndex}`;
}

/**
 * Build the metadata key for a symbol+tf pair.
 * @param {string} symbol
 * @param {string} tf
 * @returns {string}
 */
function metaKey(symbol, tf) {
  return `${symbol}:${tf}:meta`;
}

// ─── CandleVirtualizer ────────────────────────────────────────

class _CandleVirtualizer {
  /**
   * @param {Object} [options]
   * @param {number} [options.windowSize=5000]
   * @param {number} [options.evictionBatch=1000]
   * @param {number} [options.restoreBatch=500]
   */
  constructor(options = {}) {
    this._windowSize = options.windowSize || DEFAULT_WINDOW_SIZE;
    this._evictionBatch = options.evictionBatch || DEFAULT_EVICTION_BATCH;
    this._restoreBatch = options.restoreBatch || DEFAULT_RESTORE_BATCH;

    /**
     * In-memory bar windows.
     * key: `${symbol}:${tf}` → { bars: Bar[], evictedChunks: number, totalEvicted: number }
     * @type {Map<string, Object>}
     */
    this._windows = new Map();

    /** @type {IDBDatabase|null} */
    this._db = null;

    /** @type {boolean} */
    this._dbReady = false;

    /** @type {Promise<void>|null} */
    this._dbInitPromise = null;
  }

  // ── Initialization ─────────────────────────────────────────

  /**
   * Initialize IndexedDB connection.
   * @returns {Promise<void>}
   */
  async _ensureDB() {
    if (this._dbReady) return;
    if (this._dbInitPromise) return this._dbInitPromise;

    this._dbInitPromise = openDB().then(db => {
      this._db = db;
      this._dbReady = true;
    }).catch(err => {
      logger.data.warn('[CandleVirtualizer] IndexedDB init failed:', err?.message);
      this._dbReady = false;
    });

    return this._dbInitPromise;
  }

  // ── Core API ───────────────────────────────────────────────

  /**
   * Set initial data for a symbol+tf pair. If data exceeds window size,
   * the oldest bars are evicted to IndexedDB.
   *
   * @param {string} symbol
   * @param {string} tf
   * @param {Array} bars - Sorted ascending by time
   * @returns {Promise<Array>} The visible (in-memory) bars
   */
  async setData(symbol, tf, bars) {
    const key = `${symbol}:${tf}`;

    if (!bars?.length) {
      this._windows.set(key, { bars: [], evictedChunks: 0, totalEvicted: 0 });
      return [];
    }

    if (bars.length <= this._windowSize) {
      this._windows.set(key, { bars: [...bars], evictedChunks: 0, totalEvicted: 0 });
      return bars;
    }

    // Evict oldest bars beyond window size
    const cutoff = bars.length - this._windowSize;
    const toEvict = bars.slice(0, cutoff);
    const toKeep = bars.slice(cutoff);

    // Store evicted bars in IndexedDB
    const chunks = await this._evictToDB(symbol, tf, toEvict);

    this._windows.set(key, {
      bars: toKeep,
      evictedChunks: chunks,
      totalEvicted: toEvict.length,
    });

    logger.data.info(
      `[CandleVirtualizer] ${key}: Loaded ${bars.length} bars, kept ${toKeep.length} in memory, evicted ${toEvict.length} to IndexedDB`
    );

    return toKeep;
  }

  /**
   * Append a real-time bar to the right edge of the window.
   * Triggers eviction if window exceeds size.
   *
   * @param {string} symbol
   * @param {string} tf
   * @param {Object} bar
   */
  async appendBar(symbol, tf, bar) {
    const key = `${symbol}:${tf}`;
    let state = this._windows.get(key);

    if (!state) {
      state = { bars: [], evictedChunks: 0, totalEvicted: 0 };
      this._windows.set(key, state);
    }

    state.bars.push(bar);

    // Check if eviction is needed
    if (state.bars.length > this._windowSize + this._evictionBatch) {
      const toEvict = state.bars.splice(0, this._evictionBatch);
      const newChunks = await this._evictToDB(symbol, tf, toEvict);
      state.evictedChunks += newChunks;
      state.totalEvicted += toEvict.length;

      logger.data.info(
        `[CandleVirtualizer] ${key}: Evicted ${toEvict.length} bars (total evicted: ${state.totalEvicted})`
      );
    }
  }

  /**
   * Restore bars from IndexedDB to the left edge of the window.
   *
   * @param {string} symbol
   * @param {string} tf
   * @param {number} [count] - Number of bars to restore (default: restoreBatch)
   * @returns {Promise<Array>} Restored bars
   */
  async restoreLeft(symbol, tf, count) {
    const key = `${symbol}:${tf}`;
    const state = this._windows.get(key);
    if (!state || state.evictedChunks <= 0) return [];

    const restoreCount = count || this._restoreBatch;
    const restored = await this._restoreFromDB(symbol, tf, restoreCount, state);

    if (restored.length > 0) {
      // Prepend to current window
      state.bars = [...restored, ...state.bars];
      state.totalEvicted -= restored.length;

      logger.data.info(
        `[CandleVirtualizer] ${key}: Restored ${restored.length} bars (evicted remaining: ${state.totalEvicted})`
      );
    }

    return restored;
  }

  // ── Query ──────────────────────────────────────────────────

  /**
   * Get the current in-memory bar window.
   * @param {string} symbol
   * @param {string} tf
   * @returns {Array}
   */
  getVisibleBars(symbol, tf) {
    const state = this._windows.get(`${symbol}:${tf}`);
    return state?.bars || [];
  }

  /**
   * Check if there are evicted bars to the left (older data in IndexedDB).
   * @param {string} symbol
   * @param {string} tf
   * @returns {boolean}
   */
  hasMoreLeft(symbol, tf) {
    const state = this._windows.get(`${symbol}:${tf}`);
    return (state?.totalEvicted || 0) > 0;
  }

  /**
   * Get count of bars currently in memory for a symbol+tf.
   * @param {string} symbol
   * @param {string} tf
   * @returns {number}
   */
  getWindowCount(symbol, tf) {
    const state = this._windows.get(`${symbol}:${tf}`);
    return state?.bars?.length || 0;
  }

  /**
   * Get total evicted bar count for a symbol+tf.
   * @param {string} symbol
   * @param {string} tf
   * @returns {number}
   */
  getEvictedCount(symbol, tf) {
    const state = this._windows.get(`${symbol}:${tf}`);
    return state?.totalEvicted || 0;
  }

  /**
   * Get the current window size setting.
   * @returns {number}
   */
  get windowSize() {
    return this._windowSize;
  }

  /**
   * Adjust the window size (used by MemoryBudget pressure).
   * @param {number} newSize
   */
  setWindowSize(newSize) {
    this._windowSize = Math.max(500, newSize); // Floor at 500
    logger.data.info(`[CandleVirtualizer] Window size adjusted to ${this._windowSize}`);
  }

  /**
   * Estimate memory usage in bytes.
   * @returns {number}
   */
  estimateMemory() {
    let total = 0;
    for (const state of this._windows.values()) {
      // Each bar ≈ 56 bytes (7 floats × 8 bytes) + object overhead
      total += state.bars.length * 120; // Conservative estimate
    }
    return total;
  }

  // ── IndexedDB Operations ───────────────────────────────────

  /**
   * @private
   * Evict bars to IndexedDB in chunks.
   * @returns {number} Number of chunks written
   */
  async _evictToDB(symbol, tf, bars) {
    await this._ensureDB();
    if (!this._db) return 0;

    const state = this._windows.get(`${symbol}:${tf}`);
    const startChunk = state?.evictedChunks || 0;
    let chunkCount = 0;

    try {
      const tx = this._db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      // Write bars in eviction batches
      for (let i = 0; i < bars.length; i += this._evictionBatch) {
        const chunk = bars.slice(i, i + this._evictionBatch);
        const key = storageKey(symbol, tf, startChunk + chunkCount);
        store.put(chunk, key);
        chunkCount++;
      }

      // Update metadata
      const mk = metaKey(symbol, tf);
      store.put({
        totalChunks: startChunk + chunkCount,
        totalBars: (state?.totalEvicted || 0) + bars.length,
        lastEviction: Date.now(),
      }, mk);

      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      logger.data.warn('[CandleVirtualizer] Eviction to IndexedDB failed:', err?.message);
      return 0;
    }

    return chunkCount;
  }

  /**
   * @private
   * Restore bars from IndexedDB (most recent evicted chunk).
   */
  async _restoreFromDB(symbol, tf, count, state) {
    await this._ensureDB();
    if (!this._db || state.evictedChunks <= 0) return [];

    try {
      const tx = this._db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const restored = [];

      // Read from the most recent evicted chunk backward
      let chunksRead = 0;
      for (let i = state.evictedChunks - 1; i >= 0 && restored.length < count; i--) {
        const key = storageKey(symbol, tf, i);
        const chunk = await new Promise((resolve, reject) => {
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });

        if (chunk?.length) {
          restored.unshift(...chunk);
          // Delete the chunk after reading
          store.delete(key);
          chunksRead++;
        }
      }

      state.evictedChunks -= chunksRead;

      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });

      // Trim to requested count (last N from the restored bars)
      if (restored.length > count) {
        return restored.slice(restored.length - count);
      }

      return restored;
    } catch (err) {
      logger.data.warn('[CandleVirtualizer] Restore from IndexedDB failed:', err?.message);
      return [];
    }
  }

  // ── Cleanup ────────────────────────────────────────────────

  /**
   * Clear all data for a symbol+tf pair.
   * @param {string} symbol
   * @param {string} tf
   */
  async clear(symbol, tf) {
    const key = `${symbol}:${tf}`;
    this._windows.delete(key);

    // Clear from IndexedDB too
    if (this._db) {
      try {
        const tx = this._db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        // Delete all chunks and metadata for this symbol+tf
        const cursorReq = store.openCursor();
        await new Promise((resolve, reject) => {
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (cursor) {
              if (typeof cursor.key === 'string' && cursor.key.startsWith(key)) {
                cursor.delete();
              }
              cursor.continue();
            } else {
              resolve();
            }
          };
          cursorReq.onerror = () => reject(cursorReq.error);
        });
      } catch { /* ignore cleanup errors */ }
    }
  }

  /**
   * Dispose — close DB and clear all state.
   */
  dispose() {
    this._windows.clear();
    if (this._db) {
      this._db.close();
      this._db = null;
    }
    this._dbReady = false;
    this._dbInitPromise = null;
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const CandleVirtualizer = _CandleVirtualizer;
export const candleVirtualizer = new _CandleVirtualizer();
export default candleVirtualizer;
