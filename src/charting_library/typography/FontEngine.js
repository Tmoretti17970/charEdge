// ═══════════════════════════════════════════════════════════════════
// charEdge — FontEngine
//
// Modern typography engine for premium text rendering.
// Replaces default Arial with a curated system font stack and
// provides pixel-perfect text measurement, baseline alignment,
// and kerning-aware metrics via OffscreenCanvas.
//
// Font stack priority: Inter → SF Pro → Segoe UI → Roboto → sans-serif
// ═══════════════════════════════════════════════════════════════════

/**
 * System font stack ordered by platform preference.
 * Inter is loaded via Google Fonts when available.
 */
const FONT_STACK = [
  'Inter',
  '-apple-system',
  'BlinkMacSystemFont',
  'SF Pro Text',
  'Segoe UI',
  'Roboto',
  'Oxygen',
  'Ubuntu',
  'Cantarell',
  'Helvetica Neue',
  'sans-serif',
];

/** Monospace font stack for numeric displays */
const MONO_STACK = [
  'JetBrains Mono',
  'SF Mono',
  'Cascadia Code',
  'Consolas',
  'Menlo',
  'monospace',
];

/**
 * Font metrics cache key.
 * @param {string} fontFamily
 * @param {number} fontSize
 * @returns {string}
 */
function metricsKey(fontFamily, fontSize) {
  return `${fontFamily}|${fontSize}`;
}

/**
 * Premium typography engine for charting text.
 */
export class FontEngine {
  constructor() {
    /** @type {Map<string, { width: number, ascent: number, descent: number }>} */
    this._metricsCache = new Map();

    /** Measurement canvas (offscreen for performance) */
    this._measureCanvas = null;
    /** @type {CanvasRenderingContext2D|null} */
    this._measureCtx = null;
    /** Whether measure canvas init has been attempted */
    this._measureInitAttempted = false;

    /** Whether Inter font has been loaded */
    this._fontLoaded = false;
  }

  /**
   * Get the system font stack as a CSS font-family string.
   *
   * @param {'default'|'mono'} [variant='default']
   * @returns {string}
   */
  getFontStack(variant = 'default') {
    if (variant === 'mono') {
      return MONO_STACK.map(f => (f.includes(' ') ? `"${f}"` : f)).join(', ');
    }
    return FONT_STACK.map(f => (f.includes(' ') ? `"${f}"` : f)).join(', ');
  }

  /**
   * Build a CSS font shorthand string.
   *
   * @param {number} fontSize - In CSS pixels
   * @param {'normal'|'bold'|number} [weight='normal']
   * @param {'default'|'mono'} [variant='default']
   * @returns {string}
   */
  getFont(fontSize, weight = 'normal', variant = 'default') {
    const w = typeof weight === 'number' ? weight : weight;
    return `${w} ${fontSize}px ${this.getFontStack(variant)}`;
  }

  /**
   * Measure text width, ascent, and descent in CSS pixels.
   * Uses OffscreenCanvas TextMetrics for precise measurement.
   *
   * @param {string} text
   * @param {number} fontSize
   * @param {'normal'|'bold'|number} [weight='normal']
   * @param {'default'|'mono'} [variant='default']
   * @returns {{ width: number, ascent: number, descent: number }}
   */
  measure(text, fontSize, weight = 'normal', variant = 'default') {
    if (!text) return { width: 0, ascent: 0, descent: 0 };

    const font = this.getFont(fontSize, weight, variant);
    const key = metricsKey(font, text.length > 20 ? text.slice(0, 20) : text);

    const cached = this._metricsCache.get(key);
    if (cached) return cached;

    // Lazy init measure canvas on first use
    if (!this._measureInitAttempted) {
      this._initMeasureCanvas();
    }

    const ctx = this._measureCtx;
    if (!ctx || typeof ctx.measureText !== 'function') {
      return { width: fontSize * text.length * 0.6, ascent: fontSize * 0.8, descent: fontSize * 0.2 };
    }

    ctx.font = font;
    const metrics = ctx.measureText(text);

    const result = {
      width: metrics.width,
      ascent: metrics.actualBoundingBoxAscent ?? fontSize * 0.8,
      descent: metrics.actualBoundingBoxDescent ?? fontSize * 0.2,
    };

    // Cache (limit cache size to prevent memory leaks)
    if (this._metricsCache.size > 500) {
      // Remove oldest entries (FIFO via iterator)
      const firstKey = this._metricsCache.keys().next().value;
      this._metricsCache.delete(firstKey);
    }
    this._metricsCache.set(key, result);

    return result;
  }

  /**
   * Get the optimal text baseline offset for vertical centering.
   * Returns the distance from the top of the font bounding box to
   * the baseline, enabling pixel-perfect vertical alignment.
   *
   * @param {number} fontSize
   * @param {'normal'|'bold'|number} [weight='normal']
   * @returns {number} Baseline offset in CSS pixels
   */
  getBaseline(fontSize, weight = 'normal') {
    const m = this.measure('Mg', fontSize, weight);
    return m.ascent;
  }

  /**
   * Apply the font engine's font to a canvas context.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} fontSize
   * @param {'normal'|'bold'|number} [weight='normal']
   * @param {'default'|'mono'} [variant='default']
   */
  applyFont(ctx, fontSize, weight = 'normal', variant = 'default') {
    ctx.font = this.getFont(fontSize, weight, variant);
    ctx.textBaseline = 'alphabetic';
    ctx.textRendering = 'optimizeLegibility';
  }

  /**
   * Clear the metrics cache (e.g. after font load event).
   */
  clearCache() {
    this._metricsCache.clear();
  }

  /**
   * Attempt to load Inter font from Google Fonts.
   * Non-blocking — falls back to next font in stack if unavailable.
   *
   * @returns {Promise<boolean>} Whether the font was loaded
   */
  async loadFont() {
    if (this._fontLoaded) return true;

    try {
      if (typeof document === 'undefined') return false;

      // Check if already loaded
      if (document.fonts && await document.fonts.check('16px Inter')) {
        this._fontLoaded = true;
        this.clearCache();
        return true;
      }

      // Inject Google Fonts link if not present
      const existing = document.querySelector('link[href*="fonts.googleapis.com"][href*="Inter"]');
      if (!existing) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
        document.head.appendChild(link);
      }

      // Wait for font to load (with timeout)
      if (document.fonts) {
        await Promise.race([
          document.fonts.load('16px Inter'),
          new Promise(r => setTimeout(r, 3000)),
        ]);
        this._fontLoaded = document.fonts.check('16px Inter');
      }

      if (this._fontLoaded) {
        this.clearCache();
      }
      return this._fontLoaded;
    } catch {
      return false;
    }
  }

  /** @private */
  _initMeasureCanvas() {
    this._measureInitAttempted = true;
    try {
      this._measureCanvas = new OffscreenCanvas(1, 1);
      this._measureCtx = this._measureCanvas.getContext('2d');
    } catch {
      // Fallback for environments without OffscreenCanvas
      if (typeof document !== 'undefined') {
        this._measureCanvas = document.createElement('canvas');
        this._measureCanvas.width = 1;
        this._measureCanvas.height = 1;
        this._measureCtx = this._measureCanvas.getContext('2d');
      }
    }
  }
}

/** Singleton instance */
export const fontEngine = new FontEngine();
