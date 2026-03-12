// ═══════════════════════════════════════════════════════════════════
// charEdge — Datafeed Service Singleton
// Manages historical data fetching and WebSocket multiplexing.
// Guarantees only one connection is made per Symbol+Timeframe.
//
// Race-condition hardened: uses a generation counter + AbortController
// to prevent stale fetch results and zombie WebSocket connections
// when the user switches symbols rapidly.
// ═══════════════════════════════════════════════════════════════════

import { isCrypto } from '../../constants.js';
import { getAggregator, removeAggregator } from '../../data/OrderFlowAggregator.js';
import { WS_STATUS } from '../../data/WebSocketService';
import { useChartCoreStore } from '../../state/chart/useChartCoreStore';
import { tickChannel } from '../core/TickChannel.js';
import { logger } from '@/observability/logger';

// Maximum bars to keep in memory per symbol/timeframe.
// Oldest bars are evicted via splice when this limit is exceeded.
const MAX_BARS = 2000;

class DatafeedService {
  constructor() {
    this.cache = new Map(); // key: 'symbol_tf', value: { bars: [], status: 'idle'|'loading'|'ready', subscribers: Set(), generation: number }
    this.sockets = new Map(); // key: 'symbol_tf', value: WebSocket
    this._reconnectTimers = new Map(); // key → setTimeout id for pending reconnects
  }

  /**
   * Subscribes to historical and live tick data for a symbol and timeframe.
   * @param {string} symbol - e.g., 'BTCUSDT'
   * @param {string} tf - e.g., '1h'
   * @param {Object} callbacks - { onHistorical: (bars)=>void, onTick: (bars, latestBar)=>void, onError: (err)=>void }
   * @returns {Function} Unsubscribe function
   */
  subscribe(symbol, tf, { onHistorical, onTick, onError }) {
    const key = `${symbol}_${tf}`;

    if (!this.cache.has(key)) {
      this.cache.set(key, {
        bars: [],
        status: 'idle',
        subscribers: new Set(),
        generation: 0,
        _abortController: null,
      });
    }

    const entry = this.cache.get(key);
    const subscriber = { onHistorical, onTick, onError };
    entry.subscribers.add(subscriber);

    // Bump generation — invalidates any in-flight fetch for this key
    entry.generation = (entry.generation || 0) + 1;

    // If we already have bars, emit immediately
    if (entry.status === 'ready' && entry.bars.length > 0) {
      if (onHistorical) onHistorical(entry.bars);
    }
    // If not currently loading, trigger a load
    else if (entry.status === 'idle') {
      this._loadHistorical(symbol, tf, key);
    }

    return () => {
      entry.subscribers.delete(subscriber);
      if (entry.subscribers.size === 0) {
        this._cleanup(key);
      }
    };
  }

  getBars(symbol, tf) {
    const key = `${symbol}_${tf}`;
    return this.cache.get(key)?.bars || [];
  }

  async _loadHistorical(symbol, tf, key) {
    const entry = this.cache.get(key);
    if (!entry) return;

    // Capture the generation at the start of this fetch.
    // If it changes before the fetch completes, the result is stale.
    const gen = entry.generation;

    // Create an AbortController so in-flight fetches can be cancelled on unsubscribe
    if (entry._abortController) entry._abortController.abort();
    entry._abortController = new AbortController();
    const { signal } = entry._abortController;

    entry.status = 'loading';

    // Route non-crypto symbols through FetchService (Yahoo fallback chain)
    const baseSym = symbol.toUpperCase().replace(/USDT$|BUSD$|USD$/, '');
    if (!isCrypto(baseSym)) {
      try {
        const { fetchOHLC } = await import('../../data/FetchService.ts');
        // Map Binance-style timeframes to FetchService timeframe IDs
        const TF_MAP = {
          '1m': '1d', '3m': '1d', '5m': '1d', '15m': '5d', '30m': '5d',
          '1h': '1m', '2h': '1m', '4h': '3m', '6h': '3m', '8h': '3m',
          '12h': '6m', '1d': '6m', '3d': '1y', '1w': '1y', '1M': '1y',
        };
        const fetchTfId = TF_MAP[tf] || '3m';
        const result = await fetchOHLC(baseSym, fetchTfId);
        if (result && result.data && result.data.length > 0) {
          const bars = result.data.map(c => ({
            time: typeof c.time === 'string' ? new Date(c.time).getTime() : c.time,
            open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume || 0,
          }));

          const currentEntry = this.cache.get(key);
          // Guard: discard if entry was deleted or generation changed (stale fetch)
          if (!currentEntry || currentEntry.generation !== gen) return;
          currentEntry.bars = bars;
          currentEntry.status = 'ready';
          currentEntry._abortController = null;
          // Notify Zustand so useChartBars subscribers re-evaluate
          useChartCoreStore.getState().setDataMeta(bars.length, 'datafeed:equity', bars[0]?.time ?? null);
          // Push to TickChannel so ChartEngine gets bars directly (matches crypto path)
          tickChannel.pushHistorical(key, bars);
          currentEntry.subscribers.forEach(sub => {
            if (sub.onHistorical) sub.onHistorical(bars);
          });
          return;
        }
      } catch (e) { logger.engine.warn('Operation failed', e); }

      // No data available from any source (expected for symbols without configured data feeds)
      entry.status = 'error';
      const msg = `No data available for ${baseSym}`;
      logger.engine.info(msg);
      entry.subscribers.forEach(sub => {
        if (sub.onError) sub.onError(new Error(msg));
      });
      return;
    }

    try {
      const base = typeof window === 'undefined' ? `http://localhost:${globalThis.__TF_PORT || 3000}` : '';
      const url = `${base}/api/binance/v3/klines?symbol=${symbol}&interval=${tf}&limit=500`;
      const res = await fetch(url, { signal });

      if (!res.ok) throw new Error('Failed to fetch historical data');

      const data = await res.json();

      const bars = data.map((k) => ({
        time: k[0],
        open: +k[1],
        high: +k[2],
        low: +k[3],
        close: +k[4],
        volume: +k[5],
      }));

      // Guard: discard if entry was deleted, generation changed, or subscribers left
      const currentEntry = this.cache.get(key);
      if (!currentEntry || currentEntry.generation !== gen) return;

      currentEntry.bars = bars;
      currentEntry.status = 'ready';
      currentEntry._abortController = null;
      // Notify Zustand so useChartBars subscribers re-evaluate
      useChartCoreStore.getState().setDataMeta(bars.length, 'datafeed:crypto', bars[0]?.time ?? null);

      currentEntry.subscribers.forEach(sub => {
        if (sub.onHistorical) sub.onHistorical(bars);
      });

      // Push to TickChannel for direct engine delivery
      tickChannel.pushHistorical(key, bars);

      // Only start WebSocket if subscribers still exist (prevents zombie connections)
      if (currentEntry.subscribers.size > 0) {
        this._startWebSocket(symbol, tf, key);
      }

    } catch (err) {
      // Ignore AbortError — expected when user switches symbols during fetch
      if (err?.name === 'AbortError') return;

      const currentEntry = this.cache.get(key);
      if (currentEntry && currentEntry.generation === gen) {
        currentEntry.status = 'error';
        currentEntry._abortController = null;
        currentEntry.subscribers.forEach(sub => {
          if (sub.onError) sub.onError(err);
        });
      }
    }
  }

  _startWebSocket(symbol, tf, key) {
    // Clean up any existing socket (prevents duplicate connections during rapid reconnect)
    const existingWs = this.sockets.get(key);
    if (existingWs) {
      existingWs.onopen = null;
      existingWs.onmessage = null;
      existingWs.onclose = null;
      existingWs.onerror = null;
      try {
        if (existingWs.readyState === WebSocket.OPEN) {
          existingWs.close();
        }
      } catch (e) { logger.engine.warn('Operation failed', e); }
      this.sockets.delete(key);
    }

    const symLower = symbol.toLowerCase();
    const klineStream = `${symLower}@kline_${tf}`;
    const tradeStream = `${symLower}@aggTrade`;
    const depthStream = `${symLower}@depth20@100ms`;

    // Connect to multiplexed stream
    const wsUrl = `wss://data-stream.binance.vision/stream?streams=${klineStream}/${tradeStream}/${depthStream}`;
    const ws = new WebSocket(wsUrl);
    this.sockets.set(key, ws);
    useChartCoreStore.getState().setWsStatus(WS_STATUS.CONNECTING);

    const aggregator = getAggregator(key, 0.5); // Default tick size for MVP

    ws.onopen = () => {
      useChartCoreStore.getState().setWsStatus(WS_STATUS.CONNECTED);
    };

    ws.onerror = () => {
      // Expected during symbol switching — suppress to avoid console noise
      useChartCoreStore.getState().setWsStatus(WS_STATUS.DISCONNECTED);
    };

    ws.onclose = () => {
      this.sockets.delete(key);
      // Only reconnect if the subscription is still active (not cleaned up)
      if (this.cache.has(key) && this.cache.get(key).subscribers.size > 0) {
        useChartCoreStore.getState().setWsStatus(WS_STATUS.RECONNECTING);
        const baseDelay = 5000;
        const jitter = Math.random() * baseDelay * 0.5; // 0–2500ms jitter prevents thundering herd
        const timer = setTimeout(() => {
          this._reconnectTimers.delete(key);
          if (this.cache.has(key) && this.cache.get(key).subscribers.size > 0) {
            this._startWebSocket(symbol, tf, key);
          }
        }, baseDelay + jitter);
        this._reconnectTimers.set(key, timer);
      } else {
        useChartCoreStore.getState().setWsStatus(WS_STATUS.DISCONNECTED);
      }
    };

    ws.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        if (!payload.stream || !payload.data) return;

        const { stream, data: msg } = payload;
        const entry = this.cache.get(key);

        if (stream === klineStream && msg.e === 'kline' && msg.k) {
          const k = msg.k;
          const bar = {
            time: k.t,
            open: +k.o,
            high: +k.h,
            low: +k.l,
            close: +k.c,
            volume: +k.v,
          };

          if (!entry || entry.bars.length === 0) return;

          const prev = entry.bars;
          const last = prev[prev.length - 1];

          if (last.time === bar.time) {
            // Update current candle in-place — O(1) instead of O(N) spread
            // Preserve the footprint attached by the aggregator
            bar.footprint = last.footprint;
            bar.poc = last.poc;
            prev[prev.length - 1] = bar;
          } else {
            // Append new candle in-place — O(1) push instead of O(N) spread
            prev.push(bar);
            // Bump barCount so useChartBars subscribers re-evaluate on new candle
            useChartCoreStore.getState().setDataMeta(prev.length, 'datafeed:live', prev[0]?.time ?? null);
            // Evict oldest bars to cap memory usage
            if (prev.length > MAX_BARS) {
              prev.splice(0, prev.length - MAX_BARS);
            }
          }

          const updatedBars = prev;

          // Push through TickChannel (rAF-batched, bypasses React)
          tickChannel.pushTick(key, updatedBars, bar);

          // Notify React subscribers (for state updates like status/barCount)
          entry.subscribers.forEach(sub => {
            if (sub.onTick) sub.onTick(updatedBars, bar);
          });
        }
        else if (stream === tradeStream && msg.e === 'aggTrade') {
          // Process tick for footprint
          if (entry && entry.bars.length > 0) {
            const currentBar = entry.bars[entry.bars.length - 1];
            aggregator.processTrade(msg, currentBar);
          }
        }
        else if (stream === depthStream) {
          // Process DOM for heatmap
          aggregator.processDOMSnapshot(msg);
        }
      } catch (e) {
        // Parse error
        logger.engine.warn('WS Parse Error', e);
      }
    };

  }

  // ─── REST Depth Polling Fallback ──────────────────────────────
  // When the WebSocket depth stream is unavailable (geo-blocking, etc.),
  // poll the REST API to populate the aggregator's domHistory so the
  // heatmap has data to render.

  /**
   * Start polling depth snapshots via REST for a given symbol.
   * Only runs when the aggregator has no domHistory (WS not delivering).
   * @param {string} symbol - e.g., 'BTCUSDT'
   * @param {string} key - cache key e.g., 'BTCUSDT_1h'
   */
  startDepthPolling(symbol, key) {
    // Don't double-start
    if (this._depthPollers?.has(key)) return;
    if (!this._depthPollers) this._depthPollers = new Map();

    const aggregator = getAggregator(key, 0.5);

    const poll = async () => {
      try {
        const res = await fetch(`/api/binance/v3/depth?symbol=${symbol}&limit=1000`);
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.bids && data.asks) {
          aggregator.processDOMSnapshot(data);
        }
      } catch (_) {
        // Silently fail — REST may also be blocked
      }
    };

    // Poll immediately, then every 2 seconds
    poll();
    const timer = setInterval(poll, 2000);
    this._depthPollers.set(key, timer);
  }

  /**
   * Stop depth polling for a given key.
   * @param {string} key
   */
  stopDepthPolling(key) {
    if (!this._depthPollers) return;
    const timer = this._depthPollers.get(key);
    if (timer) {
      clearInterval(timer);
      this._depthPollers.delete(key);
    }
  }

  /**
   * Prepend older bars from scroll-back prefetch directly to the engine.
   * Bypasses React subscribers — engine picks up via TickChannel.
   * @param {string} symbol
   * @param {string} tf
   * @param {Array} olderBars - Bars to prepend (oldest first)
   */
  prependBars(symbol, tf, olderBars) {
    const key = `${symbol}_${tf}`;
    const entry = this.cache.get(key);
    if (!entry || !olderBars?.length) return;

    // Deduplicate by timestamp
    const existingTimes = new Set(entry.bars.map(b => b.time));
    const newBars = olderBars.filter(b => !existingTimes.has(b.time));
    if (newBars.length === 0) return;

    // Prepend in-place
    entry.bars.unshift(...newBars);

    // Push directly to engine via TickChannel (bypasses React)
    tickChannel.pushHistorical(key, entry.bars);
  }

  _cleanup(key) {
    // Zero active subscribers, drop connection and cache
    // (Clearing cache prevents gaps when re-subscribing later)

    // Cancel any in-flight fetch first
    const entry = this.cache.get(key);
    if (entry?._abortController) {
      entry._abortController.abort();
      entry._abortController = null;
    }

    // Cancel any pending reconnect timer
    const timer = this._reconnectTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this._reconnectTimers.delete(key);
    }

    const ws = this.sockets.get(key);
    if (ws) {
      // Null handlers before close to prevent reconnect scheduling
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      this.sockets.delete(key);
    }
    this.cache.delete(key);
    removeAggregator(key);
  }
}

export const datafeedService = new DatafeedService();
