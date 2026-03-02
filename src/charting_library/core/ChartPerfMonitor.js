// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Performance Monitor (Phase 5 Enhanced)
// Tracks rendering FPS, frame budget, GPU timing, per-stage timing,
// memory usage, and provides optimization hints.
// ═══════════════════════════════════════════════════════════════════

/**
 * High-performance chart rendering monitor.
 * Measures real-time FPS, jank, GPU timing, per-stage timing,
 * memory stats, and provides diagnostics.
 */
export class ChartPerfMonitor {
  constructor() {
    this.frames = [];
    this.fps = 60;
    this.jankCount = 0;
    this.avgFrameTime = 0;
    this.isRunning = false;
    this._rafId = null;
    this._lastTime = 0;
    this._frameTimeBudget = 16.67; // 60fps target
    this.metrics = {
      drawCalls: 0,
      canvasOps: 0,
      indicatorComputeMs: 0,
      drawingRenderMs: 0,
      gridRenderMs: 0,
    };
    this._history = []; // FPS history for sparkline

    // ─── Phase 5: GPU Timing ──────────────────────────────────
    this._gl = null;
    this._timerExt = null;
    this._gpuQuery = null;
    this._gpuTimeMs = null;
    this._gpuTimingSupported = false;

    // ─── Phase 5: Per-Stage Timing ────────────────────────────
    this.stageTimings = {};
    this._stageStarts = {};

    // ─── Phase 5: Memory Tracking ─────────────────────────────
    this._bufferAllocations = 0;
    this._textureMemoryBytes = 0;
    this._canvasMemoryBytes = 0;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this._lastTime = performance.now();
    this._tick();
  }

  stop() {
    this.isRunning = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }

  _tick() {
    if (!this.isRunning) return;
    const now = performance.now();
    const dt = now - this._lastTime;
    this._lastTime = now;

    this.frames.push(dt);
    if (this.frames.length > 120) this.frames.shift();

    // Calculate FPS
    if (this.frames.length >= 10) {
      const avg = this.frames.reduce((s, f) => s + f, 0) / this.frames.length;
      this.fps = Math.round(1000 / avg);
      this.avgFrameTime = Math.round(avg * 100) / 100;

      // Detect jank (frames > 33ms = below 30fps)
      if (dt > 33) this.jankCount++;
    }

    // Record history
    this._history.push(this.fps);
    if (this._history.length > 300) this._history.shift(); // 5 min at 1/s

    // Resolve any pending GPU timing queries
    this._resolveGPUQuery();

    this._rafId = requestAnimationFrame(() => this._tick());
  }

  trackRender(category, ms) {
    if (this.metrics[category] != null) {
      this.metrics[category] = ms;
    }
  }

  // ─── Phase 5: GPU Timing ──────────────────────────────────

  /**
   * Initialize GPU timing queries.
   * @param {WebGL2RenderingContext} gl
   * @returns {boolean} Whether GPU timing is supported
   */
  initGPUTiming(gl) {
    if (!gl) return false;
    this._gl = gl;
    this._timerExt = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this._gpuTimingSupported = !!this._timerExt;
    return this._gpuTimingSupported;
  }

  /** @returns {boolean} */
  get gpuTimingSupported() {
    return this._gpuTimingSupported;
  }

  /**
   * Begin a GPU timing query for the current frame.
   * Call before rendering starts.
   */
  beginGPUQuery() {
    if (!this._timerExt || !this._gl) return;
    const gl = this._gl;
    this._gpuQuery = gl.createQuery();
    gl.beginQuery(this._timerExt.TIME_ELAPSED_EXT, this._gpuQuery);
  }

  /**
   * End the current GPU timing query.
   * Call after rendering completes.
   */
  endGPUQuery() {
    if (!this._timerExt || !this._gl || !this._gpuQuery) return;
    this._gl.endQuery(this._timerExt.TIME_ELAPSED_EXT);
  }

  /**
   * Read the most recent GPU timing result.
   * @returns {number|null} GPU time in milliseconds, or null if not available
   */
  readGPUTime() {
    this._resolveGPUQuery();
    return this._gpuTimeMs;
  }

  /** @private */
  _resolveGPUQuery() {
    if (!this._gl || !this._timerExt || !this._gpuQuery) return;
    const gl = this._gl;
    const available = gl.getQueryParameter(this._gpuQuery, gl.QUERY_RESULT_AVAILABLE);
    const disjoint = gl.getParameter(this._timerExt.GPU_DISJOINT_EXT);

    if (available && !disjoint) {
      const ns = gl.getQueryParameter(this._gpuQuery, gl.QUERY_RESULT);
      this._gpuTimeMs = Math.round((ns / 1e6) * 100) / 100;
      gl.deleteQuery(this._gpuQuery);
      this._gpuQuery = null;
    } else if (available && disjoint) {
      // Unreliable timing, discard
      gl.deleteQuery(this._gpuQuery);
      this._gpuQuery = null;
    }
  }

  // ─── Phase 5: Per-Stage Timing ────────────────────────────

  /**
   * Begin timing a render stage.
   * @param {string} stageName
   */
  beginStage(stageName) {
    this._stageStarts[stageName] = performance.now();
  }

  /**
   * End timing a render stage.
   * @param {string} stageName
   */
  endStage(stageName) {
    if (this._stageStarts[stageName] != null) {
      this.stageTimings[stageName] = Math.round(
        (performance.now() - this._stageStarts[stageName]) * 100
      ) / 100;
      delete this._stageStarts[stageName];
    }
  }

  /**
   * Get the per-stage timing map.
   * @returns {Object<string, number>} Stage name → duration in ms
   */
  getStageTimings() {
    return { ...this.stageTimings };
  }

  // ─── Phase 5: Memory Tracking ─────────────────────────────

  /**
   * Track a buffer allocation.
   * @param {number} bytes - Size in bytes
   */
  trackBufferAllocation(bytes) {
    this._bufferAllocations += bytes;
  }

  /**
   * Track texture memory usage.
   * @param {number} bytes - Size in bytes
   */
  trackTextureMemory(bytes) {
    this._textureMemoryBytes = bytes;
  }

  /**
   * Track canvas memory usage.
   * @param {number} bytes - Size in bytes
   */
  trackCanvasMemory(bytes) {
    this._canvasMemoryBytes = bytes;
  }

  /**
   * Get current memory stats.
   * Uses performance.memory (Chrome) where available, plus tracked allocations.
   * @returns {Object}
   */
  getMemoryStats() {
    const stats = {
      bufferAllocations: this._bufferAllocations,
      textureMemoryBytes: this._textureMemoryBytes,
      canvasMemoryBytes: this._canvasMemoryBytes,
      jsHeapSizeLimit: null,
      totalJSHeapSize: null,
      usedJSHeapSize: null,
    };

    // Chrome-only: performance.memory
    if (typeof performance !== 'undefined' && performance.memory) {
      stats.jsHeapSizeLimit = performance.memory.jsHeapSizeLimit;
      stats.totalJSHeapSize = performance.memory.totalJSHeapSize;
      stats.usedJSHeapSize = performance.memory.usedJSHeapSize;
    }

    return stats;
  }

  // ─── Original API (backward compatible) ───────────────────

  /**
   * Get optimization suggestions based on current metrics.
   * @returns {Object[]} Array of { severity, message, fix }
   */
  getDiagnostics() {
    const issues = [];

    if (this.fps < 30) {
      issues.push({
        severity: 'critical',
        message: `FPS very low (${this.fps})`,
        fix: 'Reduce indicator count, disable smooth scrolling, or switch to lower bar count',
      });
    } else if (this.fps < 45) {
      issues.push({
        severity: 'warning',
        message: `FPS below target (${this.fps}/60)`,
        fix: 'Consider disabling volume profile or reducing visible indicators',
      });
    }

    if (this.jankCount > 10) {
      issues.push({
        severity: 'warning',
        message: `${this.jankCount} jank frames detected`,
        fix: 'Heavy computation may be blocking the main thread',
      });
    }

    if (this.metrics.indicatorComputeMs > 10) {
      issues.push({
        severity: 'info',
        message: `Indicator computation: ${this.metrics.indicatorComputeMs}ms`,
        fix: 'Move heavy indicators to Web Worker',
      });
    }

    if (this.metrics.drawingRenderMs > 5) {
      issues.push({
        severity: 'info',
        message: `Drawing render: ${this.metrics.drawingRenderMs}ms`,
        fix: 'Batch draw calls or simplify complex drawings',
      });
    }

    // Phase 5: GPU timing diagnostics
    if (this._gpuTimeMs != null && this._gpuTimeMs > 8) {
      issues.push({
        severity: 'warning',
        message: `GPU time high (${this._gpuTimeMs}ms)`,
        fix: 'Reduce shader complexity or visible draw calls',
      });
    }

    return issues;
  }

  getReport() {
    return {
      fps: this.fps,
      avgFrameTime: this.avgFrameTime,
      jankCount: this.jankCount,
      totalFrames: this.frames.length,
      metrics: { ...this.metrics },
      fpsHistory: [...this._history],
      diagnostics: this.getDiagnostics(),
      // Phase 5 additions
      gpuTimeMs: this._gpuTimeMs,
      stageTimings: this.getStageTimings(),
      memory: this.getMemoryStats(),
    };
  }

  reset() {
    this.frames = [];
    this.jankCount = 0;
    this._history = [];
    this.metrics = { drawCalls: 0, canvasOps: 0, indicatorComputeMs: 0, drawingRenderMs: 0, gridRenderMs: 0 };
    // Phase 5 resets
    this._gpuTimeMs = null;
    this.stageTimings = {};
    this._stageStarts = {};
    this._bufferAllocations = 0;
    this._textureMemoryBytes = 0;
    this._canvasMemoryBytes = 0;
  }
}

/**
 * Chart render budget tracker — ensures each frame fits within 16.67ms.
 */
export class RenderBudget {
  constructor(targetFps = 60) {
    this.budget = 1000 / targetFps;
    this.phases = {};
    this._frameStart = 0;
  }

  startFrame() { this._frameStart = performance.now(); this.phases = {}; }

  startPhase(name) { this.phases[name] = { start: performance.now() }; }

  endPhase(name) {
    if (this.phases[name]) {
      this.phases[name].duration = performance.now() - this.phases[name].start;
    }
  }

  endFrame() {
    const total = performance.now() - this._frameStart;
    return {
      totalMs: Math.round(total * 100) / 100,
      withinBudget: total <= this.budget,
      remainingMs: Math.round((this.budget - total) * 100) / 100,
      phases: Object.fromEntries(
        Object.entries(this.phases).map(([k, v]) => [k, Math.round((v.duration || 0) * 100) / 100])
      ),
    };
  }
}
