// ═══════════════════════════════════════════════════════════════════
// charEdge — Polygon.io Adapter (6.5.2)
//
// Multi-asset market data via Polygon.io REST v2/v3 APIs.
// Supports stocks, options, crypto, and forex.
//
// API Docs: https://polygon.io/docs
// Auth: apiKey query parameter or Authorization header
// ═══════════════════════════════════════════════════════════════════

import { BaseAdapter } from './BaseAdapter.js';
import { logger } from '../../utils/logger';

// ─── Constants ──────────────────────────────────────────────────

const POLYGON_REST = 'https://api.polygon.io';
const POLYGON_WS = 'wss://socket.polygon.io/stocks';

// Map charEdge intervals → Polygon timespan + multiplier
const INTERVAL_MAP = {
    '1m': { multiplier: 1, timespan: 'minute' },
    '5m': { multiplier: 5, timespan: 'minute' },
    '15m': { multiplier: 15, timespan: 'minute' },
    '30m': { multiplier: 30, timespan: 'minute' },
    '1h': { multiplier: 1, timespan: 'hour' },
    '2h': { multiplier: 2, timespan: 'hour' },
    '4h': { multiplier: 4, timespan: 'hour' },
    '1d': { multiplier: 1, timespan: 'day' },
    '1w': { multiplier: 1, timespan: 'week' },
    '1M': { multiplier: 1, timespan: 'month' },
};

// Default date range for OHLCV fetch (2 years back)
function defaultDateRange() {
    const to = new Date();
    const from = new Date();
    from.setFullYear(from.getFullYear() - 2);
    return {
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0],
    };
}

// ─── Polygon Adapter Class ──────────────────────────────────────

export class PolygonAdapter extends BaseAdapter {
    constructor() {
        super('polygon');
        this._apiKey = '';
        this._ws = null;
        this._wsCallbacks = new Map(); // symbol → Set<callback>
    }

    // ─── Configuration ──────────────────────────────────────────

    /**
     * Configure Polygon.io API key.
     * @param {string} apiKey - Polygon.io API key
     */
    configure(apiKey) {
        this._apiKey = apiKey;
    }

    get isConfigured() {
        return !!this._apiKey;
    }

    /** @private */
    _url(path, params = {}) {
        const url = new URL(`${POLYGON_REST}${path}`);
        url.searchParams.set('apiKey', this._apiKey);
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
        }
        return url.toString();
    }

    /** @private — rate-limited fetch with graceful error handling */
    async _fetch(path, params = {}, _retryCount = 0) {
        // Client-side rate limiting: 300ms between requests (~200 req/min)
        const now = Date.now();
        const wait = 300 - (now - (this._lastRequest || 0));
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
        this._lastRequest = Date.now();

        const url = this._url(path, params);
        try {
            const res = await fetch(url);
            if (res.ok) return res.json();

            // 429 Too Many Requests — backoff and retry once
            if (res.status === 429 && _retryCount < 1) {
                logger.data.debug('[Polygon] Rate limited — retrying in 3s');
                await new Promise(r => setTimeout(r, 3000));
                return this._fetch(path, params, _retryCount + 1);
            }

            // 429 after retry or 503 Service Unavailable — fail silently
            if (res.status === 429 || res.status === 503) {
                logger.data.debug(`[Polygon] ${res.status} — skipping request`);
                return null;
            }

            // Other errors — still throw for real failures
            const body = await res.text().catch(() => '');
            throw new Error(`Polygon ${res.status}: ${body}`);
        } catch (err) {
            // Network errors — fail silently
            if (err.name === 'TypeError' || err.message?.includes('fetch')) {
                logger.data.debug('[Polygon] Network error:', err.message);
                return null;
            }
            throw err;
        }
    }

    // ─── BaseAdapter Interface ──────────────────────────────────

    supports(symbol) {
        // Polygon supports US stocks, ETFs, options, crypto, forex
        const s = (symbol || '').toUpperCase();
        // Skip Binance-style crypto pairs (BTCUSDT) — Polygon uses X:BTCUSD format
        if (s.endsWith('USDT') || s.endsWith('BUSD')) return false;
        // Support 1-5 char stock tickers and X: prefixed crypto
        return /^[A-Z]{1,5}$/.test(s) || s.startsWith('X:') || s.startsWith('O:') || s.startsWith('C:');
    }

    /**
     * Fetch OHLCV candle data.
     * @param {string} symbol - e.g., 'AAPL', 'X:BTCUSD'
     * @param {string} interval - e.g., '1h', '1d'
     * @param {Object} [opts] - { from, to, limit }
     */
    async fetchOHLCV(symbol, interval = '1d', opts = {}) {
        if (!this.isConfigured) throw new Error('Polygon.io not configured. Set API key in Settings.');

        const { multiplier, timespan } = INTERVAL_MAP[interval] || INTERVAL_MAP['1d'];
        const dates = defaultDateRange();
        const from = opts.from ? new Date(opts.from).toISOString().split('T')[0] : dates.from;
        const to = opts.to ? new Date(opts.to).toISOString().split('T')[0] : dates.to;

        const data = await this._fetch(
            `/v2/aggs/ticker/${symbol.toUpperCase()}/range/${multiplier}/${timespan}/${from}/${to}`,
            {
                adjusted: 'true',
                sort: 'asc',
                limit: opts.limit || 5000,
            },
        );

        if (!data.results?.length) return [];

        return data.results.map((bar) => ({
            time: bar.t,         // Unix ms
            open: bar.o,
            high: bar.h,
            low: bar.l,
            close: bar.c,
            volume: bar.v || 0,
        }));
    }

    /**
     * Fetch current quote/snapshot.
     */
    async fetchQuote(symbol) {
        if (!this.isConfigured) return null;

        try {
            const data = await this._fetch(
                `/v2/snapshot/locale/us/markets/stocks/tickers/${symbol.toUpperCase()}`,
            );

            const ticker = data.ticker || {};
            const day = ticker.day || {};
            const prevDay = ticker.prevDay || {};
            const last = ticker.lastTrade || {};

            const price = last.p || day.c || 0;
            const change = price - (prevDay.c || 0);

            return {
                price,
                change,
                changePct: prevDay.c ? (change / prevDay.c) * 100 : 0,
                volume: day.v || 0,
                high: day.h || 0,
                low: day.l || 0,
                open: day.o || 0,
            };
        } catch (_) {
            return null;
        }
    }

    /**
     * Subscribe to real-time trade updates via Polygon WebSocket.
     */
    subscribe(symbol, callback) {
        if (!this.isConfigured) return () => { };

        const upper = symbol.toUpperCase();

        // Track callback
        if (!this._wsCallbacks.has(upper)) {
            this._wsCallbacks.set(upper, new Set());
        }
        this._wsCallbacks.get(upper).add(callback);

        // Create/reuse WebSocket
        if (!this._ws || this._ws.readyState > WebSocket.OPEN) {
            this._initWebSocket();
        }

        // Subscribe to trade stream once connected
        if (this._ws?.readyState === WebSocket.OPEN) {
            this._ws.send(JSON.stringify({ action: 'subscribe', params: `T.${upper}` }));
        }

        return () => {
            const cbs = this._wsCallbacks.get(upper);
            if (cbs) {
                cbs.delete(callback);
                if (cbs.size === 0) {
                    this._wsCallbacks.delete(upper);
                    if (this._ws?.readyState === WebSocket.OPEN) {
                        this._ws.send(JSON.stringify({ action: 'unsubscribe', params: `T.${upper}` }));
                    }
                }
            }
        };
    }

    /**
     * Search for symbols matching a query.
     */
    async searchSymbols(query, limit = 10) {
        if (!this.isConfigured) return [];

        try {
            const data = await this._fetch('/v3/reference/tickers', {
                search: query,
                active: 'true',
                sort: 'ticker',
                order: 'asc',
                limit,
            });

            return (data.results || []).map((t) => ({
                symbol: t.ticker,
                name: t.name,
                type: t.type || 'UNKNOWN',
                exchange: t.primary_exchange || t.market || 'Polygon',
            }));
        } catch (_) {
            return [];
        }
    }

    // ─── WebSocket ──────────────────────────────────────────────

    /** @private */
    _initWebSocket() {
        try {
            this._ws = new WebSocket(POLYGON_WS);

            this._ws.onopen = () => {
                // Authenticate
                this._ws.send(JSON.stringify({ action: 'auth', params: this._apiKey }));

                // Subscribe to all tracked symbols
                for (const sym of this._wsCallbacks.keys()) {
                    this._ws.send(JSON.stringify({ action: 'subscribe', params: `T.${sym}` }));
                }
            };

            this._ws.onmessage = (event) => {
                try {
                    const messages = JSON.parse(event.data);
                    for (const msg of Array.isArray(messages) ? messages : [messages]) {
                        if (msg.ev === 'T') {
                            // Trade event
                            const cbs = this._wsCallbacks.get(msg.sym);
                            if (cbs) {
                                const tick = {
                                    price: msg.p,
                                    volume: msg.s || 0,
                                    time: msg.t,
                                    symbol: msg.sym,
                                };
                                for (const cb of cbs) {
                                    try { cb(tick); } catch (e) { logger.data.warn('Operation failed', e); }
                                }
                            }
                        }
                    }
                } catch (e) { logger.data.warn('Operation failed', e); }
            };

            this._ws.onerror = () => { /* silent */ };

            this._ws.onclose = () => {
                this._ws = null;
                // Auto-reconnect after 5s if we still have subscribers
                if (this._wsCallbacks.size > 0) {
                    setTimeout(() => this._initWebSocket(), 5000);
                }
            };
        } catch (_) {
            this._ws = null;
        }
    }

    // ─── Lifecycle ──────────────────────────────────────────────

    dispose() {
        if (this._ws) {
            this._ws.close();
            this._ws = null;
        }
        this._wsCallbacks.clear();
    }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const polygonAdapter = new PolygonAdapter();
export default polygonAdapter;
