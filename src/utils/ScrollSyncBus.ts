// ═══════════════════════════════════════════════════════════════════
// charEdge — ScrollSyncBus
// Synchronizes scroll (pan) position between linked chart panes.
// Singleton — shared across all ChartEngineWidget instances.
// Uses the same link-group filtering as CrosshairBus.
// ═══════════════════════════════════════════════════════════════════

export interface ScrollData {
    /** Fractional scroll position: 0 = rightmost (latest), 1 = leftmost (oldest). */
    fraction: number;
    /** Number of visible bars at the time of scroll. */
    visibleBars: number;
}

export interface ScrollPayload extends ScrollData {
    sourcePaneId: string;
}

export type ScrollCallback = (data: ScrollPayload | null) => void;

/**
 * Lightweight event bus for scroll synchronization between chart panes.
 * When a user pans one chart, all linked charts scroll to the same
 * proportional position.
 */
class ScrollSyncBus {
    private _listeners: Map<string, ScrollCallback> = new Map();
    private _enabled: boolean = true;
    private _lastEmit: number = 0;
    private _pendingEmit: number | null = null;

    /**
     * Subscribe a pane to scroll sync events.
     * Returns an unsubscribe function.
     */
    subscribe(paneId: string, callback: ScrollCallback): () => void {
        this._listeners.set(paneId, callback);
        return () => this._listeners.delete(paneId);
    }

    /**
     * Emit scroll position from a source pane.
     * Debounced to ~60fps. Self-filtered (source pane won't receive).
     */
    emit(sourcePaneId: string, data: ScrollData): void {
        if (!this._enabled) return;
        // Task 2.3.26: Skip when <2 listeners — nothing to sync in single-pane mode
        if (this._listeners.size < 2) return;

        const now = performance.now();
        if (now - this._lastEmit < 16) {
            if (this._pendingEmit) cancelAnimationFrame(this._pendingEmit);
            this._pendingEmit = requestAnimationFrame(() => {
                this._broadcast(sourcePaneId, data);
                this._pendingEmit = null;
            });
            return;
        }

        this._lastEmit = now;
        this._broadcast(sourcePaneId, data);
    }

    /** Toggle scroll sync on/off globally. */
    setEnabled(enabled: boolean): void {
        this._enabled = enabled;
    }

    get enabled(): boolean {
        return this._enabled;
    }

    private _broadcast(sourcePaneId: string, data: ScrollData): void {
        const payload: ScrollPayload = { ...data, sourcePaneId };

        // Link-group-aware filtering (same approach as CrosshairBus)
        let sourceGroup: string | undefined;
        let linkStore: { links?: Record<string, string> } | undefined;
        try {
            const mod = require('../state/useChartLinkStore');
            linkStore = mod?.useChartLinkStore?.getState?.();
            sourceGroup = linkStore?.links?.[sourcePaneId];
        } catch (_) {
            // Link store not available — broadcast to all
        }

        for (const [paneId, cb] of this._listeners) {
            if (paneId === sourcePaneId) continue;

            if (sourceGroup && sourceGroup !== 'none' && linkStore?.links) {
                const paneGroup = linkStore.links[paneId];
                if (paneGroup && paneGroup !== sourceGroup) continue;
            }

            cb(payload);
        }
    }
}

// Singleton instance
const scrollSyncBus = new ScrollSyncBus();

export default scrollSyncBus;
export { ScrollSyncBus };
