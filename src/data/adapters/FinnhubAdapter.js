import { logger } from '@/observability/logger';
// ═══════════════════════════════════════════════════════════════════
// charEdge v11 — Finnhub Adapter
//
// Secondary data source for US equities, forex, and fundamentals.
// Free tier: 60 API calls/minute, real-time US stock ticks via WS.
//
// Phase 2.1.1: REST requests routed through /api/proxy/finnhub/ —
// server proxy injects the API key from env vars. WebSocket still
// uses client-side token (WS proxying requires different infra).
//
// Provides:
//   - Real-time stock quotes (REST polling)
//   - WebSocket streaming for stock/forex ticks
//   - Earnings, filings, insider transactions
//   - Company fundamentals and recommendations
//
// Usage:
//   import { finnhubAdapter } from './FinnhubAdapter.js';
//   const quote = await finnhubAdapter.fetchQuote('AAPL');
//   finnhubAdapter.subscribe('AAPL', (tick) => { ... });
// ═══════════════════════════════════════════════════════════════════

// Phase 2.1.1: REST goes through server proxy
const PROXY_BASE = '/api/proxy/finnhub';
// WebSocket still requires client-side token (no WS proxy yet)
const WS_URL = 'wss://ws.finnhub.io';
const RATE_LIMIT_INTERVAL = 1100; // ~55 requests/min (under 60 limit)

class _FinnhubAdapter {
  constructor() {
    this._wsToken = ''; // Only needed for WebSocket streaming
    this._ws = null;
    this._wsConnected = false;
    this._subscribers = new Map();   // symbol → Set<callback>
    this._lastRequest = 0;
    this._requestQueue = [];
    this._cache = new Map();         // symbol → { data, expiry }
    this._cacheTTL = 5000;           // 5 second cache for quotes
  }

  // ─── Configuration ──────────────────────────────────────────

  // Phase 2.1.1: REST API key is server-side — always "configured"
  get isConfigured() { return true; }

  /**
   * Set the Finnhub API key (only used for WebSocket streaming).
   * REST calls go through the server proxy automatically.
   * @param {string} key
   */
  setApiKey(key) {
    this._wsToken = key;
  }

  // ─── Quote / Price ──────────────────────────────────────────

  /**
   * Fetch a real-time quote for a stock or forex symbol.
   * @param {string} symbol - e.g., 'AAPL', 'MSFT'
   * @returns {Promise<{ price, high, low, open, prevClose, change, changePct, timestamp }>}
   */
  async fetchQuote(symbol) {
    // Check cache
    const cached = this._cache.get(symbol);
    if (cached && Date.now() < cached.expiry) return cached.data;

    const data = await this._request('quote', { symbol });
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
    return this._request('stock/profile2', { symbol });
  }

  /**
   * Fetch recommendation trends.
   * @param {string} symbol
   * @returns {Promise<Array>}
   */
  async fetchRecommendations(symbol) {
    return this._request('stock/recommendation', { symbol });
  }

  /**
   * Fetch earnings calendar.
   * @param {string} from - YYYY-MM-DD
   * @param {string} to - YYYY-MM-DD
   * @returns {Promise<Object>}
   */
  async fetchEarnings(from, to) {
    return this._request('calendar/earnings', { from, to });
  }

  /**
   * Fetch economic calendar (forex-relevant).
   * @param {string} from
   * @param {string} to
   * @returns {Promise<Object>}
   */
  async fetchEconomicCalendar(from, to) {
    return this._request('calendar/economic', { from, to });
  }

  /**
   * Fetch company news articles with sentiment.
   * @param {string} symbol
   * @param {string} from - YYYY-MM-DD
   * @param {string} to - YYYY-MM-DD
   * @returns {Promise<Array<{ headline, summary, source, url, datetime, sentiment }>>}
   */
  async fetchNews(symbol, from, to) {
    const data = await this._request('company-news', { symbol, from, to });
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
    const data = await this._request('news', { category: 'general' });
    return Array.isArray(data) ? data : [];
  }

  /**
   * Fetch insider transactions for a company.
   * @param {string} symbol
   * @returns {Promise<Array<{ name, share, change, filingDate, transactionType }>>}
   */
  async fetchInsiderTransactions(symbol) {
    const data = await this._request('stock/insider-transactions', { symbol });
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
    const data = await this._request('calendar/ipo', { from, to });
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
    if (!from) from = Math.floor(Date.now() / 1000) - 86400;
    if (!to) to = Math.floor(Date.now() / 1000);
    const data = await this._request('crypto/candle', { symbol, resolution, from, to });
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
    const data = await this._request('search', { q: query });
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
   * Note: WebSocket still requires a client-side token via setApiKey().
   * @param {string} symbol
   * @param {Function} callback - ({ price, volume, timestamp }) => void
   * @returns {Function} unsubscribe
   */
  async subscribe(symbol, callback) {
    // Phase 1d: auto-fetch WS token from server if not set
    if (!this._wsToken) {
      try {
        const res = await fetch('/api/proxy/finnhub-ws-token');
        const json = await res.json();
        if (json?.ok && json.token) {
          this._wsToken = json.token;
        }
      } catch { /* token fetch failed — WS will be unavailable */ }
    }
    if (!this._wsToken) return () => { };

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
    const upper = (symbol || '').toUpperCase();
    // Finnhub supports US stocks and some forex
    return /^[A-Z]{1,5}$/.test(upper) || upper.includes('OANDA:');
  }

  // ─── Private Methods ────────────────────────────────────────

  /** @private — REST requests go through server proxy */
  async _request(endpoint, params = {}) {
    // Rate limiting (client-side courtesy throttle)
    const now = Date.now();
    const wait = RATE_LIMIT_INTERVAL - (now - this._lastRequest);
    if (wait > 0) {
      await new Promise(r => setTimeout(r, wait));
    }
    this._lastRequest = Date.now();

    // Phase 2.1.1: Route through server proxy (no token param)
    const url = new URL(`${PROXY_BASE}/${endpoint}`, window.location.origin);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        if (res.status === 429) {
          logger.data.warn('[FinnhubAdapter] Rate limited — backing off');
          await new Promise(r => setTimeout(r, 5000));
        }
        return null;
      }
      // Guard: Vite dev server returns HTML for unknown routes
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        return null;
      }
      return await res.json();
    } catch (err) {
      logger.data.debug('[FinnhubAdapter] Request failed:', err.message);
      return null;
    }
  }

  /** @private */
  _ensureWebSocket() {
    if (this._ws) return;

    try {
      this._ws = new WebSocket(`${WS_URL}?token=${this._wsToken}`);

      this._ws.onopen = () => {
        this._wsConnected = true;
        logger.data.info('[FinnhubAdapter] WebSocket connected');

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
                  try { cb(tick); } catch (e) { logger.data.warn('Operation failed', e); }
                }
              }
            }
          }
        // eslint-disable-next-line unused-imports/no-unused-vars
        } catch (_) {
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
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
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
