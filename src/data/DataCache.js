// ═══════════════════════════════════════════════════════════════════
// charEdge v12 — IndexedDB Cache Layer
//
// @deprecated — Prefer importing from CacheManager instead:
//   import { cacheManager } from './engine/infra/CacheManager.js';
//   // cacheManager.getQuote(), cacheManager.putCandles(), etc.
//
// This file is kept for backward compatibility. CacheManager proxies
// all methods defined here. New code should NOT import DataCache directly.
//
// Persistent client-side cache using IndexedDB.
// Reduces API calls by 90%+ for returning users by storing:
//   - OHLCV candle data (only fetch new candles since last known)
//   - Quote snapshots (stale-while-revalidate)
//   - Fundamental data (rarely changes)
//   - Economic series (FRED data cached for hours)
//   - News articles (5 min TTL)
//
// Strategy:
//   1. Check IndexedDB first
//   2. If fresh → return immediately
//   3. If stale → return stale + fetch fresh in background
//   4. If missing → fetch, store, return
//
// Usage:
//   import { dataCache } from './DataCache.js';
//   const candles = await dataCache.getCandles('AAPL', '1d');
//   await dataCache.putCandles('AAPL', '1d', candleArray);
// ═══════════════════════════════════════════════════════════════════

import { openUnifiedDB } from './UnifiedDB.js';

const DB_NAME = 'charEdge-unified'; // For reference — actual open is in UnifiedDB.js

// Store definitions with TTL configs
const STORES = {
  candles: { keyPath: 'key', ttl: 86400000 },      // 24 hours
  quotes: { keyPath: 'key', ttl: 30000 },           // 30 seconds
  fundamentals: { keyPath: 'key', ttl: 3600000 },   // 1 hour
  economic: { keyPath: 'key', ttl: 1800000 },       // 30 min
  news: { keyPath: 'key', ttl: 300000 },            // 5 min
  sentiment: { keyPath: 'key', ttl: 600000 },       // 10 min
  indicators: { keyPath: 'key', ttl: 300000 },      // 5 min
  derivedData: { keyPath: 'key', ttl: 3600000 },     // 1 hour
  volumeProfiles: { keyPath: 'key', ttl: 86400000 }, // 24 hours
  filings: { keyPath: 'key', ttl: Infinity },         // Permanent
  meta: { keyPath: 'key', ttl: Infinity },           // Permanent
  drawings: { keyPath: 'key', ttl: Infinity },       // Permanent (user drawings)
  snapshots: { keyPath: 'key', ttl: 1800000 },       // 30 min (session state)
};

// ─── Database Manager ──────────────────────────────────────────
// Delegates to UnifiedDB — single database for all charEdge data.

function openDB() {
  return openUnifiedDB();
}

// ─── Generic Read/Write ────────────────────────────────────────

async function dbGet(storeName, key) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function dbPut(storeName, key, data) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put({ key, data, timestamp: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

async function dbDelete(storeName, key) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

async function dbClearStore(storeName) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

// ─── DataCache Class ───────────────────────────────────────────

class _DataCache {
  constructor() {
    /** Per-key lock map for serializing concurrent read-then-write operations. */
    this._locks = new Map();
  }

  /**
   * Serialize async operations on the same key to prevent race conditions.
   * Same pattern as OPFSBarStore._withLock().
   * @param {string} key
   * @param {Function} fn - Async function to execute under the lock
   * @returns {Promise<*>}
   */
  async _withLock(key, fn) {
    const prev = this._locks.get(key) || Promise.resolve();
    const next = prev.then(fn, fn);
    this._locks.set(key, next);
    try {
      return await next;
    } finally {
      if (this._locks.get(key) === next) this._locks.delete(key);
    }
  }

  // ─── Candles (OHLCV) ─────────────────────────────────────────

  /**
   * Get cached candles. Returns null if expired or missing.
   * @param {string} symbol
   * @param {string} interval
   * @returns {Promise<Array|null>}
   */
  async getCandles(symbol, interval) {
    const key = `${symbol}:${interval}`;
    const record = await dbGet('candles', key);
    if (!record) return null;

    const age = Date.now() - record.timestamp;
    if (age > STORES.candles.ttl) return null; // Expired
    return record.data;
  }

  /**
   * Store candles. Merges with existing data (append new candles only).
   * Uses per-key locking to prevent race conditions on concurrent writes.
   */
  async putCandles(symbol, interval, candles) {
    if (!candles?.length) return;
    const key = `${symbol}:${interval}`;

    return this._withLock(key, async () => {
      // Try to merge with existing
      const existing = await dbGet('candles', key);
      if (existing?.data?.length) {
        const lastExistingTime = existing.data[existing.data.length - 1].time;
        const newCandles = candles.filter(c => c.time > lastExistingTime);
        if (newCandles.length > 0) {
          const merged = [...existing.data, ...newCandles];
          // Cap at 5000 candles to prevent unbounded growth
          const trimmed = merged.length > 5000 ? merged.slice(-5000) : merged;
          await dbPut('candles', key, trimmed);
        } else {
          // Update timestamp only (data is current)
          await dbPut('candles', key, existing.data);
        }
      } else {
        await dbPut('candles', key, candles);
      }
    });
  }

  /**
   * Get the timestamp of the last cached candle for delta-only fetching.
   * @returns {Promise<number|null>} Unix timestamp or null
   */
  async getLastCandleTime(symbol, interval) {
    const candles = await this.getCandles(symbol, interval);
    if (!candles?.length) return null;
    return candles[candles.length - 1].time;
  }

  // ─── Quotes ──────────────────────────────────────────────────

  async getQuote(symbol) {
    const record = await dbGet('quotes', symbol);
    if (!record) return null;
    if (Date.now() - record.timestamp > STORES.quotes.ttl) return null;
    return record.data;
  }

  async putQuote(symbol, quote) {
    await dbPut('quotes', symbol, quote);
  }

  // ─── Fundamentals ────────────────────────────────────────────

  async getFundamentals(symbol) {
    const record = await dbGet('fundamentals', symbol);
    if (!record) return null;
    if (Date.now() - record.timestamp > STORES.fundamentals.ttl) return null;
    return record.data;
  }

  async putFundamentals(symbol, data) {
    await dbPut('fundamentals', symbol, data);
  }

  // ─── Economic Data ───────────────────────────────────────────

  async getEconomic(seriesId) {
    const record = await dbGet('economic', seriesId);
    if (!record) return null;
    if (Date.now() - record.timestamp > STORES.economic.ttl) return null;
    return record.data;
  }

  async putEconomic(seriesId, data) {
    await dbPut('economic', seriesId, data);
  }

  // ─── News ────────────────────────────────────────────────────

  async getNews(key) {
    const record = await dbGet('news', key);
    if (!record) return null;
    if (Date.now() - record.timestamp > STORES.news.ttl) return null;
    return record.data;
  }

  async putNews(key, articles) {
    await dbPut('news', key, articles);
  }

  // ─── Sentiment ───────────────────────────────────────────────

  async getSentiment(key) {
    const record = await dbGet('sentiment', key);
    if (!record) return null;
    if (Date.now() - record.timestamp > STORES.sentiment.ttl) return null;
    return record.data;
  }

  async putSentiment(key, data) {
    await dbPut('sentiment', key, data);
  }

  // ─── Indicators ─────────────────────────────────────────────

  /**
   * Get cached indicator result.
   * @param {string} symbol
   * @param {string} tf - Timeframe
   * @param {string} name - Indicator name (e.g., 'ichimoku')
   * @returns {Promise<Array|null>}
   */
  async getIndicator(symbol, tf, name) {
    const key = `${symbol}:${tf}:${name}`;
    const record = await dbGet('indicators', key);
    if (!record) return null;
    if (Date.now() - record.timestamp > STORES.indicators.ttl) return null;
    return record.data;
  }

  /**
   * Cache a computed indicator result.
   */
  async putIndicator(symbol, tf, name, data) {
    const key = `${symbol}:${tf}:${name}`;
    await dbPut('indicators', key, data);
  }

  // ─── Derived Data ──────────────────────────────────────────────

  /**
   * Get cached derived computation result.
   * @param {string} symbol
   * @param {string} metric - e.g., 'vwap', 'correlation', 'volatility'
   * @returns {Promise<any|null>}
   */
  async getDerived(symbol, metric) {
    const key = `${symbol}:${metric}`;
    const record = await dbGet('derivedData', key);
    if (!record) return null;
    if (Date.now() - record.timestamp > STORES.derivedData.ttl) return null;
    return record.data;
  }

  /**
   * Cache a derived computation result.
   */
  async putDerived(symbol, metric, data) {
    const key = `${symbol}:${metric}`;
    await dbPut('derivedData', key, data);
  }

  // ─── Volume Profiles ───────────────────────────────────────────

  /**
   * Get cached volume profile.
   * @param {string} symbol
   * @param {string} [type='session'] - 'session', 'anchored', 'range'
   * @returns {Promise<Object|null>}
   */
  async getVolumeProfile(symbol, type = 'session') {
    const key = `${symbol}:vp:${type}`;
    const record = await dbGet('volumeProfiles', key);
    if (!record) return null;
    if (Date.now() - record.timestamp > STORES.volumeProfiles.ttl) return null;
    return record.data;
  }

  async putVolumeProfile(symbol, type, data) {
    const key = `${symbol}:vp:${type}`;
    await dbPut('volumeProfiles', key, data);
  }

  // ─── Filings ───────────────────────────────────────────────────

  /**
   * Get cached SEC filings for a symbol.
   * @param {string} symbol
   * @returns {Promise<Array|null>}
   */
  async getFilings(symbol) {
    const record = await dbGet('filings', symbol);
    if (!record) return null;
    return record.data;
  }

  async putFilings(symbol, filings) {
    await dbPut('filings', symbol, filings);
  }

  // ─── Storage Usage ─────────────────────────────────────────────

  /**
   * Get IndexedDB storage usage via StorageManager API.
   * @returns {Promise<{ usedMB, quotaMB, pct }>}
   */
  async getStorageUsage() {
    try {
      if (navigator?.storage?.estimate) {
        const est = await navigator.storage.estimate();
        return {
          usedMB: Math.round((est.usage || 0) / 1048576 * 10) / 10,
          quotaMB: Math.round((est.quota || 0) / 1048576),
          pct: est.quota > 0 ? Math.round((est.usage / est.quota) * 1000) / 10 : 0,
        };
      }
    } catch { /* silent */ }
    return { usedMB: 0, quotaMB: 0, pct: 0 };
  }

  // ─── LRU Eviction ──────────────────────────────────────────

  /**
   * Evict all stale records (past TTL) from all stores.
   * @returns {Promise<number>} Total records evicted
   */
  async evictStaleRecords() {
    let total = 0;
    const storeNames = Object.keys(STORES).filter(s => STORES[s].ttl !== Infinity);

    for (const storeName of storeNames) {
      try {
        const db = await openDB();
        const now = Date.now();
        const ttl = STORES[storeName]?.ttl || 300000;

        await new Promise((resolve) => {
          const tx = db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          const req = store.openCursor();

          req.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              const record = cursor.value;
              if (record.timestamp && (now - record.timestamp > ttl)) {
                cursor.delete();
                total++;
              }
              cursor.continue();
            }
          };
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      } catch { /* silent */ }
    }

    if (total > 0) {
      console.log(`[DataCache] Evicted ${total} stale records`);
    }
    return total;
  }

  /**
   * Check storage budget and evict if above 80% threshold.
   * Evicts in priority order: derivedData → indicators → volumeProfiles → candles
   */
  async evictIfOverBudget() {
    const usage = await this.getStorageUsage();
    if (usage.pct < 80) return; // Under budget

    console.log(`[DataCache] Storage at ${usage.pct}%, starting eviction...`);

    // 1. First evict all stale records
    await this.evictStaleRecords();

    // 2. Re-check
    const postEvict = await this.getStorageUsage();
    if (postEvict.pct < 70) return;

    // 3. If still over budget, clear lower priority stores
    const evictionOrder = ['derivedData', 'indicators', 'volumeProfiles', 'sentiment', 'news'];
    for (const storeName of evictionOrder) {
      try {
        const db = await openDB();
        await new Promise((resolve) => {
          const tx = db.transaction(storeName, 'readwrite');
          tx.objectStore(storeName).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      } catch { /* silent */ }

      const recheck = await this.getStorageUsage();
      if (recheck.pct < 70) {
        console.log(`[DataCache] Eviction brought storage to ${recheck.pct}%`);
        return;
      }
    }
  }

  // ─── Stale-While-Revalidate Pattern ──────────────────────────

  /**
   * Get data with stale-while-revalidate strategy.
   * Returns cached data immediately (even if stale) and refreshes in background.
   * @param {string} store - Store name
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Async function to fetch fresh data
   * @param {Function} [onRefresh] - Callback when fresh data arrives
   * @returns {Promise<any>}
   */
  async getOrFetch(store, key, fetchFn, onRefresh) {
    const record = await dbGet(store, key);
    const ttl = STORES[store]?.ttl || 60000;

    if (record) {
      const age = Date.now() - record.timestamp;
      if (age < ttl) {
        return record.data; // Fresh
      }

      // Stale — return immediately but refresh in background
      fetchFn().then(async (freshData) => {
        if (freshData != null) {
          await dbPut(store, key, freshData);
          if (onRefresh) onRefresh(freshData);
        }
      }).catch((err) => { console.warn('[DataCache] Background refresh failed:', err?.message); });

      return record.data; // Return stale data
    }

    // No cache — fetch synchronously
    try {
      const data = await fetchFn();
      if (data != null) {
        await dbPut(store, key, data);
      }
      return data;
    } catch {
      return null;
    }
  }

  // ─── Cache Management ────────────────────────────────────────

  async clearAll() {
    for (const storeName of Object.keys(STORES)) {
      await dbClearStore(storeName);
    }
  }

  async clearStore(storeName) {
    await dbClearStore(storeName);
  }

  async removeKey(store, key) {
    await dbDelete(store, key);
  }

  /**
   * Get cache statistics for the settings page.
   */
  async getStats() {
    const stats = {};
    try {
      const db = await openDB();
      for (const storeName of Object.keys(STORES)) {
        await new Promise((resolve) => {
          const tx = db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const req = store.count();
          req.onsuccess = () => {
            stats[storeName] = req.result;
            resolve();
          };
          req.onerror = () => {
            stats[storeName] = 0;
            resolve();
          };
        });
      }
    } catch {
      // IndexedDB not available
    }
    return stats;
  }

  /**
   * Evict expired entries from all stores.
   */
  async evictExpired() {
    try {
      const db = await openDB();
      const now = Date.now();

      for (const [storeName, config] of Object.entries(STORES)) {
        if (config.ttl === Infinity) continue;

        await new Promise((resolve) => {
          const tx = db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          const req = store.openCursor();

          req.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              if (now - cursor.value.timestamp > config.ttl * 2) {
                cursor.delete(); // Delete entries 2x past TTL
              }
              cursor.continue();
            }
          };

          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      }
    } catch {
      // Silent
    }
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const dataCache = new _DataCache();
export { openDB as openCacheDB };
export default dataCache;

// Run cache eviction every 30 minutes
if (typeof window !== 'undefined') {
  setInterval(() => dataCache.evictExpired(), 1800000);
}
