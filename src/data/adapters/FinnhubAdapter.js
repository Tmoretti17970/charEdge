// ═══════════════════════════════════════════════════════════════════
// charEdge v11 — Finnhub Adapter
//
// Secondary data source for US equities, forex, and fundamentals.
// Free tier: 60 API calls/minute, real-time US stock ticks via WS.
//
// Provides:
//   - Real-time stock quotes (REST polling)
//   - WebSocket streaming for stock/forex ticks
//   - Earnings, filings, insider transactions
//   - Company fundamentals and recommendations
//
// Usage:
//   import { finnhubAdapter } from './FinnhubAdapter.js';
//   finnhubAdapter.setApiKey('YOUR_KEY');
//   const quote = await finnhubAdapter.fetchQuote('AAPL');
//   finnhubAdapter.subscribe('AAPL', (tick) => { ... });
// ═══════════════════════════════════════════════════════════════════

const BASE_URL = 'https://finnhub.io/api/v1';
const WS_URL = 'wss://ws.finnhub.io';
const RATE_LIMIT_INTERVAL = 1100; // ~55 requests/min (under 60 limit)

class _FinnhubAdapter {
  constructor() {
    this._apiKey = '';
    this._ws = null;
    this._wsConnected = false;
    this._subscribers = new Map();   // symbol → Set<callback>
    this._lastRequest = 0;
    this._requestQueue = [];
    this._cache = new Map();         // symbol → { data, expiry }
    this._cacheTTL = 5000;           // 5 second cache for quotes
  }

  // ─── Configuration ──────────────────────────────────────────

  /**
   * Set the Finnhub API key.
   * Get a free key at https://finnhub.io/register
   * @param {string} key
   */
  setApiKey(key) {
    this._apiKey = key;
  }

  /** @returns {boolean} */
  get isConfigured() {
    return !!this._apiKey;
  }

  // ─── Quote / Price ──────────────────────────────────────────

  /**
   * Fetch a real-time quote for a stock or forex symbol.
   * @param {string} symbol - e.g., 'AAPL', 'MSFT'
   * @returns {Promise<{ price, high, low, open, prevClose, change, changePct, timestamp }>}
   */
  async fetchQuote(symbol) {
    if (!this._apiKey) return null;

    // Check cache
    const cached = this._cache.get(symbol);
    if (cached && Date.now() < cached.expiry) return cached.data;

    const data = await this._request('/quote', { symbol });
    if (!data || !data.c) return null;

    const quote = {
      price: data.c,
      high: data.h,
      low: data.l,
      open: data.o,
      prevClose: data.pc,
      change: data.d,
      changePct: data.dp,
      timestamp: data.t ? data.t * 1000 : Date.now(),
    };

    this._cache.set(symbol, { data: quote, expiry: Date.now() + this._cacheTTL });
    return quote;
  }

  /**
   * Fetch company profile/fundamentals.
   * @param {string} symbol
   * @returns {Promise<Object>}
   */
  async fetchProfile(symbol) {
    if (!this._apiKey) return null;
    return this._request('/stock/profile2', { symbol });
  }

  /**
   * Fetch recommendation trends.
   * @param {string} symbol
   * @returns {Promise<Array>}
   */
  async fetchRecommendations(symbol) {
    if (!this._apiKey) return null;
    return this._request('/stock/recommendation', { symbol });
  }

  /**
   * Fetch earnings calendar.
   * @param {string} from - YYYY-MM-DD
   * @param {string} to - YYYY-MM-DD
   * @returns {Promise<Object>}
   */
  async fetchEarnings(from, to) {
    if (!this._apiKey) return null;
    return this._request('/calendar/earnings', { from, to });
  }

  /**
   * Fetch economic calendar (forex-relevant).
   * @param {string} from
   * @param {string} to
   * @returns {Promise<Object>}
   */
  async fetchEconomicCalendar(from, to) {
    if (!this._apiKey) return null;
    return this._request('/calendar/economic', { from, to });
  }

  /**
   * Fetch company news articles with sentiment.
   * @param {string} symbol
   * @param {string} from - YYYY-MM-DD
   * @param {string} to - YYYY-MM-DD
   * @returns {Promise<Array<{ headline, summary, source, url, datetime, sentiment }>>}
   */
  async fetchNews(symbol, from, to) {
    if (!this._apiKey) return [];
    const data = await this._request('/company-news', { symbol, from, to });
    if (!Array.isArray(data)) return [];
    return data.map(a => ({
      headline: a.headline,
      summary: a.summary,
      source: a.source,
      url: a.url,
      datetime: a.datetime ? new Date(a.datetime * 1000).toISOString() : null,
      image: a.image,
      category: a.category,
    }));
  }

  /**
   * Fetch general market news.
   * @returns {Promise<Array>}
   */
  async fetchMarketNews() {
    if (!this._apiKey) return [];
    const data = await this._request('/news', { category: 'general' });
    return Array.isArray(data) ? data : [];
  }

  /**
   * Fetch insider transactions for a company.
   * @param {string} symbol
   * @returns {Promise<Array<{ name, share, change, filingDate, transactionType }>>}
   */
  async fetchInsiderTransactions(symbol) {
    if (!this._apiKey) return [];
    const data = await this._request('/stock/insider-transactions', { symbol });
    if (!data?.data) return [];
    return data.data.map(t => ({
      name: t.name,
      share: t.share,
      change: t.change,
      filingDate: t.filingDate,
      transactionDate: t.transactionDate,
      transactionType: t.transactionType,
      transactionCode: t.transactionCode,
    }));
  }

  /**
   * Fetch IPO calendar.
   * @param {string} from - YYYY-MM-DD
   * @param {string} to - YYYY-MM-DD
   * @returns {Promise<Array>}
   */
  async fetchIPOCalendar(from, to) {
    if (!this._apiKey) return [];
    const data = await this._request('/calendar/ipo', { from, to });
    return data?.ipoCalendar || [];
  }

  /**
   * Fetch crypto candles (OHLCV) — backup source.
   * @param {string} symbol - e.g., 'BINANCE:BTCUSDT'
   * @param {string} resolution - '1','5','15','30','60','D','W','M'
   * @param {number} from - Unix timestamp
   * @param {number} to - Unix timestamp
   * @returns {Promise<Array>}
   */
  async fetchCryptoCandles(symbol, resolution = '60', from, to) {
    if (!this._apiKey) return [];
    if (!from) from = Math.floor(Date.now() / 1000) - 86400;
    if (!to) to = Math.floor(Date.now() / 1000);
    const data = await this._request('/crypto/candle', { symbol, resolution, from, to });
    if (data?.s !== 'ok' || !data.t) return [];
    return data.t.map((t, i) => ({
      time: t * 1000,
      open: data.o[i],
      high: data.h[i],
      low: data.l[i],
      close: data.c[i],
      volume: data.v[i],
    }));
  }

  /**
   * Search for symbols (stocks, forex, crypto).
   * @param {string} query
   * @returns {Promise<Array<{ symbol, description, type }>>}
   */
  async searchSymbols(query) {
    if (!this._apiKey) return [];
    const data = await this._request('/search', { q: query });
    if (!data?.result) return [];
    return data.result.map(r => ({
      symbol: r.symbol,
      description: r.description,
      type: r.type,
      displaySymbol: r.displaySymbol,
    }));
  }

  // ─── WebSocket Streaming ──────────────────────────────────

  /**
   * Subscribe to real-time ticks for a symbol via WebSocket.
   * @param {string} symbol
   * @param {Function} callback - ({ price, volume, timestamp }) => void
   * @returns {Function} unsubscribe
   */
  subscribe(symbol, callback) {
    if (!this._apiKey) return () => {};

    const upper = symbol.toUpperCase();

    if (!this._subscribers.has(upper)) {
      this._subscribers.set(upper, new Set());
    }
    this._subscribers.get(upper).add(callback);

    // Start WS if not connected
    this._ensureWebSocket();

    // Send subscribe message
    if (this._wsConnected) {
      this._wsSend({ type: 'subscribe', symbol: upper });
    }

    return () => {
      const subs = this._subscribers.get(upper);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this._subscribers.delete(upper);
          if (this._wsConnected) {
            this._wsSend({ type: 'unsubscribe', symbol: upper });
          }
        }
      }
    };
  }

  /**
   * Check if Finnhub supports streaming for a symbol.
   * @param {string} symbol
   * @returns {boolean}
   */
  supports(symbol) {
    if (!this._apiKey) return false;
    const upper = (symbol || '').toUpperCase();
    // Finnhub supports US stocks and some forex
    return /^[A-Z]{1,5}$/.test(upper) || upper.includes('OANDA:');
  }

  // ─── Private Methods ────────────────────────────────────────

  /** @private */
  async _request(endpoint, params = {}) {
    // Rate limiting
    const now = Date.now();
    const wait = RATE_LIMIT_INTERVAL - (now - this._lastRequest);
    if (wait > 0) {
      await new Promise(r => setTimeout(r, wait));
    }
    this._lastRequest = Date.now();

    const url = new URL(`${BASE_URL}${endpoint}`);
    url.searchParams.set('token', this._apiKey);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        if (res.status === 429) {
          console.warn('[FinnhubAdapter] Rate limited — backing off');
          await new Promise(r => setTimeout(r, 5000));
        }
        return null;
      }
      return await res.json();
    } catch (err) {
      console.warn('[FinnhubAdapter] Request failed:', err.message);
      return null;
    }
  }

  /** @private */
  _ensureWebSocket() {
    if (this._ws) return;

    try {
      this._ws = new WebSocket(`${WS_URL}?token=${this._apiKey}`);

      this._ws.onopen = () => {
        this._wsConnected = true;
        console.log('[FinnhubAdapter] WebSocket connected');

        // Subscribe to all pending symbols
        for (const symbol of this._subscribers.keys()) {
          this._wsSend({ type: 'subscribe', symbol });
        }
      };

      this._ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'trade' && msg.data) {
            for (const trade of msg.data) {
              const symbol = trade.s;
              const subs = this._subscribers.get(symbol);
              if (subs) {
                const tick = {
                  price: trade.p,
                  volume: trade.v,
                  timestamp: trade.t,
                  conditions: trade.c,
                };
                for (const cb of subs) {
                  try { cb(tick); } catch { /* ignore */ }
                }
              }
            }
          }
        } catch {
          /* ignore */
        }
      };

      this._ws.onclose = () => {
        this._wsConnected = false;
        this._ws = null;
        // Reconnect after delay
        setTimeout(() => {
          if (this._subscribers.size > 0) this._ensureWebSocket();
        }, 3000);
      };

      this._ws.onerror = () => {
        this._wsConnected = false;
      };
    } catch {
      this._ws = null;
    }
  }

  /** @private */
  _wsSend(msg) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(msg));
    }
  }

  /**
   * Disconnect WebSocket and clean up.
   */
  dispose() {
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this._subscribers.clear();
    this._cache.clear();
  }
}

// ─── Singleton + Exports ──────────────────────────────────────────

export const finnhubAdapter = new _FinnhubAdapter();
export default finnhubAdapter;
