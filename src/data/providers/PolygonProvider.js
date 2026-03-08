// ═══════════════════════════════════════════════════════════════════
// charEdge — Polygon.io Provider
//
// OHLCV fetching + WebSocket adapter for Polygon.io equities data.
// Free tier: 5 req/min, delayed 15min for equities.
//
// All requests routed through /api/proxy/polygon/ — the server-side
// proxy injects the API key from env vars, keeping it out of the
// client JS bundle.
// ═══════════════════════════════════════════════════════════════════

import { isCrypto } from '../../constants.js';
import { getApiKey, hasApiKey } from './ApiKeyStore.js';
import { logger } from '../../utils/logger';

// ─── Polygon.io REST Adapter ────────────────────────────────────

const PROXY_BASE = '/api/proxy/polygon';

export const POLYGON_TF_MAP = {
  '1m': { multiplier: 1, timespan: 'minute', limit: 390 },
  '5m': { multiplier: 5, timespan: 'minute', limit: 1000 },
  '15m': { multiplier: 15, timespan: 'minute', limit: 1000 },
  '30m': { multiplier: 30, timespan: 'minute', limit: 1000 },
  '1h': { multiplier: 1, timespan: 'hour', limit: 720 },
  '4h': { multiplier: 1, timespan: 'day', limit: 90 },
  '1D': { multiplier: 1, timespan: 'day', limit: 365 },
  '1w': { multiplier: 1, timespan: 'week', limit: 260 },
};

/**
 * Fetch OHLCV from Polygon.io Aggregates API (via server proxy).
 * Free tier: 5 req/min, delayed 15min for equities.
 * Task 2.10.1.2: Follows `next_url` cursor up to MAX_POLYGON_PAGES pages.
 *
 * @param {string} sym - Ticker symbol (e.g., 'AAPL')
 * @param {string} tfId - charEdge timeframe ID
 * @returns {Array|null} OHLCV array or null
 */

/** Max pages to follow via next_url cursor (5 req/min limit, 12s delay). */
const MAX_POLYGON_PAGES = 5;
const POLYGON_PAGE_DELAY_MS = 12_000; // 12s between pages to respect 5 req/min

export async function fetchPolygon(sym, tfId) {
  const tf = POLYGON_TF_MAP[tfId];
  if (!tf) return null;

  // Date range — Task 2.10.1.2: extended 15m from 60 → 365 days
  const to = new Date();
  const from = new Date();
  if (tfId === '1m') from.setDate(from.getDate() - 2);          // 1-minute: 2 days
  else if (tfId === '5m') from.setDate(from.getDate() - 30);     // 5-minute: 30 days
  else if (tfId === '15m') from.setDate(from.getDate() - 365);   // 15-minute: 1 year (was 60 days)
  else if (tfId === '30m') from.setDate(from.getDate() - 365);   // 30-minute: 1 year (was 120 days)
  else if (tfId === '1h') from.setDate(from.getDate() - 365);    // 1-hour: 1 year (was 6 months)
  else if (tfId === '4h') from.setFullYear(from.getFullYear() - 1); // 4-hour: 1 year
  else if (tfId === '1D') from.setFullYear(from.getFullYear() - 3); // Daily: 3 years
  else if (tfId === '1w') from.setFullYear(from.getFullYear() - 10); // Weekly: 10 years
  else from.setFullYear(from.getFullYear() - 3);                  // Fallback: 3 years

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  try {
    const firstUrl = `${PROXY_BASE}/v2/aggs/ticker/${encodeURIComponent(sym)}/range/${tf.multiplier}/${tf.timespan}/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=${tf.limit}`;

    let allResults = [];
    let nextUrl = firstUrl;

    // Paginate through cursor pages
    for (let page = 0; page < MAX_POLYGON_PAGES && nextUrl; page++) {
      if (page > 0) {
        // Rate limit: 12s delay between pages (5 req/min)
        await new Promise((r) => setTimeout(r, POLYGON_PAGE_DELAY_MS));
      }

      const res = await fetch(nextUrl);
      if (!res.ok) break;

      const json = await res.json();
      if (json.results?.length) {
        allResults = allResults.concat(json.results);
      }

      // Follow cursor if next_url exists — Polygon returns the full URL
      // but we need to route through our proxy
      if (json.next_url) {
        // Polygon next_url is absolute (e.g., https://api.polygon.io/v2/aggs/...)
        // Extract the path + query and route through our proxy
        try {
          const parsed = new URL(json.next_url);
          nextUrl = `${PROXY_BASE}${parsed.pathname}${parsed.search}`;
        } catch {
          nextUrl = null;
        }
      } else {
        nextUrl = null;
      }
    }

    if (!allResults.length) return null;

    // Deduplicate by timestamp (pages may overlap at boundaries)
    const seen = new Set();
    return allResults
      .filter((bar) => {
        if (seen.has(bar.t)) return false;
        seen.add(bar.t);
        return true;
      })
      .map((bar) => ({
        time: new Date(bar.t).toISOString(),
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v || 0,
        vwap: bar.vw || null,
        trades: bar.n || 0,
      }));
  } catch (err) {
    logger.data.warn(`[PolygonProvider] Polygon.io error for ${sym}:`, err.message);
    return null;
  }
}

// ─── Polygon WebSocket Adapter ──────────────────────────────────

/**
 * Create a Polygon.io WebSocket adapter for equities.
 * Polygon free tier provides 1 concurrent WS connection for delayed data.
 *
 * NOTE: This is a scaffold — Polygon WS requires auth handshake and
 * their streaming protocol differs from Binance. Implementation will
 * activate when a Polygon API key is set and connection is established.
 *
 * For now, equities fall back to polling (fetchOHLC on interval).
 */
export function createPolygonWSAdapter() {
  let _ws = null;
  let _status = 'disconnected';
  let _symbol = null;
  let _onCandle = null;
  let _onTick = null;
  let _onStatus = null;
  let _pollInterval = null;

  return {
    id: 'polygon-ws',

    isSupported(symbol) {
      return !isCrypto(symbol) && hasApiKey('polygon');
    },

    subscribe(symbol, tf, { onCandle, onTick, onStatus } = {}) {
      _symbol = symbol;
      _onCandle = onCandle;
      _onTick = onTick;
      _onStatus = onStatus;

      // Task 1B.8: Use lightweight snapshot endpoint instead of full OHLCV refetch.
      // Polygon snapshot returns only the latest price/candle data (~500B vs ~10KB).
      _status = 'connected';
      if (_onStatus) _onStatus(_status);

      _pollInterval = setInterval(async () => {
        try {
          // Lightweight snapshot endpoint — returns last trade + today's agg
          const snapshotUrl = `${PROXY_BASE}/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(symbol)}`;
          const res = await fetch(snapshotUrl);
          if (!res.ok) return;

          const json = await res.json();
          const ticker = json?.ticker;
          if (!ticker) return;

          // Extract last price from snapshot
          const lastTrade = ticker.lastTrade || ticker.last_trade;
          const todayAgg = ticker.day;

          if (_onTick && lastTrade) {
            _onTick({
              price: lastTrade.p || lastTrade.price,
              volume: lastTrade.s || lastTrade.size || 0,
              time: new Date(lastTrade.t || Date.now()).toISOString(),
            });
          }

          if (_onCandle && todayAgg) {
            _onCandle({
              time: new Date().toISOString(),
              open: todayAgg.o,
              high: todayAgg.h,
              low: todayAgg.l,
              close: todayAgg.c,
              volume: todayAgg.v || 0,
              isClosed: false,
            });
          }
        } catch (err) {
          logger.data.warn(`[PolygonProvider] Equity snapshot poll failed for ${symbol}:`, err.message);
        }
      }, 15000);
    },

    unsubscribe() {
      clearInterval(_pollInterval);
      _pollInterval = null;
      _status = 'disconnected';
      if (_onStatus) _onStatus(_status);
      _ws = null;
    },

    getStatus() {
      return _status;
    },
  };
}
