// ═══════════════════════════════════════════════════════════════════
// charEdge — Offline Manager (Sprint 95)
//
// Cache-first architecture for core features. Detects online/
// offline status, caches data in IndexedDB, queues mutations
// while offline, and syncs on reconnect.
//
// Usage:
//   import { offlineManager } from './OfflineManager';
//   offlineManager.init();
//   if (offlineManager.isOffline) { /* show indicator */ }
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface QueuedMutation {
  id: string;
  type: 'trade' | 'journal' | 'watchlist' | 'settings';
  action: 'create' | 'update' | 'delete';
  data: unknown;
  timestamp: number;
}

export interface OfflineStatus {
  isOnline: boolean;
  lastOnline: number;
  queuedMutations: number;
  cachedDataSize: number;
}

// ─── Constants ──────────────────────────────────────────────────

const DB_NAME = 'charEdge-offline';
const CACHE_STORE = 'cache';
const QUEUE_STORE = 'mutation-queue';
const STATUS_KEY = 'charEdge-offline-status';

// ─── Manager ────────────────────────────────────────────────────

class OfflineManager {
  private _isOnline = true;
  private _listeners = new Set<(online: boolean) => void>();
  private _db: IDBDatabase | null = null;
  private _initalized = false;

  /**
   * Initialize offline detection and sync handlers.
   */
  init(): void {
    if (this._initalized) return;
    this._initalized = true;

    this._isOnline = navigator.onLine;

    window.addEventListener('online', () => {
      this._isOnline = true;
      this._notifyListeners(true);
      this._syncQueue();
      this._saveStatus();
    });

    window.addEventListener('offline', () => {
      this._isOnline = false;
      this._notifyListeners(false);
      this._saveStatus();
    });

    this._saveStatus();
  }

  get isOnline(): boolean { return this._isOnline; }
  get isOffline(): boolean { return !this._isOnline; }

  /**
   * Subscribe to online/offline state changes.
   */
  onStatusChange(listener: (online: boolean) => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  // ─── Cache API ───────────────────────────────────────────────

  /**
   * Cache data for offline access.
   */
  async cacheData(key: string, data: unknown): Promise<void> {
    const db = await this._getDB();
    const tx = db.transaction(CACHE_STORE, 'readwrite');
    tx.objectStore(CACHE_STORE).put({
      key,
      data,
      cachedAt: Date.now(),
    });
  }

  /**
   * Get cached data.
   */
  async getCachedData<T>(key: string): Promise<T | null> {
    const db = await this._getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(CACHE_STORE, 'readonly');
      const req = tx.objectStore(CACHE_STORE).get(key);
      req.onsuccess = () => resolve(req.result?.data ?? null);
      req.onerror = () => resolve(null);
    });
  }

  // ─── Mutation Queue ──────────────────────────────────────────

  /**
   * Queue a mutation for later sync.
   */
  async queueMutation(mutation: Omit<QueuedMutation, 'id' | 'timestamp'>): Promise<void> {
    const entry: QueuedMutation = {
      ...mutation,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };

    const db = await this._getDB();
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).add(entry);
  }

  /**
   * Get all pending mutations.
   */
  async getPendingMutations(): Promise<QueuedMutation[]> {
    const db = await this._getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(QUEUE_STORE, 'readonly');
      const req = tx.objectStore(QUEUE_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  /**
   * Get current offline status.
   */
  async getStatus(): Promise<OfflineStatus> {
    const pending = await this.getPendingMutations();
    return {
      isOnline: this._isOnline,
      lastOnline: this._isOnline ? Date.now() : this._getLastOnline(),
      queuedMutations: pending.length,
      cachedDataSize: 0, // Expensive to calculate, skip
    };
  }

  // ─── Sync ────────────────────────────────────────────────────

  private async _syncQueue(): Promise<void> {
    if (!this._isOnline) return;

    const mutations = await this.getPendingMutations();
    if (mutations.length === 0) return;

    console.log(`[OfflineManager] Syncing ${mutations.length} queued mutations`);

    const db = await this._getDB();

    for (const mutation of mutations) {
      try {
        // Process mutation based on type
        await this._processMutation(mutation);

        // Remove from queue
        const tx = db.transaction(QUEUE_STORE, 'readwrite');
        tx.objectStore(QUEUE_STORE).delete(mutation.id);
      } catch (err) {
        console.warn(`[OfflineManager] Sync failed for ${mutation.id}:`, err);
        break; // Stop on first error, retry later
      }
    }
  }

  private async _processMutation(mutation: QueuedMutation): Promise<void> {
    // Apply mutations to the appropriate store
    // Trade mutations → useJournalStore
    // Settings mutations → localStorage
    // This is a hook point for future sync implementations
    switch (mutation.type) {
      case 'trade':
      case 'journal':
        // These are already persisted via zustand middleware
        break;
      case 'watchlist':
      case 'settings':
        // These are already persisted via localStorage
        break;
    }
  }

  // ─── Internal ────────────────────────────────────────────────

  private _notifyListeners(online: boolean): void {
    for (const listener of this._listeners) {
      try { listener(online); } catch { /* */ }
    }
  }

  private _saveStatus(): void {
    try {
      localStorage.setItem(STATUS_KEY, JSON.stringify({
        lastOnline: this._isOnline ? Date.now() : this._getLastOnline(),
      }));
    } catch { /* */ }
  }

  private _getLastOnline(): number {
    try {
      const raw = localStorage.getItem(STATUS_KEY);
      return raw ? JSON.parse(raw).lastOnline || 0 : 0;
    } catch { return 0; }
  }

  private async _getDB(): Promise<IDBDatabase> {
    if (this._db) return this._db;

    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(CACHE_STORE)) {
          db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => { this._db = req.result; resolve(req.result); };
      req.onerror = () => reject(req.error);
    });
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const offlineManager = new OfflineManager();
export default offlineManager;
