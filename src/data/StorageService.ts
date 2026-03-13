// ═══════════════════════════════════════════════════════════════════
// charEdge — StorageService (UnifiedDB-backed)
//
// @deprecated — Prefer importing from CacheManager instead:
//   import { cacheManager } from './engine/infra/CacheManager.js';
//   // cacheManager.trades.getAll(), cacheManager.settings.set(), etc.
//
// This file is kept for backward compatibility. CacheManager proxies
// all methods defined here. New code should NOT import StorageService directly.
//
// Thin wrapper around openUnifiedDB() — no MiniDB, no TableAccessor.
// Falls back to in-memory Maps when IndexedDB is unavailable.
// ═══════════════════════════════════════════════════════════════════

import { openUnifiedDB } from './UnifiedDB.js';
import { logger } from '@/observability/logger';
import { accountStoreName } from '@/state/useAccountStore';

// ─── Database Access ────────────────────────────────────────────
let _db = null;
let _memFallback = null; // Map<storeName, Map<pk, record>>

// eslint-disable-next-line @typescript-eslint/naming-convention
async function _getDB() {
  if (_db) return _db;
  if (_memFallback) return null;

  try {
    _db = await openUnifiedDB();
    return _db;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_) {
    logger.data.warn('[StorageService] UnifiedDB unavailable — using in-memory fallback');
    _memFallback = new Map();
    // Initialize both flat stores and account-specific stores for fallback
    for (const s of [
      'trades',
      'playbooks',
      'notes',
      'tradePlans',
      'settings',
      'trades_real',
      'trades_demo',
      'playbooks_real',
      'playbooks_demo',
      'notes_real',
      'notes_demo',
      'tradePlans_real',
      'tradePlans_demo',
    ]) {
      _memFallback.set(s, new Map());
    }
    return null;
  }
}

// ─── Low-level Helpers ──────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/naming-convention
function _idbPut(db, table, item) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(table, 'readwrite');
    const store = tx.objectStore(table);
    const req = store.put(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      const err = req.error || tx.error;
      if (err?.name === 'QuotaExceededError') {
        err.isQuotaError = true;
        err.message = `Storage quota exceeded writing to "${table}". Run quotaRecovery() to free space.`;
      }
      reject(err);
    };
  });
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function _idbBulkPut(db, table, items) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(table, 'readwrite');
    const store = tx.objectStore(table);
    for (const item of items) store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => {
      const err = tx.error;
      if (err?.name === 'QuotaExceededError') {
        err.isQuotaError = true;
        err.message = `Storage quota exceeded during bulk write to "${table}".`;
      }
      reject(err);
    };
    tx.onabort = () => {
      const err = tx.error;
      if (err?.name === 'QuotaExceededError') err.isQuotaError = true;
      reject(err || new Error('Transaction aborted'));
    };
  });
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function _idbGet(db, table, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(table, 'readonly');
    const req = tx.objectStore(table).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function _idbGetAll(db, table) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(table, 'readonly');
    const req = tx.objectStore(table).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function _idbDelete(db, table, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(table, 'readwrite');
    const req = tx.objectStore(table).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function _idbClear(db, table) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(table, 'readwrite');
    const req = tx.objectStore(table).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function _idbCount(db, table) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(table, 'readonly');
    const req = tx.objectStore(table).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function _idbWhere(db, table, field, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(table, 'readonly');
    const store = tx.objectStore(table);
    let req;
    try {
      req = store.index(field).getAll(value);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      // Index doesn't exist — fall back to full scan
      req = store.getAll();
      req.onsuccess = () => resolve((req.result || []).filter((r) => r[field] === value));
      req.onerror = () => reject(req.error);
      return;
    }
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function _idbWhereRange(db, table, field, lower, upper) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(table, 'readonly');
    const store = tx.objectStore(table);
    try {
      const range = IDBKeyRange.bound(lower, upper);
      const req = store.index(field).getAll(range);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []).filter((r) => r[field] >= lower && r[field] <= upper));
      req.onerror = () => reject(req.error);
    }
  });
}

// ─── CRUD Factory ───────────────────────────────────────────────
// Generates the standard { getAll, put, delete, replaceAll } API
// for a given store name + primary key field.

// eslint-disable-next-line @typescript-eslint/naming-convention
function _makeCRUD(table, pk) {
  return {
    async getAll() {
      try {
        const db = await _getDB();
        if (!db) return { ok: true, data: [..._memFallback.get(table).values()] };
        const data = await _idbGetAll(db, table);
        return { ok: true, data };
      } catch (e) {
        return { ok: false, data: [], error: e.message };
      }
    },
    async put(item) {
      try {
        const db = await _getDB();
        if (!db) {
          _memFallback.get(table).set(item[pk], item);
          return { ok: true };
        }
        await _idbPut(db, table, item);
        return { ok: true };
      } catch (e) {
        if (e.isQuotaError) return { ok: false, error: e.message, quotaExceeded: true };
        return { ok: false, error: e.message };
      }
    },
    async delete(id) {
      try {
        const db = await _getDB();
        if (!db) {
          _memFallback.get(table).delete(id);
          return { ok: true };
        }
        await _idbDelete(db, table, id);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    async replaceAll(items) {
      try {
        const db = await _getDB();
        if (!db) {
          const m = _memFallback.get(table);
          m.clear();
          for (const item of items) m.set(item[pk], item);
          return { ok: true };
        }
        await _idbClear(db, table);
        if (items.length) await _idbBulkPut(db, table, items);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
  };
}

// ─── Account-Aware CRUD Factory ─────────────────────────────────
// Resolves the IDB store name at call time using the active account.
// e.g. 'trades' → 'trades_real' or 'trades_demo'

// eslint-disable-next-line @typescript-eslint/naming-convention
function _makeAccountCRUD(base, pk) {
  return {
    async getAll() {
      const table = accountStoreName(base);
      try {
        const db = await _getDB();
        if (!db) {
          const store = _memFallback.get(table) || _memFallback.get(base);
          return { ok: true, data: store ? [...store.values()] : [] };
        }
        const data = await _idbGetAll(db, table);
        return { ok: true, data };
      } catch (e) {
        return { ok: false, data: [], error: e.message };
      }
    },
    async put(item) {
      const table = accountStoreName(base);
      try {
        const db = await _getDB();
        if (!db) {
          const store = _memFallback.get(table) || _memFallback.get(base);
          if (store) store.set(item[pk], item);
          return { ok: true };
        }
        await _idbPut(db, table, item);
        return { ok: true };
      } catch (e) {
        if (e.isQuotaError) return { ok: false, error: e.message, quotaExceeded: true };
        return { ok: false, error: e.message };
      }
    },
    async delete(id) {
      const table = accountStoreName(base);
      try {
        const db = await _getDB();
        if (!db) {
          const store = _memFallback.get(table) || _memFallback.get(base);
          if (store) store.delete(id);
          return { ok: true };
        }
        await _idbDelete(db, table, id);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    async replaceAll(items) {
      const table = accountStoreName(base);
      try {
        const db = await _getDB();
        if (!db) {
          const store = _memFallback.get(table) || _memFallback.get(base);
          if (store) {
            store.clear();
            for (const item of items) store.set(item[pk], item);
          }
          return { ok: true };
        }
        await _idbClear(db, table);
        if (items.length) await _idbBulkPut(db, table, items);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
  };
}

// ─── StorageService API ─────────────────────────────────────────
const StorageService = {
  trades: {
    ..._makeAccountCRUD('trades', 'id'),
    async bulkPut(trades) {
      const table = accountStoreName('trades');
      try {
        const db = await _getDB();
        if (!db) {
          const store = _memFallback.get(table) || _memFallback.get('trades');
          if (store) for (const t of trades) store.set(t.id, t);
          return { ok: true };
        }
        await _idbBulkPut(db, table, trades);
        return { ok: true };
      } catch (e) {
        if (e.isQuotaError) return { ok: false, error: e.message, quotaExceeded: true };
        return { ok: false, error: e.message };
      }
    },
    async count() {
      const table = accountStoreName('trades');
      try {
        const db = await _getDB();
        if (!db) {
          const store = _memFallback.get(table) || _memFallback.get('trades');
          return { ok: true, data: store ? store.size : 0 };
        }
        const data = await _idbCount(db, table);
        return { ok: true, data };
      } catch (e) {
        return { ok: false, data: 0, error: e.message };
      }
    },
    async clear() {
      const table = accountStoreName('trades');
      try {
        const db = await _getDB();
        if (!db) {
          const store = _memFallback.get(table) || _memFallback.get('trades');
          if (store) store.clear();
          return { ok: true };
        }
        await _idbClear(db, table);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },

    /**
     * Cursor-based pagination for trades.
     * @param {string|null} cursor - Last trade ID from previous page (null = first page)
     * @param {number} limit - Max records per page (default 50)
     * @returns {{ ok, data, nextCursor }}
     */
    async getPage(cursor = null, limit = 50) {
      const table = accountStoreName('trades');
      try {
        const db = await _getDB();

        // Memory fallback — simple array slice
        if (!db) {
          const store = _memFallback.get(table) || _memFallback.get('trades');
          const all = store ? [...store.values()] : [];
          const startIdx = cursor ? all.findIndex((t) => t.id === cursor) + 1 : 0;
          const page = all.slice(startIdx, startIdx + limit);
          const nextCursor = page.length === limit ? page[page.length - 1].id : null;
          return { ok: true, data: page, nextCursor };
        }

        // IDB cursor-based pagination
        return new Promise((resolve) => {
          const tx = db.transaction(table, 'readonly');
          const store = tx.objectStore(table);
          const results = [];
          let skipping = !!cursor;

          const req = store.openCursor();
          req.onsuccess = () => {
            const c = req.result;
            if (!c || results.length >= limit) {
              const nextCursor = results.length >= limit && c ? c.value.id : null;
              resolve({ ok: true, data: results, nextCursor });
              return;
            }
            // Skip past the cursor key
            if (skipping) {
              if (c.value.id === cursor) {
                skipping = false;
                c.continue();
                return;
              }
              c.continue();
              return;
            }
            results.push(c.value);
            c.continue();
          };
          req.onerror = () => resolve({ ok: false, data: [], nextCursor: null, error: req.error?.message });
        });
      } catch (e) {
        return { ok: false, data: [], nextCursor: null, error: e.message };
      }
    },
  },

  playbooks: _makeAccountCRUD('playbooks', 'id'),
  notes: _makeAccountCRUD('notes', 'id'),
  tradePlans: _makeAccountCRUD('tradePlans', 'id'),

  settings: {
    async get(key) {
      try {
        const db = await _getDB();
        if (!db) {
          const row = _memFallback.get('settings').get(key);
          return { ok: true, data: row?.value ?? null };
        }
        const row = await _idbGet(db, 'settings', key);
        return { ok: true, data: row?.value ?? null };
      } catch (e) {
        return { ok: false, data: null, error: e.message };
      }
    },
    async set(key, value) {
      try {
        const db = await _getDB();
        if (!db) {
          _memFallback.get('settings').set(key, { key, value });
          return { ok: true };
        }
        await _idbPut(db, 'settings', { key, value });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    async getAll() {
      try {
        const db = await _getDB();
        const rows = db ? await _idbGetAll(db, 'settings') : [..._memFallback.get('settings').values()];
        const obj = {};
        rows.forEach((r) => {
          obj[r.key] = r.value;
        });
        return { ok: true, data: obj };
      } catch (e) {
        return { ok: false, data: {}, error: e.message };
      }
    },
  },

  async clearAll() {
    try {
      const db = await _getDB();
      if (!db) {
        for (const m of _memFallback.values()) m.clear();
        return { ok: true };
      }
      await Promise.all([
        _idbClear(db, 'trades'),
        _idbClear(db, 'playbooks'),
        _idbClear(db, 'notes'),
        _idbClear(db, 'tradePlans'),
        _idbClear(db, 'settings'),
      ]);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },

  // ─── Indexed Queries ─────────────────────────────────────
  async getTradesBySymbol(symbol) {
    const table = accountStoreName('trades');
    try {
      const db = await _getDB();
      if (!db) {
        const store = _memFallback.get(table) || _memFallback.get('trades');
        const all = store ? [...store.values()] : [];
        return { ok: true, data: all.filter((t) => t.symbol === symbol) };
      }
      const data = await _idbWhere(db, table, 'symbol', symbol);
      return { ok: true, data };
    } catch (e) {
      return { ok: false, data: [], error: e.message };
    }
  },

  async getTradesByDateRange(from, to) {
    const table = accountStoreName('trades');
    try {
      const db = await _getDB();
      if (!db) {
        const store = _memFallback.get(table) || _memFallback.get('trades');
        const all = store ? [...store.values()] : [];
        return { ok: true, data: all.filter((t) => t.date >= from && t.date <= to) };
      }
      const data = await _idbWhereRange(db, table, 'date', from, to);
      return { ok: true, data };
    } catch (e) {
      return { ok: false, data: [], error: e.message };
    }
  },

  // ─── Quota Management ────────────────────────────────────
  async checkQuota() {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
      return { ok: true, data: { used: 0, quota: 0, percent: 0, available: true } };
    }
    try {
      const est = await navigator.storage.estimate();
      const used = est.usage || 0;
      const quota = est.quota || 0;
      const percent = quota > 0 ? Math.round((used / quota) * 100) : 0;
      return { ok: true, data: { used, quota, percent, available: percent < 95 } };
    } catch (e) {
      return { ok: false, data: { used: 0, quota: 0, percent: 0, available: true }, error: e.message };
    }
  },

  async quotaRecovery(_targetPercent = 70) {
    const quotaCheck = await this.checkQuota();
    if (!quotaCheck.ok || quotaCheck.data.percent < 90) {
      return { ok: true, freed: 0, message: 'Quota OK, no recovery needed' };
    }

    try {
      const db = await _getDB();
      const allTrades = db ? await _idbGetAll(db, 'trades') : [..._memFallback.get('trades').values()];

      if (allTrades.length === 0) return { ok: true, freed: 0 };

      allTrades.sort((a, b) => {
        const da = a.date || a.entryDate || 0;
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const db_ = b.date || b.entryDate || 0;
        return (
          (typeof da === 'string' ? new Date(da).getTime() : da) -
          (typeof db_ === 'string' ? new Date(db_).getTime() : db_)
        );
      });

      const removeCount = Math.ceil(allTrades.length * 0.2);
      const toRemove = allTrades.slice(0, removeCount);

      for (const trade of toRemove) {
        if (db) await _idbDelete(db, 'trades', trade.id);
        else _memFallback.get('trades').delete(trade.id);
      }

      logger.data.warn(`[StorageService] Quota recovery: removed ${removeCount} oldest trades`);
      return { ok: true, freed: removeCount, message: `Removed ${removeCount} oldest trades` };
    } catch (e) {
      return { ok: false, freed: 0, error: e.message };
    }
  },

  async migrateFromLegacy() {
    const migrated = { trades: 0, playbooks: 0, notes: 0 };
    if (typeof window !== 'undefined' && window.storage) {
      try {
        const r = await window.storage.get('charEdge-os-v93');
        if (r) {
          const data = JSON.parse(r.value);
          const db = await _getDB();
          if (data.trades?.length) {
            if (db) await _idbBulkPut(db, 'trades', data.trades);
            else for (const t of data.trades) _memFallback.get('trades').set(t.id, t);
            migrated.trades = data.trades.length;
          }
          if (data.playbooks?.length) {
            if (db) await _idbBulkPut(db, 'playbooks', data.playbooks);
            else for (const p of data.playbooks) _memFallback.get('playbooks').set(p.id, p);
            migrated.playbooks = data.playbooks.length;
          }
          if (data.notes?.length) {
            if (db) await _idbBulkPut(db, 'notes', data.notes);
            else for (const n of data.notes) _memFallback.get('notes').set(n.id, n);
            migrated.notes = data.notes.length;
          }
        }
      } catch (e) {
        logger.data.warn('[Storage] Legacy migration failed:', e);
      }
    }
    return migrated;
  },
};

export { StorageService };
export default StorageService;
