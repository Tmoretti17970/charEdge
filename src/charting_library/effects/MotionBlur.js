// ═══════════════════════════════════════════════════════════════════
// charEdge — MotionBlur
//
// Subtle motion blur during fast pan/scroll operations.
// Blends the current frame with the previous frame using a
// velocity-weighted alpha to create a sense of speed and fluidity.
//
// Only active when:
//   - |velocity| > threshold
//   - GPU tier >= 'mid'
//   - Explicitly enabled
//
// Lifecycle:
//   1. Before frame render: capture(currentCanvas) to snapshot
//   2. After frame render: apply(ctx, velocity) to blend
// ═══════════════════════════════════════════════════════════════════

/** Default configuration */
const DEFAULTS = {
  /** Minimum velocity (px/frame) to trigger motion blur */
  velocityThreshold: 3,
  /** Maximum blend factor (higher = more blur) */
  maxBlendFactor: 0.35,
  /** Velocity at which max blend is reached */
  velocityCap: 30,
};

/**
 * Motion blur effect for fast pan/scroll.
 */
export class MotionBlur {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.velocityThreshold] - Min velocity to trigger
   * @param {number} [opts.maxBlendFactor]    - Max blend opacity
   * @param {number} [opts.velocityCap]       - Velocity ceiling
   */
  constructor(opts = {}) {
    this._threshold = opts.velocityThreshold ?? DEFAULTS.velocityThreshold;
    this._maxBlend = opts.maxBlendFactor ?? DEFAULTS.maxBlendFactor;
    this._velocityCap = opts.velocityCap ?? DEFAULTS.velocityCap;

    /** @type {OffscreenCanvas|HTMLCanvasElement|null} */
    this._prevFrame = null;
    /** @type {CanvasRenderingContext2D|null} */
    this._prevCtx = null;
    this._width = 0;
    this._height = 0;

    /** Whether the effect is enabled */
    this._enabled = true;
    /** Whether a previous frame has been captured */
    this._hasPrevious = false;
  }

  /**
   * Enable or disable the motion blur effect.
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this._enabled = !!enabled;
    if (!this._enabled) {
      this._hasPrevious = false;
    }
  }

  /** @returns {boolean} */
  get enabled() {
    return this._enabled;
  }

  /**
   * Capture the current frame for use as the "previous frame" in the next blend.
   * Call this BEFORE the new frame is rendered.
   *
   * @param {HTMLCanvasElement|OffscreenCanvas} sourceCanvas
   */
  capture(sourceCanvas) {
    if (!this._enabled || !sourceCanvas) return;

    const w = sourceCanvas.width;
    const h = sourceCanvas.height;

    // Initialize or resize buffer
    if (!this._prevFrame || this._width !== w || this._height !== h) {
      this._initBuffer(w, h);
    }

    this._prevCtx.clearRect(0, 0, w, h);
    this._prevCtx.drawImage(sourceCanvas, 0, 0);
    this._hasPrevious = true;
  }

  /**
   * Apply motion blur by blending the previous frame onto the current context.
   * Blend strength is proportional to velocity.
   *
   * @param {CanvasRenderingContext2D} ctx - Current frame context
   * @param {number} velocity - Pan/scroll velocity in px/frame
   */
  apply(ctx, velocity) {
    if (!this._enabled || !this._hasPrevious || !this._prevFrame) return;

    const absVel = Math.abs(velocity);
    if (absVel < this._threshold) return;

    // Calculate blend factor: linear ramp from threshold to cap
    const t = Math.min(1, (absVel - this._threshold) / (this._velocityCap - this._threshold));
    const blendFactor = t * this._maxBlend;

    ctx.save();
    ctx.globalAlpha = blendFactor;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this._prevFrame, 0, 0);
    ctx.restore();
  }

  /**
   * Reset the motion blur state (e.g. on chart type change).
   */
  reset() {
    this._hasPrevious = false;
    if (this._prevCtx) {
      this._prevCtx.clearRect(0, 0, this._width, this._height);
    }
  }

  /**
   * Dispose all resources.
   */
  dispose() {
    this._prevFrame = null;
    this._prevCtx = null;
    this._hasPrevious = false;
    this._width = 0;
    this._height = 0;
  }

  /** @private */
  _initBuffer(w, h) {
    this._width = w;
    this._height = h;
    this._hasPrevious = false;

    try {
      this._prevFrame = new OffscreenCanvas(w, h);
    } catch {
      if (typeof document !== 'undefined') {
        this._prevFrame = document.createElement('canvas');
        this._prevFrame.width = w;
        this._prevFrame.height = h;
      } else {
        this._prevFrame = null;
        this._prevCtx = null;
        return;
      }
    }
    this._prevCtx = this._prevFrame.getContext('2d');
  }
}
