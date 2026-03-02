// ═══════════════════════════════════════════════════════════════════
// charEdge — Polygon.io Provider
//
// OHLCV fetching + WebSocket adapter for Polygon.io equities data.
// Free tier: 5 req/min, delayed 15min for equities.
// ═══════════════════════════════════════════════════════════════════

import { isCrypto } from '../../constants.js';
import { getApiKey, hasApiKey } from './ApiKeyStore.js';

// ─── Polygon.io REST Adapter ────────────────────────────────────

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
 * Fetch OHLCV from Polygon.io Aggregates API.
 * Free tier: 5 req/min, delayed 15min for equities.
 *
 * @param {string} sym - Ticker symbol (e.g., 'AAPL')
 * @param {string} tfId - charEdge timeframe ID
 * @returns {Array|null} OHLCV array or null
 */
export async function fetchPolygon(sym, tfId) {
  const key = getApiKey('polygon');
  if (!key) return null;

  const tf = POLYGON_TF_MAP[tfId];
  if (!tf) return null;

  // Date range
  const to = new Date();
  const from = new Date();
  // Date range based on timeframe — use TFS IDs (uppercase 1D, not 1d)
  if (tfId === '1m') from.setDate(from.getDate() - 2);        // 1-minute: 2 days
  else if (tfId === '5m') from.setDate(from.getDate() - 10);   // 5-minute: 10 days
  else if (tfId === '15m') from.setDate(from.getDate() - 30);  // 15-minute: 30 days
  else if (tfId === '30m') from.setDate(from.getDate() - 60);  // 30-minute: 60 days
  else if (tfId === '1h') from.setDate(from.getDate() - 90);   // 1-hour: 90 days
  else if (tfId === '4h') from.setDate(from.getDate() - 180);  // 4-hour: 180 days
  else if (tfId === '1D') from.setFullYear(from.getFullYear() - 1); // Daily: 1 year
  else if (tfId === '1w') from.setFullYear(from.getFullYear() - 5); // Weekly: 5 years
  else from.setFullYear(from.getFullYear() - 1);               // Fallback: 1 year

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  try {
    const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(sym)}/range/${tf.multiplier}/${tf.timespan}/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=${tf.limit}&apiKey=${key}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = await res.json();
    if (!json.results?.length) return null;

    return json.results.map((bar) => ({
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
    console.warn(`[PolygonProvider] Polygon.io error for ${sym}:`, err.message);
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

      // For now, use polling as WS adapter scaffold
      // Poll every 15s for delayed equity data
      _status = 'connected';
      if (_onStatus) _onStatus(_status);

      _pollInterval = setInterval(async () => {
        try {
          const result = await fetchPolygon(symbol, tf);
          if (result?.length && _onCandle) {
            const last = result[result.length - 1];
            _onCandle({
              time: last.time,
              open: last.open,
              high: last.high,
              low: last.low,
              close: last.close,
              volume: last.volume,
              isClosed: false,
            });
          }
        } catch (err) {
          console.warn(`[PolygonProvider] Equity poll failed for ${symbol}:`, err.message);
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
