// ═══════════════════════════════════════════════════════════════════
// charEdge — PixelRatio (B3.1)
// Centralized devicePixelRatio singleton. Single source of truth
// replacing 17+ ad-hoc `window.devicePixelRatio` reads.
// ═══════════════════════════════════════════════════════════════════

type ChangeCallback = (ratio: number) => void;

const _listeners: ChangeCallback[] = [];
let _mql: MediaQueryList | null = null;
let _currentRatio = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

/**
 * Set up matchMedia listener for DPR changes (window drag between displays).
 * Called lazily on first `onChange` subscription.
 */
function _ensureListener(): void {
    if (_mql) return;
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const updateMql = (): void => {
        // Clean up old listener
        _mql?.removeEventListener?.('change', _onDprChange);

        // Create new MQL for current DPR
        _mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
        _mql.addEventListener('change', _onDprChange);
    };

    const _onDprChange = (): void => {
        const newRatio = window.devicePixelRatio || 1;
        if (newRatio !== _currentRatio) {
            _currentRatio = newRatio;
            for (const cb of _listeners) {
                try { cb(newRatio); } catch { /* ignore listener errors */ }
            }
        }
        // Re-create MQL for the new DPR value
        updateMql();
    };

    updateMql();
}

export const PixelRatio = {
    /** Current device pixel ratio. */
    get value(): number {
        return typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    },

    /**
     * Snap a CSS-pixel coordinate to the nearest physical pixel boundary.
     * Prevents blurry rendering of filled shapes.
     */
    snapToPixel(v: number): number {
        const pr = this.value;
        return Math.round(v * pr) / pr;
    },

    /**
     * Snap a line coordinate to a half-physical-pixel boundary.
     * Produces crisp 1px lines on HiDPI displays.
     */
    snapLineToPixel(v: number): number {
        const pr = this.value;
        return (Math.round(v * pr) + 0.5) / pr;
    },

    /**
     * Register a callback for DPR changes (e.g. dragging between displays).
     * Returns an unsubscribe function.
     */
    onChange(cb: ChangeCallback): () => void {
        _ensureListener();
        _listeners.push(cb);
        return () => {
            const idx = _listeners.indexOf(cb);
            if (idx >= 0) _listeners.splice(idx, 1);
        };
    },
};
