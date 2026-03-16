// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Performance Utilities (Sprint 26)
//
// Optimizations for handling 100+ drawings at 60fps:
//   - Spatial grid index for O(1) click-testing
//   - Debounced style updates during rapid editing
//   - Viewport culling (skip off-screen drawings)
//   - Render batching with dirty-flag tracking
// ═══════════════════════════════════════════════════════════════════

// ─── Spatial Grid Index ─────────────────────────────────────────

/**
 * 2D spatial grid for fast point-in-region queries.
 * O(1) lookup instead of scanning all drawings.
 */
export class DrawingSpatialIndex {
  constructor(cellSize = 50) {
    this._cellSize = cellSize;
    this._grid = new Map(); // 'col,row' → Set<drawingId>
    this._bounds = new Map(); // drawingId → { minX, minY, maxX, maxY }
  }

  /**
   * Insert a drawing into the spatial index.
   * @param {string} id
   * @param {{ x: number, y: number }[]} points
   * @param {number} [margin=10] — hit test margin
   */
  insert(id, points, margin = 10) {
    if (!points || points.length === 0) return;

    // Compute bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    // Expand by margin
    minX -= margin; minY -= margin;
    maxX += margin; maxY += margin;

    this._bounds.set(id, { minX, minY, maxX, maxY });

    // Insert into grid cells
    const c0 = Math.floor(minX / this._cellSize);
    const c1 = Math.floor(maxX / this._cellSize);
    const r0 = Math.floor(minY / this._cellSize);
    const r1 = Math.floor(maxY / this._cellSize);

    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) {
        const key = `${c},${r}`;
        if (!this._grid.has(key)) this._grid.set(key, new Set());
        this._grid.get(key).add(id);
      }
    }
  }

  /**
   * Remove a drawing from the index.
   * @param {string} id
   */
  remove(id) {
    const bounds = this._bounds.get(id);
    if (!bounds) return;

    const c0 = Math.floor(bounds.minX / this._cellSize);
    const c1 = Math.floor(bounds.maxX / this._cellSize);
    const r0 = Math.floor(bounds.minY / this._cellSize);
    const r1 = Math.floor(bounds.maxY / this._cellSize);

    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) {
        const cell = this._grid.get(`${c},${r}`);
        if (cell) {
          cell.delete(id);
          if (cell.size === 0) this._grid.delete(`${c},${r}`);
        }
      }
    }

    this._bounds.delete(id);
  }

  /**
   * Query drawings that might contain point (x, y).
   * Returns Set of drawing IDs.
   * @param {number} x
   * @param {number} y
   * @returns {Set<string>}
   */
  query(x, y) {
    const col = Math.floor(x / this._cellSize);
    const row = Math.floor(y / this._cellSize);
    const key = `${col},${row}`;
    return this._grid.get(key) || new Set();
  }

  /**
   * Clear and rebuild the entire index.
   * @param {Array} drawings — array of { id, screenPoints }
   */
  rebuild(drawings) {
    this._grid.clear();
    this._bounds.clear();
    for (const d of drawings) {
      if (d.screenPoints) {
        this.insert(d.id, d.screenPoints);
      }
    }
  }

  get size() {
    return this._bounds.size;
  }
}

// ─── Viewport Culling ───────────────────────────────────────────

/**
 * Filter drawings to only those visible within the viewport.
 * @param {Array} drawings
 * @param {{ left: number, top: number, right: number, bottom: number }} viewport
 * @returns {Array}
 */
export function cullToViewport(drawings, viewport) {
  return drawings.filter(d => {
    if (!d.screenPoints || d.screenPoints.length === 0) return true; // No points = always render (e.g. hlines)

    const points = d.screenPoints;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    // Check AABB overlap with viewport
    return !(maxX < viewport.left || minX > viewport.right ||
             maxY < viewport.top || minY > viewport.bottom);
  });
}

// ─── Debounced Style Updates ────────────────────────────────────

/**
 * Returns a debounced version of fn that batches rapid calls.
 * @param {Function} fn
 * @param {number} delayMs
 */
export function debounceStyleUpdate(fn, delayMs = 50) {
  let timeoutId = null;
  let pending = null;

  function debounced(...args) {
    pending = args;
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...pending);
      pending = null;
      timeoutId = null;
    }, delayMs);
  }

  debounced.flush = () => {
    if (pending && timeoutId) {
      clearTimeout(timeoutId);
      fn(...pending);
      pending = null;
      timeoutId = null;
    }
  };

  debounced.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId);
    pending = null;
    timeoutId = null;
  };

  return debounced;
}

// ─── Render Batching ────────────────────────────────────────────

/**
 * Tracks which drawings are dirty and need re-rendering.
 * Avoids full redraws on every interaction.
 */
export class DirtyTracker {
  constructor() {
    this._dirty = new Set();
    this._fullRedraw = false;
  }

  markDirty(drawingId) {
    this._dirty.add(drawingId);
  }

  markFullRedraw() {
    this._fullRedraw = true;
  }

  isDirty(drawingId) {
    return this._fullRedraw || this._dirty.has(drawingId);
  }

  needsRedraw() {
    return this._fullRedraw || this._dirty.size > 0;
  }

  clear() {
    this._dirty.clear();
    this._fullRedraw = false;
  }

  get dirtyCount() {
    return this._fullRedraw ? -1 : this._dirty.size;
  }
}
