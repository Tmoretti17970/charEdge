// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Sub-Renderer: Trade Tools
// (measure, long/short position, alert zone, info line, price/date range, flat zone)
// ═══════════════════════════════════════════════════════════════════

export function renderMeasure(ctx, pts, drawing, style, lw, pr, _size) {
  if (pts.length < 2) return;
  const x1 = Math.min(pts[0].x, pts[1].x), x2 = Math.max(pts[0].x, pts[1].x);
  const y1 = Math.min(pts[0].y, pts[1].y), y2 = Math.max(pts[0].y, pts[1].y);
  const w = x2 - x1, h = y2 - y1;
  ctx.strokeStyle = style.color; ctx.lineWidth = lw;
  ctx.setLineDash([Math.round(4 * pr), Math.round(3 * pr)]); ctx.strokeRect(x1, y1, w, h); ctx.setLineDash([]);
  if (style.fillColor) { ctx.fillStyle = style.fillColor; ctx.fillRect(x1, y1, w, h); }
  ctx.strokeStyle = style.color; ctx.lineWidth = lw;
  ctx.setLineDash([Math.round(3 * pr), Math.round(3 * pr)]); ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.stroke();
  ctx.globalAlpha = 1; ctx.setLineDash([]);
  if (drawing.points.length >= 2) {
    const p0 = drawing.points[0], p1 = drawing.points[1];
    const priceDiff = p1.price - p0.price;
    const pricePct = p0.price !== 0 ? (priceDiff / p0.price) * 100 : 0;
    const timeDiffMs = Math.abs(p1.time - p0.time);
    let timeStr;
    if (timeDiffMs < 60000) timeStr = `${Math.round(timeDiffMs / 1000)}s`;
    else if (timeDiffMs < 3600000) timeStr = `${Math.round(timeDiffMs / 60000)}m`;
    else if (timeDiffMs < 86400000) timeStr = `${(timeDiffMs / 3600000).toFixed(1)}h`;
    else timeStr = `${(timeDiffMs / 86400000).toFixed(1)}d`;
    const bars = drawing.meta?.barCount || '—';
    const lines = [`${priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(2)} (${priceDiff >= 0 ? '+' : ''}${pricePct.toFixed(2)}%)`, `${bars} bars · ${timeStr}`];
    const riskPerTrade = drawing.meta?.riskPerTrade;
    if (riskPerTrade && riskPerTrade > 0) { const rM = Math.abs(priceDiff) / riskPerTrade; lines.push(`${priceDiff >= 0 ? '' : '-'}${rM.toFixed(2)}R`); }
    const fontSize = Math.round(11 * pr), lineHeight = Math.round(15 * pr), padding = Math.round(6 * pr);
    ctx.font = `bold ${fontSize}px Arial`;
    const maxTW = Math.max(...lines.map(l => ctx.measureText(l).width));
    const boxW = maxTW + padding * 2, boxH = lineHeight * lines.length + padding * 2;
    const cx = (x1 + x2) / 2 - boxW / 2, cy = (y1 + y2) / 2 - boxH / 2;
    ctx.fillStyle = '#1E222DEB'; const radius = Math.round(4 * pr);
    ctx.beginPath(); ctx.moveTo(cx + radius, cy); ctx.lineTo(cx + boxW - radius, cy);
    ctx.quadraticCurveTo(cx + boxW, cy, cx + boxW, cy + radius); ctx.lineTo(cx + boxW, cy + boxH - radius);
    ctx.quadraticCurveTo(cx + boxW, cy + boxH, cx + boxW - radius, cy + boxH); ctx.lineTo(cx + radius, cy + boxH);
    ctx.quadraticCurveTo(cx, cy + boxH, cx, cy + boxH - radius); ctx.lineTo(cx, cy + radius);
    ctx.quadraticCurveTo(cx, cy, cx + radius, cy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = style.color; ctx.lineWidth = Math.round(1 * pr); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const textX = cx + boxW / 2; let textY = cy + padding;
    ctx.fillStyle = priceDiff >= 0 ? '#26A69A' : '#EF5350'; ctx.fillText(lines[0], textX, textY); textY += lineHeight;
    ctx.fillStyle = '#D1D4DC'; ctx.font = `${fontSize}px Arial`; ctx.fillText(lines[1], textX, textY);
  }
}

export function renderLongPosition(ctx, pts, drawing, style, lw, pr, _size) {
  if (pts.length < 2) return;
  const entryY = pts[0].y, targetY = pts[1].y, stopY = entryY + (entryY - targetY);
  const x = pts[0].x;
  const w = drawing.state === 'creating' ? Math.max(100 * pr, Math.abs(pts[1].x - x)) : Math.max(40 * pr, Math.abs(pts[1].x - x));
  ctx.fillStyle = style.fillColor || 'rgba(8, 153, 129, 0.2)'; ctx.fillRect(x, Math.min(entryY, targetY), w, Math.abs(entryY - targetY));
  ctx.fillStyle = 'rgba(242, 54, 69, 0.2)'; ctx.fillRect(x, Math.min(entryY, stopY), w, Math.abs(entryY - stopY));
  ctx.strokeStyle = style.color; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x, entryY); ctx.lineTo(x + w, entryY); ctx.stroke();
  if (drawing.points.length >= 2) {
    const entryP = drawing.points[0].price, targetP = drawing.points[1].price, stopP = entryP - (targetP - entryP);
    const rr = Math.abs(targetP - entryP) / Math.abs(entryP - stopP);
    const fontSize = Math.round(11 * pr); ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = style.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const textX = x + w / 2;
    ctx.fillText(`Target: ${targetP.toFixed(2)}`, textX, (entryY + targetY) / 2);
    ctx.fillText(`Stop: ${stopP.toFixed(2)}`, textX, (entryY + stopY) / 2);
    ctx.fillText(`Risk/Reward: ${rr.toFixed(2)}`, textX, entryY);
  }
}

export function renderShortPosition(ctx, pts, drawing, style, lw, pr, _size) {
  if (pts.length < 2) return;
  const entryY = pts[0].y, targetY = pts[1].y, stopY = entryY - (targetY - entryY);
  const x = pts[0].x;
  const w = drawing.state === 'creating' ? Math.max(100 * pr, Math.abs(pts[1].x - x)) : Math.max(40 * pr, Math.abs(pts[1].x - x));
  ctx.fillStyle = style.fillColor || 'rgba(242, 54, 69, 0.2)'; ctx.fillRect(x, Math.min(entryY, targetY), w, Math.abs(entryY - targetY));
  ctx.fillStyle = 'rgba(8, 153, 129, 0.2)'; ctx.fillRect(x, Math.min(entryY, stopY), w, Math.abs(entryY - stopY));
  ctx.strokeStyle = style.color; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x, entryY); ctx.lineTo(x + w, entryY); ctx.stroke();
  if (drawing.points.length >= 2) {
    const entryP = drawing.points[0].price, targetP = drawing.points[1].price, stopP = entryP + (entryP - targetP);
    const rr = Math.abs(entryP - targetP) / Math.abs(stopP - entryP);
    const fontSize = Math.round(11 * pr); ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = style.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const textX = x + w / 2;
    ctx.fillText(`Target: ${targetP.toFixed(2)}`, textX, (entryY + targetY) / 2);
    ctx.fillText(`Stop: ${stopP.toFixed(2)}`, textX, (entryY + stopY) / 2);
    ctx.fillText(`Risk/Reward: ${rr.toFixed(2)}`, textX, entryY);
  }
}

export function renderAlertZone(ctx, pts, drawing, style, lw, pr, size) {
  if (pts.length < 2) return;
  const y1 = Math.min(pts[0].y, pts[1].y), y2 = Math.max(pts[0].y, pts[1].y);
  ctx.fillStyle = style.fillColor || 'rgba(245, 158, 11, 0.12)'; ctx.fillRect(0, y1, size.bitmapWidth, y2 - y1);
  ctx.strokeStyle = style.color; ctx.lineWidth = lw;
  ctx.setLineDash(style.dash ? style.dash.map(d => Math.round(d * pr)) : []);
  ctx.beginPath(); ctx.moveTo(0, y1); ctx.lineTo(size.bitmapWidth, y1); ctx.moveTo(0, y2); ctx.lineTo(size.bitmapWidth, y2); ctx.stroke();
  ctx.setLineDash([]);
  const label = drawing.meta?.text || 'Alert Zone';
  const fontSize = Math.round(11 * pr); ctx.font = `bold ${fontSize}px Arial`;
  ctx.fillStyle = style.color; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(label, Math.round(8 * pr), y1 + Math.round(4 * pr));
  if (drawing.points.length >= 2) {
    const topPrice = Math.max(drawing.points[0].price, drawing.points[1].price);
    const botPrice = Math.min(drawing.points[0].price, drawing.points[1].price);
    ctx.font = `${Math.round(10 * pr)}px Arial`; ctx.textAlign = 'right';
    ctx.fillText(topPrice.toFixed(2), size.bitmapWidth - Math.round(8 * pr), y1 + Math.round(4 * pr));
    ctx.textBaseline = 'bottom';
    ctx.fillText(botPrice.toFixed(2), size.bitmapWidth - Math.round(8 * pr), y2 - Math.round(4 * pr));
  }
}

export function renderInfoLine(ctx, pts, drawing, style, lw, pr, _size) {
  if (pts.length < 2) return;
  const [p0, p1] = pts;
  ctx.strokeStyle = style.color; ctx.lineWidth = lw;
  ctx.setLineDash(style.dash ? style.dash.map(d => Math.round(d * pr)) : []);
  ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); ctx.setLineDash([]);
  const pricePoints = drawing.points;
  if (!pricePoints || pricePoints.length < 2) return;
  const priceDiff = pricePoints[1].price - pricePoints[0].price;
  const pricePct = pricePoints[0].price !== 0 ? (priceDiff / pricePoints[0].price) * 100 : 0;
  const timeDiff = Math.abs(pricePoints[1].time - pricePoints[0].time);
  const bars = Math.round(timeDiff / 60000);
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const angle = Math.atan2(-dy, dx) * (180 / Math.PI);
  const isUp = priceDiff >= 0, sign = isUp ? '+' : '', arrow = isUp ? '▲' : '▼';
  const infoText = `${arrow} ${sign}${priceDiff >= 1000 ? priceDiff.toFixed(0) : priceDiff.toFixed(2)} (${sign}${pricePct.toFixed(2)}%) · ${bars} bars · ${angle.toFixed(1)}°`;
  const fontSize = Math.round(10 * pr), padding = Math.round(5 * pr);
  ctx.font = `bold ${fontSize}px -apple-system, Arial`;
  const tw = ctx.measureText(infoText).width;
  const mx = (p0.x + p1.x) / 2, my = Math.min(p0.y, p1.y) - Math.round(20 * pr);
  const pillW = tw + padding * 2, pillH = fontSize + padding * 2, pillR = Math.round(4 * pr);
  ctx.fillStyle = 'rgba(24,26,32,0.92)';
  ctx.beginPath(); ctx.moveTo(mx - pillW / 2 + pillR, my); ctx.lineTo(mx + pillW / 2 - pillR, my);
  ctx.quadraticCurveTo(mx + pillW / 2, my, mx + pillW / 2, my + pillR);
  ctx.lineTo(mx + pillW / 2, my + pillH - pillR);
  ctx.quadraticCurveTo(mx + pillW / 2, my + pillH, mx + pillW / 2 - pillR, my + pillH);
  ctx.lineTo(mx - pillW / 2 + pillR, my + pillH);
  ctx.quadraticCurveTo(mx - pillW / 2, my + pillH, mx - pillW / 2, my + pillH - pillR);
  ctx.lineTo(mx - pillW / 2, my + pillR);
  ctx.quadraticCurveTo(mx - pillW / 2, my, mx - pillW / 2 + pillR, my);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = isUp ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)';
  ctx.lineWidth = Math.round(1 * pr); ctx.stroke();
  ctx.fillStyle = isUp ? '#26A69A' : '#EF5350'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(infoText, mx, my + padding);
}

export function renderFlatZone(ctx, pts, drawing, style, lw, pr, size, direction) {
  if (pts.length < 2) return;
  const x1 = Math.min(pts[0].x, pts[1].x), x2 = Math.max(pts[0].x, pts[1].x), y = pts[0].y;
  const thickness = Math.round(8 * pr);
  ctx.strokeStyle = style.color; ctx.lineWidth = lw; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
  if (style.fillColor) { ctx.fillStyle = style.fillColor; ctx.fillRect(x1, y + (direction === 'top' ? -thickness : 0), x2 - x1, thickness); }
  ctx.lineWidth = Math.max(1, Math.round(2 * pr)); const capH = Math.round(6 * pr);
  ctx.beginPath(); ctx.moveTo(x1, y - capH); ctx.lineTo(x1, y + capH); ctx.moveTo(x2, y - capH); ctx.lineTo(x2, y + capH); ctx.stroke();
  if (style.showLabel) {
    const label = direction === 'top' ? 'Resistance' : 'Support';
    ctx.font = `${Math.round(9 * pr)}px Arial`; ctx.fillStyle = style.color; ctx.textAlign = 'center';
    ctx.textBaseline = direction === 'top' ? 'bottom' : 'top';
    ctx.fillText(label, (x1 + x2) / 2, y + (direction === 'top' ? -4 * pr : 4 * pr));
  }
}

export function renderPriceRange(ctx, pts, drawing, style, lw, pr, _size) {
  if (pts.length < 2) return;
  const y1 = Math.min(pts[0].y, pts[1].y), y2 = Math.max(pts[0].y, pts[1].y);
  const left = Math.min(pts[0].x, pts[1].x), right = Math.max(pts[0].x, pts[1].x);
  if (style.fillColor) { ctx.fillStyle = style.fillColor; ctx.fillRect(left, y1, right - left, y2 - y1); }
  ctx.strokeStyle = style.color; ctx.lineWidth = lw;
  ctx.setLineDash(style.dash ? style.dash.map(d => Math.round(d * pr)) : []);
  ctx.beginPath(); ctx.moveTo(left, y1); ctx.lineTo(right, y1); ctx.moveTo(left, y2); ctx.lineTo(right, y2); ctx.stroke(); ctx.setLineDash([]);
  if (style.showLabel && drawing.points && drawing.points.length >= 2) {
    const priceDiff = drawing.points[1].price - drawing.points[0].price;
    const pricePct = drawing.points[0].price !== 0 ? (priceDiff / drawing.points[0].price) * 100 : 0;
    const isUp = priceDiff >= 0, sign = isUp ? '+' : '';
    const labelText = `${sign}${priceDiff >= 1000 ? priceDiff.toFixed(0) : priceDiff.toFixed(2)} (${sign}${pricePct.toFixed(2)}%)`;
    ctx.font = `bold ${Math.round(10 * pr)}px -apple-system, Arial`;
    ctx.fillStyle = isUp ? '#26A69A' : '#EF5350'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(labelText, (left + right) / 2, (y1 + y2) / 2);
  }
}

export function renderDateRange(ctx, pts, drawing, style, lw, pr, size) {
  if (pts.length < 2) return;
  const x1 = Math.min(pts[0].x, pts[1].x), x2 = Math.max(pts[0].x, pts[1].x);
  if (style.fillColor) { ctx.fillStyle = style.fillColor; ctx.fillRect(x1, 0, x2 - x1, size.bitmapHeight); }
  ctx.strokeStyle = style.color; ctx.lineWidth = lw;
  ctx.setLineDash(style.dash ? style.dash.map(d => Math.round(d * pr)) : []);
  ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, size.bitmapHeight); ctx.moveTo(x2, 0); ctx.lineTo(x2, size.bitmapHeight); ctx.stroke(); ctx.setLineDash([]);
  if (style.showLabel && drawing.points && drawing.points.length >= 2) {
    const timeDiff = Math.abs(drawing.points[1].time - drawing.points[0].time);
    const hours = Math.floor(timeDiff / 3600000), mins = Math.floor((timeDiff % 3600000) / 60000);
    const barCount = Math.round(timeDiff / 60000);
    const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    ctx.font = `bold ${Math.round(10 * pr)}px -apple-system, Arial`; ctx.fillStyle = style.color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(`${barCount} bars · ${timeStr}`, (x1 + x2) / 2, Math.round(12 * pr));
  }
}
