// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Sub-Renderer: Pattern Recognition Tools
// (Gann Fan, Gann Square, XABCD Harmonic, Head & Shoulders)
// ═══════════════════════════════════════════════════════════════════

export function renderGannFan(ctx, pts, drawing, style, lw, pr, size) {
  if (pts.length < 2) return;
  const origin = pts[0], target = pts[1];
  const dx = target.x - origin.x, dy = target.y - origin.y;
  if (dx === 0) return;
  const angles = [8/1, 4/1, 3/1, 2/1, 1/1, 1/2, 1/3, 1/4, 1/8];
  const maxDim = Math.max(size.bitmapWidth, size.bitmapHeight) * 2;
  ctx.strokeStyle = style.color; ctx.lineWidth = lw;
  ctx.setLineDash(style.dash ? style.dash.map(d => Math.round(d * pr)) : []);
  for (let i = 0; i < angles.length; i++) {
    const mul = angles[i];
    ctx.beginPath(); ctx.moveTo(origin.x, origin.y);
    let endX, endY;
    if (i === 4) {
      const len = Math.sqrt(dx * dx + dy * dy); if (len === 0) continue;
      const scale = maxDim / len; endX = origin.x + dx * scale; endY = origin.y + dy * scale;
    } else {
      const newDy = dy * mul; const len = Math.sqrt(dx * dx + newDy * newDy); if (len === 0) continue;
      const scale = maxDim / len; endX = origin.x + dx * scale; endY = origin.y + newDy * scale;
    }
    ctx.lineTo(endX, endY); ctx.stroke();
    if (style.showLabel) {
      const lbl = angles[i] >= 1 ? `${angles[i]}/1` : `1/${1/angles[i]}`;
      ctx.font = `${Math.round(10 * pr)}px Arial`; ctx.fillStyle = style.color;
      const tX = origin.x + (endX - origin.x) * 0.3, tY = origin.y + (endY - origin.y) * 0.3;
      if (tX > 0 && tX < size.bitmapWidth && tY > 0 && tY < size.bitmapHeight) ctx.fillText(lbl, tX, tY);
    }
  }
  ctx.setLineDash([]);
}

export function renderGannSquare(ctx, pts, drawing, style, lw, pr, _size) {
  if (pts.length < 2) return;
  const x1 = pts[0].x, y1 = pts[0].y, x2 = pts[1].x, y2 = pts[1].y;
  const w = x2 - x1, h = y2 - y1;
  ctx.strokeStyle = style.color; ctx.lineWidth = lw;
  ctx.setLineDash(style.dash?.length ? style.dash.map(d => d * pr) : []);
  ctx.strokeRect(x1, y1, w, h);
  for (let i = 1; i < 3; i++) {
    const frac = i / 3;
    ctx.beginPath(); ctx.moveTo(x1, y1 + h * frac); ctx.lineTo(x2, y1 + h * frac); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1 + w * frac, y1); ctx.lineTo(x1 + w * frac, y2); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.moveTo(x2, y1); ctx.lineTo(x1, y2); ctx.stroke();
  ctx.setLineDash([]);
  if (style.showLabel) {
    ctx.font = `${Math.round(9 * pr)}px Arial`; ctx.fillStyle = style.color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('Gann', (x1 + x2) / 2, y1 - Math.round(9 * pr) - 2 * pr);
  }
}

export function renderXABCD(ctx, pts, drawing, style, lw, pr, _size) {
  if (pts.length < 2) return;
  const labels = ['X', 'A', 'B', 'C', 'D'];
  ctx.strokeStyle = style.color; ctx.lineWidth = lw;
  ctx.setLineDash(style.dash?.length ? style.dash.map(d => d * pr) : []);
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  if (pts.length >= 4 && style.fillColor) {
    ctx.fillStyle = style.fillColor; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.closePath(); ctx.fill();
  }
  if (pts.length >= 4) {
    ctx.save(); ctx.setLineDash([4 * pr, 4 * pr]); ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[3].x, pts[3].y); ctx.stroke();
    if (pts.length >= 5) { ctx.beginPath(); ctx.moveTo(pts[1].x, pts[1].y); ctx.lineTo(pts[4].x, pts[4].y); ctx.stroke(); }
    ctx.restore();
  }
  ctx.setLineDash([]);
  if (style.showLabel) {
    ctx.font = `bold ${Math.round(10 * pr)}px Arial`; ctx.fillStyle = style.color; ctx.textAlign = 'center';
    for (let i = 0; i < pts.length && i < labels.length; i++) {
      ctx.fillText(labels[i], pts[i].x, pts[i].y + ((i % 2 === 0) ? -8 * pr : 12 * pr));
    }
  }
}

export function renderHeadShoulders(ctx, pts, drawing, style, lw, pr, size) {
  if (pts.length < 2) return;
  const labels = ['LS', 'V1', 'H', 'V2', 'RS', 'NL1', 'NL2'];
  ctx.strokeStyle = style.color; ctx.lineWidth = lw;
  ctx.setLineDash(style.dash?.length ? style.dash.map(d => d * pr) : []);
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < Math.min(pts.length, 5); i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  if (pts.length >= 6) {
    ctx.save(); ctx.setLineDash([6 * pr, 4 * pr]);
    ctx.beginPath(); ctx.moveTo(pts[5].x, pts[5].y);
    if (pts.length >= 7) ctx.lineTo(pts[6].x, pts[6].y); else ctx.lineTo(size.bitmapWidth, pts[5].y);
    ctx.stroke(); ctx.restore();
  }
  if (pts.length >= 5 && style.fillColor) {
    ctx.fillStyle = style.fillColor; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 5; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.closePath(); ctx.fill();
  }
  ctx.setLineDash([]);
  if (style.showLabel) {
    ctx.font = `bold ${Math.round(9 * pr)}px Arial`; ctx.fillStyle = style.color; ctx.textAlign = 'center';
    for (let i = 0; i < pts.length && i < labels.length; i++) {
      ctx.fillText(labels[i], pts[i].x, pts[i].y + ((i % 2 === 0) ? -8 * pr : 12 * pr));
    }
  }
}
