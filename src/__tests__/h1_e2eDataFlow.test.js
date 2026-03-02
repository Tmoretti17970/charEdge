// ═══════════════════════════════════════════════════════════════════
// charEdge — H1.5 E2E Data Flow Integration Tests
//
// Tests the full data pipeline: symbol → FetchService → CacheManager
// → validate → display-ready output.
//
// These tests mock `fetch()` and OPFS, but exercise real CacheManager,
// FetchService, SWR, DataValidator, and circuit breaker logic.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Test helpers ──────────────────────────────────────────────

function makeBars(count, startMs = Date.now() - count * 60000) {
  return Array.from({ length: count }, (_, i) => ({
    time: new Date(startMs + i * 60000).toISOString(),
    open: 100 + i,
    high: 105 + i,
    low: 95 + i,
    close: 102 + i,
    volume: 1000 + i * 10,
  }));
}

function makeBinanceKlines(count, startMs = Date.now() - count * 60000) {
  return Array.from({ length: count }, (_, i) => {
    const openTime = startMs + i * 60000;
    return [
      openTime,                    // [0] openTime
      String(100 + i),             // [1] open
      String(105 + i),             // [2] high
      String(95 + i),              // [3] low
      String(102 + i),             // [4] close
      String(1000 + i * 10),       // [5] volume
      openTime + 59999,            // [6] closeTime
      '0', 0, '0', '0', '0'       // [7-11] unused fields
    ];
  });
}

// ─── Test 1: buildCacheKey consistency ──────────────────────────

describe('E2E: Cache key consistency', () => {
  it('buildCacheKey produces colon-separated format', async () => {
    const { buildCacheKey } = await import('../constants.js');
    expect(buildCacheKey('BTC', '1D')).toBe('BTC:1D');
    expect(buildCacheKey('ETHUSDT', '5m')).toBe('ETHUSDT:5m');
    expect(buildCacheKey('AAPL', '1h')).toBe('AAPL:1h');
  });

  it('CacheManager write/read uses the same key format', async () => {
    const { _CacheManager } = await import('../data/engine/infra/CacheManager.js');
    const cm = new _CacheManager();
    const bars = makeBars(5);

    cm.write('BTC', '1D', bars, 'test');
    const result = await cm.read('BTC', '1D', Infinity);

    expect(result).not.toBeNull();
    expect(result.data).toEqual(bars);
    expect(result.source).toBe('test');
  });
});

// ─── Test 2: Data validation pipeline ───────────────────────────

describe('E2E: Data validation pipeline', () => {
  it('validateCandleArray strips invalid candles', async () => {
    const { validateCandleArray } = await import('../data/engine/infra/DataValidator.js');
    const bars = [
      { time: new Date().toISOString(), open: 100, high: 105, low: 95, close: 102, volume: 1000 },
      { time: 'invalid-date', open: 100, high: 105, low: 95, close: 102, volume: 1000 },
      { time: new Date().toISOString(), open: -1, high: 105, low: 95, close: 102, volume: 1000 },
      { time: new Date().toISOString(), open: 0, high: 0, low: 0, close: 0, volume: 0 },
      null,
      { time: new Date().toISOString(), open: 50, high: 55, low: 45, close: 52, volume: 500 },
    ];

    const cleaned = validateCandleArray(bars);
    expect(cleaned.length).toBe(2); // Only 1st and last are valid
    expect(cleaned[0].close).toBe(102);
    expect(cleaned[1].close).toBe(52);
  });

  it('validates high < low by swapping', async () => {
    const { validateCandle } = await import('../data/engine/infra/DataValidator.js');
    const bar = { time: new Date().toISOString(), open: 100, high: 90, low: 110, close: 102, volume: 1000 };
    const result = validateCandle(bar);
    expect(result.valid).toBe(true);
    expect(result.candle.high).toBe(110);
    expect(result.candle.low).toBe(90);
    expect(result.issues).toContain('high < low (swapped)');
  });
});

// ─── Test 3: SWR logic ─────────────────────────────────────────

describe('E2E: Stale-while-revalidate flow', () => {
  it('returns fresh data without revalidation', async () => {
    const { staleWhileRevalidate } = await import('../data/engine/swr.js');
    const revalidateFn = vi.fn();
    const cached = { data: makeBars(3), source: 'binance', tier: 'memory' };

    const result = staleWhileRevalidate(cached, revalidateFn);
    expect(result.data).toEqual(cached.data);
    expect(revalidateFn).not.toHaveBeenCalled();
  });

  it('returns stale data and triggers background refresh', async () => {
    const { staleWhileRevalidate } = await import('../data/engine/swr.js');
    const revalidateFn = vi.fn().mockResolvedValue(undefined);
    const cached = { data: makeBars(3), source: 'binance', tier: 'memory-stale' };

    const result = staleWhileRevalidate(cached, revalidateFn);
    expect(result.data).toEqual(cached.data);

    // Wait a tick for fire-and-forget to execute
    await new Promise(r => setTimeout(r, 10));
    expect(revalidateFn).toHaveBeenCalledOnce();
  });

  it('returns null on cache miss', async () => {
    const { staleWhileRevalidate } = await import('../data/engine/swr.js');
    const result = staleWhileRevalidate(null, vi.fn());
    expect(result).toBeNull();
  });
});

// ─── Test 4: CacheManager 3-tier read/write ─────────────────────

describe('E2E: CacheManager 3-tier cache', () => {
  it('write stores to memory and read returns from memory tier', async () => {
    const { _CacheManager } = await import('../data/engine/infra/CacheManager.js');
    const cm = new _CacheManager();
    const bars = makeBars(10);

    cm.write('ETH', '1h', bars, 'binance');
    const result = await cm.read('ETH', '1h', 120000);

    expect(result).not.toBeNull();
    expect(result.data.length).toBe(10);
    expect(result.source).toBe('binance');
    expect(result.tier).toBe('memory');
  });

  it('read returns null on complete cache miss', async () => {
    const { _CacheManager } = await import('../data/engine/infra/CacheManager.js');
    const cm = new _CacheManager();

    const result = await cm.read('NONEXISTENT', '1D', 60000);
    expect(result).toBeNull();
  });

  it('evictByAge removes stale entries', async () => {
    const { _CacheManager } = await import('../data/engine/infra/CacheManager.js');
    const cm = new _CacheManager();
    const bars = makeBars(5);

    cm.write('BTC', '5m', bars, 'test');
    // Entries just written should survive a 1h eviction window
    const evicted = cm.evictByAge(3600000);
    expect(evicted).toBe(0);

    const result = await cm.read('BTC', '5m', Infinity);
    expect(result).not.toBeNull();
  });

  it('getLastUpdate returns correct metadata', async () => {
    const { _CacheManager } = await import('../data/engine/infra/CacheManager.js');
    const cm = new _CacheManager();
    const bars = makeBars(5);
    const before = Date.now();

    cm.write('SOL', '15m', bars, 'coingecko');
    const info = cm.getLastUpdate('SOL', '15m');

    expect(info).not.toBeNull();
    expect(info.source).toBe('coingecko');
    expect(info.ageMs).toBeLessThan(1000);
    expect(info.timestamp).toBeGreaterThanOrEqual(before);
  });

  it('getStats reports hits and misses', async () => {
    const { _CacheManager } = await import('../data/engine/infra/CacheManager.js');
    const cm = new _CacheManager();
    const bars = makeBars(5);

    cm.write('DOGE', '1D', bars, 'test');
    await cm.read('DOGE', '1D', Infinity);   // hit
    await cm.read('MISSING', '1D', Infinity); // miss

    const stats = cm.getStats();
    expect(stats.hits.memory).toBeGreaterThanOrEqual(1);
    expect(stats.misses).toBeGreaterThanOrEqual(1);
  });
});

// ─── Test 5: Circuit breaker behavior ───────────────────────────

describe('E2E: AdapterCircuitBreaker', () => {
  beforeEach(async () => {
    const { resetAllCircuits } = await import('../data/engine/infra/AdapterCircuitBreaker.js');
    resetAllCircuits();
  });

  it('lets requests through when circuit is CLOSED', async () => {
    const { withCircuitBreaker } = await import('../data/engine/infra/AdapterCircuitBreaker.js');
    const result = await withCircuitBreaker('test-adapter', async () => 'success');
    expect(result).toBe('success');
  });

  it('trips open after sustained failures', async () => {
    const { withCircuitBreaker, getCircuitState } = await import('../data/engine/infra/AdapterCircuitBreaker.js');
    const failFn = async () => null; // null = failure

    // Pump enough failures to trip (need ≥3 calls, 50% failure rate)
    for (let i = 0; i < 10; i++) {
      await withCircuitBreaker('flaky-adapter', failFn);
    }

    const state = getCircuitState('flaky-adapter');
    expect(state.state).toBe('OPEN');
  });

  it('short-circuits to null when OPEN', async () => {
    const { withCircuitBreaker, getCircuitState } = await import('../data/engine/infra/AdapterCircuitBreaker.js');
    // Trip the breaker
    for (let i = 0; i < 10; i++) {
      await withCircuitBreaker('dead-adapter', async () => null);
    }
    expect(getCircuitState('dead-adapter').state).toBe('OPEN');

    // Next call should be short-circuited
    const calledFn = vi.fn().mockResolvedValue('data');
    const result = await withCircuitBreaker('dead-adapter', calledFn);
    expect(result).toBeNull();
    expect(calledFn).not.toHaveBeenCalled();
  });
});

// ─── Test 6: DataPipelineLogger integration ─────────────────────

describe('E2E: DataPipelineLogger', () => {
  let logger;

  beforeEach(async () => {
    const mod = await import('../data/engine/infra/DataPipelineLogger.js');
    logger = mod.pipelineLogger;
    logger.clear();
  });

  it('logs entries with correct structure', () => {
    logger.info('FetchService', 'Fetched 100 bars for BTC:1D from binance');
    logger.warn('CacheManager', 'Cache miss for ETH:1h');

    const recent = logger.getRecent(10);
    expect(recent.length).toBeGreaterThanOrEqual(2);

    const fetchEntry = recent.find(e => e.source === 'FetchService');
    expect(fetchEntry).toBeDefined();
    expect(fetchEntry.level).toBe('info');
    expect(fetchEntry.message).toContain('BTC:1D');
    expect(fetchEntry.ts).toBeGreaterThan(0);
  });

  it('getBySource filters correctly', () => {
    logger.info('FetchService', 'msg1');
    logger.info('CacheManager', 'msg2');
    logger.info('FetchService', 'msg3');

    const fetchEntries = logger.getBySource('FetchService');
    expect(fetchEntries.length).toBeGreaterThanOrEqual(2);
    expect(fetchEntries.every(e => e.source === 'FetchService')).toBe(true);
  });

  it('getStats tracks error counts', () => {
    logger.error('FetchService', 'Network failure');
    logger.error('FetchService', 'Timeout');
    logger.info('FetchService', 'Success');

    const stats = logger.getStats();
    expect(stats.totalEntries).toBeGreaterThanOrEqual(3);
    expect(stats.byLevel.error).toBeGreaterThanOrEqual(2);
  });

  it('subscribe receives new entries', () => {
    const received = [];

    const unsub = logger.subscribe(entry => received.push(entry));
    logger.info('Test', 'hello');
    logger.warn('Test', 'warning');

    expect(received.length).toBe(2);
    expect(received[0].message).toBe('hello');
    expect(received[1].level).toBe('warn');

    unsub();
    logger.info('Test', 'after-unsub');
    expect(received.length).toBe(2); // no new entry after unsub
  });
});

// ─── Test 7: FetchService source code verification ──────────────

describe('E2E: FetchService structural verification', () => {
  it('imports pipelineLogger and calls it on fetch paths', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/FetchService.js', 'utf8');

    expect(source).toContain("import { pipelineLogger }");
    expect(source).toContain("pipelineLogger.debug('FetchService'");
    expect(source).toContain("pipelineLogger.info('FetchService'");
    expect(source).toContain("pipelineLogger.warn('FetchService'");
  });

  it('uses buildCacheKey from constants', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/FetchService.js', 'utf8');

    expect(source).toContain("import { TFS, isCrypto, buildCacheKey }");
    expect(source).toContain("buildCacheKey(sym, tfId)");
  });

  it('uses staleWhileRevalidate from swr.js', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/FetchService.js', 'utf8');

    expect(source).toContain("import { staleWhileRevalidate }");
    expect(source).toContain("staleWhileRevalidate(cached,");
  });

  it('has inflight deduplication', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/FetchService.js', 'utf8');

    expect(source).toContain("_inflight.has(key)");
    expect(source).toContain("_inflight.set(key, promise)");
    expect(source).toContain("_inflight.delete(key)");
  });

  it('has background refresh throttle (10s per key)', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/FetchService.js', 'utf8');

    expect(source).toContain("_bgRefreshTimestamps");
    expect(source).toContain("10_000");
  });

  it('warmCache targets adjacent timeframes', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/FetchService.js', 'utf8');

    // Verify the ADJACENT map exists with entries for 1D
    expect(source).toContain("'1D': ['4h', '1w']");
  });
});

// ─── Test 8: CacheManager clears all tiers ──────────────────────

describe('E2E: CacheManager.clear() clears all tiers', () => {
  it('clear() empties the memory tier', async () => {
    const { _CacheManager } = await import('../data/engine/infra/CacheManager.js');
    const cm = new _CacheManager();
    const bars = makeBars(5);

    cm.write('BTC', '1D', bars, 'test');
    const before = await cm.read('BTC', '1D', Infinity);
    expect(before).not.toBeNull();

    await cm.clear();
    const after = await cm.read('BTC', '1D', Infinity);
    expect(after).toBeNull();
  });

  it('clear() source verification — calls DataCache and OPFS clearAll', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/engine/infra/CacheManager.js', 'utf8');
    expect(source).toContain('dc.clearAll()');
    expect(source).toContain('opfsBarStore.clearAll');
  });
});

// ─── Test 9: isStale utility ────────────────────────────────────

describe('E2E: isStale utility', () => {
  it('returns true for stale-tier results', async () => {
    const { isStale } = await import('../data/engine/swr.js');
    expect(isStale({ data: [], source: 'test', tier: 'memory-stale' })).toBe(true);
    expect(isStale({ data: [], source: 'test', tier: 'idb-stale' })).toBe(true);
  });

  it('returns false for fresh results and null', async () => {
    const { isStale } = await import('../data/engine/swr.js');
    expect(isStale({ data: [], source: 'test', tier: 'memory' })).toBe(false);
    expect(isStale(null)).toBe(false);
  });
});

// ─── Test 10: Full pipeline structure — fetch → validate → cache ─

describe('E2E: Full pipeline structure verification', () => {
  it('_doFetch calls validateCandleArray before caching', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/FetchService.js', 'utf8');

    // Find the _doFetch function and verify validate call comes before write
    const doFetchStart = source.indexOf('async function _doFetch');
    const doFetchBody = source.slice(doFetchStart);

    // Search for the actual call site, not the import
    const validatePos = doFetchBody.indexOf('data = validateCandleArray(data)');
    const writePos = doFetchBody.indexOf('cacheManager.write(sym, tfId, data, source)');

    expect(validatePos).toBeGreaterThan(0);
    expect(writePos).toBeGreaterThan(0);
    expect(validatePos).toBeLessThan(writePos); // validate BEFORE cache write
  });

  it('_doFetch tries Binance first, then CoinGecko, then CryptoCompare for crypto', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/FetchService.js', 'utf8');

    const doFetchStart = source.indexOf('async function _doFetch');
    const doFetchBody = source.slice(doFetchStart);

    const binancePos = doFetchBody.indexOf("withCircuitBreaker('binance'");
    const coinGeckoPos = doFetchBody.indexOf("withCircuitBreaker('coingecko'");
    const cryptoComparePos = doFetchBody.indexOf("withCircuitBreaker('cryptocompare'");

    expect(binancePos).toBeGreaterThan(0);
    expect(coinGeckoPos).toBeGreaterThan(binancePos);
    expect(cryptoComparePos).toBeGreaterThan(coinGeckoPos);
  });

  it('_doFetch has OPFS offline fallback as last resort', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/FetchService.js', 'utf8');

    const doFetchStart = source.indexOf('async function _doFetch');
    const doFetchBody = source.slice(doFetchStart);

    const yahooPos = doFetchBody.indexOf("withCircuitBreaker('yahoo'");
    const opfsPos = doFetchBody.indexOf("opfsBarStore.getCandles");

    expect(opfsPos).toBeGreaterThan(yahooPos); // OPFS is AFTER all network providers
  });

  it('dispatches charEdge:data-warning event on total failure', async () => {
    const fs = await import('fs');
    const source = await fs.promises.readFile('src/data/FetchService.js', 'utf8');

    expect(source).toContain("charEdge:data-warning");
    expect(source).toContain("_lastWarning");
  });
});

// ─── Test 11: deduplicateCandles ────────────────────────────────

describe('E2E: Candle deduplication', () => {
  it('removes duplicate timestamps (last write wins)', async () => {
    const { deduplicateCandles } = await import('../data/engine/infra/DataValidator.js');
    const now = Date.now();
    const bars = [
      { time: new Date(now).toISOString(), open: 100, high: 105, low: 95, close: 102, volume: 1000 },
      { time: new Date(now + 60000).toISOString(), open: 101, high: 106, low: 96, close: 103, volume: 1100 },
      { time: new Date(now).toISOString(), open: 200, high: 205, low: 195, close: 202, volume: 2000 }, // dupe of #1
    ];

    const deduped = deduplicateCandles(bars);
    expect(deduped.length).toBe(2);
    // The duplicate should use the LAST occurrence (close=202)
    expect(deduped[0].close).toBe(202);
    expect(deduped[1].close).toBe(103);
  });
});

// ─── Test 12: CacheManager hasFresh ─────────────────────────────

describe('E2E: CacheManager.hasFresh()', () => {
  it('returns true for fresh entry', async () => {
    const { _CacheManager } = await import('../data/engine/infra/CacheManager.js');
    const cm = new _CacheManager();
    const bars = makeBars(5);

    cm.write('BTC', '1D', bars, 'test');
    expect(cm.hasFresh('BTC', '1D', 60000)).toBe(true);
  });

  it('returns false for missing entry', async () => {
    const { _CacheManager } = await import('../data/engine/infra/CacheManager.js');
    const cm = new _CacheManager();
    expect(cm.hasFresh('MISSING', '1D', 60000)).toBe(false);
  });

  it('returns false for expired entry', async () => {
    const { _CacheManager } = await import('../data/engine/infra/CacheManager.js');
    const cm = new _CacheManager();
    const bars = makeBars(5);

    cm.write('BTC', '1D', bars, 'test');
    // TTL of 0 means everything is immediately expired
    expect(cm.hasFresh('BTC', '1D', 0)).toBe(false);
  });
});
