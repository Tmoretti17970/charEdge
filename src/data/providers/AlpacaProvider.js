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

// ─── Availability Gate ──────────────────────────────────────────
// Probes the proxy once per session. If the API key isn't configured
// the proxy returns 503 — we cache that and skip all future requests
// to avoid spamming red 503 errors in the browser console.
let _available = null; // null = untested, true/false = cached result

async function isAvailable() {
  if (_available !== null) return _available;
  try {
    // Lightweight probe — fetches a tiny date range for a common symbol
    const res = await fetch(`${PROXY_BASE}/v2/stocks/AAPL/bars?timeframe=1Day&limit=1`);
    _available = res.ok || res.status === 422; // 422 = key works but bad params
    if (!_available) {
      logger.data.info('[AlpacaProvider] API key not configured — provider disabled for this session');
    }
  } catch {
    _available = false;
  }
  return _available;
}

// ─── Timeframe Mapping ──────────────────────────────────────────

export const ALPACA_TF_MAP = {
  '1m': { timeframe: '1Min', limit: 1000 },
  '5m': { timeframe: '5Min', limit: 1000 },
  '15m': { timeframe: '15Min', limit: 1000 },
  '30m': { timeframe: '30Min', limit: 1000 },
  '1h': { timeframe: '1Hour', limit: 1000 },
  '4h': { timeframe: '4Hour', limit: 1000 },
  '1D': { timeframe: '1Day', limit: 1000 },
  '1w': { timeframe: '1Week', limit: 1000 },
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

  // Gate: don't attempt if key isn't configured
  if (!(await isAvailable())) return null;

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
