// ═══════════════════════════════════════════════════════════════════
// charEdge — Pattern Badge Overlay (Sprint 47)
//
// Canvas overlay that renders detected pattern labels as badges
// above or below bars. Filters by confidence threshold.
//
// Usage:
//   const overlay = new PatternBadgeOverlay(ctx);
//   overlay.update(patterns, chartBounds);
//   overlay.draw(viewRange, priceToY, timeToX);
// ═══════════════════════════════════════════════════════════════════

// ─── Pattern Badge Colors ───────────────────────────────────────

const PATTERN_COLORS = {
  bullish: { bg: 'rgba(49, 209, 88, 0.12)', text: '#31d158', border: 'rgba(49, 209, 88, 0.3)' },
  bearish: { bg: 'rgba(255, 69, 58, 0.12)', text: '#ff453a', border: 'rgba(255, 69, 58, 0.3)' },
  neutral: { bg: 'rgba(90, 200, 250, 0.12)', text: '#5ac8fa', border: 'rgba(90, 200, 250, 0.3)' },
};

const PATTERN_BIAS = {
  Doji: 'neutral',
  Hammer: 'bullish',
  'Shooting Star': 'bearish',
  'Engulfing Bull': 'bullish',
  'Engulfing Bear': 'bearish',
  'Inside Bar': 'neutral',
  'Double Top': 'bearish',
  'Double Bottom': 'bullish',
  Triangle: 'neutral',
  Flag: 'neutral',
  'Head & Shoulders': 'bearish',
  'Cup & Handle': 'bullish',
};

const BADGE_HEIGHT = 18;
const BADGE_PADDING = 4;
const BADGE_RADIUS = 4;
const BADGE_FONT = '600 9px Inter, -apple-system, sans-serif';
const CONFIDENCE_THRESHOLD = 0.6;

// ─── Overlay Class ──────────────────────────────────────────────

export class PatternBadgeOverlay {
  constructor(ctx) {
    /** @type {CanvasRenderingContext2D|null} */
    this.ctx = ctx;
    /** @type {Array} Detected patterns with { label, confidence, index } */
    this.patterns = [];
    this.enabled = true;
  }

  /**
   * Update with new pattern detections.
   * @param {Array<{ label: string, confidence: number, index: number }>} patterns
   */
  update(patterns) {
    this.patterns = (patterns || []).filter((p) => p.confidence >= CONFIDENCE_THRESHOLD);
  }

  /**
   * Draw pattern badges on the chart canvas.
   * @param {{ startIdx: number, endIdx: number }} viewRange
   * @param {Function} priceToY - (price) => y pixel
   * @param {Function} indexToX - (barIndex) => x pixel
   * @param {Array} candles - OHLCV data for positioning
   */
  draw(viewRange, priceToY, indexToX, candles) {
    if (!this.enabled || !this.ctx || !this.patterns.length || !candles?.length) return;

    const ctx = this.ctx;
    ctx.save();

    for (const pattern of this.patterns) {
      const idx = pattern.index;
      if (idx < viewRange.startIdx || idx > viewRange.endIdx) continue;

      const candle = candles[idx];
      if (!candle) continue;

      const x = indexToX(idx);
      const bias = PATTERN_BIAS[pattern.label] || 'neutral';
      const colors = PATTERN_COLORS[bias];

      // Position: above bar for bearish, below for bullish
      const isAbove = bias === 'bearish';
      const y = isAbove
        ? priceToY(candle.high) - BADGE_HEIGHT - 4
        : priceToY(candle.low) + 4;

      // Measure text
      ctx.font = BADGE_FONT;
      const text = `${pattern.label} ${Math.round(pattern.confidence * 100)}%`;
      const textWidth = ctx.measureText(text).width;
      const badgeWidth = textWidth + BADGE_PADDING * 2;

      // Draw badge background
      const bx = x - badgeWidth / 2;

      ctx.beginPath();
      ctx.roundRect(bx, y, badgeWidth, BADGE_HEIGHT, BADGE_RADIUS);
      ctx.fillStyle = colors.bg;
      ctx.fill();
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Draw text
      ctx.fillStyle = colors.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y + BADGE_HEIGHT / 2);
    }

    ctx.restore();
  }

  /**
   * Clear all pattern data.
   */
  clear() {
    this.patterns = [];
  }
}

export default PatternBadgeOverlay;
