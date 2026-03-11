// ═══════════════════════════════════════════════════════════════════
// charEdge — DrawingEngine: CRUD Sub-Module
// Functions for adding, removing, duplicating, visibility, locking,
// ordering, multi-select, clipboard, groups, and bulk operations.
// All functions receive a `ctx` context object for state access.
// ═══════════════════════════════════════════════════════════════════

// BUG-13: Use unified ID generator from DrawingModel
import { generateId } from '../tools/DrawingModel.js';
export { generateId };

/** Add a pre-built drawing */
export function addDrawing(ctx, drawing) {
  drawing.state = 'idle';
  ctx.drawings.push(drawing);
  ctx.emit();
}

/** Remove a drawing by ID */
export function removeDrawing(ctx, id) {
  ctx.drawings = ctx.drawings.filter(d => d.id !== id);
  if (ctx.selectedDrawingId === id) {
    ctx.selectedDrawingId = null;
    ctx.setState('idle');
  }
  // BUG-08: Immediately remove stale scene graph node
  if (ctx.sceneGraph) ctx.sceneGraph.removeNode(`drw_${id}`);
  ctx.emit();
  return ctx.drawings;
}

/** Remove all drawings */
export function clearAll(ctx) {
  ctx.drawings = [];
  ctx.selectedDrawingId = null;
  ctx.activeDrawing = null;
  ctx.activeTool = null;
  ctx.setState('idle');
  // BUG-08: Purge all drawing nodes from scene graph immediately
  if (ctx.sceneGraph?.root?.traverse) {
    const ids = [];
    ctx.sceneGraph.root.traverse(node => { if (node.type === 'drawing') ids.push(node.id); });
    for (const nid of ids) ctx.sceneGraph.removeNode(nid);
  }
  ctx.emit();
  return ctx.drawings;
}

/** Toggle visibility */
export function toggleVisibility(ctx, id) {
  const d = ctx.drawings.find(d => d.id === id);
  if (d) { d.visible = !d.visible; ctx.emit(); }
}

/** Toggle lock */
export function toggleLock(ctx, id) {
  const d = ctx.drawings.find(d => d.id === id);
  if (d) { d.locked = !d.locked; ctx.emit(); }
}

/** Update a drawing's style */
export function updateStyle(ctx, id, style) {
  const d = ctx.drawings.find(d => d.id === id);
  if (d) { Object.assign(d.style, style); ctx.emit(); }
}

/** Load drawings from serialized data */
export function loadDrawings(ctx, drawingArray) {
  ctx.drawings = drawingArray.map(d => ({ ...d, state: 'idle' }));
  ctx.selectedDrawingId = null;
  ctx.setState('idle');
  ctx.emit();
  return ctx.drawings;
}

/** Duplicate a drawing by ID (offset slightly) */
export function duplicateDrawing(ctx, id) {
  const d = ctx.drawings.find(d => d.id === id);
  if (!d) return null;
  const dup = JSON.parse(JSON.stringify(d));
  dup.id = generateId();
  dup.state = 'idle';
  dup.points = dup.points.map(p => ({ price: p.price * 1.003, time: p.time + 120000 }));
  ctx.drawings.push(dup);
  ctx.emit();
  return dup.id;
}

/** Bring a drawing to front */
export function bringToFront(ctx, id) {
  const idx = ctx.drawings.findIndex(d => d.id === id);
  if (idx >= 0 && idx < ctx.drawings.length - 1) {
    if (ctx.pushUndo) ctx.pushUndo(); // BUG-05: snapshot before z-order change
    const [d] = ctx.drawings.splice(idx, 1);
    ctx.drawings.push(d);
    ctx.emit();
  }
}

/** Send a drawing to back */
export function sendToBack(ctx, id) {
  const idx = ctx.drawings.findIndex(d => d.id === id);
  if (idx > 0) {
    if (ctx.pushUndo) ctx.pushUndo(); // BUG-05: snapshot before z-order change
    const [d] = ctx.drawings.splice(idx, 1);
    ctx.drawings.unshift(d);
    ctx.emit();
  }
}

// ── Multi-Select Operations ──────────────────────────────────────

/** Toggle multi-select for a drawing */
export function toggleMultiSelect(ctx, id) {
  if (ctx.selectedDrawingIds.has(id)) {
    ctx.selectedDrawingIds.delete(id);
    const d = ctx.drawings.find(d => d.id === id);
    if (d) d.state = 'idle';
  } else {
    ctx.selectedDrawingIds.add(id);
    const d = ctx.drawings.find(d => d.id === id);
    if (d) d.state = 'selected';
  }
  ctx.emit();
}

/** Select all unlocked visible drawings */
export function selectAll(ctx) {
  for (const d of ctx.drawings) {
    if (!d.locked && d.visible) {
      ctx.selectedDrawingIds.add(d.id);
      d.state = 'selected';
    }
  }
  ctx.emit();
}

/** Clear multi-selection */
export function clearMultiSelect(ctx) {
  for (const id of ctx.selectedDrawingIds) {
    const d = ctx.drawings.find(d => d.id === id);
    if (d) d.state = 'idle';
  }
  ctx.selectedDrawingIds.clear();
  ctx.emit();
}

/** Batch delete selected drawings */
export function deleteSelected(ctx) {
  const ids = ctx.selectedDrawingIds.size > 0
    ? ctx.selectedDrawingIds
    : (ctx.selectedDrawingId ? new Set([ctx.selectedDrawingId]) : new Set());
  if (ids.size === 0) return;
  ctx.drawings = ctx.drawings.filter(d => !ids.has(d.id));
  ctx.selectedDrawingIds.clear();
  ctx.selectedDrawingId = null;
  ctx.setState('idle');
  ctx.emit();
  return ctx.drawings;
}

/** Batch style update */
export function batchUpdateStyle(ctx, style) {
  const ids = ctx.selectedDrawingIds.size > 0
    ? ctx.selectedDrawingIds
    : (ctx.selectedDrawingId ? new Set([ctx.selectedDrawingId]) : new Set());
  for (const d of ctx.drawings) {
    if (ids.has(d.id)) Object.assign(d.style, style);
  }
  ctx.emit();
}

/** Box-select drawings whose anchors fall within rect */
export function boxSelect(ctx, x1, y1, x2, y2) {
  const left = Math.min(x1, x2), right = Math.max(x1, x2);
  const top = Math.min(y1, y2), bottom = Math.max(y1, y2);
  for (const d of ctx.drawings) {
    if (!d.visible || d.locked) continue;
    const inside = d.points.some(pt => {
      const px = ctx.anchorToPixel(pt);
      return px && px.x >= left && px.x <= right && px.y >= top && px.y <= bottom;
    });
    if (inside) { ctx.selectedDrawingIds.add(d.id); d.state = 'selected'; }
  }
  ctx.emit();
}

// ── Clipboard ────────────────────────────────────────────────────

/** Copy selected drawings to clipboard */
export function copySelected(ctx) {
  const ids = ctx.selectedDrawingIds.size > 0
    ? ctx.selectedDrawingIds
    : (ctx.selectedDrawingId ? new Set([ctx.selectedDrawingId]) : new Set());
  if (ids.size === 0) return null;
  return ctx.drawings.filter(d => ids.has(d.id)).map(d => JSON.parse(JSON.stringify(d)));
}

/** Paste drawings from clipboard */
export function pasteFromClipboard(ctx, clipboard) {
  if (!clipboard || clipboard.length === 0) return;
  const newIds = [];
  for (const orig of clipboard) {
    const dup = JSON.parse(JSON.stringify(orig));
    dup.id = generateId();
    dup.state = 'idle';
    dup.points = dup.points.map(p => ({ price: p.price * 1.002, time: p.time + 60000 }));
    ctx.drawings.push(dup);
    newIds.push(dup.id);
  }
  ctx.selectedDrawingIds.clear();
  for (const id of newIds) ctx.selectedDrawingIds.add(id);
  ctx.emit();
}

// ── Groups ───────────────────────────────────────────────────────

/** Group selected drawings */
export function groupSelected(ctx) {
  const ids = [...ctx.selectedDrawingIds];
  if (ids.length < 2) return null;
  const groupId = generateId();
  for (const d of ctx.drawings) {
    if (ctx.selectedDrawingIds.has(d.id)) d._groupId = groupId;
  }
  ctx.emit();
  return groupId;
}

/** Ungroup drawings with a group ID */
export function ungroupDrawings(ctx, groupId) {
  for (const d of ctx.drawings) {
    if (d._groupId === groupId) delete d._groupId;
  }
  ctx.emit();
}

/** Select all drawings in a group */
export function selectGroup(ctx, groupId) {
  for (const d of ctx.drawings) {
    if (d._groupId === groupId && d.visible) {
      ctx.selectedDrawingIds.add(d.id);
      d.state = 'selected';
    }
  }
  ctx.emit();
}

// ── Bulk Operations ──────────────────────────────────────────────

/** Bulk move all selected drawings by pixel offset */
export function bulkMove(ctx, dx, dy) {
  // BUG-12: Bail if coordinate converters aren't ready
  if (!ctx.anchorToPixel || !ctx.pixelToAnchor) return;
  const ids = ctx.selectedDrawingIds.size > 0 ? ctx.selectedDrawingIds : new Set();
  for (const d of ctx.drawings) {
    if (!ids.has(d.id)) continue;
    d.points = d.points.map(pt => {
      const px = ctx.anchorToPixel(pt);
      if (!px) return pt;
      return ctx.pixelToAnchor(px.x + dx, px.y + dy);
    });
  }
  ctx.emit();
}

/** Set label on a drawing */
export function setDrawingLabel(ctx, id, label) {
  const d = ctx.drawings.find(d => d.id === id);
  if (d) {
    if (!d.meta) d.meta = {};
    d.meta.label = label;
    ctx.emit();
  }
}

/** Toggle cross-timeframe sync */
export function toggleSyncAcrossTimeframes(ctx, id) {
  const d = ctx.drawings.find(d => d.id === id);
  if (d) {
    d.syncAcrossTimeframes = !d.syncAcrossTimeframes;
    ctx.emit();
  }
}
