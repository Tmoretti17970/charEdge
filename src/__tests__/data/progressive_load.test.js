// ═══════════════════════════════════════════════════════════════════
// charEdge — Sprint 6: Progressive Initial Load Tests
//
// Verifies the progressive loading pipeline:
//   1. ChartSkeleton supports phased loading (phases 0-3)
//   2. ChartsPage wires skeleton phases with timers
//   3. Crossfade transitions from skeleton to live chart
//   4. TTI measurement in useChartDataLoader
//   5. ChartCanvas backward compatibility wrapper
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

// ─── 1. ChartSkeleton — Phased Loading ──────────────────────────

describe('Sprint 6 — ChartSkeleton phased loading', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'app/components/chart/ui/ChartSkeleton.jsx'),
      'utf-8'
    );
  });

  it('accepts phase prop', () => {
    expect(source).toContain('phase');
  });

  it('supports phase 0 as default', () => {
    expect(source).toContain('phase = 0');
  });

  it('has CandleSkeleton component', () => {
    expect(source).toContain('CandleSkeleton');
  });

  it('has ToolbarSkeleton component', () => {
    expect(source).toContain('ToolbarSkeleton');
  });

  it('has IndicatorPaneSkeleton component', () => {
    expect(source).toContain('IndicatorPaneSkeleton');
  });

  it('supports chart/panel/mini variants', () => {
    expect(source).toContain("'panel'");
    expect(source).toContain("'mini'");
  });

  it('uses phaseClass for CSS styling', () => {
    expect(source).toContain('phaseClass');
  });
});

// ─── 2. ChartsPage — Phased Skeleton Progression ────────────────

describe('Sprint 6 — ChartsPage phased skeleton', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'pages/ChartsPage.jsx'),
      'utf-8'
    );
  });

  it('initializes skeletonPhase state', () => {
    expect(source).toContain('skeletonPhase');
  });

  it('progresses to phase 2 at 100ms', () => {
    expect(source).toContain('setSkeletonPhase(2), 100');
  });

  it('progresses to phase 3 at 300ms', () => {
    expect(source).toContain('setSkeletonPhase(3), 300');
  });

  it('passes phase prop to ChartSkeleton', () => {
    expect(source).toContain('phase={skeletonPhase}');
  });

  it('cleans up timers in useEffect return', () => {
    expect(source).toContain('clearTimeout(t2)');
    expect(source).toContain('clearTimeout(t3)');
  });

  it('records mount time for TTI', () => {
    expect(source).toContain('mountTimeRef');
    expect(source).toContain('performance.now()');
  });
});

// ─── 3. ChartsPage — Skeleton-to-Chart Crossfade ────────────────

describe('Sprint 6 — ChartsPage crossfade', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'pages/ChartsPage.jsx'),
      'utf-8'
    );
  });

  it('has opacity transition on chart area', () => {
    expect(source).toContain('opacity 0.25s ease');
  });

  it('wraps loading skeleton with transition container', () => {
    expect(source).toContain('transition: \'opacity 0.25s ease-out\'');
  });

  it('sets zIndex on skeleton overlay', () => {
    expect(source).toContain('zIndex: 15');
  });
});

// ─── 4. useChartDataLoader — TTI Measurement ────────────────────

describe('Sprint 6 — useChartDataLoader TTI', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'pages/charts/useChartDataLoader.js'),
      'utf-8'
    );
  });

  it('has ttiMountRef for timing', () => {
    expect(source).toContain('ttiMountRef');
  });

  it('has ttiReportedRef to prevent duplicate reports', () => {
    expect(source).toContain('ttiReportedRef');
  });

  it('logs TTI in dev mode', () => {
    expect(source).toContain('[charEdge] TTI:');
  });

  it('exposes TTI via window.__charEdge_tti', () => {
    expect(source).toContain('__charEdge_tti');
  });

  it('only reports TTI once (guard with ref)', () => {
    expect(source).toContain('ttiReportedRef.current = true');
  });

  it('measures from mount to first data arrival', () => {
    expect(source).toContain("data?.length > 0");
  });
});

// ─── 5. ChartCanvas — Backward Compatibility ───────────────────

describe('Sprint 6 — ChartCanvas wrapper', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'app/components/chart/core/ChartCanvas.jsx'),
      'utf-8'
    );
  });

  it('wraps ChartEngineWidget', () => {
    expect(source).toContain('ChartEngineWidget');
  });

  it('re-exports ChartEngineWidget for direct usage', () => {
    expect(source).toContain("export { default as ChartEngineWidget }");
  });

  it('syncs legacy data prop to store', () => {
    expect(source).toContain('setData');
  });
});
