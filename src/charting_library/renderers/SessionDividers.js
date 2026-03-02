// ═══════════════════════════════════════════════════════════════════
// charEdge — Session Dividers Renderer
// Draws vertical session boundary lines for Tokyo, London, and NYC.
// ═══════════════════════════════════════════════════════════════════

/**
 * Session definitions (UTC hours).
 * Each session has an open and close hour in UTC.
 */
const SESSIONS = [
  { id: 'tokyo',  label: 'Tokyo',  openH: 0,   closeH: 9,    color: 'rgba(239, 68, 68, 0.35)',  labelColor: '#EF4444' },
  { id: 'london', label: 'London', openH: 8,   closeH: 16.5, color: 'rgba(59, 130, 246, 0.35)', labelColor: '#3B82F6' },
  { id: 'nyc',    label: 'NYC',    openH: 13.5, closeH: 20,  color: 'rgba(34, 197, 94, 0.35)',  labelColor: '#22C55E' },
];

/**
 * Get session boundaries that fall within a time range.
 * @param {number} startTime - Start unix timestamp (ms)
 * @param {number} endTime - End unix timestamp (ms)
 * @returns {Array<{session: Object, time: number, type: 'open'|'close'}>}
 */
export function getSessionsForTimeRange(startTime, endTime) {
  const results = [];
  // Iterate day by day within the range
  const startDate = new Date(startTime);
  startDate.setUTCHours(0, 0, 0, 0);
  const endDate = new Date(endTime);
  endDate.setUTCHours(23, 59, 59, 999);

  for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
    // Skip weekends (Sat=6, Sun=0)
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue;

    for (const session of SESSIONS) {
      const openHour = Math.floor(session.openH);
      const openMin = Math.round((session.openH - openHour) * 60);
      const closeHour = Math.floor(session.closeH);
      const closeMin = Math.round((session.closeH - closeHour) * 60);

      const openTime = new Date(d);
      openTime.setUTCHours(openHour, openMin, 0, 0);
      const closeTime = new Date(d);
      closeTime.setUTCHours(closeHour, closeMin, 0, 0);

      const ot = openTime.getTime();
      const ct = closeTime.getTime();

      if (ot >= startTime && ot <= endTime) {
        results.push({ session, time: ot, type: 'open' });
      }
      if (ct >= startTime && ct <= endTime) {
        results.push({ session, time: ct, type: 'close' });
      }
    }
  }

  return results;
}

/**
 * Render session divider lines on the chart canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} bars - Visible OHLCV bars
 * @param {number} startIdx - First visible bar index
 * @param {Object} timeTransform - { timeToPixel, indexToPixel }
 * @param {number} chartHeight - Pixel height of main chart area
 * @param {number} pixelRatio - Device pixel ratio
 * @param {Object} theme - Chart theme
 */
export function drawSessionDividers(ctx, bars, startIdx, timeTransform, chartHeight, pixelRatio, theme) {
  if (!bars || bars.length < 2) return;

  const pr = pixelRatio;
  const startTime = bars[0].time;
  const endTime = bars[bars.length - 1].time;

  // Only render sessions on intraday timeframes (< 1D)
  const avgBarDuration = (endTime - startTime) / bars.length;
  if (avgBarDuration > 4 * 60 * 60 * 1000) return; // Skip for 4H+ timeframes

  const sessions = getSessionsForTimeRange(startTime, endTime);

  ctx.save();

  for (const entry of sessions) {
    const x = timeTransform.timeToPixel(entry.time);
    const bx = Math.round(x * pr);

    // Skip if off-screen
    if (bx < 0 || bx > ctx.canvas.width) continue;

    // Draw vertical dashed line
    ctx.strokeStyle = entry.session.color;
    ctx.lineWidth = Math.max(1, Math.round(1.5 * pr));
    ctx.setLineDash([Math.round(6 * pr), Math.round(4 * pr)]);
    ctx.beginPath();
    ctx.moveTo(bx + 0.5, 0);
    ctx.lineTo(bx + 0.5, Math.round(chartHeight * pr));
    ctx.stroke();

    // Draw session label at top
    if (entry.type === 'open') {
      const fs = Math.round(9 * pr);
      ctx.font = `bold ${fs}px Arial`;
      ctx.fillStyle = entry.session.labelColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      // Background pill
      const label = entry.session.label;
      const textW = ctx.measureText(label).width;
      const padX = Math.round(4 * pr);
      const padY = Math.round(2 * pr);
      const pillY = Math.round(4 * pr);

      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = theme?.bg || '#131722';
      ctx.fillRect(bx + Math.round(3 * pr), pillY, textW + padX * 2, fs + padY * 2);
      ctx.restore();

      ctx.fillStyle = entry.session.labelColor;
      ctx.fillText(label, bx + Math.round(3 * pr) + padX, pillY + padY);
    }
  }

  ctx.setLineDash([]);
  ctx.restore();
}
