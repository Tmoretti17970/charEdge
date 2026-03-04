// ═══════════════════════════════════════════════════════════════════
// charEdge v11 — Ticker Plant
//
// Orchestrator that manages data source connections and feeds the
// PriceAggregator. This is the "heart of the system" — it:
//
//   1. Connects to all available data sources (Binance, Pyth, etc.)
//   2. Routes incoming prices to the PriceAggregator
//   3. Emits stabilized, aggregated prices to subscribers
//   4. Provides system health monitoring
//
// Modes:
//   Client-Only — Runs entirely in the browser (current)
//   Hub Mode    — Runs on a server, broadcasts to clients (future)
//
// Usage:
//   import { tickerPlant } from './TickerPlant.js';
//   tickerPlant.watch('BTCUSDT');
//   tickerPlant.subscribe('BTCUSDT', ({ price, confidence }) => { ... });
//   tickerPlant.start();
// ═══════════════════════════════════════════════════════════════════

import { priceAggregator, CONFIDENCE } from './PriceAggregator.js';
import { logger } from '../../../utils/logger.js';
import { BinaryCodec, MSG_TYPE } from '../infra/BinaryCodec.js';
import { pythAdapter } from '../../adapters/PythAdapter.js';
import { finnhubAdapter } from '../../adapters/FinnhubAdapter.js';
import { forexAdapter } from '../../adapters/ForexAdapter.js';
import { krakenAdapter } from '../../adapters/KrakenAdapter.js';
import { bybitAdapter } from '../../adapters/BybitAdapter.js';
import { okxAdapter } from '../../adapters/OKXAdapter.js';
import { coinbaseAdapter } from '../../adapters/CoinbaseAdapter.js';
import { adaptivePoller } from '../infra/AdaptivePoller.js';

// ─── Type Definitions ───────────────────────────────────────────

/** Incoming price data from a source adapter callback. */
export interface PriceUpdate {
  price: number;
  timestamp: number;
  confidence: number;
  volume: number;
}

/** Callback type for price update subscriptions. */
export type PriceCallback = (data: PriceUpdate) => void;

/** Contract for external data source adapters. */
export interface SourceAdapter {
  id: string;
  name: string;
  assetClasses: string[];
  available: boolean;
  subscribe: ((symbol: string, callback: PriceCallback) => any) | null;
  fetchQuote?: ((symbol: string) => Promise<QuoteResult | null>) | null;
  supports?: (symbol: string) => boolean;
}

/** Result of a single-quote fetch. */
export interface QuoteResult {
  price: number;
  confidence: number;
  source?: string;
}

/** Tracked watch entry for a symbol. */
interface WatchEntry {
  unsubs: (() => void)[];
  active: boolean;
}

/** Per-source health tracking data. */
interface AdapterHealthData {
  lastUpdate: number;
  errors: number;
  successes: number;
  lastPrice: number;
  consecutiveStale: number;
  avgLatencyMs: number;
}

/** Bandwidth tracking counters. */
interface BandwidthCounters {
  jsonBytesIn: number;
  binaryBytesOut: number;
  messagesProcessed: number;
  startTime: number;
}

/** Bandwidth metrics returned by getBandwidthMetrics(). */
export interface BandwidthMetrics {
  jsonBytesIn: number;
  binaryBytesOut: number;
  messagesProcessed: number;
  uptimeSeconds: number;
  avgMessageRate: string;
  savings: string;
}

/** Per-source health status with computed score. */
export interface SourceHealthStatus {
  score: number;
  level: 'healthy' | 'degraded' | 'unhealthy';
  lastUpdate: number | null;
  freshness: number | null;
  errors: number;
  successes: number;
  errorRate: number;
  consecutiveStale: number;
  avgLatencyMs: number;
}

/** Full source status entry. */
export interface SourceStatus {
  name: string;
  available: boolean;
  assetClasses: string[];
  hasStreaming: boolean;
  hasRest: boolean;
  health: SourceHealthStatus;
}

/** Overall health status of the ticker plant. */
export interface HealthStatus {
  running: boolean;
  sources: Record<string, SourceStatus>;
  watchedSymbols: string[];
  aggregator: unknown;
  bandwidth: BandwidthMetrics;
}

/** Bandwidth benchmark result per message type. */
export interface BenchmarkResult {
  candle: unknown;
  tick: unknown;
  quote: unknown;
  candleBatch200: unknown;
}

/** SharedWorker message envelope. */
interface SharedWorkerMessage {
  type: string;
  clientId?: number;
  totalClients?: number;
  symbol?: string;
  sourceId?: string;
  price?: number;
  timestamp?: number;
  data?: {
    sourceId: string;
    price: number;
    timestamp: number;
    confidence: number;
  };
}

// ─── Ticker Plant Class ─────────────────────────────────────────

class _TickerPlant {
  private _sources: Map<string, SourceAdapter>;
  private _watched: Map<string, WatchEntry>;
  private _subscribers: Map<string, Set<PriceCallback>>;
  private _running: boolean;
  private _pollIntervals: Map<string, string>;
  private _healthListeners: Set<(health: HealthStatus) => void>;
  private _sharedWorker: SharedWorker | null;
  private _sharedWorkerPort: MessagePort | null;
  private _prefetchCooldown: Map<string, number>;
  private _prefetchTTL: number;
  private _bandwidth: BandwidthCounters;
  private _adapterHealth: Map<string, AdapterHealthData>;

  /** Correlation maps for predictive prefetch. */
  static _CORRELATIONS: Record<string, string[]> = {
    // Crypto — major pairs move together
    BTCUSDT: ['ETHUSDT', 'SOLUSDT', 'BNBUSDT'],
    ETHUSDT: ['BTCUSDT', 'LINKUSDT', 'MATICUSDT'],
    SOLUSDT: ['BTCUSDT', 'AVAXUSDT'],
    BNBUSDT: ['BTCUSDT', 'ETHUSDT'],
    // Equity indices — correlated
    SPY: ['QQQ', 'DIA', 'IWM', 'VIX'],
    QQQ: ['SPY', 'AAPL', 'MSFT', 'NVDA'],
    DIA: ['SPY', 'QQQ'],
    IWM: ['SPY'],
    // Big tech — sector moves
    AAPL: ['QQQ', 'MSFT'],
    MSFT: ['QQQ', 'AAPL'],
    NVDA: ['QQQ', 'AMD', 'SMCI'],
    AMD:  ['NVDA', 'QQQ'],
    TSLA: ['QQQ', 'ARKK'],
    AMZN: ['QQQ', 'GOOGL'],
    GOOGL: ['QQQ', 'META'],
    META: ['QQQ', 'GOOGL'],
    // Forex — correlated pairs
    'EURUSD=X': ['GBPUSD=X', 'DXY'],
    'GBPUSD=X': ['EURUSD=X'],
    'USDJPY=X': ['DXY', 'EURJPY=X'],
    // VIX inverse correlation with SPY
    VIX: ['SPY', 'QQQ'],
  };

  constructor() {
    this._sources = new Map();
    this._watched = new Map();
    this._subscribers = new Map();
    this._running = false;
    this._pollIntervals = new Map();
    this._healthListeners = new Set();
    this._sharedWorker = null;
    this._sharedWorkerPort = null;
    this._prefetchCooldown = new Map();
    this._prefetchTTL = 5 * 60 * 1000;

    this._bandwidth = {
      jsonBytesIn: 0,
      binaryBytesOut: 0,
      messagesProcessed: 0,
      startTime: Date.now(),
    };

    this._adapterHealth = new Map();

    this._registerBuiltInSources();
    this._initSharedWorker();
  }

  // ─── Public API ─────────────────────────────────────────────

  /**
   * Start the ticker plant.
   * Begins the aggregation loop and connects to sources for watched symbols.
   */
  start(): void {
    if (this._running) return;
    this._running = true;

    priceAggregator.start();

    for (const [symbol] of this._watched) {
      this._connectSymbol(symbol);
    }

    logger.data.info(`[TickerPlant] Started with ${this._sources.size} sources, watching ${this._watched.size} symbols`);
  }

  /**
   * Stop the ticker plant.
   * Disconnects all source connections and stops aggregation.
   */
  stop(): void {
    this._running = false;
    priceAggregator.stop();

    for (const [symbol, entry] of this._watched) {
      this._disconnectSymbol(symbol);
      entry.active = false;
    }

    for (const [, id] of this._pollIntervals) {
      clearInterval(id as any);
    }
    this._pollIntervals.clear();

    logger.data.info('[TickerPlant] Stopped');
  }

  /**
   * Watch a symbol — connect it to all available data sources.
   * @param symbol - e.g. 'BTCUSDT', 'AAPL', 'EURUSD=X'
   */
  watch(symbol: string): void {
    const upper = (symbol || '').toUpperCase();
    if (!upper) return;

    if (this._watched.has(upper)) return;

    this._watched.set(upper, { unsubs: [], active: true });

    if (this._running) {
      this._connectSymbol(upper);
    }

    this._predictivePrefetch(upper);
  }

  /**
   * Stop watching a symbol — disconnect all source connections.
   * @param symbol - Symbol to stop watching
   */
  unwatch(symbol: string): void {
    const upper = (symbol || '').toUpperCase();
    this._disconnectSymbol(upper);
    this._watched.delete(upper);
    priceAggregator.removeSymbol(upper);
  }

  /**
   * Subscribe to aggregated price updates for a symbol.
   * @param symbol - Symbol to subscribe to
   * @param callback - Receives aggregated price updates
   * @returns Unsubscribe function
   */
  subscribe(symbol: string, callback: PriceCallback): () => void {
    return priceAggregator.subscribe(symbol, callback);
  }

  /**
   * Get the latest aggregated price for a symbol.
   * @param symbol - Symbol to query
   * @returns Latest aggregated price data, or null
   */
  getPrice(symbol: string): unknown | null {
    return priceAggregator.getLatest(symbol?.toUpperCase());
  }

  /**
   * Fetch a one-time quote for a symbol from the best available source.
   * Does NOT start watching or subscribing.
   * @param symbol - Symbol to fetch
   * @returns Quote with price, confidence, and source ID
   */
  async fetchQuote(symbol: string): Promise<QuoteResult | null> {
    const upper = (symbol || '').toUpperCase();

    for (const source of this._sources.values()) {
      if (!source.available || !source.fetchQuote) continue;

      try {
        const quote = await source.fetchQuote(upper);
        if (quote && quote.price > 0) {
          priceAggregator.ingest(upper, source.id, quote.price, Date.now(), quote.confidence || 0);
          return { ...quote, source: source.id };
        }
      } catch {
        // Try next source
      }
    }

    return null;
  }

  /** Get the health status of the entire ticker plant. */
  getHealth(): HealthStatus {
    return {
      running: this._running,
      sources: this._getSourceStatus(),
      watchedSymbols: Array.from(this._watched.keys()),
      aggregator: priceAggregator.getStats(),
      bandwidth: this.getBandwidthMetrics(),
    };
  }

  /**
   * Encode an aggregated quote to binary (MessagePack).
   * Used for future Hub Mode server-to-client broadcasting.
   * @param quote - Aggregated quote to encode
   * @returns Binary-encoded quote
   */
  encodePrice(quote: any): Uint8Array {
    const binary = BinaryCodec.encodeQuote(quote);
    this._bandwidth.binaryBytesOut += binary.length;
    return binary;
  }

  /**
   * Decode a binary price message.
   * @param buffer - Binary buffer to decode
   * @returns Decoded message with type and data
   */
  decodePrice(buffer: Uint8Array | ArrayBuffer): any {
    return BinaryCodec.decodeAuto(buffer);
  }

  /** Get bandwidth metrics — JSON vs binary savings. */
  getBandwidthMetrics(): BandwidthMetrics {
    const elapsed = (Date.now() - this._bandwidth.startTime) / 1000;
    return {
      jsonBytesIn: this._bandwidth.jsonBytesIn,
      binaryBytesOut: this._bandwidth.binaryBytesOut,
      messagesProcessed: this._bandwidth.messagesProcessed,
      uptimeSeconds: Math.round(elapsed),
      avgMessageRate: elapsed > 0 ? (this._bandwidth.messagesProcessed / elapsed).toFixed(1) + '/s' : '0/s',
      savings: this._bandwidth.jsonBytesIn > 0
        ? ((1 - this._bandwidth.binaryBytesOut / this._bandwidth.jsonBytesIn) * 100).toFixed(1) + '%'
        : 'N/A',
    };
  }

  /**
   * Run a benchmark: encode sample data as JSON vs MessagePack.
   * Returns compression stats for candles, ticks, and quotes.
   */
  benchmarkBandwidth(): BenchmarkResult {
    const sampleCandle = { time: Date.now(), open: 97000.50, high: 97250.00, low: 96800.25, close: 97100.75, volume: 1234.567 };
    const sampleTick = { time: Date.now(), price: 97000.50, volume: 0.5, side: 'buy' };
    const sampleQuote = { symbol: 'BTCUSDT', price: 97000.50, confidence: 'high', sourceCount: 3, spread: 10.20, timestamp: Date.now() };
    const sampleBatch = Array.from({ length: 200 }, (_, i) => ({ ...sampleCandle, time: sampleCandle.time + i * 60000 }));

    return {
      candle: BinaryCodec.benchmark(sampleCandle),
      tick: BinaryCodec.benchmark(sampleTick),
      quote: BinaryCodec.benchmark(sampleQuote),
      candleBatch200: BinaryCodec.benchmark(sampleBatch),
    };
  }

  /**
   * Register an external data source adapter.
   * @param adapter - Source adapter conforming to SourceAdapter interface
   */
  registerSource(adapter: SourceAdapter): void {
    if (!adapter?.id) return;
    this._sources.set(adapter.id, adapter);
  }

  /**
   * Subscribe to health status changes.
   * @param callback - Receives full health status on change
   * @returns Unsubscribe function
   */
  onHealthChange(callback: (health: HealthStatus) => void): () => void {
    this._healthListeners.add(callback);
    return () => this._healthListeners.delete(callback);
  }

  /** Dispose of all resources. */
  dispose(): void {
    this.stop();
    this._sources.clear();
    this._watched.clear();
    this._subscribers.clear();
    priceAggregator.dispose();
  }

  // ─── Private Methods ────────────────────────────────────────

  private _registerBuiltInSources(): void {
    // ── Pyth Network (SSE streaming)
    this._sources.set('pyth', {
      id: 'pyth',
      name: 'Pyth Network',
      assetClasses: ['crypto', 'stock', 'forex', 'commodity'],
      available: true,

      subscribe: (symbol: string, callback: PriceCallback) => {
        return pythAdapter.subscribe(symbol, (data: any) => {
          callback({
            price: data.price,
            timestamp: data.time,
            confidence: data.confidence || 0,
            volume: data.volume || 0,
          });
        });
      },

      fetchQuote: async (symbol: string) => {
        const quote = await pythAdapter.fetchQuote(symbol);
        if (!quote) return null;
        return {
          price: quote.price,
          confidence: quote.confidence || 0,
        };
      },

      supports: (symbol: string) => pythAdapter.supports(symbol),
    });

    // ── Binance REST (client-side crypto)
    this._sources.set('binance-rest', {
      id: 'binance-rest',
      name: 'Binance REST',
      assetClasses: ['crypto'],
      available: true,

      subscribe: null,
      fetchQuote: async (symbol: string) => {
        try {
          const upper = (symbol || '').toUpperCase();
          const { isCrypto } = await import('../../../constants.js');
          const base_sym = upper.replace(/(?:USDT|BUSD|USDC)$/, '');
          if (!isCrypto(base_sym) && !upper.endsWith('USDT') && !upper.endsWith('BUSD')) return null;
          const pair = upper.endsWith('USDT') ? upper : upper + 'USDT';
          const base = typeof window === 'undefined' ? `http://localhost:${(globalThis as any).__TF_PORT || 3000}` : '';
          const res = await fetch(`${base}/api/binance/v3/ticker/price?symbol=${pair}`);
          if (!res.ok) return null;
          const data = await res.json();
          return { price: parseFloat(data.price), confidence: 0 };
        } catch {
          return null;
        }
      },

      supports: (symbol: string) => {
        const upper = (symbol || '').toUpperCase();
        if (upper.endsWith('USDT') || upper.endsWith('BUSD')) return true;
        const CRYPTO_BASES = new Set([
          'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX',
          'DOT', 'MATIC', 'LINK', 'UNI', 'ATOM', 'FTM', 'NEAR', 'APT',
          'ARB', 'OP', 'SUI', 'SEI', 'TIA', 'JUP', 'WIF', 'PEPE', 'LTC', 'FIL',
        ]);
        return CRYPTO_BASES.has(upper);
      },
    });

    // ── Finnhub (real-time US stocks + forex)
    this._sources.set('finnhub', {
      id: 'finnhub',
      name: 'Finnhub',
      assetClasses: ['stock', 'etf', 'forex'],
      available: finnhubAdapter.isConfigured,

      subscribe: finnhubAdapter.isConfigured ? (symbol: string, callback: PriceCallback) => {
        return finnhubAdapter.subscribe(symbol, (data: any) => {
          callback({
            price: data.price,
            timestamp: data.timestamp || Date.now(),
            confidence: 0,
            volume: data.volume || 0,
          });
        });
      } : null,

      fetchQuote: finnhubAdapter.isConfigured ? async (symbol: string) => {
        const quote = await finnhubAdapter.fetchQuote(symbol);
        if (!quote) return null;
        return { price: quote.price, confidence: 0 };
      } : null,

      supports: (symbol: string) => finnhubAdapter.supports(symbol),
    });

    // ── Forex (combined Pyth + Finnhub)
    this._sources.set('forex', {
      id: 'forex',
      name: 'Forex Multi-Source',
      assetClasses: ['forex'],
      available: true,

      subscribe: (symbol: string, callback: PriceCallback) => {
        if (!forexAdapter.supports(symbol)) return null;
        return forexAdapter.subscribe(symbol, (data: any) => {
          callback({
            price: data.price,
            timestamp: data.timestamp || Date.now(),
            confidence: data.confidence || 0,
            volume: 0,
          });
        });
      },

      fetchQuote: async (symbol: string) => {
        const quote = await forexAdapter.fetchQuote(symbol);
        if (!quote) return null;
        return { price: quote.price, confidence: quote.confidence || 0 };
      },

      supports: (symbol: string) => forexAdapter.supports(symbol),
    });

    // ── Kraken WebSocket (real-time crypto streaming)
    this._sources.set('kraken', {
      id: 'kraken',
      name: 'Kraken WS',
      assetClasses: ['crypto'],
      available: true,

      subscribe: (symbol: string, callback: PriceCallback) => {
        if (!krakenAdapter.supports(symbol)) return null;
        return krakenAdapter.subscribe(symbol, (data: any) => {
          callback({
            price: data.price,
            timestamp: data.time || data.timestamp || Date.now(),
            confidence: 0,
            volume: data.volume || 0,
          });
        });
      },

      fetchQuote: async (symbol: string) => {
        if (!krakenAdapter.supports(symbol)) return null;
        const quote = await krakenAdapter.fetchQuote(symbol);
        if (!quote) return null;
        return { price: quote.price, confidence: 0 };
      },

      supports: (symbol: string) => krakenAdapter.supports(symbol),
    });

    // ── Bybit WebSocket (real-time crypto spot streaming)
    this._sources.set('bybit', {
      id: 'bybit',
      name: 'Bybit WS',
      assetClasses: ['crypto'],
      available: true,

      subscribe: (symbol: string, callback: PriceCallback) => {
        if (!bybitAdapter.supports(symbol)) return null;
        return bybitAdapter.subscribe(symbol, (data: any) => {
          callback({
            price: data.price,
            timestamp: data.time || data.timestamp || Date.now(),
            confidence: 0,
            volume: data.volume || 0,
          });
        });
      },

      fetchQuote: async (symbol: string) => {
        if (!bybitAdapter.supports(symbol)) return null;
        const quote = await bybitAdapter.fetchQuote(symbol);
        if (!quote) return null;
        return { price: quote.price, confidence: 0 };
      },

      supports: (symbol: string) => bybitAdapter.supports(symbol),
    });

    // ── OKX WebSocket (real-time crypto spot streaming)
    this._sources.set('okx', {
      id: 'okx',
      name: 'OKX WS',
      assetClasses: ['crypto'],
      available: true,

      subscribe: (symbol: string, callback: PriceCallback) => {
        if (!okxAdapter.supports(symbol)) return null;
        return okxAdapter.subscribe(symbol, (data: any) => {
          callback({
            price: data.price,
            timestamp: data.time || data.timestamp || Date.now(),
            confidence: 0,
            volume: data.volume || 0,
          });
        });
      },

      fetchQuote: async (symbol: string) => {
        if (!okxAdapter.supports(symbol)) return null;
        const quote = await okxAdapter.fetchQuote(symbol);
        if (!quote) return null;
        return { price: quote.price, confidence: 0 };
      },

      supports: (symbol: string) => okxAdapter.supports(symbol),
    });

    // ── Coinbase WebSocket (real-time crypto ticker)
    this._sources.set('coinbase', {
      id: 'coinbase',
      name: 'Coinbase WS',
      assetClasses: ['crypto'],
      available: true,

      subscribe: (symbol: string, callback: PriceCallback) => {
        if (!coinbaseAdapter.supports(symbol)) return null;
        return coinbaseAdapter.subscribe(symbol, (data: any) => {
          callback({
            price: data.price,
            timestamp: data.time || data.timestamp || Date.now(),
            confidence: 0,
            volume: data.volume || 0,
          });
        });
      },

      fetchQuote: async (symbol: string) => {
        if (!coinbaseAdapter.supports(symbol)) return null;
        const quote = await coinbaseAdapter.fetchQuote(symbol);
        if (!quote) return null;
        return { price: quote.price, confidence: 0 };
      },

      supports: (symbol: string) => coinbaseAdapter.supports(symbol),
    });
  }

  /**
   * Connect a symbol to all available streaming sources.
   * For non-streaming sources, sets up REST polling via AdaptivePoller.
   */
  private _connectSymbol(symbol: string): void {
    const entry = this._watched.get(symbol);
    if (!entry) return;

    const MAX_EXCHANGES = 3;
    const CRYPTO_EXCHANGES = new Set(['binance-rest', 'kraken', 'bybit', 'okx', 'coinbase']);

    const eligible: SourceAdapter[] = [];
    for (const source of this._sources.values()) {
      if (!source.available) continue;
      const supports = source.supports ? source.supports(symbol) : true;
      if (!supports) continue;
      eligible.push(source);
    }

    const exchangeSources = eligible.filter(s => CRYPTO_EXCHANGES.has(s.id));
    const otherSources = eligible.filter(s => !CRYPTO_EXCHANGES.has(s.id));

    exchangeSources.sort((a, b) => {
      const healthA = this._adapterHealth.get(a.id);
      const healthB = this._adapterHealth.get(b.id);
      const scoreA = healthA ? healthA.successes - healthA.errors * 5 : 0;
      const scoreB = healthB ? healthB.successes - healthB.errors * 5 : 0;
      return scoreB - scoreA;
    });

    const selectedExchanges = exchangeSources.slice(0, MAX_EXCHANGES);
    const selected = [...otherSources, ...selectedExchanges];

    for (const source of selected) {
      if (source.subscribe) {
        try {
          const unsub = source.subscribe(symbol, (data: PriceUpdate) => {
            this._bandwidth.jsonBytesIn += 100;
            this._bandwidth.messagesProcessed++;
            this._recordAdapterSuccess(source.id, data.price);

            priceAggregator.ingest(
              symbol,
              source.id,
              data.price,
              data.timestamp || Date.now(),
              data.confidence || 0
            );
          });
          if (unsub) entry.unsubs.push(unsub);
        } catch (err) {
          this._recordAdapterError(source.id);
          logger.data.warn(`[TickerPlant] Failed to subscribe ${symbol} to ${source.id}:`, (err as Error).message);
        }
      }

      if (!source.subscribe && source.fetchQuote) {
        const pollKey = `${symbol}:${source.id}`;
        if (!this._pollIntervals.has(pollKey)) {
          const taskId = adaptivePoller.schedule(
            symbol,
            async () => {
              try {
                const quote = await source.fetchQuote!(symbol);
                if (quote && quote.price > 0) {
                  this._recordAdapterSuccess(source.id, quote.price);
                  priceAggregator.ingest(symbol, source.id, quote.price, Date.now(), quote.confidence || 0);
                  this._broadcastToSharedWorker(symbol, source.id, quote.price);
                }
              } catch {
                this._recordAdapterError(source.id);
              }
            },
            'visible'
          );
          this._pollIntervals.set(pollKey, taskId);
        }
      }
    }

    if (selectedExchanges.length > 0) {
      const names = selected.map(s => s.id).join(', ');
      logger.data.info(`[TickerPlant] ${symbol}: connected to ${selected.length} sources (${names})`);
    }

    entry.active = true;
  }

  /** Disconnect all source connections for a symbol. */
  private _disconnectSymbol(symbol: string): void {
    const entry = this._watched.get(symbol);
    if (!entry) return;

    for (const unsub of entry.unsubs) {
      try { unsub(); } catch { /* ignore */ }
    }
    entry.unsubs = [];

    for (const [key, taskId] of this._pollIntervals) {
      if (key.startsWith(`${symbol}:`)) {
        adaptivePoller.cancel(taskId);
        this._pollIntervals.delete(key);
      }
    }

    entry.active = false;
  }

  /** Get status of all registered sources. */
  private _getSourceStatus(): Record<string, SourceStatus> {
    const status: Record<string, SourceStatus> = {};
    for (const [id, source] of this._sources) {
      const health = this._adapterHealth.get(id);
      const now = Date.now();
      const freshness = health?.lastUpdate ? now - health.lastUpdate : null;
      const totalCalls = (health?.successes || 0) + (health?.errors || 0);
      const errorRate = totalCalls > 0 ? (health?.errors || 0) / totalCalls : 0;

      let score = 100;
      if (freshness !== null && freshness > 60000) score -= 20;
      if (freshness !== null && freshness > 300000) score -= 30;
      if (errorRate > 0.1) score -= 20;
      if (errorRate > 0.5) score -= 30;
      if ((health?.consecutiveStale || 0) > 5) score -= 20;
      if ((health?.avgLatencyMs || 0) > 5000) score -= 10;
      score = Math.max(0, score);

      status[id] = {
        name: source.name,
        available: source.available,
        assetClasses: source.assetClasses,
        hasStreaming: !!source.subscribe,
        hasRest: !!source.fetchQuote,
        health: {
          score,
          level: score >= 70 ? 'healthy' : score >= 40 ? 'degraded' : 'unhealthy',
          lastUpdate: health?.lastUpdate || null,
          freshness,
          errors: health?.errors || 0,
          successes: health?.successes || 0,
          errorRate: Math.round(errorRate * 1000) / 10,
          consecutiveStale: health?.consecutiveStale || 0,
          avgLatencyMs: health?.avgLatencyMs || 0,
        },
      };
    }
    return status;
  }

  /**
   * Get adapter health scores for all sources.
   * @returns Health data keyed by source ID
   */
  getAdapterHealth(): Record<string, SourceHealthStatus> {
    const status = this._getSourceStatus();
    const result: Record<string, SourceHealthStatus> = {};
    for (const [id, s] of Object.entries(status)) {
      result[id] = s.health;
    }
    return result;
  }

  /** Record a successful data ingestion for adapter health tracking. */
  private _recordAdapterSuccess(sourceId: string, price: number): void {
    let h = this._adapterHealth.get(sourceId);
    if (!h) {
      h = { lastUpdate: 0, errors: 0, successes: 0, lastPrice: 0, consecutiveStale: 0, avgLatencyMs: 0 };
      this._adapterHealth.set(sourceId, h);
    }
    h.successes++;
    h.lastUpdate = Date.now();

    if (price === h.lastPrice) {
      h.consecutiveStale++;
    } else {
      h.consecutiveStale = 0;
    }
    h.lastPrice = price;
  }

  /** Record a failed data fetch for adapter health tracking. */
  private _recordAdapterError(sourceId: string): void {
    let h = this._adapterHealth.get(sourceId);
    if (!h) {
      h = { lastUpdate: 0, errors: 0, successes: 0, lastPrice: 0, consecutiveStale: 0, avgLatencyMs: 0 };
      this._adapterHealth.set(sourceId, h);
    }
    h.errors++;
  }

  // ─── SharedWorker Bridge (Phase 8) ─────────────────────────

  private _initSharedWorker(): void {
    if (typeof SharedWorker === 'undefined') {
      console.info('[TickerPlant] SharedWorker not available, running in direct mode');
      return;
    }

    try {
      const workerUrl = new URL('./DataSharedWorker.js', import.meta.url);
      this._sharedWorker = new SharedWorker(workerUrl, { name: 'charEdge-data' });
      this._sharedWorkerPort = this._sharedWorker.port;

      this._sharedWorkerPort.onmessage = (event: MessageEvent<SharedWorkerMessage>) => {
        const msg = event.data;

        if (msg.type === 'connected') {
          logger.data.info(`[TickerPlant] SharedWorker connected (client #${msg.clientId}, ${msg.totalClients} total)`);
        }

        if (msg.type === 'update' && msg.symbol && msg.data) {
          priceAggregator.ingest(
            msg.symbol,
            `shared:${msg.data.sourceId}`,
            msg.data.price,
            msg.data.timestamp,
            msg.data.confidence || 0
          );
        }
      };

      this._sharedWorkerPort.start();
    } catch (err) {
      logger.data.warn('[TickerPlant] SharedWorker init failed:', (err as Error).message);
    }
  }

  /** Broadcast a price update to other tabs via SharedWorker. */
  private _broadcastToSharedWorker(symbol: string, sourceId: string, price: number): void {
    if (!this._sharedWorkerPort) return;
    try {
      const msg = {
        type: 'ingest' as const,
        symbol,
        sourceId,
        price,
        timestamp: Date.now(),
      };

      const jsonSize = JSON.stringify(msg).length;
      this._bandwidth.jsonBytesIn += jsonSize;

      try {
        const binaryMsg = BinaryCodec.encode(msg);
        this._bandwidth.binaryBytesOut += binaryMsg.byteLength || binaryMsg.length;
        this._sharedWorkerPort.postMessage(msg);
      } catch {
        this._sharedWorkerPort.postMessage(msg);
        this._bandwidth.binaryBytesOut += jsonSize;
      }
    } catch { /* SharedWorker may be closed */ }
  }

  // ─── Predictive Prefetch (Phase 9) ─────────────────────────

  /**
   * Pre-warm correlated symbols when a symbol is watched.
   * Uses a cooldown to avoid redundant requests.
   */
  private _predictivePrefetch(symbol: string): void {
    const correlated = _TickerPlant._CORRELATIONS[symbol];
    if (!correlated) return;

    const now = Date.now();

    for (const corrSymbol of correlated) {
      if (this._watched.has(corrSymbol)) continue;

      const lastPrefetch = this._prefetchCooldown.get(corrSymbol);
      if (lastPrefetch && (now - lastPrefetch) < this._prefetchTTL) continue;

      this._prefetchCooldown.set(corrSymbol, now);
      this.fetchQuote(corrSymbol).catch(() => {});
    }

    if (this._prefetchCooldown.size > 50) {
      for (const [key, ts] of this._prefetchCooldown) {
        if (now - ts > this._prefetchTTL * 2) {
          this._prefetchCooldown.delete(key);
        }
      }
    }
  }
}

// ─── Singleton + Exports ──────────────────────────────────────────

export const tickerPlant = new _TickerPlant();

export { CONFIDENCE, priceAggregator };

export default tickerPlant;
