// ═══════════════════════════════════════════════════════════════════
// charEdge — GridStage
// Renders: background fill, watermark, grid lines
// Layer: GRID
//
// Phase 1.1.3: Offscreen bitmap cache — grid is rendered to an
// OffscreenCanvas and composited via drawImage() on cache hits.
// Invalidated only on zoom, resize, theme, or symbol change.
// ═══════════════════════════════════════════════════════════════════

import { LAYERS } from '../LayerManager.js';
import { niceScale } from '../CoordinateSystem.js';

// ─── Offscreen Bitmap Cache ──────────────────────────────────────
let _gridCache = { canvas: null, ctx: null, key: '' };

/**
 * Build invalidation key from rendering inputs.
 * Captures everything that would change the grid appearance.
 */
function _gridCacheKey(fs, engine) {
  const niceStep = engine._lastNiceStep;
  const tickStr = niceStep?.ticks?.join(',') ?? '';
  const R = engine.state.lastRender;
  const visLen = R?.vis?.length ?? 0;
  return `${fs.bitmapWidth}:${fs.bitmapHeight}:${fs.pixelRatio}:${fs.symbol}:${fs.timeframe}:${fs.chartWidth}:${fs.mainHeight}:${tickStr}:${visLen}:${fs.startIdx}`;
}

/**
 * Render the grid layer: background, watermark text, and grid lines.
 *
 * @param {import('../FrameState.js').FrameState} fs
 * @param {Object} ctx - Render contexts
 * @param {Object} engine - ChartEngine instance
 */
export function executeGridStage(fs, ctx, engine) {
  const { layers, theme: thm, gridCtx: gCtx } = ctx;

  if (!layers.isDirty(LAYERS.GRID)) return;
  layers.clearDirty(LAYERS.GRID);

  const { bitmapWidth: bw, bitmapHeight: bh, pixelRatio: pr, chartWidth: cW, mainHeight } = fs;

  // ─── Cache Check ─────────────────────────────────────────────
  // B2.4: Include transition state in cache key to invalidate during cross-fade
  const transKey = engine._niceStepTransition ? `:t${Math.round(performance.now() - engine._niceStepTransition.startTime)}` : '';
  const cacheKey = _gridCacheKey(fs, engine) + `:${thm.bg}:${thm.gridLine}:${thm.fg}${transKey}`;

  if (_gridCache.key === cacheKey && _gridCache.canvas) {
    // CACHE HIT — composite cached bitmap
    gCtx.drawImage(_gridCache.canvas, 0, 0);
    return;
  }

  // ─── Cache Miss — render to offscreen canvas ─────────────────
  // Ensure offscreen canvas matches dimensions
  if (!_gridCache.canvas || _gridCache.canvas.width !== bw || _gridCache.canvas.height !== bh) {
    if (typeof OffscreenCanvas !== 'undefined') {
      _gridCache.canvas = new OffscreenCanvas(bw, bh);
    } else {
      _gridCache.canvas = document.createElement('canvas');
      _gridCache.canvas.width = bw;
      _gridCache.canvas.height = bh;
    }
    _gridCache.ctx = _gridCache.canvas.getContext('2d');
  }

  const oCtx = _gridCache.ctx;

  // Background fill
  oCtx.fillStyle = thm.bg;
  oCtx.fillRect(0, 0, bw, bh);

  // Watermark
  oCtx.save();
  oCtx.globalAlpha = 0.03;
  const wmFs = Math.round(Math.min(cW, mainHeight) * 0.12 * pr);
  oCtx.font = `bold ${wmFs}px Arial`;
  oCtx.fillStyle = thm.fg || '#D1D4DC';
  oCtx.textAlign = 'center';
  oCtx.textBaseline = 'middle';
  oCtx.fillText(fs.symbol || '', Math.round(cW * pr / 2), Math.round(mainHeight * pr * 0.45));
  const wmFs2 = Math.round(wmFs * 0.35);
  oCtx.font = `${wmFs2}px Arial`;
  oCtx.fillText(fs.timeframe || '', Math.round(cW * pr / 2), Math.round(mainHeight * pr * 0.45 + wmFs * 0.7));
  oCtx.restore();

  // ─── Grid Lines ─────────────────────────────────────────────
  const R = engine.state.lastRender;
  const niceStep = engine._lastNiceStep;
  if (!R || !niceStep || !R.p2y) {
    // Store partial cache (bg + watermark) and composite
    _gridCache.key = cacheKey;
    gCtx.drawImage(_gridCache.canvas, 0, 0);
    return;
  }

  // Compute horizontal grid line positions (price axis)
  // Task 2.7.2: Auto-reduce ticks at small heights
  const horizontal = [];
  const maxPriceTicks = mainHeight < 200 ? 3 : mainHeight < 350 ? 5 : niceStep.ticks.length;
  let priceTickCount = 0;
  const priceTickStride = maxPriceTicks < niceStep.ticks.length
    ? Math.ceil(niceStep.ticks.length / maxPriceTicks)
    : 1;

  // B2.4: Cross-fade transition — track which ticks are new vs old
  const transition = engine._niceStepTransition;
  let transProgress = 1; // 1 = no transition, use full alpha
  if (transition) {
    const elapsed = performance.now() - transition.startTime;
    transProgress = Math.min(1, elapsed / transition.duration);
  }

  for (let ti = 0; ti < niceStep.ticks.length; ti += priceTickStride) {
    const tick = niceStep.ticks[ti];
    const y = R.p2y(tick);
    if (y >= 0 && y <= mainHeight) {
      // B2.4: If in transition, new ticks fade in
      const alpha = transition ? transProgress : 1;
      horizontal.push({ y, isMajor: false, alpha });
      priceTickCount++;
      if (priceTickCount >= maxPriceTicks) break;
    }
  }

  // B2.4: Also render fading-out old ticks during transition
  if (transition && transProgress < 1) {
    const oldTicks = transition.fromTicks;
    const fadeOutAlpha = 1 - transProgress;
    for (let ti = 0; ti < oldTicks.length; ti++) {
      const tick = oldTicks[ti];
      const y = R.p2y(tick);
      if (y >= 0 && y <= mainHeight) {
        // Only add if not already covered by a new tick at similar position
        const alreadyCovered = horizontal.some(h => Math.abs(h.y - y) < 3);
        if (!alreadyCovered) {
          horizontal.push({ y, isMajor: false, alpha: fadeOutAlpha });
        }
      }
    }
  }

  // Compute vertical grid line positions (time axis)
  // Task 2.3.24: Grid LOD — reduce density at high zoom
  // Task 2.7.2: Auto-reduce ticks at small widths
  const vertical = [];
  const visibleBars = R.vis?.length ?? 0;
  if (R.timeTransform && visibleBars > 0) {
    // LOD: fewer grid lines at high zoom (<30 bars) or small width (<400px)
    let divider = 8;
    if (visibleBars < 30) divider = 4; // High zoom → sparser grid
    if (cW < 400) divider = Math.max(3, divider / 2); // Small width → even sparser
    const step = Math.max(1, Math.floor(visibleBars / divider));
    for (let i = 0; i < visibleBars; i += step) {
      const x = R.timeTransform.indexToPixel(fs.startIdx + i);
      if (x >= 0 && x <= cW) {
        vertical.push({ x, isMajor: false });
      }
    }
  }

  const gridData = { horizontal, vertical };

  // GPU path: single draw call for all grid lines
  const webgl = ctx.webgl;
  if (webgl?.available && typeof webgl.drawGrid === 'function') {
    const gridDrawFn = () => webgl.drawGrid(gridData, {
      pixelRatio: pr,
      chartWidth: cW,
      mainHeight,
    }, thm);
    const cmdBuf = ctx.commandBuffer;
    if (cmdBuf) {
      cmdBuf.push({
        program: webgl.getProgram('fibFill'),
        blendMode: 0,
        texture: null,
        zOrder: -1,
        label: 'grid-stage-lines',
        drawFn: gridDrawFn,
      });
    } else {
      gridDrawFn();
    }
    // For GPU path, cache bg+watermark only (grid lines go through GPU)
    _gridCache.key = cacheKey;
    gCtx.drawImage(_gridCache.canvas, 0, 0);
  } else {
    // Canvas2D fallback: intersection dot-grid (Apple Notes style)
    const dotRadius = Math.max(0.8, pr * 0.7);
    const dotAlpha = visibleBars < 30 ? 0.12 : 0.22;
    oCtx.fillStyle = thm.gridLine || `rgba(54,58,69,${dotAlpha})`;

    for (const hLine of horizontal) {
      oCtx.globalAlpha = (hLine.alpha ?? 1) * dotAlpha;
      for (const vLine of vertical) {
        const bx = Math.round(vLine.x * pr);
        const by = Math.round(hLine.y * pr);
        oCtx.beginPath();
        oCtx.arc(bx, by, dotRadius, 0, Math.PI * 2);
        oCtx.fill();
      }
    }
    oCtx.globalAlpha = 1;

    // Future zone fade: subtle gradient after last candle
    const lastBarX = R.timeTransform?.indexToPixel(fs.startIdx + visibleBars - 1) ?? cW;
    if (lastBarX < cW * 0.95) {
      const grad = oCtx.createLinearGradient(lastBarX * pr, 0, cW * pr, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.035)');
      oCtx.fillStyle = grad;
      oCtx.fillRect(Math.round(lastBarX * pr), 0, Math.round((cW - lastBarX) * pr), Math.round(mainHeight * pr));
    }

    // Store completed cache and composite
    _gridCache.key = cacheKey;
    gCtx.drawImage(_gridCache.canvas, 0, 0);
  }
}

/**
 * Invalidate the grid cache (called on theme change, etc.).
 */
export function invalidateGridCache() {
  _gridCache.key = '';
}

// Re-export cache reference for testing
export { _gridCache };
