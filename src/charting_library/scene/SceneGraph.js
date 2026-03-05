// ═══════════════════════════════════════════════════════════════════
// charEdge — SceneGraph
//
// Lightweight scene graph for the render pipeline. Manages a tree
// of RenderNode objects and provides:
//   - O(1) node lookup by ID
//   - Spatial queries via SpatialIndex
//   - Dirty region tracking via DirtyRegion
//   - Frame-level dirty/clean lifecycle
//
// Lifecycle:
//   1. Stages add/update/remove nodes during execute()
//   2. RenderPipeline queries dirtyNodes / spatialIndex
//   3. After frame, call clearDirty() to reset flags
// ═══════════════════════════════════════════════════════════════════

import { RenderNode } from './RenderNode.js';
import { SpatialIndex } from './SpatialIndex.js';
import { DirtyRegion } from './DirtyRegion.js';
import { logger } from '../../utils/logger';

export class SceneGraph {
  /**
   * @param {number} [width=1920]  - Viewport width in CSS pixels
   * @param {number} [height=1080] - Viewport height in CSS pixels
   */
  constructor(width = 1920, height = 1080) {
    /** Root node — not rendered directly, acts as container */
    this.root = new RenderNode({ id: '__root__', type: 'root' });
    this.root._sceneGraph = this;

    /** @type {Map<string, RenderNode>} Fast lookup by node ID */
    this._nodeMap = new Map();
    this._nodeMap.set(this.root.id, this.root);

    /** Spatial index for point/rect queries */
    this.spatialIndex = new SpatialIndex(width, height);

    /** Dirty region tracker */
    this.dirtyRegions = new DirtyRegion();

    /** @type {Set<string>} IDs of nodes marked dirty this frame */
    this._dirtySet = new Set();
  }

  // ─── Node Management ───────────────────────────────────────────

  /**
   * Add a node to the scene graph.
   * @param {RenderNode} node
   * @param {string} [parentId] - Parent node ID (defaults to root)
   * @returns {RenderNode} The added node
   */
  addNode(node, parentId) {
    const parent = parentId ? this._nodeMap.get(parentId) : this.root;
    if (!parent) {
      logger.engine.warn(`[SceneGraph] Parent "${parentId}" not found, using root`);
      this.root.addChild(node);
    } else {
      parent.addChild(node);
    }
    return node;
  }

  /**
   * Remove a node (and all its descendants) from the scene graph.
   * @param {string} nodeId
   * @returns {boolean} True if found and removed
   */
  removeNode(nodeId) {
    const node = this._nodeMap.get(nodeId);
    if (!node || node === this.root) return false;

    // Remove all descendants first
    node.traverse((child) => {
      if (child !== node) {
        this._nodeMap.delete(child.id);
        this.spatialIndex.remove(child.id);
        this._dirtySet.delete(child.id);
      }
    });

    // Remove from parent
    if (node.parent) {
      node.parent.removeChild(node);
    }
    return true;
  }

  /**
   * Get a node by ID.
   * @param {string} nodeId
   * @returns {RenderNode|undefined}
   */
  getNode(nodeId) {
    return this._nodeMap.get(nodeId);
  }

  /**
   * Check if a node exists.
   * @param {string} nodeId
   * @returns {boolean}
   */
  hasNode(nodeId) {
    return this._nodeMap.has(nodeId);
  }

  // ─── Spatial Queries ────────────────────────────────────────────

  /**
   * Find all nodes at a CSS-pixel point.
   * @param {number} x
   * @param {number} y
   * @returns {RenderNode[]} Sorted by z-index descending
   */
  queryPoint(x, y) {
    return this.spatialIndex.queryPoint(x, y);
  }

  /**
   * Find all nodes overlapping a rectangle.
   * @param {{ x: number, y: number, w: number, h: number }} rect
   * @returns {RenderNode[]}
   */
  queryRect(rect) {
    return this.spatialIndex.queryRect(rect);
  }

  // ─── Dirty Tracking ─────────────────────────────────────────────

  /**
   * Get all nodes that are marked dirty.
   * @returns {RenderNode[]}
   */
  getDirtyNodes() {
    const nodes = [];
    for (const id of this._dirtySet) {
      const node = this._nodeMap.get(id);
      if (node) nodes.push(node);
    }
    return nodes;
  }

  /**
   * Clear all dirty flags after a frame has been rendered.
   */
  clearDirty() {
    for (const id of this._dirtySet) {
      const node = this._nodeMap.get(id);
      if (node) node.dirty = false;
    }
    this._dirtySet.clear();
    this.dirtyRegions.clear();
  }

  /**
   * Rebuild the spatial index entirely (e.g. after resize).
   * @param {number} [w]
   * @param {number} [h]
   */
  rebuildSpatialIndex(w, h) {
    if (w !== undefined && h !== undefined) {
      this.spatialIndex.resize(w, h);
    } else {
      // Re-insert all nodes
      this.spatialIndex.clear();
      this.root.traverse((node) => {
        if (node !== this.root && node.bounds.w > 0 && node.bounds.h > 0) {
          this.spatialIndex.insert(node);
        }
      });
    }
  }

  /**
   * Total number of nodes (excluding root).
   * @returns {number}
   */
  get size() {
    return this._nodeMap.size - 1; // subtract root
  }

  // ─── Internal Callbacks (called by RenderNode) ──────────────────

  /** @internal */
  _onNodeAdded(node) {
    this._nodeMap.set(node.id, node);
    node._sceneGraph = this;
    if (node.bounds.w > 0 || node.bounds.h > 0) {
      this.spatialIndex.insert(node);
    }
    this._dirtySet.add(node.id);

    // Also register all descendants
    for (const child of node.children) {
      this._onNodeAdded(child);
    }
  }

  /** @internal */
  _onNodeRemoved(node) {
    this._nodeMap.delete(node.id);
    this.spatialIndex.remove(node.id);
    this._dirtySet.delete(node.id);
    node._sceneGraph = null;

    for (const child of node.children) {
      this._onNodeRemoved(child);
    }
  }

  /** @internal */
  _onNodeDirty(node) {
    this._dirtySet.add(node.id);
    // Register the node's bounds as a dirty region on its layer
    if (node.bounds.w > 0 && node.bounds.h > 0) {
      this.dirtyRegions.addRect(node.layer, node.bounds);
    }
  }

  /** @internal */
  _onBoundsChanged(node, prevBounds) {
    // Register old bounds as dirty too (need to clear old position)
    if (prevBounds.w > 0 && prevBounds.h > 0) {
      this.dirtyRegions.addRect(node.layer, prevBounds);
    }
    // Re-index with new bounds
    if (node.bounds.w > 0 || node.bounds.h > 0) {
      this.spatialIndex.insert(node);
    } else {
      this.spatialIndex.remove(node.id);
    }
  }
}
