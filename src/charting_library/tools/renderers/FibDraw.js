// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Sub-Renderer: Fibonacci Tools
// ═══════════════════════════════════════════════════════════════════

import { FIB_LEVELS, FIB_COLORS } from '../tools/DrawingModel.js';

export function renderFibRetracement(ctx, pts, pricePoints, style, lw, pr, size, deps) {
  if (pts.length < 2 || pricePoints.length < 2) return;

  const { anchorToPixel } = deps;
  const startPrice = pricePoints[0].price;
  const endPrice = pricePoints[1].price;
  const priceRange = endPrice - startPrice;
  const left = Math.min(pts[0].x, pts[1].x);
  const right = size.bitmapWidth;

  // Per-drawing custom levels or global defaults
  const customLevels = style.fibLevels;
  const levelEntries = customLevels && customLevels.length > 0
    ? customLevels.filter(l => l.enabled !== false && l.visible !== false)
    : FIB_LEVELS.map(v => ({ value: v, color: FIB_COLORS[v] || style.color, enabled: true }));

  const fontSize = Math.round(11 * pr);
  ctx.font = `${fontSize}px Arial`;
  ctx.textBaseline = 'middle';

  for (let i = 0; i < levelEntries.length; i++) {
    const entry = levelEntries[i];
    const level = entry.value;
    const price = startPrice + priceRange * (1 - level);
    if (!isFinite(price)) continue;
    const anchorForY = anchorToPixel({ price, time: pricePoints[0].time });
    if (!anchorForY) continue;
    const y = Math.round(anchorForY.y * pr);

    const levelColor = entry.color || FIB_COLORS[level] || style.color;

    ctx.strokeStyle = levelColor;
    ctx.lineWidth = lw;
    ctx.globalAlpha = level === 0 || level === 1 ? 0.8 : 0.5;
    ctx.setLineDash(level === 0.5 ? [Math.round(4 * pr), Math.round(4 * pr)] : []);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.setLineDash([]);

    if (i < levelEntries.length - 1 && style.opacity) {
      const nextEntry = levelEntries[i + 1];
      const nextPrice = startPrice + priceRange * (1 - nextEntry.value);
      if (!isFinite(nextPrice)) continue;
      const nextAnchor = anchorToPixel({ price: nextPrice, time: pricePoints[0].time });
      if (nextAnchor) {
        const nextY = Math.round(nextAnchor.y * pr);
        ctx.fillStyle = levelColor;
        ctx.globalAlpha = style.opacity;
        ctx.fillRect(left, Math.min(y, nextY), right - left, Math.abs(nextY - y));
      }
    }

    if (style.showLabel) {
      ctx.globalAlpha = 0.9;
      const labelText = `${(level * 100).toFixed(1)}% (${price.toFixed(2)})`;
      ctx.fillStyle = levelColor;
      ctx.textAlign = 'left';
      ctx.fillText(labelText, left + Math.round(8 * pr), y);
    }

    ctx.globalAlpha = 1;
  }
}

export function renderFibExtension(ctx, pts, pricePoints, style, lw, pr, size, deps) {
  if (pts.length < 2) return;

  // Progressive preview: with only 2 points, show the trend leg baseline
  if (pts.length < 3 || pricePoints.length < 3) {
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash([Math.round(4 * pr), Math.round(4 * pr)]);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }

  const { anchorToPixel } = deps;
  const trendRange = pricePoints[1].price - pricePoints[0].price;
  const originPrice = pricePoints[2].price;
  const left = Math.min(...pts.map((p) => p.x));
  const right = size.bitmapWidth;

  // Per-drawing custom levels or global defaults
  const customLevels = style.fibLevels;
  const levelEntries = customLevels && customLevels.length > 0
    ? customLevels.filter(l => l.enabled !== false && l.visible !== false)
    : FIB_LEVELS.map(v => ({ value: v, color: FIB_COLORS[v] || style.color, enabled: true }));

  const fontSize = Math.round(11 * pr);
  ctx.font = `${fontSize}px Arial`;
  ctx.textBaseline = 'middle';

  // Baseline connecting the 3 points
  ctx.strokeStyle = style.color;
  ctx.lineWidth = Math.max(1, Math.round(1 * pr));
  ctx.setLineDash([Math.round(4 * pr), Math.round(4 * pr)]);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[2].x, pts[2].y);
  ctx.stroke();
  ctx.setLineDash([]);

  for (let i = 0; i < levelEntries.length; i++) {
    const entry = levelEntries[i];
    const level = entry.value;
    const price = originPrice + trendRange * level;
    if (!isFinite(price)) continue;
    const anchorForY = anchorToPixel({ price, time: pricePoints[2].time });
    if (!anchorForY) continue;
    const y = Math.round(anchorForY.y * pr);

    const levelColor = entry.color || FIB_COLORS[level] || style.color;

    ctx.strokeStyle = levelColor;
    ctx.lineWidth = lw;
    ctx.globalAlpha = level === 1 ? 0.8 : 0.5;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();

    if (style.showLabel) {
      ctx.globalAlpha = 0.9;
      const labelText = `${(level * 100).toFixed(1)}% (${price.toFixed(2)})`;
      ctx.fillStyle = levelColor;
      ctx.textAlign = 'left';
      ctx.fillText(labelText, left + Math.round(8 * pr), y);
    }
    ctx.globalAlpha = 1;
  }
}

export function renderFibTimeZone(ctx, pts, drawing, style, lw, pr, size) {
  if (pts.length < 2) return;

  const x1 = pts[0].x;
  const x2 = pts[1].x;
  const unitDist = x2 - x1;
  if (unitDist === 0) return;

  const fibs = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];

  ctx.strokeStyle = style.color;
  ctx.lineWidth = lw;
  ctx.setLineDash(style.dash ? style.dash.map((d) => Math.round(d * pr)) : []);

  const fontSize = Math.round(11 * pr);
  ctx.font = `${fontSize}px Arial`;
  ctx.textAlign = 'center';

  for (let i = 0; i < fibs.length; i++) {
    const fibX = x1 + unitDist * fibs[i];

    if (unitDist > 0 && fibX > size.bitmapWidth * 2) break;
    if (unitDist < 0 && fibX < -size.bitmapWidth) break;

    ctx.beginPath();
    ctx.moveTo(fibX, 0);
    ctx.lineTo(fibX, size.bitmapHeight);
    ctx.stroke();

    if (style.showLabel) {
      ctx.fillStyle = style.color;
      ctx.fillText(fibs[i], fibX, size.bitmapHeight - 20 * pr);
    }

    if (i < fibs.length - 1 && style.opacity) {
      const nextX = x1 + unitDist * fibs[i + 1];
      const w = Math.abs(nextX - fibX);
      const lX = Math.min(fibX, nextX);
      ctx.fillStyle = i % 2 === 0 ? style.color : 'transparent';
      ctx.globalAlpha = style.opacity * 0.5;
      ctx.fillRect(lX, 0, w, size.bitmapHeight);
      ctx.globalAlpha = 1;
    }
  }

  ctx.setLineDash([]);
}

export function renderFibArc(ctx, pts, pricePoints, style, lw, pr, _size) {
  if (pts.length < 2) return;

  const cx = pts[0].x, cy = pts[0].y;
  const dx = pts[1].x - cx, dy = pts[1].y - cy;
  const baseRadius = Math.sqrt(dx * dx + dy * dy);
  if (baseRadius < 2) return;

  const levels = [0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const fontSize = Math.round(10 * pr);
  ctx.font = `${fontSize}px Arial`;
  ctx.textBaseline = 'middle';

  for (const level of levels) {
    const r = baseRadius * level;
    const levelColor = FIB_COLORS[level] || style.color;

    if (style.opacity) {
      ctx.fillStyle = levelColor;
      ctx.globalAlpha = style.opacity;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI, dy > 0);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = levelColor;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI, dy > 0);
    ctx.stroke();

    if (style.showLabel) {
      ctx.fillStyle = levelColor;
      ctx.textAlign = 'left';
      ctx.fillText(`${(level * 100).toFixed(1)}%`, cx + r + 4 * pr, cy);
    }
  }
}

export function renderFibFan(ctx, pts, pricePoints, style, lw, pr, size) {
  if (pts.length < 2) return;

  const levels = [0.236, 0.382, 0.5, 0.618, 0.786];
  const dx = pts[1].x - pts[0].x;
  const dy = pts[1].y - pts[0].y;
  if (Math.abs(dx) < 1) return;

  const maxExtend = Math.max(size.bitmapWidth, size.bitmapHeight) * 2;
  const len = Math.sqrt(dx * dx + dy * dy);
  const scaleFactor = maxExtend / len;

  const fontSize = Math.round(10 * pr);
  ctx.font = `${fontSize}px Arial`;

  ctx.strokeStyle = style.color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(pts[0].x + dx * scaleFactor, pts[0].y + dy * scaleFactor);
  ctx.stroke();

  for (const level of levels) {
    const fanDy = dy * level;
    const fanLen = Math.sqrt(dx * dx + fanDy * fanDy);
    const fanScale = maxExtend / fanLen;
    const endX = pts[0].x + dx * fanScale;
    const endY = pts[0].y + fanDy * fanScale;

    const levelColor = FIB_COLORS[level] || style.color;

    ctx.strokeStyle = levelColor;
    ctx.lineWidth = lw;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (style.showLabel) {
      const labelX = pts[0].x + dx * 0.4;
      const labelY = pts[0].y + fanDy * 0.4;
      if (labelX > 0 && labelX < size.bitmapWidth && labelY > 0 && labelY < size.bitmapHeight) {
        ctx.fillStyle = levelColor;
        ctx.textAlign = 'left';
        ctx.fillText(`${(level * 100).toFixed(1)}%`, labelX, labelY);
      }
    }
  }
}

export function renderFibChannel(ctx, pts, pricePoints, style, lw, pr, _size) {
  if (pts.length < 2) return;

  // Progressive preview: with only 2 points, show the baseline
  if (pts.length < 3) {
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash([Math.round(4 * pr), Math.round(4 * pr)]);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }

  const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const _dx = pts[1].x - pts[0].x;
  const _dy = pts[1].y - pts[0].y;

  const offsetX = pts[2].x - pts[0].x;
  const offsetY = pts[2].y - pts[0].y;

  const fontSize = Math.round(10 * pr);
  ctx.font = `${fontSize}px Arial`;

  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    const ox = offsetX * level;
    const oy = offsetY * level;

    const levelColor = FIB_COLORS[level] || style.color;

    ctx.strokeStyle = levelColor;
    ctx.lineWidth = lw;
    ctx.globalAlpha = level === 0 || level === 1 ? 0.8 : 0.5;
    ctx.beginPath();
    ctx.moveTo(pts[0].x + ox, pts[0].y + oy);
    ctx.lineTo(pts[1].x + ox, pts[1].y + oy);
    ctx.stroke();

    if (i < levels.length - 1 && style.fillColor) {
      const nextLevel = levels[i + 1];
      const nox = offsetX * nextLevel;
      const noy = offsetY * nextLevel;
      ctx.fillStyle = style.fillColor;
      ctx.globalAlpha = 0.04;
      ctx.beginPath();
      ctx.moveTo(pts[0].x + ox, pts[0].y + oy);
      ctx.lineTo(pts[1].x + ox, pts[1].y + oy);
      ctx.lineTo(pts[1].x + nox, pts[1].y + noy);
      ctx.lineTo(pts[0].x + nox, pts[0].y + noy);
      ctx.closePath();
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    if (style.showLabel) {
      ctx.fillStyle = levelColor;
      ctx.textAlign = 'left';
      ctx.fillText(`${(level * 100).toFixed(1)}%`, pts[1].x + ox + 4 * pr, pts[1].y + oy);
    }
  }
}

export function renderElliottWaves(ctx, pts, drawing, style, lw, pr) {
  if (pts.length < 1) return;

  const labels = ['(1)', '(2)', '(3)', '(4)', '(5)'];

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

  const fontSize = Math.round(parseInt(style.font || '14') * pr);
  ctx.font = `${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 1; i < pts.length; i++) {
    const text = labels[i - 1] || `(${i})`;
    const isUpWave = pts[i].y < pts[i - 1].y;
    const yOffset = isUpWave ? -Math.round(15 * pr) : Math.round(15 * pr);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(text, pts[i].x, pts[i].y + yOffset);

    ctx.strokeStyle = style.color;
    ctx.lineWidth = 1;
    ctx.strokeText(text, pts[i].x, pts[i].y + yOffset);
    ctx.fillStyle = style.color;
    ctx.fillText(text, pts[i].x, pts[i].y + yOffset);
  }
}
