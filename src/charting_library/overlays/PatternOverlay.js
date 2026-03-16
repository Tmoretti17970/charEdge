// ═══════════════════════════════════════════════════════════════════
// charEdge — Pattern Overlay (Sprint 3)
//
// Canvas-level pattern badge renderer for chart patterns.
// Reads detected patterns from LocalInsightEngine.detectPatterns()
// and draws small annotated badges at the pattern bar position.
//
// Usage (from ChartEngineWidget):
//   const overlay = new PatternOverlay(ctx, chartConfig);
//   overlay.update(patterns, xScale, yScale);
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} DetectedPattern
 * @property {number} idx - Bar index
 * @property {string} label - Pattern name
 * @property {string} icon - Emoji icon
 * @property {string} bias - 'bullish' | 'bearish' | 'neutral'
 * @property {number} confidence - 0–1
 * @property {number} [barX] - Computed X position on canvas
 * @property {number} [barY] - Computed Y position on canvas
 */

const BIAS_COLORS = {
    bullish: { bg: 'rgba(49, 209, 88, 0.15)', border: '#31d158', text: '#31d158' },
    bearish: { bg: 'rgba(255, 69, 58, 0.15)', border: '#ff453a', text: '#ff453a' },
    neutral: { bg: 'rgba(240, 182, 78, 0.12)', border: '#f0b64e', text: '#f0b64e' },
};

export class PatternOverlay {
    /** @param {CanvasRenderingContext2D} ctx */
    constructor(ctx, chartConfig = {}) {
        this.ctx = ctx;
        this.config = {
            badgeWidth: 80,
            badgeHeight: 22,
            fontSize: 10,
            fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
            offsetY: -30, // Badge above the candle
            ...chartConfig,
        };
        this.patterns = [];
        this.hoveredIdx = -1;
    }

    /**
     * Update patterns and redraw.
     * @param {DetectedPattern[]} patterns
     * @param {Function} xScale - (barIndex) => canvasX
     * @param {Function} yScale - (price) => canvasY
     * @param {Array} bars - OHLCV data for Y positioning
     */
    update(patterns, xScale, yScale, bars = []) {
        this.patterns = (patterns || []).map((p) => ({
            ...p,
            barX: xScale ? xScale(p.idx) : 0,
            barY: yScale && bars[p.idx] ? yScale(bars[p.idx].high) + this.config.offsetY : 0,
        }));
    }

    /**
     * Draw all pattern badges onto the canvas.
     */
    draw() {
        const { ctx, config, patterns } = this;
        if (!patterns.length || !ctx) return;

        const dpr = window.devicePixelRatio || 1;
        ctx.save();

        for (const pat of patterns) {
            if (pat.barX <= 0 || pat.barY <= 0) continue;

            const colors = BIAS_COLORS[pat.bias] || BIAS_COLORS.neutral;
            const x = pat.barX - config.badgeWidth / 2;
            const y = pat.barY;
            const isHovered = pat.idx === this.hoveredIdx;

            // Badge background
            ctx.fillStyle = isHovered ? colors.border + '30' : colors.bg;
            ctx.strokeStyle = colors.border;
            ctx.lineWidth = isHovered ? 1.5 : 0.8;
            ctx.beginPath();
            this._roundRect(ctx, x, y, config.badgeWidth, config.badgeHeight, 4);
            ctx.fill();
            ctx.stroke();

            // Badge text
            ctx.font = `${isHovered ? 'bold' : 'normal'} ${config.fontSize * dpr}px ${config.fontFamily}`;
            ctx.fillStyle = colors.text;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const text = `${pat.icon} ${pat.label}`;
            const maxTextWidth = config.badgeWidth - 8;
            const displayText = this._truncate(ctx, text, maxTextWidth);
            ctx.fillText(displayText, x + config.badgeWidth / 2, y + config.badgeHeight / 2);

            // Confidence dot (small circle in top-right)
            if (pat.confidence > 0) {
                const dotR = 3;
                const dotX = x + config.badgeWidth - dotR - 3;
                const dotY = y + dotR + 3;
                ctx.fillStyle = pat.confidence > 0.7 ? '#31d158' : pat.confidence > 0.4 ? '#f0b64e' : '#ff453a';
                ctx.beginPath();
                ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
                ctx.fill();
            }

            // Connector line from badge to candle top
            ctx.strokeStyle = colors.border + '60';
            ctx.lineWidth = 0.5;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(pat.barX, y + config.badgeHeight);
            ctx.lineTo(pat.barX, y + config.badgeHeight + Math.abs(this.config.offsetY) - 5);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.restore();
    }

    /**
     * Hit-test for hover interaction.
     * @param {number} mouseX
     * @param {number} mouseY
     * @returns {DetectedPattern|null}
     */
    hitTest(mouseX, mouseY) {
        for (const pat of this.patterns) {
            const x = pat.barX - this.config.badgeWidth / 2;
            const y = pat.barY;
            if (
                mouseX >= x && mouseX <= x + this.config.badgeWidth &&
                mouseY >= y && mouseY <= y + this.config.badgeHeight
            ) {
                this.hoveredIdx = pat.idx;
                return pat;
            }
        }
        this.hoveredIdx = -1;
        return null;
    }

    /**
     * Clear overlay (call before redrawing chart).
     */
    clear() {
        this.patterns = [];
        this.hoveredIdx = -1;
    }

    // ─── Helpers ────────────────────────────────────────────────

    _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    _truncate(ctx, text, maxWidth) {
        if (ctx.measureText(text).width <= maxWidth) return text;
        let truncated = text;
        while (truncated.length > 3 && ctx.measureText(truncated + '…').width > maxWidth) {
            truncated = truncated.slice(0, -1);
        }
        return truncated + '…';
    }
}

export default PatternOverlay;
