// ═══════════════════════════════════════════════════════════════════
// charEdge — Render Stage Types
//
// Shared type definitions for all pipeline render stages.
// Each stage receives the same (fs, ctx, engine) triple.
// ═══════════════════════════════════════════════════════════════════

import type { Bar } from '../../../types/data.js';

// Re-declare minimal shapes from chart.d.ts to avoid import path issues
// with ambient declaration files (.d.ts) in mixed JS/TS codebases.
type Theme = Record<string, string>;
type FrameStateData = Record<string, unknown>;

// ─── Forward declarations for types from other modules ───────────
// These avoid circular imports while providing concrete types.

/** Price transform returned by createPriceTransform(). */
export interface PriceTransform {
  priceToY: (price: number) => number;
  yToPrice: (y: number) => number;
  formatTicks: (ticks: number[]) => Array<{ price: number; label: string }>;
}

/** Time transform returned by createTimeTransform(). */
export interface TimeTransform {
  indexToPixel: (idx: number) => number;
  pixelToIndex: (px: number) => number;
  pixelToTime: (px: number) => number;
  timeToPixel: (time: number) => number;
}

/** Nice scale result from niceScale(). */
export interface NiceScaleResult {
  ticks: number[];
  step: number;
  min: number;
  max: number;
}

/** Render contexts passed to each stage. */
export interface StageContext {
  /** Per-layer 2D contexts */
  layers: {
    isDirty(layer: number): boolean;
    clearDirty(layer: number): void;
    markDirty(layer: number): void;
    getCanvas(layer: number): HTMLCanvasElement;
    getCtx(layer: number): CanvasRenderingContext2D;
  };
  /** Resolved theme colors */
  theme: Theme;
  /** Grid layer context */
  gridCtx: CanvasRenderingContext2D;
  /** Main data layer context */
  mainCtx: CanvasRenderingContext2D;
  /** Top/UI layer context */
  topCtx: CanvasRenderingContext2D;
  /** Indicator layer context */
  indicatorCtx: CanvasRenderingContext2D;
  /** Drawing layer context */
  drawingCtx: CanvasRenderingContext2D;
  /** WebGL renderer (may be null) */
  webgl: {
    available: boolean;
    gl?: WebGLRenderingContext | WebGL2RenderingContext;
    canvas: HTMLCanvasElement;
    drawGrid?: (lines: { horizontal: Array<{ y: number; isMajor: boolean }> }, params: { pixelRatio: number; chartWidth: number; mainHeight: number }, theme: Theme) => void;
    drawCandles?: (bars: Bar[], params: Record<string, unknown>, theme: Theme) => void;
    drawVolume?: (bars: Bar[], params: Record<string, unknown>, theme: Theme) => void;
    drawLine?: (bars: Bar[], params: Record<string, unknown>, color: string, width: number) => void;
    drawArea?: (bars: Bar[], params: Record<string, unknown>, color: string, fill: string) => void;
    drawAALine?: (...args: unknown[]) => void;
    drawSDFText?: (...args: unknown[]) => void;
    measureSDFText?: (...args: unknown[]) => number;
    drawIndicatorLines?: (...args: unknown[]) => void;
    drawFibFill?: (...args: unknown[]) => void;
    drawVolumeProfile?: (...args: unknown[]) => void;
    drawHeatmap?: (...args: unknown[]) => void;
    getProgram?: (name: string) => unknown;
    updateLastCandle?: (bar: Bar, params: Record<string, unknown>, theme: Theme) => boolean;
    updateLastVolume?: (bar: Bar, params: Record<string, unknown>, theme: Theme) => void;
    redrawWithPanOffset?: (offset: number, range: { yMin: number; yMax: number }) => void;
    _lastCandleInstanceCount?: number;
    clear?: () => void;
    setFrameUniforms?: (bw: number, bh: number, pr: number) => void;
    resize?: (w: number, h: number) => void;
    dispose?: () => void;
  } | null;
  /** GPU command buffer for deferred draw calls */
  commandBuffer: Array<{
    program: unknown;
    blendMode: number;
    texture: unknown;
    zOrder: number;
    label: string;
    drawFn: () => void;
  }> | null;
  /** Top canvas element ref */
  topCanvas: HTMLCanvasElement;
  /** Main canvas element ref */
  mainCanvas: HTMLCanvasElement;
}

/** Minimal ChartEngine interface used by stages (avoids circular import). */
export interface StageEngine {
  state: {
    visibleBars: number;
    scrollOffset: number;
    mouseX: number | null;
    mouseY: number | null;
    hoverIdx: number | null;
    dragging: string | false;
    priceScale: number;
    priceScroll: number;
    autoScale: boolean;
    scaleMode: string;
    mainDirty: boolean;
    topDirty: boolean;
    lastRender: Record<string, unknown> | null;
    historyLoading: boolean;
    collapsedPanes: Set<number>;
    _splitterHoverIdx: number;
    _highlightedIndicator: number;
    hiddenIndicators: Set<number>;
    _legendHitRegions: unknown[];
    yAxisLocked: boolean;
    _scrollToNowBtn?: { x: number; y: number; w: number; h: number } | null;
    _autoFitBtn?: { x: number; y: number; w: number; h: number } | null;
  };
  bars: Bar[];
  props: {
    symbol?: string;
    tf?: string;
    chartType?: string;
    theme?: string;
    compact?: boolean;
    showVolume?: boolean;
    showHeatmap?: boolean;
    showSessions?: boolean;
    showDeltaOverlay?: boolean;
    showVPOverlay?: boolean;
    showLargeTradesOverlay?: boolean;
    showOIOverlay?: boolean;
    magnetMode?: boolean;
    useUTC?: boolean;
    activeTimezone?: string;
    trades?: unknown[];
    srLevels?: unknown[];
    oiData?: unknown;
    liquidations?: unknown[];
    aggregatorKey?: string;
    paneHeights?: Record<number, number>;
    patternMarkers?: unknown;
    divergences?: unknown;
    heatmapIntensity?: number;
    renkoBrickSize?: number;
    rangeBarSize?: number;
    storeChartColors?: Record<string, string>;
  };
  indicators: unknown[];
  alerts: unknown[];
  symbol: string;
  timeframe: string;
  drawingEngine: {
    setCoordinateConverters?: (converters: Record<string, (v: number) => number>) => void;
    setGridTicks?: (ticks: number[]) => void;
    setIndicatorData?: (data: unknown[]) => void;
    setHoverBarIdx?: (idx: number | null) => void;
    getDrawings?: () => unknown[];
    loadDrawings?: (drawings: unknown[]) => void;
    dispose?: () => void;
  } | null;
  drawingRenderer: unknown;
  syncedCrosshair: { time: number; price: number } | null;
  _webglRenderer: StageContext['webgl'];
  _sceneGraph: unknown;
  _lastNiceStep: NiceScaleResult | null;
  _lastDisplayTicks: Array<{ price: number; label: string }> | null;
  _lastPriceTransform: PriceTransform | null;
  _lastTimeTransform: TimeTransform | null;
  _loadTimestamp: number | null;
  _tickUpdate: boolean;
  _barBuffer: { fromArray: (bars: Bar[]) => void; updateLast: (bar: Bar) => void };
  _gpuCompute: unknown;
  _workerBridge: unknown;
  _pipeline: { _prevFrameState: FrameStateData | null } | null;
  _niceStepTransition: { startTime: number; fromTicks: number[]; toTicks: number[]; duration: number } | null;
  _prevNiceStepKey: string;
  _prevPriceLineY: number | null;
  _cachedDrawFn: ((ctx: CanvasRenderingContext2D, bars: Bar[], params: Record<string, unknown>, theme: Theme, extra?: unknown) => void) | null;
  _cachedChartType: string | null;
  _dataStageWorkerCache: {
    chartType: string;
    barCount: number;
    bars: Bar[];
    renderStart: number;
    allTransformedBars?: Bar[];
    transformMeta?: unknown;
  } | null;
  callbacks: {
    onPrefetch?: () => void;
    onDrawingsChange?: (drawings: unknown[]) => void;
    onDrawingStateChange?: (state: unknown) => void;
    onCrosshairMove?: (data: { price: number; time: number; bar: unknown; x: number; y: number }) => void;
    onBarClick?: (price: number, time: number, bar: unknown) => void;
    onPaneResize?: (idx: number, fraction: number) => void;
    onPaneToggle?: (idx: number) => void;
    onDrawingAlert?: (alert: unknown) => void;
  };
  renderTradeMarkers: (ctx: CanvasRenderingContext2D, trades: unknown[] | null, symbol: string, bars: Bar[], start: number, end: number, timeTransform: TimeTransform, priceToY: (p: number) => number, pr: number) => void;
  markDirty: () => void;
}

/**
 * A render stage executor function.
 * All stages follow this same signature.
 */
export type StageExecutor = (
  fs: FrameStateData,
  ctx: StageContext,
  engine: StageEngine,
) => void;
