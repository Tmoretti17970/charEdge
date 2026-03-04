// ═══════════════════════════════════════════════════════════════════
// charEdge — DrawingEngine: Hit Testing Sub-Module
// Pure functions for geometry-based hit testing of drawing types.
// ═══════════════════════════════════════════════════════════════════

/** Hit-test distance threshold in CSS pixels */
const HIT_THRESHOLD = 8;

/**
 * Distance from point (px,py) to line segment (a→b).
 */
export function distToSegment(px, py, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - a.x) ** 2 + (py - a.y) ** 2);
  let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

/**
 * Hit-test a specific drawing's body (lines, rects, etc).
 * @param {object} drawing
 * @param {number} x  CSS pixel X
 * @param {number} y  CSS pixel Y
 * @param {Array<{x:number,y:number}>} points  pixel-space points (pre-converted)
 * @returns {boolean}
 */
export function hitTestDrawingBody(drawing, x, y, points) {
  if (points.length === 0) return false;

  switch (drawing.type) {
    case 'trendline':
    case 'arrow':
    case 'ray':
    case 'extendedline':
      return points.length >= 2 && distToSegment(x, y, points[0], points[1]) < HIT_THRESHOLD;

    case 'hray':
    case 'hline':
      return points.length >= 1 && Math.abs(y - points[0].y) < HIT_THRESHOLD;

    case 'vline':
      return points.length >= 1 && Math.abs(x - points[0].x) < HIT_THRESHOLD;

    case 'crossline':
      return points.length >= 1 && (Math.abs(y - points[0].y) < HIT_THRESHOLD || Math.abs(x - points[0].x) < HIT_THRESHOLD);

    case 'fib': {
      if (points.length < 2) return false;
      const minY = Math.min(points[0].y, points[1].y);
      const maxY = Math.max(points[0].y, points[1].y);
      return y >= minY - HIT_THRESHOLD && y <= maxY + HIT_THRESHOLD;
    }

    case 'rect':
    case 'measure': {
      if (points.length < 2) return false;
      const left = Math.min(points[0].x, points[1].x);
      const right = Math.max(points[0].x, points[1].x);
      const top = Math.min(points[0].y, points[1].y);
      const bottom = Math.max(points[0].y, points[1].y);
      return x >= left - HIT_THRESHOLD && x <= right + HIT_THRESHOLD && y >= top - HIT_THRESHOLD && y <= bottom + HIT_THRESHOLD;
    }

    case 'channel':
      return points.length >= 2 && distToSegment(x, y, points[0], points[1]) < HIT_THRESHOLD * 3;

    case 'triangle': {
      if (points.length < 3) return false;
      return distToSegment(x, y, points[0], points[1]) < HIT_THRESHOLD ||
             distToSegment(x, y, points[1], points[2]) < HIT_THRESHOLD ||
             distToSegment(x, y, points[2], points[0]) < HIT_THRESHOLD;
    }

    case 'ellipse': {
      if (points.length < 2) return false;
      const minX = Math.min(points[0].x, points[1].x), maxX = Math.max(points[0].x, points[1].x);
      const minY = Math.min(points[0].y, points[1].y), maxY = Math.max(points[0].y, points[1].y);
      const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
      const radiusX = (maxX - minX) / 2, radiusY = (maxY - minY) / 2;
      if (radiusX === 0 || radiusY === 0) return false;
      const dx = x - centerX, dy = y - centerY;
      if (x >= minX - HIT_THRESHOLD && x <= maxX + HIT_THRESHOLD && y >= minY - HIT_THRESHOLD && y <= maxY + HIT_THRESHOLD) {
        const distToCenter = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const expectedDist = Math.sqrt(1 / (Math.pow(Math.cos(angle) / radiusX, 2) + Math.pow(Math.sin(angle) / radiusY, 2)));
        if (Math.abs(distToCenter - expectedDist) < HIT_THRESHOLD) return true;
        const style = drawing.style || {};
        if (style.fillColor && distToCenter <= expectedDist) return true;
      }
      return false;
    }

    case 'text':
    case 'callout': {
      if (points.length < 1) return false;
      const style = drawing.style || {};
      const text = drawing.meta?.text || (drawing.type === 'callout' ? 'Price Note' : 'Text');
      const fontSize = parseInt(style.font || '14');
      const padding = drawing.type === 'callout' ? 6 : 0;
      const pointerSize = drawing.type === 'callout' ? 8 : 0;
      const w = text.length * fontSize * 0.6 + padding * 2;
      const h = fontSize * 1.2 + padding * 2;
      let boxX, boxY;
      if (drawing.type === 'callout') { boxX = points[0].x + pointerSize; boxY = points[0].y - h - pointerSize; }
      else { boxX = points[0].x; boxY = points[0].y; }
      return x >= boxX - HIT_THRESHOLD && x <= boxX + w + HIT_THRESHOLD && y >= boxY - HIT_THRESHOLD && y <= boxY + h + HIT_THRESHOLD;
    }

    case 'pitchfork': {
      if (points.length < 3) return false;
      if (distToSegment(x, y, points[1], points[2]) < HIT_THRESHOLD) return true;
      const midX = (points[1].x + points[2].x) / 2, midY = (points[1].y + points[2].y) / 2;
      const dx = midX - points[0].x, dy = midY - points[0].y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        const scale = 10000 / len;
        const endX = points[0].x + dx * scale, endY = points[0].y + dy * scale;
        if (distToSegment(x, y, points[0], { x: endX, y: endY }) < HIT_THRESHOLD) return true;
        if (distToSegment(x, y, points[1], { x: points[1].x + dx * scale, y: points[1].y + dy * scale }) < HIT_THRESHOLD) return true;
        if (distToSegment(x, y, points[2], { x: points[2].x + dx * scale, y: points[2].y + dy * scale }) < HIT_THRESHOLD) return true;
      }
      return false;
    }

    case 'longposition':
    case 'shortposition': {
      if (points.length < 2) return false;
      const entryHeight = points[0].y, targetHeight = points[1].y;
      const stopHeight = entryHeight + (entryHeight - targetHeight);
      const top = Math.min(targetHeight, stopHeight), bottom = Math.max(targetHeight, stopHeight);
      const left = points[0].x, right = left + Math.max(100, Math.abs(points[1].x - left));
      return x >= left - HIT_THRESHOLD && x <= right + HIT_THRESHOLD && y >= top - HIT_THRESHOLD && y <= bottom + HIT_THRESHOLD;
    }

    case 'gannfan': {
      if (points.length < 2) return false;
      const origin = points[0], target = points[1];
      const dx = target.x - origin.x, dy = target.y - origin.y;
      if (distToSegment(x, y, origin, { x: origin.x + dx * 10, y: origin.y + dy * 10 }) < HIT_THRESHOLD) return true;
      return distToSegment(x, y, origin, target) < HIT_THRESHOLD * 5;
    }

    case 'fibtimezone': {
      if (points.length < 2) return false;
      const dx = points[1].x - points[0].x;
      if (Math.abs(dx) < 1) return false;
      const fibs = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55];
      for (const f of fibs) {
        if (Math.abs(x - (points[0].x + dx * f)) < HIT_THRESHOLD) return true;
      }
      return false;
    }

    case 'alertzone': {
      if (points.length < 2) return false;
      const top = Math.min(points[0].y, points[1].y), bottom = Math.max(points[0].y, points[1].y);
      return y >= top - HIT_THRESHOLD && y <= bottom + HIT_THRESHOLD;
    }

    case 'fibext': {
      if (points.length < 2) return false;
      const allY = points.map(p => p.y);
      return y >= Math.min(...allY) - HIT_THRESHOLD && y <= Math.max(...allY) + HIT_THRESHOLD;
    }

    case 'elliott':
    case 'polyline': {
      if (points.length < 2) return false;
      for (let i = 0; i < points.length - 1; i++) {
        if (distToSegment(x, y, points[i], points[i + 1]) < HIT_THRESHOLD) return true;
      }
      return false;
    }

    case 'infoline':
      return points.length >= 2 && distToSegment(x, y, points[0], points[1]) < HIT_THRESHOLD;

    case 'parallelchannel': {
      if (points.length < 2) return false;
      if (distToSegment(x, y, points[0], points[1]) < HIT_THRESHOLD) return true;
      if (points.length >= 3) {
        const dx = points[1].x - points[0].x, dy = points[1].y - points[0].y;
        if (distToSegment(x, y, points[2], { x: points[2].x + dx, y: points[2].y + dy }) < HIT_THRESHOLD) return true;
      }
      return false;
    }

    case 'pricerange': {
      if (points.length < 2) return false;
      const l = Math.min(points[0].x, points[1].x), r = Math.max(points[0].x, points[1].x);
      const t = Math.min(points[0].y, points[1].y), b = Math.max(points[0].y, points[1].y);
      return x >= l - HIT_THRESHOLD && x <= r + HIT_THRESHOLD && y >= t - HIT_THRESHOLD && y <= b + HIT_THRESHOLD;
    }

    case 'daterange': {
      if (points.length < 2) return false;
      const l = Math.min(points[0].x, points[1].x), r = Math.max(points[0].x, points[1].x);
      return x >= l - HIT_THRESHOLD && x <= r + HIT_THRESHOLD;
    }

    case 'note': {
      if (points.length < 1) return false;
      return x >= points[0].x - HIT_THRESHOLD && x <= points[0].x + 140 + HIT_THRESHOLD &&
             y >= points[0].y - HIT_THRESHOLD && y <= points[0].y + 60 + HIT_THRESHOLD;
    }

    case 'signpost': {
      if (points.length < 1) return false;
      return Math.sqrt((x - points[0].x) ** 2 + (y - points[0].y) ** 2) < 20;
    }

    default:
      return false;
  }
}
