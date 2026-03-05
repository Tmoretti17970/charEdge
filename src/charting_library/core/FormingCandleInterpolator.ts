// ═══════════════════════════════════════════════════════════════════
// charEdge — FormingCandleInterpolator
//
// Smooth OHLC animation for the forming (live) candle.
// Exponential smoothing between current displayed state and the
// target OHLC from the latest tick, driven by the render loop.
//
// Usage:
//   const interp = new FormingCandleInterpolator();
//   // On tick: set new target
//   interp.setTarget({ open: 42000, high: 42050, low: 41950, close: 42010 });
//   // In render loop: advance animation
//   const { open, high, low, close, done } = interp.tick(dt);
// ═══════════════════════════════════════════════════════════════════

/** Minimal OHLC shape. */
export interface OHLC {
    open: number;
    high: number;
    low: number;
    close: number;
}

/** Result of an interpolation tick. */
export interface InterpolationResult extends OHLC {
    /** True when current values have converged to target (within epsilon). */
    done: boolean;
}

/**
 * Exponential smoothing interpolator for forming candle OHLC.
 *
 * Design:
 * - `alpha` controls snappiness: 0.3 = fast but smooth, 0.1 = very smooth
 * - `epsilon` defines convergence threshold in price units
 * - `tick(dt)` should be called once per render frame
 * - When no target is set, returns the last known values
 *
 * This replaces the ad-hoc `_animTarget`/`_animCurrent` logic
 * on ChartEngine with a dedicated, testable class.
 */
export class FormingCandleInterpolator {
    /** Smoothing factor. Higher = snappier. Range: (0, 1] */
    alpha: number;

    /** Convergence threshold in price units. */
    epsilon: number;

    /** Current interpolated values. */
    private _current: OHLC = { open: 0, high: 0, low: 0, close: 0 };

    /** Target values from latest tick. */
    private _target: OHLC = { open: 0, high: 0, low: 0, close: 0 };

    /** Whether we have a valid state. */
    private _initialized: boolean = false;

    /** Whether current === target (within epsilon). */
    private _done: boolean = true;

    /**
     * @param alpha Smoothing factor (0, 1]. Default 0.3 (snappy).
     * @param epsilon Convergence threshold. Default 0.001.
     */
    constructor(alpha: number = 0.3, epsilon: number = 0.001) {
        if (alpha <= 0 || alpha > 1) {
            throw new RangeError(`alpha must be in (0, 1], got ${alpha}`);
        }
        this.alpha = alpha;
        this.epsilon = epsilon;
    }

    /**
     * Set a new target OHLC from the latest tick.
     *
     * On the first call, snaps current = target (no animation).
     * On subsequent calls, starts interpolation toward the new target.
     */
    setTarget(ohlc: OHLC): void {
        this._target.open = ohlc.open;
        this._target.high = ohlc.high;
        this._target.low = ohlc.low;
        this._target.close = ohlc.close;

        if (!this._initialized) {
            // First data — snap immediately, no interpolation
            this._current.open = ohlc.open;
            this._current.high = ohlc.high;
            this._current.low = ohlc.low;
            this._current.close = ohlc.close;
            this._initialized = true;
            this._done = true;
        } else {
            this._done = false;
        }
    }

    /**
     * Snap current to target immediately. Use when:
     * - New bar starts (forming candle resets)
     * - Symbol changes
     * - User manually resets
     */
    snap(ohlc?: OHLC): void {
        if (ohlc) {
            this._target.open = ohlc.open;
            this._target.high = ohlc.high;
            this._target.low = ohlc.low;
            this._target.close = ohlc.close;
        }
        this._current.open = this._target.open;
        this._current.high = this._target.high;
        this._current.low = this._target.low;
        this._current.close = this._target.close;
        this._initialized = true;
        this._done = true;
    }

    /**
     * Advance the interpolation by one frame.
     *
     * Uses exponential smoothing:  current += alpha * (target - current)
     *
     * Note: High/low are special — they can only expand (never shrink)
     * during a forming candle, so we take the max/min respectively.
     *
     * @param _dt Delta time in ms (reserved for future frame-rate-independent smoothing)
     * @returns Interpolated OHLC + done flag
     */
    tick(_dt: number = 16.67): InterpolationResult {
        if (!this._initialized) {
            return { open: 0, high: 0, low: 0, close: 0, done: true };
        }

        if (this._done) {
            return {
                open: this._current.open,
                high: this._current.high,
                low: this._current.low,
                close: this._current.close,
                done: true,
            };
        }

        const a = this.alpha;

        // Exponential smoothing for open and close
        this._current.open += a * (this._target.open - this._current.open);
        this._current.close += a * (this._target.close - this._current.close);

        // High can only expand upward during a forming candle
        if (this._target.high > this._current.high) {
            this._current.high += a * (this._target.high - this._current.high);
        } else {
            this._current.high = this._target.high;
        }

        // Low can only expand downward during a forming candle
        if (this._target.low < this._current.low) {
            this._current.low += a * (this._target.low - this._current.low);
        } else {
            this._current.low = this._target.low;
        }

        // Check convergence
        const eps = this.epsilon;
        this._done =
            Math.abs(this._current.open - this._target.open) < eps &&
            Math.abs(this._current.high - this._target.high) < eps &&
            Math.abs(this._current.low - this._target.low) < eps &&
            Math.abs(this._current.close - this._target.close) < eps;

        if (this._done) {
            // Snap to exact target to avoid floating point drift
            this._current.open = this._target.open;
            this._current.high = this._target.high;
            this._current.low = this._target.low;
            this._current.close = this._target.close;
        }

        return {
            open: this._current.open,
            high: this._current.high,
            low: this._current.low,
            close: this._current.close,
            done: this._done,
        };
    }

    /** Whether the interpolator has been initialized with at least one target. */
    get initialized(): boolean {
        return this._initialized;
    }

    /** Whether current has converged to target. */
    get isDone(): boolean {
        return this._done;
    }

    /** Reset to uninitialized state. */
    reset(): void {
        this._initialized = false;
        this._done = true;
        this._current = { open: 0, high: 0, low: 0, close: 0 };
        this._target = { open: 0, high: 0, low: 0, close: 0 };
    }

    /** Get the current interpolated OHLC (read-only snapshot). */
    get current(): Readonly<OHLC> {
        return { ...this._current };
    }

    /** Get the target OHLC (read-only snapshot). */
    get target(): Readonly<OHLC> {
        return { ...this._target };
    }
}
