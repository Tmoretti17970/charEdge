// ═══════════════════════════════════════════════════════════════════
// charEdge — Shared Type Definitions
//
// Centralized interfaces for the charting engine.
// All engine files should import types from this module.
// ═══════════════════════════════════════════════════════════════════

// ─── Bar Data ─────────────────────────────────────────────────────

/** A single OHLCV candlestick bar. */
export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/** Price range within a set of bars. */
export interface PriceRange {
  lo: number;
  hi: number;
}

// ─── Indicators ───────────────────────────────────────────────────

/** Configuration for a chart indicator overlay. */
export interface IndicatorConfig {
  name: string;
  values: number[] | Float32Array;
  color?: string;
  lineWidth?: number;
  dash?: number[];
  pane?: number;
}

// ─── Theme ────────────────────────────────────────────────────────

/** Resolved theme color set. */
export interface Theme {
  bg: string;
  bg2: string;
  sf: string;
  sf2: string;
  bd: string;
  bd2: string;
  t1: string;
  t2: string;
  t3: string;
  accent: string;
  green: string;
  red: string;
  yellow: string;
  purple: string;
  cyan: string;
  bull: string;
  bear: string;
  grid: string;
  crosshair: string;
  [key: string]: string;
}

// ─── Drawing Tools ────────────────────────────────────────────────

/** A 2D point in chart coordinate space. */
export interface Point {
  x: number;
  y: number;
}

/** A chart drawing tool instance. */
export interface DrawingTool {
  id: string;
  type: string;
  points: Point[];
  color?: string;
  lineWidth?: number;
  style?: string;
  text?: string;
  locked?: boolean;
  visible?: boolean;
}

// ─── Frame State ──────────────────────────────────────────────────

/** Bitmask flags indicating which parts of the frame state changed. */
export const enum ChangedFlags {
  NONE       = 0,
  VIEWPORT   = 1 << 0,
  DATA       = 1 << 1,
  THEME      = 1 << 2,
  INDICATORS = 1 << 3,
  DRAWINGS   = 1 << 4,
  PROPS      = 1 << 5,
  CURSOR     = 1 << 6,
  SIZE       = 1 << 7,
  ANIMATION  = 1 << 8,
  TICK       = 1 << 9,
  ALL        = 0x3FF,
}

/** Complete frame state snapshot for the render pipeline. */
export interface FrameStateData {
  timestamp: number;
  bitmapWidth: number;
  bitmapHeight: number;
  cssWidth: number;
  cssHeight: number;
  pixelRatio: number;
  scrollOffset: number;
  visibleBars: number;
  barCount: number;
  chartType: string;
  autoScale: boolean;
  priceScale: number;
  priceScroll: number;
  themeName: string;
  theme: Theme;
  indicators: IndicatorConfig[];
  drawings: DrawingTool[];
  crosshair: { x: number; y: number } | null;
  showVolume: boolean;
  showGrid: boolean;
  showCrosshair: boolean;
  logScale: boolean;
  percentScale: boolean;
  indexedScale: boolean;
  loadTimestamp: number | null;
  lod: Record<string, unknown>;
  symbol: string;
  timeframe: string;
  alerts: unknown[];
  srLevels: unknown[];
  trades: unknown[] | null;
  overlays: unknown[];
  paneCount: number;
  startIdx: number;
  endIdx: number;
  exactStart: number;
  visBars: Bar[];
  barSpacing: number;
  yMin: number;
  yMax: number;
  volumeHeight: number;
  viewportChanged: boolean;
  panOffset: number;
  changeMask: number;
}

// ─── Render Pipeline ──────────────────────────────────────────────

/** A render stage in the pipeline. */
export interface RenderStage {
  name: string;
  render(
    ctx: CanvasRenderingContext2D,
    fs: FrameStateData,
    prev: FrameStateData | null,
  ): void;
}

// ─── Chart Engine ─────────────────────────────────────────────────

/** Scale mode for the price axis. */
export type ScaleMode = 'linear' | 'log' | 'percent' | 'indexed';

/** Chart type rendering mode. */
export type ChartType =
  | 'candlestick'
  | 'line'
  | 'area'
  | 'heikinashi'
  | 'renko'
  | 'range'
  | 'kagi'
  | 'linebreak'
  | 'volumecandle'
  | 'hilo'
  | 'footprint'
  | 'hollow';

// ─── Bar Transform Results ────────────────────────────────────────

/** A single Renko brick (from toRenkoBricks). */
export interface RenkoBrick {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  direction: 'up' | 'down';
}

export interface RenkoBricksResult {
  bricks: RenkoBrick[];
  brickSize: number;
}

/** A range bar (from toRangeBars). */
export interface RangeBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface RangeBarsResult {
  rangeBars: RangeBar[];
  rangeSize: number;
}

/** Kagi segment (from toKagiBars). */
export interface KagiSegment {
  time: number;
  price: number;
  direction: 'up' | 'down';
  isThick: boolean;
  [key: string]: unknown;
}

export interface KagiResult {
  kagiSegments: KagiSegment[];
  reversalPct: number;
}

/** Line break bar (from toLineBreakBars). */
export interface LineBreakBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  direction: 'up' | 'down';
}

export interface LineBreakResult {
  lineBreakBars: LineBreakBar[];
}

/** Volume candle (bar with _widthRatio for proportional rendering). */
export interface VolumeCandle extends Bar {
  _widthRatio: number;
}

// ─── WebGPU Compute Results ───────────────────────────────────────

export interface MinMaxResult {
  min: Float32Array;
  max: Float32Array;
}

export interface BollingerResult {
  middle: Float32Array;
  upper: Float32Array;
  lower: Float32Array;
}

export interface MACDResult {
  macd: Float32Array;
  signal: Float32Array;
  histogram: Float32Array;
}

export interface VolumeProfileResult {
  upBins: Float32Array;
  downBins: Float32Array;
}

export interface LTTBResult {
  x: Float32Array;
  y: Float32Array;
}

export interface HitTestResult {
  hitIdx: number;
  snapPrice: number;
}
