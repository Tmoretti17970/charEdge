// ═══════════════════════════════════════════════════════════════════
// charEdge — MicroJankDetector
// Task 2.3.21: Production jank monitoring.
//
// Monitors render frame timings via performance.now(). When a frame
// exceeds the 16.67ms budget (60fps), emits a 'jank' event with the
// duration and frame count. Integrates with FrameBudget telemetry.
//
// Usage:
//   import { microJankDetector } from './MicroJankDetector.js';
//   microJankDetector.beginFrame();
//   // ... render ...
//   microJankDetector.endFrame();
//   microJankDetector.onJank((evt) => console.warn('Jank:', evt));
// ═══════════════════════════════════════════════════════════════════

const BUDGET_MS = 16.67; // 60fps frame budget

class MicroJankDetector {
    _frameStart = 0;
    _frameCount = 0;
    _jankCount = 0;
    _totalJankMs = 0;
    _listeners = [];
    _recentFrames = []; // circular buffer of last 60 frame times
    _bufferIdx = 0;

    constructor() {
        this._recentFrames = new Array(60).fill(0);
    }

    /** Mark the start of a render frame. */
    beginFrame() {
        this._frameStart = performance.now();
    }

    /** Mark the end of a render frame. Checks for budget overrun. */
    endFrame() {
        const elapsed = performance.now() - this._frameStart;
        this._frameCount++;

        // Circular buffer for p50/p95 calculation
        this._recentFrames[this._bufferIdx % 60] = elapsed;
        this._bufferIdx++;

        if (elapsed > BUDGET_MS) {
            this._jankCount++;
            this._totalJankMs += elapsed;

            const evt = {
                frameTime: elapsed,
                budget: BUDGET_MS,
                overshoot: elapsed - BUDGET_MS,
                frameNumber: this._frameCount,
                timestamp: performance.now(),
            };

            for (const cb of this._listeners) {
                try { cb(evt); } catch { /* listener error — ignore */ }
            }

            // Performance API integration
            try {
                performance.mark('jank-frame');
            } catch { /* ignore */ }
        }
    }

    /** Register a jank callback. Returns unsubscribe function. */
    onJank(callback) {
        this._listeners.push(callback);
        return () => {
            this._listeners = this._listeners.filter((cb) => cb !== callback);
        };
    }

    /** Get telemetry snapshot. */
    getStats() {
        const sorted = [...this._recentFrames].filter((v) => v > 0).sort((a, b) => a - b);
        const len = sorted.length;
        return {
            frameCount: this._frameCount,
            jankCount: this._jankCount,
            jankRate: this._frameCount > 0 ? (this._jankCount / this._frameCount * 100).toFixed(1) + '%' : '0%',
            avgJankMs: this._jankCount > 0 ? (this._totalJankMs / this._jankCount).toFixed(1) : 0,
            p50: len > 0 ? sorted[Math.floor(len * 0.5)]?.toFixed(1) : 0,
            p95: len > 0 ? sorted[Math.floor(len * 0.95)]?.toFixed(1) : 0,
        };
    }

    /** Reset counters. */
    reset() {
        this._frameCount = 0;
        this._jankCount = 0;
        this._totalJankMs = 0;
        this._recentFrames.fill(0);
        this._bufferIdx = 0;
    }
}

// Singleton export
export const microJankDetector = new MicroJankDetector();
export { MicroJankDetector };
