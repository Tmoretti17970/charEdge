// ═══════════════════════════════════════════════════════════════════
// charEdge v14 — Arbitrage Spread Overlay
//
// Canvas-based overlay that draws a spread sparkline at the bottom
// of the chart area, showing real-time cross-exchange price spread
// in basis points.
//
// Rendered by ChartEngine's renderLoop when showArbitrageSpread=true.
//
// Usage:
//   import { ArbitrageOverlay } from './ArbitrageOverlay.js';
//   const overlay = new ArbitrageOverlay(ctx, rect);
//   overlay.render(spreadHistory, threshold);
// ═══════════════════════════════════════════════════════════════════

const OVERLAY_CONFIG = {
  HEIGHT: 40,               // Overlay height in pixels
  PADDING_BOTTOM: 4,        // Bottom padding
  LINE_COLOR: '#FFB74D',    // Spread line color (amber)
  HIGH_COLOR: '#FF5252',    // Color when above threshold
  FILL_ALPHA: 0.08,         // Semi-transparent fill
  THRESHOLD_DASH: [4, 3],   // Dashed line pattern for threshold
  LABEL_FONT: '10px monospace',
  BG_ALPHA: 0.85,
};

export class ArbitrageOverlay {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ x: number, y: number, w: number, h: number }} rect - Chart render area
   */
  constructor(ctx, rect) {
    this.ctx = ctx;
    this.rect = rect;
  }

  /**
   * Render the spread sparkline overlay.
   *
   * @param {Array<{ spreadBps: number, timestamp: number }>} history
   * @param {number} thresholdBps - Alert threshold in basis points
   * @param {Object} [stats] - { avgSpreadBps, maxSpreadBps, current }
   */
  render(history, thresholdBps = 10, stats = null) {
    if (!history?.length || history.length < 2) return;

    const { ctx, rect } = this;
    const overlayH = OVERLAY_CONFIG.HEIGHT;
    const y0 = rect.y + rect.h - overlayH - OVERLAY_CONFIG.PADDING_BOTTOM;

    // Backdrop
    ctx.save();
    ctx.fillStyle = `rgba(12, 14, 18, ${OVERLAY_CONFIG.BG_ALPHA})`;
    ctx.fillRect(rect.x, y0, rect.w, overlayH);

    // Find value range
    const values = history.map(h => h.spreadBps);
    const maxVal = Math.max(...values, thresholdBps * 1.2);
    const minVal = 0;
    const range = maxVal - minVal || 1;

    const toY = (val) => y0 + overlayH - ((val - minVal) / range) * (overlayH - 4) - 2;
    const step = rect.w / Math.max(values.length - 1, 1);

    // Draw threshold line
    ctx.setLineDash(OVERLAY_CONFIG.THRESHOLD_DASH);
    ctx.strokeStyle = `rgba(255, 82, 82, 0.4)`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    const threshY = toY(thresholdBps);
    ctx.moveTo(rect.x, threshY);
    ctx.lineTo(rect.x + rect.w, threshY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw spread line
    ctx.beginPath();
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (let i = 0; i < values.length; i++) {
      const x = rect.x + i * step;
      const y = toY(values[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    // Gradient stroke based on threshold
    const lastVal = values[values.length - 1];
    ctx.strokeStyle = lastVal > thresholdBps ? OVERLAY_CONFIG.HIGH_COLOR : OVERLAY_CONFIG.LINE_COLOR;
    ctx.stroke();

    // Fill under the line
    const fillPath = new Path2D();
    for (let i = 0; i < values.length; i++) {
      const x = rect.x + i * step;
      const y = toY(values[i]);
      if (i === 0) fillPath.moveTo(x, y);
      else fillPath.lineTo(x, y);
    }
    fillPath.lineTo(rect.x + (values.length - 1) * step, y0 + overlayH);
    fillPath.lineTo(rect.x, y0 + overlayH);
    fillPath.closePath();

    ctx.fillStyle = lastVal > thresholdBps
      ? `rgba(255, 82, 82, ${OVERLAY_CONFIG.FILL_ALPHA})`
      : `rgba(255, 183, 77, ${OVERLAY_CONFIG.FILL_ALPHA})`;
    ctx.fill(fillPath);

    // Labels
    ctx.font = OVERLAY_CONFIG.LABEL_FONT;
    ctx.textBaseline = 'top';

    // Current spread value
    ctx.fillStyle = lastVal > thresholdBps ? OVERLAY_CONFIG.HIGH_COLOR : OVERLAY_CONFIG.LINE_COLOR;
    ctx.textAlign = 'right';
    ctx.fillText(
      `${lastVal.toFixed(1)} bps`,
      rect.x + rect.w - 6,
      y0 + 3
    );

    // Label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.textAlign = 'left';
    ctx.fillText('SPREAD', rect.x + 6, y0 + 3);

    // Stats (if available)
    if (stats) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.textAlign = 'left';
      ctx.fillText(
        `avg: ${stats.avgSpreadBps}  max: ${stats.maxSpreadBps}  srcs: ${stats.current?.sources?.length || '—'}`,
        rect.x + 6,
        y0 + 15
      );
    }

    // Alert indicator (pulsing dot when above threshold)
    if (lastVal > thresholdBps) {
      const dotX = rect.x + rect.w - 6 - ctx.measureText(`${lastVal.toFixed(1)} bps`).width - 10;
      const dotY = y0 + 8;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
      ctx.fillStyle = OVERLAY_CONFIG.HIGH_COLOR;
      ctx.fill();

      // Glow
      ctx.beginPath();
      ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 82, 82, 0.2)`;
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Check if a point is within the overlay's render area.
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  hitTest(x, y) {
    const overlayH = OVERLAY_CONFIG.HEIGHT + OVERLAY_CONFIG.PADDING_BOTTOM;
    const y0 = this.rect.y + this.rect.h - overlayH;
    return x >= this.rect.x && x <= this.rect.x + this.rect.w &&
           y >= y0 && y <= y0 + overlayH;
  }
}

export default ArbitrageOverlay;
