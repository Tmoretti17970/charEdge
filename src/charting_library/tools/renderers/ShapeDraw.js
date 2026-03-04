// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Sub-Renderer: Shapes (rect, triangle, ellipse,
//   text, callout, emoji, note, signpost)
// ═══════════════════════════════════════════════════════════════════

export function renderRectangle(ctx, pts, style, lw, pr) {
  if (pts.length < 2) return;

  const x = Math.min(pts[0].x, pts[1].x);
  const y = Math.min(pts[0].y, pts[1].y);
  const w = Math.abs(pts[1].x - pts[0].x);
  const h = Math.abs(pts[1].y - pts[0].y);

  if (style.fillColor) {
    ctx.fillStyle = style.fillColor;
    ctx.fillRect(x, y, w, h);
  }

  ctx.strokeStyle = style.color;
  ctx.lineWidth = lw;
  ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
}

export function renderTriangle(ctx, pts, style, lw, pr) {
  if (pts.length < 3) return;

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[2].x, pts[2].y);
  ctx.closePath();

  if (style.fillColor) {
    ctx.fillStyle = style.fillColor;
    ctx.fill();
  }

  ctx.strokeStyle = style.color;
  ctx.lineWidth = lw;
  ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function renderEllipse(ctx, pts, style, lw, pr) {
  if (pts.length < 2) return;

  const minX = Math.min(pts[0].x, pts[1].x);
  const maxX = Math.max(pts[0].x, pts[1].x);
  const minY = Math.min(pts[0].y, pts[1].y);
  const maxY = Math.max(pts[0].y, pts[1].y);

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const radiusX = Math.max(1, (maxX - minX) / 2);
  const radiusY = Math.max(1, (maxY - minY) / 2);

  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);

  if (style.fillColor) {
    ctx.fillStyle = style.fillColor;
    ctx.fill();
  }

  ctx.strokeStyle = style.color;
  ctx.lineWidth = lw;
  ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function renderText(ctx, pts, drawing, style, pr) {
  if (pts.length < 1) return;
  const text = drawing.meta?.text || 'Text';
  const fontSize = Math.round(parseInt(style.font || '14') * pr);
  ctx.font = `${fontSize}px Arial`;
  ctx.fillStyle = style.color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(text, pts[0].x, pts[0].y);
}

export function renderCallout(ctx, pts, drawing, style, lw, pr) {
  if (pts.length < 1) return;
  const text = drawing.meta?.text || 'Price Note';
  const fontSize = Math.round(parseInt(style.font || '12') * pr);
  const padding = Math.round(6 * pr);
  const pointerSize = Math.round(8 * pr);

  ctx.font = `${fontSize}px Arial`;
  const tw = ctx.measureText(text).width;
  const th = fontSize;
  const boxW = tw + padding * 2;
  const boxH = th + padding * 2;

  const boxX = pts[0].x + pointerSize;
  const boxY = pts[0].y - boxH - pointerSize;

  ctx.fillStyle = style.fillColor || '#2962FF';
  ctx.beginPath();
  ctx.moveTo(boxX, boxY);
  ctx.lineTo(boxX + boxW, boxY);
  ctx.lineTo(boxX + boxW, boxY + boxH);
  ctx.lineTo(boxX + pointerSize * 2, boxY + boxH);
  ctx.lineTo(pts[0].x, pts[0].y);
  ctx.lineTo(boxX, boxY + boxH - pointerSize);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = style.color;
  ctx.lineWidth = lw;
  ctx.stroke();

  ctx.fillStyle = style.color || '#FFFFFF';
  if (style.fillColor && style.color === style.fillColor) {
    ctx.fillStyle = '#FFFFFF';
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(text, boxX + padding, boxY + padding);
}

export function renderEmoji(ctx, pts, drawing, style, pr) {
  if (pts.length < 1) return;
  const emoji = drawing.meta?.emoji || '📌';
  const fontSize = Math.round(parseInt(style.font) * pr) || Math.round(24 * pr);
  ctx.font = `${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, pts[0].x, pts[0].y);
}

export function renderNote(ctx, pts, drawing, style, pr) {
  if (pts.length < 1) return;
  const [p] = pts;
  const text = drawing.meta?.text || 'Note';
  const fontSize = Math.round(parseInt(style.font || '12') * pr);
  const padding = Math.round(6 * pr);
  const maxW = Math.round(140 * pr);

  ctx.font = `${fontSize}px -apple-system, Arial`;
  const lines = [];
  const words = text.split(' ');
  let currentLine = '';
  for (const word of words) {
    const test = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(test).width > maxW && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = test;
    }
  }
  if (currentLine) lines.push(currentLine);

  const lineH = fontSize + Math.round(2 * pr);
  const boxW = Math.min(maxW + padding * 2, Math.max(...lines.map(l => ctx.measureText(l).width)) + padding * 2);
  const boxH = lines.length * lineH + padding * 2;
  const r = Math.round(4 * pr);

  ctx.fillStyle = style.fillColor || 'rgba(245, 158, 11, 0.08)';
  ctx.strokeStyle = style.color;
  ctx.lineWidth = Math.max(1, Math.round(1 * pr));
  ctx.beginPath();
  ctx.moveTo(p.x + r, p.y); ctx.lineTo(p.x + boxW - r, p.y);
  ctx.quadraticCurveTo(p.x + boxW, p.y, p.x + boxW, p.y + r);
  ctx.lineTo(p.x + boxW, p.y + boxH - r);
  ctx.quadraticCurveTo(p.x + boxW, p.y + boxH, p.x + boxW - r, p.y + boxH);
  ctx.lineTo(p.x + r, p.y + boxH);
  ctx.quadraticCurveTo(p.x, p.y + boxH, p.x, p.y + boxH - r);
  ctx.lineTo(p.x, p.y + r);
  ctx.quadraticCurveTo(p.x, p.y, p.x + r, p.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const foldS = Math.round(10 * pr);
  ctx.fillStyle = style.color;
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.moveTo(p.x + boxW - foldS, p.y);
  ctx.lineTo(p.x + boxW, p.y + foldS);
  ctx.lineTo(p.x + boxW - foldS, p.y + foldS);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = style.color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], p.x + padding, p.y + padding + i * lineH);
  }
}

export function renderSignpost(ctx, pts, drawing, style, pr) {
  if (pts.length < 1) return;
  const [p] = pts;
  const text = drawing.meta?.text || 'Label';
  const fontSize = Math.round(parseInt(style.font || '11') * pr);
  const padding = Math.round(5 * pr);
  const arrowH = Math.round(14 * pr);

  ctx.font = `bold ${fontSize}px -apple-system, Arial`;
  const tw = ctx.measureText(text).width;
  const tagW = tw + padding * 2;
  const tagH = fontSize + padding * 2;
  const r = Math.round(3 * pr);

  ctx.strokeStyle = style.color;
  ctx.lineWidth = Math.max(1, Math.round(1.5 * pr));
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x, p.y - arrowH);
  ctx.stroke();

  const aSize = Math.round(4 * pr);
  ctx.fillStyle = style.color;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x - aSize, p.y - aSize * 1.5);
  ctx.lineTo(p.x + aSize, p.y - aSize * 1.5);
  ctx.closePath();
  ctx.fill();

  const tagY = p.y - arrowH - tagH;
  ctx.fillStyle = style.color;
  ctx.beginPath();
  ctx.moveTo(p.x - tagW / 2 + r, tagY);
  ctx.lineTo(p.x + tagW / 2 - r, tagY);
  ctx.quadraticCurveTo(p.x + tagW / 2, tagY, p.x + tagW / 2, tagY + r);
  ctx.lineTo(p.x + tagW / 2, tagY + tagH - r);
  ctx.quadraticCurveTo(p.x + tagW / 2, tagY + tagH, p.x + tagW / 2 - r, tagY + tagH);
  ctx.lineTo(p.x - tagW / 2 + r, tagY + tagH);
  ctx.quadraticCurveTo(p.x - tagW / 2, tagY + tagH, p.x - tagW / 2, tagY + tagH - r);
  ctx.lineTo(p.x - tagW / 2, tagY + r);
  ctx.quadraticCurveTo(p.x - tagW / 2, tagY, p.x - tagW / 2 + r, tagY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, p.x, tagY + tagH / 2);
}
