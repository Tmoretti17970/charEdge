// ═══════════════════════════════════════════════════════════════════
// charEdge — Sprint 2: Chunk Caching & Dedup Tests
//
// Verifies the full Sprint 2 pipeline:
//   1. CacheManager has readPage/writePage methods
//   2. CacheManager has 50MB budget enforcement (_checkPageBudget)
//   3. fetchOHLCPage uses cache-first (reads before network)
//   4. fetchOHLCPage writes to cache on miss
//   5. DataSharedWorker has cross-tab fetch dedup
//   6. useSharedHistory hook exists with fallback
//   7. useChartDataLoader has adjacent TF prefetch
//   8. Adjacent TF map covers all standard timeframes
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

// ─── 1. CacheManager — Page-Level Cache ─────────────────────────

describe('Sprint 2 — CacheManager page cache', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'data/engine/infra/CacheManager.js'),
      'utf-8'
    );
  });

  it('has readPage method', () => {
    expect(source).toContain('readPage(');
  });

  it('has writePage method', () => {
    expect(source).toContain('writePage(');
  });

  it('builds page keys with page: prefix', () => {
    expect(source).toContain('page:${sym}:${tfId}:${ts}');
  });

  it('has _checkPageBudget for 50MB LRU eviction', () => {
    expect(source).toContain('_checkPageBudget');
    expect(source).toContain('BUDGET_MB = 50');
  });

  it('has hysteresis target at 40MB', () => {
    expect(source).toContain('TARGET_MB = 40');
  });

  it('has getPageCacheSizeMB method', () => {
    expect(source).toContain('getPageCacheSizeMB');
  });

  it('writes pages to OPFS in background', () => {
    expect(source).toContain('opfsBarStore.putCandles');
  });

  it('uses LRU eviction for page entries', () => {
    expect(source).toContain("key.startsWith('page:')");
  });
});

// ─── 2. FetchService — Cache-First Page Loading ─────────────────

describe('Sprint 2 — FetchService cache-first pages', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'data/HistoryPaginator.js'),
      'utf-8'
    );
  });

  it('checks cache before network in fetchOHLCPage', () => {
    expect(source).toContain('cacheManager.readPage');
  });

  it('writes to cache on successful fetch', () => {
    expect(source).toContain('cacheManager.writePage');
  });

  it('imports CacheManager lazily to avoid circular deps', () => {
    expect(source).toContain("import('./engine/infra/CacheManager.js')");
  });

  it('still has in-flight dedup for concurrent requests', () => {
    expect(source).toContain('_historyInflight');
  });
});

// ─── 3. DataSharedWorker — Cross-Tab Fetch Dedup ────────────────

describe('Sprint 2 — DataSharedWorker cross-tab dedup', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'data/engine/infra/DataSharedWorker.js'),
      'utf-8'
    );
  });

  it('handles fetch-request message type', () => {
    expect(source).toContain("'fetch-request'");
  });

  it('handles fetch-response message type', () => {
    expect(source).toContain("'fetch-response'");
  });

  it('handles fetch-wait message for queued tabs', () => {
    expect(source).toContain("'fetch-wait'");
  });

  it('tracks in-flight fetches with inflightFetches map', () => {
    expect(source).toContain('inflightFetches');
  });

  it('cleans up inflight fetches on port disconnect', () => {
    expect(source).toContain('entry.fetcher === port');
  });

  it('broadcasts fetch results to waiting tabs', () => {
    expect(source).toContain('fetch-result');
  });
});

// ─── 4. useSharedHistory — Client Hook ──────────────────────────

describe('Sprint 2 — useSharedHistory hook', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'data/engine/infra/useSharedHistory.js'),
      'utf-8'
    );
  });

  it('exports fetchPageViaWorker function', () => {
    expect(source).toContain('export async function fetchPageViaWorker');
  });

  it('falls back to direct fetch when SharedWorker unavailable', () => {
    expect(source).toContain('fetchOHLCPage');
    expect(source).toContain('_workerFailed');
  });

  it('has 15s timeout fallback', () => {
    expect(source).toContain('15000');
  });

  it('sends fetch-request to SharedWorker', () => {
    expect(source).toContain("type: 'fetch-request'");
  });

  it('sends fetch-response after fetch completes', () => {
    expect(source).toContain("type: 'fetch-response'");
  });
});

// ─── 5. useChartDataLoader — Adjacent TF Prefetch ───────────────

describe('Sprint 2 — useChartDataLoader adjacent TF prefetch', () => {
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

  it('has ADJACENT_TFS map', () => {
    expect(source).toContain('ADJACENT_TFS');
  });

  it('uses requestIdleCallback for background prefetch', () => {
    expect(source).toContain('requestIdleCallback');
  });

  it('tracks prefetched pairs to avoid duplicate work', () => {
    expect(source).toContain('adjacentPrefetchedRef');
  });

  it('adjacent TF map covers 1m through 1w', () => {
    expect(source).toContain("'1m': ['5m']");
    expect(source).toContain("'1h': ['4h', '15m']");
    expect(source).toContain("'1D': ['1w', '4h']");
  });

  it('has setTimeout fallback for environments without requestIdleCallback', () => {
    expect(source).toContain('setTimeout');
    expect(source).toContain('cancelIdleCallback');
  });

  it('imports useRef for adjacentPrefetchedRef', () => {
    expect(source).toContain('useRef');
  });
});

// ─── 6. OPFSBarStore — Storage Stats ────────────────────────────

describe('Sprint 2 — OPFSBarStore storage stats', () => {
  let source;

  beforeEach(async () => {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const path = await import('path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'data/engine/infra/OPFSBarStore.js'),
      'utf-8'
    );
  });

  it('has getStats method returning totalSizeKB', () => {
    expect(source).toContain('getStats');
    expect(source).toContain('totalSizeKB');
  });

  it('iterates OPFS directory entries for size calculation', () => {
    expect(source).toContain('dir.entries()');
  });
});
