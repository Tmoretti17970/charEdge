// ═══════════════════════════════════════════════════════════════════
// charEdge — Bloom
//
// Subtle glow effect for the live price line and pulsing dot.
// Uses a downsampled offscreen canvas with Gaussian blur to
// creates a luminous halo around designated "glow regions".
//
// Technique:
//   1. Render glow source regions to a 4× downsampled canvas
//   2. Apply iterative box blur (approximates Gaussian)
//   3. Composite back via 'lighter' blend mode
//
// GPU tier:
//   high → full bloom with 3-pass blur
//   mid  → single-pass bloom at 8× downsample
//   low  → disabled
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} GlowRegion
 * @property {number} x      - Center X in CSS pixels
 * @property {number} y      - Center Y in CSS pixels
 * @property {number} radius - Glow radius in CSS pixels
 * @property {string} color  - CSS color for the glow
 * @property {number} [intensity=1] - Glow brightness 0-1
 */

/**
 * Bloom / glow effect renderer.
 */
export class Bloom {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.downsample=4]  - Downsample factor for blur canvas
   * @param {number} [opts.blurPasses=3]  - Number of box-blur iterations
   * @param {number} [opts.intensity=0.6] - Global bloom intensity 0-1
   */
  constructor(opts = {}) {
    this._downsample = opts.downsample ?? 4;
    this._blurPasses = opts.blurPasses ?? 3;
    this._intensity = opts.intensity ?? 0.6;

    /** @type {OffscreenCanvas|HTMLCanvasElement|null} */
    this._blurCanvas = null;
    /** @type {CanvasRenderingContext2D|null} */
    this._blurCtx = null;
    this._width = 0;
    this._height = 0;
  }

  /**
   * Set the global bloom intensity.
   * @param {number} v - 0 (off) to 1 (full)
   */
  setIntensity(v) {
    this._intensity = Math.max(0, Math.min(1, v));
  }

  /** @returns {number} */
  get intensity() {
    return this._intensity;
  }

  /**
   * Render bloom glow and composite it onto the target context.
   *
   * @param {CanvasRenderingContext2D} ctx - Target context to composite onto
   * @param {HTMLCanvasElement|OffscreenCanvas} _sourceCanvas - (unused, reserved for GPU path)
   * @param {GlowRegion[]} glowRegions - Regions to apply glow effect
   */
  render(ctx, _sourceCanvas, glowRegions) {
    if (this._intensity <= 0 || !glowRegions || glowRegions.length === 0) return;

    const fullW = ctx.canvas.width;
    const fullH = ctx.canvas.height;

    // Initialize or resize blur canvas
    const blurW = Math.ceil(fullW / this._downsample);
    const blurH = Math.ceil(fullH / this._downsample);

    if (!this._blurCanvas || this._width !== blurW || this._height !== blurH) {
      this._initBuffer(blurW, blurH);
    }

    const bCtx = this._blurCtx;
    if (!bCtx) return;

    // Clear blur canvas
    bCtx.clearRect(0, 0, blurW, blurH);

    // Draw glow sources on downsampled canvas
    const scale = 1 / this._downsample;
    bCtx.save();

    for (const region of glowRegions) {
      const intensity = region.intensity ?? 1;
      const r = (region.radius * scale) || 4;

      // Radial gradient glow
      const cx = region.x * scale;
      const cy = region.y * scale;

      const gradient = bCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
      gradient.addColorStop(0, region.color);
      gradient.addColorStop(1, 'transparent');

      bCtx.globalAlpha = intensity;
      bCtx.fillStyle = gradient;
      bCtx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    bCtx.restore();

    // Apply iterative box blur (approximates Gaussian blur)
    this._applyBoxBlur(bCtx, blurW, blurH, this._blurPasses);

    // Composite bloom back onto target at full size
    ctx.save();
    ctx.globalAlpha = this._intensity;
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this._blurCanvas, 0, 0, blurW, blurH, 0, 0, fullW, fullH);
    ctx.restore();
  }

  /**
   * Dispose all resources.
   */
  dispose() {
    this._blurCanvas = null;
    this._blurCtx = null;
    this._width = 0;
    this._height = 0;
  }

  /** @private */
  _initBuffer(w, h) {
    this._width = w;
    this._height = h;

    try {
      this._blurCanvas = new OffscreenCanvas(w, h);
    } catch {
      if (typeof document !== 'undefined') {
        this._blurCanvas = document.createElement('canvas');
        this._blurCanvas.width = w;
        this._blurCanvas.height = h;
      } else {
        this._blurCanvas = null;
        this._blurCtx = null;
        return;
      }
    }
    this._blurCtx = this._blurCanvas.getContext('2d');
  }

  /**
   * Multi-pass box blur using the "stack blur" approximation.
   * Each pass blurs horizontally then vertically by re-drawing
   * the canvas at a slight offset with reduced alpha.
   *
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   * @param {number} passes
   */
  _applyBoxBlur(ctx, w, h, passes) {
    for (let i = 0; i < passes; i++) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.globalCompositeOperation = 'source-over';

      // Horizontal spread
      ctx.drawImage(ctx.canvas, -1, 0);
      ctx.drawImage(ctx.canvas, 1, 0);

      // Vertical spread
      ctx.drawImage(ctx.canvas, 0, -1);
      ctx.drawImage(ctx.canvas, 0, 1);

      ctx.restore();
    }
  }
}
