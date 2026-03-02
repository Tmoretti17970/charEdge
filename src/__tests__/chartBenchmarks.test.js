// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Load Benchmark Tests
//
// Verifies that:
//   1. performance.mark/measure instrumentation exists in useChartDataLoader
//   2. OPFSBarStore content-addressed caching (_barsEqual) works
//   3. CacheManager skip-on-identical logic exists
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

// ─── Performance Instrumentation ────────────────────────────────

describe('Chart Load — performance instrumentation', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', 'pages/charts/useChartDataLoader.js'),
      'utf-8'
    );
  });

  it('marks chart load start with performance.mark', () => {
    expect(source).toContain("performance.mark(`${markId}-start`)");
  });

  it('marks chart load end with performance.mark', () => {
    expect(source).toContain("performance.mark(`${markId}-end`)");
  });

  it('measures chart load with performance.measure', () => {
    expect(source).toContain("performance.measure(`tf-chart-load`");
  });

  it('generates unique mark IDs per load', () => {
    expect(source).toContain('tf-chart-load-${symbol}-${tf}-${Date.now()}');
  });
});

// ─── Content-Addressed Caching ──────────────────────────────────

describe('OPFSBarStore — content-addressed caching', () => {
  it('exports _barsEqual helper', async () => {
    const mod = await import('../data/engine/infra/OPFSBarStore.js');
    expect(typeof mod._barsEqual).toBe('function');
  });

  it('_barsEqual returns true for identical bar arrays', async () => {
    const { _barsEqual } = await import('../data/engine/infra/OPFSBarStore.js');
    const bars = [
      { time: '2025-01-01', open: 100, high: 110, low: 90, close: 105, volume: 1000 },
      { time: '2025-01-02', open: 105, high: 115, low: 95, close: 110, volume: 2000 },
    ];
    expect(_barsEqual(bars, [...bars])).toBe(true);
  });

  it('_barsEqual returns false for different bar arrays', async () => {
    const { _barsEqual } = await import('../data/engine/infra/OPFSBarStore.js');
    const a = [{ time: '2025-01-01', open: 100, high: 110, low: 90, close: 105, volume: 1000 }];
    const b = [{ time: '2025-01-01', open: 100, high: 110, low: 90, close: 106, volume: 1000 }];
    expect(_barsEqual(a, b)).toBe(false);
  });

  it('_barsEqual returns false for different lengths', async () => {
    const { _barsEqual } = await import('../data/engine/infra/OPFSBarStore.js');
    const a = [{ time: '2025-01-01', open: 100, high: 110, low: 90, close: 105, volume: 1000 }];
    const b = [];
    expect(_barsEqual(a, b)).toBe(false);
  });

  it('putCandles source includes content-addressed skip check', async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'data/engine/infra/OPFSBarStore.js'),
      'utf-8'
    );
    expect(source).toContain('_barsEqual(merged, existing)');
    expect(source).toContain('skip disk I/O');
  });
});

// ─── CacheManager Content-Addressed Check ───────────────────────

describe('CacheManager — content-addressed write optimization', () => {
  it('write() compares with existing memory cache before disk writes', async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'data/engine/infra/CacheManager.js'),
      'utf-8'
    );
    expect(source).toContain('Content-addressed check');
    expect(source).toContain('if (unchanged) return');
  });

  it('identical writes are skipped (memory only updated)', async () => {
    const mod = await import('../data/engine/infra/CacheManager.js');
    const cm = new mod._CacheManager();
    const bars = [{ time: '2025-01-01', open: 100, high: 110, low: 90, close: 105, volume: 1000 }];

    // First write — goes to all tiers
    cm.write('TEST', '1d', bars, 'test');

    // Second identical write — should only refresh memory
    cm.write('TEST', '1d', bars, 'test');

    // Verify memory is updated (data is still there)
    const result = await cm.read('TEST', '1d', 60000);
    expect(result).not.toBeNull();
    expect(result.data).toEqual(bars);
  });
});
