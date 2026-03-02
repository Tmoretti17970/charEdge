// ═══════════════════════════════════════════════════════════════════
// charEdge v15 — Tick Persistence
//
// Batched tick writer that bridges real-time WebSocket data to
// IndexedDB for long-term storage. Every trade tick that flows
// through OrderFlowBridge is enqueued here and flushed to disk
// in efficient batches, using requestIdleCallback to never block
// the render loop.
//
// Architecture:
//   1. enqueue() adds ticks to an in-memory ring buffer (hot cache)
//   2. Every 5 seconds OR when buffer hits 500+ ticks, flush to IDB
//   3. Flushes happen via requestIdleCallback (non-blocking)
//   4. LRU eviction keeps storage within budget (7 days default)
//   5. Export API lets users download their accumulated tick data
//
// Performance:
//   - Ring buffer: O(1) enqueue, no GC pressure
//   - Batch writes: amortize IDB transaction overhead
//   - Idle callback: never steal rendering frames
//
// Usage:
//   import { tickPersistence } from './TickPersistence.js';
//   tickPersistence.enqueue('BTCUSDT', { price, volume, time, side });
//   const ticks = await tickPersistence.getTickRange('BTCUSDT', from, to);
//   const csv = await tickPersistence.exportCSV('BTCUSDT');
// ═══════════════════════════════════════════════════════════════════

import { pipelineLogger } from '../infra/DataPipelineLogger.js';
import { openUnifiedDB } from '../../UnifiedDB.js';

// ─── Constants ─────────────────────────────────────────────────

const STORE_NAME = 'ticks';
const META_STORE = 'tickMeta'; // Renamed from 'meta' to avoid collision with cache meta

const FLUSH_INTERVAL_MS = 5000;       // Flush every 5 seconds
const FLUSH_THRESHOLD = 500;          // Or when buffer hits 500 ticks
const MAX_RING_SIZE = 2000;           // Hot cache ring buffer per symbol
const RETENTION_DAYS = 7;             // Keep 7 days of tick data
const RETENTION_MS = RETENTION_DAYS * 86400000;
const EVICTION_CHECK_INTERVAL = 30 * 60 * 1000; // Check every 30 min
const BATCH_SIZE = 200;               // IDB batch write size

// ─── Helpers ───────────────────────────────────────────────────

const rIC = typeof requestIdleCallback === 'function'
  ? requestIdleCallback
  : (cb) => setTimeout(cb, 1);

const cIC = typeof cancelIdleCallback === 'function'
  ? cancelIdleCallback
  : clearTimeout;

// ─── Database Manager ──────────────────────────────────────────
// Delegates to UnifiedDB — single database for all charEdge data.

let _db = null;

function openTickDB() {
  return openUnifiedDB().then((db) => { _db = db; return db; });
}

// ─── Per-Symbol TypedArray Ring Buffer ─────────────────────────
// Struct-of-arrays layout: [price, volume, time, side] per tick
// Each tick = 4 Float64 slots = 32 bytes. No GC pressure.

const FIELDS_PER_TICK = 4;  // price, volume, time, side

class TypedRingBuffer {
  constructor(capacity) {
    this.capacity = capacity;
    this._data = new Float64Array(capacity * FIELDS_PER_TICK);
    this.head = 0;
    this.count = 0;
  }

  push(price, volume, time, side) {
    const idx = (this.head % this.capacity) * FIELDS_PER_TICK;
    this._data[idx]     = price;
    this._data[idx + 1] = volume;
    this._data[idx + 2] = time;
    this._data[idx + 3] = side;
    this.head++;
    if (this.count < this.capacity) this.count++;
  }

  // Drain all items (returns object array for IDB/API compat and resets)
  drain(symbol) {
    if (this.count === 0) return [];
    const items = [];
    const start = this.head - this.count;
    for (let i = 0; i < this.count; i++) {
      const idx = ((start + i) % this.capacity) * FIELDS_PER_TICK;
      items.push({
        symbol,
        price:  this._data[idx],
        volume: this._data[idx + 1],
        time:   this._data[idx + 2],
        side:   this._data[idx + 3],    // 1 = buy, 0 = sell
      });
    }
    this.count = 0;
    this.head = 0;
    return items;
  }

  // Get most recent N items without draining
  peek(n) {
    const count = Math.min(n, this.count);
    const items = [];
    const start = this.head - count;
    for (let i = 0; i < count; i++) {
      const idx = ((start + i) % this.capacity) * FIELDS_PER_TICK;
      items.push({
        price:  this._data[idx],
        volume: this._data[idx + 1],
        time:   this._data[idx + 2],
        side:   this._data[idx + 3] === 1 ? 'buy' : 'sell',
      });
    }
    return items;
  }

  // Estimated memory usage in bytes
  get memoryBytes() { return this._data.byteLength; }

  get size() { return this.count; }
}

// ─── Tick Persistence Engine ───────────────────────────────────

class _TickPersistence {
  constructor() {
    this._buffers = new Map();         // symbol → RingBuffer
    this._pendingFlush = new Map();    // symbol → tick[]  (awaiting IDB write)
    this._flushTimer = null;
    this._evictionTimer = null;
    this._idleHandle = null;
    this._totalEnqueued = 0;
    this._totalFlushed = 0;
    this._enabled = typeof indexedDB !== 'undefined';
    this._started = false;
    this._metaCache = new Map();       // symbol → { totalTicks, firstTime, lastTime }

    if (this._enabled) {
      this._start();
    }
  }

  // ─── Public API ──────────────────────────────────────────────

  /**
   * Enqueue a tick for persistence.
   * This is the hot path — called from OrderFlowBridge on every trade.
   * Must be fast: O(1), no async, no IDB access.
   *
   * @param {string} symbol - e.g., 'BTCUSDT'
   * @param {Object} tick - { price, volume, time, side, source? }
   */
  enqueue(symbol, tick) {
    if (!this._enabled || !symbol || !tick) return;

    const upper = symbol.toUpperCase();
    let ring = this._buffers.get(upper);
    if (!ring) {
      ring = new TypedRingBuffer(MAX_RING_SIZE);
      this._buffers.set(upper, ring);
    }

    ring.push(
      tick.price,
      tick.volume,
      tick.time || Date.now(),
      tick.side === 'buy' ? 1 : 0  // Bitwise encoding for compactness
    );

    this._totalEnqueued++;

    // Check if any buffer hit the flush threshold
    if (ring.size >= FLUSH_THRESHOLD) {
      this._scheduleFlush();
    }
  }

  /**
   * Get ticks from IndexedDB for a symbol within a time range.
   *
   * @param {string} symbol
   * @param {number} fromTime - Start timestamp ms
   * @param {number} toTime - End timestamp ms
   * @param {number} [limit=10000] - Max ticks to return
   * @returns {Promise<Array>}
   */
  async getTickRange(symbol, fromTime, toTime, limit = 10000) {
    if (!this._enabled) return [];
    const upper = (symbol || '').toUpperCase();

    try {
      const db = await openTickDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('symbol_time');
        const range = IDBKeyRange.bound([upper, fromTime], [upper, toTime]);
        const results = [];

        const req = index.openCursor(range);
        req.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor && results.length < limit) {
            const tick = cursor.value;
            results.push({
              price: tick.price,
              volume: tick.volume,
              time: tick.time,
              side: tick.side === 1 ? 'buy' : 'sell',
              source: tick.source,
            });
            cursor.continue();
          } else {
            resolve(results);
          }
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  /**
   * Get the most recent ticks from the hot cache (no IDB access).
   *
   * @param {string} symbol
   * @param {number} [count=100]
   * @returns {Array}
   */
  getRecentTicks(symbol, count = 100) {
    const ring = this._buffers.get((symbol || '').toUpperCase());
    if (!ring) return [];
    return ring.peek(count);
  }

  /**
   * Export tick data as CSV string.
   *
   * @param {string} symbol
   * @param {number} [fromTime=0] - Start time (0 = all)
   * @param {number} [toTime=Infinity] - End time
   * @returns {Promise<string>} CSV content
   */
  async exportCSV(symbol, fromTime = 0, toTime = Date.now()) {
    const ticks = await this.getTickRange(symbol, fromTime, toTime, Infinity);
    if (!ticks.length) return '';

    const header = 'timestamp,price,volume,side,source\n';
    const rows = ticks.map(t =>
      `${t.time},${t.price},${t.volume},${t.side},${t.source}`
    ).join('\n');

    return header + rows;
  }

  /**
   * Export tick data as JSON string.
   *
   * @param {string} symbol
   * @param {number} [fromTime=0]
   * @param {number} [toTime]
   * @returns {Promise<string>}
   */
  async exportJSON(symbol, fromTime = 0, toTime = Date.now()) {
    const ticks = await this.getTickRange(symbol, fromTime, toTime, Infinity);
    return JSON.stringify({
      symbol: (symbol || '').toUpperCase(),
      exportTime: new Date().toISOString(),
      tickCount: ticks.length,
      fromTime,
      toTime,
      ticks,
    }, null, 2);
  }

  /**
   * Trigger a file download of the exported data.
   *
   * @param {string} symbol
   * @param {'csv'|'json'} [format='csv']
   */
  async downloadExport(symbol, format = 'csv') {
    const upper = (symbol || '').toUpperCase();
    let content, filename, mimeType;

    if (format === 'json') {
      content = await this.exportJSON(upper);
      filename = `charEdge_${upper}_ticks_${Date.now()}.json`;
      mimeType = 'application/json';
    } else {
      content = await this.exportCSV(upper);
      filename = `charEdge_${upper}_ticks_${Date.now()}.csv`;
      mimeType = 'text/csv';
    }

    if (!content) return;

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Get data inventory — what tick data the user has accumulated.
   *
   * @returns {Promise<Object>} { [symbol]: { totalTicks, firstTime, lastTime, daysCovered } }
   */
  async getDataInventory() {
    if (!this._enabled) return {};

    try {
      const db = await openTickDB();
      return new Promise((resolve) => {
        const tx = db.transaction(META_STORE, 'readonly');
        const store = tx.objectStore(META_STORE);
        const req = store.getAll();
        req.onsuccess = () => {
          const inventory = {};
          for (const meta of (req.result || [])) {
            inventory[meta.symbol] = {
              totalTicks: meta.totalTicks || 0,
              firstTime: meta.firstTime,
              lastTime: meta.lastTime,
              firstDate: meta.firstTime ? new Date(meta.firstTime).toISOString().slice(0, 10) : null,
              lastDate: meta.lastTime ? new Date(meta.lastTime).toISOString().slice(0, 10) : null,
              daysCovered: meta.firstTime && meta.lastTime
                ? Math.ceil((meta.lastTime - meta.firstTime) / 86400000)
                : 0,
            };
          }
          resolve(inventory);
        };
        req.onerror = () => resolve({});
      });
    } catch {
      return {};
    }
  }

  /**
   * Get persistence stats.
   */
  getStats() {
    const bufferStats = {};
    for (const [sym, ring] of this._buffers) {
      bufferStats[sym] = ring.size;
    }
    return {
      enabled: this._enabled,
      totalEnqueued: this._totalEnqueued,
      totalFlushed: this._totalFlushed,
      pendingFlush: [...this._pendingFlush.values()].reduce((s, a) => s + a.length, 0),
      bufferSizes: bufferStats,
      symbols: [...this._buffers.keys()],
    };
  }

  /**
   * Force an immediate flush of all pending ticks.
   */
  async flush() {
    await this._flushAll();
  }

  /**
   * Dispose: flush remaining ticks and clean up.
   */
  async dispose() {
    if (this._flushTimer) clearInterval(this._flushTimer);
    if (this._evictionTimer) clearInterval(this._evictionTimer);
    if (this._idleHandle) cIC(this._idleHandle);

    // Flush remaining ticks
    await this._flushAll();

    this._buffers.clear();
    this._pendingFlush.clear();
    this._started = false;
  }

  // ─── Private Methods ─────────────────────────────────────────

  /** @private */
  _start() {
    if (this._started) return;
    this._started = true;

    // Periodic flush timer
    this._flushTimer = setInterval(() => {
      this._scheduleFlush();
    }, FLUSH_INTERVAL_MS);

    // Periodic eviction check
    this._evictionTimer = setInterval(() => {
      this._evictOldTicks();
    }, EVICTION_CHECK_INTERVAL);

    // Initial eviction on startup
    setTimeout(() => this._evictOldTicks(), 10000);

    // ── Data Integrity: flush on page unload ──
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this._flushAllSync();
      });

      // Flush when tab goes to background (user switches tabs)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this._flushAll().catch((err) => {
            pipelineLogger.warn('TickPersistence', 'Visibility flush failed', err);
          });
        }
      });
    }
  }

  /** @private — Schedule a flush via requestIdleCallback */
  _scheduleFlush() {
    if (this._idleHandle) return; // Already scheduled

    this._idleHandle = rIC(() => {
      this._idleHandle = null;
      this._flushAll().catch((err) => {
        pipelineLogger.warn('TickPersistence', 'Scheduled flush failed', err);
      });
    }, { timeout: 2000 }); // Max 2 second deadline
  }

  /** @private — Flush all symbol buffers to IndexedDB */
  async _flushAll() {
    if (!this._enabled) return;

    // Drain all ring buffers
    const allTicks = new Map();
    for (const [symbol, ring] of this._buffers) {
      if (ring.size === 0) continue;
      const ticks = ring.drain(symbol);
      if (ticks.length > 0) {
        allTicks.set(symbol, ticks);
      }
    }

    if (allTicks.size === 0) return;

    try {
      const db = await openTickDB();

      // Write ticks in batches per symbol
      for (const [symbol, ticks] of allTicks) {
        await this._writeBatch(db, symbol, ticks);
      }
    } catch (err) {
      pipelineLogger.error('TickPersistence', 'Flush failed — re-enqueuing ticks', err);
      // Re-enqueue failed ticks (push back to ring buffers)
      for (const [symbol, ticks] of allTicks) {
        for (const tick of ticks) {
          this.enqueue(symbol, tick);
        }
      }
    }
  }

  /** @private — Write a batch of ticks along with meta update */
  async _writeBatch(db, symbol, ticks) {
    if (!ticks.length) return;

    return new Promise((resolve) => {
      const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      // Write ticks
      for (const tick of ticks) {
        store.add(tick);
      }

      // Update meta
      const metaStore = tx.objectStore(META_STORE);
      const metaReq = metaStore.get(symbol);
      metaReq.onsuccess = () => {
        const existing = metaReq.result || {
          symbol,
          totalTicks: 0,
          firstTime: ticks[0].time,
          lastTime: ticks[ticks.length - 1].time,
        };

        existing.totalTicks += ticks.length;
        existing.lastTime = Math.max(existing.lastTime || 0, ticks[ticks.length - 1].time);
        if (!existing.firstTime || ticks[0].time < existing.firstTime) {
          existing.firstTime = ticks[0].time;
        }

        metaStore.put(existing);
      };

      tx.oncomplete = () => {
        this._totalFlushed += ticks.length;
        resolve();
      };
      tx.onerror = () => resolve();
    });
  }

  /**
   * @private — Synchronous emergency flush on page unload.
   * Uses synchronous IDB transaction to save as many ticks as possible
   * before the page closes.
   */
  _flushAllSync() {
    if (!this._enabled || !_db) return;

    try {
      // Drain all ring buffers
      for (const [symbol, ring] of this._buffers) {
        if (ring.size === 0) continue;
        const ticks = ring.drain();
        if (ticks.length === 0) continue;

        // Synchronous IDB write (best effort — may not complete)
        const tx = _db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        for (const tick of ticks) {
          store.add(tick);
        }
        this._totalFlushed += ticks.length;
      }
    } catch {
      // Best effort — page is unloading
    }
  }

  /** @private — Evict ticks older than retention period */
  async _evictOldTicks() {
    if (!this._enabled) return;

    try {
      const db = await openTickDB();
      const cutoff = Date.now() - RETENTION_MS;

      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('time');
        const range = IDBKeyRange.upperBound(cutoff);

        let evicted = 0;
        const req = index.openCursor(range);
        req.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            cursor.delete();
            evicted++;
            cursor.continue();
          }
        };

        tx.oncomplete = () => {
          if (evicted > 0) {
            pipelineLogger.info('TickPersistence', `Evicted ${evicted} ticks older than ${RETENTION_DAYS} days`);
          }
          resolve();
        };
        tx.onerror = () => resolve();
      });
    } catch (err) {
      pipelineLogger.warn('TickPersistence', 'Eviction failed', err);
    }
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const tickPersistence = new _TickPersistence();
export default tickPersistence;
