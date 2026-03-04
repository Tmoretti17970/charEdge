// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Sub-Renderer: Trendlines, Rays, Arrows, Polyline
// ═══════════════════════════════════════════════════════════════════

export function renderTrendline(ctx, pts, style, lw, pr) {
  if (pts.length < 2) return;
  ctx.strokeStyle = style.color;
  ctx.lineWidth = lw;
  ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function renderRay(ctx, pts, style, lw, pr, size) {
  if (pts.length < 2) return;
  ctx.strokeStyle = style.color;
  ctx.lineWidth = lw;
  ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);

  const dx = pts[1].x - pts[0].x;
  const dy = pts[1].y - pts[0].y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;

  const scale = (Math.max(size.bitmapWidth, size.bitmapHeight) * 2) / len;
  const endX = pts[0].x + dx * scale;
  const endY = pts[0].y + dy * scale;

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function renderExtendedLine(ctx, pts, style, lw, pr, size) {
  if (pts.length < 2) return;
  ctx.strokeStyle = style.color;
  ctx.lineWidth = lw;
  ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);

  const dx = pts[1].x - pts[0].x;
  const dy = pts[1].y - pts[0].y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;

  const scale = (Math.max(size.bitmapWidth, size.bitmapHeight) * 2) / len;

  ctx.beginPath();
  ctx.moveTo(pts[0].x - dx * scale, pts[0].y - dy * scale);
  ctx.lineTo(pts[0].x + dx * scale, pts[0].y + dy * scale);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function renderArrow(ctx, pts, style, lw, pr) {
  if (pts.length < 2) return;

  ctx.strokeStyle = style.color;
  ctx.lineWidth = lw;
  ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.stroke();

  const dx = pts[1].x - pts[0].x;
  const dy = pts[1].y - pts[0].y;
  const angle = Math.atan2(dy, dx);
  const headlen = Math.max(10, lw * 4) * pr;

  ctx.beginPath();
  ctx.moveTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[1].x - headlen * Math.cos(angle - Math.PI / 6), pts[1].y - headlen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(pts[1].x - headlen * Math.cos(angle + Math.PI / 6), pts[1].y - headlen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();

  ctx.fillStyle = style.color;
  ctx.fill();
  ctx.setLineDash([]);
}

export function renderPolyline(ctx, pts, style, lw, pr) {
  if (pts.length < 2) return;

  ctx.strokeStyle = style.color;
  ctx.lineWidth = lw;
  ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Small dots at each vertex
  const dotR = Math.round(2 * pr);
  ctx.fillStyle = style.color;
  for (const p of pts) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2);
    ctx.fill();
  }
}
