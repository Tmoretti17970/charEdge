// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Persistence (Sprint 13.1)
// Saves/loads drawings per symbol+timeframe using IndexedDB.
// Drawings survive page reload, symbol switching, and timeframe changes.
//
// Storage key: `{SYMBOL}_{TIMEFRAME}` → array of serialized drawings
// Also supports cross-timeframe sync via `syncAcrossTimeframes` flag.
//
// Uses the unified charEdge-cache database (shared with DataCache).
// ═══════════════════════════════════════════════════════════════════

import { openCacheDB } from '../../data/DataCache.ts';
import { logger } from '../../utils/logger';

const STORE_NAME = 'drawings';

/**
 * Build the storage key for a symbol+timeframe combination.
 * @param {string} symbol
 * @param {string} timeframe
 * @returns {string}
 */
function buildKey(symbol, timeframe) {
  return `${(symbol || 'UNKNOWN').toUpperCase()}_${(timeframe || '1h').toLowerCase()}`;
}

/**
 * Build a cross-timeframe key (for synced drawings).
 * @param {string} symbol
 * @returns {string}
 */
function buildSyncKey(symbol) {
  return `${(symbol || 'UNKNOWN').toUpperCase()}_SYNCED`;
}

/**
 * Save drawings for a specific symbol+timeframe.
 * Only serializable properties are stored (no functions or state).
 *
 * @param {string} symbol
 * @param {string} timeframe
 * @param {Object[]} drawings - Array of Drawing objects
 * @returns {Promise<void>}
 */
export async function saveDrawings(symbol, timeframe, drawings) {
  try {
    const db = await openCacheDB();
    const key = buildKey(symbol, timeframe);

    // Separate synced drawings from local ones
    const localDrawings = [];
    const syncedDrawings = [];

    for (const d of drawings) {
      const serialized = {
        id: d.id,
        type: d.type,
        points: d.points.map(p => ({ price: p.price, time: p.time })),
        style: { ...d.style },
        locked: d.locked || false,
        visible: d.visible !== false,
        meta: d.meta ? { ...d.meta } : {},
        syncAcrossTimeframes: d.syncAcrossTimeframes || false,
      };

      if (d.syncAcrossTimeframes) {
        syncedDrawings.push(serialized);
      } else {
        localDrawings.push(serialized);
      }
    }

    // Save local drawings
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ key, drawings: localDrawings, updatedAt: Date.now() });

    // Save synced drawings separately
    if (syncedDrawings.length > 0) {
      const syncKey = buildSyncKey(symbol);
      store.put({ key: syncKey, drawings: syncedDrawings, updatedAt: Date.now() });
    }

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    logger.engine.warn('[DrawingPersistence] Save failed:', err);
    // Fallback: try localStorage
    try {
      const key = buildKey(symbol, timeframe);
      const data = drawings.map(d => ({
        id: d.id, type: d.type,
        points: d.points.map(p => ({ price: p.price, time: p.time })),
        style: { ...d.style }, locked: d.locked || false,
        visible: d.visible !== false, meta: d.meta || {},
      }));
      localStorage.setItem(`tf-drawings-${key}`, JSON.stringify(data));
    } catch (_) { /* storage may be blocked */ }
  }
}

/**
 * Load drawings for a specific symbol+timeframe.
 * Also merges in any cross-timeframe synced drawings.
 *
 * @param {string} symbol
 * @param {string} timeframe
 * @returns {Promise<Object[]>} Array of Drawing objects
 */
export async function loadDrawings(symbol, timeframe) {
  try {
    const db = await openCacheDB();
    const key = buildKey(symbol, timeframe);
    const syncKey = buildSyncKey(symbol);

    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    const [localResult, syncResult] = await Promise.all([
      new Promise((resolve) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result?.drawings || []);
        req.onerror = () => resolve([]);
      }),
      new Promise((resolve) => {
        const req = store.get(syncKey);
        req.onsuccess = () => resolve(req.result?.drawings || []);
        req.onerror = () => resolve([]);
      }),
    ]);

    // Merge local + synced, avoiding duplicates by ID
    const allDrawings = [...localResult];
    const existingIds = new Set(allDrawings.map(d => d.id));
    for (const sd of syncResult) {
      if (!existingIds.has(sd.id)) {
        allDrawings.push({ ...sd, syncAcrossTimeframes: true });
      }
    }

    // Hydrate back to runtime state
    return allDrawings.map(d => ({
      ...d,
      state: 'idle',
      locked: d.locked || false,
      visible: d.visible !== false,
      meta: d.meta || {},
    }));
  } catch (err) {
    logger.engine.warn('[DrawingPersistence] Load failed, trying localStorage fallback:', err);
    // Fallback: try localStorage
    try {
      const key = buildKey(symbol, timeframe);
      const raw = localStorage.getItem(`tf-drawings-${key}`);
      if (raw) {
        return JSON.parse(raw).map(d => ({ ...d, state: 'idle' }));
      }
    } catch (_) { /* storage may be blocked */ }
    return [];
  }
}

/**
 * Delete all drawings for a specific symbol+timeframe.
 *
 * @param {string} symbol
 * @param {string} timeframe
 * @returns {Promise<void>}
 */
export async function clearDrawings(symbol, timeframe) {
  try {
    const db = await openCacheDB();
    const key = buildKey(symbol, timeframe);
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    logger.engine.warn('[DrawingPersistence] Clear failed:', err);
  }
}

/**
 * List all symbol+timeframe keys that have saved drawings.
 * @returns {Promise<string[]>}
 */
export async function listDrawingKeys() {
  try {
    const db = await openCacheDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve) => {
      const req = store.getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (_) {
    return [];
  }
}

/**
 * Auto-save debouncer. Call this on every drawing change.
 * Batches rapid changes into a single write after 500ms.
 */
let _saveTimer = null;
let _pendingSave = null;

export function debouncedSave(symbol, timeframe, drawings) {
  _pendingSave = { symbol, timeframe, drawings };
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    if (_pendingSave) {
      saveDrawings(_pendingSave.symbol, _pendingSave.timeframe, _pendingSave.drawings);
      _pendingSave = null;
    }
  }, 500);
}
