// ═══════════════════════════════════════════════════════════════════
// charEdge — Measurement Info Labels
// Renders computed values (price difference, percentage, angle,
// bar count) on measurement-type drawings.
// ═══════════════════════════════════════════════════════════════════

/**
 * Draw measurement info labels for supported drawing tools.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} drawing - The drawing object
 * @param {Array<{x:number,y:number}>} pts - Pixel-space points
 * @param {number} pr - Pixel ratio
 * @param {Function} [pixelToPrice] - Convert pixel Y to price
 * @param {Function} [pixelToTime] - Convert pixel X to time
 */
export function renderMeasureLabels(ctx, drawing, pts, pr, pixelToPrice, pixelToTime) {
  const type = drawing?.type;
  if (!type || !pts || pts.length < 2) return;

  const SUPPORTED = ['measure', 'infoline', 'pricerange', 'daterange'];
  if (!SUPPORTED.includes(type)) return;

  const p0 = pts[0];
  const p1 = pts[1];
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;

  const lines = [];

  // Price difference
  if (pixelToPrice && (type === 'measure' || type === 'pricerange' || type === 'infoline')) {
    const price0 = pixelToPrice(p0.y / pr);
    const price1 = pixelToPrice(p1.y / pr);
    if (price0 != null && price1 != null) {
      const diff = price1 - price0;
      const pct = price0 !== 0 ? ((diff / price0) * 100) : 0;
      const sign = diff >= 0 ? '+' : '';
      lines.push(`${sign}${diff.toFixed(2)} (${sign}${pct.toFixed(2)}%)`);
    }
  }

  // Bar count / time difference
  if (pixelToTime && (type === 'measure' || type === 'daterange' || type === 'infoline')) {
    const time0 = pixelToTime(p0.x / pr);
    const time1 = pixelToTime(p1.x / pr);
    if (time0 != null && time1 != null) {
      const diffMs = Math.abs(time1 - time0);
      if (diffMs < 86400000) {
        // Less than a day — show hours
        const hours = (diffMs / 3600000).toFixed(1);
        lines.push(`${hours}h`);
      } else {
        const days = Math.round(diffMs / 86400000);
        lines.push(`${days}d`);
      }
    }
  }

  // Angle (for lines)
  if (type === 'measure' || type === 'infoline') {
    const angle = Math.atan2(-dy, dx) * (180 / Math.PI);
    lines.push(`${angle.toFixed(1)}°`);
  }

  // Pixel distance (for measure)
  if (type === 'measure') {
    const dist = Math.sqrt(dx * dx + dy * dy) / pr;
    lines.push(`${Math.round(dist)}px`);
  }

  if (lines.length === 0) return;

  // ── Render label ──
  const midX = (p0.x + p1.x) / 2;
  const midY = (p0.y + p1.y) / 2;
  const text = lines.join('  ·  ');

  const fontSize = Math.round(11 * pr);
  ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif`;
  const metrics = ctx.measureText(text);
  const textW = metrics.width;
  const textH = fontSize;
  const padH = Math.round(8 * pr);
  const padV = Math.round(5 * pr);
  const boxW = textW + padH * 2;
  const boxH = textH + padV * 2;
  const radius = Math.round(6 * pr);

  // Position label above the midpoint
  const labelX = midX - boxW / 2;
  const labelY = midY - boxH - Math.round(10 * pr);

  // Background pill
  ctx.save();
  ctx.fillStyle = 'rgba(24, 26, 32, 0.92)';
  ctx.beginPath();
  ctx.roundRect(labelX, labelY, boxW, boxH, radius);
  ctx.fill();

  // Border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = Math.round(1 * pr);
  ctx.stroke();

  // Text
  ctx.fillStyle = '#D1D4DC';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, midX, labelY + boxH / 2);
  ctx.restore();
}
