// ═══════════════════════════════════════════════════════════════════
// charEdge — Alpaca Markets Provider
//
// OHLCV fetching for Alpaca Markets (US equities).
// Free tier: 200 req/min. Real-time data (no 15-min delay).
//
// All requests routed through /api/proxy/alpaca/ — the server-side
// proxy injects the ALPACA_KEY_ID + ALPACA_SECRET from env vars as
// auth headers, keeping them out of the client JS bundle.
//
// This is the TOP-PRIORITY equity provider because:
//   - 200 req/min (40x more than Polygon free)
//   - Real-time data (no 15-minute delay)
//   - Excellent intraday coverage
// ═══════════════════════════════════════════════════════════════════

import { logger } from '../../utils/logger';

const PROXY_BASE = '/api/proxy/alpaca';

// ─── Timeframe Mapping ──────────────────────────────────────────

export const ALPACA_TF_MAP = {
  '1m':  { timeframe: '1Min',   limit: 1000 },
  '5m':  { timeframe: '5Min',   limit: 1000 },
  '15m': { timeframe: '15Min',  limit: 1000 },
  '30m': { timeframe: '30Min',  limit: 1000 },
  '1h':  { timeframe: '1Hour',  limit: 1000 },
  '4h':  { timeframe: '4Hour',  limit: 1000 },
  '1D':  { timeframe: '1Day',   limit: 1000 },
  '1w':  { timeframe: '1Week',  limit: 1000 },
};

/**
 * Fetch OHLCV bars from Alpaca Markets (via server proxy).
 * Free tier: 200 req/min, real-time US equities.
 *
 * @param {string} sym - Ticker symbol (e.g., 'AAPL')
 * @param {string} tfId - charEdge timeframe ID
 * @returns {Array|null} OHLCV array or null
 */
export async function fetchAlpaca(sym, tfId) {
  const tf = ALPACA_TF_MAP[tfId];
  if (!tf) return null;

  // Skip crypto symbols — Alpaca is for US equities
  const upper = (sym || '').toUpperCase();
  if (upper.endsWith('USDT') || upper.endsWith('BUSD') || upper.endsWith('USD') || upper.includes('/')) {
    return null;
  }

  // Date range
  const end = new Date();
  const start = new Date();
  if (tfId === '1m') start.setDate(start.getDate() - 2);
  else if (tfId === '5m') start.setDate(start.getDate() - 30);
  else if (tfId === '15m') start.setDate(start.getDate() - 60);
  else if (tfId === '30m') start.setDate(start.getDate() - 120);
  else if (tfId === '1h') start.setDate(start.getDate() - 365);
  else if (tfId === '4h') start.setFullYear(start.getFullYear() - 1);
  else if (tfId === '1D') start.setFullYear(start.getFullYear() - 3);
  else if (tfId === '1w') start.setFullYear(start.getFullYear() - 10);
  else start.setFullYear(start.getFullYear() - 3);

  try {
    const params = new URLSearchParams({
      timeframe: tf.timeframe,
      start: start.toISOString(),
      end: end.toISOString(),
      limit: String(tf.limit),
      adjustment: 'all',
      feed: 'iex',   // IEX feed is free tier
      sort: 'asc',
    });

    const url = `${PROXY_BASE}/v2/stocks/${encodeURIComponent(upper)}/bars?${params}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = await res.json();
    const bars = json.bars;
    if (!bars?.length) return null;

    return bars.map((bar) => ({
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
    logger.data.warn(`[AlpacaProvider] Alpaca error for ${sym}:`, err.message);
    return null;
  }
}
