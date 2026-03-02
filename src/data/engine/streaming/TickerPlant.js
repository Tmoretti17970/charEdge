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
import { BinaryCodec, MSG_TYPE } from '../infra/BinaryCodec.js';
import { pythAdapter } from '../../adapters/PythAdapter.js';
import { finnhubAdapter } from '../../adapters/FinnhubAdapter.js';
import { forexAdapter } from '../../adapters/ForexAdapter.js';
import { krakenAdapter } from '../../adapters/KrakenAdapter.js';
import { bybitAdapter } from '../../adapters/BybitAdapter.js';
import { okxAdapter } from '../../adapters/OKXAdapter.js';
import { coinbaseAdapter } from '../../adapters/CoinbaseAdapter.js';
import { adaptivePoller } from '../infra/AdaptivePoller.js';

// ─── Source Adapters Registry ───────────────────────────────────
// Each adapter is wrapped to conform to a common interface.

/**
 * @typedef {Object} SourceAdapter
 * @property {string} id - Unique source identifier
 * @property {string} name - Human-readable name
 * @property {string[]} assetClasses - Supported asset classes
 * @property {boolean} available - Whether this source is currently available
 * @property {Function} subscribe - (symbol, callback) => unsubscribe
 * @property {Function} [fetchQuote] - (symbol) => Promise<{ price, ... }>
 */

// ─── Ticker Plant Class ─────────────────────────────────────────

class _TickerPlant {
  constructor() {
    this._sources = new Map();       // sourceId → SourceAdapter
    this._watched = new Map();       // symbol → { unsubs: Function[], active: true }
    this._subscribers = new Map();   // symbol → Set<callback>
    this._running = false;
    this._pollIntervals = new Map(); // symbol → intervalId (for REST-only sources)
    this._healthListeners = new Set();
    this._sharedWorker = null;       // SharedWorker instance (Phase 8)
    this._sharedWorkerPort = null;   // MessagePort from SharedWorker
    this._prefetchCooldown = new Map(); // symbol → timestamp (Phase 9: avoid repeated prefetch)
    this._prefetchTTL = 5 * 60 * 1000; // 5 minute cooldown before re-prefetching

    // Bandwidth tracking
    this._bandwidth = {
      jsonBytesIn: 0,       // Total JSON bytes received (estimated)
      binaryBytesOut: 0,    // Total binary bytes encoded for output
      messagesProcessed: 0, // Total messages processed
      startTime: Date.now(),
    };

    // Adapter health tracking (Phase 14)
    this._adapterHealth = new Map(); // sourceId → { lastUpdate, errors, successes, lastPrice, consecutiveStale, avgLatencyMs }

    // Register built-in sources
    this._registerBuiltInSources();

    // Phase 8: Initialize SharedWorker for cross-tab multiplexing
    this._initSharedWorker();
  }

  // ─── Public API ─────────────────────────────────────────────

  /**
   * Start the ticker plant.
   * Begins the aggregation loop and connects to sources for watched symbols.
   */
  start() {
    if (this._running) return;
    this._running = true;

    // Start the aggregation loop
    priceAggregator.start();

    // Connect all watched symbols to available sources
    for (const [symbol] of this._watched) {
      this._connectSymbol(symbol);
    }

    console.log(`[TickerPlant] Started with ${this._sources.size} sources, watching ${this._watched.size} symbols`);
  }

  /**
   * Stop the ticker plant.
   * Disconnects all source connections and stops aggregation.
   */
  stop() {
    this._running = false;
    priceAggregator.stop();

    // Disconnect all symbols
    for (const [symbol, entry] of this._watched) {
      this._disconnectSymbol(symbol);
      entry.active = false;
    }

    // Clear poll intervals
    for (const [, id] of this._pollIntervals) {
      clearInterval(id);
    }
    this._pollIntervals.clear();

    console.log('[TickerPlant] Stopped');
  }

  /**
   * Watch a symbol — connect it to all available data sources.
   * @param {string} symbol - e.g. 'BTCUSDT', 'AAPL', 'EURUSD=X'
   */
  watch(symbol) {
    const upper = (symbol || '').toUpperCase();
    if (!upper) return;

    if (this._watched.has(upper)) return; // Already watching

    this._watched.set(upper, { unsubs: [], active: true });

    if (this._running) {
      this._connectSymbol(upper);
    }

    // Phase 9: Predictive prefetch — pre-warm correlated symbols
    this._predictivePrefetch(upper);
  }

  /**
   * Stop watching a symbol — disconnect all source connections.
   * @param {string} symbol
   */
  unwatch(symbol) {
    const upper = (symbol || '').toUpperCase();
    this._disconnectSymbol(upper);
    this._watched.delete(upper);
    priceAggregator.removeSymbol(upper);
  }

  /**
   * Subscribe to aggregated price updates for a symbol.
   * @param {string} symbol
   * @param {Function} callback - ({ symbol, price, confidence, sourceCount, spread, timestamp }) => void
   * @returns {Function} unsubscribe
   */
  subscribe(symbol, callback) {
    return priceAggregator.subscribe(symbol, callback);
  }

  /**
   * Get the latest aggregated price for a symbol.
   * @param {string} symbol
   * @returns {{ price, confidence, sourceCount, spread, ... } | null}
   */
  getPrice(symbol) {
    return priceAggregator.getLatest(symbol?.toUpperCase());
  }

  /**
   * Fetch a one-time quote for a symbol from the best available source.
   * Does NOT start watching or subscribing.
   * @param {string} symbol
   * @returns {Promise<{ price, confidence, source } | null>}
   */
  async fetchQuote(symbol) {
    const upper = (symbol || '').toUpperCase();

    // Try each source in priority order
    for (const source of this._sources.values()) {
      if (!source.available || !source.fetchQuote) continue;

      try {
        const quote = await source.fetchQuote(upper);
        if (quote && quote.price > 0) {
          // Ingest into aggregator for caching
          priceAggregator.ingest(upper, source.id, quote.price, Date.now(), quote.confidence || 0);
          return { ...quote, source: source.id };
        }
      } catch {
        // Try next source
      }
    }

    return null;
  }

  /**
   * Get the health status of the entire ticker plant.
   */
  getHealth() {
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
   * @param {{ symbol, price, confidence, sourceCount, spread, timestamp }} quote
   * @returns {Uint8Array}
   */
  encodePrice(quote) {
    const binary = BinaryCodec.encodeQuote(quote);
    this._bandwidth.binaryBytesOut += binary.length;
    return binary;
  }

  /**
   * Decode a binary price message.
   * @param {Uint8Array|ArrayBuffer} buffer
   * @returns {{ type, data }}
   */
  decodePrice(buffer) {
    return BinaryCodec.decodeAuto(buffer);
  }

  /**
   * Get bandwidth metrics — JSON vs binary savings.
   */
  getBandwidthMetrics() {
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
  benchmarkBandwidth() {
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
   * @param {SourceAdapter} adapter
   */
  registerSource(adapter) {
    if (!adapter?.id) return;
    this._sources.set(adapter.id, adapter);
  }

  /**
   * Subscribe to health status changes.
   * @param {Function} callback
   * @returns {Function} unsubscribe
   */
  onHealthChange(callback) {
    this._healthListeners.add(callback);
    return () => this._healthListeners.delete(callback);
  }

  /**
   * Dispose of all resources.
   */
  dispose() {
    this.stop();
    this._sources.clear();
    this._watched.clear();
    this._subscribers.clear();
    priceAggregator.dispose();
  }

  // ─── Private Methods ────────────────────────────────────────

  /** @private */
  _registerBuiltInSources() {
    // ── Pyth Network (SSE streaming) ──────────────────────────
    this._sources.set('pyth', {
      id: 'pyth',
      name: 'Pyth Network',
      assetClasses: ['crypto', 'stock', 'forex', 'commodity'],
      available: true,

      subscribe: (symbol, callback) => {
        return pythAdapter.subscribe(symbol, (data) => {
          callback({
            price: data.price,
            timestamp: data.time,
            confidence: data.confidence || 0,
            volume: data.volume || 0,
          });
        });
      },

      fetchQuote: async (symbol) => {
        const quote = await pythAdapter.fetchQuote(symbol);
        if (!quote) return null;
        return {
          price: quote.price,
          confidence: quote.confidence || 0,
        };
      },

      supports: (symbol) => pythAdapter.supports(symbol),
    });

    // ── Binance WebSocket (client-side crypto) ────────────────
    // Binance data comes from WebSocketService which is already
    // integrated via the WSRouter. We add a REST polling fallback here.
    this._sources.set('binance-rest', {
      id: 'binance-rest',
      name: 'Binance REST',
      assetClasses: ['crypto'],
      available: true,

      subscribe: null, // WebSocket handled by WebSocketService
      fetchQuote: async (symbol) => {
        try {
          const upper = (symbol || '').toUpperCase();
          // Guard: only fetch crypto symbols — prevents 400 errors for equities (QQQ, VIX, etc.)
          const { isCrypto } = await import('../../../constants.js');
          const base_sym = upper.replace(/(?:USDT|BUSD|USDC)$/, '');
          if (!isCrypto(base_sym) && !upper.endsWith('USDT') && !upper.endsWith('BUSD')) return null;
          const pair = upper.endsWith('USDT') ? upper : upper + 'USDT';
          const base = typeof window === 'undefined' ? `http://localhost:${globalThis.__TF_PORT || 3000}` : '';
          const res = await fetch(`${base}/api/binance/v3/ticker/price?symbol=${pair}`);
          if (!res.ok) return null;
          const data = await res.json();
          return { price: parseFloat(data.price), confidence: 0 };
        } catch {
          return null;
        }
      },

      supports: (symbol) => {
        const upper = (symbol || '').toUpperCase();
        // Only support symbols that are clearly crypto pairs
        if (upper.endsWith('USDT') || upper.endsWith('BUSD')) return true;
        // Reject bare equity symbols — they would be sent as e.g. QQQUSDT
        // Only allow bare symbols that are in BINANCE_SYMBOLS set
        const CRYPTO_BASES = new Set([
          'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX',
          'DOT', 'MATIC', 'LINK', 'UNI', 'ATOM', 'FTM', 'NEAR', 'APT',
          'ARB', 'OP', 'SUI', 'SEI', 'TIA', 'JUP', 'WIF', 'PEPE', 'LTC', 'FIL',
        ]);
        return CRYPTO_BASES.has(upper);
      },
    });

    // ── Finnhub (real-time US stocks + forex) ─────────────────
    this._sources.set('finnhub', {
      id: 'finnhub',
      name: 'Finnhub',
      assetClasses: ['stock', 'etf', 'forex'],
      available: finnhubAdapter.isConfigured,

      subscribe: finnhubAdapter.isConfigured ? (symbol, callback) => {
        return finnhubAdapter.subscribe(symbol, (data) => {
          callback({
            price: data.price,
            timestamp: data.timestamp || Date.now(),
            confidence: 0,
            volume: data.volume || 0,
          });
        });
      } : null,

      fetchQuote: finnhubAdapter.isConfigured ? async (symbol) => {
        const quote = await finnhubAdapter.fetchQuote(symbol);
        if (!quote) return null;
        return { price: quote.price, confidence: 0 };
      } : null,

      supports: (symbol) => finnhubAdapter.supports(symbol),
    });

    // ── Forex (combined Pyth + Finnhub) ───────────────────────
    this._sources.set('forex', {
      id: 'forex',
      name: 'Forex Multi-Source',
      assetClasses: ['forex'],
      available: true,

      subscribe: (symbol, callback) => {
        if (!forexAdapter.supports(symbol)) return null;
        return forexAdapter.subscribe(symbol, (data) => {
          callback({
            price: data.price,
            timestamp: data.timestamp || Date.now(),
            confidence: data.confidence || 0,
            volume: 0,
          });
        });
      },

      fetchQuote: async (symbol) => {
        const quote = await forexAdapter.fetchQuote(symbol);
        if (!quote) return null;
        return { price: quote.price, confidence: quote.confidence || 0 };
      },

      supports: (symbol) => forexAdapter.supports(symbol),
    });

    // ── Kraken WebSocket (real-time crypto streaming) ────────────
    this._sources.set('kraken', {
      id: 'kraken',
      name: 'Kraken WS',
      assetClasses: ['crypto'],
      available: true,

      subscribe: (symbol, callback) => {
        if (!krakenAdapter.supports(symbol)) return null;
        return krakenAdapter.subscribe(symbol, (data) => {
          callback({
            price: data.price,
            timestamp: data.time || data.timestamp || Date.now(),
            confidence: 0,
            volume: data.volume || 0,
          });
        });
      },

      fetchQuote: async (symbol) => {
        if (!krakenAdapter.supports(symbol)) return null;
        const quote = await krakenAdapter.fetchQuote(symbol);
        if (!quote) return null;
        return { price: quote.price, confidence: 0 };
      },

      supports: (symbol) => krakenAdapter.supports(symbol),
    });

    // ── Bybit WebSocket (real-time crypto spot streaming) ────────
    this._sources.set('bybit', {
      id: 'bybit',
      name: 'Bybit WS',
      assetClasses: ['crypto'],
      available: true,

      subscribe: (symbol, callback) => {
        if (!bybitAdapter.supports(symbol)) return null;
        return bybitAdapter.subscribe(symbol, (data) => {
          callback({
            price: data.price,
            timestamp: data.time || data.timestamp || Date.now(),
            confidence: 0,
            volume: data.volume || 0,
          });
        });
      },

      fetchQuote: async (symbol) => {
        if (!bybitAdapter.supports(symbol)) return null;
        const quote = await bybitAdapter.fetchQuote(symbol);
        if (!quote) return null;
        return { price: quote.price, confidence: 0 };
      },

      supports: (symbol) => bybitAdapter.supports(symbol),
    });

    // ── OKX WebSocket (real-time crypto spot streaming) ──────────
    this._sources.set('okx', {
      id: 'okx',
      name: 'OKX WS',
      assetClasses: ['crypto'],
      available: true,

      subscribe: (symbol, callback) => {
        if (!okxAdapter.supports(symbol)) return null;
        return okxAdapter.subscribe(symbol, (data) => {
          callback({
            price: data.price,
            timestamp: data.time || data.timestamp || Date.now(),
            confidence: 0,
            volume: data.volume || 0,
          });
        });
      },

      fetchQuote: async (symbol) => {
        if (!okxAdapter.supports(symbol)) return null;
        const quote = await okxAdapter.fetchQuote(symbol);
        if (!quote) return null;
        return { price: quote.price, confidence: 0 };
      },

      supports: (symbol) => okxAdapter.supports(symbol),
    });

    // ── Coinbase WebSocket (real-time crypto ticker) ─────────────
    this._sources.set('coinbase', {
      id: 'coinbase',
      name: 'Coinbase WS',
      assetClasses: ['crypto'],
      available: true,

      subscribe: (symbol, callback) => {
        if (!coinbaseAdapter.supports(symbol)) return null;
        return coinbaseAdapter.subscribe(symbol, (data) => {
          callback({
            price: data.price,
            timestamp: data.time || data.timestamp || Date.now(),
            confidence: 0,
            volume: data.volume || 0,
          });
        });
      },

      fetchQuote: async (symbol) => {
        if (!coinbaseAdapter.supports(symbol)) return null;
        const quote = await coinbaseAdapter.fetchQuote(symbol);
        if (!quote) return null;
        return { price: quote.price, confidence: 0 };
      },

      supports: (symbol) => coinbaseAdapter.supports(symbol),
    });
  }

  /**
   * Connect a symbol to all available streaming sources.
   * For non-streaming sources, sets up REST polling.
   * @private
   */
  _connectSymbol(symbol) {
    const entry = this._watched.get(symbol);
    if (!entry) return;

    // ── Smart Connection Management ──────────────────────────────
    // For crypto symbols with multiple exchange sources, limit to
    // the top MAX_EXCHANGES healthiest ones to save bandwidth.
    const MAX_EXCHANGES = 3;
    const CRYPTO_EXCHANGES = new Set(['binance-rest', 'kraken', 'bybit', 'okx', 'coinbase']);

    // Collect eligible sources and rank by health
    const eligible = [];
    for (const source of this._sources.values()) {
      if (!source.available) continue;
      const supports = source.supports ? source.supports(symbol) : true;
      if (!supports) continue;
      eligible.push(source);
    }

    // Rank crypto exchange sources by health score, keep non-exchange sources always
    const exchangeSources = eligible.filter(s => CRYPTO_EXCHANGES.has(s.id));
    const otherSources = eligible.filter(s => !CRYPTO_EXCHANGES.has(s.id));

    // Sort exchanges by health score (highest first)
    exchangeSources.sort((a, b) => {
      const healthA = this._adapterHealth.get(a.id);
      const healthB = this._adapterHealth.get(b.id);
      const scoreA = healthA ? healthA.successes - healthA.errors * 5 : 0;
      const scoreB = healthB ? healthB.successes - healthB.errors * 5 : 0;
      return scoreB - scoreA;
    });

    // Take top N exchange sources + all non-exchange sources
    const selectedExchanges = exchangeSources.slice(0, MAX_EXCHANGES);
    const selected = [...otherSources, ...selectedExchanges];

    for (const source of selected) {
      // Subscribe to streaming source
      if (source.subscribe) {
        try {
          const unsub = source.subscribe(symbol, (data) => {
            // Track bandwidth
            this._bandwidth.jsonBytesIn += 100; // ~100 bytes per JSON price message
            this._bandwidth.messagesProcessed++;

            // Record health
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
          console.warn(`[TickerPlant] Failed to subscribe ${symbol} to ${source.id}:`, err.message);
        }
      }

      // Set up REST polling for sources without streaming
      if (!source.subscribe && source.fetchQuote) {
        const pollKey = `${symbol}:${source.id}`;
        if (!this._pollIntervals.has(pollKey)) {
          // Phase 8: Use AdaptivePoller instead of fixed interval
          const taskId = adaptivePoller.schedule(
            symbol,
            async () => {
              try {
                const quote = await source.fetchQuote(symbol);
                if (quote && quote.price > 0) {
                  this._recordAdapterSuccess(source.id, quote.price);
                  priceAggregator.ingest(symbol, source.id, quote.price, Date.now(), quote.confidence || 0);
                  // Broadcast to SharedWorker for cross-tab sharing
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

    // Log which sources were selected
    if (selectedExchanges.length > 0) {
      const names = selected.map(s => s.id).join(', ');
      console.log(`[TickerPlant] ${symbol}: connected to ${selected.length} sources (${names})`);
    }

    entry.active = true;
  }

  /**
   * Disconnect all source connections for a symbol.
   * @private
   */
  _disconnectSymbol(symbol) {
    const entry = this._watched.get(symbol);
    if (!entry) return;

    // Call all unsubscribe functions
    for (const unsub of entry.unsubs) {
      try { unsub(); } catch { /* ignore */ }
    }
    entry.unsubs = [];

    // Clear associated poll intervals (now adaptivePoller tasks)
    for (const [key, taskId] of this._pollIntervals) {
      if (key.startsWith(`${symbol}:`)) {
        adaptivePoller.cancel(taskId);
        this._pollIntervals.delete(key);
      }
    }

    entry.active = false;
  }

  /**
   * Get status of all registered sources.
   * @private
   */
  _getSourceStatus() {
    const status = {};
    for (const [id, source] of this._sources) {
      const health = this._adapterHealth.get(id) || {};
      const now = Date.now();
      const freshness = health.lastUpdate ? now - health.lastUpdate : null;
      const totalCalls = (health.successes || 0) + (health.errors || 0);
      const errorRate = totalCalls > 0 ? (health.errors || 0) / totalCalls : 0;

      // Health score: 0-100
      let score = 100;
      if (freshness !== null && freshness > 60000) score -= 20;   // Stale > 60s
      if (freshness !== null && freshness > 300000) score -= 30;  // Stale > 5min
      if (errorRate > 0.1) score -= 20;                           // >10% error rate
      if (errorRate > 0.5) score -= 30;                           // >50% error rate
      if ((health.consecutiveStale || 0) > 5) score -= 20;        // 5+ identical prices
      if ((health.avgLatencyMs || 0) > 5000) score -= 10;         // Slow responses
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
          lastUpdate: health.lastUpdate || null,
          freshness: freshness,
          errors: health.errors || 0,
          successes: health.successes || 0,
          errorRate: Math.round(errorRate * 1000) / 10,
          consecutiveStale: health.consecutiveStale || 0,
          avgLatencyMs: health.avgLatencyMs || 0,
        },
      };
    }
    return status;
  }

  /**
   * Get adapter health scores for all sources.
   * @returns {Object<string, { score, level, ... }>}
   */
  getAdapterHealth() {
    const status = this._getSourceStatus();
    const result = {};
    for (const [id, s] of Object.entries(status)) {
      result[id] = s.health;
    }
    return result;
  }

  /**
   * Record a successful data ingestion for adapter health tracking.
   * @private
   */
  _recordAdapterSuccess(sourceId, price) {
    let h = this._adapterHealth.get(sourceId);
    if (!h) {
      h = { lastUpdate: 0, errors: 0, successes: 0, lastPrice: 0, consecutiveStale: 0, avgLatencyMs: 0 };
      this._adapterHealth.set(sourceId, h);
    }
    h.successes++;
    h.lastUpdate = Date.now();

    // Staleness: same price N times in a row
    if (price === h.lastPrice) {
      h.consecutiveStale++;
    } else {
      h.consecutiveStale = 0;
    }
    h.lastPrice = price;
  }

  /**
   * Record a failed data fetch for adapter health tracking.
   * @private
   */
  _recordAdapterError(sourceId) {
    let h = this._adapterHealth.get(sourceId);
    if (!h) {
      h = { lastUpdate: 0, errors: 0, successes: 0, lastPrice: 0, consecutiveStale: 0, avgLatencyMs: 0 };
      this._adapterHealth.set(sourceId, h);
    }
    h.errors++;
  }

  // ─── SharedWorker Bridge (Phase 8) ─────────────────────────

  /** @private */
  _initSharedWorker() {
    if (typeof SharedWorker === 'undefined') {
      console.info('[TickerPlant] SharedWorker not available, running in direct mode');
      return;
    }

    try {
      const workerUrl = new URL('./DataSharedWorker.js', import.meta.url);
      this._sharedWorker = new SharedWorker(workerUrl, { name: 'charEdge-data' });
      this._sharedWorkerPort = this._sharedWorker.port;

      this._sharedWorkerPort.onmessage = (event) => {
        const msg = event.data;

        if (msg.type === 'connected') {
          console.log(`[TickerPlant] SharedWorker connected (client #${msg.clientId}, ${msg.totalClients} total)`);
        }

        // Receive updates from other tabs
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
      console.warn('[TickerPlant] SharedWorker init failed:', err.message);
    }
  }

  /** @private — Broadcast a price update to other tabs via SharedWorker */
  _broadcastToSharedWorker(symbol, sourceId, price) {
    if (!this._sharedWorkerPort) return;
    try {
      // Phase 9: Try binary encoding for bandwidth savings
      const msg = {
        type: 'ingest',
        symbol,
        sourceId,
        price,
        timestamp: Date.now(),
      };

      // Track binary savings
      const jsonSize = JSON.stringify(msg).length;
      this._bandwidth.jsonBytesIn += jsonSize;

      try {
        const binaryMsg = BinaryCodec.encode(msg);
        this._bandwidth.binaryBytesOut += binaryMsg.byteLength || binaryMsg.length;
        // Still send JSON to SharedWorker (it handles binary internally)
        this._sharedWorkerPort.postMessage(msg);
      } catch {
        this._sharedWorkerPort.postMessage(msg);
        this._bandwidth.binaryBytesOut += jsonSize;
      }
    } catch { /* SharedWorker may be closed */ }
  }

  // ─── Predictive Prefetch (Phase 9) ─────────────────────────

  /**
   * Correlation maps: when symbol X is watched, pre-warm these related symbols.
   * @private
   */
  static _CORRELATIONS = {
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

  /**
   * Predictive prefetch: when a symbol is watched, pre-warm correlated symbols.
   * Uses a cooldown to avoid redundant requests.
   * @private
   * @param {string} symbol
   */
  _predictivePrefetch(symbol) {
    const correlated = _TickerPlant._CORRELATIONS[symbol];
    if (!correlated) return;

    const now = Date.now();

    for (const corrSymbol of correlated) {
      // Skip if already watching
      if (this._watched.has(corrSymbol)) continue;

      // Skip if recently prefetched
      const lastPrefetch = this._prefetchCooldown.get(corrSymbol);
      if (lastPrefetch && (now - lastPrefetch) < this._prefetchTTL) continue;

      // Mark as prefetched
      this._prefetchCooldown.set(corrSymbol, now);

      // Fetch one-time quote in background (don't subscribe, just warm the cache)
      this.fetchQuote(corrSymbol).catch(() => {}); // intentional: prefetch is best-effort
    }

    // Clean up old prefetch entries every 50 calls
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
