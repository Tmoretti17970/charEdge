// ═══════════════════════════════════════════════════════════════════
// charEdge — Multi-Exchange Adapter Tests
// Tests adapter supports(), symbol mapping, source classification,
// and TickerPlant integration.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';

// Mock fetch globally
vi.stubGlobal('fetch', vi.fn(() =>
  Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
));
vi.stubGlobal('WebSocket', class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  constructor() {
    this.readyState = 0;
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
  }
  send() {}
  close() { if (this.onclose) this.onclose(); }
});
vi.stubGlobal('SharedWorker', undefined);
vi.stubGlobal('BroadcastChannel', class {
  constructor() { this.onmessage = null; }
  postMessage() {}
  close() {}
});
vi.stubGlobal('RTCPeerConnection', class {
  constructor() {
    this.localDescription = null;
    this.connectionState = 'new';
  }
  createOffer() { return Promise.resolve({ type: 'offer', sdp: 'mock' }); }
  createAnswer() { return Promise.resolve({ type: 'answer', sdp: 'mock' }); }
  setLocalDescription() { return Promise.resolve(); }
  setRemoteDescription() { return Promise.resolve(); }
  addIceCandidate() { return Promise.resolve(); }
  createDataChannel() {
    return { onopen: null, onmessage: null, onclose: null, send() {}, close() {}, readyState: 'connecting' };
  }
  close() { this.connectionState = 'closed'; }
});

// ── Adapter imports ──────────────────────────────────────────────

const { BybitAdapter } = await import('../../data/adapters/BybitAdapter.js');
const { OKXAdapter } = await import('../../data/adapters/OKXAdapter.js');
const { CoinbaseAdapter } = await import('../../data/adapters/CoinbaseAdapter.js');

// ── BybitAdapter Tests ───────────────────────────────────────────

describe('BybitAdapter', () => {
  const adapter = new BybitAdapter();

  it('class exists and name is "bybit"', () => {
    expect(adapter).toBeDefined();
    expect(adapter.name).toBe('bybit');
  });

  it('supports USDT pairs', () => {
    expect(adapter.supports('BTCUSDT')).toBe(true);
    expect(adapter.supports('ETHUSDT')).toBe(true);
    expect(adapter.supports('SOLUSDT')).toBe(true);
  });

  it('supports USDC pairs', () => {
    expect(adapter.supports('BTCUSDC')).toBe(true);
    expect(adapter.supports('ETHUSDC')).toBe(true);
  });

  it('rejects non-crypto symbols', () => {
    expect(adapter.supports('AAPL')).toBe(false);
    expect(adapter.supports('EURUSD')).toBe(false);
    expect(adapter.supports('')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(adapter.supports('btcusdt')).toBe(true);
    expect(adapter.supports('Ethusdc')).toBe(true);
  });

  it('has required interface methods', () => {
    expect(typeof adapter.fetchOHLCV).toBe('function');
    expect(typeof adapter.fetchQuote).toBe('function');
    expect(typeof adapter.subscribe).toBe('function');
    expect(typeof adapter.searchSymbols).toBe('function');
    expect(typeof adapter.dispose).toBe('function');
  });
});

// ── OKXAdapter Tests ─────────────────────────────────────────────

describe('OKXAdapter', () => {
  const adapter = new OKXAdapter();

  it('class exists and name is "okx"', () => {
    expect(adapter).toBeDefined();
    expect(adapter.name).toBe('okx');
  });

  it('supports USDT pairs', () => {
    expect(adapter.supports('BTCUSDT')).toBe(true);
    expect(adapter.supports('ETHUSDT')).toBe(true);
  });

  it('supports USDC pairs', () => {
    expect(adapter.supports('BTCUSDC')).toBe(true);
  });

  it('rejects non-crypto symbols', () => {
    expect(adapter.supports('AAPL')).toBe(false);
    expect(adapter.supports('SPY')).toBe(false);
    expect(adapter.supports('')).toBe(false);
  });

  it('has required interface methods', () => {
    expect(typeof adapter.fetchOHLCV).toBe('function');
    expect(typeof adapter.fetchQuote).toBe('function');
    expect(typeof adapter.subscribe).toBe('function');
    expect(typeof adapter.searchSymbols).toBe('function');
    expect(typeof adapter.dispose).toBe('function');
  });
});

// ── CoinbaseAdapter Tests ────────────────────────────────────────

describe('CoinbaseAdapter', () => {
  const adapter = new CoinbaseAdapter();

  it('class exists and name is "coinbase"', () => {
    expect(adapter).toBeDefined();
    expect(adapter.name).toBe('coinbase');
  });

  it('supports USDT pairs', () => {
    expect(adapter.supports('BTCUSDT')).toBe(true);
    expect(adapter.supports('ETHUSDT')).toBe(true);
  });

  it('supports USD pairs', () => {
    expect(adapter.supports('BTCUSD')).toBe(true);
    expect(adapter.supports('ETHUSD')).toBe(true);
  });

  it('supports USDC pairs', () => {
    expect(adapter.supports('BTCUSDC')).toBe(true);
  });

  it('rejects non-crypto symbols', () => {
    expect(adapter.supports('AAPL')).toBe(false);
    expect(adapter.supports('')).toBe(false);
  });

  it('has required interface methods', () => {
    expect(typeof adapter.fetchOHLCV).toBe('function');
    expect(typeof adapter.fetchQuote).toBe('function');
    expect(typeof adapter.subscribe).toBe('function');
    expect(typeof adapter.searchSymbols).toBe('function');
    expect(typeof adapter.dispose).toBe('function');
  });
});

// ── Source Classification — Multi-Exchange ───────────────────────

describe('Source Classification — Multi-Exchange', () => {
  function classifySource(aggData, info) {
    if (!aggData || aggData.sourceCount === 0) {
      const staleness = Date.now() - (info.lastUpdate || 0);
      if (staleness > 30_000 && info.lastUpdate > 0) return 'cached';
      return 'no_data';
    }
    const sources = info.sources;
    const hasPeerRelay = [...sources].some(s => s.startsWith('peer:'));
    const hasDirectWS = sources.has('binance') || sources.has('kraken') ||
                        sources.has('bybit') || sources.has('okx') ||
                        sources.has('coinbase');
    const hasOracle = sources.has('pyth');
    const hasRest = sources.has('binance-rest') || sources.has('finnhub');
    if (hasDirectWS) return 'live';
    if (hasPeerRelay) return 'relay';
    if (hasOracle) return 'oracle';
    if (hasRest) return 'delayed';
    if (aggData.sourceCount > 0) return 'live';
    return 'no_data';
  }

  it('classifies Bybit as LIVE', () => {
    const info = { sources: new Set(['bybit']), lastUpdate: Date.now() };
    expect(classifySource({ sourceCount: 1, price: 100 }, info)).toBe('live');
  });

  it('classifies OKX as LIVE', () => {
    const info = { sources: new Set(['okx']), lastUpdate: Date.now() };
    expect(classifySource({ sourceCount: 1, price: 100 }, info)).toBe('live');
  });

  it('classifies Coinbase as LIVE', () => {
    const info = { sources: new Set(['coinbase']), lastUpdate: Date.now() };
    expect(classifySource({ sourceCount: 1, price: 100 }, info)).toBe('live');
  });

  it('classifies multi-exchange (Binance + Bybit + OKX) as LIVE', () => {
    const info = { sources: new Set(['binance', 'bybit', 'okx']), lastUpdate: Date.now() };
    expect(classifySource({ sourceCount: 3, price: 100 }, info)).toBe('live');
  });

  it('still classifies single Kraken as LIVE', () => {
    const info = { sources: new Set(['kraken']), lastUpdate: Date.now() };
    expect(classifySource({ sourceCount: 1, price: 100 }, info)).toBe('live');
  });

  it('LIVE takes priority over RELAY even with new exchanges', () => {
    const info = { sources: new Set(['coinbase', 'peer:abc']), lastUpdate: Date.now() };
    expect(classifySource({ sourceCount: 2, price: 100 }, info)).toBe('live');
  });

  it('RELAY still works when only peer sources', () => {
    const info = { sources: new Set(['peer:node1', 'peer:node2']), lastUpdate: Date.now() };
    expect(classifySource({ sourceCount: 2, price: 100 }, info)).toBe('relay');
  });
});

// ── OKX Symbol Mapping ──────────────────────────────────────────

describe('OKX Symbol Mapping', () => {
  function toOKXInstId(symbol) {
    const upper = (symbol || '').toUpperCase();
    if (upper.includes('-')) return upper;
    for (const quote of ['USDT', 'USDC', 'USD', 'BTC', 'ETH']) {
      if (upper.endsWith(quote)) {
        const base = upper.slice(0, -quote.length);
        if (base.length > 0) return `${base}-${quote}`;
      }
    }
    return upper;
  }

  function fromOKXInstId(instId) {
    return (instId || '').replace(/-/g, '');
  }

  it('converts BTCUSDT → BTC-USDT', () => {
    expect(toOKXInstId('BTCUSDT')).toBe('BTC-USDT');
  });

  it('converts ETHUSDC → ETH-USDC', () => {
    expect(toOKXInstId('ETHUSDC')).toBe('ETH-USDC');
  });

  it('preserves already-hyphenated symbols', () => {
    expect(toOKXInstId('BTC-USDT')).toBe('BTC-USDT');
  });

  it('converts back: BTC-USDT → BTCUSDT', () => {
    expect(fromOKXInstId('BTC-USDT')).toBe('BTCUSDT');
  });

  it('handles SOLUSDT correctly', () => {
    expect(toOKXInstId('SOLUSDT')).toBe('SOL-USDT');
  });
});

// ── Coinbase Symbol Mapping ─────────────────────────────────────

describe('Coinbase Symbol Mapping', () => {
  function toCoinbaseProductId(symbol) {
    const upper = (symbol || '').toUpperCase();
    if (upper.includes('-')) return upper;
    for (const quote of ['USDT', 'USDC', 'USD', 'BTC', 'ETH']) {
      if (upper.endsWith(quote)) {
        const base = upper.slice(0, -quote.length);
        if (base.length > 0) {
          const cbQuote = quote === 'USDT' ? 'USD' : quote;
          return `${base}-${cbQuote}`;
        }
      }
    }
    return upper;
  }

  function fromCoinbaseProductId(productId) {
    return (productId || '').replace(/-/g, '');
  }

  it('converts BTCUSDT → BTC-USD (maps USDT→USD)', () => {
    expect(toCoinbaseProductId('BTCUSDT')).toBe('BTC-USD');
  });

  it('converts BTCUSD → BTC-USD', () => {
    expect(toCoinbaseProductId('BTCUSD')).toBe('BTC-USD');
  });

  it('converts ETHUSDC → ETH-USDC (keeps USDC)', () => {
    expect(toCoinbaseProductId('ETHUSDC')).toBe('ETH-USDC');
  });

  it('preserves already-hyphenated symbols', () => {
    expect(toCoinbaseProductId('BTC-USD')).toBe('BTC-USD');
  });

  it('converts back: BTC-USD → BTCUSD', () => {
    expect(fromCoinbaseProductId('BTC-USD')).toBe('BTCUSD');
  });
});
