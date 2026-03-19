// ═══════════════════════════════════════════════════════════════════
// charEdge — Anomaly Bar Overlay (Sprint 47)
//
// Canvas overlay that colors bars based on anomaly z-scores.
// Uses a gradient: subtle yellow → strong red for increasing
// anomaly severity.
//
// Usage:
//   const overlay = new AnomalyBarOverlay(ctx);
//   overlay.update(anomalyScores);
//   overlay.draw(viewRange, barPositions);
// ═══════════════════════════════════════════════════════════════════

// ─── Anomaly Color Gradient ─────────────────────────────────────

const ANOMALY_COLORS = [
  { threshold: 0,   color: 'rgba(0, 0, 0, 0)' },         // None
  { threshold: 15,  color: 'rgba(245, 158, 11, 0.08)' },  // Subtle yellow
  { threshold: 25,  color: 'rgba(245, 158, 11, 0.15)' },  // Yellow
  { threshold: 40,  color: 'rgba(244, 63, 94, 0.12)' },   // Orange-red
  { threshold: 60,  color: 'rgba(244, 63, 94, 0.20)' },   // Red
  { threshold: 80,  color: 'rgba(244, 63, 94, 0.30)' },   // Strong red
];

// ─── Overlay Class ──────────────────────────────────────────────

export class AnomalyBarOverlay {
  constructor(ctx) {
    /** @type {CanvasRenderingContext2D|null} */
    this.ctx = ctx;
    /** @type {Map<number, { score: number, isAnomaly: boolean, severity: string }>} */
    this.scores = new Map();
    this.enabled = true;
  }

  /**
   * Update with anomaly scores for bar indices.
   * @param {Array<{ barIndex: number, score: number, isAnomaly: boolean, severity: string }>} scores
   */
  update(scores) {
    this.scores.clear();
    if (!scores) return;
    for (const s of scores) {
      this.scores.set(s.barIndex, s);
    }
  }

  /**
   * Update a single bar's anomaly score (real-time).
   * @param {number} barIndex
   * @param {{ score: number, isAnomaly: boolean, severity: string }} data
   */
  updateBar(barIndex, data) {
    this.scores.set(barIndex, data);
  }

  /**
   * Draw anomaly color overlays on chart bars.
   * @param {{ startIdx: number, endIdx: number }} viewRange
   * @param {Function} indexToX - (barIndex) => x pixel
   * @param {number} barWidth - Width of each bar in pixels
   * @param {{ top: number, bottom: number }} chartBoundsY - Y bounds
   */
  draw(viewRange, indexToX, barWidth, chartBoundsY) {
    if (!this.enabled || !this.ctx || this.scores.size === 0) return;

    const ctx = this.ctx;
    ctx.save();

    const halfBar = barWidth / 2;

    for (let i = viewRange.startIdx; i <= viewRange.endIdx; i++) {
      const anomaly = this.scores.get(i);
      if (!anomaly || !anomaly.isAnomaly) continue;

      const color = this._scoreToColor(anomaly.score);
      if (!color) continue;

      const x = indexToX(i);
      const height = chartBoundsY.bottom - chartBoundsY.top;

      ctx.fillStyle = color;
      ctx.fillRect(x - halfBar, chartBoundsY.top, barWidth, height);
    }

    ctx.restore();
  }

  /**
   * Map anomaly score (0-100) to background color.
   * @private
   */
  _scoreToColor(score) {
    for (let i = ANOMALY_COLORS.length - 1; i >= 0; i--) {
      if (score >= ANOMALY_COLORS[i].threshold) {
        return ANOMALY_COLORS[i].color;
      }
    }
    return null;
  }

  /**
   * Clear all anomaly data.
   */
  clear() {
    this.scores.clear();
  }
}

export default AnomalyBarOverlay;
