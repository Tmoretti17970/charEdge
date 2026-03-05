// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Engine Types
//
// Phase 2 Task 2.1.5: Type ChartEngine public API.
// These types define the contract between chart consumers and the
// rendering engine.
// ═══════════════════════════════════════════════════════════════════

import type { Bar, Timeframe } from './data.js';

// ─── Chart Configuration ─────────────────────────────────────────

export type ChartType = 'candlestick' | 'heikinAshi' | 'line' | 'area' | 'baseline' | 'ohlcBar';

export interface ChartProps {
    /** Trading symbol (e.g. 'BTCUSDT') */
    symbol: string;
    /** Chart timeframe */
    timeframe: Timeframe;
    /** Chart type */
    chartType: ChartType;
    /** Chart width in CSS pixels */
    width: number;
    /** Chart height in CSS pixels */
    height: number;
    /** Device pixel ratio for HiDPI rendering */
    dpr?: number;
    /** Whether to show the volume sub-chart */
    showVolume?: boolean;
    /** Whether to show the crosshair */
    showCrosshair?: boolean;
    /** Whether to show grid lines */
    showGrid?: boolean;
    /** Active indicators */
    indicators?: IndicatorConfig[];
    /** Active drawings */
    drawings?: DrawingState[];
    /** Theme overrides */
    theme?: Partial<ChartTheme>;
}

// ─── Callbacks ───────────────────────────────────────────────────

export interface ChartCallbacks {
    /** Called when user clicks on chart area */
    onClick?: (event: ChartClickEvent) => void;
    /** Called when crosshair moves */
    onCrosshairMove?: (event: CrosshairEvent) => void;
    /** Called when visible range changes (pan/zoom) */
    onRangeChange?: (range: VisibleRange) => void;
    /** Called when a drawing is created/modified/deleted */
    onDrawingChange?: (drawings: DrawingState[]) => void;
    /** Called when chart requests more historical data */
    onLoadMore?: (from: number, to: number) => void;
    /** Called on context menu */
    onContextMenu?: (event: ChartClickEvent) => void;
}

// ─── Events ──────────────────────────────────────────────────────

export interface ChartClickEvent {
    /** X coordinate in CSS pixels */
    x: number;
    /** Y coordinate in CSS pixels */
    y: number;
    /** Price at click position */
    price: number;
    /** Timestamp at click position */
    time: number;
    /** Bar index at click position */
    barIndex: number;
    /** The bar at click position (null if in padding area) */
    bar: Bar | null;
}

export interface CrosshairEvent {
    /** Price at crosshair position */
    price: number;
    /** Timestamp at crosshair position */
    time: number;
    /** Bar at crosshair position */
    bar: Bar | null;
    /** X/Y in CSS pixels */
    x: number;
    y: number;
}

export interface VisibleRange {
    /** Start timestamp of visible range (ms) */
    from: number;
    /** End timestamp of visible range (ms) */
    to: number;
    /** Number of bars visible */
    barCount: number;
    /** Bars per pixel */
    barWidth: number;
}

// ─── Indicators ──────────────────────────────────────────────────

export type IndicatorPane = 'overlay' | 'separate';

export interface IndicatorConfig {
    /** Unique indicator instance ID */
    id: string;
    /** Indicator type (e.g. 'sma', 'ema', 'rsi', 'macd') */
    type: string;
    /** Parameters for the indicator */
    params: Record<string, number | string | boolean>;
    /** Where to render: overlay on price chart or separate pane */
    pane: IndicatorPane;
    /** Display color */
    color?: string;
    /** Line width */
    lineWidth?: number;
    /** Whether visible */
    visible?: boolean;
}

// ─── Drawings ────────────────────────────────────────────────────

export type DrawingToolType =
    | 'trendline'
    | 'horizontalLine'
    | 'horizontalRay'
    | 'channel'
    | 'rectangle'
    | 'fibonacci'
    | 'pitchfork'
    | 'elliotWave'
    | 'textNote'
    | 'priceRange'
    | 'dateRange';

export interface DrawingPoint {
    time: number;
    price: number;
}

export interface DrawingState {
    id: string;
    type: DrawingToolType;
    points: DrawingPoint[];
    style: {
        color: string;
        lineWidth: number;
        lineStyle: 'solid' | 'dashed' | 'dotted';
        fillColor?: string;
        fillOpacity?: number;
        fontSize?: number;
        text?: string;
    };
    /** Whether the drawing is locked (not editable) */
    locked?: boolean;
    /** Whether the drawing is visible */
    visible?: boolean;
    /** Timeframe the drawing was created on */
    createdOnTimeframe?: Timeframe;
    createdAt: string;
    updatedAt: string;
}

// ─── Theme ───────────────────────────────────────────────────────

export interface ChartTheme {
    background: string;
    gridColor: string;
    textColor: string;
    crosshairColor: string;
    bullColor: string;
    bearColor: string;
    volumeBullColor: string;
    volumeBearColor: string;
    wickColor: string;
    borderColor: string;
    fontFamily: string;
    fontSize: number;
}

// ─── Public API ──────────────────────────────────────────────────

export interface ChartEngineAPI {
    /** Set the trading symbol */
    setSymbol(symbol: string): void;
    /** Set the timeframe */
    setTimeframe(timeframe: Timeframe): void;
    /** Set the chart type */
    setChartType(type: ChartType): void;
    /** Add/update bar data */
    updateData(bars: Bar[]): void;
    /** Update the last bar (streaming) */
    updateLastBar(bar: Bar): void;
    /** Add an indicator overlay */
    addIndicator(config: IndicatorConfig): string;
    /** Remove an indicator */
    removeIndicator(id: string): void;
    /** Get current visible range */
    getVisibleRange(): VisibleRange;
    /** Set visible range */
    setVisibleRange(from: number, to: number): void;
    /** Export chart as PNG data URL */
    exportImage(format?: 'png' | 'svg'): Promise<string>;
    /** Force a re-render */
    forceRender(): void;
    /** Destroy the chart instance */
    destroy(): void;
}
