// ═══════════════════════════════════════════════════════════════════
// charEdge — Pixel-Perfect Coordinate System
// Based on TradingView's fancy-canvas approach:
//   - Media coordinates = CSS pixels (what the browser reports)
//   - Bitmap coordinates = physical device pixels (what the GPU renders)
//   - ALL rendering happens in bitmap space with integer values
//   - Positions use Math.round(), widths use Math.floor()
//   - This eliminates sub-pixel blur on every line, candle, and grid
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} BitmapPosition
 * @property {number} position - Integer position in bitmap pixels
 * @property {number} length   - Integer width/height in bitmap pixels
 */

/**
 * Convert a CSS media coordinate to a bitmap (physical pixel) coordinate.
 * This is THE core transform. Every position on screen uses this.
 *
 * @param {number} mediaCoord - Position in CSS pixels
 * @param {number} pixelRatio - window.devicePixelRatio
 * @returns {number} Integer position in physical pixels
 */
export function mediaToBitmap(mediaCoord, pixelRatio) {
  return Math.round(mediaCoord * pixelRatio);
}

/**
 * Convert a bitmap coordinate back to CSS media space.
 *
 * @param {number} bitmapCoord - Position in physical pixels
 * @param {number} pixelRatio  - window.devicePixelRatio
 * @returns {number} Position in CSS pixels
 */
export function bitmapToMedia(bitmapCoord, pixelRatio) {
  return bitmapCoord / pixelRatio;
}

/**
 * Convert a CSS width/height to bitmap pixels.
 * Uses Math.floor (not round) to prevent widths from exceeding available space.
 * Guarantees minimum of 1 pixel — nothing is ever sub-pixel.
 *
 * @param {number} mediaSize  - Width or height in CSS pixels
 * @param {number} pixelRatio - window.devicePixelRatio
 * @returns {number} Integer size in physical pixels (min 1)
 */
export function mediaWidthToBitmap(mediaSize, pixelRatio) {
  return Math.max(1, Math.floor(mediaSize * pixelRatio));
}

/**
 * Calculate the exact bitmap position and width for a line at a given
 * media coordinate. This is the TradingView "positionsLine" algorithm
 * that ensures lines never straddle pixel boundaries.
 *
 * For a 1px line on a 2x display:
 *   mediaCoord=100, desiredWidth=1, pixelRatio=2
 *   → bitmapPos=200, bitmapWidth=2 (1 CSS px = 2 device px)
 *   → offset from center = floor(2/2) = 1
 *   → line starts at 199, width 2
 *
 * @param {number} mediaCoord     - Center position in CSS pixels
 * @param {number} desiredWidthMedia - Desired width in CSS pixels
 * @param {number} pixelRatio     - window.devicePixelRatio
 * @returns {BitmapPosition}
 */
export function positionsLine(mediaCoord, desiredWidthMedia, pixelRatio) {
  const center = Math.round(mediaCoord * pixelRatio);
  const width = Math.max(1, Math.round(desiredWidthMedia * pixelRatio));
  const offset = Math.floor(width / 2);
  return {
    position: center - offset,
    length: width,
  };
}

/**
 * Calculate bitmap position and width for a bar/candle body.
 * Uses floor for width to prevent bars from touching.
 *
 * @param {number} mediaCenterX  - Center X in CSS pixels
 * @param {number} mediaWidth    - Body width in CSS pixels
 * @param {number} pixelRatio    - window.devicePixelRatio
 * @returns {BitmapPosition}
 */
export function positionsBox(mediaCenterX, mediaWidth, pixelRatio) {
  const bitmapWidth = Math.max(1, Math.floor(mediaWidth * pixelRatio));
  const center = Math.round(mediaCenterX * pixelRatio);
  const left = center - Math.floor(bitmapWidth / 2);
  return {
    position: left,
    length: bitmapWidth,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Price ↔ Y Coordinate Transforms
// ═══════════════════════════════════════════════════════════════════

/**
 * PriceTransform — monomorphic price↔Y coordinate transformer.
 * Single class with a `mode` field replaces 4 different closure objects,
 * eliminating megamorphic dispatch at priceToY()/yToPrice() call sites.
 *
 * @param {number} priceMin    - Bottom of visible price range
 * @param {number} priceMax    - Top of visible price range
 * @param {number} chartHeight - Chart pane height in CSS pixels
 * @param {string} [scaleMode='linear'] - 'linear', 'log', 'percent', or 'indexed'
 * @param {number} [percentBase=0] - Base price for percent/indexed modes
 */
class PriceTransform {
  constructor(priceMin, priceMax, chartHeight, scaleMode = 'linear', percentBase = 0) {
    this._mode = scaleMode;
    this._chartHeight = chartHeight;
    this._percentBase = percentBase;

    if (scaleMode === 'log') {
      this._logMin = Math.log(Math.max(priceMin, 1e-10));
      this._logMax = Math.log(Math.max(priceMax, 1e-10));
      this._logRange = this._logMax - this._logMin || 1;
      this._range = 0;
      this._priceMin = priceMin;
    } else {
      this._range = priceMax - priceMin || 1;
      this._priceMin = priceMin;
      this._logMin = 0;
      this._logMax = 0;
      this._logRange = 0;
    }

    // Bind methods so they work when destructured:
    //   const p2y = priceTransform.priceToY;  // DataStage.ts:72
    //   pixelToPrice: priceTransform.yToPrice  // DataStage.ts:87
    this.priceToY = this.priceToY.bind(this);
    this.yToPrice = this.yToPrice.bind(this);
    this.formatTicks = this.formatTicks.bind(this);
  }

  priceToY(price) {
    const h = this._chartHeight;
    if (this._mode === 'log') {
      const logP = Math.log(Math.max(price, 1e-10));
      return h - ((logP - this._logMin) / this._logRange) * h;
    }
    return h - ((price - this._priceMin) / this._range) * h;
  }

  yToPrice(y) {
    const h = this._chartHeight;
    if (this._mode === 'log') {
      const logP = this._logMin + ((h - y) / h) * this._logRange;
      return Math.exp(logP);
    }
    return this._priceMin + ((h - y) / h) * this._range;
  }

  formatTicks(ticks) {
    if (this._mode === 'percent' && this._percentBase > 0) {
      const base = this._percentBase;
      return ticks.map((t) => ((t - base) / base) * 100);
    }
    if (this._mode === 'indexed' && this._percentBase > 0) {
      const base = this._percentBase;
      return ticks.map((t) => (t / base) * 100);
    }
    return ticks;
  }
}

export function createPriceTransform(priceMin, priceMax, chartHeight, scaleMode = 'linear', percentBase = 0) {
  return new PriceTransform(priceMin, priceMax, chartHeight, scaleMode, percentBase);
}

// ═══════════════════════════════════════════════════════════════════
// Time (Bar Index) ↔ X Coordinate Transforms
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a bar-index-to-X coordinate transformer.
 * Works in MEDIA (CSS) space. Callers convert to bitmap for rendering.
 *
 * @param {number} firstVisibleIdx - Index of leftmost visible bar
 * @param {number} barSpacing      - Pixels per bar (CSS pixels, can be fractional)
 * @returns {{ indexToX: (idx: number) => number, xToIndex: (x: number) => number }}
 */
export function createTimeTransform(firstVisibleIdx, barSpacing) {
  return {
    /** Convert bar index to X center position in CSS pixels */
    indexToX(idx) {
      return (idx - firstVisibleIdx + 0.5) * barSpacing;
    },
    /** Convert X position to nearest bar index */
    xToIndex(x) {
      return Math.round(x / barSpacing - 0.5 + firstVisibleIdx);
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// Candlestick Width Algorithm (TradingView atan curve)
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculate candlestick body width as a fraction of bar spacing.
 * Uses TradingView's arctangent curve for smooth transitions:
 *   - Below 4px spacing: special narrow coefficient allows slight overlap
 *   - Above 4px: atan curve trending toward ~80% of bar spacing
 *   - Result is always smooth — no visual "jumps" when zooming
 *
 * @param {number} barSpacing - Pixels per bar (CSS pixels)
 * @returns {number} Body width coefficient (0.0 to 1.0)
 */
export function candleWidthCoefficient(barSpacing) {
  if (barSpacing < 0.5) return 1.0; // Conflation range — dots
  if (barSpacing < 4) {
    // Narrow range: allow slight overlap for readability
    // Linear ramp from 1.0 at 0.5px to ~0.7 at 4px
    return 1.0 - (barSpacing - 0.5) * 0.085;
  }
  // Normal range: atan curve trending toward 0.8
  // atan(x) approaches π/2 ≈ 1.5708 as x → ∞
  // We scale it to approach 0.8
  const t = (barSpacing - 4) * 0.3;
  return 0.7 + 0.1 * (2 / Math.PI) * Math.atan(t);
}

/**
 * Calculate the actual candlestick body width in CSS pixels.
 *
 * @param {number} barSpacing - Pixels per bar (CSS pixels)
 * @returns {number} Body width in CSS pixels (min 1)
 */
export function candleBodyWidth(barSpacing) {
  const coeff = candleWidthCoefficient(barSpacing);
  return Math.max(1, Math.floor(barSpacing * coeff));
}

/**
 * Calculate candlestick wick width. Always 1 CSS pixel (which
 * becomes 1 * pixelRatio device pixels for crispness).
 *
 * @returns {number} Always 1
 */
export function candleWickWidth() {
  return 1;
}

// ═══════════════════════════════════════════════════════════════════
// Viewport / Visible Range Calculations
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculate the visible price range from OHLCV data, with padding.
 *
 * @param {Array<{high: number, low: number}>} bars - Visible bars
 * @param {number} [paddingPct=0.05] - Padding as fraction of range
 * @returns {{ min: number, max: number }}
 */
export function visiblePriceRange(bars, paddingPct = 0.05) {
  if (!bars || bars.length === 0) {
    return { min: 0, max: 100 };
  }

  let lo = Infinity;
  let hi = -Infinity;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    if (bar.low < lo) lo = bar.low;
    if (bar.high > hi) hi = bar.high;
  }

  const range = hi - lo || 1;
  const pad = range * paddingPct;

  return {
    min: lo - pad,
    max: hi + pad,
  };
}

/**
 * Generate "nice" Y-axis tick marks.
 * Picks round numbers (1, 2, 5, 10, 25, 50, 100, etc.) that
 * distribute evenly within the price range.
 *
 * @param {number} min       - Range minimum
 * @param {number} max       - Range maximum
 * @param {number} maxTicks  - Target number of ticks
 * @returns {{ min: number, max: number, step: number, ticks: number[] }}
 */
// P2 5.3: Memoize niceScale — avoids redundant log/pow/ceil/floor during panning.
// 4-slot LRU is enough for main pane + 3 indicator panes.
const _niceScaleCache = new Map();
const _NICE_CACHE_MAX = 4;

export function niceScale(min, max, maxTicks = 8) {
  const key = `${min}|${max}|${maxTicks}`;
  const cached = _niceScaleCache.get(key);
  if (cached) return cached;

  const range = max - min || 1;
  const roughStep = range / maxTicks;

  // Find the magnitude
  const mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / mag;

  // Round to nice step: 1, 2, 2.5, 5, or 10
  let niceStep;
  if (normalized < 1.5) niceStep = 1;
  else if (normalized < 3) niceStep = 2;
  else if (normalized < 3.5) niceStep = 2.5;
  else if (normalized < 7.5) niceStep = 5;
  else niceStep = 10;

  const step = niceStep * mag;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;

  const ticks = [];
  for (let v = niceMin; v <= niceMax + step * 0.5; v += step) {
    if (v >= min - step * 0.01 && v <= max + step * 0.01) {
      ticks.push(Math.round(v * 1e10) / 1e10); // Avoid floating point drift
    }
  }

  const result = { min: niceMin, max: niceMax, step, ticks };

  // LRU eviction
  if (_niceScaleCache.size >= _NICE_CACHE_MAX) {
    const oldest = _niceScaleCache.keys().next().value;
    _niceScaleCache.delete(oldest);
  }
  _niceScaleCache.set(key, result);

  return result;
}

// Sprint 9 #73: formatPrice consolidated into shared/formatting.ts.
// Re-exported here for backward compatibility with existing import sites.
export { formatPrice } from '../../shared/formatting';

/**
 * Format timestamp for time axis labels based on timeframe.
 *
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @param {string} timeframe - '1m', '5m', '15m', '1h', '4h', '1D', '1W'
 * @returns {string}
 */
// 8.1.3: Reusable Date object to avoid per-call GC allocation in axis rendering
const _csSharedDate = new Date(0);
const _csMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatTimeLabel(timestamp, timeframe) {
  // 8.1.3: Reuse shared Date object — numeric-first fast path
  const ts = typeof timestamp === 'number' ? timestamp : +new Date(timestamp);
  _csSharedDate.setTime(ts);
  const d = _csSharedDate;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const mon = _csMonths[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();

  switch (timeframe) {
    case '1m':
    case '5m':
    case '15m':
      return `${hh}:${mm}`;
    case '1h':
    case '4h':
      // Show date when crossing midnight
      return `${mon} ${day} ${hh}:${mm}`;
    case '1D':
    case '1d':
      return `${mon} ${day}`;
    case '1W':
    case '1w':
    case '1M':
      return `${mon} ${year}`;
    default:
      return `${hh}:${mm}`;
  }
}
