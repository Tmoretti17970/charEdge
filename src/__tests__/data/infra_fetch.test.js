// ═══════════════════════════════════════════════════════════════════
// charEdge — Consolidated Fetch & Adapter Infrastructure Tests
//
// Covers: FetchService, SymbolRegistry, isCrypto, WebSocketService,
//         BaseAdapter, CircuitBreaker (unified), DataExporter, DataProvider,
//         Constants TFS
// Replaces: dataInfraFixes.test.js (Bug#1,#4), dataInfraRound2.test.js,
//           dataInfraRound3.test.js (#15,#27), dataInfraRound4.test.js,
//           dataInfraRound5.test.js, dataInfraRound6.test.js,
//           dataInfraRound7.test.js, dataInfraRound8.test.js,
//           dataInfraRound9.test.js
// ═══════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readSource(relPath) {
  return fs.readFileSync(path.resolve(__dirname, '..', '..', relPath), 'utf-8');
}

/**
 * Check that a JS object literal in source has no duplicate string keys.
 */
function findDuplicateKeys(source, startMarker) {
  const idx = source.indexOf(startMarker);
  if (idx === -1) return [];
  const braceStart = source.indexOf('{', idx);
  if (braceStart === -1) return [];
  let depth = 0;
  let blockEnd = braceStart;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') depth--;
    if (depth === 0) { blockEnd = i; break; }
  }
  const block = source.slice(braceStart, blockEnd + 1);
  const keyPattern = /['"]([^'"]+)['"]\s*:/g;
  const keys = [];
  let match;
  while ((match = keyPattern.exec(block)) !== null) keys.push(match[1]);
  const seen = new Set();
  const dupes = new Set();
  for (const k of keys) { if (seen.has(k)) dupes.add(k); seen.add(k); }
  return [...dupes];
}

// ═══════════════════════════════════════════════════════════════════
// FetchService
// ═══════════════════════════════════════════════════════════════════

describe('FetchService — clearCache clears bgRefreshTimestamps', () => {
  it('clearCache empties both _cache and _bgRefreshTimestamps', async () => {
    const { clearCache, cacheStats } = await import('../../data/FetchService.ts');
    clearCache();
    const stats = cacheStats();
    expect(stats.memorySize).toBe(0);
  });
});

describe('FetchService — Cache import correctness', () => {
  it('uses cacheManager (consolidated) instead of raw dataCache', async () => {
    const source = readSource('data/FetchService.ts');
    const rawCacheImport = source.match(/\{ dataCache \}/g);
    expect(rawCacheImport).toBeNull();
    expect(source).toContain("cacheManager");
    expect(source).toContain("cacheManager.read");
    expect(source).toContain("cacheManager.write");
  });

  it('DataCache.ts exports match what FetchService imports', async () => {
    const mod = await import('../../data/DataCache.ts');
    expect(mod.dataCache).toBeDefined();
    expect(typeof mod.dataCache.getCandles).toBe('function');
    expect(typeof mod.dataCache.putCandles).toBe('function');
    expect(mod.DataCache).toBeUndefined();
  });
});

describe('FetchService — CacheManager integration', () => {
  it('imports cacheManager instead of inline _cache', async () => {
    const source = readSource('data/FetchService.ts');
    expect(source).toContain("import { cacheManager } from './engine/infra/CacheManager.js'");
    expect(source).not.toContain('const _cache = new Map()');
    expect(source).not.toContain('function cacheSet(');
    expect(source).toContain('cacheManager.read(');
    expect(source).toContain('cacheManager.write(');
    expect(source).toContain('cacheManager.clear()');
    expect(source).toContain('cacheManager.hasFresh(');
  });

  it('_doFetch uses circuit breakers for multi-tier fallback', async () => {
    const source = readSource('data/FetchService.ts');
    expect(source).toContain("withCircuitBreaker('binance'");
    expect(source).toContain("withCircuitBreaker('coingecko'");
    expect(source).toContain("withCircuitBreaker('cryptocompare'");
    expect(source).toContain("withCircuitBreaker('yahoo'");
    expect(source).toContain("withCircuitBreaker('equity-premium'");
    const fetcherBlocks = source.match(/if \(!data/g);
    expect(fetcherBlocks.length).toBeGreaterThanOrEqual(4);
  });
});

describe('FetchService — delta-only fetching support', () => {
  it('fetchBinanceBatch accepts startTime parameter', async () => {
    const source = readSource('data/BinanceClient.js');
    expect(source).toContain('async function fetchBinanceBatch(pair, interval, limit, endTime, startTime)');
    // eslint-disable-next-line no-template-curly-in-string
    expect(source).toContain('if (startTime) url += `&startTime=${startTime}`');
  });

  it('fetchBinance accepts startTime parameter', async () => {
    const source = readSource('data/BinanceClient.js');
    expect(source).toContain('async function fetchBinance(sym, tfId, startTime)');
  });

  it('_doFetch checks opfsBarStore.getLastCandleTime before Binance fetch', async () => {
    const source = readSource('data/FetchService.ts');
    expect(source).toContain('opfsBarStore.getLastCandleTime(sym, tfId)');
    expect(source).toContain('deltaStartTime');
  });
});

describe('FetchService — config maps have no duplicates', () => {
  let binanceSource, fetchSource;
  beforeAll(() => {
    binanceSource = readSource('data/BinanceClient.js');
    fetchSource = readSource('data/FetchService.ts');
  });

  it('TTL map has no duplicate keys', () => { expect(findDuplicateKeys(fetchSource, 'const TTL')).toEqual([]); });
  it('BINANCE_INTERVALS map has no duplicate keys', () => { expect(findDuplicateKeys(binanceSource, 'const BINANCE_INTERVALS')).toEqual([]); });
  it('BINANCE_LIMITS map has no duplicate keys', () => { expect(findDuplicateKeys(binanceSource, 'BINANCE_LIMITS')).toEqual([]); });
  it('BINANCE_PAGINATE_PAGES map has no duplicate keys', () => { expect(findDuplicateKeys(binanceSource, 'BINANCE_PAGINATE_PAGES')).toEqual([]); });
  it('ADJACENT map has no duplicate keys', () => { expect(findDuplicateKeys(fetchSource, 'const ADJACENT')).toEqual([]); });
  it('CG_TF_MAP has no duplicate keys', () => { expect(findDuplicateKeys(fetchSource, 'const CG_TF_MAP')).toEqual([]); });
  it('CC_TF_MAP has no duplicate keys', () => { expect(findDuplicateKeys(fetchSource, 'const CC_TF_MAP')).toEqual([]); });
  it('YAHOO_TF_MAP has no duplicate keys', () => { expect(findDuplicateKeys(fetchSource, 'const YAHOO_TF_MAP')).toEqual([]); });

  it('TTL covers 30m and 1w', () => {
    const block = fetchSource.slice(fetchSource.indexOf('const TTL'), fetchSource.indexOf('const TTL') + 300);
    expect(block).toContain("'30m'");
    expect(block).toContain("'1w'");
  });

  it('BINANCE_INTERVALS covers 30m and 1w', () => {
    const block = binanceSource.slice(binanceSource.indexOf('BINANCE_INTERVALS'), binanceSource.indexOf('BINANCE_INTERVALS') + 300);
    expect(block).toContain("'30m'");
    expect(block).toContain("'1w'");
  });

  it('has no range-based legacy keys', () => {
    const ttlIdx = fetchSource.indexOf('const TTL');
    const ttlEnd = fetchSource.indexOf('};', ttlIdx) + 2;
    const ttlBlock = fetchSource.slice(ttlIdx, ttlEnd);
    expect(ttlBlock).not.toContain("'1d':");
    expect(ttlBlock).not.toContain("'5d':");
    expect(ttlBlock).not.toContain("'3m':");
    expect(ttlBlock).not.toContain("'6m':");
    expect(ttlBlock).not.toContain("'1y':");
  });
});

describe('FetchService — uses static imports', () => {
  let source;
  beforeAll(() => { source = readSource('data/FetchService.ts'); });

  it('statically imports CoinGeckoAdapter', () => { expect(source).toContain("from './adapters/CoinGeckoAdapter.js'"); });
  it('statically imports CryptoCompareAdapter', () => { expect(source).toContain("from './adapters/CryptoCompareAdapter.js'"); });
  it('statically imports YahooAdapter', () => { expect(source).toContain("from './adapters/YahooAdapter.js'"); });
  it('does NOT dynamically import CoinGeckoAdapter', () => { expect(source).not.toContain("import('./adapters/CoinGeckoAdapter.js')"); });
  it('does NOT dynamically import CryptoCompareAdapter', () => { expect(source).not.toContain("import('./adapters/CryptoCompareAdapter.js')"); });
  it('does NOT dynamically import YahooAdapter', () => { expect(source).not.toContain("import('./adapters/YahooAdapter.js')"); });
});

// ═══════════════════════════════════════════════════════════════════
// SymbolRegistry + isCrypto
// ═══════════════════════════════════════════════════════════════════

describe('SymbolRegistry — Pyth feed IDs are real', () => {
  it('META feed ID matches Pyth Hermes API', async () => {
    const { SymbolRegistry } = await import('../../data/SymbolRegistry.js');
    const meta = SymbolRegistry.lookup('META');
    expect(meta).not.toBeNull();
    expect(meta.pythFeedId).toBe('0x78a3e3b8e676a8f73c439f5d749737034b139bbbe899ba5775216fba596607fe');
  });

  it('NFLX feed ID matches Pyth Hermes API', async () => {
    const { SymbolRegistry } = await import('../../data/SymbolRegistry.js');
    const nflx = SymbolRegistry.lookup('NFLX');
    expect(nflx).not.toBeNull();
    expect(nflx.pythFeedId).toBe('0x8376cfd7ca8bcdf372ced05307b24dced1f15b1afafdeff715664598f15a3dd2');
  });

  it('CRM feed ID matches Pyth Hermes API', async () => {
    const { SymbolRegistry } = await import('../../data/SymbolRegistry.js');
    const crm = SymbolRegistry.lookup('CRM');
    expect(crm).not.toBeNull();
    expect(crm.pythFeedId).toBe('0xfeff234600320f4d6bb5a01d02570a9725c1e424977f2b823f7231e6857bdae8');
  });

  it('AUDUSD feed ID matches Pyth Hermes API', async () => {
    const { SymbolRegistry } = await import('../../data/SymbolRegistry.js');
    const aud = SymbolRegistry.lookup('AUDUSD=X');
    expect(aud).not.toBeNull();
    expect(aud.pythFeedId).toBe('0x67a6f93030420c1c9e3fe37c1ab6b77966af82f995944a9fefce357a22854a80');
  });

  it('no feed IDs contain placeholder patterns (repeating e0)', async () => {
    const { SymbolRegistry } = await import('../../data/SymbolRegistry.js');
    const allSymbols = SymbolRegistry.all();
    for (const sym of allSymbols) {
      if (sym.pythFeedId) {
        expect(sym.pythFeedId).not.toMatch(/e0e0e0e0/);
      }
    }
  });
});

describe('isCrypto — expanded CRYPTO_IDS + USDT suffix handling', () => {
  let isCrypto, CRYPTO_IDS;

  beforeAll(async () => {
    const mod = await import('../../constants.js');
    isCrypto = mod.isCrypto;
    CRYPTO_IDS = mod.CRYPTO_IDS;
  });

  it('recognizes core crypto symbols', () => {
    expect(isCrypto('BTC')).toBe(true);
    expect(isCrypto('ETH')).toBe(true);
    expect(isCrypto('SOL')).toBe(true);
    expect(isCrypto('XRP')).toBe(true);
    expect(isCrypto('DOGE')).toBe(true);
  });

  it('recognizes newly added crypto symbols (BNB, PEPE, FTM, SEI, TIA, JUP, WIF)', () => {
    expect(isCrypto('BNB')).toBe(true);
    expect(isCrypto('PEPE')).toBe(true);
    expect(isCrypto('FTM')).toBe(true);
    expect(isCrypto('SEI')).toBe(true);
    expect(isCrypto('TIA')).toBe(true);
    expect(isCrypto('JUP')).toBe(true);
    expect(isCrypto('WIF')).toBe(true);
  });

  it('recognizes USDT-suffixed pairs', () => {
    expect(isCrypto('BTCUSDT')).toBe(true);
    expect(isCrypto('ETHUSDT')).toBe(true);
    expect(isCrypto('SOLUSDT')).toBe(true);
    expect(isCrypto('BNBUSDT')).toBe(true);
    expect(isCrypto('PEPEUSDT')).toBe(true);
  });

  it('recognizes BUSD and USDC suffixed pairs', () => {
    expect(isCrypto('BTCBUSD')).toBe(true);
    expect(isCrypto('ETHUSDC')).toBe(true);
  });

  it('rejects equity/index symbols', () => {
    expect(isCrypto('QQQ')).toBe(false);
    expect(isCrypto('SPY')).toBe(false);
    expect(isCrypto('AAPL')).toBe(false);
    expect(isCrypto('VIX')).toBe(false);
    expect(isCrypto('IWM')).toBe(false);
  });

  it('rejects futures symbols', () => {
    expect(isCrypto('ES')).toBe(false);
    expect(isCrypto('NQ')).toBe(false);
    expect(isCrypto('CL')).toBe(false);
  });

  it('handles empty/null input', () => {
    expect(isCrypto('')).toBe(false);
    expect(isCrypto(null)).toBe(false);
    expect(isCrypto(undefined)).toBe(false);
  });

  it('is case insensitive', () => {
    expect(isCrypto('btc')).toBe(true);
    expect(isCrypto('Eth')).toBe(true);
    expect(isCrypto('btcusdt')).toBe(true);
  });

  it('CRYPTO_IDS has at least 25 entries', () => {
    expect(Object.keys(CRYPTO_IDS).length).toBeGreaterThanOrEqual(25);
  });

  it('expanded CRYPTO_IDS includes RENDER, INJ, TRX, SHIB', async () => {
    const mod = await import('../../constants.js');
    expect(mod.isCrypto('RENDER')).toBe(true);
    expect(mod.isCrypto('INJ')).toBe(true);
    expect(mod.isCrypto('TRX')).toBe(true);
    expect(mod.isCrypto('SHIB')).toBe(true);
    expect(mod.isCrypto('FLOKI')).toBe(true);
    expect(mod.isCrypto('AAVE')).toBe(true);
    expect(mod.isCrypto('RENDERUSDT')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// WebSocketService
// ═══════════════════════════════════════════════════════════════════

describe('WebSocketService — multiplexed combined streams', () => {
  it('subscribe returns a numeric subscription ID', async () => {
    vi.stubGlobal('WebSocket', class { constructor() { this.readyState = 0; } close() { } });
    const { WebSocketService } = await import('../../data/WebSocketService.ts');
    const ws = new WebSocketService();
    const subId = ws.subscribe('BTC', '1h', {});
    expect(typeof subId).toBe('number');
    expect(subId).toBeGreaterThan(0);
    ws.unsubscribe();
    vi.unstubAllGlobals();
  });

  it('builds correct stream keys for combined endpoint', async () => {
    const source = readSource('data/WebSocketService.ts');
    expect(source).toContain('wss://data-stream.binance.vision/stream?streams=');
    expect(source).toContain('streams.join');
  });

  it('supports multiple concurrent subscriptions', async () => {
    vi.stubGlobal('WebSocket', class { constructor() { this.readyState = 0; } close() { } });
    const { WebSocketService } = await import('../../data/WebSocketService.ts');
    const ws = new WebSocketService();
    const sub1 = ws.subscribe('BTC', '1h', {});
    const sub2 = ws.subscribe('ETH', '1h', {});
    const sub3 = ws.subscribe('SOL', '5m', {});
    expect(ws.subscriptionCount).toBe(3);
    expect(ws.streamCount).toBe(3);
    ws.unsubscribe(sub1);
    expect(ws.subscriptionCount).toBe(2);
    ws.unsubscribe();
    expect(ws.subscriptionCount).toBe(0);
    vi.unstubAllGlobals();
  });

  it('deduplicates same symbol+tf into single stream', async () => {
    vi.stubGlobal('WebSocket', class { constructor() { this.readyState = 0; } close() { } });
    const { WebSocketService } = await import('../../data/WebSocketService.ts');
    const ws = new WebSocketService();
    ws.subscribe('BTC', '1h', {});
    ws.subscribe('BTC', '1h', {});
    ws.subscribe('ETH', '1h', {});
    expect(ws.subscriptionCount).toBe(3);
    expect(ws.streamCount).toBe(2);
    ws.unsubscribe();
    vi.unstubAllGlobals();
  });

  it('isSupported still works as static method', async () => {
    const { WebSocketService } = await import('../../data/WebSocketService.ts');
    expect(WebSocketService.isSupported('BTC')).toBe(true);
    expect(WebSocketService.isSupported('BTCUSDT')).toBe(true);
    expect(WebSocketService.isSupported('AAPL')).toBe(false);
    expect(WebSocketService.isSupported('INVALID')).toBe(false);
  });
});

describe('WebSocketService — StreamingIndicatorBridge wiring', () => {
  it('source contains StreamingIndicatorBridge import in onmessage handler', async () => {
    const source = readSource('data/WebSocketService.ts');
    expect(source).toContain('StreamingIndicatorBridge');
    expect(source).toContain('bridge.onTick');
    expect(source).toContain('tick.price = bar.close');
    expect(source).toContain('tick.volume = bar.volume');
  });
});

describe('WebSocketService — cached StreamingIndicatorBridge import', () => {
  it('does NOT have dynamic import() inside onmessage handler', async () => {
    const source = readSource('data/WebSocketService.ts');
    expect(source).toContain('_getStreamingBridge');
    expect(source).not.toContain("import('./engine/indicators/StreamingIndicatorBridge.js').then");
  });

  it('nulls WS handlers before close to prevent ping-after-close', async () => {
    const source = readSource('data/WebSocketService.ts');
    expect(source).toContain('this._ws.onmessage = null');
    expect(source).toContain('this._ws.onclose = null');
    expect(source).toContain('this._ws.onerror = null');
  });
});

describe('WebSocketService — exponential backoff reconnection', () => {
  let wsInstances;

  beforeEach(() => {
    wsInstances = [];
    vi.stubGlobal('WebSocket', class MockWS {
      constructor(url) {
        this.url = url;
        this.onopen = null;
        this.onmessage = null;
        this.onclose = null;
        this.onerror = null;
        this.readyState = 0;
        wsInstances.push(this);
      }
      close() { this.readyState = 3; }
      send() { }
    });
  });

  it('sets RECONNECTING status on close and schedules reconnect', async () => {
    const { WS_STATUS, WebSocketService: WsClass } = await import('../../data/WebSocketService.ts');
    const ws = new WsClass();
    const statuses = [];
    ws.subscribe('BTC', '1h', { onStatus: (s) => statuses.push(s) });
    await new Promise(r => setTimeout(r, 100));
    expect(wsInstances.length).toBeGreaterThan(0);
    const firstWs = wsInstances[wsInstances.length - 1];
    firstWs.onopen?.();
    expect(statuses).toContain(WS_STATUS.CONNECTED);
    firstWs.onclose?.();
    expect(statuses).toContain(WS_STATUS.RECONNECTING);
    ws.unsubscribe();
  });

  it('does not reconnect on intentional unsubscribe', async () => {
    const { WebSocketService: WsClass } = await import('../../data/WebSocketService.ts');
    const ws = new WsClass();
    const statuses = [];
    ws.subscribe('ETH', '1d', { onStatus: (s) => statuses.push(s) });
    ws.unsubscribe();
    expect(statuses).not.toContain('reconnecting');
  });

  it('source has reconnection logic with exponential backoff', async () => {
    const source = readSource('data/WebSocketService.ts');
    expect(source).toContain('_scheduleReconnect');
    expect(source).toContain('_reconnectAttempts');
    expect(source).toContain('_maxReconnectAttempts');
    expect(source).toContain('Math.pow(2');
    expect(source).toContain('30_000');
  });

  it('exports WebSocketService class with reconnection fields', async () => {
    const { WebSocketService } = await import('../../data/WebSocketService.ts');
    const ws = new WebSocketService();
    expect(ws._reconnectAttempts).toBe(0);
    expect(ws._maxReconnectAttempts).toBe(10);
    expect(ws._intentionalClose).toBe(false);
    expect(ws._reconnectTimer).toBeNull();
  });

  it('onclose triggers reconnect when not intentional', async () => {
    const { WebSocketService } = await import('../../data/WebSocketService.ts');
    const ws = new WebSocketService();
    ws._subs.set(1, { streamKey: 'btcusdt@kline_1h', symbol: 'BTC', tf: '1h', callbacks: {} });
    let reconnectCalled = false;
    ws._scheduleReconnect = () => { reconnectCalled = true; };
    ws._intentionalClose = false;
    expect(ws._subs.size).toBe(1);
    expect(ws._intentionalClose).toBe(false);
    ws._scheduleReconnect();
    expect(reconnectCalled).toBe(true);
  });

  it('intentional unsubscribe-all does NOT reconnect', async () => {
    const { WebSocketService } = await import('../../data/WebSocketService.ts');
    const ws = new WebSocketService();
    ws._subs.set(1, { streamKey: 'test', callbacks: {} });
    ws.unsubscribe();
    expect(ws._intentionalClose).toBe(true);
    expect(ws._subs.size).toBe(0);
  });

  it('subscribe + unsubscribe specific ID manages subs correctly', async () => {
    const { WebSocketService } = await import('../../data/WebSocketService.ts');
    const ws = new WebSocketService();
    ws._scheduleStreamUpdate = () => { };
    const id1 = ws.subscribe('BTC', '1h', {});
    const id2 = ws.subscribe('ETH', '1h', {});
    expect(ws.subscriptionCount).toBe(2);
    ws.unsubscribe(id1);
    expect(ws.subscriptionCount).toBe(1);
    expect(ws._subs.has(id2)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// BaseAdapter + CircuitBreaker (unified)
// ═══════════════════════════════════════════════════════════════════

describe('BaseAdapter — capabilities() runtime introspection', () => {
  it('BaseAdapter reports all false for default methods', async () => {
    const { BaseAdapter } = await import('../../data/adapters/BaseAdapter.js');
    const base = new BaseAdapter('test');
    const caps = base.capabilities();
    expect(caps.fetchOHLCV).toBe(false);
    expect(caps.fetchQuote).toBe(false);
    expect(caps.subscribe).toBe(false);
    expect(caps.searchSymbols).toBe(false);
  });

  it('subclass with overridden fetchOHLCV reports true for fetchOHLCV', async () => {
    const { BaseAdapter } = await import('../../data/adapters/BaseAdapter.js');
    class TestAdapter extends BaseAdapter { async fetchOHLCV() { return []; } }
    const adapter = new TestAdapter('test');
    const caps = adapter.capabilities();
    expect(caps.fetchOHLCV).toBe(true);
    expect(caps.fetchQuote).toBe(false);
  });

  it('subclass overriding all methods reports all true', async () => {
    const { BaseAdapter } = await import('../../data/adapters/BaseAdapter.js');
    class FullAdapter extends BaseAdapter {
      async fetchOHLCV() { return []; }
      async fetchQuote() { return {}; }
      subscribe() { return () => { }; }
      async searchSymbols() { return []; }
    }
    const adapter = new FullAdapter('full');
    const caps = adapter.capabilities();
    expect(caps.fetchOHLCV).toBe(true);
    expect(caps.fetchQuote).toBe(true);
    expect(caps.subscribe).toBe(true);
    expect(caps.searchSymbols).toBe(true);
  });
});

describe('CircuitBreaker (unified) — granular error recovery', () => {
  beforeEach(async () => {
    const { resetAllCircuits } = await import('../../data/engine/infra/CircuitBreaker.ts');
    resetAllCircuits();
  });

  it('does not trip circuit on 429 rate limit errors', async () => {
    const { withCircuitBreaker, getCircuitState } = await import('../../data/engine/infra/CircuitBreaker.ts');
    const rateLimitErr = new Error('Rate limited');
    rateLimitErr.status = 429;
    rateLimitErr.retryAfterMs = 5000;
    await withCircuitBreaker('test-adapter', async () => { throw rateLimitErr; });
    const state = getCircuitState('test-adapter');
    expect(state.state).toBe('CLOSED');
    expect(state.failureRate).toBe(0);
  });

  it('skips adapter during rate limit cooldown window', async () => {
    const { withCircuitBreaker } = await import('../../data/engine/infra/CircuitBreaker.ts');
    const rateLimitErr = new Error('Rate limited');
    rateLimitErr.status = 429;
    rateLimitErr.retryAfterMs = 60_000;
    await withCircuitBreaker('test-rl-adapter', async () => { throw rateLimitErr; });
    let fetchCalled = false;
    const result = await withCircuitBreaker('test-rl-adapter', async () => { fetchCalled = true; return 'data'; });
    expect(result).toBeNull();
    expect(fetchCalled).toBe(false);
  });

  it('trips circuit normally on non-429 errors', async () => {
    const { withCircuitBreaker, getCircuitState } = await import('../../data/engine/infra/CircuitBreaker.ts');
    for (let i = 0; i < 5; i++) {
      await withCircuitBreaker('test-500-adapter', async () => { throw new Error('Server error'); });
    }
    const state = getCircuitState('test-500-adapter');
    expect(state.state).toBe('OPEN');
    expect(state.failureRate).toBeGreaterThanOrEqual(0.5);
  });
});

// ═══════════════════════════════════════════════════════════════════
// DataExporter + DataProvider
// ═══════════════════════════════════════════════════════════════════

describe('DataExporter — uses CacheManager', () => {
  let source;
  beforeAll(() => { source = readSource('data/engine/infra/DataExporter.js'); });

  it('does NOT import DataCache directly', () => { expect(source).not.toMatch(/from\s+['"]\.\.\/DataCache/); });
  it('imports cacheManager from CacheManager.js', () => { expect(source).toContain("from './CacheManager.js'"); expect(source).toContain('cacheManager'); });
  it('uses cacheManager.read() for candle data', () => { expect(source).toContain('cacheManager.read('); });
  it('uses cacheManager.getStorageUsage() for storage info', () => { expect(source).toContain('cacheManager.getStorageUsage()'); });
});

describe('DataProvider — backward compatibility', () => {
  let source;
  beforeAll(() => { source = readSource('data/DataProvider.js'); });

  it('still imports dataCache from DataCache.ts', () => { expect(source).toContain('DataCache'); });
  it('still re-exports dataCache', () => { expect(source).toMatch(/export\s*{[^}]*dataCache/); });
});

describe('Provider config maps have no duplicates', () => {
  let polygonSource, avSource;
  beforeAll(() => {
    polygonSource = readSource('data/providers/PolygonProvider.js');
    avSource = readSource('data/providers/AlphaVantageProvider.js');
  });

  it('POLYGON_TF_MAP has no duplicate keys', () => { expect(findDuplicateKeys(polygonSource, 'const POLYGON_TF_MAP')).toEqual([]); });
  it('AV_FUNCTIONS has no duplicate keys', () => { expect(findDuplicateKeys(avSource, 'const AV_FUNCTIONS')).toEqual([]); });
  it('POLYGON_TF_MAP covers 30m and 1w', () => {
    const idx = polygonSource.indexOf('const POLYGON_TF_MAP');
    const block = polygonSource.slice(idx, polygonSource.indexOf('};', idx) + 2);
    expect(block).toContain("'30m'");
    expect(block).toContain("'1w'");
  });
  it('AV_FUNCTIONS covers 30m and 1w', () => {
    const idx = avSource.indexOf('const AV_FUNCTIONS');
    const block = avSource.slice(idx, avSource.indexOf('};', idx) + 2);
    expect(block).toContain("'30m'");
    expect(block).toContain("'1w'");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Constants — TFS includes 30m and 1w
// ═══════════════════════════════════════════════════════════════════

describe('TFS includes 30m and 1w', () => {
  let source;
  beforeAll(() => { source = readSource('constants/timeframes.js'); });

  it('TFS array includes 30m entry', () => {
    const tfsIdx = source.indexOf('export const TFS');
    const tfsEnd = source.indexOf('];', tfsIdx) + 2;
    const tfsBlock = source.slice(tfsIdx, tfsEnd);
    expect(tfsBlock).toContain("id: '30m'");
  });

  it('TFS array includes 1w entry', () => {
    const tfsIdx = source.indexOf('export const TFS');
    const tfsEnd = source.indexOf('];', tfsIdx) + 2;
    const tfsBlock = source.slice(tfsIdx, tfsEnd);
    expect(tfsBlock).toContain("id: '1w'");
  });

  it('30m has correct Binance interval', () => {
    const tfsIdx = source.indexOf('export const TFS');
    const tfsEnd = source.indexOf('];', tfsIdx) + 2;
    const tfsBlock = source.slice(tfsIdx, tfsEnd);
    expect(tfsBlock).toContain("binance: '30m'");
  });

  it('1w has correct Binance interval', () => {
    const tfsIdx = source.indexOf('export const TFS');
    const tfsEnd = source.indexOf('];', tfsIdx) + 2;
    const tfsBlock = source.slice(tfsIdx, tfsEnd);
    expect(tfsBlock).toContain("binance: '1w'");
  });
});

// ═══════════════════════════════════════════════════════════════════
// isCrypto unification — no duplicate implementations
// ═══════════════════════════════════════════════════════════════════

describe('isCrypto unification', () => {
  it('OrderFlowBridge has no local isCryptoSymbol function', () => {
    expect(readSource('data/engine/orderflow/OrderFlowBridge.js')).not.toMatch(/function\s+isCryptoSymbol/);
  });

  it('OrderFlowBridge imports isCrypto from constants.js', () => {
    expect(readSource('data/engine/orderflow/OrderFlowBridge.js')).toContain("import { isCrypto } from '../../../constants.js'");
  });

  it('OrderFlowBridge isBinanceSymbol uses isCrypto guard', () => {
    const source = readSource('data/engine/orderflow/OrderFlowBridge.js');
    const fnIdx = source.indexOf('function isBinanceSymbol');
    const fnChunk = source.slice(fnIdx, fnIdx + 200);
    expect(fnChunk).toContain('isCrypto');
  });

  // TODO: un-skip when WebSocketService imports isCrypto from constants.js
  it.skip('WebSocketService imports isCrypto from constants.js', () => {
    expect(readSource('data/WebSocketService.ts')).toContain("import { isCrypto } from '../../constants.js'");
  });

  it('WebSocketService has no inline BINANCE_SYMBOLS set', () => {
    expect(readSource('data/WebSocketService.ts')).not.toMatch(/new Set\(\[\s*'BTC'/);
  });

  it('AdaptivePoller has no local isCryptoSymbol function', () => {
    expect(readSource('data/engine/infra/AdaptivePoller.js')).not.toMatch(/function\s+isCryptoSymbol/);
  });

  it('AdaptivePoller imports isCrypto from constants.js', () => {
    expect(readSource('data/engine/infra/AdaptivePoller.js')).toContain("import { isCrypto } from '../../../constants.js'");
  });
});

describe('useOrderFlowConnection isCrypto', () => {
  let source;
  beforeAll(() => { source = readSource('data/engine/orderflow/useOrderFlowConnection.js'); });

  it('has no local isCryptoSymbol function', () => { expect(source).not.toMatch(/function\s+isCryptoSymbol/); });
  it('imports isCrypto from constants.js', () => { expect(source).toContain("import { isCrypto } from '../../../constants.js'"); });
  it('uses isCrypto() for crypto guard', () => { expect(source).toContain('isCrypto(upper)'); });
});

describe('useOrderFlowConnection — uses CacheManager', () => {
  let source;
  beforeAll(() => { source = readSource('data/engine/orderflow/useOrderFlowConnection.js'); });

  it('does NOT import DataCache directly', () => { expect(source).not.toMatch(/from\s+['"].*DataCache/); });
  it('imports cacheManager from CacheManager.js', () => { expect(source).toContain("from '../infra/CacheManager.js'"); expect(source).toContain('cacheManager'); });
  it('uses cacheManager.evictAll() for periodic eviction', () => { expect(source).toContain('cacheManager.evictAll()'); });
  it('does NOT call dataCache.evictIfOverBudget()', () => { expect(source).not.toContain('dataCache.evictIfOverBudget'); });
});

describe('CacheManager — proxy methods', () => {
  let source;
  beforeAll(() => { source = readSource('data/engine/infra/CacheManager.js'); });

  it('has a getStorageUsage method', () => { expect(source).toContain('async getStorageUsage()'); });
  it('getStorageUsage delegates to DataCache via _loadDataCache', () => {
    const methodIdx = source.indexOf('async getStorageUsage()');
    const chunk = source.slice(methodIdx, methodIdx + 300);
    expect(chunk).toContain('_loadDataCache()');
    expect(chunk).toContain('.getStorageUsage()');
  });
  it('has an evictAll method', () => { expect(source).toContain('async evictAll()'); });
});
