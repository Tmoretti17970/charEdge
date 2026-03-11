// ═══════════════════════════════════════════════════════════════════
// charEdge — DrawingEngine: Hit Testing Sub-Module
// Pure functions for geometry-based hit testing of drawing types.
// ═══════════════════════════════════════════════════════════════════

/** Click buffer distance threshold in CSS pixels (D2.1) */
export const CLICK_BUFFER = 5;

/**
 * Compute the axis-aligned bounding box for a drawing's pixel-space points.
 * Used by SpatialIndex to enable O(1) point queries instead of O(n) linear scans.
 *
 * @param {Array<{x:number,y:number}>} points  pixel-space points
 * @param {number} [buffer=CLICK_BUFFER]  padding around the bounding box
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
export function computeBoundingBox(points, buffer = CLICK_BUFFER) {
  if (!points || points.length === 0) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    x: minX - buffer,
    y: minY - buffer,
    w: maxX - minX + buffer * 2,
    h: maxY - minY + buffer * 2,
  };
}

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
      return points.length >= 2 && distToSegment(x, y, points[0], points[1]) < CLICK_BUFFER;

    case 'hray':
    case 'hline':
      return points.length >= 1 && Math.abs(y - points[0].y) < CLICK_BUFFER;

    case 'vline':
      return points.length >= 1 && Math.abs(x - points[0].x) < CLICK_BUFFER;

    case 'crossline':
      return points.length >= 1 && (Math.abs(y - points[0].y) < CLICK_BUFFER || Math.abs(x - points[0].x) < CLICK_BUFFER);

    case 'fib': {
      if (points.length < 2) return false;
      const minY = Math.min(points[0].y, points[1].y);
      const maxY = Math.max(points[0].y, points[1].y);
      return y >= minY - CLICK_BUFFER && y <= maxY + CLICK_BUFFER;
    }

    case 'rect':
    case 'measure': {
      if (points.length < 2) return false;
      const left = Math.min(points[0].x, points[1].x);
      const right = Math.max(points[0].x, points[1].x);
      const top = Math.min(points[0].y, points[1].y);
      const bottom = Math.max(points[0].y, points[1].y);
      return x >= left - CLICK_BUFFER && x <= right + CLICK_BUFFER && y >= top - CLICK_BUFFER && y <= bottom + CLICK_BUFFER;
    }

    case 'channel':
      return points.length >= 2 && distToSegment(x, y, points[0], points[1]) < CLICK_BUFFER * 3;

    case 'triangle': {
      if (points.length < 3) return false;
      return distToSegment(x, y, points[0], points[1]) < CLICK_BUFFER ||
             distToSegment(x, y, points[1], points[2]) < CLICK_BUFFER ||
             distToSegment(x, y, points[2], points[0]) < CLICK_BUFFER;
    }

    case 'ellipse': {
      if (points.length < 2) return false;
      const minX = Math.min(points[0].x, points[1].x), maxX = Math.max(points[0].x, points[1].x);
      const minY = Math.min(points[0].y, points[1].y), maxY = Math.max(points[0].y, points[1].y);
      const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
      const radiusX = (maxX - minX) / 2, radiusY = (maxY - minY) / 2;
      if (radiusX === 0 || radiusY === 0) return false;
      const dx = x - centerX, dy = y - centerY;
      if (x >= minX - CLICK_BUFFER && x <= maxX + CLICK_BUFFER && y >= minY - CLICK_BUFFER && y <= maxY + CLICK_BUFFER) {
        const distToCenter = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const expectedDist = Math.sqrt(1 / (Math.pow(Math.cos(angle) / radiusX, 2) + Math.pow(Math.sin(angle) / radiusY, 2)));
        if (Math.abs(distToCenter - expectedDist) < CLICK_BUFFER) return true;
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
      return x >= boxX - CLICK_BUFFER && x <= boxX + w + CLICK_BUFFER && y >= boxY - CLICK_BUFFER && y <= boxY + h + CLICK_BUFFER;
    }

    case 'pitchfork': {
      if (points.length < 3) return false;
      if (distToSegment(x, y, points[1], points[2]) < CLICK_BUFFER) return true;
      const midX = (points[1].x + points[2].x) / 2, midY = (points[1].y + points[2].y) / 2;
      const dx = midX - points[0].x, dy = midY - points[0].y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        const scale = Math.max(10000, len * 20) / len; // BUG-14: proportional extension
        const endX = points[0].x + dx * scale, endY = points[0].y + dy * scale;
        if (distToSegment(x, y, points[0], { x: endX, y: endY }) < CLICK_BUFFER) return true;
        if (distToSegment(x, y, points[1], { x: points[1].x + dx * scale, y: points[1].y + dy * scale }) < CLICK_BUFFER) return true;
        if (distToSegment(x, y, points[2], { x: points[2].x + dx * scale, y: points[2].y + dy * scale }) < CLICK_BUFFER) return true;
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
      return x >= left - CLICK_BUFFER && x <= right + CLICK_BUFFER && y >= top - CLICK_BUFFER && y <= bottom + CLICK_BUFFER;
    }

    case 'gannfan': {
      if (points.length < 2) return false;
      const origin = points[0], target = points[1];
      const dx = target.x - origin.x, dy = target.y - origin.y;
      if (distToSegment(x, y, origin, { x: origin.x + dx * 10, y: origin.y + dy * 10 }) < CLICK_BUFFER) return true;
      return distToSegment(x, y, origin, target) < CLICK_BUFFER * 5;
    }

    case 'fibtimezone': {
      if (points.length < 2) return false;
      const dx = points[1].x - points[0].x;
      if (Math.abs(dx) < 1) return false;
      const fibs = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55];
      for (const f of fibs) {
        if (Math.abs(x - (points[0].x + dx * f)) < CLICK_BUFFER) return true;
      }
      return false;
    }

    case 'alertzone': {
      if (points.length < 2) return false;
      const top = Math.min(points[0].y, points[1].y), bottom = Math.max(points[0].y, points[1].y);
      return y >= top - CLICK_BUFFER && y <= bottom + CLICK_BUFFER;
    }

    case 'fibext': {
      if (points.length < 2) return false;
      const allY = points.map(p => p.y);
      return y >= Math.min(...allY) - CLICK_BUFFER && y <= Math.max(...allY) + CLICK_BUFFER;
    }

    case 'elliott':
    case 'polyline': {
      if (points.length < 2) return false;
      for (let i = 0; i < points.length - 1; i++) {
        if (distToSegment(x, y, points[i], points[i + 1]) < CLICK_BUFFER) return true;
      }
      return false;
    }

    case 'infoline':
      return points.length >= 2 && distToSegment(x, y, points[0], points[1]) < CLICK_BUFFER;

    case 'parallelchannel': {
      if (points.length < 2) return false;
      if (distToSegment(x, y, points[0], points[1]) < CLICK_BUFFER) return true;
      if (points.length >= 3) {
        const dx = points[1].x - points[0].x, dy = points[1].y - points[0].y;
        if (distToSegment(x, y, points[2], { x: points[2].x + dx, y: points[2].y + dy }) < CLICK_BUFFER) return true;
      }
      return false;
    }

    case 'pricerange': {
      if (points.length < 2) return false;
      const l = Math.min(points[0].x, points[1].x), r = Math.max(points[0].x, points[1].x);
      const t = Math.min(points[0].y, points[1].y), b = Math.max(points[0].y, points[1].y);
      return x >= l - CLICK_BUFFER && x <= r + CLICK_BUFFER && y >= t - CLICK_BUFFER && y <= b + CLICK_BUFFER;
    }

    case 'daterange': {
      if (points.length < 2) return false;
      const l = Math.min(points[0].x, points[1].x), r = Math.max(points[0].x, points[1].x);
      return x >= l - CLICK_BUFFER && x <= r + CLICK_BUFFER;
    }

    case 'note': {
      if (points.length < 1) return false;
      return x >= points[0].x - CLICK_BUFFER && x <= points[0].x + 140 + CLICK_BUFFER &&
             y >= points[0].y - CLICK_BUFFER && y <= points[0].y + 60 + CLICK_BUFFER;
    }

    case 'signpost': {
      if (points.length < 1) return false;
      return Math.sqrt((x - points[0].x) ** 2 + (y - points[0].y) ** 2) < CLICK_BUFFER * 4;
    }

    default:
      return false;
  }
}

/**
 * Compute distance metric for a drawing hit (used by hitTestNearest).
 * @param {object} drawing
 * @param {number} x  CSS pixel X
 * @param {number} y  CSS pixel Y
 * @param {Array<{x:number,y:number}>} points  pixel-space points
 * @returns {number} distance (lower = closer)
 */
function hitTestDistance(drawing, x, y, points) {
  if (points.length === 0) return Infinity;
  switch (drawing.type) {
    case 'trendline': case 'arrow': case 'ray': case 'extendedline': case 'infoline':
      return points.length >= 2 ? distToSegment(x, y, points[0], points[1]) : Infinity;
    case 'hray': case 'hline':
      return points.length >= 1 ? Math.abs(y - points[0].y) : Infinity;
    case 'vline':
      return points.length >= 1 ? Math.abs(x - points[0].x) : Infinity;
    case 'signpost':
      return points.length >= 1 ? Math.sqrt((x - points[0].x) ** 2 + (y - points[0].y) ** 2) : Infinity;
    default: {
      // Centroid distance for area-based drawings
      const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
      const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
      return Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    }
  }
}

/**
 * Ranked nearest-hit test for overlapping drawings (D2.2).
 * Returns all drawings that pass hit-test, sorted nearest-first.
 * @param {Array} drawings  all drawings
 * @param {number} x  CSS pixel X
 * @param {number} y  CSS pixel Y
 * @param {Function} anchorToPixel  (point) => {x,y} | null
 * @returns {Array<{drawing: object, anchorIdx: number, distance: number}>}
 */
export function hitTestNearest(drawings, x, y, anchorToPixel) {
  const ANCHOR_RADIUS = 5;
  const results = [];
  for (let i = drawings.length - 1; i >= 0; i--) {
    const d = drawings[i];
    if (!d.visible || d.state === 'creating') continue;
    const pixelPts = d.points.map(p => anchorToPixel(p)).filter(Boolean);

    // Check anchor points first
    let anchorIdx = -1;
    let anchorDist = Infinity;
    for (let j = 0; j < d.points.length; j++) {
      const px = anchorToPixel(d.points[j]);
      if (!px) continue;
      const dist = Math.sqrt((x - px.x) ** 2 + (y - px.y) ** 2);
      if (dist <= ANCHOR_RADIUS + 2 && dist < anchorDist) {
        anchorIdx = j;
        anchorDist = dist;
      }
    }
    if (anchorIdx >= 0) {
      results.push({ drawing: d, anchorIdx, distance: anchorDist });
      continue;
    }

    // Check body hit
    if (hitTestDrawingBody(d, x, y, pixelPts)) {
      const bodyDist = hitTestDistance(d, x, y, pixelPts);
      results.push({ drawing: d, anchorIdx: -1, distance: bodyDist });
    }
  }
  results.sort((a, b) => a.distance - b.distance);
  return results;
}
