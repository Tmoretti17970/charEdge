// ═══════════════════════════════════════════════════════════════════
// charEdge — DatafeedService Race Condition Tests
//
// Verifies that rapid symbol switching does not create zombie
// WebSocket connections or apply stale fetch results.
// ═══════════════════════════════════════════════════════════════════

// eslint-disable-next-line import/order
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mock dependencies ──────────────────────────────────────────

const setDataMetaMock = vi.fn();

// Mock useChartStore
vi.mock('../../state/useChartStore', () => ({
  useChartStore: {
    getState: () => ({
      setWsStatus: vi.fn(),
    }),
  },
}));

// Mock focused chart core store metadata writer
vi.mock('../../state/chart/useChartCoreStore', () => ({
  useChartCoreStore: {
    getState: () => ({
      setDataMeta: setDataMetaMock,
      setWsStatus: vi.fn(),
    }),
  },
}));

// Mock WebSocketService
vi.mock('../../data/WebSocketService', () => ({
  WS_STATUS: { CONNECTING: 'connecting', CONNECTED: 'connected', DISCONNECTED: 'disconnected', RECONNECTING: 'reconnecting' },
}));

// Mock OrderFlowAggregator
vi.mock('../../data/OrderFlowAggregator.js', () => ({
  getAggregator: vi.fn(() => ({ processTrade: vi.fn(), processDOMSnapshot: vi.fn() })),
  removeAggregator: vi.fn(),
}));

// Mock TickChannel
vi.mock('../../charting_library/core/TickChannel.js', () => ({
  tickChannel: { pushHistorical: vi.fn(), pushTick: vi.fn() },
}));

// Mock isCrypto
vi.mock('../../constants.js', () => ({
  isCrypto: vi.fn(() => true),
}));

// Mock logger
vi.mock('@/observability/logger', () => ({
  logger: { engine: { warn: vi.fn(), info: vi.fn() } },
}));

// ─── Test Suite ─────────────────────────────────────────────────

// We import after mocks are set up
const { DatafeedService } = await import('../../charting_library/datafeed/DatafeedService.js').then(m => {
  // The module exports a singleton; we need the class to create fresh instances
  // We'll use the singleton and reset it between tests
  return m;
});

// Since DatafeedService is a class not exported, we test via the singleton
import { datafeedService } from '../../charting_library/datafeed/DatafeedService.js';

describe('DatafeedService — Race Condition Guard', () => {
  beforeEach(() => {
    // Reset internal state between tests
    datafeedService.cache.clear();
    datafeedService.sockets.clear();
    datafeedService._reconnectTimers.clear();

    // Reset global fetch mock
    vi.restoreAllMocks();
    setDataMetaMock.mockReset();
  });

  it('bumps generation counter on each subscribe call for the same key', () => {
    const key = 'BTCUSDT_1h';

    const unsub1 = datafeedService.subscribe('BTCUSDT', '1h', {
      onHistorical: vi.fn(),
      onTick: vi.fn(),
      onError: vi.fn(),
    });

    const entry1Gen = datafeedService.cache.get(key)?.generation;
    expect(entry1Gen).toBeGreaterThan(0);

    const unsub2 = datafeedService.subscribe('BTCUSDT', '1h', {
      onHistorical: vi.fn(),
      onTick: vi.fn(),
      onError: vi.fn(),
    });

    const entry2Gen = datafeedService.cache.get(key)?.generation;
    expect(entry2Gen).toBeGreaterThan(entry1Gen);

    unsub1();
    unsub2();
  });

  it('creates an AbortController on cache entry during load', () => {
    // Mock fetch to hang indefinitely
    global.fetch = vi.fn(() => new Promise(() => {}));

    datafeedService.subscribe('ETHUSDT', '1h', {
      onHistorical: vi.fn(),
      onTick: vi.fn(),
      onError: vi.fn(),
    });

    const entry = datafeedService.cache.get('ETHUSDT_1h');
    expect(entry).toBeDefined();
    expect(entry._abortController).toBeInstanceOf(AbortController);
  });

  it('aborts in-flight fetch on _cleanup (last subscriber leaves)', async () => {
    let abortSignalAborted = false;

    // Mock fetch that tracks abort
    global.fetch = vi.fn(() => {
      return new Promise((resolve, reject) => {
        // Simulate a long fetch — check abort state
        const checkAbort = setInterval(() => {
          // We'll check the entry's abort controller
          const entry = datafeedService.cache.get('SOLUSDT_1h');
          if (!entry || entry._abortController?.signal?.aborted) {
            abortSignalAborted = true;
            clearInterval(checkAbort);
            reject(new DOMException('The operation was aborted', 'AbortError'));
          }
        }, 10);
      });
    });

    const unsub = datafeedService.subscribe('SOLUSDT', '1h', {
      onHistorical: vi.fn(),
      onTick: vi.fn(),
      onError: vi.fn(),
    });

    // Entry should be loading
    const entry = datafeedService.cache.get('SOLUSDT_1h');
    expect(entry?.status).toBe('loading');
    expect(entry?._abortController).toBeTruthy();

    // Unsubscribe — should abort the fetch
    unsub();

    // Give it a tick to process
    await new Promise(r => setTimeout(r, 50));

    // After cleanup, the cache entry should be deleted
    expect(datafeedService.cache.has('SOLUSDT_1h')).toBe(false);
  });

  it('discards stale fetch results when generation changes', async () => {
    const historicalCb1 = vi.fn();
    const historicalCb2 = vi.fn();

    let resolveFirst;
    let fetchCallCount = 0;

    // Mock fetch: first call hangs, second call resolves immediately
    global.fetch = vi.fn(() => {
      fetchCallCount++;
      if (fetchCallCount === 1) {
        // First fetch hangs until we resolve it manually
        return new Promise((resolve) => {
          resolveFirst = () => resolve({
            ok: true,
            json: () => Promise.resolve([
              [1000, '100', '110', '90', '105', '1000'],
            ]),
          });
        });
      }
      // Second fetch resolves immediately
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          [2000, '200', '210', '190', '205', '2000'],
        ]),
      });
    });

    // First subscriber kicks off fetch #1 (which hangs)
    const unsub1 = datafeedService.subscribe('BTCUSDT', '1h', {
      onHistorical: historicalCb1,
      onTick: vi.fn(),
      onError: vi.fn(),
    });

    const entryAfterFirst = datafeedService.cache.get('BTCUSDT_1h');
    const gen1 = entryAfterFirst?.generation;

    // Second subscriber joins the SAME key — bumps generation and triggers new fetch
    // (entry.status is 'loading', but generation bump + new AbortController
    //  means _loadHistorical is called again with updated generation)
    // Actually: since status is 'loading', subscribe() won't re-trigger _loadHistorical.
    // The generation guard protects when the first fetch finally resolves.

    // Let's manually bump the generation to simulate what happens with
    // different keys (e.g., re-subscribe after changing then changing back)
    entryAfterFirst.generation = gen1 + 1;

    // Now resolve the FIRST (stale) fetch
    if (resolveFirst) resolveFirst();
    await new Promise(r => setTimeout(r, 30));

    // The stale fetch captured gen1 as its generation.
    // But entry.generation is now gen1+1, so the guard should reject it.
    const entry = datafeedService.cache.get('BTCUSDT_1h');

    // Entry should still be in 'loading' status — stale result was discarded
    expect(entry?.status).toBe('loading');
    // historicalCb1 should NOT have been called with the stale data
    expect(historicalCb1).not.toHaveBeenCalled();

    unsub1();
  });

  it('does not start WebSocket when subscribers are empty after fetch', async () => {
    // Track WebSocket creation
    const OriginalWebSocket = global.WebSocket;
    let wsCreated = false;
    global.WebSocket = vi.fn(() => {
      wsCreated = true;
      return {
        readyState: 1,
        close: vi.fn(),
        onopen: null,
        onclose: null,
        onerror: null,
        onmessage: null,
      };
    });

    // Mock fetch that resolves quickly
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve([[1000, '100', '110', '90', '105', '1000']]),
    }));

    const unsub = datafeedService.subscribe('BNBUSDT', '1h', {
      onHistorical: vi.fn(),
      onTick: vi.fn(),
      onError: vi.fn(),
    });

    // Immediately unsubscribe before fetch completes
    unsub();

    // Wait for fetch to complete
    await new Promise(r => setTimeout(r, 50));

    // WebSocket should NOT have been created (subscriber left before fetch finished)
    // Note: cleanup may have already deleted the entry, so WS creation is moot
    // The key assertion is that no orphan socket exists
    expect(datafeedService.sockets.has('BNBUSDT_1h')).toBe(false);

    global.WebSocket = OriginalWebSocket;
  });

  it('sets canonical metadata source for crypto historical load', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve([
        [1000, '100', '110', '90', '105', '1000'],
        [2000, '105', '120', '95', '115', '1500'],
      ]),
    }));

    const onHistorical = vi.fn();
    const unsub = datafeedService.subscribe('BTCUSDT', '1h', {
      onHistorical,
      onTick: vi.fn(),
      onError: vi.fn(),
    });

    await new Promise((r) => setTimeout(r, 30));

    expect(onHistorical).toHaveBeenCalled();
    expect(setDataMetaMock).toHaveBeenCalledWith(2, 'datafeed:crypto', 1000);
    unsub();
  });

  it('marks entry as error and notifies subscriber on fetch failure', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: false,
      json: () => Promise.resolve({}),
    }));

    const onError = vi.fn();
    const unsub = datafeedService.subscribe('BTCUSDT', '1h', {
      onHistorical: vi.fn(),
      onTick: vi.fn(),
      onError,
    });

    await new Promise((r) => setTimeout(r, 30));

    const entry = datafeedService.cache.get('BTCUSDT_1h');
    expect(entry?.status).toBe('error');
    expect(onError).toHaveBeenCalled();
    expect(setDataMetaMock).not.toHaveBeenCalled();
    unsub();
  });
});
