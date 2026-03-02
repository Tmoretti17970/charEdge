// ═══════════════════════════════════════════════════════════════════
// charEdge v13 — Derivatives Chart Overlays
//
// Canvas-based overlays that draw crypto derivatives data on the chart:
//   • OI Line — Open Interest trend overlaid in a sub-pane
//   • Funding Rate Dots — Colored dots at funding rate timestamps
//   • Liquidation Flashes — Animated markers at liquidation events
//
// Usage:
//   In ChartEngine.renderLoop, call these after the main chart render.
// ═══════════════════════════════════════════════════════════════════

import { C } from '../../constants.js';

/**
 * Render Open Interest as a line overlay in a sub-pane area.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{time: number, oi: number}>} oiData
 * @param {Object} params
 * @param {number} params.pixelRatio
 * @param {number} params.chartWidth
 * @param {number} params.y      - Y offset for OI sub-pane
 * @param {number} params.height - Height in CSS px
 * @param {string} [params.color] - Line color override
 */
export function renderOIOverlay(ctx, oiData, params) {
  if (!oiData?.length || oiData.length < 2) return;

  const {
    pixelRatio: pr = 1,
    chartWidth,
    y: areaY = 0,
    height = 50,
    color = C.cyan || '#22d3ee',
  } = params;

  const values = oiData.map(d => d.oi);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pW = chartWidth * pr;
  const pH = height * pr;
  const pY = areaY * pr;
  const step = pW / (values.length - 1);

  // Determine trend
  const trend = values[values.length - 1] >= values[0];

  ctx.save();

  // Area fill
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < values.length; i++) {
    const x = i * step;
    const y = pY + pH - ((values[i] - min) / range) * (pH - 4 * pr) - 2 * pr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineTo(pW, pY + pH);
  ctx.lineTo(0, pY + pH);
  ctx.closePath();
  ctx.fill();

  // Line
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5 * pr;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.beginPath();
  for (let i = 0; i < values.length; i++) {
    const x = i * step;
    const y = pY + pH - ((values[i] - min) / range) * (pH - 4 * pr) - 2 * pr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Label
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = color;
  ctx.font = `${9 * pr}px ${C.M || 'monospace'}`;
  ctx.fillText('OI', 4 * pr, pY + 10 * pr);

  // Current value
  const lastOI = values[values.length - 1];
  const label = formatOI(lastOI);
  ctx.globalAlpha = 0.7;
  ctx.fillText(label, 20 * pr, pY + 10 * pr);

  // Trend arrow
  ctx.fillText(trend ? '▲' : '▼', (20 + label.length * 6) * pr, pY + 10 * pr);
  ctx.fillStyle = trend ? (C.g || '#2dd4a0') : (C.r || '#f25c5c');
  ctx.fillText(trend ? '▲' : '▼', (20 + label.length * 6) * pr, pY + 10 * pr);

  ctx.restore();
}

/**
 * Render funding rate marks along the time axis.
 * Shows colored dots (green = positive/longs pay, red = negative/shorts pay).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{time: number, rate: number}>} fundingData
 * @param {Object} params
 * @param {Function} params.timeToX
 * @param {number}   params.y      - Y position (typically at chart bottom)
 * @param {number}   params.pixelRatio
 */
export function renderFundingDots(ctx, fundingData, params) {
  if (!fundingData?.length) return;

  const {
    timeToX,
    y: dotY = 0,
    pixelRatio: pr = 1,
  } = params;

  if (!timeToX) return;

  ctx.save();

  for (const fd of fundingData) {
    const x = timeToX(fd.time);
    if (x == null || isNaN(x)) continue;

    const xp = Math.round(x * pr);
    const yp = Math.round(dotY * pr);
    const isPositive = fd.rate >= 0;
    const color = isPositive ? (C.g || '#2dd4a0') : (C.r || '#f25c5c');
    const intensity = Math.min(Math.abs(fd.rate) * 10000, 1); // Scale 0.01% → 1.0

    // Outer glow
    ctx.globalAlpha = 0.15 + intensity * 0.2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(xp, yp, (4 + intensity * 4) * pr, 0, Math.PI * 2);
    ctx.fill();

    // Inner dot
    ctx.globalAlpha = 0.6 + intensity * 0.3;
    ctx.beginPath();
    ctx.arc(xp, yp, 2.5 * pr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Render liquidation events as flash markers.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{time: number, price: number, quantityUsd: number, type: string}>} liquidations
 * @param {Object} params
 * @param {Function} params.priceToY
 * @param {Function} params.timeToX
 * @param {number}   params.pixelRatio
 */
export function renderLiquidationMarkers(ctx, liquidations, params) {
  if (!liquidations?.length) return;

  const {
    priceToY,
    timeToX,
    pixelRatio: pr = 1,
  } = params;

  if (!priceToY || !timeToX) return;

  ctx.save();

  for (const liq of liquidations) {
    const x = timeToX(liq.time);
    if (x == null || isNaN(x)) continue;

    const xp = Math.round(x * pr);
    const yp = Math.round(priceToY(liq.price) * pr);
    const isLong = liq.type === 'long_liquidation';
    const color = isLong ? (C.r || '#f25c5c') : (C.g || '#2dd4a0');

    // Size based on USD value (log scale)
    const size = Math.min(Math.max(3, Math.log10(liq.quantityUsd || 1000) * 2.5), 15) * pr;

    // Cross/X marker for liquidations
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 * pr;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(xp - size, yp - size);
    ctx.lineTo(xp + size, yp + size);
    ctx.moveTo(xp + size, yp - size);
    ctx.lineTo(xp - size, yp + size);
    ctx.stroke();

    // Glow background
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(xp, yp, size * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ─── Helpers ───────────────────────────────────────────────────

function formatOI(n) {
  if (n == null) return '';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}
