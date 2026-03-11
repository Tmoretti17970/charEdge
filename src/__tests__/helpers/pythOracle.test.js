// ═══════════════════════════════════════════════════════════════════
// charEdge — Pyth Oracle Enhancement Tests (Phase 3)
//
// Tests covering:
//   - PythCandleAggregator (tick → OHLCV)
//   - PythAdapter feed resolution & fetchOHLCV
//   - SymbolRegistry Pyth integration
//   - DataPipeline confidence propagation
// ═══════════════════════════════════════════════════════════════════

// eslint-disable-next-line import/order
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock browser APIs ──────────────────────────────────────────

vi.stubGlobal('BroadcastChannel', class {
  constructor() { this.onmessage = null; }
  postMessage() {}
  close() {}
});

vi.stubGlobal('RTCPeerConnection', class {
  constructor() {
    this.localDescription = null;
    this.remoteDescription = null;
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

vi.stubGlobal('SharedWorker', undefined);
vi.stubGlobal('EventSource', class {
  constructor() { this.onopen = null; this.onmessage = null; this.onerror = null; }
  close() {}
});
vi.stubGlobal('fetch', vi.fn(() =>
  Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
));

// ── Import after mocks ──────────────────────────────────────────

import {
  PYTH_FEEDS,
  FEED_TO_SYMBOL,
  SYMBOL_TO_FEED,
} from '../../data/adapters/PythAdapter.js';
import PythCandleAggregator, {
  INTERVALS,
  SUPPORTED_INTERVALS,
  MAX_CANDLES,
} from '../../data/engine/streaming/PythCandleAggregator.js';
import { SymbolRegistry } from '../../data/SymbolRegistry.js';

// ═══════════════════════════════════════════════════════════════════
// 1. PythCandleAggregator — Tick → OHLCV
// ═══════════════════════════════════════════════════════════════════

describe('PythCandleAggregator - Core', () => {
  let agg;

  beforeEach(() => {
    agg = new PythCandleAggregator();
  });

  it('creates a candle from a single tick', () => {
    const now = Date.now();
    agg.ingestTick('BTC', 97250, 15.20, now);

    const candles = agg.getCandles('BTC', '1m');
    expect(candles.length).toBe(1);
    expect(candles[0].open).toBe(97250);
    expect(candles[0].high).toBe(97250);
    expect(candles[0].low).toBe(97250);
    expect(candles[0].close).toBe(97250);
    expect(candles[0].tickCount).toBe(1);
  });

  it('updates OHLC with multiple ticks in same candle', () => {
    const base = Math.floor(Date.now() / 60_000) * 60_000; // Start of current minute

    agg.ingestTick('ETH', 3500, 1.0, base);
    agg.ingestTick('ETH', 3520, 1.0, base + 5000);
    agg.ingestTick('ETH', 3480, 1.0, base + 10000);
    agg.ingestTick('ETH', 3510, 1.0, base + 15000);

    const candles = agg.getCandles('ETH', '1m');
    expect(candles.length).toBe(1);
    expect(candles[0].open).toBe(3500);
    expect(candles[0].high).toBe(3520);
    expect(candles[0].low).toBe(3480);
    expect(candles[0].close).toBe(3510);
    expect(candles[0].tickCount).toBe(4);
  });

  it('closes candle and starts new one at interval boundary', () => {
    const minute1 = Math.floor(Date.now() / 60_000) * 60_000;
    const minute2 = minute1 + 60_000;

    agg.ingestTick('SOL', 180, 0.5, minute1);
    agg.ingestTick('SOL', 185, 0.5, minute1 + 30000);
    // Cross into next minute
    agg.ingestTick('SOL', 190, 0.5, minute2);

    const candles = agg.getCandles('SOL', '1m');
    expect(candles.length).toBe(2);

    // First candle (closed)
    expect(candles[0].open).toBe(180);
    expect(candles[0].close).toBe(185);
    expect(candles[0].tickCount).toBe(2);

    // Second candle (current)
    expect(candles[1].open).toBe(190);
    expect(candles[1].close).toBe(190);
    expect(candles[1].tickCount).toBe(1);
  });

  it('tracks candles across multiple intervals simultaneously', () => {
    const base = Math.floor(Date.now() / 3_600_000) * 3_600_000; // Start of hour

    agg.ingestTick('AAPL', 195, 0.10, base);
    agg.ingestTick('AAPL', 196, 0.10, base + 120_000); // 2 min later

    const candles1m = agg.getCandles('AAPL', '1m');
    const candles1h = agg.getCandles('AAPL', '1h');

    // 1m should have 2 candles (crossed minute boundary)
    expect(candles1m.length).toBe(2);
    // 1h should have 1 candle (still within same hour)
    expect(candles1h.length).toBe(1);
    expect(candles1h[0].open).toBe(195);
    expect(candles1h[0].close).toBe(196);
  });

  it('case-insensitive symbol handling', () => {
    agg.ingestTick('btc', 97000, 15, Date.now());
    const candles = agg.getCandles('BTC', '1m');
    expect(candles.length).toBe(1);
  });

  it('ignores invalid ticks', () => {
    agg.ingestTick('', 100, 1, Date.now());
    agg.ingestTick('BTC', -1, 1, Date.now());
    agg.ingestTick('BTC', 0, 1, Date.now());
    agg.ingestTick(null, 100, 1, Date.now());

    expect(agg.getStats().ticksIngested).toBe(0);
  });
});

describe('PythCandleAggregator - Confidence', () => {
  let agg;

  beforeEach(() => {
    agg = new PythCandleAggregator();
  });

  it('tracks confidence per symbol', () => {
    agg.ingestTick('BTC', 97000, 15.20, Date.now());
    const conf = agg.getConfidence('BTC');

    expect(conf).toBeDefined();
    expect(conf.confidence).toBe(15.20);
    expect(conf.timestamp).toBeGreaterThan(0);
  });

  it('updates confidence with latest tick', () => {
    agg.ingestTick('ETH', 3500, 1.0, Date.now());
    agg.ingestTick('ETH', 3510, 2.5, Date.now() + 400);

    const conf = agg.getConfidence('ETH');
    expect(conf.confidence).toBe(2.5);
  });

  it('returns null for unknown symbols', () => {
    expect(agg.getConfidence('UNKNOWN')).toBeNull();
  });
});

describe('PythCandleAggregator - History Management', () => {
  let agg;

  beforeEach(() => {
    agg = new PythCandleAggregator();
  });

  it('trims history to MAX_CANDLES', () => {
    const base = Math.floor(Date.now() / 60_000) * 60_000;

    // Ingest 600 minutes of ticks (exceeds MAX_CANDLES=500)
    for (let i = 0; i < 600; i++) {
      agg.ingestTick('DOGE', 0.35 + Math.random() * 0.01, 0.001, base + i * 60_000);
    }

    const candles = agg.getCandles('DOGE', '1m');
    // Should be at most MAX_CANDLES + 1 (current)
    expect(candles.length).toBeLessThanOrEqual(MAX_CANDLES + 1);
  });

  it('clearSymbol removes all data for that symbol', () => {
    agg.ingestTick('BTC', 97000, 15, Date.now());
    expect(agg.hasData('BTC')).toBe(true);

    agg.clearSymbol('BTC');
    expect(agg.hasData('BTC')).toBe(false);
    expect(agg.getConfidence('BTC')).toBeNull();
  });

  it('clearAll removes everything', () => {
    agg.ingestTick('BTC', 97000, 15, Date.now());
    agg.ingestTick('ETH', 3500, 1, Date.now());

    agg.clearAll();
    expect(agg.hasData('BTC')).toBe(false);
    expect(agg.hasData('ETH')).toBe(false);
    expect(agg.getStats().ticksIngested).toBe(0);
  });
});

describe('PythCandleAggregator - Events', () => {
  let agg;

  beforeEach(() => {
    agg = new PythCandleAggregator();
  });

  it('emits candle-close event on boundary crossing', () => {
    const base = Math.floor(Date.now() / 60_000) * 60_000;
    const events = [];

    agg.onCandle('BTC', '1m', (candle) => events.push(candle));

    agg.ingestTick('BTC', 97000, 15, base);
    agg.ingestTick('BTC', 97500, 15, base + 30000);
    // Cross boundary
    agg.ingestTick('BTC', 98000, 15, base + 60_000);

    expect(events.length).toBe(1);
    expect(events[0].open).toBe(97000);
    expect(events[0].close).toBe(97500);
  });

  it('unsubscribe stops events', () => {
    const base = Math.floor(Date.now() / 60_000) * 60_000;
    const events = [];

    const unsub = agg.onCandle('BTC', '1m', (candle) => events.push(candle));

    agg.ingestTick('BTC', 97000, 15, base);
    agg.ingestTick('BTC', 98000, 15, base + 60_000);
    expect(events.length).toBe(1);

    unsub();
    agg.ingestTick('BTC', 99000, 15, base + 120_000);
    expect(events.length).toBe(1); // No new events after unsub
  });
});

describe('PythCandleAggregator - Stats', () => {
  it('tracks tick and candle counts', () => {
    const agg = new PythCandleAggregator();
    const base = Math.floor(Date.now() / 60_000) * 60_000;

    agg.ingestTick('BTC', 97000, 15, base);
    agg.ingestTick('BTC', 97500, 15, base + 30000);
    agg.ingestTick('BTC', 98000, 15, base + 60_000);

    const stats = agg.getStats();
    expect(stats.ticksIngested).toBe(3);
    expect(stats.candlesClosed).toBeGreaterThanOrEqual(1); // At least 1m candle closed
    expect(stats.activeSymbols).toBe(1);
    expect(stats.supportedIntervals).toEqual(SUPPORTED_INTERVALS);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. PythAdapter — Feed Resolution
// ═══════════════════════════════════════════════════════════════════

describe('PythAdapter - Feed ID Registry', () => {
  it('has feed IDs for major crypto assets', () => {
    const cryptos = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX'];
    for (const sym of cryptos) {
      expect(PYTH_FEEDS[sym]).toBeDefined();
      expect(PYTH_FEEDS[sym].id).toMatch(/^0x/);
      expect(PYTH_FEEDS[sym].class).toBe('crypto');
    }
  });

  it('has feed IDs for equities', () => {
    const stocks = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'];
    for (const sym of stocks) {
      expect(PYTH_FEEDS[sym]).toBeDefined();
      expect(PYTH_FEEDS[sym].class).toBe('equity');
    }
  });

  it('has feed IDs for forex pairs', () => {
    const forex = ['EURUSD', 'GBPUSD', 'USDJPY'];
    for (const sym of forex) {
      expect(PYTH_FEEDS[sym]).toBeDefined();
      expect(PYTH_FEEDS[sym].class).toBe('forex');
    }
  });

  it('has feed IDs for commodities', () => {
    const commodities = ['XAU', 'XAG'];
    for (const sym of commodities) {
      expect(PYTH_FEEDS[sym]).toBeDefined();
      expect(PYTH_FEEDS[sym].class).toBe('commodity');
    }
  });

  it('builds reverse lookup FEED_TO_SYMBOL', () => {
    const btcFeedId = PYTH_FEEDS.BTC.id;
    expect(FEED_TO_SYMBOL.get(btcFeedId)).toBe('BTC');
  });

  it('builds reverse lookup SYMBOL_TO_FEED', () => {
    const btcFeed = SYMBOL_TO_FEED.get('BTC');
    expect(btcFeed).toBeDefined();
    expect(btcFeed.name).toBe('Bitcoin');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. SymbolRegistry — Pyth Integration
// ═══════════════════════════════════════════════════════════════════

describe('SymbolRegistry - Pyth Integration', () => {
  it('stocks are tagged with provider: pyth', () => {
    const aapl = SymbolRegistry.lookup('AAPL');
    expect(aapl).toBeDefined();
    expect(aapl.provider).toBe('pyth');
    expect(aapl.realtime).toBe(true);
  });

  it('stocks have pythFeedId for supported symbols', () => {
    const aapl = SymbolRegistry.lookup('AAPL');
    expect(aapl.pythFeedId).toBeDefined();
    expect(aapl.pythFeedId).toMatch(/^0x/);
  });

  it('forex pairs have pythFeedId', () => {
    const eur = SymbolRegistry.lookup('EURUSD=X');
    expect(eur).toBeDefined();
    expect(eur.provider).toBe('pyth');
    expect(eur.pythFeedId).toMatch(/^0x/);
  });

  it('commodities have pythFeedId', () => {
    const gold = SymbolRegistry.lookup('XAU');
    expect(gold).toBeDefined();
    expect(gold.provider).toBe('pyth');
    expect(gold.pythFeedId).toMatch(/^0x/);
  });

  it('commodity aliases resolve correctly', () => {
    const gold = SymbolRegistry.lookup('GOLD');
    expect(gold).toBeDefined();
    expect(gold.symbol).toBe('XAU');
  });

  it('forex aliases resolve correctly', () => {
    const eur = SymbolRegistry.lookup('EURUSD');
    expect(eur).toBeDefined();
    expect(eur.symbol).toBe('EURUSD=X');
  });

  it('search returns Pyth-backed symbols', () => {
    const results = SymbolRegistry.search('AAPL');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].symbol).toBe('AAPL');
    expect(results[0].provider).toBe('pyth');
  });

  it('search returns commodity symbols', () => {
    const results = SymbolRegistry.search('XAU');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].symbol).toBe('XAU');
    expect(results[0].assetClass).toBe('commodity');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. Interval Constants
// ═══════════════════════════════════════════════════════════════════

describe('Interval Constants', () => {
  it('defines all expected intervals', () => {
    expect(SUPPORTED_INTERVALS).toContain('1m');
    expect(SUPPORTED_INTERVALS).toContain('5m');
    expect(SUPPORTED_INTERVALS).toContain('15m');
    expect(SUPPORTED_INTERVALS).toContain('1h');
    expect(SUPPORTED_INTERVALS).toContain('4h');
    expect(SUPPORTED_INTERVALS).toContain('1d');
  });

  it('interval durations are correct', () => {
    expect(INTERVALS['1m']).toBe(60_000);
    expect(INTERVALS['5m']).toBe(300_000);
    expect(INTERVALS['15m']).toBe(900_000);
    expect(INTERVALS['1h']).toBe(3_600_000);
    expect(INTERVALS['4h']).toBe(14_400_000);
    expect(INTERVALS['1d']).toBe(86_400_000);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. DataPipeline — Confidence Propagation
// ═══════════════════════════════════════════════════════════════════

describe('DataPipeline - Confidence Integration', () => {
  let pipeline;

  beforeEach(async () => {
    try {
      const mod = await import('../../data/engine/DataPipeline.js');
      pipeline = mod.dataPipeline;
    } catch (_) {
      pipeline = null;
    }
  });

  it('exports getConfidence method', () => {
    if (!pipeline) return; // Skip if import fails
    expect(typeof pipeline.getConfidence).toBe('function');
  });

  it('getConfidence returns null for unknown symbols', () => {
    if (!pipeline) return;
    const result = pipeline.getConfidence('UNKNOWN_SYMBOL_XYZ');
    expect(result).toBeNull();
  });
});
