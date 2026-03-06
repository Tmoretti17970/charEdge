// ═══════════════════════════════════════════════════════════════════
// charEdge — Alpha Vantage Provider
//
// OHLCV fetching for Alpha Vantage.
// Free tier: 25 req/day. Generous intraday data.
//
// All requests routed through /api/proxy/alphavantage/ — the
// server-side proxy injects the API key from env vars, keeping it
// out of the client JS bundle.
// ═══════════════════════════════════════════════════════════════════

import { logger } from '../../utils/logger';

const PROXY_BASE = '/api/proxy/alphavantage';

// ─── Alpha Vantage Timeframe Config ─────────────────────────────

export const AV_FUNCTIONS = {
  '1m': { fn: 'TIME_SERIES_INTRADAY', interval: '1min' },
  '5m': { fn: 'TIME_SERIES_INTRADAY', interval: '5min' },
  '15m': { fn: 'TIME_SERIES_INTRADAY', interval: '15min' },
  '30m': { fn: 'TIME_SERIES_INTRADAY', interval: '30min' },
  '1h': { fn: 'TIME_SERIES_INTRADAY', interval: '60min' },
  '4h': { fn: 'TIME_SERIES_DAILY', interval: null },
  '1D': { fn: 'TIME_SERIES_DAILY', interval: null },
  '1w': { fn: 'TIME_SERIES_WEEKLY', interval: null },
};

/**
 * Fetch from Alpha Vantage (via server proxy).
 * Free tier: 25 req/day. Generous intraday data.
 *
 * @param {string} sym - Ticker symbol
 * @param {string} tfId - charEdge timeframe ID
 * @returns {Array|null} OHLCV array or null
 */
export async function fetchAlphaVantage(sym, tfId) {
  const cfg = AV_FUNCTIONS[tfId];
  if (!cfg) return null;

  try {
    let url = `${PROXY_BASE}/query?function=${cfg.fn}&symbol=${encodeURIComponent(sym)}&outputsize=compact`;
    if (cfg.interval) url += `&interval=${cfg.interval}`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const json = await res.json();

    // Alpha Vantage returns different keys per function
    const seriesKey = Object.keys(json).find((k) => k.startsWith('Time Series'));
    if (!seriesKey || !json[seriesKey]) return null;

    const series = json[seriesKey];
    const entries = Object.entries(series).reverse(); // oldest first

    return entries.map(([dateStr, bar]) => ({
      time: new Date(dateStr.includes(':') ? dateStr : dateStr + 'T00:00:00').toISOString(),
      open: parseFloat(bar['1. open']),
      high: parseFloat(bar['2. high']),
      low: parseFloat(bar['3. low']),
      close: parseFloat(bar['4. close']),
      volume: parseInt(bar['5. volume'] || bar['6. volume'] || '0', 10),
    }));
  } catch (err) {
    logger.data.warn(`[AlphaVantageProvider] Error for ${sym}:`, err.message);
    return null;
  }
}
