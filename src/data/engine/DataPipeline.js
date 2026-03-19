// ═══════════════════════════════════════════════════════════════════
// charEdge — Data Pipeline Orchestrator
//
// Central orchestrator that wires together data infrastructure:
//   - TickerPlant (multi-source aggregation)
//   - PriceAggregator (VWAP price merging)
//   - SharedWorker (already in TickerPlant)
//
// Usage:
//   import { dataPipeline } from './DataPipeline.js';
//   dataPipeline.start();
//   dataPipeline.watchSymbol('BTCUSDT');
//   dataPipeline.getDataSource('BTCUSDT'); // → 'LIVE' | 'DELAYED' | ...
// ═══════════════════════════════════════════════════════════════════

import { pythAdapter } from '../adapters/PythAdapter.js';
import { getBandwidthMonitor } from './infra/BandwidthMonitor.js';
import { getBatteryThrottle } from './infra/BatteryThrottle.js';
import { tickerPlant } from './streaming/TickerPlant.js';
import { logger } from '@/observability/logger.js';

// ─── Data Source Constants ──────────────────────────────────────

export const DATA_SOURCE = {
  LIVE:     'live',       // Direct exchange WebSocket
  ORACLE:   'oracle',     // Pyth oracle feed
  DELAYED:  'delayed',    // REST polling / delayed data
  CACHED:   'cached',     // Serving from OPFS/IndexedDB cache
  NO_DATA:  'no_data',    // No data source available
};

// ─── Pipeline Class ─────────────────────────────────────────────

class DataPipeline extends EventTarget {
  constructor() {
    super();

    /** @type {boolean} */
    this._started = false;

    /**
     * Per-symbol source tracking.
     * symbol → { primary: DATA_SOURCE, sources: Set<string>, lastUpdate: number }
     * @type {Map<string, Object>}
     */
    this._symbolSources = new Map();

    /**
     * Unsubscribe functions from tickerPlant.subscribe().
     * @type {Map<string, Function>}
     */
    this._subscriptions = new Map();

    /**
     * Pipeline stats for monitoring.
     */
    this._stats = {
      startTime: 0,
    };

    /** @type {boolean} */
    this._online = typeof navigator !== 'undefined' ? navigator.onLine : true;

    /** @type {Function|null} */
    this._onOnline = null;
    /** @type {Function|null} */
    this._onOffline = null;

    // Bandwidth monitor and battery throttle
    this._bandwidthMonitor = getBandwidthMonitor();
    this._batteryThrottle = getBatteryThrottle();
  }

  // ─── Lifecycle ──────────────────────────────────────────────

  /**
   * Start the data pipeline.
   * Initializes TickerPlant and monitoring.
   */
  start() {
    if (this._started) return;
    this._started = true;
    this._stats.startTime = Date.now();

    // 1. TickerPlant lifecycle is owned by AppBoot.postBoot() — not started here
    //    to avoid double-start. DataPipeline only manages symbol watching.

    // 2. Listen for online/offline events
    this._wireNetworkDetection();

    // 3. Start bandwidth monitoring and battery throttle
    this._bandwidthMonitor.start();
    this._batteryThrottle.init();

    logger.data.info('Started — TickerPlant + BandwidthMonitor active');
  }

  /**
   * Stop the pipeline and clean up all resources.
   */
  stop() {
    if (!this._started) return;
    this._started = false;

    // Stop TickerPlant
    tickerPlant.stop();

    // Remove network listeners
    if (typeof window !== 'undefined') {
      if (this._onOnline) window.removeEventListener('online', this._onOnline);
      if (this._onOffline) window.removeEventListener('offline', this._onOffline);
    }

    // Clear state
    for (const unsub of this._subscriptions.values()) { try { unsub(); } catch (e) { logger.data.warn('Operation failed', e); } }
    this._subscriptions.clear();
    this._symbolSources.clear();

    // Stop bandwidth monitor and battery throttle
    this._bandwidthMonitor.stop();
    this._batteryThrottle.destroy();

    logger.data.info('Stopped');
  }

  // ─── Symbol Management ──────────────────────────────────────

  /**
   * Watch a symbol through the pipeline.
   * TickerPlant connects to available sources, and we track the data source.
   *
   * @param {string} symbol
   */
  watchSymbol(symbol) {
    const upper = (symbol || '').toUpperCase();
    if (!upper) return;

    // Initialize source tracking
    if (!this._symbolSources.has(upper)) {
      this._symbolSources.set(upper, {
        primary: DATA_SOURCE.NO_DATA,
        sources: new Set(),
        lastUpdate: 0,
      });
    }

    // Watch via TickerPlant (connects to all available sources)
    tickerPlant.watch(upper);

    // Subscribe to aggregated price updates to track source info
    // Clean up any existing subscription before re-subscribing
    const existingUnsub = this._subscriptions.get(upper);
    if (existingUnsub) { try { existingUnsub(); } catch (e) { logger.data.warn('Operation failed', e); } }

    const unsub = tickerPlant.subscribe(upper, (aggData) => {
      this._updateSourceTracking(upper, aggData);
    });
    this._subscriptions.set(upper, unsub);

    return unsub;
  }

  /**
   * Stop watching a symbol.
   * @param {string} symbol
   */
  unwatchSymbol(symbol) {
    const upper = (symbol || '').toUpperCase();
    if (!upper) return;

    // Clean up subscription to prevent leak
    const unsub = this._subscriptions.get(upper);
    if (unsub) { try { unsub(); } catch (e) { logger.data.warn('Operation failed', e); } this._subscriptions.delete(upper); }

    tickerPlant.unwatch(upper);
    this._symbolSources.delete(upper);
  }

  // ─── Data Source Queries ─────────────────────────────────────

  /**
   * Get the current primary data source for a symbol.
   * @param {string} symbol
   * @returns {string} One of DATA_SOURCE values
   */
  getDataSource(symbol) {
    const upper = (symbol || '').toUpperCase();
    const info = this._symbolSources.get(upper);
    return info?.primary || DATA_SOURCE.NO_DATA;
  }

  /**
   * Get all active source IDs for a symbol.
   * @param {string} symbol
   * @returns {string[]}
   */
  getActiveSources(symbol) {
    const upper = (symbol || '').toUpperCase();
    const info = this._symbolSources.get(upper);
    return info ? [...info.sources] : [];
  }

  /**
   * Get pipeline stats.
   * @returns {Object}
   */
  getStats() {
    return {
      ...this._stats,
      watchedSymbols: [...this._symbolSources.keys()],
      tickerPlantHealth: tickerPlant.getHealth(),
      uptime: this._started ? Math.round((Date.now() - this._stats.startTime) / 1000) : 0,
    };
  }

  /**
   * Get the latest Pyth confidence interval for a symbol.
   * Returns null for non-Pyth sources.
   * @param {string} symbol
   * @returns {{ confidence: number, timestamp: number } | null}
   */
  getConfidence(symbol) {
    try {
      return pythAdapter.getConfidence(symbol);
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      return null;
    }
  }

  /**
   * Get the bandwidth monitoring report.
   * @returns {Object}
   */
  getBandwidthReport() {
    return this._bandwidthMonitor.getReport();
  }

  // ─── Internal: Network Detection ────────────────────────────

  /** @private */
  _wireNetworkDetection() {
    if (typeof window === 'undefined') return;

    this._onOnline = () => {
      this._online = true;
      logger.data.info('Network restored — reconnecting sources');
      // Re-watch all symbols to reconnect
      for (const symbol of this._symbolSources.keys()) {
        tickerPlant.watch(symbol);
      }
      // Emit source change so badges update
      for (const [sym, info] of this._symbolSources) {
        if (info.primary === DATA_SOURCE.CACHED) {
          info.primary = DATA_SOURCE.NO_DATA; // Reset, will be set by next tick
          this._emitSourceChange(sym, info.primary);
        }
      }
    };

    this._onOffline = () => {
      this._online = false;
      logger.data.info('Network offline — serving cached data');
      // Switch all symbols to CACHED
      for (const [sym, info] of this._symbolSources) {
        const old = info.primary;
        info.primary = DATA_SOURCE.CACHED;
        if (old !== DATA_SOURCE.CACHED) {
          this._emitSourceChange(sym, DATA_SOURCE.CACHED);
        }
      }
    };

    window.addEventListener('online', this._onOnline);
    window.addEventListener('offline', this._onOffline);
  }

  // ─── Internal: Source Tracking ──────────────────────────────

  /**
   * Update source tracking based on aggregated data from TickerPlant.
   * Determines the primary data source label.
   * @private
   */
  _updateSourceTracking(symbol, aggData) {
    const info = this._symbolSources.get(symbol);
    if (!info) return;

    info.lastUpdate = Date.now();

    // Collect active source IDs
    if (aggData.sources) {
      info.sources = new Set(
        Array.isArray(aggData.sources) ? aggData.sources : []
      );
    }

    // Determine primary source label
    const oldPrimary = info.primary;
    info.primary = this._classifySource(aggData, info);

    if (oldPrimary !== info.primary) {
      this._emitSourceChange(symbol, info.primary);
    }
  }

  /**
   * Classify the data source based on aggregated data characteristics.
   * @private
   * @returns {string} DATA_SOURCE value
   */
  _classifySource(aggData, info) {
    if (!aggData || aggData.sourceCount === 0) {
      // Check if we have cached data
      const staleness = Date.now() - (info.lastUpdate || 0);
      if (staleness > 30_000 && info.lastUpdate > 0) return DATA_SOURCE.CACHED;
      return DATA_SOURCE.NO_DATA;
    }

    // Check source types from the aggregated sources
    const sources = info.sources;

    const hasDirectWS = sources.has('binance') || sources.has('kraken') ||
                        sources.has('bybit') || sources.has('okx') ||
                        sources.has('coinbase');
    const hasOracle = sources.has('pyth');
    const hasRest = sources.has('binance-rest') || sources.has('finnhub');

    if (hasDirectWS) return DATA_SOURCE.LIVE;
    if (hasOracle) return DATA_SOURCE.ORACLE;
    if (hasRest) return DATA_SOURCE.DELAYED;

    // If we have data but unknown source, classify as live
    if (aggData.sourceCount > 0) return DATA_SOURCE.LIVE;

    return DATA_SOURCE.NO_DATA;
  }

  // ─── Internal: Events ───────────────────────────────────────

  /** @private */
  _emitSourceChange(symbol, source) {
    const confidence = symbol ? this.getConfidence(symbol) : null;
    this.dispatchEvent(
      new CustomEvent('source-change', {
        detail: {
          symbol,
          source,
          confidence: confidence?.confidence || null,
          stats: this.getStats(),
        },
      })
    );
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const dataPipeline = new DataPipeline();
export default dataPipeline;
