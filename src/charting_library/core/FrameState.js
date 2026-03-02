// ═══════════════════════════════════════════════════════════════════
// charEdge — FrameState
//
// Immutable snapshot of everything needed to render a single frame.
// Created once per frame at the top of the render pipeline.
// Enables frame diffing: stages can skip work when their inputs
// haven't changed since the previous frame.
//
// Design Principles:
//   1. All values are plain data (no DOM refs, no contexts)
//   2. Created via FrameState.create() — never mutated
//   3. FrameState.diff() returns a bitmask of what changed
// ═══════════════════════════════════════════════════════════════════

/**
 * Bitmask flags indicating which parts of the frame state changed.
 * Stages check these to decide whether they need to re-render.
 */
export const CHANGED = {
  NONE:         0,
  VIEWPORT:     1 << 0,   // scroll, zoom, visibleBars changed
  DATA:         1 << 1,   // bars array changed (length or content)
  THEME:        1 << 2,   // theme or chart colors changed
  INDICATORS:   1 << 3,   // indicator config changed
  DRAWINGS:     1 << 4,   // drawing state changed
  MOUSE:        1 << 5,   // cursor position changed
  PROPS:        1 << 6,   // chart type, scale mode, overlays changed
  SIZE:         1 << 7,   // canvas dimensions changed
  ANIMATION:    1 << 8,   // candle entrance or tick animation active
  TICK:         1 << 9,   // last bar updated, bar count unchanged (incremental)
  ALL:          0x3FF,     // all bits set
};

/**
 * @typedef {Object} FrameStateData
 * @property {number} timestamp       - performance.now() when frame was created
 * @property {number} bitmapWidth     - Canvas width in physical pixels
 * @property {number} bitmapHeight    - Canvas height in physical pixels
 * @property {number} mediaWidth      - Canvas width in CSS pixels
 * @property {number} mediaHeight     - Canvas height in CSS pixels
 * @property {number} pixelRatio      - Device pixel ratio
 * @property {Array}  bars            - OHLCV data array
 * @property {number} barCount        - bars.length (avoid repeated .length calls)
 * @property {number} scrollOffset    - Current scroll offset in bars
 * @property {number} visibleBars     - Number of bars visible in viewport
 * @property {number} mouseX          - Cursor X in CSS pixels (null if off-chart)
 * @property {number} mouseY          - Cursor Y in CSS pixels (null if off-chart)
 * @property {number|null} hoverIdx   - Index of bar under cursor
 * @property {string} chartType       - 'candlestick' | 'line' | 'area' | 'footprint' | 'renko' | 'range'
 * @property {string} scaleMode       - 'linear' | 'log' | 'percent'
 * @property {number} percentBase     - Base price for percent scale
 * @property {boolean} autoScale      - Whether auto-scaling is active
 * @property {number} priceScale      - Manual price scale factor
 * @property {number} priceScroll     - Manual price scroll offset
 * @property {string} themeName       - 'dark' | 'light'
 * @property {Object} theme           - Resolved theme colors (thm object)
 * @property {Array}  indicators      - Active indicator configs
 * @property {Array}  overlayInds     - Filtered overlay indicators
 * @property {Array}  paneInds        - Filtered pane indicators
 * @property {boolean} showVolume     - Whether volume is visible
 * @property {boolean} compact        - Whether in compact mode (no axes)
 * @property {boolean} showHeatmap    - Whether liquidity heatmap is shown
 * @property {boolean} showSessions   - Whether session dividers are shown
 * @property {boolean} showDelta      - Whether delta histogram is shown
 * @property {boolean} showVP         - Whether volume profile overlay is shown
 * @property {boolean} showLargeTrades- Whether large trade markers are shown
 * @property {boolean} showOI         - Whether OI overlay is shown
 * @property {boolean} magnetMode     - Whether magnet snap is on
 * @property {Object|null} animCurrent- Current candle animation state
 * @property {Object|null} animTarget - Target candle animation state
 * @property {boolean} animating      - Whether a candle animation is active
 * @property {number|null} loadTimestamp - Entrance animation start time
 * @property {Object} lod             - Current LOD settings from FrameBudget
 * @property {string} symbol          - Current symbol
 * @property {string} timeframe       - Current timeframe
 * @property {Array}  alerts          - Active alerts
 * @property {Array}  srLevels        - Support/resistance levels
 * @property {Array|null} trades      - Trade markers
 * @property {Object|null} syncedCrosshair - Synced crosshair from another pane
 * @property {Object|null} oiData     - Open interest data
 * @property {Array|null} liquidations- Liquidation data
 * @property {Object|null} storeChartColors - User-configured chart colors
 * @property {string|null} aggregatorKey - Order flow aggregator key
 * @property {Object|null} paneHeights - Custom pane height fractions
 * @property {Object|null} patternMarkers - Chart pattern markers
 * @property {Object|null} divergences - Divergence markers
 *
 * Computed (derived during create()):
 * @property {number} axW             - Axis width in CSS pixels
 * @property {number} txH             - Time axis height in CSS pixels
 * @property {number} chartWidth      - Chart area width (mw - axW)
 * @property {number} availHeight     - Available height (mh - txH)
 * @property {number} mainHeight      - Main chart pane height
 * @property {number} paneHeight      - Individual indicator pane height
 * @property {number} paneCount       - Number of indicator panes
 * @property {number} startIdx        - First visible bar index
 * @property {number} endIdx          - Last visible bar index
 * @property {number} exactStart      - Exact fractional start index
 * @property {Array}  visBars         - Sliced visible bars
 * @property {number} barSpacing      - Pixels per bar (CSS)
 * @property {number} yMin            - Visible price range min
 * @property {number} yMax            - Visible price range max
 * @property {Object} priceTransform  - { priceToY, yToPrice, formatTicks }
 * @property {Object} timeTransform   - { indexToPixel, pixelToIndex, pixelToTime, timeToPixel }
 * @property {boolean} viewportChanged - Whether visible range changed from previous frame
 */

export class FrameState {
  /**
   * Create a new FrameState from the ChartEngine instance.
   * This is the ONLY way to create a FrameState — it captures
   * a consistent snapshot of all rendering inputs.
   *
   * @param {import('./ChartEngine.js').ChartEngine} engine
   * @param {Object} lod - Current LOD from FrameBudget
   * @param {FrameState|null} prev - Previous frame's state (for diffing)
   * @returns {FrameState}
   */
  static create(engine, lod, prev) {
    const S = engine.state;
    const bars = engine.bars;
    const props = engine.props;
    const layers = engine.layers;

    const pr = layers.pixelRatio || devicePixelRatio || 1;
    const bw = layers.bitmapWidth || 1;
    const bh = layers.bitmapHeight || 1;
    const mw = layers.mediaWidth || bw / pr;
    const mh = layers.mediaHeight || bh / pr;

    const compact = !!props.compact;
    const axW = compact ? 0 : 72;
    const txH = compact ? 0 : 24;
    const chartWidth = mw - axW;
    const availHeight = mh - txH;

    // Indicator layout
    const indicators = engine.indicators || [];
    const overlayInds = indicators.filter(i => i.mode === 'overlay').slice(0, lod.maxIndicators);
    const paneInds = indicators.filter(i => i.mode === 'pane').slice(0, Math.max(0, lod.maxIndicators - overlayInds.length));
    const paneCount = paneInds.length;

    let paneHeight = 0, mainHeight = availHeight;
    if (paneCount > 0) {
      const paneHeightsMap = props.paneHeights || {};
      const totalPaneFraction = paneInds.reduce((sum, _, idx) => {
        return sum + (paneHeightsMap[idx] || 0.15);
      }, 0);
      const paneTotalH = Math.min(availHeight * 0.6, Math.floor(availHeight * totalPaneFraction));
      paneHeight = Math.max(60, Math.floor(paneTotalH / paneCount));
      mainHeight = Math.max(100, availHeight - paneHeight * paneCount);
    }

    // Visible range
    const end = bars.length - 1 - S.scrollOffset + 5;
    const exactStart = end - S.visibleBars + 1;
    const startIdx = Math.max(0, Math.floor(exactStart));
    const endIdx = Math.floor(end);
    const visBars = bars.slice(startIdx, Math.min(bars.length, endIdx + 2));
    const barSpacing = chartWidth / S.visibleBars;

    // Price range
    let lo = Infinity, hi = -Infinity;
    for (const b of visBars) {
      if (b.low < lo) lo = b.low;
      if (b.high > hi) hi = b.high;
    }
    const rng = hi - lo || 1;
    let yMin = lo - rng * 0.06, yMax = hi + rng * 0.06;
    if (!S.autoScale) {
      const mid = (yMin + yMax) / 2, half = (yMax - yMin) / 2;
      yMin = mid - half * S.priceScale + S.priceScroll;
      yMax = mid + half * S.priceScale + S.priceScroll;
    }

    const percentBase = visBars.length > 0 ? visBars[0].open : 0;

    // Viewport change detection
    const viewportChanged = (
      !prev ||
      startIdx !== prev.startIdx ||
      endIdx !== prev.endIdx ||
      S.visibleBars !== prev.visibleBars
    );

    // Animation state
    const animating = !!(engine._animTarget && engine._animCurrent);

    // Theme resolution
    const { storeChartColors } = props;

    const fs = new FrameState();

    // Timing
    fs.timestamp = performance.now();

    // Canvas dimensions
    fs.bitmapWidth = bw;
    fs.bitmapHeight = bh;
    fs.mediaWidth = mw;
    fs.mediaHeight = mh;
    fs.pixelRatio = pr;

    // Data
    fs.bars = bars;
    fs.barCount = bars.length;

    // Viewport
    fs.scrollOffset = S.scrollOffset;
    fs.visibleBars = S.visibleBars;
    fs.startIdx = startIdx;
    fs.endIdx = endIdx;
    fs.exactStart = exactStart;
    fs.visBars = visBars;
    fs.barSpacing = barSpacing;
    fs.viewportChanged = viewportChanged;

    // Price range
    fs.yMin = yMin;
    fs.yMax = yMax;
    fs.percentBase = percentBase;

    // Cursor
    fs.mouseX = S.mouseX;
    fs.mouseY = S.mouseY;
    fs.hoverIdx = S.hoverIdx;

    // Chart config
    fs.chartType = props.chartType || 'candlestick';
    fs.scaleMode = S.scaleMode;
    fs.autoScale = S.autoScale;
    fs.priceScale = S.priceScale;
    fs.priceScroll = S.priceScroll;
    fs.compact = compact;
    fs.showVolume = !!props.showVolume;
    fs.showHeatmap = !!props.showHeatmap;
    fs.showSessions = !!props.showSessions;
    fs.showDelta = !!props.showDeltaOverlay;
    fs.showVP = !!props.showVPOverlay;
    fs.showLargeTrades = !!props.showLargeTradesOverlay;
    fs.showOI = !!props.showOIOverlay;
    fs.magnetMode = !!props.magnetMode;

    // Layout
    fs.axW = axW;
    fs.txH = txH;
    fs.chartWidth = chartWidth;
    fs.availHeight = availHeight;
    fs.mainHeight = mainHeight;
    fs.paneHeight = paneHeight;
    fs.paneCount = paneCount;

    // Indicators
    fs.indicators = indicators;
    fs.overlayInds = overlayInds;
    fs.paneInds = paneInds;

    // Theme
    fs.themeName = props.theme || 'dark';
    fs.storeChartColors = storeChartColors || null;

    // Animation
    fs.animCurrent = engine._animCurrent;
    fs.animTarget = engine._animTarget;
    fs.animating = animating;
    fs.loadTimestamp = engine._loadTimestamp || null;

    // LOD
    fs.lod = lod;

    // Identity
    fs.symbol = engine.symbol;
    fs.timeframe = engine.timeframe;

    // Tick-update tracking (Phase 1.1.2 — incremental bar append)
    fs.isTickUpdate = !!engine._tickUpdate;
    fs.lastBarClose = bars.length > 0 ? bars[bars.length - 1].close : 0;

    // Overlays / data sources
    fs.alerts = engine.alerts || [];
    fs.srLevels = props.srLevels || [];
    fs.trades = props.trades || null;
    fs.syncedCrosshair = engine.syncedCrosshair;
    fs.oiData = props.oiData || null;
    fs.liquidations = props.liquidations || null;
    fs.aggregatorKey = props.aggregatorKey || null;
    fs.paneHeights = props.paneHeights || null;
    fs.patternMarkers = props.patternMarkers || null;
    fs.divergences = props.divergences || null;
    fs.heatmapIntensity = props.heatmapIntensity || 1.0;
    fs.renkoBrickSize = props.renkoBrickSize;
    fs.rangeBarSize = props.rangeBarSize;

    return fs;
  }

  /**
   * Compute a change bitmask between this frame and the previous frame.
   * Stages use this to skip unnecessary work.
   *
   * @param {FrameState|null} prev
   * @returns {number} Bitmask of CHANGED flags
   */
  diff(prev) {
    if (!prev) return CHANGED.ALL;

    let mask = CHANGED.NONE;

    // Viewport
    if (this.startIdx !== prev.startIdx ||
        this.endIdx !== prev.endIdx ||
        this.visibleBars !== prev.visibleBars ||
        this.scrollOffset !== prev.scrollOffset) {
      mask |= CHANGED.VIEWPORT;
    }

    // Data — distinguish tick updates (same count, last bar changed) from
    // full data changes (new bars added / removed / reset).  Phase 1.1.2.
    if (this.barCount !== prev.barCount) {
      mask |= CHANGED.DATA;
    } else if (this.isTickUpdate || this.lastBarClose !== prev.lastBarClose) {
      mask |= CHANGED.TICK;
    } else if (this.bars !== prev.bars) {
      mask |= CHANGED.DATA;
    }

    // Theme
    if (this.themeName !== prev.themeName || this.storeChartColors !== prev.storeChartColors) {
      mask |= CHANGED.THEME;
    }

    // Indicators
    if (this.indicators !== prev.indicators || this.indicators.length !== prev.indicators.length) {
      mask |= CHANGED.INDICATORS;
    }

    // Mouse
    if (this.mouseX !== prev.mouseX || this.mouseY !== prev.mouseY || this.hoverIdx !== prev.hoverIdx) {
      mask |= CHANGED.MOUSE;
    }

    // Props
    if (this.chartType !== prev.chartType ||
        this.scaleMode !== prev.scaleMode ||
        this.showVolume !== prev.showVolume ||
        this.showHeatmap !== prev.showHeatmap ||
        this.showSessions !== prev.showSessions ||
        this.compact !== prev.compact ||
        this.autoScale !== prev.autoScale) {
      mask |= CHANGED.PROPS;
    }

    // Size
    if (this.bitmapWidth !== prev.bitmapWidth || this.bitmapHeight !== prev.bitmapHeight) {
      mask |= CHANGED.SIZE;
    }

    // Animation
    if (this.animating || this.loadTimestamp) {
      mask |= CHANGED.ANIMATION;
    }

    return mask;
  }

  /**
   * Check if specific change flags are set.
   * @param {number} flags - Bitmask of CHANGED flags to test
   * @returns {boolean}
   */
  hasChanged(flags) {
    return (this._changeMask & flags) !== 0;
  }

  /**
   * Store the computed change mask (called by RenderPipeline after diff).
   * @param {number} mask
   */
  setChangeMask(mask) {
    this._changeMask = mask;
  }
}
