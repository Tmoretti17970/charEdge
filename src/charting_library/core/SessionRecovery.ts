// ═══════════════════════════════════════════════════════════════════
// charEdge — Session State Crash Recovery (Task 2.3.23)
//
// Serializes the full chart engine state to IndexedDB every 30 seconds.
// On next boot, if the previous session didn't cleanly unmount (crash,
// tab kill, browser crash), the recovery state is offered to the user.
//
// State captured:
//   - symbol, timeframe, chartType, scaleMode
//   - scroll position (scrollOffset, visibleBars)
//   - active indicators (type, params, color)
//   - workspace name
//   - route/page
//
// Staleness: Recovery states older than 24h are ignored.
// ═══════════════════════════════════════════════════════════════════

import { logger } from '../../utils/logger.js';

// ─── Constants ──────────────────────────────────────────────────

const DB_NAME = 'charedge-session-recovery';
const DB_VERSION = 1;
const STORE_NAME = 'session';
const SESSION_KEY = 'charedge_session_v1';
const SAVE_INTERVAL_MS = 30_000;       // Auto-save every 30 seconds
const MAX_STALENESS_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Types ──────────────────────────────────────────────────────

export interface RecoveryState {
    /** Saved timestamp (ms since epoch) */
    savedAt: number;
    /** Clean shutdown flag — set to true on normal destroy */
    cleanExit: boolean;
    /** Chart state */
    symbol: string;
    timeframe: string;
    chartType: string;
    scaleMode: string;
    scrollOffset: number;
    visibleBars: number;
    /** Active indicators (serializable subset) */
    indicators: Array<{ type: string; params: Record<string, unknown>; color?: string }>;
    /** Current route/page */
    page: string;
    /** Active workspace name (if any) */
    workspaceName: string | null;
}

// ─── IndexedDB Helpers ──────────────────────────────────────────

let _db: IDBDatabase | null = null;
let _dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
    if (_db) return Promise.resolve(_db);
    if (_dbPromise) return _dbPromise;

    _dbPromise = new Promise((resolve, reject) => {
        try {
            const req = indexedDB.open(DB_NAME, DB_VERSION);

            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };

            req.onsuccess = () => {
                _db = req.result;
                resolve(_db);
            };

            req.onerror = () => {
                logger.engine?.warn?.('[SessionRecovery] Failed to open IndexedDB', req.error);
                _dbPromise = null;
                reject(req.error);
            };
        } catch (err) {
            _dbPromise = null;
            reject(err);
        }
    });

    return _dbPromise;
}

async function idbPut(value: RecoveryState): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(value, SESSION_KEY);
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        logger.engine?.warn?.('[SessionRecovery] idbPut failed', err);
    }
}

async function idbGet(): Promise<RecoveryState | null> {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(SESSION_KEY);
        return new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        logger.engine?.warn?.('[SessionRecovery] idbGet failed', err);
        return null;
    }
}

async function idbDelete(): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(SESSION_KEY);
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        logger.engine?.warn?.('[SessionRecovery] idbDelete failed', err);
    }
}

// ─── Session Recovery Public API ────────────────────────────────

let _saveTimer: ReturnType<typeof setInterval> | null = null;
let _lastSaveTime = 0;

/**
 * Capture the current engine + store state into a serializable snapshot.
 * Called periodically by the auto-save timer.
 */
export function captureRecoveryState(
    engine: {
        symbol?: string;
        timeframe?: string;
        props?: { chartType?: string };
        state?: { scrollOffset?: number; visibleBars?: number; scaleMode?: string };
        indicators?: Array<{ type: string; params?: Record<string, unknown>; color?: string }>;
    },
    stores?: {
        uiStore?: { getState: () => { page?: string } };
        workspaceStore?: { getState: () => { activeId?: string; workspaces?: Array<{ id: string; name: string }> } };
    },
): RecoveryState {
    const indicators = (engine.indicators || []).map((ind) => {
        const entry: { type: string; params: Record<string, unknown>; color?: string } = {
            type: ind.type,
            params: { ...(ind.params || {}) },
        };
        if (ind.color != null) entry.color = ind.color;
        return entry;
    });

    // Resolve workspace name from active ID
    let workspaceName: string | null = null;
    if (stores?.workspaceStore) {
        const ws = stores.workspaceStore.getState();
        if (ws.activeId && ws.workspaces) {
            const active = ws.workspaces.find((w) => w.id === ws.activeId);
            if (active) workspaceName = active.name;
        }
    }

    return {
        savedAt: Date.now(),
        cleanExit: false,
        symbol: engine.symbol || '',
        timeframe: engine.timeframe || '1h',
        chartType: engine.props?.chartType || 'candles',
        scaleMode: engine.state?.scaleMode || 'linear',
        scrollOffset: engine.state?.scrollOffset || 0,
        visibleBars: engine.state?.visibleBars || 80,
        indicators,
        page: stores?.uiStore?.getState?.()?.page || 'charts',
        workspaceName,
    };
}

/**
 * Save recovery state to IndexedDB. Debounced by SAVE_INTERVAL_MS.
 * Safe to call frequently — it will skip if called too soon.
 */
export async function saveState(
    engine: Parameters<typeof captureRecoveryState>[0],
    stores?: Parameters<typeof captureRecoveryState>[1],
): Promise<void> {
    const now = Date.now();
    if (now - _lastSaveTime < SAVE_INTERVAL_MS) return;
    _lastSaveTime = now;

    const state = captureRecoveryState(engine, stores);
    await idbPut(state);
}

/**
 * Start the auto-save timer. Call once from the chart boot sequence.
 * Returns a cleanup function to stop the timer.
 */
export function startAutoSave(
    getEngine: () => Parameters<typeof captureRecoveryState>[0] | null,
    getStores?: () => Parameters<typeof captureRecoveryState>[1],
): () => void {
    // Clear any existing timer
    stopAutoSave();

    _saveTimer = setInterval(async () => {
        const engine = getEngine();
        if (!engine) return;
        const state = captureRecoveryState(engine, getStores?.());
        try {
            await idbPut(state);
        } catch { /* non-critical */ }
    }, SAVE_INTERVAL_MS);

    return stopAutoSave;
}

/**
 * Stop the auto-save timer.
 */
export function stopAutoSave(): void {
    if (_saveTimer) {
        clearInterval(_saveTimer);
        _saveTimer = null;
    }
}

/**
 * Check if a valid (non-stale, non-clean-exit) recovery state exists.
 * Call on app boot to decide whether to show the recovery toast.
 */
export async function hasRecoveryState(): Promise<boolean> {
    const state = await idbGet();
    if (!state) return false;
    if (state.cleanExit) return false;
    if (Date.now() - state.savedAt > MAX_STALENESS_MS) return false;
    return true;
}

/**
 * Get the recovery state (for restoring).
 * Returns null if no valid state exists.
 */
export async function getRecoveryState(): Promise<RecoveryState | null> {
    const state = await idbGet();
    if (!state) return null;
    if (state.cleanExit) return null;
    if (Date.now() - state.savedAt > MAX_STALENESS_MS) return null;
    return state;
}

/**
 * Mark the current session as cleanly exited.
 * Call from ChartEngine.destroy() or app unmount to prevent
 * false recovery prompts on next boot.
 */
export async function markCleanExit(): Promise<void> {
    try {
        const state = await idbGet();
        if (state) {
            state.cleanExit = true;
            await idbPut(state);
        }
    } catch {
        // Best effort — if IDB fails on unload, the recovery prompt is harmless
    }
}

/**
 * Clear the recovery state entirely.
 * Call after the user accepts or dismisses the recovery prompt.
 */
export async function clearRecoveryState(): Promise<void> {
    await idbDelete();
}

// ─── Default Export ──────────────────────────────────────────────

const SessionRecovery = {
    captureRecoveryState,
    saveState,
    startAutoSave,
    stopAutoSave,
    hasRecoveryState,
    getRecoveryState,
    markCleanExit,
    clearRecoveryState,
};

export default SessionRecovery;
