// ═══════════════════════════════════════════════════════════════════
// charEdge — DirtyRegion (Sprint 18 #114)
//
// Tracks disjoint dirty rectangular regions per canvas layer.
// Instead of merging everything into one bounding box, maintains
// up to MAX_RECTS separate rects per layer. Only when the limit
// is exceeded are the two closest rects merged.
//
// This enables per-pane partial repaints: only intersecting panes
// need to be redrawn, rather than the full canvas.
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} Rect
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 */

const MAX_RECTS = 8;

/**
 * Check if two rects overlap (including touching edges).
 */
function rectsOverlap(a, b) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

/**
 * Merge two rects into their bounding box.
 */
function mergeRects(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
}

/**
 * Compute the area increase from merging two rects.
 * Used to find the "cheapest" merge when over MAX_RECTS.
 */
function mergeArea(a, b) {
  const merged = mergeRects(a, b);
  return merged.w * merged.h - a.w * a.h - b.w * b.h;
}

/**
 * Dirty region tracker with disjoint rect support.
 * Maintains up to MAX_RECTS (8) separate dirty rects per layer.
 * Only merges when overlapping or when the list exceeds the limit.
 */
export class DirtyRegion {
  constructor() {
    /** @type {Map<string, Rect[]>} layerId → array of disjoint rects */
    this._regions = new Map();
  }

  /**
   * Register a dirty rectangle on a layer.
   * If overlapping with an existing rect, merges them.
   * If at capacity, merges the two closest rects.
   * @param {string} layerId - Canvas layer identifier
   * @param {Rect} rect      - Dirty area in CSS pixels
   */
  addRect(layerId, rect) {
    if (!rect || rect.w <= 0 || rect.h <= 0) return;

    let rects = this._regions.get(layerId);
    if (!rects) {
      rects = [];
      this._regions.set(layerId, rects);
    }

    // Check for overlaps with existing rects — merge if found
    for (let i = 0; i < rects.length; i++) {
      if (rectsOverlap(rects[i], rect)) {
        rects[i] = mergeRects(rects[i], rect);
        return;
      }
    }

    // No overlap — add as a new disjoint rect
    rects.push({ x: rect.x, y: rect.y, w: rect.w, h: rect.h });

    // If over capacity, merge the two closest rects
    if (rects.length > MAX_RECTS) {
      this._compactRects(rects);
    }
  }

  /**
   * Merge the two rects with the smallest merge area cost.
   * @param {Rect[]} rects
   */
  _compactRects(rects) {
    let bestI = 0, bestJ = 1, bestCost = Infinity;
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const cost = mergeArea(rects[i], rects[j]);
        if (cost < bestCost) {
          bestCost = cost;
          bestI = i;
          bestJ = j;
        }
      }
    }
    rects[bestI] = mergeRects(rects[bestI], rects[bestJ]);
    rects.splice(bestJ, 1);
  }

  /**
   * Get all dirty regions for a layer (array of disjoint rects).
   * @param {string} layerId
   * @returns {Rect[]}
   */
  getRegions(layerId) {
    return this._regions.get(layerId) || [];
  }

  /**
   * Get the single merged dirty region for a layer (backwards compat).
   * @param {string} layerId
   * @returns {Rect|null}
   */
  getRegion(layerId) {
    const rects = this._regions.get(layerId);
    if (!rects || rects.length === 0) return null;
    let merged = rects[0];
    for (let i = 1; i < rects.length; i++) {
      merged = mergeRects(merged, rects[i]);
    }
    return merged;
  }

  /**
   * Check if a layer has any dirty regions.
   * @param {string} layerId
   * @returns {boolean}
   */
  hasDirty(layerId) {
    const rects = this._regions.get(layerId);
    return !!rects && rects.length > 0;
  }

  /**
   * Get all layers that have dirty regions.
   * @returns {string[]}
   */
  getDirtyLayers() {
    return [...this._regions.keys()].filter(k => this.hasDirty(k));
  }

  /**
   * Check if a rect intersects any dirty region on a layer.
   * @param {string} layerId
   * @param {Rect} rect
   * @returns {boolean}
   */
  intersects(layerId, rect) {
    const rects = this._regions.get(layerId);
    if (!rects) return false;
    return rects.some(r => rectsOverlap(r, rect));
  }

  /**
   * Clear all dirty regions for all layers.
   */
  clear() {
    this._regions.clear();
  }

  /**
   * Clear dirty region for a specific layer.
   * @param {string} layerId
   */
  clearLayer(layerId) {
    this._regions.delete(layerId);
  }
}
