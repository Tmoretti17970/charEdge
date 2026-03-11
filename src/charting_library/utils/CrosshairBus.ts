// ═══════════════════════════════════════════════════════════════════
// charEdge v10.1 — CrosshairBus (TypeScript)
// Sprint 5: Timestamp-based crosshair synchronization between panes.
// Phase 2: Converted to TypeScript.
// Phase 1.1: Added link-group-aware filtering.
// ═══════════════════════════════════════════════════════════════════

export interface CrosshairData {
    timestamp: number;
    price: number;
    mouseY?: number;
}

export interface CrosshairPayload extends CrosshairData {
    sourcePaneId: string;
}

export type CrosshairCallback = (data: CrosshairPayload | null) => void;

/**
 * Lightweight event bus for crosshair synchronization.
 * Singleton — shared across all ChartPane instances.
 */
class CrosshairBus {
    private _listeners: Map<string, CrosshairCallback>;
    private _lastEmit: number;
    private _pendingEmit: number | null;
    private _enabled: boolean;

    constructor() {
        this._listeners = new Map();
        this._lastEmit = 0;
        this._pendingEmit = null;
        this._enabled = true;
    }

    /**
     * Subscribe a pane to crosshair events.
     */
    subscribe(paneId: string, callback: CrosshairCallback): () => void {
        this._listeners.set(paneId, callback);
        return () => this._listeners.delete(paneId);
    }

    /**
     * Emit crosshair position from a source pane.
     * Debounced to ~60fps. Self-filtered (source pane won't receive).
     */
    emit(sourcePaneId: string, data: CrosshairData): void {
        if (!this._enabled) return;

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

    /**
     * Clear the crosshair on all panes (mouse left chart area).
     */
    clear(sourcePaneId: string): void {
        for (const [paneId, cb] of this._listeners) {
            if (paneId !== sourcePaneId) {
                cb(null);
            }
        }
    }

    /**
     * Toggle sync on/off globally.
     */
    setEnabled(enabled: boolean): void {
        this._enabled = enabled;
        if (!enabled) {
            for (const [, cb] of this._listeners) cb(null);
        }
    }

    get enabled(): boolean {
        return this._enabled;
    }

    /**
     * Tear down the bus — clears all listeners, cancels pending rAF,
     * and releases the link store module. Safe to call multiple times.
     */
    dispose(): void {
        this._listeners.clear();
        if (this._pendingEmit) {
            cancelAnimationFrame(this._pendingEmit);
            this._pendingEmit = null;
        }
        this._linkStoreMod = null;
        this._linkStoreLoading = false;
        this._enabled = false;
    }

    // Cached link store module — lazy-loaded to avoid circular imports
    private _linkStoreMod: unknown = null;
    private _linkStoreLoading: boolean = false;

    private _ensureLinkStore(): void {
        if (this._linkStoreMod || this._linkStoreLoading) return;
        this._linkStoreLoading = true;
        import('../../state/useChartLinkStore').then((mod) => {
            this._linkStoreMod = mod;
        }).catch(() => { /* Link store not available */ });
    }

    private _broadcast(sourcePaneId: string, data: CrosshairData): void {
        const payload: CrosshairPayload = { ...data, sourcePaneId };

        // Link-group-aware filtering: only sync within same group
        this._ensureLinkStore();
        let sourceGroup: string | undefined;
        let linkStore: { links?: Record<string, string> } | undefined;
        try {
            linkStore = this._linkStoreMod?.useChartLinkStore?.getState?.();
            sourceGroup = linkStore?.links?.[sourcePaneId];
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) {
            // Link store not available — broadcast to all (backwards compatible)
        }

        for (const [paneId, cb] of this._listeners) {
            if (paneId === sourcePaneId) continue;

            // If source has a link group (not 'none'), only sync within that group
            if (sourceGroup && sourceGroup !== 'none' && linkStore?.links) {
                const paneGroup = linkStore.links[paneId];
                if (paneGroup && paneGroup !== sourceGroup) continue;
            }

            cb(payload);
        }
    }
}

// Singleton instance
const crosshairBus = new CrosshairBus();

export default crosshairBus;
export { CrosshairBus };
