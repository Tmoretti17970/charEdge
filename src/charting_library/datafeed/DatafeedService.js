// ═══════════════════════════════════════════════════════════════════
// charEdge — Datafeed Service Singleton
// Manages historical data fetching and WebSocket multiplexing.
// Guarantees only one connection is made per Symbol+Timeframe.
// ═══════════════════════════════════════════════════════════════════

import { getAggregator, removeAggregator } from '../../data/OrderFlowAggregator.js';
import { useChartStore } from '../../state/useChartStore.js';
import { WS_STATUS } from '../../data/WebSocketService.ts';
import { isCrypto } from '../../constants.js';
import { tickChannel } from '../core/TickChannel.js';
import { logger } from '../../utils/logger';

class DatafeedService {
  constructor() {
    this.cache = new Map(); // key: 'symbol_tf', value: { bars: [], status: 'idle'|'loading'|'ready', subscribers: Set() }
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
      });
    }

    const entry = this.cache.get(key);
    const subscriber = { onHistorical, onTick, onError };
    entry.subscribers.add(subscriber);

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
          if (!currentEntry) return;
          currentEntry.bars = bars;
          currentEntry.status = 'ready';
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
      const res = await fetch(url);

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

      // In case subscribers unsubscribed during fetch
      const currentEntry = this.cache.get(key);
      if (!currentEntry) return;

      currentEntry.bars = bars;
      currentEntry.status = 'ready';

      currentEntry.subscribers.forEach(sub => {
        if (sub.onHistorical) sub.onHistorical(bars);
      });

      // Push to TickChannel for direct engine delivery
      tickChannel.pushHistorical(key, bars);

      // Start live multiplexed WebSocket updates
      this._startWebSocket(symbol, tf, key);

    } catch (err) {
      const currentEntry = this.cache.get(key);
      if (currentEntry) {
        currentEntry.status = 'error';
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
    useChartStore.getState().setWsStatus(WS_STATUS.CONNECTING);

    const aggregator = getAggregator(key, 0.5); // Default tick size for MVP

    ws.onopen = () => {
      useChartStore.getState().setWsStatus(WS_STATUS.CONNECTED);
    };

    ws.onerror = () => {
      // Expected during symbol switching — suppress to avoid console noise
      useChartStore.getState().setWsStatus(WS_STATUS.DISCONNECTED);
    };

    ws.onclose = () => {
      this.sockets.delete(key);
      // Only reconnect if the subscription is still active (not cleaned up)
      if (this.cache.has(key) && this.cache.get(key).subscribers.size > 0) {
        useChartStore.getState().setWsStatus(WS_STATUS.RECONNECTING);
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
        useChartStore.getState().setWsStatus(WS_STATUS.DISCONNECTED);
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

    // Cancel any pending reconnect timer first
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
