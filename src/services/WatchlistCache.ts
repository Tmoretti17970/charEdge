// ═══════════════════════════════════════════════════════════════════
// charEdge — Watchlist IndexedDB Cache (Sprint 55)
//
// Persistent cache for watchlist data (last prices, sparklines,
// fundamental snapshots) in IndexedDB. Enables instant load on
// app start without waiting for API responses.
//
// Stores:
//   prices   — { symbol, price, change, changePercent, volume, ts }
//   sparklines — { symbol, data: number[], ts }
//   fundamentals — { symbol, data: object, ts }
// ═══════════════════════════════════════════════════════════════════

const DB_NAME = 'charEdge-watchlistCache';
const DB_VERSION = 1;
const STORES = ['prices', 'sparklines', 'fundamentals'];

// TTLs
const TTL = {
  prices: 60_000,          // 1 min
  sparklines: 300_000,     // 5 min
  fundamentals: 3600_000,  // 1 hr
};

/** @returns {Promise<IDBDatabase>} */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'symbol' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get cached items from a store.
 * @param {'prices' | 'sparklines' | 'fundamentals'} storeName
 * @param {string[]} symbols
 * @returns {Promise<Record<string, any>>}
 */
export async function getCached(storeName, symbols) {
  try {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const ttl = TTL[storeName] || 300_000;
    const now = Date.now();
    const results = {};

    await Promise.all(symbols.map((sym) =>
      new Promise((resolve) => {
        const req = store.get(sym);
        req.onsuccess = () => {
          const record = req.result;
          if (record && (now - record.ts) < ttl) {
            const data = record.data || record;
            // Normalize: ensure change/changePercent fields exist (handles legacy cache entries)
            if (storeName === 'prices' && data.price != null) {
              if (data.change === undefined) data.change = null;
              if (data.changePercent === undefined) data.changePercent = null;
            }
            results[sym] = data;
          }
          resolve(undefined);
        };
        req.onerror = () => resolve(undefined);
      })
    ));

    db.close();
    return results;
  } catch {
    return {};
  }
}

/**
 * Save items to a store.
 * @param {'prices' | 'sparklines' | 'fundamentals'} storeName
 * @param {Record<string, any>} data - Map of symbol → data
 */
export async function setCached(storeName, data) {
  try {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const now = Date.now();

    for (const [symbol, value] of Object.entries(data)) {
      store.put({ symbol, data: value, ts: now });
    }

    await new Promise((resolve) => {
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });

    db.close();
  } catch {
    // Silently fail — cache is best-effort
  }
}

/**
 * Clear all cached data.
 */
export async function clearCache() {
  try {
    const db = await openDB();
    for (const storeName of STORES) {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).clear();
    }
    db.close();
  } catch {
    // Silently fail
  }
}

export default { getCached, setCached, clearCache };
