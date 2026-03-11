// ═══════════════════════════════════════════════════════════════════
// charEdge — Columnar Storage & DirtyRegion Tests
// Sprint 18 verification
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  barsToColumns,
  columnsToBars,
  appendToColumns,
  sliceColumns,
  createEmptyColumns,
  columnarByteSize,
} from '../../data/engine/storage/ColumnarStorage';
import { DirtyRegion } from '../../charting_library/scene/DirtyRegion.js';

// ─── Test Data ──────────────────────────────────────────────────

const BARS = [
  { t: 1000, o: 100, h: 110, l: 90, c: 105, v: 500 },
  { t: 2000, o: 105, h: 115, l: 95, c: 110, v: 600 },
  { t: 3000, o: 110, h: 120, l: 100, c: 115, v: 700 },
  { t: 4000, o: 115, h: 125, l: 105, c: 120, v: 800 },
  { t: 5000, o: 120, h: 130, l: 110, c: 125, v: 900 },
];

// ─── Columnar Storage Tests ─────────────────────────────────────

describe('ColumnarStorage: barsToColumns', () => {
  it('converts bars to columnar format', () => {
    const cols = barsToColumns(BARS);
    expect(cols.length).toBe(5);
    expect(cols.t[0]).toBe(1000);
    expect(cols.t[4]).toBe(5000);
    expect(cols.c[2]).toBeCloseTo(115, 0);
    expect(cols.v[3]).toBeCloseTo(800, 0);
  });

  it('creates correct typed array types', () => {
    const cols = barsToColumns(BARS);
    expect(cols.t).toBeInstanceOf(Float64Array);
    expect(cols.c).toBeInstanceOf(Float64Array);
    expect(cols.o).toBeInstanceOf(Float32Array);
    expect(cols.h).toBeInstanceOf(Float32Array);
    expect(cols.l).toBeInstanceOf(Float32Array);
    expect(cols.v).toBeInstanceOf(Float32Array);
  });

  it('handles empty input', () => {
    const cols = barsToColumns([]);
    expect(cols.length).toBe(0);
    expect(cols.t.length).toBe(0);
  });
});

describe('ColumnarStorage: columnsToBars', () => {
  it('round-trips bars → columns → bars', () => {
    const cols = barsToColumns(BARS);
    const restored = columnsToBars(cols);
    expect(restored.length).toBe(BARS.length);

    for (let i = 0; i < BARS.length; i++) {
      expect(restored[i].t).toBe(BARS[i].t);
      expect(restored[i].c).toBeCloseTo(BARS[i].c, 0);
      expect(restored[i].v).toBeCloseTo(BARS[i].v, 0);
    }
  });
});

describe('ColumnarStorage: appendToColumns', () => {
  it('appends a bar to existing columns', () => {
    const cols = barsToColumns(BARS.slice(0, 3));
    const newBar = BARS[3];
    const result = appendToColumns(cols, newBar);
    expect(result.length).toBe(4);
    expect(result.t[3]).toBe(4000);
    expect(result.c[3]).toBeCloseTo(120, 0);
  });
});

describe('ColumnarStorage: sliceColumns', () => {
  it('slices a range of columns', () => {
    const cols = barsToColumns(BARS);
    const sliced = sliceColumns(cols, 1, 4);
    expect(sliced.length).toBe(3);
    expect(sliced.t[0]).toBe(2000);
    expect(sliced.t[2]).toBe(4000);
  });

  it('handles out-of-bounds gracefully', () => {
    const cols = barsToColumns(BARS);
    const sliced = sliceColumns(cols, -5, 100);
    expect(sliced.length).toBe(5);
  });
});

describe('ColumnarStorage: createEmptyColumns', () => {
  it('creates empty columns with capacity', () => {
    const cols = createEmptyColumns(100);
    expect(cols.length).toBe(0);
    expect(cols.t.length).toBe(100);
  });
});

describe('ColumnarStorage: columnarByteSize', () => {
  it('calculates correct byte size', () => {
    const cols = barsToColumns(BARS);
    const size = columnarByteSize(cols);
    // 5 bars × (8+4+4+4+8+4) = 5 × 32 = 160 bytes
    expect(size).toBe(160);
  });
});

// ─── DirtyRegion Tests ──────────────────────────────────────────

describe('DirtyRegion: disjoint rects', () => {
  it('stores a single rect', () => {
    const dr = new DirtyRegion();
    dr.addRect('main', { x: 0, y: 0, w: 100, h: 50 });
    expect(dr.hasDirty('main')).toBe(true);
    expect(dr.getRegions('main').length).toBe(1);
  });

  it('keeps non-overlapping rects separate', () => {
    const dr = new DirtyRegion();
    dr.addRect('main', { x: 0, y: 0, w: 50, h: 50 });
    dr.addRect('main', { x: 200, y: 200, w: 50, h: 50 });
    expect(dr.getRegions('main').length).toBe(2);
  });

  it('merges overlapping rects', () => {
    const dr = new DirtyRegion();
    dr.addRect('main', { x: 0, y: 0, w: 100, h: 50 });
    dr.addRect('main', { x: 50, y: 0, w: 100, h: 50 });
    expect(dr.getRegions('main').length).toBe(1);
    expect(dr.getRegions('main')[0].w).toBe(150);
  });

  it('compacts when over MAX_RECTS (8)', () => {
    const dr = new DirtyRegion();
    for (let i = 0; i < 10; i++) {
      dr.addRect('main', { x: i * 100, y: 0, w: 10, h: 10 });
    }
    // Should have compacted down to <= 8
    expect(dr.getRegions('main').length).toBeLessThanOrEqual(8);
  });

  it('getRegion() returns merged bounding box (backwards compat)', () => {
    const dr = new DirtyRegion();
    dr.addRect('main', { x: 0, y: 0, w: 50, h: 50 });
    dr.addRect('main', { x: 200, y: 200, w: 50, h: 50 });
    const merged = dr.getRegion('main');
    expect(merged).not.toBeNull();
    expect(merged.x).toBe(0);
    expect(merged.y).toBe(0);
    expect(merged.w).toBe(250);
    expect(merged.h).toBe(250);
  });

  it('intersects() checks per-rect overlap', () => {
    const dr = new DirtyRegion();
    dr.addRect('main', { x: 0, y: 0, w: 50, h: 50 });
    dr.addRect('main', { x: 200, y: 200, w: 50, h: 50 });
    expect(dr.intersects('main', { x: 10, y: 10, w: 10, h: 10 })).toBe(true);
    expect(dr.intersects('main', { x: 100, y: 100, w: 10, h: 10 })).toBe(false);
    expect(dr.intersects('main', { x: 210, y: 210, w: 10, h: 10 })).toBe(true);
  });

  it('clear() removes all dirty regions', () => {
    const dr = new DirtyRegion();
    dr.addRect('main', { x: 0, y: 0, w: 50, h: 50 });
    dr.addRect('ui', { x: 0, y: 0, w: 50, h: 50 });
    dr.clear();
    expect(dr.hasDirty('main')).toBe(false);
    expect(dr.hasDirty('ui')).toBe(false);
  });

  it('clearLayer() removes only one layer', () => {
    const dr = new DirtyRegion();
    dr.addRect('main', { x: 0, y: 0, w: 50, h: 50 });
    dr.addRect('ui', { x: 0, y: 0, w: 50, h: 50 });
    dr.clearLayer('main');
    expect(dr.hasDirty('main')).toBe(false);
    expect(dr.hasDirty('ui')).toBe(true);
  });

  it('skips zero-size rects', () => {
    const dr = new DirtyRegion();
    dr.addRect('main', { x: 0, y: 0, w: 0, h: 0 });
    expect(dr.hasDirty('main')).toBe(false);
  });

  it('getRegions() returns empty array for unknown layer', () => {
    const dr = new DirtyRegion();
    expect(dr.getRegions('unknown').length).toBe(0);
  });
});
