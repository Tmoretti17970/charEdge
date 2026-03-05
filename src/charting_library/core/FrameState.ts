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

import type { Bar, IndicatorConfig, Theme } from '../../types/chart.js';

/**
 * Bitmask flags indicating which parts of the frame state changed.
 * Stages check these to decide whether they need to re-render.
 */
export const CHANGED = {
  NONE: 0,
  VIEWPORT: 1 << 0,   // scroll, zoom, visibleBars changed
  DATA: 1 << 1,   // bars array changed (length or content)
  THEME: 1 << 2,   // theme or chart colors changed
  INDICATORS: 1 << 3,   // indicator config changed
  DRAWINGS: 1 << 4,   // drawing state changed
  MOUSE: 1 << 5,   // cursor position changed
  PROPS: 1 << 6,   // chart type, scale mode, overlays changed
  SIZE: 1 << 7,   // canvas dimensions changed
  ANIMATION: 1 << 8,   // candle entrance or tick animation active
  TICK: 1 << 9,   // last bar updated, bar count unchanged (incremental)
  ALL: 0x3FF,     // all bits set
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
  static create(engine: EngineSnapshot, lod: Record<string, any>, prev: FrameState | null): FrameState {
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
    const indicators = (engine.indicators || []) as any[];
    const overlayInds = indicators.filter((i: any) => i.mode === 'overlay').slice(0, (lod as any).maxIndicators);
    const paneInds = indicators.filter((i: any) => i.mode === 'pane').slice(0, Math.max(0, (lod as any).maxIndicators - overlayInds.length));
    const paneCount = paneInds.length;

    let paneHeight = 0, mainHeight = availHeight;
    const collapsedPanes: Set<number> = engine.state.collapsedPanes || new Set();
    if (paneCount > 0) {
      const paneHeightsMap = (props.paneHeights || {}) as Record<number, number>;
      const totalPaneFraction = paneInds.reduce((sum: number, _: any, idx: number) => {
        if (collapsedPanes.has(idx)) return sum; // collapsed panes don't take space
        return sum + (paneHeightsMap[idx] || 0.15);
      }, 0);
      const paneTotalH = Math.min(availHeight * 0.6, Math.floor(availHeight * totalPaneFraction));
      const activePaneCount = paneInds.filter((_: any, idx: number) => !collapsedPanes.has(idx)).length;
      paneHeight = activePaneCount > 0 ? Math.max(60, Math.floor(paneTotalH / activePaneCount)) : 0;
      mainHeight = Math.max(100, availHeight - paneHeight * activePaneCount);
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
    fs.useUTC = props.useUTC !== false; // Sprint 9: UTC/local time toggle (default UTC)
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
    fs.themeName = (props.theme as string) || 'dark';
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

    // Sprint 11: Per-pane independent price transforms
    // Each indicator pane gets its own yMin/yMax based on its data range.
    const paneTransforms: (PaneTransform | null)[] = [];
    if (paneCount > 0) {
      for (let i = 0; i < paneCount; i++) {
        const ind = paneInds[i] as any;
        if (!ind || !ind.computed || collapsedPanes.has(i)) {
          paneTransforms.push(null);
          continue;
        }
        // Scan all outputs to find data range
        let pMin = Infinity, pMax = -Infinity;
        for (const output of ind.outputs) {
          const vals = ind.computed[output.key];
          if (!vals) continue;
          const s = Math.max(0, startIdx);
          const e = Math.min(vals.length - 1, endIdx);
          for (let j = s; j <= e; j++) {
            const v = vals[j];
            if (v != null && isFinite(v)) {
              if (v < pMin) pMin = v;
              if (v > pMax) pMax = v;
            }
          }
        }
        if (pMin === Infinity) { pMin = 0; pMax = 100; }
        const pRng = pMax - pMin || 1;
        pMin -= pRng * 0.05;
        pMax += pRng * 0.05;
        paneTransforms.push({ yMin: pMin, yMax: pMax });
      }
    }
    fs.paneTransforms = paneTransforms;
    fs.patternMarkers = props.patternMarkers || null;
    fs.divergences = props.divergences || null;
    fs.heatmapIntensity = (props.heatmapIntensity as number) || 1.0;
    fs.renkoBrickSize = props.renkoBrickSize as number | undefined;
    fs.rangeBarSize = props.rangeBarSize as number | undefined;

    // Drawing version from drawing engine
    fs.drawingVersion = (engine as any).drawingEngine?.version ?? 0;

    return fs;
  }

  /**
   * Compute a change bitmask between this frame and the previous frame.
   * Stages use this to skip unnecessary work.
   */
  diff(prev: FrameState | null): ChangeMask {
    if (!prev) return CHANGED.ALL;

    let mask: ChangeMask = CHANGED.NONE;

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
