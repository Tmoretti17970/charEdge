// ═══════════════════════════════════════════════════════════════════
// charEdge — Market Replay Controller
//
// Phase 7 Task 7.1.5: Replay historical market data at variable
// speed. Supports play, pause, step, and speed control.
//
// Usage:
//   const replay = new MarketReplay(bars, { speed: 2 });
//   replay.onTick = (bar, index) => chart.updateBar(bar);
//   replay.play();
// ═══════════════════════════════════════════════════════════════════

/**
 * Market replay engine that plays back historical data.
 */
export class MarketReplay {
    /**
     * @param {Array<Object>} bars - Historical OHLCV bars
     * @param {Object} [options]
     * @param {number} [options.speed=1] - Playback speed multiplier
     * @param {number} [options.intervalMs=1000] - Base interval between ticks
     */
    constructor(bars = [], options = {}) {
        this.bars = bars;
        this.speed = options.speed || 1;
        this.intervalMs = options.intervalMs || 1000;
        this.currentIndex = 0;
        this.isPlaying = false;
        this._timer = null;

        /** @type {((bar: Object, index: number) => void) | null} */
        this.onTick = null;
        /** @type {(() => void) | null} */
        this.onComplete = null;
        /** @type {((state: Object) => void) | null} */
        this.onStateChange = null;
    }

    /**
     * Start or resume playback.
     */
    play() {
        if (this.isPlaying) return;
        if (this.currentIndex >= this.bars.length) {
            this.currentIndex = 0;
        }
        this.isPlaying = true;
        this._emitState();
        this._scheduleNext();
    }

    /**
     * Pause playback.
     */
    pause() {
        this.isPlaying = false;
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
        this._emitState();
    }

    /**
     * Advance by one bar.
     */
    step() {
        this.pause();
        if (this.currentIndex < this.bars.length) {
            this._tick();
        }
    }

    /**
     * Seek to a specific index.
     * @param {number} index
     */
    seekTo(index) {
        this.currentIndex = Math.max(0, Math.min(index, this.bars.length - 1));
        this._emitState();
    }

    /**
     * Set playback speed.
     * @param {number} multiplier - 0.25, 0.5, 1, 2, 5, 10
     */
    setSpeed(multiplier) {
        this.speed = Math.max(0.1, Math.min(multiplier, 100));
        if (this.isPlaying) {
            // Restart timer with new interval
            if (this._timer) clearTimeout(this._timer);
            this._scheduleNext();
        }
        this._emitState();
    }

    /**
     * Stop and reset.
     */
    reset() {
        this.pause();
        this.currentIndex = 0;
        this._emitState();
    }

    /**
     * Get playback progress (0-1).
     */
    get progress() {
        return this.bars.length > 0 ? this.currentIndex / this.bars.length : 0;
    }

    /**
     * Get current state summary.
     */
    get state() {
        return {
            isPlaying: this.isPlaying,
            currentIndex: this.currentIndex,
            totalBars: this.bars.length,
            progress: this.progress,
            speed: this.speed,
            currentBar: this.bars[this.currentIndex] || null,
        };
    }

    // ─── Internal ─────────────────────────────────────────────────

    _tick() {
        const bar = this.bars[this.currentIndex];
        if (bar && this.onTick) {
            this.onTick(bar, this.currentIndex);
        }
        this.currentIndex++;

        if (this.currentIndex >= this.bars.length) {
            this.isPlaying = false;
            if (this.onComplete) this.onComplete();
        }

        this._emitState();
    }

    _scheduleNext() {
        if (!this.isPlaying || this.currentIndex >= this.bars.length) return;
        const delay = this.intervalMs / this.speed;
        this._timer = setTimeout(() => {
            this._tick();
            this._scheduleNext();
        }, delay);
    }

    _emitState() {
        if (this.onStateChange) this.onStateChange(this.state);
    }

    /**
     * Cleanup.
     */
    dispose() {
        this.pause();
        this.onTick = null;
        this.onComplete = null;
        this.onStateChange = null;
        this.bars = [];
    }
}

export default MarketReplay;
