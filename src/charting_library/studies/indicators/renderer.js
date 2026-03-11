// ═══════════════════════════════════════════════════════════════════
// charEdge — Indicator Renderer
// Renders computed indicator values on canvas.
//
// Overlay indicators draw on the main chart canvas.
// Pane indicators draw in their own sub-pane with custom Y scaling.
// ═══════════════════════════════════════════════════════════════════

import { calculateVRVP } from './computations.js';

/**
 * Render an overlay indicator on the main chart canvas.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object}   indicator - Active indicator instance (with .computed)
 * @param {Object}   params
 * @param {Array}    params.rawBars        - The full array of bars (needed for VRVP)
 * @param {number}   params.startIdx       - First visible bar index in data
 * @param {number}   params.endIdx         - Last visible bar index in data
 * @param {number}   params.barSpacing     - CSS pixels per bar
 * @param {Function} params.priceToY       - Price → CSS Y coordinate
 * @param {number}   params.pixelRatio
 * @param {number}   params.bitmapWidth
 * @param {number}   params.bitmapHeight
 */
export function renderOverlayIndicator(ctx, indicator, params) {
  if (!indicator.computed || !indicator.visible) return;

  const { rawBars, startIdx, exactStart: exStart, endIdx, barSpacing, priceToY, pixelRatio: pr, bitmapWidth: bw, bitmapHeight: _bh } = params;
  // Use exactStart (float) for X positioning to match the candle renderer's
  // timeTransform.indexToPixel() which also uses exactStart. Falls back to
  // startIdx if exactStart is not provided (backward compat).
  const xOrigin = exStart != null ? exStart : startIdx;

  // Render fills first (behind lines)
  if (indicator.fills) {
    for (const fill of indicator.fills) {
      const upperVals = indicator.computed[fill.upper];
      const lowerVals = indicator.computed[fill.lower];
      if (!upperVals || !lowerVals) continue;

      const df = fill.dynamicFill;

      if (df) {
        // Dynamic fill: render bar-by-bar segments with bull/bear coloring
        for (let i = startIdx; i <= endIdx && i < upperVals.length && i < lowerVals.length; i++) {
          if (isNaN(upperVals[i]) || isNaN(lowerVals[i])) continue;
          const isBull = upperVals[i] >= lowerVals[i];
          ctx.fillStyle = isBull ? df.bullColor : df.bearColor;

          const x0 = Math.round((i - xOrigin) * barSpacing * pr);
          const x1 = Math.round((i - xOrigin + 1) * barSpacing * pr);
          const yU = Math.round(priceToY(upperVals[i]) * pr);
          const yL = Math.round(priceToY(lowerVals[i]) * pr);

          ctx.fillRect(x0, Math.min(yU, yL), x1 - x0, Math.abs(yL - yU) || 1);
        }
      } else {
        // Static fill: single polygon sweep
        ctx.fillStyle = fill.color;
        ctx.beginPath();

        // Forward sweep (upper line)
        let started = false;
        for (let i = startIdx; i <= endIdx && i < upperVals.length; i++) {
          if (isNaN(upperVals[i])) continue;
          const x = Math.round((i - xOrigin + 0.5) * barSpacing * pr);
          const y = Math.round(priceToY(upperVals[i]) * pr);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else ctx.lineTo(x, y);
        }

        // Backward sweep (lower line)
        for (let i = Math.min(endIdx, lowerVals.length - 1); i >= startIdx; i--) {
          if (isNaN(lowerVals[i])) continue;
          const x = Math.round((i - xOrigin + 0.5) * barSpacing * pr);
          const y = Math.round(priceToY(lowerVals[i]) * pr);
          ctx.lineTo(x, y);
        }

        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // Render line outputs
  for (const output of indicator.outputs) {
    if (output.type === 'vrvp') {
      // VRVP Special Render Logic
      // The computed value for vrvp just holds the rowCount config.
      const rowCount = indicator.computed.vrvp;
      if (!rowCount || !rawBars) continue;

      // Slice the visible bars
      const safeStart = Math.max(0, startIdx);
      const safeEnd = Math.min(rawBars.length, endIdx + 1);
      const visBars = rawBars.slice(safeStart, safeEnd);

      // Calculate profile
      const profile = calculateVRVP(visBars, rowCount);
      if (!profile.length) continue;

      // Find max volume to scale the histogram width
      let maxVol = 0;
      for (const p of profile) {
        if (p.totalVol > maxVol) maxVol = p.totalVol;
      }
      if (maxVol === 0) continue;

      // Max width of the VRVP histogram (e.g., 30% of the chart width)
      const maxDrawWidth = bw * 0.3;

      ctx.save();
      // Draw from right to left
      for (const p of profile) {
        if (p.totalVol === 0) continue;

        const yTop = Math.round(priceToY(p.priceEnd) * pr);
        const yBot = Math.round(priceToY(p.priceStart) * pr);

        // Ensure yTop is actually the smaller pixel value (higher on screen)
        const renderY = Math.min(yTop, yBot);
        const renderH = Math.max(1, Math.abs(yBot - yTop) - 1); // -1 for slight gap

        const upW = Math.round((p.upVol / maxVol) * maxDrawWidth);
        const dnW = Math.round((p.downVol / maxVol) * maxDrawWidth);

        // Up Volume (drawn from right edge inwards)
        ctx.fillStyle = 'rgba(38, 166, 154, 0.4)'; // Bull string
        ctx.fillRect(bw - upW, renderY, upW, renderH);

        // Down Volume (drawn extending further left from the up volume)
        ctx.fillStyle = 'rgba(239, 83, 80, 0.4)'; // Bear string
        ctx.fillRect(bw - upW - dnW, renderY, dnW, renderH);
      }
      ctx.restore();

      continue;
    }

    const values = indicator.computed[output.key];
    if (!values || output.type !== 'line') continue;

    const lineWidth = Math.max(1, Math.round((output.width || 2) * pr));
    const savedAlpha = ctx.globalAlpha;
    if (output.opacity !== undefined) ctx.globalAlpha *= output.opacity;
    ctx.strokeStyle = output.color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.setLineDash(output.dash ? output.dash.map((d) => Math.round(d * pr)) : []);

    ctx.beginPath();
    let started = false;
    let lastPixelX = -Infinity;
    // M4 (FLLM): track min/max Y per pixel column so signal crosses
    // are never visually lost during overlay line decimation
    let colMinY = Infinity;
    let colMaxY = -Infinity;
    let _colFirstY = 0;
    let colLastY = 0;
    let colCount = 0;

    for (let i = startIdx; i <= endIdx && i < values.length; i++) {
      if (isNaN(values[i])) {
        // Flush pending M4 column before gap
        if (colCount > 1) {
          ctx.lineTo(lastPixelX, colMinY);
          ctx.lineTo(lastPixelX, colMaxY);
          ctx.lineTo(lastPixelX, colLastY);
        }
        started = false;
        lastPixelX = -Infinity;
        colCount = 0;
        continue;
      }
      const x = Math.round((i - xOrigin + 0.5) * barSpacing * pr);
      const y = Math.round(priceToY(values[i]) * pr);

      if (x === lastPixelX && started) {
        // Same pixel column — accumulate M4 envelope
        if (y < colMinY) colMinY = y;
        if (y > colMaxY) colMaxY = y;
        colLastY = y;
        colCount++;
        continue;
      }

      // Flush previous M4 column
      if (colCount > 1) {
        ctx.lineTo(lastPixelX, colMinY);
        ctx.lineTo(lastPixelX, colMaxY);
        ctx.lineTo(lastPixelX, colLastY);
      }

      // Start new column
      lastPixelX = x;
      colMinY = y;
      colMaxY = y;
       
      _colFirstY = y;
      colLastY = y;
      colCount = 1;

      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
    }

    // Flush final M4 column
    if (colCount > 1) {
      ctx.lineTo(lastPixelX, colMinY);
      ctx.lineTo(lastPixelX, colMaxY);
      ctx.lineTo(lastPixelX, colLastY);
    }

    ctx.stroke();
    ctx.setLineDash([]);
    if (output.opacity !== undefined) ctx.globalAlpha = savedAlpha;
  }

  // Render dots outputs (e.g. Parabolic SAR)
  for (const output of indicator.outputs) {
    if (output.type !== 'dots') continue;
    const values = indicator.computed[output.key];
    if (!values) continue;

    const radius = Math.max(2, Math.round(2.5 * pr));
    const dc = output.dynamicColor;
    const directionArr = dc ? indicator.computed[dc.key] : null;

    for (let i = startIdx; i <= endIdx && i < values.length; i++) {
      if (isNaN(values[i])) continue;
      const x = Math.round((i - xOrigin + 0.5) * barSpacing * pr);
      const y = Math.round(priceToY(values[i]) * pr);

      // Dynamic coloring: bull (up trend) = teal, bear = red
      if (directionArr && i < directionArr.length) {
        ctx.fillStyle = directionArr[i] ? dc.bullColor : dc.bearColor;
      } else {
        ctx.fillStyle = output.color;
      }

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}

/**
 * Render a pane indicator in its own sub-pane.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object}   indicator
 * @param {Object}   params
 * @param {number}   params.startIdx
 * @param {number}   params.endIdx
 * @param {number}   params.barSpacing
 * @param {number}   params.pixelRatio
 * @param {number}   params.paneTop      - Bitmap Y start of this pane
 * @param {number}   params.paneHeight   - Bitmap height of this pane
 * @param {number}   params.paneWidth    - Bitmap width (chart area, excluding axis)
 * @param {Object}   [theme]             - Theme colors
 */
export function renderPaneIndicator(ctx, indicator, params, theme = {}) {
  if (!indicator.computed || !indicator.visible) return;

  const { startIdx, endIdx, barSpacing, pixelRatio: pr, paneTop, paneHeight, paneWidth } = params;

  const pc = indicator.paneConfig || {};

  // Determine Y range
  let dataMin = Infinity,
    dataMax = -Infinity;

  for (const output of indicator.outputs) {
    const values = indicator.computed[output.key];
    if (!values) continue;
    for (let i = startIdx; i <= endIdx && i < values.length; i++) {
      if (isNaN(values[i])) continue;
      if (values[i] < dataMin) dataMin = values[i];
      if (values[i] > dataMax) dataMax = values[i];
    }
  }

  // Use fixed range if defined, otherwise auto
  const yMin = pc.min !== undefined ? pc.min : dataMin - (dataMax - dataMin) * 0.1;
  const yMax = pc.max !== undefined ? pc.max : dataMax + (dataMax - dataMin) * 0.1;
  const yRange = yMax - yMin || 1;

  const valToY = (v) => paneTop + paneHeight - ((v - yMin) / yRange) * paneHeight;

  // ── Bands (horizontal reference lines) ──
  if (pc.bands) {
    for (const band of pc.bands) {
      const y = Math.round(valToY(band.value));
      ctx.strokeStyle = band.color || 'rgba(120,123,134,0.3)';
      ctx.lineWidth = Math.max(1, pr);
      ctx.setLineDash(band.dash ? band.dash.map((d) => Math.round(d * pr)) : []);
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(paneWidth, y + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);

      // Band label
      if (band.label) {
        const fs = Math.round(9 * pr);
        ctx.font = `${fs}px Inter, sans-serif`;
        ctx.fillStyle = band.color || 'rgba(120,123,134,0.5)';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(band.label, paneWidth - Math.round(4 * pr), y - Math.round(2 * pr));
      }
    }
  }

  // ── Render outputs ──
  for (const output of indicator.outputs) {
    const values = indicator.computed[output.key];
    if (!values) continue;

    if (output.type === 'histogram') {
      // MACD histogram bars — batch by color to reduce draw calls
      const barW = Math.max(1, Math.floor(barSpacing * 0.6 * pr));
      const zeroY = Math.round(valToY(0));

      // 4 color buckets: bullGrow, bullFade, bearGrow, bearFade
      const buckets = [[], [], [], []];
      const bucketColors = [
        'rgba(38, 166, 154, 0.7)',   // bull growing
        'rgba(38, 166, 154, 0.35)',  // bull fading
        'rgba(239, 83, 80, 0.35)',   // bear growing
        'rgba(239, 83, 80, 0.7)',    // bear fading
      ];

      for (let i = startIdx; i <= endIdx && i < values.length; i++) {
        if (isNaN(values[i])) continue;
        const x = Math.round((i - startIdx + 0.5) * barSpacing * pr);
        const y = Math.round(valToY(values[i]));
        const h = Math.abs(y - zeroY);

        const isPos = values[i] >= 0;
        const prevVal = i > 0 && !isNaN(values[i - 1]) ? values[i - 1] : values[i];
        const growing = isPos ? values[i] > prevVal : values[i] < prevVal;

        const bucketIdx = isPos ? (growing ? 0 : 1) : (growing ? 2 : 3);
        buckets[bucketIdx].push(
          x - Math.floor(barW / 2),
          Math.min(y, zeroY),
          barW,
          Math.max(1, h)
        );
      }

      // Flush each bucket in a single beginPath/fill
      for (let b = 0; b < 4; b++) {
        const rects = buckets[b];
        if (rects.length === 0) continue;
        ctx.fillStyle = bucketColors[b];
        ctx.beginPath();
        for (let j = 0; j < rects.length; j += 4) {
          ctx.rect(rects[j], rects[j + 1], rects[j + 2], rects[j + 3]);
        }
        ctx.fill();
      }
    } else if (output.type === 'line') {
      // Line
      const lineWidth = Math.max(1, Math.round((output.width || 2) * pr));
      ctx.strokeStyle = output.color;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = 'round';
      ctx.setLineDash(output.dash ? output.dash.map((d) => Math.round(d * pr)) : []);

      ctx.beginPath();
      let started = false;
      let lastPixelX = -Infinity;
      // M4 (FLLM): track min/max Y per pixel column so signal crosses
      // are never visually lost during pane line decimation
      let colMinY = Infinity;
      let colMaxY = -Infinity;
      let _colFirstY = 0;
      let colLastY = 0;
      let colCount = 0;

      for (let i = startIdx; i <= endIdx && i < values.length; i++) {
        if (isNaN(values[i])) {
          if (colCount > 1) {
            ctx.lineTo(lastPixelX, colMinY);
            ctx.lineTo(lastPixelX, colMaxY);
            ctx.lineTo(lastPixelX, colLastY);
          }
          started = false;
          lastPixelX = -Infinity;
          colCount = 0;
          continue;
        }
        const x = Math.round((i - startIdx + 0.5) * barSpacing * pr);
        const y = Math.round(valToY(values[i]));

        if (x === lastPixelX && started) {
          if (y < colMinY) colMinY = y;
          if (y > colMaxY) colMaxY = y;
          colLastY = y;
          colCount++;
          continue;
        }

        if (colCount > 1) {
          ctx.lineTo(lastPixelX, colMinY);
          ctx.lineTo(lastPixelX, colMaxY);
          ctx.lineTo(lastPixelX, colLastY);
        }

        lastPixelX = x;
        colMinY = y;
        colMaxY = y;
         
        _colFirstY = y;
        colLastY = y;
        colCount = 1;

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      }

      if (colCount > 1) {
        ctx.lineTo(lastPixelX, colMinY);
        ctx.lineTo(lastPixelX, colMaxY);
        ctx.lineTo(lastPixelX, colLastY);
      }

      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ── Indicator label ──
  const fs = Math.round(10 * pr);
  ctx.font = `bold ${fs}px Inter, sans-serif`;
  ctx.fillStyle = theme.textSecondary || '#787B86';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(indicator.label, Math.round(8 * pr), paneTop + Math.round(4 * pr));

  // Current values
  if (indicator.computed) {
    let ox = Math.round(8 * pr) + ctx.measureText(indicator.label).width + Math.round(12 * pr);
    ctx.font = `${fs}px Inter, sans-serif`;
    for (const output of indicator.outputs) {
      const values = indicator.computed[output.key];
      if (!values) continue;
      const lastValid = findLastValid(values, endIdx);
      if (lastValid === null) continue;

      ctx.fillStyle = output.color;
      const txt = `${output.label}: ${lastValid.toFixed(2)}`;
      ctx.fillText(txt, ox, paneTop + Math.round(4 * pr));
      ox += ctx.measureText(txt).width + Math.round(12 * pr);
    }
  }

  // ── Pane axis labels ──
  const axisX = paneWidth;
  const axFs = Math.round(9 * pr);
  ctx.font = `${axFs}px Inter, sans-serif`;
  ctx.fillStyle = theme.textSecondary || '#787B86';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const _axPad = Math.round(6 * pr);

  // Show min, max, and midpoint
  const ticks =
    pc.min !== undefined && pc.max !== undefined
      ? [pc.max, (pc.max + pc.min) / 2, pc.min]
      : [dataMax, (dataMax + dataMin) / 2, dataMin];

  for (const tick of ticks) {
    if (isNaN(tick)) continue;
    const y = Math.round(valToY(tick));
    const label = Math.abs(tick) >= 1000 ? tick.toFixed(0) : tick.toFixed(1);
    ctx.fillText(label, axisX + Math.round(50 * pr), y);
  }
}

/**
 * Find the last non-NaN value up to a given index.
 */
function findLastValid(arr, maxIdx) {
  for (let i = Math.min(maxIdx, arr.length - 1); i >= 0; i--) {
    if (!isNaN(arr[i])) return arr[i];
  }
  return null;
}
