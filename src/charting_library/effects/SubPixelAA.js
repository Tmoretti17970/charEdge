// ═══════════════════════════════════════════════════════════════════
// charEdge — SubPixelAA
//
// Sub-pixel anti-aliasing for all line and edge primitives.
// Eliminates "staircase" artifacts on diagonal lines by applying
// per-axis sub-pixel shifting aligned to the device pixel grid.
//
// Integrates with RenderQuality's GPU tier system:
//   high  → full sub-pixel AA (3-pass Gaussian + snap)
//   mid   → single-pass snap only
//   low   → disabled (pass-through)
// ═══════════════════════════════════════════════════════════════════

/**
 * Snap a coordinate to the nearest device sub-pixel boundary.
 * This prevents blurry half-pixel rendering on HiDPI displays.
 *
 * @param {number} v   - Coordinate in CSS pixels
 * @param {number} pr  - Device pixel ratio
 * @returns {number} Snapped coordinate
 */
export function subPixelSnap(v, pr) {
  if (!pr || pr <= 0) return v;
  return Math.round(v * pr) / pr;
}

/**
 * Snap both x/y coordinates for a point.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} pr
 * @returns {{ x: number, y: number }}
 */
export function subPixelSnapPoint(x, y, pr) {
  return {
    x: subPixelSnap(x, pr),
    y: subPixelSnap(y, pr),
  };
}

/**
 * Draw a sub-pixel anti-aliased line using multi-pass Gaussian rendering.
 * Extends RenderQuality.drawGaussianLine with per-axis sub-pixel alignment.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{x: number, y: number}>} points - Points in CSS pixels
 * @param {string} color   - CSS color string
 * @param {number} width   - Line width in CSS pixels
 * @param {number} pr      - Device pixel ratio
 * @param {string} [tier='high'] - GPU quality tier
 */
export function drawSubPixelLine(ctx, points, color, width, pr, tier = 'high') {
  if (!points || points.length < 2) return;

  // Low tier: simple line, no AA
  if (tier === 'low') {
    _drawSimpleLine(ctx, points, color, width, pr);
    return;
  }

  // Snap all points to sub-pixel grid
  const snapped = points.map(p => subPixelSnapPoint(p.x, p.y, pr));

  // Mid tier: single snapped pass
  if (tier === 'mid') {
    _drawSimpleLine(ctx, snapped, color, width, pr);
    return;
  }

  // High tier: multi-pass Gaussian sub-pixel AA
  const w = width * pr;
  const passes = w < 2 ? 3 : 2;
  const alphaStep = 1 / passes;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let pass = passes - 1; pass >= 0; pass--) {
    const expandedWidth = w + pass * 0.6 * pr;
    const alpha = pass === 0 ? 1 : alphaStep * (passes - pass) * 0.25;

    // Sub-pixel jitter for outer passes (anti-aliasing fringe)
    const jitterX = pass > 0 ? (pass % 2 === 0 ? 0.25 : -0.25) / pr : 0;
    const jitterY = pass > 0 ? (pass % 2 === 0 ? -0.25 : 0.25) / pr : 0;

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = expandedWidth;

    ctx.beginPath();
    for (let i = 0; i < snapped.length; i++) {
      const x = (snapped[i].x + jitterX) * pr;
      const y = (snapped[i].y + jitterY) * pr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw a sub-pixel–snapped rectangle with crisp edges.
 * Prevents the common half-pixel blur on rect borders.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number, w: number, h: number }} rect - CSS pixels
 * @param {string} color
 * @param {number} pr - Device pixel ratio
 */
export function drawSubPixelRect(ctx, rect, color, pr) {
  if (!rect || rect.w <= 0 || rect.h <= 0) return;

  const x = subPixelSnap(rect.x, pr) * pr;
  const y = subPixelSnap(rect.y, pr) * pr;
  const w = Math.round(rect.w * pr);
  const h = Math.round(rect.h * pr);

  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/**
 * @private Draw a simple single-pass line.
 */
function _drawSimpleLine(ctx, points, color, width, pr) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = width * pr;
  ctx.globalAlpha = 1;

  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const x = points[i].x * pr;
    const y = points[i].y * pr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}
