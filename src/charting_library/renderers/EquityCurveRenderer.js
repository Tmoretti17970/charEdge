// ═══════════════════════════════════════════════════════════════════
// charEdge — Equity Curve Renderer (Task 4.8.4)
//
// Draws a cumulative P&L bezier line overlay on chart canvas.
// Green/red fill (alpha 0.3) based on above/below zero.
// Secondary Y-axis on the right side. Toolbar toggle.
// ═══════════════════════════════════════════════════════════════════


import { applySmoothing } from './equityCurveSmooth.js';

// ─── Constants ──────────────────────────────────────────────────

const PROFIT_LINE = 'rgba(34, 197, 94, 0.9)';    // green-500
const LOSS_LINE = 'rgba(239, 68, 68, 0.9)';       // red-500
const PROFIT_FILL = 'rgba(34, 197, 94, 0.08)';
const LOSS_FILL = 'rgba(239, 68, 68, 0.08)';
const LINE_WIDTH = 2;
const AXIS_WIDTH = 50;
const AXIS_FONT = '10px Inter, system-ui, sans-serif';
const AXIS_COLOR = 'rgba(148, 163, 184, 0.6)';    // slate-400 @ 60%
const AXIS_LINE = 'rgba(148, 163, 184, 0.15)';
const ZERO_LINE = 'rgba(148, 163, 184, 0.25)';

// ─── EquityCurveRenderer ────────────────────────────────────────

export class EquityCurveRenderer {
    constructor() {
        this._visible = false;
    }

    setVisible(visible) {
        this._visible = visible;
    }

    get visible() {
        return this._visible;
    }

    /**
     * Render the equity curve overlay on the chart canvas.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {Array<{date: number|string, pnl: number}>} equityPoints
     *   Sorted array of { date (epoch ms), pnl (cumulative) }
     * @param {Function} timeToX - maps epoch ms → canvas X
     * @param {Object} chartArea - { left, right, top, bottom }
     */
    render(ctx, equityPoints, timeToX, chartArea, smoothMode = 'raw') {
        if (!this._visible || !equityPoints || equityPoints.length < 2) return;

        // Apply smoothing (D4.3)
        const points_data = applySmoothing(equityPoints, smoothMode);

        const { left, right, top, bottom } = chartArea;
        const height = bottom - top;

        // Compute Y-scale from equity data
        const pnls = points_data.map((p) => p.pnl);
        const maxPnL = Math.max(...pnls, 0);
        const minPnL = Math.min(...pnls, 0);
        const range = Math.max(maxPnL - minPnL, 1);
        const padding = range * 0.1;

        const pnlToY = (pnl) => {
            return top + height - ((pnl - minPnL + padding) / (range + 2 * padding)) * height;
        };

        ctx.save();

        // Clip to chart area
        ctx.beginPath();
        ctx.rect(left, top, right - left, bottom - top);
        ctx.clip();

        // Draw zero line
        const zeroY = pnlToY(0);
        if (zeroY >= top && zeroY <= bottom) {
            ctx.strokeStyle = ZERO_LINE;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(left, zeroY);
            ctx.lineTo(right, zeroY);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Build the bezier path
        const points = [];
        for (const ep of points_data) {
            const t = typeof ep.date === 'string' ? new Date(ep.date).getTime() : ep.date;
            const x = timeToX(t);
            if (x < left - 10 || x > right + 10) continue;
            points.push({ x, y: pnlToY(ep.pnl), pnl: ep.pnl });
        }

        if (points.length < 2) {
            ctx.restore();
            return;
        }

        // Draw filled area (profit above zero green, loss below zero red)
        ctx.beginPath();
        ctx.moveTo(points[0].x, zeroY);
        ctx.lineTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const cpx = (prev.x + curr.x) / 2;
            ctx.bezierCurveTo(cpx, prev.y, cpx, curr.y, curr.x, curr.y);
        }

        ctx.lineTo(points[points.length - 1].x, zeroY);
        ctx.closePath();

        // Use gradient fill: green above zero, red below
        const lastPnL = points[points.length - 1].pnl;
        ctx.fillStyle = lastPnL >= 0 ? PROFIT_FILL : LOSS_FILL;
        ctx.fill();

        // Draw the line itself
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const cpx = (prev.x + curr.x) / 2;
            ctx.bezierCurveTo(cpx, prev.y, cpx, curr.y, curr.x, curr.y);
        }
        ctx.strokeStyle = lastPnL >= 0 ? PROFIT_LINE : LOSS_LINE;
        ctx.lineWidth = LINE_WIDTH;
        ctx.stroke();

        // Draw secondary Y-axis labels on right edge
        ctx.fillStyle = AXIS_COLOR;
        ctx.font = AXIS_FONT;
        ctx.textAlign = 'right';

        const ticks = 5;
        for (let i = 0; i <= ticks; i++) {
            const pnl = minPnL - padding + ((range + 2 * padding) * i) / ticks;
            const y = pnlToY(pnl);
            const label = pnl >= 1000
                ? `$${(pnl / 1000).toFixed(1)}k`
                : pnl <= -1000
                    ? `-$${(Math.abs(pnl) / 1000).toFixed(1)}k`
                    : `$${pnl.toFixed(0)}`;
            ctx.fillText(label, right - 4, y + 3);

            // Subtle grid line
            ctx.strokeStyle = AXIS_LINE;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(left, y);
            ctx.lineTo(right - AXIS_WIDTH, y);
            ctx.stroke();
        }

        // High label for current P&L
        if (points.length > 0) {
            const last = points[points.length - 1];
            ctx.fillStyle = last.pnl >= 0 ? PROFIT_LINE : LOSS_LINE;
            ctx.font = 'bold 11px Inter, system-ui, sans-serif';
            ctx.textAlign = 'right';
            const pnlLabel = last.pnl >= 0
                ? `+$${last.pnl.toFixed(0)}`
                : `-$${Math.abs(last.pnl).toFixed(0)}`;
            ctx.fillText(pnlLabel, right - 4, last.y - 6);
        }

        ctx.restore();
    }
}

// ─── Singleton + Export ─────────────────────────────────────────

export const equityCurveRenderer = new EquityCurveRenderer();
export default equityCurveRenderer;
