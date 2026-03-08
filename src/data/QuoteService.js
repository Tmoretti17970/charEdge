// ═══════════════════════════════════════════════════════════════════
// charEdge — QuoteService (1B.6 + N.11)
//
// Unified in-memory cache serving chart HUD, FundamentalService,
// and SparklineService. Prevents multi-source double-fetches.
//
// Cache: symbol → { price, high24h, low24h, change24h, volume24h,
//                   changePct, sparkline[], source, ts }
// TTL: 60s in-memory. Falls back to direct fetch on miss.
//
// Consumers:
//   SparklineService → QuoteService.getQuote() / .getSparkline()
//   FundamentalService → QuoteService.get24hStats()
//   WatchlistPanel → (via SparklineService functions)
// ═══════════════════════════════════════════════════════════════════

import { isCrypto } from '../constants.js';
import { toBinancePair } from './BinanceClient.js';
import { YahooAdapter } from './adapters/YahooAdapter.js';
import { apiMeter } from './engine/infra/ApiMeter.js';
import { logger } from '../utils/logger';

const CACHE_TTL = 60_000; // 60s TTL
const MAX_CACHE_SIZE = 200;

// symbol → { data, ts }
const _cache = new Map();

// In-flight dedup: symbol → Promise
const _inflight = new Map();

// ─── Cache Helpers ──────────────────────────────────────────────

function _isFresh(entry) {
    return entry && (Date.now() - entry.ts) < CACHE_TTL;
}

function _evictStale() {
    if (_cache.size <= MAX_CACHE_SIZE) return;
    const now = Date.now();
    for (const [key, entry] of _cache) {
        if (now - entry.ts > CACHE_TTL * 2) _cache.delete(key);
    }
}

// ─── Fetch Logic ────────────────────────────────────────────────

/**
 * Fetch fresh 24hr ticker data for a symbol.
 * Crypto: Binance 24hr ticker API.
 * Equities: Yahoo Finance 5m candles from today.
 * @private
 */
async function _fetchTicker(symbol) {
    const sym = symbol.toUpperCase();

    if (isCrypto(sym)) {
        return _fetchCryptoTicker(sym);
    }
    return _fetchEquityTicker(sym);
}

async function _fetchCryptoTicker(sym) {
    try {
        const pair = toBinancePair(sym);
        const base = typeof window === 'undefined'
            ? `http://localhost:${globalThis.__TF_PORT || 3000}`
            : '';
        const symbolsParam = encodeURIComponent(JSON.stringify([pair]));
        const url = `${base}/api/binance/v3/ticker/24hr?symbols=${symbolsParam}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        apiMeter.record('binance');

        const data = await res.json();
        const ticker = Array.isArray(data) ? data[0] : data;
        if (!ticker) return null;

        return {
            symbol: sym,
            price: parseFloat(ticker.lastPrice),
            high24h: parseFloat(ticker.highPrice),
            low24h: parseFloat(ticker.lowPrice),
            change24h: parseFloat(ticker.priceChange),
            changePct: parseFloat(ticker.priceChangePercent),
            volume24h: parseFloat(ticker.volume),
            source: 'binance',
            // raw ticker for backward compat with WatchlistPanel
            _raw: ticker,
        };
    } catch (e) {
        logger.data.warn('[QuoteService] Crypto ticker failed', e.message);
        return null;
    }
}

async function _fetchEquityTicker(sym) {
    try {
        const yahoo = new YahooAdapter();
        const candles = await yahoo.fetchOHLCV(sym, '5m', { range: '1d' });
        apiMeter.record('yahoo');
        if (!candles || candles.length < 2) return null;

        const first = candles[0];
        const last = candles[candles.length - 1];
        const priceChange = last.close - first.open;
        const priceChangePct = (priceChange / first.open) * 100;

        return {
            symbol: sym,
            price: last.close,
            high24h: Math.max(...candles.map(c => c.high)),
            low24h: Math.min(...candles.map(c => c.low)),
            change24h: priceChange,
            changePct: priceChangePct,
            volume24h: candles.reduce((s, c) => s + (c.volume || 0), 0),
            source: 'yahoo',
            // raw ticker shape for backward compat
            _raw: {
                symbol: sym,
                lastPrice: String(last.close),
                priceChange: String(priceChange.toFixed(4)),
                priceChangePercent: priceChangePct.toFixed(2),
                highPrice: String(Math.max(...candles.map(c => c.high))),
                lowPrice: String(Math.min(...candles.map(c => c.low))),
                volume: String(candles.reduce((s, c) => s + (c.volume || 0), 0)),
            },
        };
    } catch (e) {
        logger.data.warn('[QuoteService] Equity ticker failed', e.message);
        return null;
    }
}

/**
 * Fetch sparkline data (recent closes) for a symbol.
 * Crypto: Binance 24 × 1h klines.
 * Equities: Yahoo Finance 1d chart with 15m candles.
 * @private
 */
async function _fetchSparkline(symbol) {
    const sym = symbol.toUpperCase();

    if (!isCrypto(sym)) {
        try {
            const yahoo = new YahooAdapter();
            const candles = await yahoo.fetchOHLCV(sym, '15m', { range: '1d' });
            apiMeter.record('yahoo');
            if (candles && candles.length > 0) return candles.map(c => c.close);
        } catch (e) {
            logger.data.warn('[QuoteService] Equity sparkline failed', e.message);
        }
        return [];
    }

    // Crypto: Binance
    try {
        const pair = toBinancePair(sym);
        const base = typeof window === 'undefined'
            ? `http://localhost:${globalThis.__TF_PORT || 3000}`
            : '';
        const url = `${base}/api/binance/v3/klines?symbol=${pair}&interval=1h&limit=24`;
        const res = await fetch(url);
        if (!res.ok) return [];
        apiMeter.record('binance');
        const raw = await res.json();
        if (!Array.isArray(raw)) return [];
        return raw.map(k => parseFloat(k[4]));
    } catch (_) {
        return [];
    }
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Get quote data for a symbol, using cache if fresh.
 * Returns the full quote object or null if unavailable.
 *
 * @param {string} symbol
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<Object|null>}
 */
export async function getQuote(symbol) {
    const sym = (symbol || '').toUpperCase();
    if (!sym) return null;

    // Check cache
    const cached = _cache.get(sym);
    if (_isFresh(cached)) return cached.data;

    // Dedup in-flight
    if (_inflight.has(sym)) return _inflight.get(sym);

    const promise = (async () => {
        try {
            const [ticker, sparkline] = await Promise.all([
                _fetchTicker(sym),
                _fetchSparkline(sym),
            ]);

            if (!ticker) return null;

            const data = {
                ...ticker,
                sparkline: sparkline || [],
            };

            _cache.set(sym, { data, ts: Date.now() });
            _evictStale();
            return data;
        } catch (e) {
            logger.data.warn('[QuoteService] getQuote failed', e.message);
            // Return stale cache if available
            return cached?.data || null;
        } finally {
            _inflight.delete(sym);
        }
    })();

    _inflight.set(sym, promise);
    return promise;
}

/**
 * Get sparkline data (recent closes) for a symbol.
 * Uses cached data if available, otherwise fetches fresh.
 *
 * @param {string} symbol
 * @param {boolean} [isCryptoAsset]
 * @returns {Promise<number[]>}
 */
export async function getSparkline(symbol, isCryptoAsset) {
    const quote = await getQuote(symbol);
    if (quote?.sparkline?.length > 0) return quote.sparkline;

    // Fallback to direct fetch if quote failed but sparkline might work
    return _fetchSparkline((symbol || '').toUpperCase());
}

/**
 * Get 24hr stats from cache (for FundamentalService dedup).
 * Returns { high24h, low24h, change24h, changePct } or null.
 *
 * @param {string} symbol
 * @returns {Promise<Object|null>}
 */
export async function get24hStats(symbol) {
    const quote = await getQuote(symbol);
    if (!quote) return null;
    return {
        high24h: quote.high24h,
        low24h: quote.low24h,
        priceChange24h: quote.changePct,
        volume24h: quote.volume24h,
    };
}

/**
 * Invalidate cache for a symbol (e.g., on symbol switch).
 * @param {string} symbol
 */
export function invalidate(symbol) {
    _cache.delete((symbol || '').toUpperCase());
}

/**
 * Clear all cached quotes.
 */
export function clearQuoteCache() {
    _cache.clear();
    _inflight.clear();
}

/**
 * Get cache stats for dev-mode metering.
 * @returns {{ size: number, symbols: string[] }}
 */
export function getQuoteCacheStats() {
    return {
        size: _cache.size,
        symbols: Array.from(_cache.keys()),
    };
}

// ─── Default Export ─────────────────────────────────────────────

export default {
    getQuote,
    getSparkline,
    get24hStats,
    invalidate,
    clearQuoteCache,
    getQuoteCacheStats,
};
