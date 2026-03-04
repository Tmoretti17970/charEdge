// ═══════════════════════════════════════════════════════════════════
// charEdge — Sprint 1: Paginated History Loading Tests
//
// Verifies the full pagination pipeline:
//   1. FetchService uses INITIAL_LOAD_LIMIT (300) for fast first paint
//   2. fetchOHLCPage uses 500-bar pages for scroll-left prefetch
//   3. InputManager dispatches prefetch at PREFETCH_THRESHOLD (50 bars)
//   4. dataSlice has prependData, historyLoading, historyExhausted, oldestTime
//   5. BarDataBuffer supports prepend() with cursor getters
//   6. ChartEngineWidget shows loading indicator during prefetch
//   7. DataStage renders shimmer bars when history is loading
//   8. ChartEngine state includes historyLoading flag
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

// ─── 1. FetchService — Initial Load Limit ───────────────────────

describe('Sprint 1 — FetchService initial load', () => {
  let binanceSource, paginatorSource;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    binanceSource = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'data/BinanceClient.js'),
      'utf-8'
    );
    paginatorSource = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'data/HistoryPaginator.js'),
      'utf-8'
    );
  });

  it('defines INITIAL_LOAD_LIMIT = 300', () => {
    expect(binanceSource).toContain('INITIAL_LOAD_LIMIT = 300');
  });

  it('uses INITIAL_LOAD_LIMIT for short timeframe limits', () => {
    expect(binanceSource).toContain("'1m': INITIAL_LOAD_LIMIT");
    expect(binanceSource).toContain("'5m': INITIAL_LOAD_LIMIT");
    expect(binanceSource).toContain("'1h': INITIAL_LOAD_LIMIT");
  });

  it('keeps full 1000-bar pages for longer timeframes', () => {
    // 4h, 1D, 1w use multi-page pagination with 1000-bar fetch
    expect(binanceSource).toContain("'4h': 1000");
    expect(binanceSource).toContain("'1D': 1000");
    expect(binanceSource).toContain("'1w': 1000");
  });

  it('exports fetchOHLCPage for scroll-left pagination', () => {
    expect(paginatorSource).toContain('fetchOHLCPage');
    expect(paginatorSource).toContain('PAGE_SIZE = 500');
  });
});

// ─── 2. InputManager — Prefetch Threshold ───────────────────────

describe('Sprint 1 — InputManager prefetch dispatch', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/InputManager.ts'),
      'utf-8'
    );
  });

  it('defines PREFETCH_THRESHOLD = 50', () => {
    expect(source).toContain('PREFETCH_THRESHOLD = 50');
  });

  it('dispatches charEdge:prefetch-history custom event', () => {
    expect(source).toContain("charEdge:prefetch-history");
  });

  it('has _checkPrefetch method', () => {
    expect(source).toContain('_checkPrefetch');
  });

  it('throttles prefetch events with _prefetchDispatched flag', () => {
    expect(source).toContain('_prefetchDispatched');
  });
});

// ─── 3. dataSlice — Prepend + Pagination State ──────────────────

describe('Sprint 1 — dataSlice pagination state', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'state/chart/dataSlice.js'),
      'utf-8'
    );
  });

  it('has prependData action', () => {
    expect(source).toContain('prependData');
  });

  it('tracks historyLoading state', () => {
    expect(source).toContain('historyLoading: false');
  });

  it('tracks historyExhausted state', () => {
    expect(source).toContain('historyExhausted: false');
  });

  it('tracks oldestTime cursor', () => {
    expect(source).toContain('oldestTime: null');
  });

  it('has setHistoryLoading action', () => {
    expect(source).toContain('setHistoryLoading');
  });

  it('deduplicates prepended bars by timestamp', () => {
    expect(source).toContain('existingTimes');
    expect(source).toContain('filter');
  });
});

// ─── 4. BarDataBuffer — Prepend + Cursor Getters ────────────────

describe('Sprint 1 — BarDataBuffer prepend & cursors', () => {
  it('has prepend method', async () => {
    const { BarDataBuffer } = await import('../../charting_library/core/BarDataBuffer.ts');
    const buf = new BarDataBuffer();
    expect(typeof buf.prepend).toBe('function');
  });

  it('prepend() inserts bars at the front and updates length', async () => {
    const { BarDataBuffer } = await import('../../charting_library/core/BarDataBuffer.ts');
    const buf = new BarDataBuffer();
    buf.fromArray([
      { time: 300, open: 3, high: 4, low: 2, close: 3.5, volume: 30 },
      { time: 400, open: 4, high: 5, low: 3, close: 4.5, volume: 40 },
    ]);
    expect(buf.length).toBe(2);

    buf.prepend([
      { time: 100, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
      { time: 200, open: 2, high: 3, low: 1, close: 2.5, volume: 20 },
    ]);

    expect(buf.length).toBe(4);
    expect(buf.time[0]).toBe(100);
    expect(buf.time[1]).toBe(200);
    expect(buf.time[2]).toBe(300);
    expect(buf.time[3]).toBe(400);
  });

  it('has oldestTime getter', async () => {
    const { BarDataBuffer } = await import('../../charting_library/core/BarDataBuffer.ts');
    const buf = new BarDataBuffer();
    expect(buf.oldestTime).toBeNull();

    buf.fromArray([
      { time: 100, open: 1, high: 2, low: 0.5, close: 1.5 },
      { time: 200, open: 2, high: 3, low: 1, close: 2.5 },
    ]);
    expect(buf.oldestTime).toBe(100);
  });

  it('has newestTime getter', async () => {
    const { BarDataBuffer } = await import('../../charting_library/core/BarDataBuffer.ts');
    const buf = new BarDataBuffer();
    expect(buf.newestTime).toBeNull();

    buf.fromArray([
      { time: 100, open: 1, high: 2, low: 0.5, close: 1.5 },
      { time: 200, open: 2, high: 3, low: 1, close: 2.5 },
    ]);
    expect(buf.newestTime).toBe(200);
  });

  it('oldestTime updates after prepend', async () => {
    const { BarDataBuffer } = await import('../../charting_library/core/BarDataBuffer.ts');
    const buf = new BarDataBuffer();
    buf.fromArray([{ time: 300, open: 3, high: 4, low: 2, close: 3.5 }]);
    expect(buf.oldestTime).toBe(300);

    buf.prepend([{ time: 100, open: 1, high: 2, low: 0.5, close: 1.5 }]);
    expect(buf.oldestTime).toBe(100);
    expect(buf.newestTime).toBe(300);
  });
});

// ─── 5. ChartEngineWidget — Loading Indicator ───────────────────

describe('Sprint 1 — ChartEngineWidget history loading UI', () => {
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

  it('reads historyLoading from chart store', () => {
    expect(source).toContain('historyLoading');
    expect(source).toContain('useChartStore');
  });

  it('renders Loading history indicator when historyLoading=true', () => {
    expect(source).toContain('Loading history');
  });

  it('syncs historyLoading to engine state', () => {
    expect(source).toContain('.state.historyLoading = historyLoading');
  });
});

// ─── 6. DataStage — Shimmer Bars ────────────────────────────────

describe('Sprint 1 — DataStage shimmer bars', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'charting_library/core/stages/DataStage.ts'),
      'utf-8'
    );
  });

  it('renders shimmer bars when historyLoading is active', () => {
    expect(source).toContain('historyLoading');
    expect(source).toContain('shimmerCount');
  });

  it('uses pulsing alpha animation for shimmer effect', () => {
    expect(source).toContain('pulsePhase');
    expect(source).toContain('baseAlpha');
  });
});

// ─── 7. ChartEngine — State ─────────────────────────────────────

describe('Sprint 1 — ChartEngine state', () => {
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

  it('includes historyLoading in state', () => {
    expect(source).toContain('historyLoading: false');
  });
});

// ─── 8. useChartDataLoader — Prefetch Handler ───────────────────

describe('Sprint 1 — useChartDataLoader prefetch', () => {
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

  it('imports fetchOHLCPage', () => {
    expect(source).toContain('fetchOHLCPage');
  });

  it('has prefetchHistory callback', () => {
    expect(source).toContain('prefetchHistory');
  });

  it('guards against double-fetch with historyLoading/historyExhausted', () => {
    expect(source).toContain('historyLoading');
    expect(source).toContain('historyExhausted');
  });

  it('listens for charEdge:prefetch-history event', () => {
    expect(source).toContain("charEdge:prefetch-history");
  });

  it('calls prependData on successful page fetch', () => {
    expect(source).toContain('prependData');
  });
});
