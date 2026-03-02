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
  const cacheKey = _gridCacheKey(fs, engine) + `:${thm.bg}:${thm.gridLine}:${thm.fg}`;

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
  oCtx.globalAlpha = 0.06;
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
  const horizontal = [];
  for (const tick of niceStep.ticks) {
    const y = R.p2y(tick);
    if (y >= 0 && y <= mainHeight) {
      horizontal.push({ y, isMajor: false });
    }
  }

  // Compute vertical grid line positions (time axis)
  const vertical = [];
  if (R.timeTransform && R.vis?.length > 0) {
    const step = Math.max(1, Math.floor(R.vis.length / 8));
    for (let i = 0; i < R.vis.length; i += step) {
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
    // Canvas2D fallback: draw grid lines to offscreen canvas
    oCtx.fillStyle = thm.gridLine || 'rgba(54,58,69,0.3)';
    for (const line of horizontal) {
      const by = Math.round(line.y * pr);
      oCtx.fillRect(0, by, Math.round(cW * pr), Math.max(1, pr));
    }
    for (const line of vertical) {
      const bx = Math.round(line.x * pr);
      oCtx.fillRect(bx, 0, Math.max(1, pr), Math.round(mainHeight * pr));
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
