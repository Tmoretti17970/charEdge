// ═══════════════════════════════════════════════════════════════════
// charEdge v15 — Performance Monitor
//
// Real-time frame budget monitoring + adaptive quality control.
// Monitors main thread frame timing and automatically degrades
// non-essential computations when the browser is under pressure.
//
// Features:
//   • Frame timing via rAF loop
//   • Jank detection (frames > 16.6ms)
//   • Adaptive quality levels: ultra → high → normal → low → minimal
//   • Auto-downgrade when jank rate exceeds threshold
//   • Auto-upgrade when smooth for sustained period
//   • Exposes quality level for engines to throttle themselves
//
// Usage:
//   import { performanceMonitor } from './PerformanceMonitor.js';
//   performanceMonitor.start();
//   const quality = performanceMonitor.getQualityLevel();
//   performanceMonitor.onQualityChange(level => { ... });
// ═══════════════════════════════════════════════════════════════════

import { CircularBuffer } from '../streaming/StreamingMetrics.js';
// ─── Quality Levels ────────────────────────────────────────────

const QUALITY_LEVELS = {
  ultra:   { level: 4, label: 'Ultra',   maxEngines: Infinity, tickThrottle: 0,    updateHz: 60 },
  high:    { level: 3, label: 'High',    maxEngines: 6,        tickThrottle: 0,    updateHz: 30 },
  normal:  { level: 2, label: 'Normal',  maxEngines: 4,        tickThrottle: 50,   updateHz: 20 },
  low:     { level: 1, label: 'Low',     maxEngines: 3,        tickThrottle: 100,  updateHz: 10 },
  minimal: { level: 0, label: 'Minimal', maxEngines: 2,        tickThrottle: 250,  updateHz: 5  },
};

// ─── Config ────────────────────────────────────────────────────

const FRAME_BUDGET_MS = 16.67;       // 60fps target
const JANK_THRESHOLD_MS = 25;        // Frame is janky if > 25ms
const SAMPLE_WINDOW = 120;           // Analyze last 120 frames (~2 sec)
const JANK_RATE_DOWNGRADE = 0.15;    // Downgrade if >15% of frames are janky
const JANK_RATE_UPGRADE = 0.03;      // Upgrade if <3% of frames are janky
const SMOOTH_FRAMES_FOR_UPGRADE = 300; // Need 300 smooth frames (~5 sec) to upgrade
const MIN_LEVEL = 'minimal';
const MAX_LEVEL = 'ultra';

// ─── Performance Monitor ───────────────────────────────────────

class _PerformanceMonitor {
  constructor() {
    this._isRunning = false;
    this._rafId = null;
    this._lastFrame = 0;
    this._frameTimes = new CircularBuffer(SAMPLE_WINDOW); // Rolling window of frame durations
    this._currentLevel = 'high';     // Start at high, not ultra (conservative)
    this._smoothStreak = 0;          // Consecutive smooth frames
    this._callbacks = new Set();     // Quality change listeners
    this._stats = {
      fps: 0,
      avgFrameTime: 0,
      jankRate: 0,
      totalJanks: 0,
      totalFrames: 0,
      levelChanges: 0,
    };
  }

  // ─── Public API ──────────────────────────────────────────────

  /**
   * Start frame budget monitoring.
   */
  start() {
    if (this._isRunning) return;
    this._isRunning = true;
    this._lastFrame = performance.now();
    this._tick();
  }

  /**
   * Stop monitoring.
   */
  stop() {
    this._isRunning = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /**
   * Get current quality level name.
   * @returns {string} 'ultra', 'high', 'normal', 'low', 'minimal'
   */
  getQualityLevel() {
    return this._currentLevel;
  }

  /**
   * Get the quality config for current level.
   * Engines should read this to decide how much work to do.
   *
   * @returns {{ level, label, maxEngines, tickThrottle, updateHz }}
   */
  getQualityConfig() {
    return QUALITY_LEVELS[this._currentLevel] || QUALITY_LEVELS.normal;
  }

  /**
   * Subscribe to quality level changes.
   *
   * @param {Function} callback - (level, config) => void
   * @returns {Function} unsubscribe
   */
  onQualityChange(callback) {
    this._callbacks.add(callback);
    return () => this._callbacks.delete(callback);
  }

  /**
   * Force a specific quality level (overrides auto).
   *
   * @param {string} level
   */
  forceLevel(level) {
    if (QUALITY_LEVELS[level]) {
      this._setLevel(level);
    }
  }

  /**
   * Get performance statistics.
   */
  getStats() {
    return {
      ...this._stats,
      currentLevel: this._currentLevel,
      currentConfig: this.getQualityConfig(),
      isRunning: this._isRunning,
    };
  }

  /**
   * Dispose.
   */
  dispose() {
    this.stop();
    this._callbacks.clear();
    this._frameTimes = new CircularBuffer(SAMPLE_WINDOW);
  }

  // ─── Private Methods ─────────────────────────────────────────

  /** @private — rAF loop */
  _tick() {
    if (!this._isRunning) return;

    this._rafId = requestAnimationFrame((now) => {
      const delta = now - this._lastFrame;
      this._lastFrame = now;

      // Record frame time
      this._frameTimes.push(delta);

      this._stats.totalFrames++;

      // Classify frame
      if (delta > JANK_THRESHOLD_MS) {
        this._stats.totalJanks++;
        this._smoothStreak = 0;
      } else {
        this._smoothStreak++;
      }

      // Analyze every 30 frames (~500ms)
      if (this._stats.totalFrames % 30 === 0) {
        this._analyze();
      }

      this._tick();
    });
  }

  /** @private — Analyze recent frames and adjust quality */
  _analyze() {
    if (this._frameTimes.length < 30) return;

    // Compute stats from CircularBuffer
    let sum = 0;
    let jankCount = 0;
    const count = this._frameTimes.length;
    this._frameTimes.forEach(t => {
      sum += t;
      if (t > JANK_THRESHOLD_MS) jankCount++;
    });
    const avg = sum / count;
    const jankRate = jankCount / count;

    this._stats.fps = Math.round(1000 / avg);
    this._stats.avgFrameTime = Math.round(avg * 10) / 10;
    this._stats.jankRate = Math.round(jankRate * 1000) / 10; // As percentage

    const levels = Object.keys(QUALITY_LEVELS);
    const currentIdx = levels.indexOf(this._currentLevel);

    // Downgrade if too janky
    if (jankRate > JANK_RATE_DOWNGRADE && currentIdx > 0) {
      this._setLevel(levels[currentIdx - 1]);
      this._smoothStreak = 0;
    }
    // Upgrade if smooth for sustained period
    else if (jankRate < JANK_RATE_UPGRADE && this._smoothStreak > SMOOTH_FRAMES_FOR_UPGRADE && currentIdx < levels.length - 1) {
      this._setLevel(levels[currentIdx + 1]);
      this._smoothStreak = 0;
    }
  }

  /** @private */
  _setLevel(level) {
    if (level === this._currentLevel) return;

    const prevLevel = this._currentLevel;
    this._currentLevel = level;
    this._stats.levelChanges++;

    const config = QUALITY_LEVELS[level];
    console.log(`[PerfMonitor] Quality: ${prevLevel} → ${level} (FPS: ${this._stats.fps}, Jank: ${this._stats.jankRate}%)`);

    for (const cb of this._callbacks) {
      try { cb(level, config); } catch { /* ignore */ }
    }
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const performanceMonitor = new _PerformanceMonitor();
export default performanceMonitor;
