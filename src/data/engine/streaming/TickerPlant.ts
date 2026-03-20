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
import { logger } from '@/observability/logger.js';
import { BinaryCodec } from '../infra/BinaryCodec.js';
import { adaptivePoller } from '../infra/AdaptivePoller.js';
import { registerBuiltInSources } from './builtInSources.js';
import { AdapterHealthTracker } from './adapterHealth.js';
import { pipelineLogger } from '../infra/DataPipelineLogger.js';
import type {
  PriceUpdate, PriceCallback, SourceAdapter, QuoteResult, WatchEntry,
  BandwidthCounters, BandwidthMetrics, SourceHealthStatus, SourceStatus,
  HealthStatus, BenchmarkResult, SharedWorkerMessage,
} from './TickerPlantTypes.js';

// Re-export types for backward compatibility
export type { PriceUpdate, PriceCallback, SourceAdapter, QuoteResult, BandwidthMetrics, SourceHealthStatus, SourceStatus, HealthStatus, BenchmarkResult } from './TickerPlantTypes.js';

// ─── Ticker Plant Class ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/naming-convention
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
  private _healthTracker: AdapterHealthTracker;
  private _staleCheckInterval: ReturnType<typeof setInterval> | null;

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
    AMD: ['NVDA', 'QQQ'],
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

  // Sprint 1 Task 1.2.2: Track which sources are connected to each symbol
  private _symbolSources: Map<string, Set<string>> = new Map();

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

    this._healthTracker = new AdapterHealthTracker();
    this._staleCheckInterval = null;

    registerBuiltInSources(this._sources);
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

    // Wire stale-symbol detection — checks every 30s for sources that stopped sending data
    this._staleCheckInterval = setInterval(() => this._checkStaleSymbols(), 30_000);

    logger.data.info(`[TickerPlant] Started with ${this._sources.size} sources, watching ${this._watched.size} symbols`);
  }

  /**
   * Stop the ticker plant.
   * Disconnects all source connections and stops aggregation.
   */
  stop(): void {
    this._running = false;
    priceAggregator.stop();

    // Clear stale-symbol failover timer
    if (this._staleCheckInterval) clearInterval(this._staleCheckInterval);
    this._staleCheckInterval = null;

    for (const [symbol, entry] of this._watched) {
      this._disconnectSymbol(symbol);
      entry.active = false;
    }

    for (const [, id] of this._pollIntervals) {
      clearInterval(id as unknown);
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_) {
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
  encodePrice(quote: unknown): Uint8Array {
    const binary = BinaryCodec.encodeQuote(quote);
    this._bandwidth.binaryBytesOut += binary.length;
    return binary;
  }

  /**
   * Decode a binary price message.
   * @param buffer - Binary buffer to decode
   * @returns Decoded message with type and data
   */
  decodePrice(buffer: Uint8Array | ArrayBuffer): unknown {
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

  // Built-in sources are registered via registerBuiltInSources() in constructor

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
      const healthA = this._healthTracker.get(a.id);
      const healthB = this._healthTracker.get(b.id);
      const scoreA = healthA ? healthA.successes - healthA.errors * 5 : 0;
      const scoreB = healthB ? healthB.successes - healthB.errors * 5 : 0;
      return scoreB - scoreA;
    });

    const selectedExchanges = exchangeSources.slice(0, MAX_EXCHANGES);
    const selected = [...otherSources, ...selectedExchanges];

    // Sprint 1 Task 1.2.2: Track sources connected to this symbol
    if (!this._symbolSources.has(symbol)) this._symbolSources.set(symbol, new Set());
    const symSources = this._symbolSources.get(symbol)!;

    for (const source of selected) {
      symSources.add(source.id);

      if (source.subscribe) {
        try {
          const unsub = source.subscribe(symbol, (data: PriceUpdate) => {
            this._bandwidth.jsonBytesIn += 100;
            this._bandwidth.messagesProcessed++;
            this._healthTracker.recordSuccess(source.id, data.price);

            priceAggregator.ingest(
              symbol,
              source.id,
              data.price,
              data.timestamp || Date.now(),
              data.confidence || 0
            );

            // Sprint 1 Task 1.2.1: Reset reconnect counter on successful data receipt
            this._resetReconnect(symbol);
          });
          if (typeof unsub === 'function') {
            entry.unsubs.push(unsub);
          } else if (unsub && typeof (unsub as any).then === 'function') {
            // Handle async subscribe that returns Promise<() => void>
            (unsub as unknown as Promise<(() => void) | undefined>).then(fn => {
              if (typeof fn === 'function' && entry.active) entry.unsubs.push(fn);
            }).catch(() => {});
          }
        } catch (err) {
          this._healthTracker.recordError(source.id);
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
                  this._healthTracker.recordSuccess(source.id, quote.price);
                  priceAggregator.ingest(symbol, source.id, quote.price, Date.now(), quote.confidence || 0);
                  this._broadcastToSharedWorker(symbol, source.id, quote.price);
                }
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              } catch (_) {
                this._healthTracker.recordError(source.id);
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
      try { unsub(); } catch (e) { logger.data.warn('Operation failed', e); }
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
    return this._healthTracker.getSourceStatus(this._sources);
  }

  /**
   * Get adapter health scores for all sources.
   * @returns Health data keyed by source ID
   */
  getAdapterHealth(): Record<string, SourceHealthStatus> {
    return this._healthTracker.getAdapterHealth(this._sources);
  }

  // ─── SharedWorker Bridge (Phase 8) ─────────────────────────

  private _initSharedWorker(): void {
    if (typeof SharedWorker === 'undefined') {
      logger.data.info('[TickerPlant] SharedWorker not available, running in direct mode');
      return;
    }

    try {
      const workerUrl = new URL('../infra/DataSharedWorker.js', import.meta.url);
      this._sharedWorker = new SharedWorker(workerUrl, { name: 'charEdge-data', type: 'module' });
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_) {
        this._sharedWorkerPort.postMessage(msg);
        this._bandwidth.binaryBytesOut += jsonSize;
      }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) { /* SharedWorker may be closed */ }
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
      this.fetchQuote(corrSymbol).catch(() => { });
    }

    if (this._prefetchCooldown.size > 50) {
      for (const [key, ts] of this._prefetchCooldown) {
        if (now - ts > this._prefetchTTL * 2) {
          this._prefetchCooldown.delete(key);
        }
      }
    }
  }

  // ─── Fallback Cascade (Phase 7) ─────────────────────────────

  /**
   * Attempt to reconnect a symbol to alternative sources after a failure.
   *
   * Cascade order for equities:  Finnhub WS → Binance REST → Pyth SSE
   * Cascade order for crypto:    Binance REST → Kraken WS → Bybit WS → OKX WS → Coinbase WS → Pyth SSE
   * Cascade order for forex:     Forex multi → Finnhub → Pyth SSE
   *
   * Uses exponential backoff per symbol to avoid hammering sources.
   */
  private _reconnectAttempts: Map<string, number> = new Map();
  private _reconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /**
   * Handle a streaming source failure — try the next source in the cascade.
   * @param symbol - Symbol that lost its connection
   * @param failedSourceId - ID of the source that failed
   */
  private _handleSourceFailure(symbol: string, failedSourceId: string): void {
    this._healthTracker.recordError(failedSourceId);

    const attempts = this._reconnectAttempts.get(symbol) || 0;
    const delay = Math.min(1000 * Math.pow(2, attempts), 30000); // 1s → 30s max

    logger.data.warn(`[TickerPlant] Source ${failedSourceId} failed for ${symbol}, reconnecting in ${delay}ms (attempt ${attempts + 1})`);

    this._reconnectAttempts.set(symbol, attempts + 1);

    // Clear existing timer for this symbol
    const existing = this._reconnectTimers.get(symbol);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this._reconnectTimers.delete(symbol);

      if (!this._watched.has(symbol) || !this._running) return;

      // Disconnect failed source and reconnect to alternatives
      this._disconnectSymbol(symbol);
      this._connectSymbol(symbol);
    }, delay);

    this._reconnectTimers.set(symbol, timer);
  }

  /**
   * Detect stale data and trigger source failover.
   * Called periodically — if a symbol hasn't received an update in > 60s,
   * consider the source stale and try another.
   */
  private _checkStaleSymbols(): void {
    const STALE_THRESHOLD_MS = 60000; // 1 minute
    const now = Date.now();

    for (const [symbol, entry] of this._watched) {
      if (!entry.active) continue;

      // Sprint 1 Task 1.2.2: Only check sources connected to THIS symbol
      const connectedSources = this._symbolSources.get(symbol);
      if (!connectedSources || connectedSources.size === 0) continue;

      let freshestUpdate = 0;
      let stalestSource = '';

      for (const sourceId of connectedSources) {
        const health = this._healthTracker.get(sourceId);
        if (!health) continue;

        if (health.lastUpdate > freshestUpdate) {
          freshestUpdate = health.lastUpdate;
        }
        if (health.consecutiveStale > 10) {
          stalestSource = sourceId;
        }
      }

      // If the freshest update is too old, trigger reconnect
      if (freshestUpdate > 0 && (now - freshestUpdate) > STALE_THRESHOLD_MS) {
        // Sprint 1 Task 1.2.3: Structured failover logging
        const stalenessMs = now - freshestUpdate;
        pipelineLogger.warn('TickerPlant', `Failover triggered for ${symbol} — stale for ${Math.round(stalenessMs / 1000)}s`, {
          sourceId: stalestSource || 'unknown',
          stalenessMs,
          symbol,
        } as unknown as Error);
        this._handleSourceFailure(symbol, stalestSource || 'unknown');
      }
    }
  }

  /**
   * Reset reconnect attempts for a symbol on successful data receipt.
   * Called when fresh data arrives from any source.
   */
  private _resetReconnect(symbol: string): void {
    if (this._reconnectAttempts.has(symbol)) {
      this._reconnectAttempts.delete(symbol);
    }
  }
}

// ─── Singleton + Exports ──────────────────────────────────────────

export const tickerPlant = new _TickerPlant();

export { CONFIDENCE, priceAggregator };

export default tickerPlant;
