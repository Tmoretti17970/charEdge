// ═══════════════════════════════════════════════════════════════════
// charEdge — Ghost Box Renderer (Tasks 4.8.1–3)
//
// Renders semi-transparent entry→exit rectangles on the chart canvas.
// Win = green alpha fill, Loss = red alpha fill, dashed border.
// Stores `_tradeHitRegions[]` for O(1) cursor hit-testing.
// ═══════════════════════════════════════════════════════════════════

// ─── Constants ──────────────────────────────────────────────────

const WIN_COLOR = 'rgba(34, 197, 94, 0.12)';     // green-500 @ 12%
const WIN_BORDER = 'rgba(34, 197, 94, 0.5)';
const LOSS_COLOR = 'rgba(239, 68, 68, 0.12)';     // red-500 @ 12%
const LOSS_BORDER = 'rgba(239, 68, 68, 0.5)';
const FLAT_COLOR = 'rgba(148, 163, 184, 0.08)';   // slate-400 @ 8%
const FLAT_BORDER = 'rgba(148, 163, 184, 0.3)';
const DASH_PATTERN = [6, 4];
const BORDER_WIDTH = 1.5;

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
    }

    /** Toggle visibility */
    setVisible(visible) {
        this._visible = visible;
    }

    get visible() {
        return this._visible;
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
            if (pnl > 0) {
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
}

// ─── Singleton + Export ─────────────────────────────────────────

export const ghostBoxRenderer = new GhostBoxRenderer();
export default ghostBoxRenderer;
