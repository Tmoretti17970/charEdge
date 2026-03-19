// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Sync Service (Sprint 6 Enhanced)
//
// Cross-device drawing synchronization:
//   - Save/load drawings to IndexedDB for offline support
//   - Queue changes when offline → sync on reconnect
//   - Version-based conflict resolution (last-write-wins)
//   - Sprint 6 Task 6.2: Real Supabase cloud sync
//
// Usage:
//   const svc = getDrawingSyncService();
//   svc.saveLocal('BTC', '1h', drawings);
//   svc.pullFromCloud('BTC', '1h');
// ═══════════════════════════════════════════════════════════════════

import supabase from '../data/supabaseClient.ts';

const DB_NAME = 'charEdge-drawings';
const DB_VERSION = 1;
const STORE_NAME = 'drawings';
const QUEUE_STORE = 'syncQueue';

// ─── IndexedDB Helpers ──────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'queueId', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbPut(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.put(data);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGetAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbClear(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Sync Service ───────────────────────────────────────────────

class DrawingSyncService {
  constructor() {
    this._syncStatus = 'idle'; // 'idle' | 'syncing' | 'offline' | 'error'
    this._listeners = new Set();
    this._online = navigator.onLine;
    this._version = 0;
    this._init();
  }

  _init() {
    window.addEventListener('online', () => {
      this._online = true;
      this._syncStatus = 'idle';
      this._flushQueue();
      this._notify();
    });

    window.addEventListener('offline', () => {
      this._online = false;
      this._syncStatus = 'offline';
      this._notify();
    });
  }

  /**
   * Save drawings locally (IndexedDB).
   * @param {string} symbol
   * @param {string} tf
   * @param {Array} drawings
   */
  async saveLocal(symbol, tf, drawings) {
    const key = `${symbol}-${tf}`;
    const record = {
      id: key,
      symbol,
      tf,
      drawings: drawings.map(d => ({
        id: d.id,
        type: d.type,
        style: { ...d.style },
        pricePoints: d.pricePoints?.map(pp => ({ price: pp.price, time: pp.time })) || [],
        label: d.label || '',
        text: d.text || '',
        locked: d.locked || false,
        visible: d.visible !== false,
        syncAcrossTimeframes: d.syncAcrossTimeframes || false,
      })),
      version: ++this._version,
      updatedAt: Date.now(),
    };

    try {
      await idbPut(STORE_NAME, record);
    } catch (err) {
      console.error('[DrawingSync] Local save failed:', err);
    }

    // Queue for cloud sync
    if (this._online) {
      await this._syncToCloud(record);
    } else {
      await this._enqueue(record);
    }
  }

  /**
   * Load drawings from local store.
   * @param {string} symbol
   * @param {string} tf
   * @returns {Promise<Array>}
   */
  async loadLocal(symbol, tf) {
    try {
      const all = await idbGetAll(STORE_NAME);
      const key = `${symbol}-${tf}`;
      const record = all.find(r => r.id === key);
      return record?.drawings || [];
    } catch (err) {
      console.error('[DrawingSync] Local load failed:', err);
      return [];
    }
  }

  /**
   * Load all synced drawings across all timeframes (for cross-TF sync).
   * @param {string} symbol
   * @returns {Promise<Array>}
   */
  async loadAllForSymbol(symbol) {
    try {
      const all = await idbGetAll(STORE_NAME);
      return all
        .filter(r => r.symbol === symbol)
        .flatMap(r => r.drawings.filter(d => d.syncAcrossTimeframes));
    } catch (err) {
      console.error('[DrawingSync] Cross-TF load failed:', err);
      return [];
    }
  }

  // ─── Sprint 6 Task 6.2: Real Supabase cloud sync ─────────

  /**
   * Push a drawing record to Supabase (upsert).
   * @param {Object} record - { id, symbol, tf, drawings, version, updatedAt }
   */
  async _syncToCloud(record) {
    this._syncStatus = 'syncing';
    this._notify();

    // Guard: skip if Supabase is not configured
    if (!supabase) {
      this._syncStatus = 'idle';
      this._notify();
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Not authenticated — save locally only
        this._syncStatus = 'idle';
        this._notify();
        return;
      }

      const { error } = await supabase
        .from('drawings')
        .upsert({
          id: record.id,
          user_id: user.id,
          symbol: record.symbol,
          tf: record.tf,
          drawings: record.drawings,
          version: record.version,
          updated_at: new Date(record.updatedAt).toISOString(),
        }, { onConflict: 'id' });

      if (error) throw error;

      this._syncStatus = 'idle';
      this._notify();
    } catch (err) {
      console.warn('[DrawingSync] Cloud sync failed, queueing:', err);
      this._syncStatus = 'error';
      this._notify();
      await this._enqueue(record);
    }
  }

  /**
   * Sprint 6 Task 6.2.4: Pull drawings from Supabase and merge with local (last-write-wins).
   * @param {string} symbol
   * @param {string} tf
   * @returns {Promise<Array>} Merged drawings
   */
  async pullFromCloud(symbol, tf) {
    if (!supabase) return this.loadLocal(symbol, tf);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return this.loadLocal(symbol, tf);

      const key = `${symbol}-${tf}`;
      const { data: cloudRecord, error } = await supabase
        .from('drawings')
        .select('*')
        .eq('id', key)
        .eq('user_id', user.id)
        .single();

      if (error || !cloudRecord) {
        // No cloud data — return local
        return this.loadLocal(symbol, tf);
      }

      // Last-write-wins merge: compare timestamps
      const all = await idbGetAll(STORE_NAME);
      const localRecord = all.find(r => r.id === key);
      const cloudTime = new Date(cloudRecord.updated_at).getTime();
      const localTime = localRecord?.updatedAt || 0;

      if (cloudTime > localTime) {
        // Cloud is newer — update local
        const merged = {
          id: key,
          symbol,
          tf,
          drawings: cloudRecord.drawings,
          version: cloudRecord.version,
          updatedAt: cloudTime,
        };
        await idbPut(STORE_NAME, merged);
        return merged.drawings;
      }

      // Local is newer or same — keep local, push to cloud
      if (localRecord && localTime > cloudTime) {
        await this._syncToCloud(localRecord);
      }
      return localRecord?.drawings || [];
    } catch (err) {
      console.warn('[DrawingSync] Cloud pull failed:', err);
      return this.loadLocal(symbol, tf);
    }
  }

  /**
   * Sprint 6 Task 6.2: Full sync on app boot — push any queued changes,
   * then pull latest from cloud for all locally-known symbol/tf combos.
   */
  async syncFromCloud() {
    if (!supabase || !this._online) return;

    try {
      // Flush any offline queue first
      await this._flushQueue();

      // Pull all user drawings from cloud
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: cloudRecords, error } = await supabase
        .from('drawings')
        .select('*')
        .eq('user_id', user.id);

      if (error || !cloudRecords) return;

      // Merge each cloud record with local
      const localAll = await idbGetAll(STORE_NAME);
      const localMap = new Map(localAll.map(r => [r.id, r]));

      for (const cloud of cloudRecords) {
        const local = localMap.get(cloud.id);
        const cloudTime = new Date(cloud.updated_at).getTime();

        if (!local || cloudTime > (local.updatedAt || 0)) {
          // Cloud is newer — update local
          await idbPut(STORE_NAME, {
            id: cloud.id,
            symbol: cloud.symbol,
            tf: cloud.tf,
            drawings: cloud.drawings,
            version: cloud.version,
            updatedAt: cloudTime,
          });
        }
      }

      console.log(`[DrawingSync] Boot sync: merged ${cloudRecords.length} cloud records`);
    } catch (err) {
      console.warn('[DrawingSync] Boot sync failed:', err);
    }
  }

  async _enqueue(record) {
    try {
      await idbPut(QUEUE_STORE, {
        ...record,
        queueId: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        queuedAt: Date.now(),
      });
    } catch (err) {
      console.error('[DrawingSync] Queue failed:', err);
    }
  }

  async _flushQueue() {
    try {
      const queue = await idbGetAll(QUEUE_STORE);
      if (queue.length === 0) return;

      console.log(`[DrawingSync] Flushing ${queue.length} queued changes`);

      for (const record of queue) {
        await this._syncToCloud(record);
      }

      await idbClear(QUEUE_STORE);
    } catch (err) {
      console.error('[DrawingSync] Queue flush failed:', err);
    }
  }

  // ─── Status & Listeners ───────────────────────────────────

  get status() { return this._syncStatus; }
  get isOnline() { return this._online; }

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _notify() {
    for (const listener of this._listeners) {
      try { listener(this._syncStatus); } catch (_) { /* ignored */ }
    }
  }
}

// Singleton
let _instance = null;

export function getDrawingSyncService() {
  if (!_instance) {
    _instance = new DrawingSyncService();
  }
  return _instance;
}

export default DrawingSyncService;
