// ═══════════════════════════════════════════════════════════════════
// charEdge — MiniChart: React Canvas Chart Component (#127)
//
// Sprint 20 #127: Lightweight React wrapper around MiniChartEngine.
// Replaces Chart.js / react-chartjs-2 for dashboard and analytics
// widgets. ~100 lines vs Chart.js ~200KB bundle.
//
// Usage:
//   <MiniChart type="line" data={[{x:0,y:1},{x:1,y:2}]} />
//   <MiniChart type="bar" data={points} options={{ color: '#26A69A' }} />
//   <MiniChart type="pie" slices={[{value:60,label:'Win',color:'#26A69A'}]} />
// ═══════════════════════════════════════════════════════════════════

import React, { useRef, useEffect, useCallback } from 'react';
import {
    drawLine, drawBar, drawArea, drawPie, drawGrid, drawAxes,
    type DataPoint, type PieSlice,
    type LineOptions, type BarOptions, type AreaOptions, type PieOptions,
    type GridOptions, type AxisOptions,
} from './MiniChartEngine.ts';

// ─── Types ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/naming-convention
type _ChartType = 'line' | 'bar' | 'area' | 'pie' | 'doughnut';

interface MiniChartBase {
    /** Chart width (CSS pixels). Default: 100% of container. */
    width?: number;
    /** Chart height (CSS pixels). Default: 200. */
    height?: number;
    /** Extra CSS class name. */
    className?: string;
    /** Show subtle background grid. */
    showGrid?: boolean;
    /** Show axis labels. */
    showAxes?: boolean;
    /** Grid options. */
    gridOptions?: GridOptions;
    /** Axis options. */
    axisOptions?: AxisOptions;
}

interface LineChartProps extends MiniChartBase {
    type: 'line';
    data: DataPoint[];
    options?: LineOptions;
}

interface BarChartProps extends MiniChartBase {
    type: 'bar';
    data: DataPoint[];
    options?: BarOptions;
}

interface AreaChartProps extends MiniChartBase {
    type: 'area';
    data: DataPoint[];
    options?: AreaOptions;
}

interface PieChartProps extends MiniChartBase {
    type: 'pie' | 'doughnut';
    slices: PieSlice[];
    options?: PieOptions;
}

export type MiniChartProps = LineChartProps | BarChartProps | AreaChartProps | PieChartProps;

// ─── Component ───────────────────────────────────────────────────

/**
 * Lightweight canvas chart component for dashboard/analytics widgets.
 * Replaces Chart.js / react-chartjs-2.
 */
export const MiniChart: React.FC<MiniChartProps> = (props) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const {
        width,
        height = 200,
        className = '',
        showGrid = true,
        showAxes = false,
        gridOptions,
        axisOptions,
    } = props;

    const render = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const container = containerRef.current;
        const w = width ?? (container?.clientWidth || 300);
        const h = height;

        // Set canvas dimensions (high-DPI aware)
        const dpr = window.devicePixelRatio || 1;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.scale(dpr, dpr);
        // Reset canvas dimensions for drawing (pre-scaled)
        ctx.canvas.width = w;
        ctx.canvas.height = h;

        // Clear
        ctx.clearRect(0, 0, w, h);

        // Grid
        if (showGrid) {
            drawGrid(ctx, gridOptions);
        }

        // Draw chart type
        switch (props.type) {
            case 'line':
                drawLine(ctx, props.data, props.options);
                break;
            case 'bar':
                drawBar(ctx, props.data, props.options);
                break;
            case 'area':
                drawArea(ctx, props.data, props.options);
                break;
            case 'pie':
            case 'doughnut': {
                const pieOpts: PieOptions = {
                    ...props.options,
                    innerRadius: props.type === 'doughnut'
                        ? (props.options?.innerRadius ?? Math.min(w, h) / 4)
                        : (props.options?.innerRadius ?? 0),
                };
                drawPie(ctx, props.slices, pieOpts);
                break;
            }
        }

        // Axes
        if (showAxes && 'data' in props) {
            drawAxes(ctx, props.data, axisOptions);
        }
    }, [props, width, height, showGrid, showAxes, gridOptions, axisOptions]);

    // Render on mount and when props change
    useEffect(() => {
        render();
    }, [render]);

    // Resize observer for responsive width
    useEffect(() => {
        if (width) return; // Fixed width, no observer needed
        const container = containerRef.current;
        if (!container) return;

        const ro = new ResizeObserver(() => render());
        ro.observe(container);
        return () => ro.disconnect();
    }, [width, render]);

    return (
        <div
            ref={containerRef}
            className={`ce-minichart ${className}`}
            style={{ width: width ? `${width}px` : '100%', height: `${height}px` }}
        >
            <canvas ref={canvasRef} />
        </div>
    );
};

export default MiniChart;
