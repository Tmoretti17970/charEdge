// ═══════════════════════════════════════════════════════════════════
// charEdge — RenderNode
//
// Base class for all renderable entities in the scene graph.
// Each node has: bounds, dirty flag, z-index, layer assignment,
// parent/children references, and virtual draw/hitTest methods.
//
// Subclasses: DrawingNode, CrosshairNode, AxisLabelNode, IndicatorNode
// ═══════════════════════════════════════════════════════════════════

let _nextId = 1;

/**
 * @typedef {Object} Rect
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 */

/**
 * Base render node. All scene graph entities extend this.
 */
export class RenderNode {
  /**
   * @param {Object} opts
   * @param {string}  [opts.id]      - Unique ID (auto-generated if omitted)
   * @param {string}  [opts.type]    - Node type tag (e.g. 'drawing', 'crosshair')
   * @param {number}  [opts.zIndex]  - Render order within layer (higher = on top)
   * @param {string}  [opts.layer]   - Target canvas layer name
   * @param {boolean} [opts.visible] - Whether to render
   */
  constructor(opts = {}) {
    this.id = opts.id || `rn_${_nextId++}`;
    this.type = opts.type || 'generic';
    /** @type {Rect} */
    this.bounds = { x: 0, y: 0, w: 0, h: 0 };
    this.dirty = true;
    this.visible = opts.visible !== false;
    this.zIndex = opts.zIndex || 0;
    this.layer = opts.layer || 'DATA';
    /** @type {RenderNode|null} */
    this.parent = null;
    /** @type {RenderNode[]} */
    this.children = [];
    /** @type {Object|null} Arbitrary data payload for subclasses */
    this.data = null;
    /** @type {Function|null} Custom draw callback */
    this._drawFn = opts.drawFn || null;
    /** @type {Function|null} Custom hit-test callback */
    this._hitTestFn = opts.hitTestFn || null;
    /** @type {import('./SceneGraph.js').SceneGraph|null} */
    this._sceneGraph = null;
  }

  /**
   * Draw this node. Override in subclasses or provide drawFn in constructor.
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../core/FrameState.js').FrameState} frameState
   */
  draw(ctx, frameState) {
    if (this._drawFn) this._drawFn(ctx, frameState, this);
  }

  /**
   * Test if a CSS-pixel coordinate hits this node.
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  hitTest(x, y) {
    if (this._hitTestFn) return this._hitTestFn(x, y, this);
    return pointInRect(x, y, this.bounds);
  }

  /**
   * Mark this node (and all ancestors) as dirty.
   * If connected to a scene graph, notifies the dirty region tracker.
   */
  markDirty() {
    if (this.dirty) return;
    this.dirty = true;
    if (this._sceneGraph) {
      this._sceneGraph._onNodeDirty(this);
    }
    if (this.parent) {
      this.parent.markDirty();
    }
  }

  /**
   * Update this node's bounding box and re-index in the spatial index.
   * @param {Rect} rect - New bounding box in CSS pixels
   */
  updateBounds(rect) {
    const prev = this.bounds;
    this.bounds = { ...rect };
    this.markDirty();
    if (this._sceneGraph) {
      this._sceneGraph._onBoundsChanged(this, prev);
    }
  }

  /**
   * Add a child node.
   * @param {RenderNode} node
   * @returns {RenderNode} The added child
   */
  addChild(node) {
    if (node.parent) {
      node.parent.removeChild(node);
    }
    node.parent = this;
    this.children.push(node);
    if (this._sceneGraph) {
      node._sceneGraph = this._sceneGraph;
      this._sceneGraph._onNodeAdded(node);
    }
    this.markDirty();
    return node;
  }

  /**
   * Remove a child node by reference.
   * @param {RenderNode} node
   * @returns {boolean} True if found and removed
   */
  removeChild(node) {
    const idx = this.children.indexOf(node);
    if (idx === -1) return false;
    this.children.splice(idx, 1);
    node.parent = null;
    if (this._sceneGraph) {
      this._sceneGraph._onNodeRemoved(node);
      node._sceneGraph = null;
    }
    this.markDirty();
    return true;
  }

  /**
   * Walk all descendants (depth-first pre-order).
   * @param {(node: RenderNode) => void} fn
   */
  traverse(fn) {
    fn(this);
    for (const child of this.children) {
      child.traverse(fn);
    }
  }
}

// ─── Built-in Subclasses ─────────────────────────────────────────

/**
 * DrawingNode — wraps a single user drawing (trendline, fib, etc.).
 */
export class DrawingNode extends RenderNode {
  /**
   * @param {Object} drawing - Drawing model from DrawingEngine
   */
  constructor(drawing) {
    super({
      id: `drw_${drawing.id}`,
      type: 'drawing',
      layer: 'DRAWINGS',
      zIndex: drawing.zIndex || 0,
    });
    this.data = drawing;
  }
}

/**
 * CrosshairNode — crosshair lines + tooltip box.
 */
export class CrosshairNode extends RenderNode {
  constructor() {
    super({
      id: 'crosshair',
      type: 'crosshair',
      layer: 'UI',
      zIndex: 100,
    });
  }
}

/**
 * AxisLabelNode — a single price or time axis label.
 */
export class AxisLabelNode extends RenderNode {
  /**
   * @param {string} axis - 'price' | 'time'
   * @param {number|string} value
   */
  constructor(axis, value) {
    super({
      id: `axis_${axis}_${value}`,
      type: 'axisLabel',
      layer: 'DATA',
      zIndex: 0,
    });
    this.data = { axis, value };
  }
}

/**
 * IndicatorNode — a single indicator overlay or pane.
 */
export class IndicatorNode extends RenderNode {
  /**
   * @param {Object} indicator - Indicator config from registry
   */
  constructor(indicator) {
    super({
      id: `ind_${indicator.id || indicator.shortName}`,
      type: 'indicator',
      layer: 'INDICATORS',
      zIndex: indicator.zIndex || 0,
    });
    this.data = indicator;
  }
}

// ─── Utility ─────────────────────────────────────────────────────

/**
 * Point-in-rect test.
 * @param {number} px
 * @param {number} py
 * @param {Rect} rect
 * @returns {boolean}
 */
export function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.w &&
         py >= rect.y && py <= rect.y + rect.h;
}

/**
 * Test if two rects overlap.
 * @param {Rect} a
 * @param {Rect} b
 * @returns {boolean}
 */
export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}
