// ═══════════════════════════════════════════════════════════════════
// charEdge — InputManager Types
// Shared interfaces and types used by InputManager.
// ═══════════════════════════════════════════════════════════════════

export interface LegendHitRegion {
    x: number;
    y: number;
    w: number;
    h: number;
    type: string;
    idx: number;
}

export interface RenderSnapshot {
    bSp: number;
    start: number;
    cW: number;
    txH: number;
    pr: number;
    mainH: number;
    paneH: number;
    paneCount: number;
    yMin: number;
    yMax: number;
    [key: string]: unknown;
}

export interface ButtonRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface EngineState {
    scrollOffset: number;
    visibleBars: number;
    mouseX: number | null;
    mouseY: number | null;
    hoverIdx: number | null;
    dragging: string | false;
    dragStartX: number;
    dragStartY: number;
    dragStartOffset: number;
    dragStartVisibleBars: number;
    dragStartPriceScale: number;
    dragStartPriceScroll: number;
    autoScale: boolean;
    priceScale: number;
    priceScroll: number;
    scaleMode: string;
    mainDirty: boolean;
    topDirty: boolean;
    timeAxisZoom: boolean;
    lastRender: RenderSnapshot | null;
    collapsedPanes: Set<number>;
    hiddenIndicators: Set<number>;
    _splitterHoverIdx: number;
    _highlightedIndicator: number;
    _legendHitRegions: LegendHitRegion[] | null;
    _scrollToNowBtn: ButtonRect | null;
    _autoFitBtn: ButtonRect | null;
    [key: string]: unknown;
}

export interface DrawingEngine {
    onMouseMove(x: number, y: number): boolean;
    onMouseDown(x: number, y: number): boolean;
    onMouseUp(x: number, y: number): boolean;
    cursorHint?: string;
}

export interface LayerManager {
    markDirty(layer: string | number): void;
    markAllDirty(): void;
}

export interface EngineCallbacks {
    onPaneResize?: (idx: number, fraction: number) => void;
    onPaneToggle?: (idx: number) => void;
    onCrosshairMove?: (data: { price: number; time: number; bar: unknown; x: number; y: number }) => void;
    onBarClick?: (price: number, time: number, bar: unknown) => void;
}

export interface EngineRef {
    state: EngineState;
    topCanvas: HTMLCanvasElement;
    bars: { length: number;[idx: number]: { time: number; open: number; high: number; low: number; close: number; volume: number } };
    props: Record<string, unknown>;
    layers: LayerManager | null;
    indicators: unknown[];
    drawingEngine: DrawingEngine | null;
    callbacks: EngineCallbacks;
    symbol: string;
    timeframe: string;
    _scheduleDraw(): void;
    markDirty(): void;
}

export type TouchMode = 'pan' | 'pinch' | 'workspace-swipe' | null;
