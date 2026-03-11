import { logger } from '@/observability/logger';

// ═══════════════════════════════════════════════════════════════════
// charEdge — Public Chart API
//
// Phase 3 Task 3.3.1 + 3.3.4: Programmatic chart control interface.
//
// Wraps ChartEngine with a clean, documented API surface.
// Consumers call these methods instead of touching engine internals.
//
// Usage:
//   import { ChartAPI } from './ChartAPI.ts';
//   const api = new ChartAPI(engine);
//   api.setSymbol('ETHUSDT');
//   api.setTimeframe('4h');
//   api.on('rangeChange', (range) => logger.engine.info(range));
//   const png = api.exportImage('png');
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface VisibleRange {
    from: number;     // Start timestamp (ms)
    to: number;       // End timestamp (ms)
    barCount: number;  // Number of visible bars
}

export interface ChartClickData {
    price: number;
    time: number;
    barIndex: number;
    x: number;
    y: number;
}

export interface CrosshairData {
    price: number;
    time: number;
    x: number;
    y: number;
    bar: unknown | null;
}

export type ChartEventType = 'click' | 'crosshairMove' | 'rangeChange' | 'symbolChange' | 'timeframeChange';
type Listener = (...args: unknown[]) => void;

// ─── Public API ──────────────────────────────────────────────────

interface ChartEngineRef {
    props: Record<string, unknown>;
    bars: unknown[];
    symbol: string;
    timeframe: string;
    state: Record<string, unknown>;
    getCanvas(): HTMLCanvasElement;
    _scheduleDraw(): void;
    resize(): void;
    container: HTMLElement;
    indicators: unknown[];
    callbacks: Record<string, unknown>;
}

export class ChartAPI {
    private _engine: ChartEngineRef;
    private _listeners: Map<string, Set<Listener>>;

    constructor(engine: ChartEngineRef) {
        this._engine = engine;
        this._listeners = new Map();
    }

    // ─── Symbol & Timeframe ──────────────────────────────────

    /** Change the displayed symbol (triggers full data reload). */
    setSymbol(symbol: string): void {
        const old = this._engine.symbol;
        this._engine.props.symbol = symbol;
        this._engine.symbol = symbol;
        this._emit('symbolChange', { from: old, to: symbol });
    }

    /** Change the timeframe (triggers full data reload). */
    setTimeframe(tf: string): void {
        const old = this._engine.timeframe;
        this._engine.props.tf = tf;
        this._engine.timeframe = tf;
        this._emit('timeframeChange', { from: old, to: tf });
    }

    /** Get the current symbol. */
    getSymbol(): string {
        return this._engine.symbol;
    }

    /** Get the current timeframe. */
    getTimeframe(): string {
        return this._engine.timeframe;
    }

    // ─── Chart Type ──────────────────────────────────────────

    /** Change chart type (candlestick, line, area, etc.). */
    setChartType(type: string): void {
        this._engine.props.chartType = type;
        if (this._engine.state) {
            this._engine.state.chartType = type;
        }
        this._engine._scheduleDraw();
    }

    // ─── Indicators ──────────────────────────────────────────

    /** Add an indicator overlay or pane. */
    addIndicator(config: { type: string; params?: Record<string, number>; pane?: boolean }): number {
        const indicators = this._engine.indicators || [];
        const id = indicators.length;
        indicators.push({ ...config, id });
        this._engine.indicators = indicators;
        this._engine._scheduleDraw();
        return id;
    }

    /** Remove an indicator by ID. */
    removeIndicator(id: number): void {
        if (this._engine.indicators) {
            this._engine.indicators = this._engine.indicators.filter(
                (ind: { id?: number }) => ind.id !== id
            );
            this._engine._scheduleDraw();
        }
    }

    // ─── Visible Range ───────────────────────────────────────

    /** Get the currently visible time range. */
    getVisibleRange(): VisibleRange {
        const bars = this._engine.bars || [];
        const state = this._engine.state || {};
        const visibleBars = (state.visibleBars as number) || 80;
        const scrollOffset = (state.scrollOffset as number) || 0;
        const endIdx = Math.min(bars.length - 1, bars.length - 1 - scrollOffset);
        const startIdx = Math.max(0, endIdx - visibleBars + 1);

        const from = (bars[startIdx] as { time?: number })?.time || 0;
        const to = (bars[endIdx] as { time?: number })?.time || 0;

        return {
            from,
            to,
            barCount: endIdx - startIdx + 1,
        };
    }

    /** Scroll to show a specific time (best effort). */
    scrollToTime(timestamp: number): void {
        const bars = this._engine.bars || [];
        let targetIdx = -1;
        for (let i = 0; i < bars.length; i++) {
            if ((bars[i] as { time?: number }).time! >= timestamp) {
                targetIdx = i;
                break;
            }
        }
        if (targetIdx >= 0 && this._engine.state) {
            this._engine.state.scrollOffset = Math.max(0, bars.length - 1 - targetIdx);
            this._engine._scheduleDraw();
        }
    }

    // ─── Export ──────────────────────────────────────────────

    /** Export the chart as an image data URL. */
    exportImage(format: 'png' | 'jpeg' = 'png', quality = 0.92): string {
        const canvas = this._engine.getCanvas();
        return canvas.toDataURL(`image/${format}`, quality);
    }

    /** Export chart as Blob (for download). */
    async exportBlob(format: 'png' | 'jpeg' = 'png', quality = 0.92): Promise<Blob | null> {
        const canvas = this._engine.getCanvas();
        return new Promise((resolve) => {
            canvas.toBlob(resolve, `image/${format}`, quality);
        });
    }

    // ─── Events ──────────────────────────────────────────────

    /** Subscribe to a chart event. Returns unsubscribe function. */
    on(event: ChartEventType, listener: Listener): () => void {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event)!.add(listener);
        return () => this._listeners.get(event)?.delete(listener);
    }

    /** Remove a specific event listener. */
    off(event: ChartEventType, listener: Listener): void {
        this._listeners.get(event)?.delete(listener);
    }

    /** Emit an event to all listeners. */
    private _emit(event: string, data?: unknown): void {
        const listeners = this._listeners.get(event);
        if (listeners) {
            for (const fn of listeners) {
                try {
                    fn(data);
                } catch (e) { logger.engine.warn('Operation failed', e); }
            }
        }
    }

    // ─── Resize & Refresh ────────────────────────────────────

    /** Force a chart resize (call after container dimension changes). */
    resize(): void {
        this._engine.resize();
    }

    /** Force a full redraw. */
    refresh(): void {
        this._engine._scheduleDraw();
    }
}

export default ChartAPI;
