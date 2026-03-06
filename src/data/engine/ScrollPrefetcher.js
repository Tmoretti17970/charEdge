// ═══════════════════════════════════════════════════════════════════
// charEdge — Scroll Prefetcher (Task 2.10.3.1)
//
// Physics-based momentum prefetching for smooth scroll-back.
// Tracks scroll velocity (bars/ms) + acceleration, calculates
// lookahead via: Δ = v × (L+P) × 1.5
//
// Prefetches 2-3 pages via requestIdleCallback when cached bars
// fall below the momentum-based threshold.
// ═══════════════════════════════════════════════════════════════════

// @ts-nocheck — JS file with JSDoc types
import { logger } from '../../utils/logger.ts';

// ─── Constants ──────────────────────────────────────────────────

const VELOCITY_SMOOTHING = 0.3;     // Exponential smoothing factor
const LOOKAHEAD_MULTIPLIER = 1.5;   // Safety margin on momentum prediction
const MIN_PREFETCH_BARS = 200;      // Minimum bars to keep ahead of viewport
const MAX_PREFETCH_PAGES = 3;       // Max pages per prefetch cycle
const VELOCITY_HISTORY_SIZE = 10;   // Number of velocity samples to keep

// ─── ScrollPrefetcher ───────────────────────────────────────────

export class ScrollPrefetcher {
    constructor() {
        /** @type {number} Smoothed velocity (bars/ms) */
        this._velocity = 0;

        /** @type {number} Previous scroll position (bar index) */
        this._lastPosition = 0;

        /** @type {number} Timestamp of last position update */
        this._lastTime = 0;

        /** @type {number[]} Velocity history for acceleration calc */
        this._velocityHistory = [];

        /** @type {boolean} Whether a prefetch is currently in progress */
        this._prefetching = false;

        /** @type {Function|null} Callback to fetch data */
        this._fetchFn = null;

        /** @type {Function|null} Callback to write to OPFS */
        this._writeFn = null;

        /** @type {string} Current symbol */
        this._symbol = '';

        /** @type {string} Current timeframe */
        this._tfId = '';
    }

    // ─── Configuration ──────────────────────────────────────────

    /**
     * Set the data fetch function.
     * @param {(sym: string, tfId: string, fromMs: number, toMs: number) => Promise<Array|null>} fn
     */
    setFetchFn(fn) {
        this._fetchFn = fn;
    }

    /**
     * Set the OPFS/cache write function.
     * @param {(sym: string, interval: string, bars: Array) => Promise<void>} fn
     */
    setWriteFn(fn) {
        this._writeFn = fn;
    }

    /**
     * Set the active symbol and timeframe.
     */
    setContext(symbol, tfId) {
        if (this._symbol !== symbol || this._tfId !== tfId) {
            this._velocity = 0;
            this._velocityHistory = [];
            this._lastPosition = 0;
            this._lastTime = 0;
        }
        this._symbol = symbol;
        this._tfId = tfId;
    }

    // ─── Scroll Tracking ───────────────────────────────────────

    /**
     * Update the current scroll position. Call this on every viewport change.
     * @param {number} barIndex - Current leftmost visible bar index
     * @param {number} visibleBars - Number of visible bars (L)
     * @param {number} cachedBars - Total bars currently in cache/OPFS
     */
    onScroll(barIndex, visibleBars, cachedBars) {
        const now = performance.now();

        if (this._lastTime > 0) {
            const dt = now - this._lastTime;
            if (dt > 0) {
                const dx = this._lastPosition - barIndex; // Positive = scrolling left (back in time)
                const instantVelocity = dx / dt; // bars/ms

                // Exponential smoothing
                this._velocity =
                    VELOCITY_SMOOTHING * instantVelocity +
                    (1 - VELOCITY_SMOOTHING) * this._velocity;

                // Track velocity history for acceleration
                this._velocityHistory.push(this._velocity);
                if (this._velocityHistory.length > VELOCITY_HISTORY_SIZE) {
                    this._velocityHistory.shift();
                }
            }
        }

        this._lastPosition = barIndex;
        this._lastTime = now;

        // Calculate momentum-based lookahead
        // Δ = v × (L + P) × 1.5
        // where L = visible bars, P = prefetch buffer
        const prefetchBuffer = visibleBars * 2;
        const lookahead = Math.abs(this._velocity) * (visibleBars + prefetchBuffer) * LOOKAHEAD_MULTIPLIER;

        // Only prefetch when scrolling backward (into history) and cache is thin
        const isScrollingBack = this._velocity > 0;
        const needsPrefetch = isScrollingBack &&
            (cachedBars - barIndex) < Math.max(lookahead, MIN_PREFETCH_BARS);

        if (needsPrefetch && !this._prefetching) {
            this._triggerPrefetch(barIndex, visibleBars, cachedBars);
        }
    }

    /**
     * Get the current scroll velocity and acceleration.
     */
    getMetrics() {
        const acceleration = this._calculateAcceleration();
        return {
            velocity: this._velocity,
            acceleration,
            direction: this._velocity > 0 ? 'backward' : this._velocity < 0 ? 'forward' : 'idle',
            prefetching: this._prefetching,
        };
    }

    // ─── Internal ─────────────────────────────────────────────────

    /** @private */
    _calculateAcceleration() {
        if (this._velocityHistory.length < 2) return 0;
        const recent = this._velocityHistory.slice(-3);
        if (recent.length < 2) return 0;
        return (recent[recent.length - 1] - recent[0]) / recent.length;
    }

    /** @private */
    _triggerPrefetch(barIndex, visibleBars, cachedBars) {
        if (!this._fetchFn || this._prefetching) return;

        this._prefetching = true;

        // Use requestIdleCallback for non-blocking prefetch
        const doFetch = async () => {
            try {
                const pageBars = visibleBars * 2; // 2× viewport per page
                let fetched = 0;

                for (let page = 0; page < MAX_PREFETCH_PAGES; page++) {
                    // Calculate the time range to fetch (before current cache start)
                    // This is approximate — the actual mapper is in the consumer
                    const offsetBars = cachedBars + fetched + (page * pageBars);

                    const result = await this._fetchFn(
                        this._symbol,
                        this._tfId,
                        offsetBars,
                        pageBars
                    );

                    if (!result || result.length === 0) break;

                    // Write to OPFS if writer is set
                    if (this._writeFn) {
                        await this._writeFn(this._symbol, this._tfId, result);
                    }

                    fetched += result.length;

                    logger.data.info(
                        `[ScrollPrefetcher] Prefetched page ${page + 1}: ${result.length} bars for ${this._symbol}@${this._tfId}`
                    );
                }
            } catch (err) {
                logger.data.warn('[ScrollPrefetcher] Prefetch error:', err);
            } finally {
                this._prefetching = false;
            }
        };

        // Use requestIdleCallback if available, otherwise setTimeout
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(() => doFetch());
        } else {
            setTimeout(() => doFetch(), 0);
        }
    }

    /**
     * Reset state (e.g., on symbol change).
     */
    reset() {
        this._velocity = 0;
        this._velocityHistory = [];
        this._lastPosition = 0;
        this._lastTime = 0;
        this._prefetching = false;
    }
}

// Singleton instance
export const scrollPrefetcher = new ScrollPrefetcher();
export default scrollPrefetcher;
