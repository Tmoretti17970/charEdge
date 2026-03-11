// ═══════════════════════════════════════════════════════════════════
// charEdge — Trade WAL (Write-Ahead Log)
//
// Lightweight WAL for user-entered trades. Buffers writes in a
// dedicated IDB object store and flushes to the main `trades` store
// on requestIdleCallback or every 5 seconds.
//
// On startup, any unflushed WAL entries are replayed to ensure
// no trade data is lost after a crash or abrupt tab close.
//
// Usage:
//   import { tradeWAL } from './TradeWAL';
//   await tradeWAL.write(trade);  // buffered, returns immediately
//   // ... later, on idle:
//   await tradeWAL.flush();       // commits to main store
// ═══════════════════════════════════════════════════════════════════

import { openUnifiedDB, UNIFIED_DB_NAME } from './UnifiedDB.js';
import { logger } from '@/observability/logger';

const WAL_STORE = 'wal_trades';
const FLUSH_INTERVAL_MS = 5_000;

class TradeWAL {
    private _flushTimer: ReturnType<typeof setInterval> | null = null;
    private _flushScheduled = false;
    private _disposed = false;
    private _dbReady: Promise<IDBDatabase> | null = null;

    /**
     * Initialize the WAL. Ensures the `wal_trades` store exists and
     * starts the periodic flush timer.
     */
    async init(): Promise<void> {
        this._dbReady = this._ensureStore();
        await this._dbReady;

        // Replay any unflushed entries from a previous session
        await this.flush();

        // Periodic flush every 5 seconds
        this._flushTimer = setInterval(() => {
            if (!this._disposed) this.flush().catch(() => { });
        }, FLUSH_INTERVAL_MS);
    }

    /**
     * Write a trade entry to the WAL buffer.
     * Returns immediately — the trade will be flushed to the main
     * `trades` store asynchronously.
     */
    async write(trade: Record<string, unknown>): Promise<void> {
        const db = await this._getDB();
        if (!db) return;

        return new Promise((resolve, reject) => {
            try {
                const tx = db.transaction(WAL_STORE, 'readwrite');
                const store = tx.objectStore(WAL_STORE);
                // Stamp the WAL entry with write time for ordering
                store.add({ ...trade, _walTimestamp: Date.now() });
                tx.oncomplete = () => {
                    this._scheduleFlush();
                    resolve();
                };
                tx.onerror = () => {
                    logger.data.warn('[TradeWAL] Write failed');
                    reject(tx.error);
                };
            } catch (err) {
                logger.data.warn('[TradeWAL] Write exception', err);
                reject(err);
            }
        });
    }

    /**
     * Flush all WAL entries to the main `trades` store and clear them
     * from the WAL. This is idempotent — safe to call multiple times.
     */
    async flush(): Promise<number> {
        const db = await this._getDB();
        if (!db) return 0;

        // 1. Read all WAL entries
        const walEntries = await this._readAll(db);
        if (walEntries.length === 0) return 0;

        // 2. Write to main trades store
        try {
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction('trades', 'readwrite');
                const store = tx.objectStore('trades');
                for (const entry of walEntries) {
                    // Remove WAL metadata before writing to main store
                    const { _walTimestamp, _walId, ...trade } = entry;
                    store.put(trade);
                }
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (err) {
            logger.data.warn('[TradeWAL] Flush to trades failed:', err);
            return 0; // Don't clear WAL if flush failed
        }

        // 3. Clear WAL entries (only after successful flush)
        try {
            await new Promise<void>((resolve) => {
                const tx = db.transaction(WAL_STORE, 'readwrite');
                tx.objectStore(WAL_STORE).clear();
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve(); // clear failure is non-fatal
            });
        } catch {
            // non-fatal — entries may be re-flushed next cycle
        }

        logger.data.info(`[TradeWAL] Flushed ${walEntries.length} entries`);
        return walEntries.length;
    }

    /**
     * Dispose the WAL, stopping the flush timer.
     * Call this on app teardown.
     */
    dispose(): void {
        this._disposed = true;
        if (this._flushTimer) {
            clearInterval(this._flushTimer);
            this._flushTimer = null;
        }
        // Final flush attempt (best-effort)
        this.flush().catch(() => { });
    }

    // ─── Private helpers ──────────────────────────────────────────

    private async _getDB(): Promise<IDBDatabase | null> {
        try {
            return await openUnifiedDB();
        } catch {
            return null;
        }
    }

    /**
     * Ensure the wal_trades store exists. If it doesn't (DB version
     * hasn't been bumped yet), we trigger a version upgrade.
     */
    private async _ensureStore(): Promise<IDBDatabase> {
        const db = await openUnifiedDB();
        if (db.objectStoreNames.contains(WAL_STORE)) return db;

        // Need to close and re-open with version bump to add the store
        db.close();
        return new Promise((resolve, reject) => {
            // Increment version by 1 to trigger onupgradeneeded
            const req = indexedDB.open(UNIFIED_DB_NAME, db.version + 1);
            req.onupgradeneeded = (event) => {
                const upgradeDb = (event.target as IDBOpenDBRequest).result;
                if (!upgradeDb.objectStoreNames.contains(WAL_STORE)) {
                    upgradeDb.createObjectStore(WAL_STORE, { autoIncrement: true });
                }
            };
            req.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
            req.onerror = () => reject(new Error('[TradeWAL] Failed to create WAL store'));
        });
    }

    private _readAll(db: IDBDatabase): Promise<Record<string, unknown>[]> {
        return new Promise((resolve) => {
            try {
                if (!db.objectStoreNames.contains(WAL_STORE)) {
                    resolve([]);
                    return;
                }
                const tx = db.transaction(WAL_STORE, 'readonly');
                const req = tx.objectStore(WAL_STORE).getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve([]);
            } catch {
                resolve([]);
            }
        });
    }

    private _scheduleFlush(): void {
        if (this._flushScheduled || this._disposed) return;
        this._flushScheduled = true;

        // Use requestIdleCallback if available, otherwise setTimeout
        const schedule = typeof requestIdleCallback !== 'undefined'
            ? requestIdleCallback
            : (cb: () => void) => setTimeout(cb, 100);

        schedule(() => {
            this._flushScheduled = false;
            this.flush().catch(() => { });
        });
    }
}

/** Singleton WAL instance. Call tradeWAL.init() on app boot. */
export const tradeWAL = new TradeWAL();
