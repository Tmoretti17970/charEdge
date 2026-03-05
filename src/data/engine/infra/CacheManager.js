// ═══════════════════════════════════════════════════════════════════
// charEdge — Unified CacheManager
//
// Single public API for all IndexedDB operations in charEdge.
// Consolidates the 3-tier cache (memory → IndexedDB → OPFS) and
// proxies both DataCache (market data) and StorageService (user data).
//
// Usage:
//   import { cacheManager } from './CacheManager.js';
//
//   // Candle cache (3-tier: memory → IDB → OPFS)
//   const result = await cacheManager.read('BTCUSDT', '1d', ttlMs);
//   await cacheManager.write('BTCUSDT', '1d', bars, 'binance');
//
//   // User data CRUD (trades, playbooks, notes, settings)
//   const trades = await cacheManager.trades.getAll();
//   await cacheManager.trades.put({ id: 't1', symbol: 'AAPL', ... });
//   await cacheManager.settings.set('theme', 'dark');
//
//   // Market data cache (quotes, fundamentals, news, etc.)
//   const quote = await cacheManager.getQuote('AAPL');
//   await cacheManager.putQuote('AAPL', quoteData);
// ═══════════════════════════════════════════════════════════════════

import { CACHE_MAX_ENTRIES, buildCacheKey } from '../../../constants.js';
import { opfsBarStore } from './OPFSBarStore.js';
import { pipelineLogger } from './DataPipelineLogger.js';

// ─── CacheManager Class ────────────────────────────────────────

class _CacheManager {
  constructor() {
    this._hits = { memory: 0, idb: 0, opfs: 0 };
    this._misses = 0;
    this._mem = new Map(); // key → { data, source, t }
    /** @type {Promise|null} Cached DataCache module to avoid repeated dynamic imports */
    this._dataCachePromise = null;
    /** @type {Promise|null} Cached StorageService module */
    this._storagePromise = null;
    // Pre-warm the DataCache import so first read doesn't wait for it
    this._loadDataCache();

    // ─── User Data CRUD Proxies ─────────────────────────────────
    // These proxy objects delegate to StorageService under the hood,
    // so consumers only need to import CacheManager.

    this.trades = this._makeCRUDProxy('trades', {
      bulkPut: async (trades) => { const ss = await this._loadStorage(); return ss.trades.bulkPut(trades); },
      count:   async ()       => { const ss = await this._loadStorage(); return ss.trades.count(); },
      clear:   async ()       => { const ss = await this._loadStorage(); return ss.trades.clear(); },
    });

    this.playbooks  = this._makeCRUDProxy('playbooks');
    this.notes      = this._makeCRUDProxy('notes');
    this.tradePlans = this._makeCRUDProxy('tradePlans');

    this.settings = {
      get:    async (key)        => { const ss = await this._loadStorage(); return ss.settings.get(key); },
      set:    async (key, value) => { const ss = await this._loadStorage(); return ss.settings.set(key, value); },
      getAll: async ()           => { const ss = await this._loadStorage(); return ss.settings.getAll(); },
    };
  }

  // ─── DataCache Lazy Singleton ─────────────────────────────────
  // Cache the dynamic import so we pay the cost only once, not on every read/write.
  _loadDataCache() {
    if (!this._dataCachePromise) {
      this._dataCachePromise = import('../../DataCache.ts')
        .then(mod => mod.dataCache)
        .catch((err) => { pipelineLogger.warn('CacheManager', 'DataCache import failed', err); this._dataCachePromise = null; return null; });
    }
    return this._dataCachePromise;
  }

  // ─── StorageService Lazy Singleton ────────────────────────────
  _loadStorage() {
    if (!this._storagePromise) {
      this._storagePromise = import('../../StorageService.ts')
        .then(mod => mod.StorageService || mod.default)
        .catch((err) => { pipelineLogger.warn('CacheManager', 'StorageService import failed', err); this._storagePromise = null; return null; });
    }
    return this._storagePromise;
  }

  /**
   * Build a CRUD proxy object for a given store name.
   * @param {string} table - Store name (e.g., 'trades')
   * @param {Object} [extras] - Additional methods to merge in (e.g., bulkPut)
   * @returns {{ getAll, put, delete, replaceAll, ... }}
   */
  _makeCRUDProxy(table, extras = {}) {
    return {
      getAll:     async ()       => { const ss = await this._loadStorage(); return ss[table].getAll(); },
      put:        async (item)   => { const ss = await this._loadStorage(); return ss[table].put(item); },
      delete:     async (id)     => { const ss = await this._loadStorage(); return ss[table].delete(id); },
      replaceAll: async (items)  => { const ss = await this._loadStorage(); return ss[table].replaceAll(items); },
      ...extras,
    };
  }

  // ─── Private Memory Layer ─────────────────────────────────────

  _memGet(key, ttl) {
    const entry = this._mem.get(key);
    if (!entry) return null;
    // LRU touch: delete + re-insert to move to end (most-recently-used)
    this._mem.delete(key);
    this._mem.set(key, entry);
    if (Date.now() - entry.t < ttl) return { data: entry.data, source: entry.source, tier: 'memory' };
    return { data: entry.data, source: entry.source + ':stale', tier: 'memory:stale' };
  }

  _memSet(key, data, source) {
    // LRU: if key already exists, delete first to re-insert at end
    if (this._mem.has(key)) {
      this._mem.delete(key);
    } else if (this._mem.size >= CACHE_MAX_ENTRIES) {
      // Evict least-recently-used (first key in Map insertion order)
      const lruKey = this._mem.keys().next().value;
      this._mem.delete(lruKey);
    }
    this._mem.set(key, { data, source, t: Date.now() });
  }

  // ═══════════════════════════════════════════════════════════════
  // 3-TIER CANDLE CACHE (memory → IDB → OPFS)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Read candle data from the 3-tier cache.
   * Returns { data, source, tier } or null if not found anywhere.
   *
   * @param {string} sym   - Symbol (e.g., 'BTCUSDT')
   * @param {string} tfId  - Timeframe ID (e.g., '1d')
   * @param {number} ttl   - TTL in milliseconds (single source of truth)
   * @returns {Promise<{ data: Array, source: string, tier: string } | null>}
   */
  async read(sym, tfId, ttl) {
    const key = buildCacheKey(sym, tfId);

    // ── Tier 1: In-memory (fastest) ──
    const memResult = this._memGet(key, ttl);
    if (memResult && !memResult.tier.includes('stale')) {
      this._hits.memory++;
      pipelineLogger.debug('CacheManager', `Cache hit (memory): ${key}`);
      return memResult;
    }

    // ── Tier 2: IndexedDB (survives page refresh) ──
    try {
      const dc = await this._loadDataCache();
      if (dc) {
        const idbBars = await dc.getCandles(sym, tfId);
        if (idbBars && idbBars.length > 0) {
          this._hits.idb++;
          this._memSet(key, idbBars, 'cached');
          // Freshness check: use the memory-tier write timestamp we just set.
          // _memSet records Date.now() as `t`, so the entry is "born fresh".
          // If TTL is Infinity or the data was just cached, treat as fresh.
          // On subsequent reads the normal _memGet TTL check will detect staleness.
          if (ttl === Infinity) {
            return { data: idbBars, source: 'cached', tier: 'idb' };
          }
          // IDB data that was just loaded is fresh for this request cycle.
          // The caller will get fresh data now; future reads within TTL will
          // hit the memory tier directly. After TTL expires, _memGet returns
          // stale and triggers background refresh.
          return { data: idbBars, source: 'cached', tier: 'idb' };
        }
      }
    } catch (err) { pipelineLogger.warn('CacheManager', `IDB read failed: ${key}`, err); }

    // ── Tier 3: OPFS persistent cache (binary encoded) ──
    try {
      const opfsBars = await opfsBarStore.getCandles(sym, tfId);
      if (opfsBars && opfsBars.length > 0) {
        this._hits.opfs++;
        this._memSet(key, opfsBars, 'cached');
        // Backfill IDB from OPFS in background
        this._loadDataCache().then(dc => {
          if (dc) dc.putCandles(sym, tfId, opfsBars).catch((err) => pipelineLogger.warn('CacheManager', `IDB backfill failed: ${key}`, err));
        }).catch((err) => pipelineLogger.warn('CacheManager', `DataCache load failed during backfill: ${key}`, err));
        return { data: opfsBars, source: 'cached', tier: 'opfs' };
      }
    } catch (err) { pipelineLogger.warn('CacheManager', `OPFS read failed: ${key}`, err); }

    this._misses++;

    // Return stale memory data if we have it (stale-while-revalidate)
    if (memResult) return memResult;

    return null;
  }

  /**
   * Write candle data to all 3 cache tiers.
   * Memory is synchronous; IDB and OPFS are fire-and-forget background writes.
   *
   * @param {string} sym    - Symbol
   * @param {string} tfId   - Timeframe ID
   * @param {Array} data    - Candle array
   * @param {string} source - Data source label (e.g., 'binance', 'yahoo')
   */
  write(sym, tfId, data, source) {
    if (!data || !data.length) return;
    const key = buildCacheKey(sym, tfId);

    // Content-addressed check: skip OPFS/IDB writes if data hasn't changed
    const existing = this._mem.get(key);
    const unchanged = existing &&
      existing.data.length === data.length &&
      existing.data[data.length - 1]?.time === data[data.length - 1]?.time &&
      existing.data[data.length - 1]?.close === data[data.length - 1]?.close;

    // Tier 1: Memory (sync) — always update to refresh timestamp
    this._memSet(key, data, source);

    // Skip disk writes if data is unchanged (content-addressed)
    if (unchanged) return;

    // Tier 2: IndexedDB (async, fire-and-forget)
    this._loadDataCache().then(dc => {
      if (dc) dc.putCandles(sym, tfId, data).catch((err) => pipelineLogger.warn('CacheManager', `IDB write failed: ${key}`, err));
    }).catch((err) => pipelineLogger.warn('CacheManager', `DataCache load failed during write: ${key}`, err));

    // Tier 3: OPFS (async, fire-and-forget)
    opfsBarStore.putCandles(sym, tfId, data).catch((err) => pipelineLogger.warn('CacheManager', `OPFS write failed: ${key}`, err));
  }

  /**
   * Check if a key has a fresh entry in the memory tier.
   * @param {string} sym
   * @param {string} tfId
   * @param {number} ttl
   * @returns {boolean}
   */
  hasFresh(sym, tfId, ttl) {
    const key = buildCacheKey(sym, tfId);
    const entry = this._mem.get(key);
    return !!(entry && Date.now() - entry.t < ttl);
  }

  /**
   * Clear all cache tiers — memory, IDB, and OPFS.
   */
  async clear() {
    this._mem.clear();
    this._hits = { memory: 0, idb: 0, opfs: 0 };
    this._misses = 0;

    // Clear IDB (DataCache)
    try {
      const dc = await this._loadDataCache();
      if (dc) await dc.clearAll();
    } catch (err) { pipelineLogger.warn('CacheManager', 'IDB clear failed', err); }

    // Clear OPFS
    try {
      if (opfsBarStore.clearAll) await opfsBarStore.clearAll();
    } catch (err) { pipelineLogger.warn('CacheManager', 'OPFS clear failed', err); }
  }

  /**
   * Evict entries older than maxAge from the memory tier.
   * @param {number} maxAgeMs - Max age in milliseconds
   * @returns {number} Number of entries evicted
   */
  evictByAge(maxAgeMs) {
    const cutoff = Date.now() - maxAgeMs;
    let evicted = 0;
    for (const [key, entry] of this._mem) {
      if (entry.t < cutoff) {
        this._mem.delete(key);
        evicted++;
      }
    }
    return evicted;
  }

  /**
   * Evict all tiers — used by MemoryBudget under pressure.
   */
  async evictAll() {
    this._mem.clear();
    try {
      const dc = await this._loadDataCache();
      if (dc) await dc.evictIfOverBudget();
    } catch (err) { pipelineLogger.warn('CacheManager', 'Eviction failed', err); }
  }

  /**
   * Get IndexedDB storage usage via DataCache.
   * Proxy method so consumers don't need to import DataCache directly.
   * @returns {Promise<{ usedMB, quotaMB, pct }>}
   */
  async getStorageUsage() {
    try {
      const dc = await this._loadDataCache();
      if (dc) return dc.getStorageUsage();
      return { usedMB: 0, quotaMB: 0, pct: 0 };
    } catch (_) {
      return { usedMB: 0, quotaMB: 0, pct: 0 };
    }
  }

  /**
   * Get cache hit/miss statistics.
   * @returns {{ memorySize, hits, misses, hitRate }}
   */
  getStats() {
    const totalHits = this._hits.memory + this._hits.idb + this._hits.opfs;
    const total = totalHits + this._misses;
    return {
      memorySize: this._mem.size,
      maxSize: CACHE_MAX_ENTRIES,
      hits: { ...this._hits },
      misses: this._misses,
      hitRate: total > 0 ? Math.round(totalHits / total * 1000) / 10 : 0,
      entries: [...this._mem.entries()].map(([k, v]) => ({
        key: k,
        source: v.source,
        ageMs: Date.now() - v.t,
      })),
    };
  }

  /**
   * Get the last update info for a cached symbol+timeframe.
   * Used by the DataStalenessIndicator UI component.
   * @param {string} sym
   * @param {string} tfId
   * @returns {{ timestamp: number, source: string, ageMs: number } | null}
   */
  getLastUpdate(sym, tfId) {
    const key = buildCacheKey(sym, tfId);
    const entry = this._mem.get(key);
    if (!entry) return null;
    return {
      timestamp: entry.t,
      source: entry.source,
      ageMs: Date.now() - entry.t,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // MARKET DATA CACHE PROXIES (DataCache domain methods)
  // ═══════════════════════════════════════════════════════════════

  // ─── Quotes ──────────────────────────────────────────────────
  async getQuote(symbol)            { const dc = await this._loadDataCache(); return dc ? dc.getQuote(symbol) : null; }
  async putQuote(symbol, quote)     { const dc = await this._loadDataCache(); if (dc) await dc.putQuote(symbol, quote); }

  // ─── Fundamentals ────────────────────────────────────────────
  async getFundamentals(symbol)          { const dc = await this._loadDataCache(); return dc ? dc.getFundamentals(symbol) : null; }
  async putFundamentals(symbol, data)    { const dc = await this._loadDataCache(); if (dc) await dc.putFundamentals(symbol, data); }

  // ─── Economic Data ───────────────────────────────────────────
  async getEconomic(seriesId)            { const dc = await this._loadDataCache(); return dc ? dc.getEconomic(seriesId) : null; }
  async putEconomic(seriesId, data)      { const dc = await this._loadDataCache(); if (dc) await dc.putEconomic(seriesId, data); }

  // ─── News ────────────────────────────────────────────────────
  async getNews(key)                     { const dc = await this._loadDataCache(); return dc ? dc.getNews(key) : null; }
  async putNews(key, articles)           { const dc = await this._loadDataCache(); if (dc) await dc.putNews(key, articles); }

  // ─── Sentiment ───────────────────────────────────────────────
  async getSentiment(key)                { const dc = await this._loadDataCache(); return dc ? dc.getSentiment(key) : null; }
  async putSentiment(key, data)          { const dc = await this._loadDataCache(); if (dc) await dc.putSentiment(key, data); }

  // ─── Indicators ─────────────────────────────────────────────
  async getIndicator(sym, tf, name)      { const dc = await this._loadDataCache(); return dc ? dc.getIndicator(sym, tf, name) : null; }
  async putIndicator(sym, tf, name, d)   { const dc = await this._loadDataCache(); if (dc) await dc.putIndicator(sym, tf, name, d); }

  // ─── Derived Data ───────────────────────────────────────────
  async getDerived(symbol, metric)       { const dc = await this._loadDataCache(); return dc ? dc.getDerived(symbol, metric) : null; }
  async putDerived(symbol, metric, data) { const dc = await this._loadDataCache(); if (dc) await dc.putDerived(symbol, metric, data); }

  // ─── Volume Profiles ────────────────────────────────────────
  async getVolumeProfile(sym, type)      { const dc = await this._loadDataCache(); return dc ? dc.getVolumeProfile(sym, type) : null; }
  async putVolumeProfile(sym, type, d)   { const dc = await this._loadDataCache(); if (dc) await dc.putVolumeProfile(sym, type, d); }

  // ─── Filings ────────────────────────────────────────────────
  async getFilings(symbol)               { const dc = await this._loadDataCache(); return dc ? dc.getFilings(symbol) : null; }
  async putFilings(symbol, filings)      { const dc = await this._loadDataCache(); if (dc) await dc.putFilings(symbol, filings); }

  // ─── Stale-While-Revalidate ─────────────────────────────────
  async getOrFetch(store, key, fetchFn, onRefresh) {
    const dc = await this._loadDataCache();
    return dc ? dc.getOrFetch(store, key, fetchFn, onRefresh) : null;
  }

  // ─── Cache Eviction ─────────────────────────────────────────
  async evictStaleRecords() {
    const dc = await this._loadDataCache();
    return dc ? dc.evictStaleRecords() : 0;
  }

  async evictIfOverBudget() {
    const dc = await this._loadDataCache();
    if (dc) await dc.evictIfOverBudget();
  }

  /**
   * Get per-store record counts from DataCache.
   * @returns {Promise<Object>} e.g. { candles: 42, quotes: 10, ... }
   */
  async getCacheStats() {
    const dc = await this._loadDataCache();
    return dc ? dc.getStats() : {};
  }

  // ═══════════════════════════════════════════════════════════════
  // USER DATA PROXIES (StorageService operations)
  // ═══════════════════════════════════════════════════════════════

  // ─── Indexed Queries ────────────────────────────────────────
  async getTradesBySymbol(symbol) {
    const ss = await this._loadStorage();
    return ss ? ss.getTradesBySymbol(symbol) : { ok: false, data: [], error: 'StorageService unavailable' };
  }

  async getTradesByDateRange(from, to) {
    const ss = await this._loadStorage();
    return ss ? ss.getTradesByDateRange(from, to) : { ok: false, data: [], error: 'StorageService unavailable' };
  }

  // ─── Quota Management ──────────────────────────────────────
  async checkQuota() {
    const ss = await this._loadStorage();
    return ss ? ss.checkQuota() : { ok: true, data: { used: 0, quota: 0, percent: 0, available: true } };
  }

  async quotaRecovery(targetPercent) {
    const ss = await this._loadStorage();
    return ss ? ss.quotaRecovery(targetPercent) : { ok: false, freed: 0, error: 'StorageService unavailable' };
  }

  /**
   * Clear all user data stores (trades, playbooks, notes, tradePlans, settings).
   */
  async clearAllUserData() {
    const ss = await this._loadStorage();
    return ss ? ss.clearAll() : { ok: false, error: 'StorageService unavailable' };
  }

  /**
   * Migrate data from legacy storage format.
   */
  async migrateFromLegacy() {
    const ss = await this._loadStorage();
    return ss ? ss.migrateFromLegacy() : { trades: 0, playbooks: 0, notes: 0 };
  }

  // ═══════════════════════════════════════════════════════════════
  // SPRINT 2: PAGE-LEVEL CHUNK CACHE (history pagination)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Build a page cache key for a specific history chunk.
   * Format: page:SYMBOL:TIMEFRAME:BEFORE_TIMESTAMP
   * @param {string} sym
   * @param {string} tfId
   * @param {number|string} beforeTime
   * @returns {string}
   */
  _pageKey(sym, tfId, beforeTime) {
    const ts = typeof beforeTime === 'string' ? new Date(beforeTime).getTime() : beforeTime;
    return `page:${sym}:${tfId}:${ts}`;
  }

  /**
   * Read a cached history page by symbol+tf+timestamp.
   * Returns { data, hasMore } or null on miss.
   * @param {string} sym
   * @param {string} tfId
   * @param {number|string} beforeTime
   * @returns {{ data: Array, hasMore: boolean } | null}
   */
  readPage(sym, tfId, beforeTime) {
    const key = this._pageKey(sym, tfId, beforeTime);
    const entry = this._mem.get(key);
    if (!entry) return null;
    // LRU touch
    this._mem.delete(key);
    this._mem.set(key, entry);
    this._hits.memory++;
    return { data: entry.data, hasMore: entry.hasMore };
  }

  /**
   * Cache a fetched history page.
   * Writes to memory tier + OPFS in background.
   * @param {string} sym
   * @param {string} tfId
   * @param {number|string} beforeTime
   * @param {Array} bars
   * @param {boolean} hasMore
   */
  writePage(sym, tfId, beforeTime, bars, hasMore) {
    if (!bars || !bars.length) return;
    const key = this._pageKey(sym, tfId, beforeTime);

    // LRU eviction if at capacity
    if (this._mem.has(key)) {
      this._mem.delete(key);
    } else if (this._mem.size >= (CACHE_MAX_ENTRIES || 200)) {
      const lruKey = this._mem.keys().next().value;
      this._mem.delete(lruKey);
    }

    this._mem.set(key, { data: bars, hasMore, source: 'page-cache', t: Date.now() });

    // Background OPFS write (merge with existing data for this symbol+tf)
    opfsBarStore.putCandles(sym, tfId, bars).catch((err) =>
      pipelineLogger.warn('CacheManager', `Page OPFS write failed: ${key}`, err)
    );

    // Check storage budget (fire-and-forget)
    this._checkPageBudget().catch(() => {});
  }

  /**
   * Sprint 2: Evict oldest page cache entries if OPFS exceeds budget.
   * Budget: 50MB, hysteresis target: 40MB.
   */
  async _checkPageBudget() {
    const BUDGET_MB = 50;
    const TARGET_MB = 40;
    try {
      const stats = await opfsBarStore.getStats();
      const usedMB = stats.totalSizeKB / 1024;
      if (usedMB <= BUDGET_MB) return;

      pipelineLogger.info('CacheManager', `Page cache over budget: ${usedMB.toFixed(1)}MB > ${BUDGET_MB}MB, evicting...`);

      // Evict oldest memory page entries until under target
      let evicted = 0;
      for (const [key] of this._mem) {
        if (!key.startsWith('page:')) continue;
        this._mem.delete(key);
        evicted++;
        // Re-check periodically (every 10 evictions)
        if (evicted % 10 === 0) {
          const recheck = await opfsBarStore.getStats();
          if (recheck.totalSizeKB / 1024 <= TARGET_MB) break;
        }
      }
      pipelineLogger.info('CacheManager', `Evicted ${evicted} page cache entries`);
    } catch (err) {
      pipelineLogger.warn('CacheManager', 'Budget check failed', err);
    }
  }

  /**
   * Get the total OPFS storage used in MB.
   * @returns {Promise<number>}
   */
  async getPageCacheSizeMB() {
    try {
      const stats = await opfsBarStore.getStats();
      return Math.round(stats.totalSizeKB / 1024 * 10) / 10;
    } catch (_) {
      return 0;
    }
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const cacheManager = new _CacheManager();
export { _CacheManager };
export default cacheManager;
