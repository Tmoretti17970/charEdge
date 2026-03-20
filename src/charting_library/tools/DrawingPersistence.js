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

import { openCacheDB } from '../../data/DataCache';
import { logger } from '@/observability/logger';

const STORE_NAME = 'drawings';
const MAX_VERSIONS = 5;
let _sessionSnapshot = null; // Sprint 10: initial load snapshot

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
        _groupId: d._groupId || null, // BUG-07: persist group membership
      };

      if (d.syncAcrossTimeframes) {
        syncedDrawings.push(serialized);
      } else {
        localDrawings.push(serialized);
      }
    }

    // Save local drawings
    let tx;
    try {
      tx = db.transaction(STORE_NAME, 'readwrite');
    } catch (e) {
      // InvalidStateError: DB connection closing during symbol switch — fall through to localStorage fallback
      throw e;
    }
    const store = tx.objectStore(STORE_NAME);
    store.put({ key, drawings: localDrawings, updatedAt: Date.now() });

    // Save synced drawings separately
    if (syncedDrawings.length > 0) {
      const syncKey = buildSyncKey(symbol);
      store.put({ key: syncKey, drawings: syncedDrawings, updatedAt: Date.now() });
    }

    // Await first transaction before opening second (prevents IDB "connection closing" errors)
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });

    // Sprint 10: Version ring buffer — save a versioned snapshot (separate transaction)
    try {
      const tx2 = db.transaction(STORE_NAME, 'readwrite');
      const store2 = tx2.objectStore(STORE_NAME);
      const versionKey = `${key}_versions`;
      const vReq = store2.get(versionKey);
      const versionData = await new Promise((resolve) => {
        vReq.onsuccess = () => resolve(vReq.result || { key: versionKey, versions: [] });
        vReq.onerror = () => resolve({ key: versionKey, versions: [] });
      });
      const allDrawings = [...localDrawings, ...syncedDrawings];
      versionData.versions.push({
        timestamp: Date.now(),
        count: allDrawings.length,
        drawings: allDrawings,
      });
      // Keep only last MAX_VERSIONS
      if (versionData.versions.length > MAX_VERSIONS) {
        versionData.versions = versionData.versions.slice(-MAX_VERSIONS);
      }
      store2.put(versionData);

      await new Promise((resolve, reject) => {
        tx2.oncomplete = resolve;
        tx2.onerror = () => reject(tx2.error);
      });
    } catch (vErr) {
      // Version history save is non-critical — don't block drawing saves
      logger.engine.debug('[DrawingPersistence] Version save failed (non-critical):', vErr);
    }
  } catch (err) {
    // InvalidStateError during symbol switch is expected — downgrade to debug
    const isExpectedError = err?.name === 'InvalidStateError' || (err?.message || '').includes('connection is closing');
    if (isExpectedError) {
      logger.engine.debug('[DrawingPersistence] Save skipped (IDB closing):', err?.message);
    } else {
      logger.engine.warn('[DrawingPersistence] Save failed:', err);
    }
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
    // eslint-disable-next-line unused-imports/no-unused-vars
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
  _loadingInProgress = true; // BUG-06: gate saves during load
  try {
    const db = await openCacheDB();
    const key = buildKey(symbol, timeframe);
    const syncKey = buildSyncKey(symbol);

    let tx;
    try {
      tx = db.transaction(STORE_NAME, 'readonly');
    } catch (e) {
      // InvalidStateError: DB connection closing during symbol switch — return empty
      logger.engine.debug('[DrawingPersistence] IDB unavailable during load, returning empty:', e?.message || e);
      return [];
    }
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
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) { /* storage may be blocked */ }
    return [];
  } finally {
    _loadingInProgress = false; // BUG-06: release load gate
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
  // eslint-disable-next-line unused-imports/no-unused-vars
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
let _loadingInProgress = false; // BUG-06: load/save race guard

export function debouncedSave(symbol, timeframe, drawings) {
  if (_loadingInProgress) return; // BUG-06: skip saves while loading
  _pendingSave = { symbol, timeframe, drawings };
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    if (_pendingSave) {
      saveDrawings(_pendingSave.symbol, _pendingSave.timeframe, _pendingSave.drawings);
      _pendingSave = null;
    }
  }, 500);
}

// ═══════════════════════════════════════════════════════════════════
// Sprint 10: Version History & Session Recovery
// ═══════════════════════════════════════════════════════════════════

/**
 * List available saved versions for a symbol+timeframe.
 * @param {string} symbol
 * @param {string} timeframe
 * @returns {Promise<Array<{timestamp: number, count: number}>>}
 */
export async function listVersions(symbol, timeframe) {
  try {
    const db = await openCacheDB();
    const key = `${buildKey(symbol, timeframe)}_versions`;
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve) => {
      const req = store.get(key);
      req.onsuccess = () => {
        const versions = req.result?.versions || [];
        resolve(versions.map((v, i) => ({ index: i, timestamp: v.timestamp, count: v.count })));
      };
      req.onerror = () => resolve([]);
    });
  } catch (_) {
    return [];
  }
}

/**
 * Recover drawings from a specific version.
 * @param {string} symbol
 * @param {string} timeframe
 * @param {number} versionIndex - Index into the version ring buffer
 * @returns {Promise<Object[]>}
 */
export async function recoverDrawings(symbol, timeframe, versionIndex) {
  try {
    const db = await openCacheDB();
    const key = `${buildKey(symbol, timeframe)}_versions`;
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve) => {
      const req = store.get(key);
      req.onsuccess = () => {
        const versions = req.result?.versions || [];
        const target = versions[versionIndex];
        if (!target) { resolve([]); return; }
        resolve(target.drawings.map(d => ({ ...d, state: 'idle' })));
      };
      req.onerror = () => resolve([]);
    });
  } catch (_) {
    return [];
  }
}

/**
 * Capture initial drawing state for session-level undo.
 * Called once after the first load for a symbol+timeframe.
 * @param {Object[]} drawings
 */
export function captureSessionSnapshot(drawings) {
  _sessionSnapshot = drawings.map(d => ({
    id: d.id, type: d.type,
    points: d.points.map(p => ({ price: p.price, time: p.time })),
    style: { ...d.style },
    locked: d.locked || false,
    visible: d.visible !== false,
    meta: d.meta ? { ...d.meta } : {},
    syncAcrossTimeframes: d.syncAcrossTimeframes || false,
  }));
}

/**
 * Get the session snapshot (initial load state).
 * @returns {Object[]|null}
 */
export function getSessionSnapshot() {
  return _sessionSnapshot ? _sessionSnapshot.map(d => ({ ...d, state: 'idle' })) : null;
}
