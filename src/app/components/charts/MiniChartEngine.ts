// ═══════════════════════════════════════════════════════════════════
// charEdge — MiniChart Engine: Lightweight Canvas Rendering (#127)
//
// Sprint 20 #127: Replaces Chart.js dependency (~200KB) with a
// lightweight 2D canvas rendering engine for dashboard/analytics
// widgets. Supports Line, Bar, Area, and Pie/Doughnut chart types.
//
// Design: Pure canvas 2D — no WebGL, no framework, no dependencies.
// Each draw function takes a CanvasRenderingContext2D + data + opts.
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface DataPoint {
    x: number;
    y: number;
    label?: string;
}

export interface PieSlice {
    value: number;
    label: string;
    color: string;
}

export interface LineOptions {
    color?: string;
    lineWidth?: number;
    showDots?: boolean;
    dotRadius?: number;
    fillGradient?: boolean;
    fillAlpha?: number;
    smooth?: boolean;
}

export interface BarOptions {
    color?: string;
    barWidth?: number;
    borderRadius?: number;
    negativeColor?: string;
}

export interface AreaOptions extends LineOptions {
    fillColor?: string;
}

export interface PieOptions {
    innerRadius?: number; // > 0 makes it a doughnut
    showLabels?: boolean;
    labelColor?: string;
}

export interface GridOptions {
    lineColor?: string;
    lineWidth?: number;
    xLines?: number;
    yLines?: number;
}

export interface AxisOptions {
    color?: string;
    fontSize?: number;
    formatX?: (v: number) => string;
    formatY?: (v: number) => string;
    showX?: boolean;
    showY?: boolean;
    padding?: { top: number; right: number; bottom: number; left: number };
}

// ─── Axis Helpers ────────────────────────────────────────────────

interface Bounds {
    xMin: number; xMax: number;
    yMin: number; yMax: number;
}

function computeBounds(data: DataPoint[]): Bounds {
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (const p of data) {
        if (p.x < xMin) xMin = p.x;
        if (p.x > xMax) xMax = p.x;
        if (p.y < yMin) yMin = p.y;
        if (p.y > yMax) yMax = p.y;
    }
    // Add padding
    const yRange = yMax - yMin || 1;
    yMin -= yRange * 0.05;
    yMax += yRange * 0.05;
    return { xMin, xMax, yMin, yMax };
}

function mapX(x: number, bounds: Bounds, left: number, width: number): number {
    const range = bounds.xMax - bounds.xMin || 1;
    return left + ((x - bounds.xMin) / range) * width;
}

function mapY(y: number, bounds: Bounds, top: number, height: number): number {
    const range = bounds.yMax - bounds.yMin || 1;
    return top + height - ((y - bounds.yMin) / range) * height;
}

// ─── Draw Functions ──────────────────────────────────────────────

/**
 * Draw a line chart with optional gradient fill.
 */
export function drawLine(
    ctx: CanvasRenderingContext2D,
    data: DataPoint[],
    opts: LineOptions = {},
): void {
    if (data.length < 2) return;

    const {
        color = '#2962FF',
        lineWidth = 2,
        showDots = false,
        dotRadius = 3,
        fillGradient = false,
        fillAlpha = 0.15,
        smooth = true,
    } = opts;

    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const pad = { top: 10, right: 10, bottom: 10, left: 10 };
    const bounds = computeBounds(data);
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    ctx.save();
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    const firstX = mapX(data[0].x, bounds, pad.left, plotW);
    const firstY = mapY(data[0].y, bounds, pad.top, plotH);
    ctx.moveTo(firstX, firstY);

    if (smooth && data.length > 2) {
        // Catmull-Rom spline for smoothing
        for (let i = 0; i < data.length - 1; i++) {
            const p0 = i > 0 ? data[i - 1] : data[i];
            const p1 = data[i];
            const p2 = data[i + 1];
            const p3 = i < data.length - 2 ? data[i + 2] : p2;

            const x1 = mapX(p1.x, bounds, pad.left, plotW);
            const y1 = mapY(p1.y, bounds, pad.top, plotH);
            const x2 = mapX(p2.x, bounds, pad.left, plotW);
            const y2 = mapY(p2.y, bounds, pad.top, plotH);

            const cp1x = x1 + (mapX(p2.x, bounds, pad.left, plotW) - mapX(p0.x, bounds, pad.left, plotW)) / 6;
            const cp1y = y1 + (mapY(p2.y, bounds, pad.top, plotH) - mapY(p0.y, bounds, pad.top, plotH)) / 6;
            const cp2x = x2 - (mapX(p3.x, bounds, pad.left, plotW) - mapX(p1.x, bounds, pad.left, plotW)) / 6;
            const cp2y = y2 - (mapY(p3.y, bounds, pad.top, plotH) - mapY(p1.y, bounds, pad.top, plotH)) / 6;

            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
        }
    } else {
        for (let i = 1; i < data.length; i++) {
            ctx.lineTo(
                mapX(data[i].x, bounds, pad.left, plotW),
                mapY(data[i].y, bounds, pad.top, plotH),
            );
        }
    }

    ctx.stroke();

    // Gradient fill under the line
    if (fillGradient) {
        const lastX = mapX(data[data.length - 1].x, bounds, pad.left, plotW);
        const bottom = pad.top + plotH;

        ctx.lineTo(lastX, bottom);
        ctx.lineTo(firstX, bottom);
        ctx.closePath();

        const gradient = ctx.createLinearGradient(0, pad.top, 0, bottom);
        gradient.addColorStop(0, color + Math.round(fillAlpha * 255).toString(16).padStart(2, '0'));
        gradient.addColorStop(1, color + '00');
        ctx.fillStyle = gradient;
        ctx.fill();
    }

    // Dots
    if (showDots) {
        ctx.fillStyle = color;
        for (const p of data) {
            ctx.beginPath();
            ctx.arc(
                mapX(p.x, bounds, pad.left, plotW),
                mapY(p.y, bounds, pad.top, plotH),
                dotRadius, 0, Math.PI * 2,
            );
            ctx.fill();
        }
    }

    ctx.restore();
}

/**
 * Draw a bar chart with optional rounded corners.
 */
export function drawBar(
    ctx: CanvasRenderingContext2D,
    data: DataPoint[],
    opts: BarOptions = {},
): void {
    if (data.length === 0) return;

    const {
        color = '#26A69A',
        barWidth: bw,
        borderRadius = 3,
        negativeColor = '#EF5350',
    } = opts;

    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const pad = { top: 10, right: 10, bottom: 10, left: 10 };
    const bounds = computeBounds(data);
    // Ensure 0 is in the range for proper bar orientation
    if (bounds.yMin > 0) bounds.yMin = 0;
    if (bounds.yMax < 0) bounds.yMax = 0;
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    const barWidth = bw ?? Math.max(1, (plotW / data.length) * 0.7);
    const zeroY = mapY(0, bounds, pad.top, plotH);

    ctx.save();

    for (const p of data) {
        const x = mapX(p.x, bounds, pad.left, plotW) - barWidth / 2;
        const y = mapY(p.y, bounds, pad.top, plotH);
        const barH = zeroY - y;

        ctx.fillStyle = p.y >= 0 ? color : negativeColor;

        if (borderRadius > 0 && Math.abs(barH) > borderRadius * 2) {
            // Rounded top corners
            const r = Math.min(borderRadius, barWidth / 2);
            ctx.beginPath();
            if (barH > 0) {
                ctx.moveTo(x, zeroY);
                ctx.lineTo(x, y + r);
                ctx.quadraticCurveTo(x, y, x + r, y);
                ctx.lineTo(x + barWidth - r, y);
                ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + r);
                ctx.lineTo(x + barWidth, zeroY);
            } else {
                ctx.moveTo(x, zeroY);
                ctx.lineTo(x, y - r);
                ctx.quadraticCurveTo(x, y, x + r, y);
                ctx.lineTo(x + barWidth - r, y);
                ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y - r);
                ctx.lineTo(x + barWidth, zeroY);
            }
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.fillRect(x, Math.min(y, zeroY), barWidth, Math.abs(barH));
        }
    }

    ctx.restore();
}

/**
 * Draw an area chart (line with filled area underneath).
 */
export function drawArea(
    ctx: CanvasRenderingContext2D,
    data: DataPoint[],
    opts: AreaOptions = {},
): void {
    drawLine(ctx, data, { ...opts, fillGradient: true });
}

/**
 * Draw a pie or doughnut chart.
 */
export function drawPie(
    ctx: CanvasRenderingContext2D,
    slices: PieSlice[],
    opts: PieOptions = {},
): void {
    if (slices.length === 0) return;

    const {
        innerRadius = 0,
        showLabels = true,
        labelColor = '#E0E3EB',
    } = opts;

    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) / 2 - 10;
    const total = slices.reduce((s, sl) => s + sl.value, 0);
    if (total === 0) return;

    ctx.save();
    let angle = -Math.PI / 2;

    for (const slice of slices) {
        const sliceAngle = (slice.value / total) * Math.PI * 2;
        const endAngle = angle + sliceAngle;

        ctx.beginPath();
        ctx.moveTo(
            cx + Math.cos(angle) * innerRadius,
            cy + Math.sin(angle) * innerRadius,
        );
        ctx.arc(cx, cy, radius, angle, endAngle);
        if (innerRadius > 0) {
            ctx.arc(cx, cy, innerRadius, endAngle, angle, true);
        } else {
            ctx.lineTo(cx, cy);
        }
        ctx.closePath();
        ctx.fillStyle = slice.color;
        ctx.fill();

        // Label
        if (showLabels && sliceAngle > 0.2) {
            const labelAngle = angle + sliceAngle / 2;
            const labelR = innerRadius > 0
                ? (radius + innerRadius) / 2
                : radius * 0.65;
            const lx = cx + Math.cos(labelAngle) * labelR;
            const ly = cy + Math.sin(labelAngle) * labelR;

            ctx.fillStyle = labelColor;
            ctx.font = '11px Inter, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(slice.label, lx, ly);
        }

        angle = endAngle;
    }

    ctx.restore();
}

/**
 * Draw a subtle background grid.
 */
export function drawGrid(
    ctx: CanvasRenderingContext2D,
    opts: GridOptions = {},
): void {
    const {
        lineColor = 'rgba(120, 123, 134, 0.08)',
        lineWidth = 1,
        xLines = 5,
        yLines = 4,
    } = opts;

    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    ctx.save();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth;

    // Horizontal grid lines
    for (let i = 1; i < yLines; i++) {
        const y = Math.round((h / yLines) * i) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }

    // Vertical grid lines
    for (let i = 1; i < xLines; i++) {
        const x = Math.round((w / xLines) * i) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }

    ctx.restore();
}

/**
 * Draw minimal axis labels.
 */
export function drawAxes(
    ctx: CanvasRenderingContext2D,
    data: DataPoint[],
    opts: AxisOptions = {},
): void {
    if (data.length < 2) return;

    const {
        color = 'rgba(120, 123, 134, 0.7)',
        fontSize = 10,
        formatX = (v: number) => String(Math.round(v)),
        formatY = (v: number) => v.toFixed(1),
        showX = true,
        showY = true,
        padding = { top: 10, right: 10, bottom: 20, left: 40 },
    } = opts;

    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const bounds = computeBounds(data);

    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;

    if (showY) {
        const steps = 4;
        for (let i = 0; i <= steps; i++) {
            const val = bounds.yMin + ((bounds.yMax - bounds.yMin) / steps) * i;
            const y = mapY(val, bounds, padding.top, h - padding.top - padding.bottom);
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(formatY(val), padding.left - 4, y);
        }
    }

    if (showX) {
        const steps = Math.min(5, data.length);
        for (let i = 0; i < steps; i++) {
            const idx = Math.round((data.length - 1) * (i / (steps - 1)));
            const p = data[idx];
            const x = mapX(p.x, bounds, padding.left, w - padding.left - padding.right);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(formatX(p.x), x, h - padding.bottom + 4);
        }
    }

    ctx.restore();
}
