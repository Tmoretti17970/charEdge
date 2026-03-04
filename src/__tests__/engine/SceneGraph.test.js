import { describe, it, expect, beforeEach } from 'vitest';
import { RenderNode, DrawingNode, CrosshairNode, IndicatorNode, pointInRect, rectsOverlap } from '../../charting_library/scene/RenderNode.js';
import { SceneGraph } from '../../charting_library/scene/SceneGraph.js';
import { SpatialIndex } from '../../charting_library/scene/SpatialIndex.js';
import { DirtyRegion } from '../../charting_library/scene/DirtyRegion.js';

// ═══════════════════════════════════════════════════════════════════
// RenderNode Tests
// ═══════════════════════════════════════════════════════════════════

describe('RenderNode', () => {
  it('should create with auto-generated ID', () => {
    const n1 = new RenderNode();
    const n2 = new RenderNode();
    expect(n1.id).toBeTruthy();
    expect(n2.id).not.toBe(n1.id);
  });

  it('should accept custom options', () => {
    const node = new RenderNode({ id: 'test', type: 'custom', zIndex: 5, layer: 'UI' });
    expect(node.id).toBe('test');
    expect(node.type).toBe('custom');
    expect(node.zIndex).toBe(5);
    expect(node.layer).toBe('UI');
    expect(node.visible).toBe(true);
    expect(node.dirty).toBe(true);
  });

  it('should default to visible=true', () => {
    expect(new RenderNode().visible).toBe(true);
    expect(new RenderNode({ visible: false }).visible).toBe(false);
  });

  it('markDirty should propagate to parent', () => {
    const parent = new RenderNode({ id: 'parent' });
    const child = new RenderNode({ id: 'child' });
    parent.addChild(child);
    parent.dirty = false;
    child.dirty = false;

    child.markDirty();
    expect(child.dirty).toBe(true);
    expect(parent.dirty).toBe(true);
  });

  it('addChild and removeChild should work', () => {
    const parent = new RenderNode({ id: 'p' });
    const child = new RenderNode({ id: 'c' });
    parent.addChild(child);
    expect(parent.children).toContain(child);
    expect(child.parent).toBe(parent);

    parent.removeChild(child);
    expect(parent.children).not.toContain(child);
    expect(child.parent).toBeNull();
  });

  it('addChild should reparent from old parent', () => {
    const p1 = new RenderNode({ id: 'p1' });
    const p2 = new RenderNode({ id: 'p2' });
    const child = new RenderNode({ id: 'c' });
    p1.addChild(child);
    expect(p1.children).toContain(child);

    p2.addChild(child);
    expect(p1.children).not.toContain(child);
    expect(p2.children).toContain(child);
    expect(child.parent).toBe(p2);
  });

  it('traverse should visit all descendants', () => {
    const root = new RenderNode({ id: 'root' });
    const a = new RenderNode({ id: 'a' });
    const b = new RenderNode({ id: 'b' });
    const c = new RenderNode({ id: 'c' });
    root.addChild(a);
    root.addChild(b);
    a.addChild(c);

    const visited = [];
    root.traverse(n => visited.push(n.id));
    expect(visited).toEqual(['root', 'a', 'c', 'b']);
  });

  it('hitTest should use bounds by default', () => {
    const node = new RenderNode();
    node.bounds = { x: 10, y: 10, w: 50, h: 50 };
    expect(node.hitTest(25, 25)).toBe(true);
    expect(node.hitTest(5, 5)).toBe(false);
    expect(node.hitTest(65, 65)).toBe(false);
  });

  it('hitTest should use custom function if provided', () => {
    const node = new RenderNode({ hitTestFn: (x, y) => x === 42 });
    expect(node.hitTest(42, 0)).toBe(true);
    expect(node.hitTest(41, 0)).toBe(false);
  });

  it('draw should use custom function if provided', () => {
    let called = false;
    const node = new RenderNode({ drawFn: () => { called = true; } });
    node.draw(null, null);
    expect(called).toBe(true);
  });
});

describe('DrawingNode', () => {
  it('should set type to drawing and layer to DRAWINGS', () => {
    const node = new DrawingNode({ id: 'drw1', zIndex: 3 });
    expect(node.type).toBe('drawing');
    expect(node.layer).toBe('DRAWINGS');
    expect(node.data).toEqual({ id: 'drw1', zIndex: 3 });
  });
});

describe('CrosshairNode', () => {
  it('should have fixed id and high z-index', () => {
    const node = new CrosshairNode();
    expect(node.id).toBe('crosshair');
    expect(node.type).toBe('crosshair');
    expect(node.zIndex).toBe(100);
  });
});

describe('IndicatorNode', () => {
  it('should set type to indicator and layer to INDICATORS', () => {
    const node = new IndicatorNode({ id: 'sma20', shortName: 'SMA', zIndex: 1 });
    expect(node.type).toBe('indicator');
    expect(node.layer).toBe('INDICATORS');
    expect(node.data).toEqual({ id: 'sma20', shortName: 'SMA', zIndex: 1 });
  });

  it('should be queryable via scene graph after adding with bounds', () => {
    const sg = new SceneGraph(800, 600);
    const node = new IndicatorNode({ id: 'ema50', shortName: 'EMA' });
    sg.addNode(node);
    node.updateBounds({ x: 0, y: 0, w: 800, h: 400 });
    const results = sg.queryPoint(100, 200);
    expect(results.some(n => n.type === 'indicator')).toBe(true);
  });

  it('should be removable without affecting other nodes', () => {
    const sg = new SceneGraph(800, 600);
    const ind = new IndicatorNode({ id: 'rsi', shortName: 'RSI' });
    const drw = new DrawingNode({ id: 'drw1' });
    sg.addNode(ind);
    sg.addNode(drw);
    expect(sg.size).toBe(2);
    sg.removeNode(`ind_${ind.data.id || ind.data.shortName}`);
    expect(sg.size).toBe(1);
    expect(sg.hasNode('drw_drw1')).toBe(true);
  });
});

describe('pointInRect / rectsOverlap', () => {
  it('pointInRect should work', () => {
    const r = { x: 10, y: 10, w: 50, h: 50 };
    expect(pointInRect(10, 10, r)).toBe(true);
    expect(pointInRect(60, 60, r)).toBe(true);
    expect(pointInRect(9, 10, r)).toBe(false);
    expect(pointInRect(61, 60, r)).toBe(false);
  });

  it('rectsOverlap should detect overlapping rects', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 11, y: 0, w: 5, h: 5 })).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SpatialIndex Tests
// ═══════════════════════════════════════════════════════════════════

describe('SpatialIndex', () => {
  let idx;

  beforeEach(() => {
    idx = new SpatialIndex(800, 600, 64);
  });

  it('should insert and query a node', () => {
    const node = new RenderNode({ id: 'n1' });
    node.bounds = { x: 100, y: 100, w: 50, h: 50 };
    idx.insert(node);
    expect(idx.size).toBe(1);

    const results = idx.queryPoint(120, 120);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('n1');
  });

  it('should NOT return node outside bounds', () => {
    const node = new RenderNode({ id: 'n1' });
    node.bounds = { x: 100, y: 100, w: 50, h: 50 };
    idx.insert(node);

    expect(idx.queryPoint(0, 0).length).toBe(0);
    expect(idx.queryPoint(200, 200).length).toBe(0);
  });

  it('should remove a node', () => {
    const node = new RenderNode({ id: 'n1' });
    node.bounds = { x: 100, y: 100, w: 50, h: 50 };
    idx.insert(node);
    idx.remove('n1');
    expect(idx.size).toBe(0);
    expect(idx.queryPoint(120, 120).length).toBe(0);
  });

  it('queryRect should find overlapping nodes', () => {
    const n1 = new RenderNode({ id: 'a' });
    n1.bounds = { x: 10, y: 10, w: 30, h: 30 };
    const n2 = new RenderNode({ id: 'b' });
    n2.bounds = { x: 50, y: 50, w: 30, h: 30 };
    idx.insert(n1);
    idx.insert(n2);

    const r1 = idx.queryRect({ x: 0, y: 0, w: 45, h: 45 });
    expect(r1.length).toBe(1);
    expect(r1[0].id).toBe('a');

    const rAll = idx.queryRect({ x: 0, y: 0, w: 100, h: 100 });
    expect(rAll.length).toBe(2);
  });

  it('should sort results by z-index descending', () => {
    const n1 = new RenderNode({ id: 'low', zIndex: 1 });
    n1.bounds = { x: 10, y: 10, w: 50, h: 50 };
    const n2 = new RenderNode({ id: 'high', zIndex: 10 });
    n2.bounds = { x: 10, y: 10, w: 50, h: 50 };
    idx.insert(n1);
    idx.insert(n2);

    const results = idx.queryPoint(25, 25);
    expect(results[0].id).toBe('high');
    expect(results[1].id).toBe('low');
  });

  it('resize should re-index all nodes', () => {
    const node = new RenderNode({ id: 'n1' });
    node.bounds = { x: 10, y: 10, w: 20, h: 20 };
    idx.insert(node);

    idx.resize(400, 300);
    const results = idx.queryPoint(15, 15);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('n1');
  });

  it('clear should empty everything', () => {
    const node = new RenderNode({ id: 'n1' });
    node.bounds = { x: 10, y: 10, w: 20, h: 20 };
    idx.insert(node);
    idx.clear();
    expect(idx.size).toBe(0);
    expect(idx.queryPoint(15, 15).length).toBe(0);
  });

  it('should handle invisible nodes', () => {
    const node = new RenderNode({ id: 'invisible', visible: false });
    node.bounds = { x: 10, y: 10, w: 50, h: 50 };
    idx.insert(node);
    expect(idx.queryPoint(25, 25).length).toBe(0);
  });

  it('should handle out-of-bounds queries gracefully', () => {
    expect(idx.queryPoint(-10, -10).length).toBe(0);
    expect(idx.queryPoint(10000, 10000).length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// DirtyRegion Tests
// ═══════════════════════════════════════════════════════════════════

describe('DirtyRegion', () => {
  let dr;

  beforeEach(() => {
    dr = new DirtyRegion();
  });

  it('should start with no dirty regions', () => {
    expect(dr.hasDirty('UI')).toBe(false);
    expect(dr.getRegion('UI')).toBeNull();
  });

  it('addRect should register a dirty area', () => {
    dr.addRect('UI', { x: 10, y: 10, w: 50, h: 50 });
    expect(dr.hasDirty('UI')).toBe(true);
    expect(dr.getRegion('UI')).toEqual({ x: 10, y: 10, w: 50, h: 50 });
  });

  it('should merge overlapping rects into bounding box', () => {
    dr.addRect('UI', { x: 10, y: 10, w: 50, h: 50 });
    dr.addRect('UI', { x: 40, y: 40, w: 50, h: 50 });
    const r = dr.getRegion('UI');
    expect(r.x).toBe(10);
    expect(r.y).toBe(10);
    expect(r.w).toBe(80); // 40+50 - 10 = 80
    expect(r.h).toBe(80);
  });

  it('should track layers independently', () => {
    dr.addRect('UI', { x: 10, y: 10, w: 50, h: 50 });
    dr.addRect('DATA', { x: 100, y: 100, w: 20, h: 20 });
    expect(dr.hasDirty('UI')).toBe(true);
    expect(dr.hasDirty('DATA')).toBe(true);
    expect(dr.hasDirty('GRID')).toBe(false);
  });

  it('clear should reset all regions', () => {
    dr.addRect('UI', { x: 10, y: 10, w: 50, h: 50 });
    dr.addRect('DATA', { x: 10, y: 10, w: 50, h: 50 });
    dr.clear();
    expect(dr.hasDirty('UI')).toBe(false);
    expect(dr.hasDirty('DATA')).toBe(false);
  });

  it('clearLayer should reset only one layer', () => {
    dr.addRect('UI', { x: 10, y: 10, w: 50, h: 50 });
    dr.addRect('DATA', { x: 10, y: 10, w: 50, h: 50 });
    dr.clearLayer('UI');
    expect(dr.hasDirty('UI')).toBe(false);
    expect(dr.hasDirty('DATA')).toBe(true);
  });

  it('getDirtyLayers should return all dirty layer names', () => {
    dr.addRect('UI', { x: 0, y: 0, w: 10, h: 10 });
    dr.addRect('DATA', { x: 0, y: 0, w: 10, h: 10 });
    const layers = dr.getDirtyLayers();
    expect(layers).toContain('UI');
    expect(layers).toContain('DATA');
    expect(layers.length).toBe(2);
  });

  it('should ignore zero-size rects', () => {
    dr.addRect('UI', { x: 10, y: 10, w: 0, h: 50 });
    expect(dr.hasDirty('UI')).toBe(false);
    dr.addRect('UI', { x: 10, y: 10, w: 50, h: 0 });
    expect(dr.hasDirty('UI')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SceneGraph Tests
// ═══════════════════════════════════════════════════════════════════

describe('SceneGraph', () => {
  let sg;

  beforeEach(() => {
    sg = new SceneGraph(800, 600);
  });

  it('should start with just the root node', () => {
    expect(sg.size).toBe(0);
    expect(sg.root).toBeTruthy();
    expect(sg.root.id).toBe('__root__');
  });

  it('addNode should add to root by default', () => {
    const node = new RenderNode({ id: 'n1' });
    sg.addNode(node);
    expect(sg.size).toBe(1);
    expect(sg.getNode('n1')).toBe(node);
    expect(node.parent).toBe(sg.root);
  });

  it('addNode should add to specified parent', () => {
    const parent = new RenderNode({ id: 'parent' });
    const child = new RenderNode({ id: 'child' });
    sg.addNode(parent);
    sg.addNode(child, 'parent');
    expect(child.parent).toBe(parent);
    expect(sg.size).toBe(2);
  });

  it('removeNode should remove a node and its descendants', () => {
    const parent = new RenderNode({ id: 'p' });
    const child = new RenderNode({ id: 'c' });
    sg.addNode(parent);
    sg.addNode(child, 'p');
    expect(sg.size).toBe(2);

    sg.removeNode('p');
    expect(sg.size).toBe(0);
    expect(sg.getNode('p')).toBeUndefined();
    expect(sg.getNode('c')).toBeUndefined();
  });

  it('removeNode should not remove root', () => {
    expect(sg.removeNode('__root__')).toBe(false);
    expect(sg.root).toBeTruthy();
  });

  it('queryPoint should find nodes via spatial index', () => {
    const node = new RenderNode({ id: 'n1' });
    sg.addNode(node);
    node.updateBounds({ x: 100, y: 100, w: 50, h: 50 });

    const results = sg.queryPoint(120, 120);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('n1');
    expect(sg.queryPoint(0, 0).length).toBe(0);
  });

  it('getDirtyNodes should return dirty nodes', () => {
    const n1 = new RenderNode({ id: 'n1' });
    const n2 = new RenderNode({ id: 'n2' });
    sg.addNode(n1);
    sg.addNode(n2);

    // Both start dirty (added to graph)
    const dirty = sg.getDirtyNodes();
    expect(dirty.length).toBe(2);
  });

  it('clearDirty should reset all dirty flags', () => {
    const node = new RenderNode({ id: 'n1' });
    sg.addNode(node);
    node.updateBounds({ x: 10, y: 10, w: 20, h: 20 });

    sg.clearDirty();
    expect(node.dirty).toBe(false);
    expect(sg.getDirtyNodes().length).toBe(0);
  });

  it('markDirty should re-track a node after clearDirty', () => {
    const node = new RenderNode({ id: 'n1' });
    sg.addNode(node);
    sg.clearDirty();
    expect(sg.getDirtyNodes().length).toBe(0);

    node.markDirty();
    expect(sg.getDirtyNodes().length).toBe(1);
    expect(sg.getDirtyNodes()[0].id).toBe('n1');
  });

  it('dirtyRegions should track bounds of dirty nodes', () => {
    const node = new RenderNode({ id: 'n1', layer: 'DRAWINGS' });
    sg.addNode(node);
    sg.clearDirty();

    node.updateBounds({ x: 50, y: 50, w: 100, h: 100 });
    expect(sg.dirtyRegions.hasDirty('DRAWINGS')).toBe(true);
    const region = sg.dirtyRegions.getRegion('DRAWINGS');
    expect(region).toBeTruthy();
  });

  it('rebuildSpatialIndex should re-index all nodes', () => {
    const node = new RenderNode({ id: 'n1' });
    sg.addNode(node);
    node.updateBounds({ x: 10, y: 10, w: 20, h: 20 });

    sg.rebuildSpatialIndex(1600, 900);
    const results = sg.queryPoint(15, 15);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('n1');
  });

  it('hasNode should work', () => {
    expect(sg.hasNode('nonexistent')).toBe(false);
    const node = new RenderNode({ id: 'exists' });
    sg.addNode(node);
    expect(sg.hasNode('exists')).toBe(true);
  });

  it('queryRect should work through scene graph', () => {
    const n1 = new RenderNode({ id: 'a' });
    const n2 = new RenderNode({ id: 'b' });
    sg.addNode(n1);
    sg.addNode(n2);
    n1.updateBounds({ x: 10, y: 10, w: 30, h: 30 });
    n2.updateBounds({ x: 200, y: 200, w: 30, h: 30 });

    const results = sg.queryRect({ x: 0, y: 0, w: 50, h: 50 });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('a');
  });
});
