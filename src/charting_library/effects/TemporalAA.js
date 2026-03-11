// ═══════════════════════════════════════════════════════════════════
// charEdge — TemporalAA
//
// Full temporal anti-aliasing with multi-frame accumulation buffer.
// Replaces the simple 2-frame blend in RenderQuality.applyTemporalAA
// with a configurable N-frame accumulation that produces print-quality
// output when the chart is stationary.
//
// Lifecycle:
//   1. After each frame render, call addFrame(canvas)
//   2. When compositing, call getAccumulated() for the blended result
//   3. On user interaction (pan/zoom), call reset() to restart
//   4. Check isConverged() to know when accumulation is complete
//
// GPU tier integration:
//   high → 8-frame accumulation with jitter
//   mid  → 4-frame simple blend
//   low  → disabled (pass-through)
// ═══════════════════════════════════════════════════════════════════

/** Default configuration by GPU tier */
const TIER_CONFIG = {
  high: { maxFrames: 8, jitter: true },
  mid:  { maxFrames: 4, jitter: false },
  low:  { maxFrames: 1, jitter: false },
};

/**
 * Halton sequence generator for quasi-random jitter offsets.
 * Produces well-distributed sub-pixel sample positions.
 *
 * @param {number} index - Sample index (1-based)
 * @param {number} base  - Prime base (2 for x, 3 for y)
 * @returns {number} Value in [0, 1)
 */
export function halton(index, base) {
  let result = 0;
  let f = 1 / base;
  let i = index;
  while (i > 0) {
    result += f * (i % base);
    i = Math.floor(i / base);
    f /= base;
  }
  return result;
}

/**
 * Generate a jitter offset for a given sample index.
 * Returns sub-pixel offset in [-0.5, 0.5) range.
 *
 * @param {number} sampleIndex - 0-based sample index
 * @returns {{ x: number, y: number }} Sub-pixel jitter offset
 */
export function getJitterOffset(sampleIndex) {
  return {
    x: halton(sampleIndex + 1, 2) - 0.5,
    y: halton(sampleIndex + 1, 3) - 0.5,
  };
}

/**
 * Temporal accumulation buffer for multi-frame anti-aliasing.
 */
export class TemporalAccumulator {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.maxFrames=8]   - Frames to accumulate
   * @param {boolean} [opts.jitter=true]  - Enable sub-pixel jitter sampling
   * @param {string} [opts.tier='high']   - GPU quality tier
   */
  constructor(opts = {}) {
    const tierCfg = TIER_CONFIG[opts.tier] || TIER_CONFIG.high;
    this._maxFrames = opts.maxFrames ?? tierCfg.maxFrames;
    this._jitter = opts.jitter ?? tierCfg.jitter;

    /** @type {OffscreenCanvas|HTMLCanvasElement|null} */
    this._accumCanvas = null;
    /** @type {CanvasRenderingContext2D|null} */
    this._accumCtx = null;

    /** Number of frames accumulated so far */
    this._frameCount = 0;

    /** Width/height of the accumulation buffer */
    this._width = 0;
    this._height = 0;
  }

  /**
   * Add a rendered frame to the accumulation buffer.
   * Each frame is blended with exponentially decreasing weight.
   *
   * @param {HTMLCanvasElement|OffscreenCanvas} sourceCanvas - The rendered frame
   */
  addFrame(sourceCanvas) {
    if (!sourceCanvas) return;

    const w = sourceCanvas.width;
    const h = sourceCanvas.height;

    // Initialize or resize accumulation buffer
    if (!this._accumCanvas || this._width !== w || this._height !== h) {
      this._initBuffer(w, h);
    }

    this._frameCount++;

    if (this._frameCount === 1) {
      // First frame: copy directly
      this._accumCtx.drawImage(sourceCanvas, 0, 0);
    } else {
      // Blend: weight = 1 / frameCount for equal-weight running average
      const weight = 1 / this._frameCount;
      this._accumCtx.save();
      this._accumCtx.globalAlpha = weight;
      this._accumCtx.globalCompositeOperation = 'source-over';
      this._accumCtx.drawImage(sourceCanvas, 0, 0);
      this._accumCtx.restore();
    }
  }

  /**
   * Get the accumulated (blended) result.
   *
   * @returns {HTMLCanvasElement|OffscreenCanvas|null}
   */
  getAccumulated() {
    return this._accumCanvas;
  }

  /**
   * Get the current jitter offset for this frame.
   * Returns zero offset if jitter is disabled or accumulation is converged.
   *
   * @returns {{ x: number, y: number }}
   */
  getJitter() {
    if (!this._jitter || this._frameCount >= this._maxFrames) {
      return { x: 0, y: 0 };
    }
    return getJitterOffset(this._frameCount);
  }

  /**
   * Check if accumulation has converged (reached max frames).
   *
   * @returns {boolean}
   */
  isConverged() {
    return this._frameCount >= this._maxFrames;
  }

  /**
   * Get the number of frames accumulated.
   *
   * @returns {number}
   */
  get frameCount() {
    return this._frameCount;
  }

  /**
   * Get the maximum number of frames to accumulate.
   *
   * @returns {number}
   */
  get maxFrames() {
    return this._maxFrames;
  }

  /**
   * Reset the accumulation buffer (e.g. on user interaction).
   */
  reset() {
    this._frameCount = 0;
    if (this._accumCtx) {
      this._accumCtx.clearRect(0, 0, this._width, this._height);
    }
  }

  /**
   * Dispose all resources.
   */
  dispose() {
    this._accumCanvas = null;
    this._accumCtx = null;
    this._frameCount = 0;
    this._width = 0;
    this._height = 0;
  }

  /** @private */
  _initBuffer(w, h) {
    this._width = w;
    this._height = h;
    this._frameCount = 0;

    try {
      this._accumCanvas = new OffscreenCanvas(w, h);
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      // Fallback for environments without OffscreenCanvas
      this._accumCanvas = document.createElement('canvas');
      this._accumCanvas.width = w;
      this._accumCanvas.height = h;
    }
    this._accumCtx = this._accumCanvas.getContext('2d');
  }
}
