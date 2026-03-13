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
//   4. 8.1.5: Pooled allocation — eliminates per-frame GC
// ═══════════════════════════════════════════════════════════════════

import type { Bar, IndicatorConfig } from '../../types/chart.js';
import type { PaneState } from './PaneState.js';
import { buildPaneLayout, layoutPanes } from './PaneState.js';

/**
 * Bitmask flags indicating which parts of the frame state changed.
 * Stages check these to decide whether they need to re-render.
 */
export const CHANGED = {
  NONE: 0,
  VIEWPORT: 1 << 0, // scroll, zoom, visibleBars changed
  DATA: 1 << 1, // bars array changed (length or content)
  THEME: 1 << 2, // theme or chart colors changed
  INDICATORS: 1 << 3, // indicator config changed
  DRAWINGS: 1 << 4, // drawing state changed
  MOUSE: 1 << 5, // cursor position changed
  PROPS: 1 << 6, // chart type, scale mode, overlays changed
  SIZE: 1 << 7, // canvas dimensions changed
  ANIMATION: 1 << 8, // candle entrance or tick animation active
  TICK: 1 << 9, // last bar updated, bar count unchanged (incremental)
  TIMEZONE: 1 << 10, // active timezone changed
  ALL: 0x7ff, // all bits set (11 flags)
} as const;

export type ChangeMask = number;

/** Per-pane price transform (independent yMin/yMax). */
export interface PaneTransform {
  yMin: number;
  yMax: number;
}

/**
 * Engine-like interface — the subset of ChartEngine properties
 * that FrameState.create() reads. Avoids circular dependency.
 */
interface EngineSnapshot {
  state: {
    scrollOffset: number;
    visibleBars: number;
    mouseX: number | null;
    mouseY: number | null;
    hoverIdx: number | null;
    scaleMode: string;
    autoScale: boolean;
    priceScale: number;
    priceScroll: number;
    collapsedPanes?: Set<number>;
  };
  bars: Bar[];
  props: Record<string, unknown>;
  layers: {
    pixelRatio?: number;
    bitmapWidth?: number;
    bitmapHeight?: number;
    mediaWidth?: number;
    mediaHeight?: number;
  };
  indicators: IndicatorConfig[] | null;
  symbol: string;
  timeframe: string;
  alerts: unknown[];
  syncedCrosshair: unknown;
  _animTarget: unknown;
  _animCurrent: unknown;
  _loadTimestamp: number | null;
  _tickUpdate: boolean;
}

export class FrameState {
  // ─── Timing ────────────────────────────────────────────────────
  timestamp!: number;

  // ─── Canvas dimensions ─────────────────────────────────────────
  bitmapWidth!: number;
  bitmapHeight!: number;
  mediaWidth!: number;
  mediaHeight!: number;
  pixelRatio!: number;

  // ─── Data ──────────────────────────────────────────────────────
  bars!: Bar[];
  barCount!: number;

  // ─── Viewport ──────────────────────────────────────────────────
  scrollOffset!: number;
  visibleBars!: number;
  startIdx!: number;
  endIdx!: number;
  exactStart!: number;
  visBars!: Bar[];
  barSpacing!: number;
  viewportChanged!: boolean;
  panOffset!: number;

  // ─── Price range ───────────────────────────────────────────────
  yMin!: number;
  yMax!: number;
  percentBase!: number;

  // ─── Cursor ────────────────────────────────────────────────────
  mouseX!: number | null;
  mouseY!: number | null;
  hoverIdx!: number | null;

  // ─── Chart config ──────────────────────────────────────────────
  chartType!: string;
  scaleMode!: string;
  autoScale!: boolean;
  priceScale!: number;
  priceScroll!: number;
  compact!: boolean;
  showVolume!: boolean;
  showHeatmap!: boolean;
  showSessions!: boolean;
  useUTC!: boolean;
  activeTimezone!: string;
  showDelta!: boolean;
  showVP!: boolean;
  showLargeTrades!: boolean;
  showOI!: boolean;
  magnetMode!: boolean;

  // ─── Layout ────────────────────────────────────────────────────
  axW!: number;
  txH!: number;
  chartWidth!: number;
  availHeight!: number;
  mainHeight!: number;
  paneHeight!: number;
  paneCount!: number;

  // ─── Indicators ────────────────────────────────────────────────
  indicators!: IndicatorConfig[];
  overlayInds!: IndicatorConfig[];
  paneInds!: IndicatorConfig[];

  // ─── Theme ─────────────────────────────────────────────────────
  themeName!: string;
  storeChartColors!: Record<string, string> | null;

  // ─── Animation ─────────────────────────────────────────────────
  animCurrent!: unknown;
  animTarget!: unknown;
  animating!: boolean;
  loadTimestamp!: number | null;

  // ─── LOD ───────────────────────────────────────────────────────
  lod!: Record<string, unknown>;

  // ─── Identity ──────────────────────────────────────────────────
  symbol!: string;
  timeframe!: string;

  // ─── Tick-update tracking ──────────────────────────────────────
  isTickUpdate!: boolean;
  lastBarClose!: number;

  // ─── Overlays / data sources ───────────────────────────────────
  alerts!: unknown[];
  srLevels!: unknown[];
  trades!: unknown[] | null;
  syncedCrosshair!: unknown;
  oiData!: unknown;
  liquidations!: unknown[] | null;
  aggregatorKey!: string | null;
  paneHeights!: Record<number, number> | null;
  collapsedPanes!: Set<number>;

  // ─── Pane transforms ──────────────────────────────────────────
  paneTransforms!: (PaneTransform | null)[];
  /** Phase 1: First-class pane state array [main, pane_0, pane_1, ...] */
  panes!: PaneState[];
  patternMarkers!: unknown;
  divergences!: unknown;
  heatmapIntensity!: number;
  renkoBrickSize!: number | undefined;
  rangeBarSize!: number | undefined;

  // ── Drawing version (for change detection) ──────────────────────
  drawingVersion!: number;

  // ─── Change mask (set after diff) ──────────────────────────────
  private _changeMask: number = 0;

  /**
   * Create a new FrameState from the ChartEngine instance.
   * This is the ONLY way to create a FrameState — it captures
   * a consistent snapshot of all rendering inputs.
   */
  static create(engine: EngineSnapshot, lod: Record<string, unknown>, prev: FrameState | null): FrameState {
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
    const indicators = (engine.indicators || []) as unknown[];
    const collapsedPanes: Set<number> = engine.state.collapsedPanes || new Set();

    // P1 Task 3: Reuse layout from prev frame if canvas size, zoom & config are unchanged
    const layoutSame =
      prev &&
      bw === prev.bitmapWidth &&
      bh === prev.bitmapHeight &&
      mw === prev.mediaWidth &&
      mh === prev.mediaHeight &&
      compact === prev.compact &&
      indicators.length === prev.indicators.length &&
      S.visibleBars === prev.visibleBars;

    let axW: number, txH: number, chartWidth: number, availHeight: number;
    let overlayInds: unknown[], paneInds: unknown[], paneCount: number;
    let paneHeight: number, mainHeight: number;

    if (layoutSame) {
      // Reuse cached layout — skip filter/reduce/Math operations
      axW = prev!.axW;
      txH = prev!.txH;
      chartWidth = prev!.chartWidth;
      availHeight = prev!.availHeight;
      overlayInds = prev!.overlayInds;
      paneInds = prev!.paneInds;
      paneCount = prev!.paneCount;
      paneHeight = prev!.paneHeight;
      mainHeight = prev!.mainHeight;
    } else {
      // P1-A #3/#4: Responsive axis sizing — 48px price axis and 20px time axis on mobile
      const isMobile = mw < 768;
      axW = compact ? 0 : isMobile ? 48 : 72;
      txH = compact ? 0 : isMobile ? 20 : 24;
      chartWidth = mw - axW;
      availHeight = mh - txH;

      // Indicator layout
      overlayInds = indicators.filter((i: unknown) => i.mode === 'overlay').slice(0, (lod as unknown).maxIndicators);
      paneInds = indicators
        .filter((i: unknown) => i.mode === 'pane')
        .slice(0, Math.max(0, (lod as unknown).maxIndicators - overlayInds.length));
      paneCount = paneInds.length;

      paneHeight = 0;
      mainHeight = availHeight;
      if (paneCount > 0) {
        const paneHeightsMap = (props.paneHeights || {}) as Record<number, number>;
        const totalPaneFraction = paneInds.reduce((sum: number, _: unknown, idx: number) => {
          if (collapsedPanes.has(idx)) return sum;
          return sum + (paneHeightsMap[idx] || 0.15);
        }, 0);
        const paneTotalH = Math.min(availHeight * 0.6, Math.floor(availHeight * totalPaneFraction));
        const activePaneCount = paneInds.filter((_: unknown, idx: number) => !collapsedPanes.has(idx)).length;
        paneHeight = activePaneCount > 0 ? Math.max(60, Math.floor(paneTotalH / activePaneCount)) : 0;
        // NOTE: Do NOT subtract paneHeight from mainHeight here.
        // The main pane's canvas is already sized by CSS flexbox (flex:1 1 auto)
        // which automatically shrinks the main pane when indicator panes are present.
        // Subtracting again would double-count and create a visible gap.
      }
    }

    // Visible range
    const end = bars.length - 1 - S.scrollOffset + 5;
    const exactStart = end - S.visibleBars + 1;
    const startIdx = Math.max(0, Math.floor(exactStart));
    const endIdx = Math.floor(end);
    const visBarsEnd = Math.min(bars.length, endIdx + 2);
    const barSpacing = chartWidth / S.visibleBars;

    // ─── Tick-Only Fast Path ─────────────────────────────────────
    // When only the last bar's close changed (streaming tick), skip
    // the full price scan, slice, and pane rebuild by reusing prev frame.
    const isTickOnly =
      !!engine._tickUpdate &&
      prev &&
      bars.length === prev.barCount &&
      startIdx === prev.startIdx &&
      endIdx === prev.endIdx &&
      S.priceScale === prev.priceScale && // Price axis drag → full recompute
      S.autoScale === prev.autoScale && // Auto-scale toggle → full recompute
      S.priceScroll === prev.priceScroll; // Price scroll change → full recompute

    let visBars: Bar[];
    let yMin: number, yMax: number;
    let panes: PaneState[];
    let paneTransforms: (PaneTransform | null)[];

    if (isTickOnly && prev) {
      // Tick fast path: reuse previous visBars but update last bar
      visBars = prev.visBars;
      if (visBars.length > 0) {
        visBars[visBars.length - 1] = bars[bars.length - 1];
      }

      // Reuse price range — last bar tick rarely escapes the range.
      // If it does, the next full frame will catch it.
      const lastBar = bars[bars.length - 1];
      if (lastBar.high > prev.yMax || lastBar.low < prev.yMin) {
        // Price escaped — fall through to full scan below
        yMin = prev.yMin;
        yMax = prev.yMax;
        // Expand range to include new extremes
        if (lastBar.low < prev.yMin) yMin = lastBar.low - (prev.yMax - prev.yMin) * 0.03;
        if (lastBar.high > prev.yMax) yMax = lastBar.high + (prev.yMax - prev.yMin) * 0.03;
      } else {
        yMin = prev.yMin;
        yMax = prev.yMax;
      }

      // Reuse pane state entirely — indicator auto-fit is stable during ticks
      panes = prev.panes;
      paneTransforms = prev.paneTransforms;
    } else {
      // P1 Task 1: Price scan via index loop — avoids slice() copy for the hot path
      let lo = Infinity,
        hi = -Infinity;
      for (let bi = startIdx; bi < visBarsEnd; bi++) {
        const b = bars[bi];
        if (b.low < lo) lo = b.low;
        if (b.high > hi) hi = b.high;
      }
      // Create visBars slice after scan (still needed by downstream stages)
      visBars = bars.slice(startIdx, visBarsEnd);
      const rng = hi - lo || 1;
      yMin = lo - rng * 0.06;
      yMax = hi + rng * 0.06;
      if (!S.autoScale) {
        const mid = (yMin + yMax) / 2,
          half = (yMax - yMin) / 2;
        yMin = mid - half * S.priceScale + S.priceScroll;
        yMax = mid + half * S.priceScale + S.priceScroll;
      }

      // ─── Phase 1: Build PaneState array ──────────────────────────
      // Creates [mainPane, pane_0, pane_1, ...] with independent Y-axis state.
      panes = buildPaneLayout(indicators, (props.paneHeights || {}) as Record<number, number>, collapsedPanes);

      // Lay out heights (main pane fills remainder)
      layoutPanes(panes, availHeight);

      // Auto-fit Y-ranges for each pane
      panes[0].autoFit(startIdx, endIdx, bars, 0.06); // main pane: 6% padding
      for (let i = 1; i < panes.length; i++) {
        panes[i].autoFit(startIdx, endIdx, undefined, 0.05);
      }

      // ─── Backward-compat: paneTransforms from PaneState ─────────
      paneTransforms = [];
      for (let i = 1; i < panes.length; i++) {
        const pane = panes[i];
        if (pane.collapsed) {
          paneTransforms.push(null);
        } else {
          paneTransforms.push({ yMin: pane.yMin, yMax: pane.yMax });
        }
      }
    }

    const percentBase = visBars.length > 0 ? visBars[0].open : 0;

    // Viewport change detection
    const viewportChanged =
      !prev ||
      startIdx !== prev.startIdx ||
      endIdx !== prev.endIdx ||
      S.visibleBars !== prev.visibleBars ||
      S.scrollOffset !== prev.scrollOffset ||
      yMin !== prev.yMin ||
      yMax !== prev.yMax ||
      mw !== prev.mediaWidth ||
      mh !== prev.mediaHeight;

    // Animation state
    const animating = !!(engine._animTarget && engine._animCurrent);

    // Theme resolution
    const { storeChartColors } = props;

    const fs = _frameStatePool.acquire();

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

    // Sprint 3: Sub-bar fractional offset for GPU panning
    // This is the fractional part of scrollOffset × barSpacing × pixelRatio
    fs.panOffset = (S.scrollOffset - Math.floor(S.scrollOffset)) * barSpacing * pr;

    // Price range
    fs.yMin = yMin;
    fs.yMax = yMax;
    fs.percentBase = percentBase;

    // Cursor
    fs.mouseX = S.mouseX;
    fs.mouseY = S.mouseY;
    fs.hoverIdx = S.hoverIdx;

    // Chart config
    fs.chartType = (props.chartType as string) || 'candlestick';
    fs.scaleMode = S.scaleMode;
    fs.autoScale = S.autoScale;
    fs.priceScale = S.priceScale;
    fs.priceScroll = S.priceScroll;
    fs.compact = compact;
    fs.showVolume = !!props.showVolume;
    fs.showHeatmap = !!props.showHeatmap;
    fs.showSessions = !!props.showSessions;
    fs.activeTimezone = (props.activeTimezone as string) || 'UTC';
    fs.useUTC = fs.activeTimezone === 'UTC'; // Backward-compat derived from activeTimezone
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

    // Theme — resolve with DOM fallback for first-frame hydration race.
    // earlyThemeInit() in theme.js sets the correct class on <html> synchronously
    // before React mounts, so we read it when the store value may be stale.
    let _theme = (props.theme as string) || 'dark';
    if (_theme === 'system') {
      _theme =
        typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    if (
      _theme === 'dark' &&
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('theme-light')
    ) {
      _theme = 'light';
    }
    fs.themeName = _theme;
    fs.storeChartColors = (storeChartColors as Record<string, string>) || null;

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
    fs.srLevels = (props.srLevels as unknown[]) || [];
    fs.trades = (props.trades as unknown[]) || null;
    fs.syncedCrosshair = engine.syncedCrosshair;
    fs.oiData = props.oiData || null;
    fs.liquidations = (props.liquidations as unknown[]) || null;
    fs.aggregatorKey = (props.aggregatorKey as string) || null;
    fs.paneHeights = (props.paneHeights as Record<number, number>) || null;
    fs.collapsedPanes = collapsedPanes;

    fs.panes = panes;
    fs.paneTransforms = paneTransforms;
    fs.patternMarkers = props.patternMarkers || null;
    fs.divergences = props.divergences || null;
    fs.heatmapIntensity = (props.heatmapIntensity as number) || 1.0;
    fs.renkoBrickSize = props.renkoBrickSize as number | undefined;
    fs.rangeBarSize = props.rangeBarSize as number | undefined;

    // Drawing version from drawing engine
    fs.drawingVersion = (engine as unknown).drawingEngine?.version ?? 0;

    return fs;
  }

  /**
   * Compute a change bitmask between this frame and the previous frame.
   * Stages use this to skip unnecessary work.
   */
  diff(prev: FrameState | null): ChangeMask {
    if (!prev) return CHANGED.ALL;

    let mask: ChangeMask = CHANGED.NONE;

    // Viewport — includes both horizontal (scroll/zoom) AND vertical (Y-axis) changes.
    // Without yMin/yMax here, price axis drag wouldn't trigger indicator/drawing re-render.
    if (
      this.startIdx !== prev.startIdx ||
      this.endIdx !== prev.endIdx ||
      this.visibleBars !== prev.visibleBars ||
      this.scrollOffset !== prev.scrollOffset ||
      this.yMin !== prev.yMin ||
      this.yMax !== prev.yMax
    ) {
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
    if (
      this.chartType !== prev.chartType ||
      this.scaleMode !== prev.scaleMode ||
      this.showVolume !== prev.showVolume ||
      this.showHeatmap !== prev.showHeatmap ||
      this.showSessions !== prev.showSessions ||
      this.compact !== prev.compact ||
      this.autoScale !== prev.autoScale
    ) {
      mask |= CHANGED.PROPS;
    }

    // Timezone
    if (this.activeTimezone !== prev.activeTimezone) {
      mask |= CHANGED.TIMEZONE;
    }

    // Size
    if (this.bitmapWidth !== prev.bitmapWidth || this.bitmapHeight !== prev.bitmapHeight) {
      mask |= CHANGED.SIZE;
    }

    // Animation
    if (this.animating || this.loadTimestamp) {
      mask |= CHANGED.ANIMATION;
    }

    // Drawings
    if (this.drawingVersion !== prev.drawingVersion) {
      mask |= CHANGED.DRAWINGS;
    }

    return mask;
  }

  /**
   * Check if specific change flags are set.
   */
  hasChanged(flags: number): boolean {
    return (this._changeMask & flags) !== 0;
  }

  /**
   * Store the computed change mask (called by RenderPipeline after diff).
   */
  setChangeMask(mask: number): void {
    this._changeMask = mask;
  }

  /**
   * Release this FrameState back to the pool for reuse (8.1.5).
   * Call this when the frame is no longer needed (after the next frame is created).
   */
  release(): void {
    _frameStatePool.release(this);
  }
}

// ─── FrameStatePool (8.1.5) ─────────────────────────────────────
// Pre-allocates FrameState objects to avoid per-frame GC pressure.
// Pool size = 4 (double-buffer + 2 spare for async consumers).

// eslint-disable-next-line @typescript-eslint/naming-convention
class _FrameStatePool {
  private readonly _pool: FrameState[] = [];
  private readonly _maxSize: number;

  constructor(size: number = 4) {
    this._maxSize = size;
    // Pre-allocate pool
    for (let i = 0; i < size; i++) {
      this._pool.push(new FrameState());
    }
  }

  /** Acquire a FrameState from the pool (or create a new one if exhausted). */
  acquire(): FrameState {
    return this._pool.pop() || new FrameState();
  }

  /** Return a FrameState to the pool for reuse. */
  release(fs: FrameState): void {
    if (this._pool.length < this._maxSize) {
      // Reset change mask before returning to pool
      fs.setChangeMask(0);
      this._pool.push(fs);
    }
    // If pool is full, let it be GC'd (shouldn't happen normally)
  }
}

/** Singleton pool instance. */
const _frameStatePool = new _FrameStatePool(4);
export { _frameStatePool as frameStatePool };
