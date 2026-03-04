// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Sub-Renderer: Horizontal / Vertical Lines
// ═══════════════════════════════════════════════════════════════════

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{x:number,y:number}>} pts  bitmap-space points
 * @param {object} style   drawing style bag
 * @param {number} lw      resolved lineWidth (px)
 * @param {number} pr      pixelRatio
 * @param {object} size    { bitmapWidth, bitmapHeight }
 * @param {object} [deps]  { drawingEngine } — only for showLabel lookup
 */

export function renderHorizontalLine(ctx, pts, style, lw, pr, size) {
  if (pts.length < 1) return;
  const y = pts[0].y;
  ctx.strokeStyle = style.color;
  ctx.lineWidth = lw;
  ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(size.bitmapWidth, y);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function renderHorizontalRay(ctx, pts, style, lw, pr, size, deps) {
  if (pts.length < 1) return;
  const y = pts[0].y;
  ctx.strokeStyle = style.color;
  ctx.lineWidth = lw;
  ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, y);
  ctx.lineTo(size.bitmapWidth, y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Price label
  if (style.showLabel && deps) {
    const { drawingEngine, drawLabel } = deps;
    const pricePoint = drawingEngine.drawings.find((d) =>
      d.points.some((p) => {
        const px = drawingEngine.anchorToPixel(p);
        return px && Math.round(px.y * pr) === y;
      }),
    );
    if (pricePoint && pricePoint.points[0]) {
      drawLabel(
        ctx,
        pricePoint.points[0].price.toFixed(2),
        size.bitmapWidth - Math.round(60 * pr),
        y,
        style.color,
        pr,
      );
    }
  }
}

export function renderVerticalLine(ctx, pts, style, lw, pr, size) {
  if (pts.length < 1) return;
  const x = pts[0].x;
  ctx.strokeStyle = style.color;
  ctx.lineWidth = lw;
  ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, size.bitmapHeight);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function renderCrossline(ctx, pts, style, lw, pr, size) {
  if (pts.length < 1) return;
  ctx.strokeStyle = style.color;
  ctx.lineWidth = lw;
  ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);

  // Horizontal
  ctx.beginPath();
  ctx.moveTo(0, pts[0].y);
  ctx.lineTo(size.bitmapWidth, pts[0].y);
  ctx.stroke();

  // Vertical
  ctx.beginPath();
  ctx.moveTo(pts[0].x, 0);
  ctx.lineTo(pts[0].x, size.bitmapHeight);
  ctx.stroke();

  ctx.setLineDash([]);
}
