// ═══════════════════════════════════════════════════════════════════
// charEdge v15 — Bybit Futures Adapter
//
// Mirror of BinanceFuturesAdapter for Bybit's free API:
//   • Open Interest snapshots & history
//   • Funding rate history
//   • Long/Short account ratio
//   • Liquidation stream via WebSocket
//
// Enables cross-exchange OI aggregation and funding arbitrage detection.
//
// API Docs: https://bybit-exchange.github.io/docs/v5/
// Rate Limits: 120 requests/min (generous)
//
// Usage:
//   import { bybitFuturesAdapter } from './BybitFuturesAdapter.js';
//   const oi = await bybitFuturesAdapter.getOpenInterest('BTCUSDT');
//   const funding = await bybitFuturesAdapter.getFundingRateHistory('BTCUSDT');
//   bybitFuturesAdapter.subscribeLiquidations('BTCUSDT', cb);
// ═══════════════════════════════════════════════════════════════════

// ─── Constants ─────────────────────────────────────────────────

const REST_BASE = 'https://api.bybit.com';
const WS_PUBLIC = 'wss://stream.bybit.com/v5/public/linear';
const REQUEST_TIMEOUT = 8000;

// ─── Helpers ───────────────────────────────────────────────────

async function fetchJSON(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.retCode !== 0) throw new Error(json.retMsg || 'API error');
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Bybit Futures Adapter ─────────────────────────────────────

class _BybitFuturesAdapter {
  constructor() {
    this._ws = null;
    this._liquidationCallbacks = new Map();    // symbol → Set<callback>
    this._wsConnected = false;
    this._reconnectTimer = null;
    this._subscribedTopics = new Set();
  }

  // ─── REST API ──────────────────────────────────────────────

  /**
   * Get current Open Interest for a symbol.
   *
   * @param {string} symbol - e.g., 'BTCUSDT'
   * @returns {Promise<{ symbol, openInterest, timestamp }>}
   */
  async getOpenInterest(symbol) {
    const data = await fetchJSON(
      `${REST_BASE}/v5/market/open-interest?category=linear&symbol=${symbol}&intervalTime=5min&limit=1`
    );
    const entry = data?.list?.[0];
    if (!entry) return null;
    return {
      symbol,
      openInterest: parseFloat(entry.openInterest) || 0,
      timestamp: parseInt(entry.timestamp) || Date.now(),
    };
  }

  /**
   * Get Open Interest history.
   *
   * @param {string} symbol
   * @param {string} [interval='5min'] - '5min', '15min', '30min', '1h', '4h', '1d'
   * @param {number} [limit=50]
   * @returns {Promise<Array<{ openInterest, timestamp }>>}
   */
  async getOpenInterestHistory(symbol, interval = '5min', limit = 50) {
    const data = await fetchJSON(
      `${REST_BASE}/v5/market/open-interest?category=linear&symbol=${symbol}&intervalTime=${interval}&limit=${limit}`
    );
    return (data?.list || []).map(entry => ({
      openInterest: parseFloat(entry.openInterest) || 0,
      timestamp: parseInt(entry.timestamp) || 0,
    })).reverse();
  }

  /**
   * Get funding rate history.
   *
   * @param {string} symbol
   * @param {number} [limit=50]
   * @returns {Promise<Array<{ fundingRate, fundingRateTimestamp, symbol }>>}
   */
  async getFundingRateHistory(symbol, limit = 50) {
    const data = await fetchJSON(
      `${REST_BASE}/v5/market/funding/history?category=linear&symbol=${symbol}&limit=${limit}`
    );
    return (data?.list || []).map(entry => ({
      symbol,
      fundingRate: parseFloat(entry.fundingRate) || 0,
      fundingRateTimestamp: parseInt(entry.fundingRateTimestamp) || 0,
    })).reverse();
  }

  /**
   * Get the current funding rate.
   *
   * @param {string} symbol
   * @returns {Promise<{ fundingRate, nextFundingTime }>}
   */
  async getCurrentFundingRate(symbol) {
    const data = await fetchJSON(
      `${REST_BASE}/v5/market/tickers?category=linear&symbol=${symbol}`
    );
    const ticker = data?.list?.[0];
    if (!ticker) return null;
    return {
      symbol,
      fundingRate: parseFloat(ticker.fundingRate) || 0,
      nextFundingTime: parseInt(ticker.nextFundingTime) || 0,
      lastPrice: parseFloat(ticker.lastPrice) || 0,
      indexPrice: parseFloat(ticker.indexPrice) || 0,
      markPrice: parseFloat(ticker.markPrice) || 0,
      openInterest: parseFloat(ticker.openInterest) || 0,
      volume24h: parseFloat(ticker.volume24h) || 0,
      turnover24h: parseFloat(ticker.turnover24h) || 0,
    };
  }

  /**
   * Get long/short account ratio.
   *
   * @param {string} symbol
   * @param {string} [period='5min'] - '5min', '15min', '30min', '1h', '4h', '1d'
   * @param {number} [limit=50]
   * @returns {Promise<Array<{ longRatio, shortRatio, timestamp }>>}
   */
  async getLongShortRatio(symbol, period = '5min', limit = 50) {
    const data = await fetchJSON(
      `${REST_BASE}/v5/market/account-ratio?category=linear&symbol=${symbol}&period=${period}&limit=${limit}`
    );
    return (data?.list || []).map(entry => ({
      longRatio: parseFloat(entry.buyRatio) || 0,
      shortRatio: parseFloat(entry.sellRatio) || 0,
      timestamp: parseInt(entry.timestamp) || 0,
    })).reverse();
  }

  /**
   * Get multiple symbols' tickers (for cross-pair scanning).
   *
   * @param {string[]} [symbols]
   * @returns {Promise<Array>}
   */
  async getLinearTickers(symbols) {
    const data = await fetchJSON(
      `${REST_BASE}/v5/market/tickers?category=linear`
    );
    const list = data?.list || [];
    if (symbols) {
      const set = new Set(symbols.map(s => s.toUpperCase()));
      return list.filter(t => set.has(t.symbol));
    }
    return list.map(t => ({
      symbol: t.symbol,
      lastPrice: parseFloat(t.lastPrice) || 0,
      fundingRate: parseFloat(t.fundingRate) || 0,
      openInterest: parseFloat(t.openInterest) || 0,
      volume24h: parseFloat(t.volume24h) || 0,
    }));
  }

  // ─── WebSocket: Liquidation Stream ───────────────────────

  /**
   * Subscribe to real-time liquidation feed for a symbol.
   *
   * @param {string} symbol - e.g., 'BTCUSDT'
   * @param {Function} callback - ({ symbol, side, qty, price, timestamp }) => void
   * @returns {Function} unsubscribe
   */
  subscribeLiquidations(symbol, callback) {
    const upper = (symbol || '').toUpperCase();
    if (!this._liquidationCallbacks.has(upper)) {
      this._liquidationCallbacks.set(upper, new Set());
    }
    this._liquidationCallbacks.get(upper).add(callback);

    this._ensureWS();
    this._subscribeToTopic(`liquidation.${upper}`);

    return () => {
      const cbs = this._liquidationCallbacks.get(upper);
      if (cbs) {
        cbs.delete(callback);
        if (cbs.size === 0) {
          this._liquidationCallbacks.delete(upper);
          this._unsubscribeFromTopic(`liquidation.${upper}`);
        }
      }
    };
  }

  /**
   * Get adapter stats.
   */
  getStats() {
    return {
      wsConnected: this._wsConnected,
      subscribedSymbols: [...this._liquidationCallbacks.keys()],
      topicCount: this._subscribedTopics.size,
    };
  }

  /**
   * Dispose: close WS and clean up.
   */
  dispose() {
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    this._liquidationCallbacks.clear();
    this._subscribedTopics.clear();
    this._wsConnected = false;
  }

  // ─── Private Methods ─────────────────────────────────────────

  /** @private */
  _ensureWS() {
    if (this._ws && this._wsConnected) return;
    if (this._ws) return; // Connecting

    try {
      this._ws = new WebSocket(WS_PUBLIC);

      this._ws.onopen = () => {
        this._wsConnected = true;
        // Re-subscribe to all topics
        for (const topic of this._subscribedTopics) {
          this._sendSubscribe(topic);
        }
      };

      this._ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.topic?.startsWith('liquidation.')) {
            const data = msg.data;
            if (data) {
              const symbol = data.symbol || msg.topic.replace('liquidation.', '');
              const cbs = this._liquidationCallbacks.get(symbol);
              if (cbs) {
                const liq = {
                  symbol,
                  side: data.side === 'Buy' ? 'buy' : 'sell',
                  qty: parseFloat(data.size) || 0,
                  price: parseFloat(data.price) || 0,
                  timestamp: parseInt(data.updatedTime) || Date.now(),
                  exchange: 'bybit',
                };
                for (const cb of cbs) {
                  try { cb(liq); } catch { /* ignore */ }
                }
              }
            }
          }
        } catch { /* silent parse error */ }
      };

      this._ws.onclose = () => {
        this._wsConnected = false;
        this._ws = null;
        // Reconnect after 5 seconds
        this._reconnectTimer = setTimeout(() => {
          if (this._liquidationCallbacks.size > 0) {
            this._ensureWS();
          }
        }, 5000);
      };

      this._ws.onerror = () => {
        // onclose will fire after this
      };
    } catch (err) {
      console.warn('[BybitFutures] WebSocket init failed:', err.message);
    }
  }

  /** @private */
  _subscribeToTopic(topic) {
    this._subscribedTopics.add(topic);
    if (this._wsConnected) {
      this._sendSubscribe(topic);
    }
  }

  /** @private */
  _unsubscribeFromTopic(topic) {
    this._subscribedTopics.delete(topic);
    if (this._wsConnected && this._ws) {
      this._ws.send(JSON.stringify({ op: 'unsubscribe', args: [topic] }));
    }
  }

  /** @private */
  _sendSubscribe(topic) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ op: 'subscribe', args: [topic] }));
    }
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const bybitFuturesAdapter = new _BybitFuturesAdapter();
export default bybitFuturesAdapter;
