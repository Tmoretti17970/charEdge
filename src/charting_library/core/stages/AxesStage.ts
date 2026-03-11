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
import { filterOverlappingLabels, filterOverlappingTimeLabels } from '../NiceTicks.js';
import { temporalEngine } from '../TemporalEngine.ts';

// ─── Offscreen Bitmap Cache ──────────────────────────────────────
let _axesCache = { canvas: null, ctx: null, key: '' };

/**
 * Build invalidation key from rendering inputs.
 * Captures everything that affects static label positions/text.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
function _axesCacheKey(fs, engine) {
  const niceStep = engine._lastNiceStep;
  const tickStr = niceStep?.ticks?.join(',') ?? '';
  return `${fs.bitmapWidth}:${fs.bitmapHeight}:${fs.pixelRatio}:${fs.chartWidth}:${fs.mainHeight}:${tickStr}:${fs.startIdx}:${fs.scaleMode}:${fs.activeTimezone || 'UTC'}`;
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

    // ─── Collision Avoidance (8.3.2) ────────────────────────────
    // Build exclusion zone around the current price badge
    const lastBar = bars[bars.length - 1];
    const exclusions = [];
    const badgeHalf = Math.round(18 * pr); // match actual badge height (18px) + padding
    if (lastBar) {
      const badgeY = Math.round(p2y(lastBar.close) * pr);
      exclusions.push({ center: badgeY, halfSize: badgeHalf });
    }
    const filteredPriceLabels = filterOverlappingLabels(priceLabels, Math.round(22 * pr), exclusions);

    // NOTE: Always use Canvas2D for axis labels. GPU SDF text renders to the
    // WebGL canvas which is cleared every frame by webgl.clear(). On frames
    // where AxesStage is skipped (change flags not matched), SDF text vanishes.
    // Canvas2D draws to the offscreen cache → DATA canvas, which persists.
    const useGPUText = false;

    if (useGPUText) {
      const axisColor = _parseColorToArray(thm.axisText || '#787B86');
      const sdfEntries = filteredPriceLabels.map(l => ({
        text: l.text,
        x: l.x,
        y: l.y,
        fontSize: l.fontSize,
        color: axisColor,
        align: 'right',
      }));
      // eslint-disable-next-line no-undef
      const priceTextFn = () => webgl.drawSDFText(sdfEntries, { pixelRatio: pr });
      const cmdBuf = ctx.commandBuffer;
      if (cmdBuf) {
        cmdBuf.push({ program: null, blendMode: 0, texture: null, zOrder: 5, label: 'price-labels', drawFn: priceTextFn });
      } else {
        priceTextFn();
      }
    } else {
      // Canvas2D fallback — draw to offscreen
      for (const l of filteredPriceLabels) {
        oCtx.fillText(l.text, l.x, l.y);
      }
    }

    // ─── Time Axis (smart density-aware labels) ────────────────
    const tY = mainBH;
    oCtx.fillStyle = thm.axisBg || '#1E222D';
    oCtx.fillRect(0, tY, bw, bh - tY);

    if (vis.length > 0) {
      // Sprint 9: Density-aware label spacing (min 80px between labels)
      const MIN_LABEL_PX = 80;
      const barPx = (cBW / vis.length) || 10;
      const minBarsPerLabel = Math.max(1, Math.ceil((MIN_LABEL_PX * pr) / barPx));
      const step = Math.max(1, minBarsPerLabel);

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
      let lastLabelX = -MIN_LABEL_PX * pr; // Prevent overlap with left edge
      for (let i = 0; i < vis.length; i += step) {
        if (!vis[i].time) continue;
        const x = Math.round(timeTransform.indexToPixel(start + i) * pr);
        if (x < 0 || x > cBW) continue;
        // Skip if too close to previous label
        if (x - lastLabelX < MIN_LABEL_PX * pr * 0.8) continue;

        const label = formatTimeLabel(vis[i].time, fs.timeframe, prevTime, fs.activeTimezone || 'UTC');
        prevTime = vis[i].time;
        timeLabels.push({ text: label, x, y: tY + Math.round(5 * pr), fontSize: 10 });
        lastLabelX = x;
      }

      // Sprint 9: Session dividers (thicker line at day boundaries for intraday)
      // 8.1.3: Use numeric timestamps directly — avoid new Date() in hot loops
      const firstTime = typeof vis[0].time === 'number' ? vis[0].time : new Date(vis[0].time).getTime();
      const lastTime = typeof vis[vis.length - 1].time === 'number' ? vis[vis.length - 1].time : new Date(vis[vis.length - 1].time).getTime();
      const tfMs = vis.length > 1
        ? (lastTime - firstTime) / vis.length
        : 60000;
      if (tfMs < 86400000) { // Only for intraday
        oCtx.save();
        oCtx.strokeStyle = thm.gridLine || 'rgba(54,58,69,0.5)';
        oCtx.lineWidth = Math.max(1, pr);
        oCtx.setLineDash([4 * pr, 2 * pr]);
        for (let i = 1; i < vis.length; i++) {
          if (!vis[i].time || !vis[i - 1].time) continue;
          // 8.1.3: Numeric day-boundary detection (avoid new Date() per iteration)
          const t = typeof vis[i].time === 'number' ? vis[i].time : +new Date(vis[i].time);
          const pt = typeof vis[i - 1].time === 'number' ? vis[i - 1].time : +new Date(vis[i - 1].time);
          const DAY_MS = 86400000;
          const tz = fs.activeTimezone || 'UTC';
          if (temporalEngine.dayStartUTC(t, tz) !== temporalEngine.dayStartUTC(pt, tz)) {
            const sx = Math.round(timeTransform.indexToPixel(start + i) * pr);
            if (sx > 0 && sx < cBW) {
              oCtx.beginPath();
              oCtx.moveTo(sx + 0.5, 0);
              oCtx.lineTo(sx + 0.5, mainBH);
              oCtx.stroke();
            }
          }
        }
        oCtx.restore();
      }

      // Sprint 9: Weekend/holiday gap markers (daily+ TFs)
      if (tfMs >= 86400000) {
        oCtx.save();
        oCtx.strokeStyle = thm.gridLine || 'rgba(54,58,69,0.25)';
        oCtx.lineWidth = Math.max(1, pr);
        oCtx.setLineDash([2 * pr, 3 * pr]);
        for (let i = 1; i < vis.length; i++) {
          if (!vis[i].time || !vis[i - 1].time) continue;
          // 8.1.3: Numeric gap detection (avoid new Date() per iteration)
          const t = typeof vis[i].time === 'number' ? vis[i].time : +new Date(vis[i].time);
          const pt = typeof vis[i - 1].time === 'number' ? vis[i - 1].time : +new Date(vis[i - 1].time);
          const gapMs = t - pt;
          // Gap > 2 days indicates weekend or holiday
          if (gapMs > 86400000 * 2) {
            const gx = Math.round(timeTransform.indexToPixel(start + i - 0.5) * pr);
            if (gx > 0 && gx < cBW) {
              oCtx.beginPath();
              oCtx.moveTo(gx + 0.5, 0);
              oCtx.lineTo(gx + 0.5, mainBH);
              oCtx.stroke();
            }
          }
        }
        oCtx.restore();
      }

      // ─── Collision Avoidance for Time Labels (8.3.2) ─────────
      const filteredTimeLabels = filterOverlappingTimeLabels(timeLabels, Math.round(16 * pr));

      // GPU SDF text path for time labels
      if (useGPUText) {
        const axisColor = _parseColorToArray(thm.axisText || '#787B86');
        const sdfEntries = filteredTimeLabels.map(l => ({
          text: l.text,
          x: l.x,
          y: l.y,
          fontSize: l.fontSize,
          color: axisColor,
          align: 'center',
        }));
        // eslint-disable-next-line no-undef
        const timeTextFn = () => webgl.drawSDFText(sdfEntries, { pixelRatio: pr });
        const cmdBuf = ctx.commandBuffer;
        if (cmdBuf) {
          cmdBuf.push({ program: null, blendMode: 0, texture: null, zOrder: 5, label: 'time-labels', drawFn: timeTextFn });
        } else {
          timeTextFn();
        }
      } else {
        for (const l of filteredTimeLabels) {
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
    const badgeColor = last.close >= last.open ? thm.bullCandle || '#26A69A' : thm.bearCandle || '#EF5350';
    mCtx.font = `bold ${fnFs}px Arial`;
    let badgeVal = last.close;
    let badgeStr = formatPrice(badgeVal) + (scaleMode === 'percent' && percentBase > 0 ? '%' : '');
    if (scaleMode === 'percent' && percentBase > 0) {
      badgeStr = formatPrice(((badgeVal - percentBase) / percentBase) * 100) + '%';
    }
    // Measure text and compute pill width — clamp to axis gutter
    const textW = mCtx.measureText(badgeStr).width;
    const pillPad = Math.round(6 * pr);
    const pillW = Math.min(textW + pillPad * 2, bw - axX); // don't exceed axis gutter
    const pillX = bw - pillW;
    const pillR = Math.round(3 * pr);
    // Draw rounded pill background
    mCtx.fillStyle = badgeColor;
    mCtx.beginPath();
    mCtx.roundRect(pillX, y - bH / 2, pillW, bH, [pillR, 0, 0, pillR]);
    mCtx.fill();
    // Price text — right-aligned within pill
    mCtx.fillStyle = '#fff';
    mCtx.textAlign = 'right';
    mCtx.textBaseline = 'middle';
    mCtx.fillText(badgeStr, bw - axP, y);
  }

  // ─── Sprint 14: Crosshair Price Marker (Y-axis gutter) ──────
  const S = engine.state;
  if (S.mouseY != null && S.mouseX != null && S.mouseX >= 0 && S.mouseX <= cW) {
    const cursorPrice = yMin + ((mainHeight - S.mouseY) / mainHeight) * (yMax - yMin);
    const cursorY = Math.round(p2y(cursorPrice) * pr);
    const cmH = Math.round(18 * pr);
    const cmR = Math.round(3 * pr);

    // Colored pill based on whether cursor is above/below last close
    const lastBar = bars[bars.length - 1];
    const isBull = lastBar ? cursorPrice >= lastBar.close : true;
    const cmColor = isBull
      ? (thm.bullCandle || '#26A69A')
      : (thm.bearCandle || '#EF5350');

    // Price text
    let cmText = formatPrice(cursorPrice);
    if (scaleMode === 'percent' && percentBase > 0) {
      cmText = formatPrice(((cursorPrice - percentBase) / percentBase) * 100) + '%';
    } else if (scaleMode === 'percent') {
      cmText += '%';
    }
    mCtx.font = `bold ${fnFs}px Arial`;
    // Measure text and compute pill width — clamp to axis gutter
    const cmTextW = mCtx.measureText(cmText).width;
    const cmPad = Math.round(6 * pr);
    const cmPillW = Math.min(cmTextW + cmPad * 2, bw - axX);
    const cmPillX = bw - cmPillW;

    // Pill background
    mCtx.fillStyle = cmColor;
    mCtx.beginPath();
    mCtx.roundRect(cmPillX, cursorY - cmH / 2, cmPillW, cmH, [cmR, 0, 0, cmR]);
    mCtx.fill();

    mCtx.fillStyle = '#FFFFFF';
    mCtx.textAlign = 'right';
    mCtx.textBaseline = 'middle';
    mCtx.fillText(cmText, bw - axP, cursorY);

    // Dashed horizontal line across chart at crosshair Y
    mCtx.save();
    mCtx.strokeStyle = cmColor + '44';
    mCtx.lineWidth = Math.max(1, pr);
    mCtx.setLineDash([4 * pr, 3 * pr]);
    mCtx.beginPath();
    mCtx.moveTo(0, cursorY + 0.5);
    mCtx.lineTo(cBW, cursorY + 0.5);
    mCtx.stroke();
    mCtx.restore();
  }
  if (!S.autoScale) {
    // Hit region only — visual button is now a DOM overlay in ChartEngineWidget
    const afSize = Math.round(20 * pr);
    const afX = bw - Math.round(axW * pr) - afSize - Math.round(30 * pr);
    const afY = Math.round(4 * pr);
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

  // Task 1.4.14: Y-axis lock toggle button
  const lockX = pctX + toggleW + Math.round(4 * pr);
  const isLocked = S.yAxisLocked;
  mCtx.fillStyle = isLocked ? '#EF5350' : thm.bg || '#131722';
  mCtx.fillRect(lockX, toggleY, toggleW, toggleH);
  mCtx.fillStyle = isLocked ? '#FFFFFF' : thm.axisText || '#787B86';
  mCtx.fillText(isLocked ? '🔒' : '🔓', lockX + toggleW / 2, toggleY + toggleH / 2);
  S._yAxisLockBtn = { x: lockX / pr, y: toggleY / pr, w: toggleW / pr, h: toggleH / pr };
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
// eslint-disable-next-line @typescript-eslint/naming-convention
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
