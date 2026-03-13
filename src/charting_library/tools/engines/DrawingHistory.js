// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing History (Undo/Redo)
// Circular buffer of deep-cloned drawing snapshots.
// Max 50 snapshots. Supports undo/redo with branching.
// ═══════════════════════════════════════════════════════════════════

const MAX_HISTORY = 50;

/**
 * Create a history manager for drawing undo/redo.
 * @returns {{ push, undo, redo, canUndo, canRedo, clear }}
 */
export function createDrawingHistory() {
  let stack = [];    // Array of snapshots (deep-cloned drawing arrays)
  let pointer = -1;  // Current position in stack

  /**
   * Deep-clone a drawings array for snapshot.
   * @param {Array} drawings
   * @returns {Array}
   */
  function snapshot(drawings) {
    return drawings.map(d => ({
      id: d.id,
      type: d.type,
      points: d.points.map(p => ({ price: p.price, time: p.time })),
      style: { ...d.style },
      locked: d.locked,
      visible: d.visible,
      meta: d.meta ? { ...d.meta } : {},
      _groupId: d._groupId || null,
      syncAcrossTimeframes: d.syncAcrossTimeframes || false,
    }));
  }

  return {
    /**
     * Push a new snapshot. Truncates any redo history ahead of pointer.
     * @param {Array} drawings
     */
    push(drawings) {
      // Truncate redo stack
      stack = stack.slice(0, pointer + 1);
      stack.push(snapshot(drawings));
      // Cap at max
      if (stack.length > MAX_HISTORY) {
        stack.shift();
      } else {
        pointer++;
      }
    },

    /**
     * Undo — return previous snapshot or null.
     * @returns {Array|null}
     */
    undo() {
      if (pointer <= 0) return null;
      pointer--;
      return snapshot(stack[pointer]);
    },

    /**
     * Redo — return next snapshot or null.
     * @returns {Array|null}
     */
    redo() {
      if (pointer >= stack.length - 1) return null;
      pointer++;
      return snapshot(stack[pointer]);
    },

    /** @returns {boolean} */
    canUndo() { return pointer > 0; },

    /** @returns {boolean} */
    canRedo() { return pointer < stack.length - 1; },

    /** Reset history. */
    clear() { stack = []; pointer = -1; },

    /** Current depth for debugging. */
    get depth() { return stack.length; },
    get position() { return pointer; },
  };
}
