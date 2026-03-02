// ═══════════════════════════════════════════════════════════════════
// charEdge — AxesStage
// Renders: price axis (right), time axis (bottom), scale mode toggles,
//          auto-fit button, price badges
// Layer: DATA (axis gutter area, outside chart clip)
//
// Phase 1.1.3: Offscreen bitmap cache for static axis labels.
// Price/time tick labels are cached; dynamic elements (price badge,
// auto-fit button, scale toggles) always render fresh.
// ═══════════════════════════════════════════════════════════════════

import { formatPrice } from '../CoordinateSystem.js';
import { formatTimeLabel } from '../barCountdown.js';

// ─── Offscreen Bitmap Cache ──────────────────────────────────────
let _axesCache = { canvas: null, ctx: null, key: '' };

/**
 * Build invalidation key from rendering inputs.
 * Captures everything that affects static label positions/text.
 */
function _axesCacheKey(fs, engine) {
  const niceStep = engine._lastNiceStep;
  const tickStr = niceStep?.ticks?.join(',') ?? '';
  return `${fs.bitmapWidth}:${fs.bitmapHeight}:${fs.pixelRatio}:${fs.chartWidth}:${fs.mainHeight}:${tickStr}:${fs.startIdx}:${fs.scaleMode}`;
}

/**
 * Render price and time axes.
 *
 * @param {import('../FrameState.js').FrameState} fs
 * @param {Object} ctx - Render contexts
 * @param {Object} engine - ChartEngine instance
 */
export function executeAxesStage(fs, ctx, engine) {
  if (fs.compact) return;

  const { theme: thm } = ctx;
  // Axes normally draw to the DATA layer gutter area, but when DATA is
  // offscreen (Phase 1.3.3) its context is null. Fall back to UI layer.
  const mCtx = ctx.dataCtx || ctx.uiCtx;
  if (!mCtx) return;
  const {
    bitmapWidth: bw, bitmapHeight: bh, pixelRatio: pr,
    chartWidth: cW, mainHeight, axW, bars, visBars: vis,
    startIdx: start, yMin, yMax, scaleMode, percentBase,
  } = fs;

  const R = engine.state.lastRender;
  if (!R) return;
  const { p2y, timeTransform } = R;

  const cBW = Math.round(cW * pr);
  const mainBH = Math.round(mainHeight * pr);

  const niceStep = engine._lastNiceStep;
  const displayTicks = engine._lastDisplayTicks;
  if (!niceStep) return;

  // ─── Static Labels Cache Check ───────────────────────────────
  const cacheKey = _axesCacheKey(fs, engine) + `:${thm.axisBg}:${thm.axisText}:${thm.gridLine}`;
  const cacheHit = _axesCache.key === cacheKey && _axesCache.canvas;

  if (cacheHit) {
    // CACHE HIT — composite cached static labels
    mCtx.drawImage(_axesCache.canvas, 0, 0);
  } else {
    // ─── Cache Miss — render static labels to offscreen canvas ──
    if (!_axesCache.canvas || _axesCache.canvas.width !== bw || _axesCache.canvas.height !== bh) {
      if (typeof OffscreenCanvas !== 'undefined') {
        _axesCache.canvas = new OffscreenCanvas(bw, bh);
      } else {
        _axesCache.canvas = document.createElement('canvas');
        _axesCache.canvas.width = bw;
        _axesCache.canvas.height = bh;
      }
      _axesCache.ctx = _axesCache.canvas.getContext('2d');
    }

    const oCtx = _axesCache.ctx;
    oCtx.clearRect(0, 0, bw, bh);

    // ─── Price Axis (static tick labels) ──────────────────────
    const axX = cBW;
    oCtx.fillStyle = thm.axisBg || '#1E222D';
    oCtx.fillRect(axX, 0, bw - axX, mainBH);
    const fnFs = Math.round(11 * pr);
    oCtx.font = `${fnFs}px Arial`;
    oCtx.textAlign = 'right';
    oCtx.textBaseline = 'middle';
    oCtx.fillStyle = thm.axisText || '#787B86';
    const axP = Math.round(8 * pr);
    const priceLabels = [];

    for (let i = 0; i < niceStep.ticks.length; i++) {
      const dispT = displayTicks[i] || niceStep.ticks[i];
      const label = formatPrice(dispT) + (scaleMode === 'percent' ? '%' : '');
      const tickY = Math.round(p2y(niceStep.ticks[i]) * pr);
      priceLabels.push({ text: label, x: bw - axP, y: tickY, fontSize: 11 });
    }

    // GPU SDF text path for price labels
    const webgl = ctx.webgl;
    const useGPUText = webgl?.available && typeof webgl.drawSDFText === 'function';

    if (useGPUText) {
      const axisColor = _parseColorToArray(thm.axisText || '#787B86');
      const sdfEntries = priceLabels.map(l => ({
        text: l.text,
        x: l.x,
        y: l.y,
        fontSize: l.fontSize,
        color: axisColor,
        align: 'right',
      }));
      const priceTextFn = () => webgl.drawSDFText(sdfEntries, { pixelRatio: pr });
      const cmdBuf = ctx.commandBuffer;
      if (cmdBuf) {
        cmdBuf.push({ program: null, blendMode: 0, texture: null, zOrder: 5, label: 'price-labels', drawFn: priceTextFn });
      } else {
        priceTextFn();
      }
    } else {
      // Canvas2D fallback — draw to offscreen
      for (const l of priceLabels) {
        oCtx.fillText(l.text, l.x, l.y);
      }
    }

    // ─── Time Axis (static labels) ───────────────────────────
    const tY = mainBH;
    oCtx.fillStyle = thm.axisBg || '#1E222D';
    oCtx.fillRect(0, tY, bw, bh - tY);

    if (vis.length > 0) {
      const step = Math.max(1, Math.floor(vis.length / 8));
      const txFs = Math.round(10 * pr);
      oCtx.font = `${txFs}px Arial`;
      oCtx.textAlign = 'center';
      oCtx.textBaseline = 'top';

      // Separator line
      oCtx.fillStyle = thm.gridLine || 'rgba(54,58,69,0.3)';
      oCtx.fillRect(0, tY, cBW, Math.max(1, pr));
      oCtx.fillStyle = thm.axisText || '#787B86';
      const timeLabels = [];

      let prevTime = null;
      for (let i = 0; i < vis.length; i += step) {
        if (!vis[i].time) continue;
        const x = Math.round(timeTransform.indexToPixel(start + i) * pr);
        if (x < 0 || x > cBW) continue;
        const label = formatTimeLabel(vis[i].time, fs.timeframe, prevTime);
        prevTime = vis[i].time;
        timeLabels.push({ text: label, x, y: tY + Math.round(5 * pr), fontSize: 10 });
      }

      // GPU SDF text path for time labels
      if (useGPUText) {
        const axisColor = _parseColorToArray(thm.axisText || '#787B86');
        const sdfEntries = timeLabels.map(l => ({
          text: l.text,
          x: l.x,
          y: l.y,
          fontSize: l.fontSize,
          color: axisColor,
          align: 'center',
        }));
        const timeTextFn = () => webgl.drawSDFText(sdfEntries, { pixelRatio: pr });
        const cmdBuf = ctx.commandBuffer;
        if (cmdBuf) {
          cmdBuf.push({ program: null, blendMode: 0, texture: null, zOrder: 5, label: 'time-labels', drawFn: timeTextFn });
        } else {
          timeTextFn();
        }
      } else {
        for (const l of timeLabels) {
          oCtx.fillText(l.text, l.x, l.y);
        }
      }
    }

    // Store cache and composite
    _axesCache.key = cacheKey;
    mCtx.drawImage(_axesCache.canvas, 0, 0);
  }

  // ═══════════════════════════════════════════════════════════════
  // DYNAMIC ELEMENTS — always render fresh (not cached)
  // ═══════════════════════════════════════════════════════════════

  const axX = cBW;
  const fnFs = Math.round(11 * pr);
  const axP = Math.round(8 * pr);

  // ─── Current Price Badge ─────────────────────────────────────
  const last = bars[bars.length - 1];
  if (last) {
    const y = Math.round(p2y(last.close) * pr);
    const bH = Math.round(18 * pr);
    mCtx.fillStyle = last.close >= last.open ? thm.bullCandle || '#26A69A' : thm.bearCandle || '#EF5350';
    mCtx.fillRect(axX, y - bH / 2, bw - axX, bH);
    mCtx.fillStyle = '#fff';
    mCtx.font = `bold ${fnFs}px Arial`;
    mCtx.textAlign = 'right';
    mCtx.textBaseline = 'middle';
    let badgeVal = last.close;
    let badgeStr = formatPrice(badgeVal) + (scaleMode === 'percent' && percentBase > 0 ? '%' : '');
    if (scaleMode === 'percent' && percentBase > 0) {
      badgeStr = formatPrice(((badgeVal - percentBase) / percentBase) * 100) + '%';
    }
    mCtx.fillText(badgeStr, bw - axP, y);
  }

  // ─── Auto-Fit Button ─────────────────────────────────────────
  const S = engine.state;
  if (!S.autoScale) {
    const afSize = Math.round(20 * pr);
    const afX = bw - Math.round(axW * pr) + Math.round(4 * pr);
    const afY = Math.round(4 * pr);
    mCtx.fillStyle = '#2962FF';
    mCtx.beginPath();
    const r2 = Math.round(3 * pr);
    mCtx.moveTo(afX + r2, afY);
    mCtx.lineTo(afX + afSize - r2, afY);
    mCtx.quadraticCurveTo(afX + afSize, afY, afX + afSize, afY + r2);
    mCtx.lineTo(afX + afSize, afY + afSize - r2);
    mCtx.quadraticCurveTo(afX + afSize, afY + afSize, afX + afSize - r2, afY + afSize);
    mCtx.lineTo(afX + r2, afY + afSize);
    mCtx.quadraticCurveTo(afX, afY + afSize, afX, afY + afSize - r2);
    mCtx.lineTo(afX, afY + r2);
    mCtx.quadraticCurveTo(afX, afY, afX + r2, afY);
    mCtx.closePath();
    mCtx.fill();
    mCtx.fillStyle = '#FFFFFF';
    mCtx.font = `bold ${Math.round(12 * pr)}px Arial`;
    mCtx.textAlign = 'center';
    mCtx.textBaseline = 'middle';
    mCtx.fillText('⊞', afX + afSize / 2, afY + afSize / 2);
    S._autoFitBtn = { x: afX / pr, y: afY / pr, w: afSize / pr, h: afSize / pr };
  } else {
    S._autoFitBtn = null;
  }

  // ─── Scale Mode Toggles ──────────────────────────────────────
  const toggleW = Math.round(24 * pr);
  const toggleH = Math.round(18 * pr);
  const toggleY = mainBH - toggleH - Math.round(4 * pr);
  const logX = bw - axW * pr + Math.round(8 * pr);

  mCtx.fillStyle = scaleMode === 'log' ? '#2962FF' : thm.bg || '#131722';
  mCtx.fillRect(logX, toggleY, toggleW, toggleH);
  mCtx.font = `bold ${Math.round(10 * pr)}px Arial`;
  mCtx.textAlign = 'center';
  mCtx.fillStyle = scaleMode === 'log' ? '#FFFFFF' : thm.axisText || '#787B86';
  mCtx.fillText('log', logX + toggleW / 2, toggleY + toggleH / 2);

  const pctX = logX + toggleW + Math.round(4 * pr);
  mCtx.fillStyle = scaleMode === 'percent' ? '#2962FF' : thm.bg || '#131722';
  mCtx.fillRect(pctX, toggleY, toggleW, toggleH);
  mCtx.fillStyle = scaleMode === 'percent' ? '#FFFFFF' : thm.axisText || '#787B86';
  mCtx.fillText('%', pctX + toggleW / 2, toggleY + toggleH / 2);
}

/**
 * Invalidate the axes cache (called on theme change, etc.).
 */
export function invalidateAxesCache() {
  _axesCache.key = '';
}

// Re-export cache reference for testing
export { _axesCache };

/**
 * Parse a CSS color string to a normalized [r, g, b, a] Float32Array.
 * Lightweight hex-only parser for axis text (avoids canvas getImageData).
 */
function _parseColorToArray(color) {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return new Float32Array([
        parseInt(hex[0] + hex[0], 16) / 255,
        parseInt(hex[1] + hex[1], 16) / 255,
        parseInt(hex[2] + hex[2], 16) / 255,
        1.0,
      ]);
    }
    return new Float32Array([
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255,
      1.0,
    ]);
  }
  return new Float32Array([0.47, 0.48, 0.53, 1.0]); // fallback gray
}
