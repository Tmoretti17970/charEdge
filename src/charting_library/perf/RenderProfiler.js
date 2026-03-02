// ═══════════════════════════════════════════════════════════════════
// charEdge — RenderProfiler
//
// Per-frame performance waterfall recorder.
// Records CPU time per render stage, GPU timing (when available),
// draw call count, and buffer upload stats.
//
// Usage:
//   const profiler = new RenderProfiler();
//   profiler.beginFrame();
//   profiler.beginStage('grid');
//   // ... render grid ...
//   profiler.endStage('grid');
//   profiler.endFrame();
//   console.log(profiler.getSummary());
// ═══════════════════════════════════════════════════════════════════

/**
 * Per-frame performance waterfall recorder.
 * Tracks CPU stage timings, GPU queries, draw calls, and buffer uploads.
 */
export class RenderProfiler {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.maxFrames=300] - Ring buffer size (~5s at 60fps)
   * @param {boolean} [opts.gpuTiming=true] - Attempt GPU timing queries
   */
  constructor(opts = {}) {
    this._maxFrames = opts.maxFrames ?? 300;
    this._gpuTiming = opts.gpuTiming ?? true;

    /** @type {FrameRecord[]} */
    this._frames = [];
    this._cursor = 0;
    this._full = false;

    // Current frame state
    this._frameActive = false;
    this._currentFrame = null;
    this._stageStack = [];

    // GPU timing
    this._gl = null;
    this._timerExt = null;
    this._gpuQuery = null;
    this._pendingGPUFrames = [];

    // Counters (incremented externally via track* methods)
    this._drawCalls = 0;
    this._bufferUploads = 0;
    this._stateChanges = 0;
  }

  // ─── GPU Timing Setup ─────────────────────────────────────

  /**
   * Initialize GPU timing queries.
   * Call once after WebGL context is available.
   *
   * @param {WebGL2RenderingContext} gl
   * @returns {boolean} Whether GPU timing is supported
   */
  initGPUTiming(gl) {
    if (!gl || !this._gpuTiming) return false;

    this._gl = gl;
    this._timerExt = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    return !!this._timerExt;
  }

  /** @returns {boolean} */
  get gpuTimingAvailable() {
    return !!this._timerExt;
  }

  // ─── Frame Lifecycle ──────────────────────────────────────

  /**
   * Begin recording a new frame.
   */
  beginFrame() {
    this._frameActive = true;
    this._drawCalls = 0;
    this._bufferUploads = 0;
    this._stateChanges = 0;

    this._currentFrame = {
      timestamp: performance.now(),
      stages: {},
      totalMs: 0,
      drawCalls: 0,
      bufferUploads: 0,
      stateChanges: 0,
      gpuTimeMs: null,
    };

    // Begin GPU query if available
    if (this._timerExt && this._gl) {
      const gl = this._gl;
      this._gpuQuery = gl.createQuery();
      gl.beginQuery(this._timerExt.TIME_ELAPSED_EXT, this._gpuQuery);
    }
  }

  /**
   * Begin timing a named stage within the current frame.
   * @param {string} name - Stage name (e.g. 'grid', 'data', 'indicators')
   */
  beginStage(name) {
    if (!this._frameActive || !this._currentFrame) return;
    this._currentFrame.stages[name] = {
      startMs: performance.now(),
      durationMs: 0,
    };
    this._stageStack.push(name);
  }

  /**
   * End timing a named stage.
   * @param {string} name
   */
  endStage(name) {
    if (!this._frameActive || !this._currentFrame) return;
    const stage = this._currentFrame.stages[name];
    if (stage) {
      stage.durationMs = Math.round((performance.now() - stage.startMs) * 100) / 100;
    }
    const idx = this._stageStack.indexOf(name);
    if (idx >= 0) this._stageStack.splice(idx, 1);
  }

  /**
   * End the current frame and push it into the ring buffer.
   */
  endFrame() {
    if (!this._frameActive || !this._currentFrame) return;

    const frame = this._currentFrame;
    frame.totalMs = Math.round((performance.now() - frame.timestamp) * 100) / 100;
    frame.drawCalls = this._drawCalls;
    frame.bufferUploads = this._bufferUploads;
    frame.stateChanges = this._stateChanges;

    // End GPU query
    if (this._timerExt && this._gl && this._gpuQuery) {
      this._gl.endQuery(this._timerExt.TIME_ELAPSED_EXT);
      this._pendingGPUFrames.push({
        query: this._gpuQuery,
        frameIdx: this._cursor,
      });
      this._gpuQuery = null;
    }

    // Resolve any completed GPU queries
    this._resolveGPUQueries();

    // Push to ring buffer
    if (this._frames.length < this._maxFrames) {
      this._frames.push(frame);
    } else {
      this._frames[this._cursor] = frame;
      this._full = true;
    }
    this._cursor = (this._cursor + 1) % this._maxFrames;

    this._frameActive = false;
    this._currentFrame = null;
  }

  // ─── GPU Query Resolution ─────────────────────────────────

  /** @private */
  _resolveGPUQueries() {
    if (!this._gl || !this._timerExt) return;

    const gl = this._gl;
    const resolved = [];

    for (let i = 0; i < this._pendingGPUFrames.length; i++) {
      const pending = this._pendingGPUFrames[i];
      const available = gl.getQueryParameter(pending.query, gl.QUERY_RESULT_AVAILABLE);
      const disjoint = gl.getParameter(this._timerExt.GPU_DISJOINT_EXT);

      if (available && !disjoint) {
        const nsElapsed = gl.getQueryParameter(pending.query, gl.QUERY_RESULT);
        const msElapsed = nsElapsed / 1e6;

        // Update the frame record if still in buffer
        if (pending.frameIdx < this._frames.length) {
          this._frames[pending.frameIdx].gpuTimeMs = Math.round(msElapsed * 100) / 100;
        }

        gl.deleteQuery(pending.query);
        resolved.push(i);
      } else if (available && disjoint) {
        // Timing unreliable, discard
        gl.deleteQuery(pending.query);
        resolved.push(i);
      }
    }

    // Remove resolved queries (reverse order to maintain indices)
    for (let i = resolved.length - 1; i >= 0; i--) {
      this._pendingGPUFrames.splice(resolved[i], 1);
    }
  }

  // ─── Tracking Counters ────────────────────────────────────

  /** Track a draw call. */
  trackDrawCall() { this._drawCalls++; }

  /** Track a buffer upload. */
  trackBufferUpload() { this._bufferUploads++; }

  /** Track a GPU state change. */
  trackStateChange() { this._stateChanges++; }

  // ─── Queries ──────────────────────────────────────────────

  /**
   * Get the most recent frame record.
   * @returns {Object|null}
   */
  getLastFrame() {
    if (this._frames.length === 0) return null;
    const idx = (this._cursor - 1 + this._frames.length) % this._frames.length;
    return this._frames[idx];
  }

  /**
   * Get a summary across all buffered frames.
   * @returns {Object}
   */
  getSummary() {
    const frames = this._frames;
    if (frames.length === 0) {
      return {
        frameCount: 0,
        avgTotalMs: 0,
        maxTotalMs: 0,
        minTotalMs: 0,
        avgDrawCalls: 0,
        avgBufferUploads: 0,
        avgGpuMs: null,
        stageAvgs: {},
      };
    }

    let totalSum = 0, totalMax = 0, totalMin = Infinity;
    let drawCallSum = 0, bufferUploadSum = 0;
    let gpuSum = 0, gpuCount = 0;
    const stageAccum = {};
    const stageCounts = {};

    for (const f of frames) {
      totalSum += f.totalMs;
      if (f.totalMs > totalMax) totalMax = f.totalMs;
      if (f.totalMs < totalMin) totalMin = f.totalMs;
      drawCallSum += f.drawCalls;
      bufferUploadSum += f.bufferUploads;

      if (f.gpuTimeMs != null) {
        gpuSum += f.gpuTimeMs;
        gpuCount++;
      }

      for (const [name, stage] of Object.entries(f.stages)) {
        stageAccum[name] = (stageAccum[name] || 0) + stage.durationMs;
        stageCounts[name] = (stageCounts[name] || 0) + 1;
      }
    }

    const n = frames.length;
    const stageAvgs = {};
    for (const name of Object.keys(stageAccum)) {
      stageAvgs[name] = Math.round((stageAccum[name] / stageCounts[name]) * 100) / 100;
    }

    return {
      frameCount: n,
      avgTotalMs: Math.round((totalSum / n) * 100) / 100,
      maxTotalMs: Math.round(totalMax * 100) / 100,
      minTotalMs: Math.round(totalMin * 100) / 100,
      avgDrawCalls: Math.round(drawCallSum / n),
      avgBufferUploads: Math.round(bufferUploadSum / n),
      avgGpuMs: gpuCount > 0 ? Math.round((gpuSum / gpuCount) * 100) / 100 : null,
      stageAvgs,
    };
  }

  /**
   * Get all frame records in chronological order.
   * @returns {Object[]}
   */
  getFrames() {
    if (!this._full) return [...this._frames];
    // Ring buffer: reorder from cursor to end, then start to cursor
    return [
      ...this._frames.slice(this._cursor),
      ...this._frames.slice(0, this._cursor),
    ];
  }

  /**
   * Export all frame data as a JSON-serializable object.
   * @returns {Object}
   */
  exportJSON() {
    return {
      exportedAt: new Date().toISOString(),
      maxFrames: this._maxFrames,
      gpuTimingAvailable: this.gpuTimingAvailable,
      summary: this.getSummary(),
      frames: this.getFrames().map(f => ({
        timestamp: f.timestamp,
        totalMs: f.totalMs,
        drawCalls: f.drawCalls,
        bufferUploads: f.bufferUploads,
        stateChanges: f.stateChanges,
        gpuTimeMs: f.gpuTimeMs,
        stages: Object.fromEntries(
          Object.entries(f.stages).map(([k, v]) => [k, v.durationMs])
        ),
      })),
    };
  }

  // ─── Lifecycle ────────────────────────────────────────────

  /**
   * Reset all recorded data.
   */
  reset() {
    this._frames = [];
    this._cursor = 0;
    this._full = false;
    this._frameActive = false;
    this._currentFrame = null;
    this._stageStack = [];
    this._drawCalls = 0;
    this._bufferUploads = 0;
    this._stateChanges = 0;

    // Clean up pending GPU queries
    if (this._gl) {
      for (const p of this._pendingGPUFrames) {
        this._gl.deleteQuery(p.query);
      }
    }
    this._pendingGPUFrames = [];
  }

  /**
   * Dispose all resources.
   */
  dispose() {
    this.reset();
    this._gl = null;
    this._timerExt = null;
  }
}
