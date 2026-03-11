// ═══════════════════════════════════════════════════════════════════
// charEdge — Ghost Box Renderer (Tasks 4.8.1–3, 4.8.5)
//
// Renders semi-transparent entry→exit rectangles on the chart canvas.
// Win = green alpha fill, Loss = red alpha fill, dashed border.
// Uses SpatialIndex for O(1) cursor hit-testing (Sprint 13–14, Task #100).
//
// Heatmap mode (4.8.5): behavioral color-coding using LeakDetector
// tags — FOMO pulses red, REVENGE pulses orange, FEAR pulses yellow,
// clean trades glow green.
// ═══════════════════════════════════════════════════════════════════

import { SpatialIndex } from '../scene/SpatialIndex.js';

// ─── Constants ──────────────────────────────────────────────────

const WIN_COLOR = 'rgba(34, 197, 94, 0.12)';     // green-500 @ 12%
const WIN_BORDER = 'rgba(34, 197, 94, 0.5)';
const LOSS_COLOR = 'rgba(239, 68, 68, 0.12)';     // red-500 @ 12%
const LOSS_BORDER = 'rgba(239, 68, 68, 0.5)';
const FLAT_COLOR = 'rgba(148, 163, 184, 0.08)';   // slate-400 @ 8%
const FLAT_BORDER = 'rgba(148, 163, 184, 0.3)';
const DASH_PATTERN = [6, 4];
const BORDER_WIDTH = 1.5;

// ─── Heatmap Colors (Task 4.8.5 — Mistake Heatmap) ──────────────

/** @type {Record<string, {fill: string, border: string}>} */
const HEATMAP_COLORS = {
    FOMO: { fill: 'rgba(255, 60, 60, 0.18)', border: 'rgba(255, 60, 60, 0.6)' },
    REVENGE: { fill: 'rgba(255, 140, 0, 0.18)', border: 'rgba(255, 140, 0, 0.6)' },
    FEAR: { fill: 'rgba(255, 200, 0, 0.18)', border: 'rgba(255, 200, 0, 0.6)' },
    HOPE: { fill: 'rgba(255, 180, 50, 0.14)', border: 'rgba(255, 180, 50, 0.5)' },
    TILT: { fill: 'rgba(220, 80, 200, 0.16)', border: 'rgba(220, 80, 200, 0.5)' },
    OVEREXPOSURE: { fill: 'rgba(180, 80, 255, 0.14)', border: 'rgba(180, 80, 255, 0.5)' },
    CLEAN: { fill: 'rgba(34, 197, 94, 0.14)', border: 'rgba(34, 197, 94, 0.5)' },
};

// ─── Types ──────────────────────────────────────────────────────

/**
 * @typedef {Object} TradeForGhostBox
 * @property {string} id
 * @property {number} entryPrice
 * @property {number} [exitPrice]
 * @property {number|string} entryDate   - epoch ms or ISO string
 * @property {number|string} [exitDate]  - epoch ms or ISO string
 * @property {number} [pnl]
 * @property {string} [side]
 * @property {string} [setup]
 * @property {string} [emotion]
 * @property {string} [notes]
 * @property {string[]} [tags]
 * @property {number} [rMultiple]
 * @property {string} [leakTag]  - LeakDetector tag for heatmap mode (FOMO, REVENGE, FEAR, etc.)
 */

/**
 * @typedef {Object} HitRegion
 * @property {number} x1  - left pixel
 * @property {number} y1  - top pixel
 * @property {number} x2  - right pixel
 * @property {number} y2  - bottom pixel
 * @property {TradeForGhostBox} trade
 */

// ─── GhostBoxRenderer ──────────────────────────────────────────

export class GhostBoxRenderer {
    constructor() {
        /** @type {HitRegion[]} */
        this._tradeHitRegions = [];
        this._visible = false;
        /** @type {boolean} When true, colors reflect leak tags instead of win/loss */
        this._heatmapMode = false;
        /** @type {number} Animated pulse phase (0-1) for heatmap pulsing */
        this._pulsePhase = 0;
        /** @type {SpatialIndex|null} Spatial index for O(1) hit testing */
        this._spatialIndex = null;
    }

    /** Toggle visibility */
    setVisible(visible) {
        this._visible = visible;
    }

    get visible() {
        return this._visible;
    }

    /**
     * Toggle heatmap mode (Task 4.8.5).
     * When enabled, ghost box colors reflect LeakDetector tags
     * instead of simple win/loss coloring.
     * @param {boolean} enabled
     */
    setHeatmapMode(enabled) {
        this._heatmapMode = enabled;
    }

    get heatmapMode() {
        return this._heatmapMode;
    }

    /**
     * Update pulse animation phase for heatmap pulsing effect.
     * Call once per render frame (synced to rAF).
     * @param {number} timestamp - from requestAnimationFrame
     */
    updatePulse(timestamp) {
        // 2-second cycle, sinusoidal 0→1→0
        this._pulsePhase = (Math.sin(timestamp / 1000 * Math.PI) + 1) / 2;
    }

    /**
     * Render ghost boxes onto the chart canvas.
     *
     * @param {CanvasRenderingContext2D} ctx - 2D canvas context
     * @param {TradeForGhostBox[]} trades - closed trades to render
     * @param {Function} timeToX  - maps epoch ms → canvas X pixel
     * @param {Function} priceToY - maps price → canvas Y pixel
     * @param {Object} [chartArea] - { left, right, top, bottom } clipping region
     */
    render(ctx, trades, timeToX, priceToY, chartArea) {
        if (!this._visible || !trades || trades.length === 0) {
            this._tradeHitRegions = [];
            return;
        }

        const regions = [];

        ctx.save();

        // Clip to chart area if provided
        if (chartArea) {
            ctx.beginPath();
            ctx.rect(chartArea.left, chartArea.top,
                chartArea.right - chartArea.left,
                chartArea.bottom - chartArea.top);
            ctx.clip();
        }

        for (const trade of trades) {
            // Skip trades without entry/exit (still open)
            if (trade.exitPrice == null || trade.exitDate == null) continue;

            const entryTime = typeof trade.entryDate === 'string'
                ? new Date(trade.entryDate).getTime()
                : trade.entryDate;
            const exitTime = typeof trade.exitDate === 'string'
                ? new Date(trade.exitDate).getTime()
                : trade.exitDate;

            // Map to canvas coordinates
            const x1 = timeToX(Math.min(entryTime, exitTime));
            const x2 = timeToX(Math.max(entryTime, exitTime));
            const y1 = priceToY(Math.max(trade.entryPrice, trade.exitPrice));
            const y2 = priceToY(Math.min(trade.entryPrice, trade.exitPrice));

            // Skip if entirely off-screen
            if (chartArea && (x2 < chartArea.left || x1 > chartArea.right)) continue;

            // Determine win/loss/flat
            const pnl = trade.pnl != null ? trade.pnl : (trade.exitPrice - trade.entryPrice) * (trade.side === 'short' ? -1 : 1);
            let fillColor, borderColor;

            if (this._heatmapMode && trade.leakTag) {
                // ── Heatmap mode (4.8.5): color by behavioral tag ──
                const hm = HEATMAP_COLORS[trade.leakTag] || HEATMAP_COLORS.CLEAN;
                // Pulse alpha for problematic tags (not CLEAN)
                const isPulse = trade.leakTag !== 'CLEAN';
                const alphaMultiplier = isPulse ? 0.7 + this._pulsePhase * 0.3 : 1;
                fillColor = this._adjustAlpha(hm.fill, alphaMultiplier);
                borderColor = this._adjustAlpha(hm.border, alphaMultiplier);
            } else if (pnl > 0) {
                fillColor = WIN_COLOR;
                borderColor = WIN_BORDER;
            } else if (pnl < 0) {
                fillColor = LOSS_COLOR;
                borderColor = LOSS_BORDER;
            } else {
                fillColor = FLAT_COLOR;
                borderColor = FLAT_BORDER;
            }

            // Ensure minimum box dimensions (at least 4px each way)
            const width = Math.max(x2 - x1, 4);
            const height = Math.max(y2 - y1, 4);

            // Draw fill
            ctx.fillStyle = fillColor;
            ctx.fillRect(x1, y1, width, height);

            // Draw dashed border
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = BORDER_WIDTH;
            ctx.setLineDash(DASH_PATTERN);
            ctx.strokeRect(x1, y1, width, height);
            ctx.setLineDash([]);

            // Draw entry/exit price labels (small, at edges)
            ctx.fillStyle = borderColor;
            ctx.font = '10px Inter, system-ui, sans-serif';
            ctx.textAlign = 'left';
            const entryY = priceToY(trade.entryPrice);
            const exitY = priceToY(trade.exitPrice);
            ctx.fillText(`▸ ${trade.entryPrice.toFixed(2)}`, x1 + 3, entryY - 3);
            ctx.fillText(`▸ ${trade.exitPrice.toFixed(2)}`, x2 - 50, exitY - 3);

            // Store hit region for tooltip lookup
            regions.push({
                x1,
                y1,
                x2: x1 + width,
                y2: y1 + height,
                trade,
            });
        }

        ctx.restore();

        this._tradeHitRegions = regions;

        // Build spatial index from hit regions for O(1) point queries
        if (regions.length > 0) {
            const maxX = Math.max(...regions.map(r => r.x2));
            const maxY = Math.max(...regions.map(r => r.y2));
            this._spatialIndex = new SpatialIndex(maxX + 1, maxY + 1, 64);
            for (let i = 0; i < regions.length; i++) {
                const r = regions[i];
                this._spatialIndex.insert({
                    id: `ghost-${i}`,
                    visible: true,
                    zIndex: 0,
                    bounds: { x: r.x1, y: r.y1, w: r.x2 - r.x1, h: r.y2 - r.y1 },
                    _trade: r.trade,
                });
            }
        } else {
            this._spatialIndex = null;
        }
    }

    /**
     * Hit-test a canvas position against stored trade regions.
     * Returns the trade data if cursor is inside a ghost box, null otherwise.
     *
     * @param {number} x - Canvas X position
     * @param {number} y - Canvas Y position
     * @returns {TradeForGhostBox|null}
     */
    hitTest(x, y) {
        // O(1) spatial index query when available
        if (this._spatialIndex) {
            const hits = this._spatialIndex.queryPoint(x, y);
            if (hits.length > 0) return hits[0]._trade;
            return null;
        }
        // Fallback: linear scan
        for (const region of this._tradeHitRegions) {
            if (x >= region.x1 && x <= region.x2 &&
                y >= region.y1 && y <= region.y2) {
                return region.trade;
            }
        }
        return null;
    }

    /**
     * Get all hit regions (for debugging / external use).
     * @returns {HitRegion[]}
     */
    getHitRegions() {
        return this._tradeHitRegions;
    }

    /**
     * Clear all cached hit regions.
     */
    clear() {
        this._tradeHitRegions = [];
    }

    /**
     * Adjust the alpha channel of an rgba() color string.
     * @param {string} rgba - e.g. 'rgba(255, 60, 60, 0.18)'
     * @param {number} multiplier - factor to multiply alpha by
     * @returns {string}
     */
    _adjustAlpha(rgba, multiplier) {
        const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/);
        if (!match) return rgba;
        const a = parseFloat(match[4] || '1') * multiplier;
        return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${Math.min(1, a).toFixed(3)})`;
    }
}

// ─── Singleton + Export ─────────────────────────────────────────

export const ghostBoxRenderer = new GhostBoxRenderer();
export default ghostBoxRenderer;
