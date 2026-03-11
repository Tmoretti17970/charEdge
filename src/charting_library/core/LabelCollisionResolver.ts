// ═══════════════════════════════════════════════════════════════════
// charEdge — Label Collision Resolver (Sprint 13–14, Task #98)
//
// Interval-tree-based overlap detector for price/time axis labels.
// Prevents labels from rendering on top of each other by filtering
// overlapping labels, keeping higher-priority ones.
//
// Complexity: O(n log n) insert + query vs brute-force O(n²).
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export interface LabelRect {
  /** Unique label identifier */
  id: string;
  /** Position (left for x-axis, top for y-axis) */
  start: number;
  /** Position (right for x-axis, bottom for y-axis) */
  end: number;
  /** Higher priority labels survive collisions (default: 0) */
  priority: number;
  /** Original label data (text, value, etc.) */
  data?: unknown;
}

// ─── Interval Tree Node ─────────────────────────────────────────

interface TreeNode {
  center: number;
  left: TreeNode | null;
  right: TreeNode | null;
  /** Intervals that span the center, sorted by start */
  centerIntervals: LabelRect[];
}

// ─── LabelCollisionResolver ─────────────────────────────────────

/**
 * Resolves label collisions using an interval tree.
 *
 * Usage:
 * ```ts
 * const resolver = new LabelCollisionResolver();
 * const visible = resolver.resolve(labels);
 * // visible contains only non-overlapping labels
 * ```
 */
export class LabelCollisionResolver {
  private _minGap: number;

  /**
   * @param minGap - Minimum pixel gap between labels (default: 4)
   */
  constructor(minGap = 4) {
    this._minGap = minGap;
  }

  /**
   * Resolve collisions: return a subset of non-overlapping labels.
   * Higher-priority labels take precedence.
   *
   * @param labels - All candidate labels
   * @returns Non-overlapping labels, sorted by position
   */
  resolve(labels: LabelRect[]): LabelRect[] {
    if (labels.length <= 1) return labels;

    // Sort by priority descending (highest priority first)
    const sorted = [...labels].sort((a, b) => b.priority - a.priority);

    // Greedily place labels, checking for overlaps via interval tree
    const placed: LabelRect[] = [];
    let tree: TreeNode | null = null;

    for (const label of sorted) {
      const padded: LabelRect = {
        ...label,
        start: label.start - this._minGap,
        end: label.end + this._minGap,
      };

      if (!this._hasOverlap(tree, padded.start, padded.end)) {
        placed.push(label);
        tree = this._insert(tree, label);
      }
    }

    // Sort result by position for rendering order
    placed.sort((a, b) => a.start - b.start);
    return placed;
  }

  // ─── Interval Tree Operations ─────────────────────────────

  private _insert(node: TreeNode | null, interval: LabelRect): TreeNode {
    if (!node) {
      return {
        center: (interval.start + interval.end) / 2,
        left: null,
        right: null,
        centerIntervals: [interval],
      };
    }

    if (interval.end < node.center) {
      node.left = this._insert(node.left, interval);
    } else if (interval.start > node.center) {
      node.right = this._insert(node.right, interval);
    } else {
      // Interval spans the center — add to this node
      node.centerIntervals.push(interval);
    }

    return node;
  }

  private _hasOverlap(node: TreeNode | null, start: number, end: number): boolean {
    if (!node) return false;

    // Check intervals at this node
    for (const iv of node.centerIntervals) {
      if (start <= iv.end + this._minGap && end >= iv.start - this._minGap) {
        return true;
      }
    }

    // Check left subtree if query extends left of center
    if (start < node.center && this._hasOverlap(node.left, start, end)) {
      return true;
    }

    // Check right subtree if query extends right of center
    if (end > node.center && this._hasOverlap(node.right, start, end)) {
      return true;
    }

    return false;
  }
}
