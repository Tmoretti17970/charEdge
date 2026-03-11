// ═══════════════════════════════════════════════════════════════════
// charEdge — Tiingo Adapter
//
// Equity/ETF data provider via Tiingo REST API.
// Free tier: 50 req/hr, 1000 req/day, 500 unique symbols/month.
//
// All requests routed through /api/proxy/tiingo/ — the server-side
// proxy injects the TIINGO_API_TOKEN from env vars, keeping it
// out of the client JS bundle.
//
// Provides:
//   - OHLCV historical data (end-of-day)
//   - Real-time quotes (IEX)
//
// Usage:
//   import { tiingoAdapter } from './TiingoAdapter.js';
//   const data = await tiingoAdapter.fetchOHLCV('AAPL', '1D');
// ═══════════════════════════════════════════════════════════════════

import { BaseAdapter } from './BaseAdapter.js';
import { logger } from '@/observability/logger';

const PROXY_BASE = '/api/proxy/tiingo';

const CACHE = new Map();
const CACHE_TTL = 60000; // 1 min for quotes
const LONG_CACHE_TTL = 3600000; // 1 hour for historical

// ─── Timeframe → Tiingo resampleFreq mapping ───────────────────
const TF_MAP = {
    '1D': 'daily',
    '1d': 'daily',
    '1w': 'weekly',
    '1W': 'weekly',
    '1M': 'monthly',
};

class TiingoAdapter extends BaseAdapter {
    constructor() {
        super('tiingo');
    }

    // API key managed server-side — always "configured"
    get isConfigured() { return true; }

    // Legacy no-op — key is server-side now
    setApiKey(_key) { /* no-op: API key managed server-side */ }

    // ─── OHLCV ───────────────────────────────────────────────────

    async fetchOHLCV(symbol, interval = '1D', opts = {}) {
        const resampleFreq = TF_MAP[interval];
        // Tiingo only supports daily/weekly/monthly — skip intraday
        if (!resampleFreq) return [];

        const params = { resampleFreq };
        if (opts.from) params.startDate = opts.from;
        if (opts.to) params.endDate = opts.to;

        const cacheKey = `ohlcv-${symbol}-${interval}`;
        const cached = CACHE.get(cacheKey);
        if (cached && Date.now() < cached.expiry) return cached.data;

        const data = await this._request(`tiingo/daily/${symbol}/prices`, params);
        if (!Array.isArray(data) || data.length === 0) return [];

        const bars = data.map(bar => {
            const timeMs = new Date(bar.date).getTime();
            return {
                time: timeMs,
                _openMs: timeMs,
                open: bar.adjOpen ?? bar.open,
                high: bar.adjHigh ?? bar.high,
                low: bar.adjLow ?? bar.low,
                close: bar.adjClose ?? bar.close,
                volume: bar.adjVolume ?? bar.volume ?? 0,
            };
        }).sort((a, b) => a.time - b.time);

        CACHE.set(cacheKey, { data: bars, expiry: Date.now() + LONG_CACHE_TTL });
        return bars;
    }

    // ─── Quote (IEX) ─────────────────────────────────────────────

    async fetchQuote(symbol) {
        const cacheKey = `quote-${symbol}`;
        const cached = CACHE.get(cacheKey);
        if (cached && Date.now() < cached.expiry) return cached.data;

        const data = await this._request(`iex/${symbol}`);
        if (!Array.isArray(data) || !data[0]) return null;

        const q = data[0];
        const result = {
            price: q.last ?? q.tngoLast ?? 0,
            change: (q.last ?? 0) - (q.prevClose ?? 0),
            changePct: q.prevClose ? (((q.last ?? 0) - q.prevClose) / q.prevClose) * 100 : 0,
            volume: q.volume ?? 0,
            high: q.high ?? 0,
            low: q.low ?? 0,
            open: q.open ?? 0,
            prevClose: q.prevClose ?? 0,
            timestamp: q.timestamp,
        };

        CACHE.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL });
        return result;
    }

    // ─── Symbol support ──────────────────────────────────────────

    supports(symbol) {
        const upper = (symbol || '').toUpperCase();
        // US equities & ETFs: 1-5 uppercase letters
        return /^[A-Z]{1,5}$/.test(upper);
    }

    latencyTier() {
        return 'fast'; // IEX real-time for quotes, EOD for historical
    }

    // ─── Private ─────────────────────────────────────────────────

    async _request(endpoint, params = {}) {
        const url = new URL(`${PROXY_BASE}/${endpoint}`, window.location.origin);
        for (const [k, v] of Object.entries(params)) {
            url.searchParams.set(k, String(v));
        }

        try {
            const resp = await fetch(url.toString());
            if (!resp.ok) return null;
            return await resp.json();
        } catch (err) {
            logger.data.warn(`[TiingoAdapter] Request failed:`, err.message);
            return null;
        }
    }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const tiingoAdapter = new TiingoAdapter();
export { TiingoAdapter };
export default tiingoAdapter;
