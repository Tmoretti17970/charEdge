// ═══════════════════════════════════════════════════════════════════
// charEdge v10.1 — CrosshairBus (TypeScript)
// Sprint 5: Timestamp-based crosshair synchronization between panes.
// Phase 2: Converted to TypeScript.
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

    private _broadcast(sourcePaneId: string, data: CrosshairData): void {
        const payload: CrosshairPayload = { ...data, sourcePaneId };
        for (const [paneId, cb] of this._listeners) {
            if (paneId !== sourcePaneId) {
                cb(payload);
            }
        }
    }
}

// Singleton instance
const crosshairBus = new CrosshairBus();

export default crosshairBus;
export { CrosshairBus };
