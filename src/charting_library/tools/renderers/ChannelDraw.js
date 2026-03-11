// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Sub-Renderer: Channels
// ═══════════════════════════════════════════════════════════════════

export function renderChannel(ctx, pts, style, lw, _pr, _size) {
  if (pts.length < 2) return;
  ctx.strokeStyle = style.color; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.stroke();
  if (pts.length >= 3) {
    const dx = pts[1].x - pts[0].x, dy = pts[1].y - pts[0].y;
    ctx.beginPath(); ctx.moveTo(pts[2].x, pts[2].y); ctx.lineTo(pts[2].x + dx, pts[2].y + dy); ctx.stroke();
    if (style.fillColor) {
      ctx.fillStyle = style.fillColor; ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y);
      ctx.lineTo(pts[2].x + dx, pts[2].y + dy); ctx.lineTo(pts[2].x, pts[2].y);
      ctx.closePath(); ctx.fill();
    }
  }
}

export function renderPitchfork(ctx, pts, drawing, style, lw, pr, size) {
  if (pts.length < 3) return;
  ctx.strokeStyle = style.color; ctx.lineWidth = lw;
  ctx.setLineDash(style.dash ? style.dash.map(d => Math.round(d * pr)) : []);
  ctx.beginPath(); ctx.moveTo(pts[1].x, pts[1].y); ctx.lineTo(pts[2].x, pts[2].y); ctx.stroke();
  const midX = (pts[1].x + pts[2].x) / 2, midY = (pts[1].y + pts[2].y) / 2;
  const dx = midX - pts[0].x, dy = midY - pts[0].y, len = Math.sqrt(dx * dx + dy * dy);
  if (len > 0) {
    const scale = (Math.max(size.bitmapWidth, size.bitmapHeight) * 2) / len;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[0].x + dx * scale, pts[0].y + dy * scale); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pts[1].x, pts[1].y); ctx.lineTo(pts[1].x + dx * scale, pts[1].y + dy * scale); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pts[2].x, pts[2].y); ctx.lineTo(pts[2].x + dx * scale, pts[2].y + dy * scale); ctx.stroke();
    if (style.fillColor) {
      ctx.fillStyle = style.fillColor; ctx.beginPath();
      ctx.moveTo(pts[1].x, pts[1].y); ctx.lineTo(pts[2].x, pts[2].y);
      ctx.lineTo(pts[2].x + dx * scale, pts[2].y + dy * scale); ctx.lineTo(pts[1].x + dx * scale, pts[1].y + dy * scale);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.setLineDash([]);
}

export function renderParallelChannel(ctx, pts, style, lw, pr, _size) {
  if (pts.length < 2) return;
  const [p0, p1] = pts;
  ctx.strokeStyle = style.color; ctx.lineWidth = lw;
  ctx.setLineDash(style.dash ? style.dash.map(d => Math.round(d * pr)) : []);
  ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
  if (pts.length >= 3) {
    const dx = p1.x - p0.x, dy = p1.y - p0.y;
    ctx.beginPath(); ctx.moveTo(pts[2].x, pts[2].y); ctx.lineTo(pts[2].x + dx, pts[2].y + dy); ctx.stroke();
    const midY0 = (p0.y + pts[2].y) / 2, midX0 = (p0.x + pts[2].x) / 2;
    ctx.setLineDash([Math.round(4 * pr), Math.round(4 * pr)]); ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.moveTo(midX0, midY0); ctx.lineTo(midX0 + dx, midY0 + dy); ctx.stroke();
    ctx.globalAlpha = 1;
    if (style.fillColor) {
      ctx.fillStyle = style.fillColor; ctx.beginPath();
      ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(pts[2].x + dx, pts[2].y + dy); ctx.lineTo(pts[2].x, pts[2].y);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.setLineDash([]);
}

export function renderRegressionChannel(ctx, pts, drawing, style, lw, pr, _size) {
  if (pts.length < 2 || !drawing.points || drawing.points.length < 2) return;
  const x1 = pts[0].x, y1 = pts[0].y, x2 = pts[1].x, y2 = pts[1].y;
  if (Math.abs(x2 - x1) < 2) return;
  const halfRange = Math.abs(y2 - y1) * 0.15;
  ctx.strokeStyle = style.color; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.setLineDash([Math.round(4 * pr), Math.round(4 * pr)]);
  ctx.beginPath(); ctx.moveTo(x1, y1 - halfRange); ctx.lineTo(x2, y2 - halfRange); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1, y1 + halfRange); ctx.lineTo(x2, y2 + halfRange); ctx.stroke();
  ctx.setLineDash([]);
  if (style.fillColor) {
    ctx.fillStyle = style.fillColor; ctx.beginPath();
    ctx.moveTo(x1, y1 - halfRange); ctx.lineTo(x2, y2 - halfRange);
    ctx.lineTo(x2, y2 + halfRange); ctx.lineTo(x1, y1 + halfRange); ctx.closePath(); ctx.fill();
  }
  if (style.showLabel) {
    const fontSize = Math.round(10 * pr);
    ctx.font = `${fontSize}px Arial`; ctx.fillStyle = style.color;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText('Reg', x2 - 4 * pr, y2);
    ctx.fillText('+1σ', x2 - 4 * pr, y2 - halfRange);
    ctx.fillText('-1σ', x2 - 4 * pr, y2 + halfRange);
  }
}
