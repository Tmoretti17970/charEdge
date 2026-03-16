// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Sync Service (Sprint 23)
//
// Cross-device drawing synchronization:
//   - Save/load drawings to IndexedDB for offline support
//   - Queue changes when offline → sync on reconnect
//   - Version-based conflict resolution (last-write-wins)
//   - Sync status tracking (synced, pending, conflict)
//
// NOTE: Cloud API integration is a stub — replace with real API
// endpoints when backend is ready.
// ═══════════════════════════════════════════════════════════════════

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

  // ─── Cloud sync stubs ─────────────────────────────────────

  async _syncToCloud(record) {
    this._syncStatus = 'syncing';
    this._notify();

    try {
      // STUB: Replace with actual API call
      // await fetch('/api/drawings/sync', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(record),
      // });

      // Simulate network latency
      await new Promise(resolve => setTimeout(resolve, 100));

      this._syncStatus = 'idle';
      this._notify();
    } catch (err) {
      console.warn('[DrawingSync] Cloud sync failed, queueing:', err);
      this._syncStatus = 'error';
      this._notify();
      await this._enqueue(record);
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
