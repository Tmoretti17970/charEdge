// ═══════════════════════════════════════════════════════════════════
// charEdge — Prediction Cache (IndexedDB)
//
// Client-side cache for prediction market data.
// Serves cached data when offline, with "stale" indicators.
// TTL: markets stale after 5 minutes.
// ═══════════════════════════════════════════════════════════════════

const DB_NAME = 'charEdge-predictions';
const DB_VERSION = 1;
const STORE_MARKETS = 'markets';
const STORE_STATS = 'stats';
const MARKET_TTL = 5 * 60 * 1000; // 5 minutes

let db = null;

/**
 * Open the IndexedDB database.
 */
async function openDB() {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_MARKETS)) {
        database.createObjectStore(STORE_MARKETS, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORE_STATS)) {
        database.createObjectStore(STORE_STATS, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Cache markets to IndexedDB.
 * @param {Array} markets
 */
export async function cacheMarkets(markets) {
  try {
    const database = await openDB();
    const tx = database.transaction(STORE_MARKETS, 'readwrite');
    const store = tx.objectStore(STORE_MARKETS);

    const timestamp = Date.now();
    for (const market of markets) {
      store.put({ ...market, _cachedAt: timestamp });
    }

    // Also store the timestamp
    const statsTx = database.transaction(STORE_STATS, 'readwrite');
    statsTx.objectStore(STORE_STATS).put({
      key: 'lastCacheTime',
      value: timestamp,
      marketCount: markets.length,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[PredictionCache] Failed to cache:', err.message);
  }
}

/**
 * Get cached markets from IndexedDB.
 * @returns {Promise<{ markets: Array, isStale: boolean, cachedAt: number|null }>}
 */
export async function getCachedMarkets() {
  try {
    const database = await openDB();
    const tx = database.transaction(STORE_MARKETS, 'readonly');
    const store = tx.objectStore(STORE_MARKETS);

    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const markets = request.result || [];
        const cachedAt = markets[0]?._cachedAt || null;
        const isStale = cachedAt ? Date.now() - cachedAt > MARKET_TTL : true;

        // Strip cache metadata
        const cleaned = markets.map(({ _cachedAt, ...m }) => m);
        resolve({ markets: cleaned, isStale, cachedAt });
      };
      request.onerror = () => resolve({ markets: [], isStale: true, cachedAt: null });
    });
  } catch {
    return { markets: [], isStale: true, cachedAt: null };
  }
}

/**
 * Get cache metadata (last cache time, market count).
 */
export async function getCacheInfo() {
  try {
    const database = await openDB();
    const tx = database.transaction(STORE_STATS, 'readonly');
    const store = tx.objectStore(STORE_STATS);

    return new Promise((resolve) => {
      const request = store.get('lastCacheTime');
      request.onsuccess = () => {
        const data = request.result;
        resolve({
          lastCacheTime: data?.value || null,
          marketCount: data?.marketCount || 0,
          isStale: data?.value ? Date.now() - data.value > MARKET_TTL : true,
        });
      };
      request.onerror = () => resolve({ lastCacheTime: null, marketCount: 0, isStale: true });
    });
  } catch {
    return { lastCacheTime: null, marketCount: 0, isStale: true };
  }
}

/**
 * Clear all cached data.
 */
export async function clearCache() {
  try {
    const database = await openDB();
    const tx = database.transaction([STORE_MARKETS, STORE_STATS], 'readwrite');
    tx.objectStore(STORE_MARKETS).clear();
    tx.objectStore(STORE_STATS).clear();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[PredictionCache] Failed to clear:', err.message);
  }
}

/**
 * Check if we're offline.
 */
export function isOffline() {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}
