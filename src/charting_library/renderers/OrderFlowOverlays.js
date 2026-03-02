// ═══════════════════════════════════════════════════════════════════
// charEdge v13 — Order Flow Chart Overlays
//
// Canvas-based overlay renderers that draw order flow data directly
// onto the chart. Designed to be called from ChartEngine's renderLoop.
//
// Modules:
//   • renderDeltaHistogram  — Buy/sell delta bars below candles
//   • renderCVDLine         — Cumulative Volume Delta line
//   • renderVolumeProfile   — Session VP overlay on right side
//   • renderLargeTradeMarkers — Whale trade dots on chart
// ═══════════════════════════════════════════════════════════════════

import { C } from '../../constants.js';

/**
 * Render delta histogram bars (green = net buy, red = net sell)
 * below the main chart area, similar to volume bars.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} bars - OHLCV bars with .delta, .buyVol, .sellVol
 * @param {Object} params
 * @param {number} params.startIdx     - First visible bar index
 * @param {number} params.barSpacing   - Pixels per bar
 * @param {number} params.pixelRatio   - Device pixel ratio
 * @param {number} params.chartWidth   - Canvas width (CSS px)
 * @param {number} params.y            - Y offset for the histogram area (top)
 * @param {number} params.height       - Height in CSS pixels for the histogram
 * @param {Function} params.timeTransform - { indexToPixel(idx) }
 */
export function renderDeltaHistogram(ctx, bars, params) {
  if (!bars?.length) return;

  const {
    startIdx = 0,
    barSpacing = 10,
    pixelRatio: pr = 1,
    chartWidth,
    y: areaY = 0,
    height = 60,
    timeTransform,
  } = params;

  const pH = height * pr;
  const pY = areaY * pr;

  // Find max absolute delta across visible bars for normalization
  let maxAbsDelta = 0;
  const endIdx = Math.min(startIdx + Math.ceil(chartWidth / barSpacing) + 2, bars.length);
  for (let i = startIdx; i < endIdx; i++) {
    const d = bars[i]?.delta;
    if (d != null) maxAbsDelta = Math.max(maxAbsDelta, Math.abs(d));
  }
  if (maxAbsDelta === 0) return;

  const bw = Math.max(1, (barSpacing - 2) * pr);
  const midY = pY + pH / 2;

  ctx.save();

  for (let i = startIdx; i < endIdx; i++) {
    const bar = bars[i];
    if (!bar || bar.delta == null) continue;

    const x = timeTransform
      ? Math.round(timeTransform.indexToPixel(i) * pr)
      : Math.round((i - startIdx) * barSpacing * pr);

    const normalized = bar.delta / maxAbsDelta;
    const barH = Math.abs(normalized) * (pH / 2 - 2);

    const isBullish = bar.delta >= 0;
    ctx.fillStyle = isBullish ? C.bullish || C.g : C.bearish || C.r;
    ctx.globalAlpha = 0.7;

    if (isBullish) {
      // Bar goes up from midline
      ctx.fillRect(x - bw / 2, midY - barH, bw, barH);
    } else {
      // Bar goes down from midline
      ctx.fillRect(x - bw / 2, midY, bw, barH);
    }
  }

  // Zero line
  ctx.strokeStyle = C.t3;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = pr;
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(chartWidth * pr, midY);
  ctx.stroke();

  ctx.restore();
}

/**
 * Render CVD (Cumulative Volume Delta) as a line overlaid on the chart.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{time, cvd}>} cvdData  - CVD history points
 * @param {Object} params
 * @param {number} params.pixelRatio
 * @param {number} params.chartWidth
 * @param {number} params.y      - Y offset
 * @param {number} params.height - Available height
 */
export function renderCVDLine(ctx, cvdData, params) {
  if (!cvdData?.length || cvdData.length < 2) return;

  const {
    pixelRatio: pr = 1,
    chartWidth,
    y: areaY = 0,
    height = 60,
  } = params;

  const values = cvdData.map(d => d.cvd);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pW = chartWidth * pr;
  const pH = height * pr;
  const pY = areaY * pr;
  const step = pW / (values.length - 1);
  const trend = values[values.length - 1] >= values[0];

  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = trend ? (C.g || '#2dd4a0') : (C.r || '#f25c5c');
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

  // Fill area under line
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = trend ? (C.g || '#2dd4a0') : (C.r || '#f25c5c');
  ctx.lineTo(pW, pY + pH);
  ctx.lineTo(0, pY + pH);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Render session Volume Profile bars on the right edge of the chart.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} vpData - { levels: [{ price, buyVol, sellVol, totalVol }], poc, vah, val }
 * @param {Object} params
 * @param {Function} params.priceToY - Price → Y pixel converter
 * @param {number}   params.pixelRatio
 * @param {number}   params.chartWidth
 * @param {number}   params.maxWidth - Max VP bar width in CSS px (default 120)
 */
export function renderVolumeProfile(ctx, vpData, params) {
  if (!vpData?.levels?.length) return;

  const {
    priceToY,
    pixelRatio: pr = 1,
    chartWidth,
    maxWidth = 120,
  } = params;

  const levels = vpData.levels;
  const maxVol = Math.max(...levels.map(l => l.totalVol));
  if (maxVol === 0) return;

  const pMaxW = maxWidth * pr;
  const rightEdge = chartWidth * pr;

  ctx.save();
  ctx.globalAlpha = 0.35;

  for (const level of levels) {
    const y = Math.round(priceToY(level.price) * pr);
    const barW = (level.totalVol / maxVol) * pMaxW;
    const buyW = level.buyVol > 0 ? (level.buyVol / level.totalVol) * barW : 0;
    const sellW = barW - buyW;
    const barH = Math.max(2, 4 * pr); // Fixed height per level

    // Buy portion (right-aligned)
    ctx.fillStyle = C.g || '#2dd4a0';
    ctx.fillRect(rightEdge - barW, y - barH / 2, buyW, barH);

    // Sell portion
    ctx.fillStyle = C.r || '#f25c5c';
    ctx.fillRect(rightEdge - sellW, y - barH / 2, sellW, barH);
  }

  // POC line
  if (vpData.poc != null) {
    const pocY = Math.round(priceToY(vpData.poc) * pr);
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = C.y || '#f0b64e';
    ctx.lineWidth = 1 * pr;
    ctx.setLineDash([4 * pr, 3 * pr]);
    ctx.beginPath();
    ctx.moveTo(rightEdge - pMaxW, pocY);
    ctx.lineTo(rightEdge, pocY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // VAH/VAL dashed lines
  if (vpData.vah != null && vpData.val != null) {
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = C.cyan || '#22d3ee';
    ctx.lineWidth = 0.8 * pr;
    ctx.setLineDash([3 * pr, 4 * pr]);

    const vahY = Math.round(priceToY(vpData.vah) * pr);
    const valY = Math.round(priceToY(vpData.val) * pr);

    ctx.beginPath();
    ctx.moveTo(rightEdge - pMaxW, vahY);
    ctx.lineTo(rightEdge, vahY);
    ctx.moveTo(rightEdge - pMaxW, valY);
    ctx.lineTo(rightEdge, valY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

/**
 * Render large trade markers as circles on the chart at their
 * price/time location.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} trades - [{ price, volume, time, side, sigma }]
 * @param {Object} params
 * @param {Function} params.priceToY
 * @param {Function} params.timeToX - Timestamp → X pixel converter
 * @param {number}   params.pixelRatio
 */
export function renderLargeTradeMarkers(ctx, trades, params) {
  if (!trades?.length) return;

  const {
    priceToY,
    timeToX,
    pixelRatio: pr = 1,
  } = params;

  if (!priceToY || !timeToX) return;

  ctx.save();

  for (const trade of trades) {
    const x = timeToX(trade.time);
    if (x == null || isNaN(x)) continue;

    const y = Math.round(priceToY(trade.price) * pr);
    const xp = Math.round(x * pr);

    // Radius based on sigma (larger sigma = bigger dot)
    const radius = Math.min(Math.max(3, (trade.sigma || 2) * 2), 12) * pr;

    const isBuy = trade.side === 'buy';
    const color = isBuy ? (C.g || '#2dd4a0') : (C.r || '#f25c5c');

    // Glow
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(xp, y, radius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Core circle
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(xp, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner highlight
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(xp - radius * 0.2, y - radius * 0.2, radius * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
