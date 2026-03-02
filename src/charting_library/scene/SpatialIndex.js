// ═══════════════════════════════════════════════════════════════════
// charEdge — SpatialIndex
//
// Grid-based spatial index for O(1) average-case point queries
// and O(k) rect queries (where k = number of overlapping cells).
//
// Design: uniform grid where each cell holds a Set of node IDs.
// Chosen over R-tree for simplicity, cache locality, and bounded
// viewport size (charts have known width/height).
// ═══════════════════════════════════════════════════════════════════

/**
 * Grid-based spatial index.
 */
export class SpatialIndex {
  /**
   * @param {number} width  - Viewport width in CSS pixels
   * @param {number} height - Viewport height in CSS pixels
   * @param {number} [cellSize=64] - Cell size in CSS pixels
   */
  constructor(width = 1920, height = 1080, cellSize = 64) {
    this._cellSize = cellSize;
    /** @type {Map<string, import('./RenderNode.js').RenderNode>} */
    this._nodes = new Map();
    /** @type {Map<string, Set<number>>} nodeId → set of cell indices */
    this._nodeCells = new Map();

    this._width = 0;
    this._height = 0;
    this._cols = 0;
    this._rows = 0;
    /** @type {Set<string>[]} */
    this._cells = [];

    this.resize(width, height);
  }

  /**
   * Rebuild the grid for new viewport dimensions.
   * Retains existing nodes and re-inserts them.
   * @param {number} w
   * @param {number} h
   */
  resize(w, h) {
    this._width = Math.max(1, w);
    this._height = Math.max(1, h);
    this._cols = Math.ceil(this._width / this._cellSize);
    this._rows = Math.ceil(this._height / this._cellSize);

    // Rebuild cells
    const totalCells = this._cols * this._rows;
    this._cells = new Array(totalCells);
    for (let i = 0; i < totalCells; i++) {
      this._cells[i] = new Set();
    }

    // Re-index all existing nodes
    const nodes = [...this._nodes.values()];
    this._nodeCells.clear();
    for (const node of nodes) {
      this._insertIntoGrid(node);
    }
  }

  /**
   * Insert or update a node in the index.
   * @param {import('./RenderNode.js').RenderNode} node
   */
  insert(node) {
    // Remove old cell entries if node was already indexed
    this._removeFromGrid(node.id);
    this._nodes.set(node.id, node);
    this._insertIntoGrid(node);
  }

  /**
   * Remove a node from the index.
   * @param {string} nodeId
   */
  remove(nodeId) {
    this._removeFromGrid(nodeId);
    this._nodes.delete(nodeId);
  }

  /**
   * Query all nodes whose bounds contain the point (x, y).
   * @param {number} x - CSS pixel X
   * @param {number} y - CSS pixel Y
   * @returns {import('./RenderNode.js').RenderNode[]}
   */
  queryPoint(x, y) {
    const col = Math.floor(x / this._cellSize);
    const row = Math.floor(y / this._cellSize);
    if (col < 0 || col >= this._cols || row < 0 || row >= this._rows) {
      return [];
    }

    const cellIdx = row * this._cols + col;
    const cell = this._cells[cellIdx];
    if (!cell || cell.size === 0) return [];

    const results = [];
    for (const nodeId of cell) {
      const node = this._nodes.get(nodeId);
      if (node && node.visible) {
        const b = node.bounds;
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          results.push(node);
        }
      }
    }

    // Sort by z-index descending (topmost first)
    results.sort((a, b) => b.zIndex - a.zIndex);
    return results;
  }

  /**
   * Query all nodes whose bounds overlap the given rect.
   * @param {{ x: number, y: number, w: number, h: number }} rect
   * @returns {import('./RenderNode.js').RenderNode[]}
   */
  queryRect(rect) {
    const minCol = Math.max(0, Math.floor(rect.x / this._cellSize));
    const maxCol = Math.min(this._cols - 1, Math.floor((rect.x + rect.w) / this._cellSize));
    const minRow = Math.max(0, Math.floor(rect.y / this._cellSize));
    const maxRow = Math.min(this._rows - 1, Math.floor((rect.y + rect.h) / this._cellSize));

    const seen = new Set();
    const results = [];

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const cellIdx = r * this._cols + c;
        const cell = this._cells[cellIdx];
        if (!cell) continue;
        for (const nodeId of cell) {
          if (seen.has(nodeId)) continue;
          seen.add(nodeId);
          const node = this._nodes.get(nodeId);
          if (node && node.visible) {
            const b = node.bounds;
            // AABB overlap test
            if (b.x < rect.x + rect.w && b.x + b.w > rect.x &&
                b.y < rect.y + rect.h && b.y + b.h > rect.y) {
              results.push(node);
            }
          }
        }
      }
    }

    results.sort((a, b) => b.zIndex - a.zIndex);
    return results;
  }

  /**
   * Remove all nodes from the index.
   */
  clear() {
    for (const cell of this._cells) {
      cell.clear();
    }
    this._nodes.clear();
    this._nodeCells.clear();
  }

  /**
   * Get the total number of indexed nodes.
   * @returns {number}
   */
  get size() {
    return this._nodes.size;
  }

  // ─── Internal ──────────────────────────────────────────────────

  /** @private */
  _insertIntoGrid(node) {
    const b = node.bounds;
    const minCol = Math.max(0, Math.floor(b.x / this._cellSize));
    const maxCol = Math.min(this._cols - 1, Math.floor((b.x + b.w) / this._cellSize));
    const minRow = Math.max(0, Math.floor(b.y / this._cellSize));
    const maxRow = Math.min(this._rows - 1, Math.floor((b.y + b.h) / this._cellSize));

    const cellSet = new Set();
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const idx = r * this._cols + c;
        this._cells[idx].add(node.id);
        cellSet.add(idx);
      }
    }
    this._nodeCells.set(node.id, cellSet);
  }

  /** @private */
  _removeFromGrid(nodeId) {
    const cellSet = this._nodeCells.get(nodeId);
    if (!cellSet) return;
    for (const idx of cellSet) {
      if (this._cells[idx]) {
        this._cells[idx].delete(nodeId);
      }
    }
    this._nodeCells.delete(nodeId);
  }
}
