// ═══════════════════════════════════════════════════════════════════
// charEdge — DirtyRegion
//
// Tracks dirty rectangular regions per canvas layer.
// Used to minimize canvas clearing: instead of clearing the entire
// layer, only clear and repaint the dirty rectangle(s).
//
// Initially used for the crosshair (UI layer): on mouse move, only
// the old crosshair strip and new strip are marked dirty.
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} Rect
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 */

/**
 * Dirty region tracker. Merges overlapping dirty rects per layer.
 */
export class DirtyRegion {
  constructor() {
    /** @type {Map<string, Rect>} layerId → merged bounding box */
    this._regions = new Map();
  }

  /**
   * Register a dirty rectangle on a layer.
   * If the layer already has a dirty region, merges into the bounding box.
   * @param {string} layerId - Canvas layer identifier
   * @param {Rect} rect      - Dirty area in CSS pixels
   */
  addRect(layerId, rect) {
    if (!rect || rect.w <= 0 || rect.h <= 0) return;

    const existing = this._regions.get(layerId);
    if (!existing) {
      this._regions.set(layerId, { x: rect.x, y: rect.y, w: rect.w, h: rect.h });
    } else {
      // Merge: compute bounding box of both rects
      const x1 = Math.min(existing.x, rect.x);
      const y1 = Math.min(existing.y, rect.y);
      const x2 = Math.max(existing.x + existing.w, rect.x + rect.w);
      const y2 = Math.max(existing.y + existing.h, rect.y + rect.h);
      existing.x = x1;
      existing.y = y1;
      existing.w = x2 - x1;
      existing.h = y2 - y1;
    }
  }

  /**
   * Get the merged dirty region for a layer.
   * @param {string} layerId
   * @returns {Rect|null}
   */
  getRegion(layerId) {
    return this._regions.get(layerId) || null;
  }

  /**
   * Check if a layer has any dirty regions.
   * @param {string} layerId
   * @returns {boolean}
   */
  hasDirty(layerId) {
    return this._regions.has(layerId);
  }

  /**
   * Get all layers that have dirty regions.
   * @returns {string[]}
   */
  getDirtyLayers() {
    return [...this._regions.keys()];
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
