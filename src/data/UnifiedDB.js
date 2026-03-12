import { logger } from '@/observability/logger';

// ═══════════════════════════════════════════════════════════════════
// charEdge — UnifiedDB (IDB Consolidation)
//
// Single IndexedDB database that replaces 3 separate databases:
//   - charEdge-cache     (DataCache — candles, quotes, etc.)
//   - charEdge-ticks     (TickPersistence — real-time trade ticks)
//   - charEdge-os-v10    (StorageService — user data)
//
// Migration: On first open, reads data from old DBs, writes to
// unified DB, then deletes old databases.
//
// Usage:
//   import { openUnifiedDB } from './UnifiedDB.js';
//   const db = await openUnifiedDB();
// ═══════════════════════════════════════════════════════════════════

const UNIFIED_DB_NAME = 'charEdge-unified';
const UNIFIED_DB_VERSION = 4; // P2 v4: Added enc_* stores for EncryptedStore consolidation (#22)

// Old database names (for migration)
const OLD_DBS = ['charEdge-cache', 'charEdge-ticks', 'charEdge-os-v10', 'charEdge_candleCache', 'charedge-session-recovery', 'charEdge_encrypted'];

// #22: EncryptedStore store name mapping (old → new)
const ENC_STORE_MAP = {
  journal: 'enc_journal',
  trades: 'enc_trades',
  settings: 'enc_settings',
  apikeys: 'enc_apikeys',
  __crypto_keys__: 'enc_crypto_keys',
};
const MIGRATION_FLAG = 'charEdge-unified-migrated';

// ─── Store Schemas ─────────────────────────────────────────────
// All stores from all 3 old databases, unified under one roof.

// From charEdge-cache (DataCache)
const CACHE_STORES = [
  'candles', 'quotes', 'fundamentals', 'economic', 'news',
  'sentiment', 'indicators', 'derivedData', 'volumeProfiles',
  'filings', 'meta', 'drawings', 'snapshots',
];

// From charEdge-ticks (TickPersistence)
// 'ticks' — autoIncrement, indexed by [symbol, time]
// 'tickMeta' — keyPath: 'symbol'

// From charEdge-os-v10 (StorageService/MiniDB)
const USER_STORES_SCHEMA = {
  trades: { keyPath: 'id', indexes: ['date', 'symbol', 'playbook'] },
  playbooks: { keyPath: 'id', indexes: ['name'] },
  notes: { keyPath: 'id', indexes: ['date'] },
  tradePlans: { keyPath: 'id', indexes: ['date'] },
  settings: { keyPath: 'key', indexes: [] },
};

// ─── Database Manager ──────────────────────────────────────────

let _db = null;
let _dbPromise = null;

function openUnifiedDB() {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    // Timeout: if IDB doesn't open in 5s, fall back to in-memory
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        logger.data.warn('[UnifiedDB] Open timed out after 5s — falling back to in-memory');
        reject(new Error('IndexedDB open timed out'));
      }
    }, 5000);

    try {
      const req = indexedDB.open(UNIFIED_DB_NAME, UNIFIED_DB_VERSION);

      req.onblocked = () => {
        logger.data.warn('[UnifiedDB] Database open blocked by another connection');
        // Don't reject immediately — give it a chance to unblock.
        // The timeout above will catch it if it stays blocked.
      };

      req.onupgradeneeded = (event) => {
        const db = event.target.result;

        // ── Cache stores (keyPath: 'key') ──
        for (const storeName of CACHE_STORES) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'key' });
          }
        }

        // ── Tick stores ──
        if (!db.objectStoreNames.contains('ticks')) {
          const tickStore = db.createObjectStore('ticks', { autoIncrement: true });
          tickStore.createIndex('symbol_time', ['symbol', 'time'], { unique: false });
          tickStore.createIndex('symbol', 'symbol', { unique: false });
          tickStore.createIndex('time', 'time', { unique: false });
        }
        if (!db.objectStoreNames.contains('tickMeta')) {
          db.createObjectStore('tickMeta', { keyPath: 'symbol' });
        }

        // ── User data stores ──
        for (const [name, schema] of Object.entries(USER_STORES_SCHEMA)) {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: schema.keyPath });
            for (const idx of schema.indexes) {
              store.createIndex(idx, idx, { unique: false });
            }
          }
        }

        // ── P2 7.1: Candle cache store (for CandleVirtualizer) ──
        if (!db.objectStoreNames.contains('candleCache')) {
          db.createObjectStore('candleCache');
        }

        // ── P2 7.2: Session recovery store ──
        if (!db.objectStoreNames.contains('session')) {
          db.createObjectStore('session', { keyPath: 'key' });
        }

        // ── P2 7.3: Voice-to-chart audio notes store (VoiceToChart consolidation) ──
        if (!db.objectStoreNames.contains('audioNotes')) {
          db.createObjectStore('audioNotes', { keyPath: 'id' });
        }

        // ── #22: EncryptedStore consolidated stores ──
        for (const newName of Object.values(ENC_STORE_MAP)) {
          if (!db.objectStoreNames.contains(newName)) {
            db.createObjectStore(newName);
          }
        }
      };

      req.onsuccess = (event) => {
        if (settled) return; // timed out already
        settled = true;
        clearTimeout(timeout);
        _db = event.target.result;

        // Run one-time migration in background (non-blocking)
        _migrateOldDBs(_db).catch((err) => {
          logger.data.warn('[UnifiedDB] Migration error (non-fatal):', err?.message);
        });

        resolve(_db);
      };

      req.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        logger.data.warn('[UnifiedDB] Failed to open unified database');
        reject(new Error('IndexedDB unavailable'));
      };
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
      }
      reject(new Error('IndexedDB not supported'));
    }
  });

  // Reset on failure so future calls can retry
  _dbPromise.catch(() => {
    _dbPromise = null;
  });

  return _dbPromise;
}

// ─── Migration Logic ───────────────────────────────────────────
// Reads data from old databases and copies it into the unified DB.
// Runs only once — sets a localStorage flag on completion.

async function _migrateOldDBs(unifiedDb) {
  // Skip if already migrated
  try {
    if (localStorage.getItem(MIGRATION_FLAG)) return;
  // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (_) { /* localStorage unavailable — skip migration check */ }

  let migrated = false;

  // 1. Migrate charEdge-cache
  try {
    await _migrateCacheDB(unifiedDb);
    migrated = true;
  } catch (err) {
    logger.data.warn('[UnifiedDB] Cache migration skipped:', err?.message);
  }

  // 2. Migrate charEdge-ticks
  try {
    await _migrateTickDB(unifiedDb);
    migrated = true;
  } catch (err) {
    logger.data.warn('[UnifiedDB] Tick migration skipped:', err?.message);
  }

  // 3. Migrate charEdge-os-v10
  try {
    await _migrateUserDB(unifiedDb);
    migrated = true;
  } catch (err) {
    logger.data.warn('[UnifiedDB] User data migration skipped:', err?.message);
  }

  // 4. #22: Migrate charEdge_encrypted (EncryptedStore)
  try {
    await _migrateEncryptedDB(unifiedDb);
    migrated = true;
  } catch (err) {
    logger.data.warn('[UnifiedDB] EncryptedStore migration skipped:', err?.message);
  }

  // Set flag so migration doesn't re-run
  try {
    localStorage.setItem(MIGRATION_FLAG, Date.now().toString());
  // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (_) { /* ignore */ }

  // Delete old databases (fire-and-forget, non-blocking)
  if (migrated) {
    for (const dbName of OLD_DBS) {
      try {
        indexedDB.deleteDatabase(dbName);
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) { /* silent */ }
    }
  }
}

async function _migrateCacheDB(unifiedDb) {
  const oldDb = await _openOldDB('charEdge-cache');
  if (!oldDb) return;

  try {
    // Copy each store that exists in both old and new DBs
    for (const storeName of CACHE_STORES) {
      if (!oldDb.objectStoreNames.contains(storeName)) continue;

      const records = await _readAllFromStore(oldDb, storeName);
      if (records.length === 0) continue;

      await _writeAllToStore(unifiedDb, storeName, records);
    }
  } finally {
    oldDb.close();
  }
}

async function _migrateTickDB(unifiedDb) {
  const oldDb = await _openOldDB('charEdge-ticks');
  if (!oldDb) return;

  try {
    // Migrate ticks
    if (oldDb.objectStoreNames.contains('ticks')) {
      const ticks = await _readAllFromStore(oldDb, 'ticks');
      if (ticks.length > 0) {
        // Tick store uses autoIncrement — use add() not put()
        await _addAllToStore(unifiedDb, 'ticks', ticks);
      }
    }

    // Migrate tick meta
    if (oldDb.objectStoreNames.contains('meta')) {
      const metaRecords = await _readAllFromStore(oldDb, 'meta');
      if (metaRecords.length > 0) {
        await _writeAllToStore(unifiedDb, 'tickMeta', metaRecords);
      }
    }
  } finally {
    oldDb.close();
  }
}

async function _migrateUserDB(unifiedDb) {
  const oldDb = await _openOldDB('charEdge-os-v10');
  if (!oldDb) return;

  try {
    for (const storeName of Object.keys(USER_STORES_SCHEMA)) {
      if (!oldDb.objectStoreNames.contains(storeName)) continue;

      const records = await _readAllFromStore(oldDb, storeName);
      if (records.length === 0) continue;

      await _writeAllToStore(unifiedDb, storeName, records);
    }
  } finally {
    oldDb.close();
  }
}

// #22: Migrate EncryptedStore (charEdge_encrypted → enc_* stores)
async function _migrateEncryptedDB(unifiedDb) {
  const oldDb = await _openOldDB('charEdge_encrypted');
  if (!oldDb) return;

  try {
    for (const [oldName, newName] of Object.entries(ENC_STORE_MAP)) {
      if (!oldDb.objectStoreNames.contains(oldName)) continue;

      const records = await _readAllFromStoreWithKeys(oldDb, oldName);
      if (records.length === 0) continue;

      // Write each record with its original key (out-of-line keys)
      await _writeAllToStoreWithKeys(unifiedDb, newName, records);
    }
    logger.data.info('[UnifiedDB] EncryptedStore migration complete');
  } finally {
    oldDb.close();
  }
}

// Read all records including their keys (for out-of-line key stores)
function _readAllFromStoreWithKeys(db, storeName) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const records = [];
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          records.push({ key: cursor.key, value: cursor.value });
          cursor.continue();
        } else {
          resolve(records);
        }
      };
      req.onerror = () => resolve([]);
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      resolve([]);
    }
  });
}

// Write records with explicit keys (for out-of-line key stores)
function _writeAllToStoreWithKeys(db, storeName, records) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const { key, value } of records) {
        store.put(value, key);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      resolve();
    }
  });
}

// ─── Helpers ───────────────────────────────────────────────────

function _openOldDB(name) {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(name);
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = () => resolve(null);
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      resolve(null);
    }
  });
}

function _readAllFromStore(db, storeName) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      resolve([]);
    }
  });
}

function _writeAllToStore(db, storeName, records) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const record of records) {
        store.put(record);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      resolve();
    }
  });
}

function _addAllToStore(db, storeName, records) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const record of records) {
        store.add(record);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      resolve();
    }
  });
}

// ─── Exports ──────────────────────────────────────────────────

export { openUnifiedDB, UNIFIED_DB_NAME };
export default openUnifiedDB;
