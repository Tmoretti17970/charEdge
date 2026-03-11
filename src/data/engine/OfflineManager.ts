// ═══════════════════════════════════════════════════════════════════
// charEdge — Offline Manager (Task 2.3.12)
//
// Detects online/offline transitions. When offline, suppresses WS
// reconnect attempts and queues user actions for replay on reconnect.
// Serves cached OPFS data automatically through DatafeedService.
// ═══════════════════════════════════════════════════════════════════

// @ts-expect-error — .ts imports resolved by Vite
import { logger } from '@/observability/logger.ts';

// ─── Types ──────────────────────────────────────────────────────

interface QueuedAction {
    type: string;
    payload: unknown;
    timestamp: number;
}

type OfflineListener = (isOffline: boolean) => void;

// ─── OfflineManager ─────────────────────────────────────────────

class OfflineManager {
    private _isOffline = false;
    private _actionQueue: QueuedAction[] = [];
    private _listeners = new Set<OfflineListener>();
    private _lastOnlineAt = performance.now();
    private _boundOnline: () => void;
    private _boundOffline: () => void;

    constructor() {
        this._boundOnline = this._handleOnline.bind(this);
        this._boundOffline = this._handleOffline.bind(this);

        if (typeof window !== 'undefined') {
            this._isOffline = !navigator.onLine;
            window.addEventListener('online', this._boundOnline);
            window.addEventListener('offline', this._boundOffline);

            if (this._isOffline) {
                logger.data.info('[OfflineManager] Started in offline mode');
            }
        }
    }

    // ─── Public API ─────────────────────────────────────────────────

    /** Whether the app is currently offline */
    get isOffline(): boolean {
        return this._isOffline;
    }

    /** Whether the app is currently online */
    get isOnline(): boolean {
        return !this._isOffline;
    }

    /** Time elapsed since last online state (ms) */
    get timeSinceOnline(): number {
        if (!this._isOffline) return 0;
        return performance.now() - this._lastOnlineAt;
    }

    /** Human-readable offline duration */
    get offlineDuration(): string {
        if (!this._isOffline) return '';
        const ms = this.timeSinceOnline;
        if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
        if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
        return `${Math.round(ms / 3_600_000)}h`;
    }

    /** Queue an action for replay when back online */
    queueAction(type: string, payload: unknown): void {
        this._actionQueue.push({
            type,
            payload,
            timestamp: Date.now(),
        });
        logger.data.info(`[OfflineManager] Queued action: ${type} (${this._actionQueue.length} pending)`);
    }

    /** Get number of queued actions */
    get pendingActions(): number {
        return this._actionQueue.length;
    }

    /** Subscribe to online/offline transitions */
    subscribe(listener: OfflineListener): () => void {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    /** Process queued actions (called on reconnect) */
    async flushQueue(handler: (action: QueuedAction) => Promise<void>): Promise<number> {
        const queued = [...this._actionQueue];
        this._actionQueue = [];
        let processed = 0;

        for (const action of queued) {
            try {
                await handler(action);
                processed++;
            } catch (e) {
                logger.data.warn(`[OfflineManager] Failed to replay action: ${action.type}`, e);
                // Re-queue failed actions
                this._actionQueue.push(action);
            }
        }

        logger.data.info(`[OfflineManager] Flushed ${processed}/${queued.length} queued actions`);
        return processed;
    }

    /** Cleanup */
    dispose(): void {
        if (typeof window !== 'undefined') {
            window.removeEventListener('online', this._boundOnline);
            window.removeEventListener('offline', this._boundOffline);
        }
        this._listeners.clear();
        this._actionQueue = [];
    }

    // ─── Private ────────────────────────────────────────────────────

    private _handleOnline(): void {
        this._isOffline = false;
        this._lastOnlineAt = performance.now();
        logger.data.info('[OfflineManager] Back online');
        this._notifyListeners();
    }

    private _handleOffline(): void {
        this._isOffline = true;
        logger.data.info('[OfflineManager] Went offline');
        this._notifyListeners();
    }

    private _notifyListeners(): void {
        for (const listener of this._listeners) {
            try {
                listener(this._isOffline);
            } catch (e) {
                logger.data.warn('[OfflineManager] Listener error', e);
            }
        }
    }
}

// Singleton
const offlineManager = new OfflineManager();

export { OfflineManager, offlineManager };
export type { QueuedAction, OfflineListener };
export default offlineManager;
