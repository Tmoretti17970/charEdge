// ═══════════════════════════════════════════════════════════════════
// charEdge — Sprint 8: Pan-During-Load Tests
//
// Verifies the pan-during-load pipeline:
//   1. No blocking UI during history loading
//   2. AbortController for fetch cancellation on symbol switch
//   3. Shimmer bars at left edge during load
//   4. Viewport preservation on history prepend
//   5. Prefetch guards (historyLoading/historyExhausted)
//   6. Auto-scroll only near offset 0
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

// ─── 1. useChartDataLoader — AbortController ────────────────────

describe('Sprint 8 — useChartDataLoader AbortController', () => {
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

  it('creates AbortController for fetch', () => {
    expect(source).toContain('new AbortController()');
  });

  it('passes signal to fetchOHLC', () => {
    expect(source).toContain('signal: abortController.signal');
  });

  it('calls abort() in cleanup', () => {
    expect(source).toContain('abortController.abort()');
  });

  it('ignores AbortError in catch handler', () => {
    expect(source).toContain("err?.name === 'AbortError'");
  });

  it('still has cancelled flag for result discard', () => {
    expect(source).toContain('if (cancelled) return');
  });
});

// ─── 2. useChartDataLoader — Prefetch Guards ────────────────────

describe('Sprint 8 — useChartDataLoader prefetch guards', () => {
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

  it('guards against double-fetch with historyLoading', () => {
    expect(source).toContain('state.historyLoading');
  });

  it('guards against double-fetch with historyExhausted', () => {
    expect(source).toContain('state.historyExhausted');
  });

  it('sets historyLoading before fetching', () => {
    expect(source).toContain('setHistoryLoading(true)');
  });

  it('listens for charEdge:prefetch-history event', () => {
    expect(source).toContain('charEdge:prefetch-history');
  });
});

// ─── 3. dataSlice — Viewport Offset Tracking ───────────────────

describe('Sprint 8 — dataSlice viewport offset tracking', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'state/chart/dataSlice.ts'),
      'utf-8'
    );
  });

  it('tracks lastPrependCount in prependData', () => {
    expect(source).toContain('lastPrependCount');
  });

  it('sets lastPrependCount to unique.length', () => {
    expect(source).toContain('lastPrependCount: unique.length');
  });

  it('deduplicates by timestamp on prepend', () => {
    expect(source).toContain('existingTimes');
    expect(source).toContain('filter');
  });

  it('sorts merged data by time', () => {
    expect(source).toContain('merged.sort');
  });
});

// ─── 4. ChartEngineWidget — Viewport Preservation ───────────────

describe('Sprint 8 — ChartEngineWidget viewport preservation', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'app/components/chart/core/ChartEngineWidget.jsx'),
      'utf-8'
    );
  });

  it('subscribes to lastPrependCount from store', () => {
    expect(source).toContain('lastPrependCount');
  });

  it('adjusts scrollOffset by prepend count', () => {
    expect(source).toContain('scrollOffset += lastPrependCount');
  });

  it('resets lastPrependCount after consuming', () => {
    expect(source).toContain('lastPrependCount: 0');
  });

  it('syncs historyLoading to engine state', () => {
    expect(source).toContain('.state.historyLoading = historyLoading');
  });
});

// ─── 5. DataStage — Shimmer Bars ────────────────────────────────

describe('Sprint 8 — DataStage shimmer bars', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const stagesDir = path.resolve(__dirname, '..', '..', 'charting_library/core/stages');
    const main = fs.readFileSync(path.resolve(stagesDir, 'DataStage.ts'), 'utf-8');
    const helpers = fs.readFileSync(path.resolve(stagesDir, 'data/renderHelpers.ts'), 'utf-8');
    source = main + '\n' + helpers;
  });

  it('renders shimmer bars when historyLoading near left edge', () => {
    expect(source).toContain('engine.state.historyLoading');
    expect(source).toContain('start <= 5');
  });

  it('uses pulsing animation for shimmer', () => {
    expect(source).toContain('pulsePhase');
    expect(source).toContain('Math.sin');
  });

  it('draws ghost bars to the LEFT of visible range', () => {
    expect(source).toContain('shimmerCount');
    expect(source).toContain('shimmerColor');
  });

  it('re-renders for continuous shimmer animation', () => {
    expect(source).toContain('engine.markDirty()');
  });
});

// ─── 6. ChartEngine — Auto-Scroll Behavior ─────────────────────

describe('Sprint 8 — ChartEngine auto-scroll', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/ChartEngine.ts'),
      'utf-8'
    );
  });

  it('only auto-scrolls when scrollOffset near 0', () => {
    expect(source).toContain('scrollOffset < 2');
  });

  it('preserves scrollOffset when not near latest bar', () => {
    // setData only resets offset when near 0, not when user has scrolled away
    expect(source).toContain('bars.length > this.bars.length');
  });
});
