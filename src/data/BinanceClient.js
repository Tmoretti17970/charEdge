// ═══════════════════════════════════════════════════════════════════
// charEdge — BinanceClient
//
// Binance REST kline fetching with backward pagination for deeper
// history on longer timeframes. Extracted from FetchService.js.
// ═══════════════════════════════════════════════════════════════════

/** Map charEdge timeframe IDs to Binance interval strings. */
export const BINANCE_INTERVALS = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '4h': '4h',
  '1D': '1d',
  '1w': '1w',
};

/** Initial bar count per timeframe. 500 bars for deeper first paint. */
const INITIAL_LOAD_LIMIT = 500;

export const BINANCE_LIMITS = {
  '1m': INITIAL_LOAD_LIMIT,
  '5m': INITIAL_LOAD_LIMIT,
  '15m': INITIAL_LOAD_LIMIT,
  '30m': INITIAL_LOAD_LIMIT,
  '1h': INITIAL_LOAD_LIMIT,
  '4h': 1000,
  '1D': 1000,
  '1w': 1000,
};

/** Max pages for backward pagination on longer timeframes. */
const BINANCE_PAGINATE_PAGES = {
  '1D': 5,   // 5 x 1000 = 5000 daily bars (~14 years)
  '1w': 4,   // 4 x 1000 = 4000 weekly bars (~77 years — Binance will return what it has)
  '4h': 3,   // 3 x 1000 = 3000 4h bars (~500 days)
  '1h': 2,   // 2 x 1000 = 2000 1h bars (~83 days)
};

/**
 * Resolve a symbol to a Binance trading pair.
 * Dynamically handles any USDT pair instead of hardcoding a whitelist.
 */
export function toBinancePair(sym) {
  const upper = (sym || '').toUpperCase();
  if (upper.endsWith('USDT') || upper.endsWith('BUSD') || upper.endsWith('USDC')) return upper;
  if (upper.endsWith('USD')) return upper.replace(/USD$/, 'USDT');
  return upper + 'USDT';
}

/**
 * Fetch a single batch of Binance klines.
 * @param {string} pair   - e.g. 'BTCUSDT'
 * @param {string} interval - e.g. '1d', '5m'
 * @param {number} limit
 * @param {number} [endTime] - optional endTime (ms) for pagination
 * @param {number} [startTime] - optional startTime (ms) for delta fetch
 * @returns {Promise<Array|null>}
 */
export async function fetchBinanceBatch(pair, interval, limit, endTime, startTime) {
  try {
    const base = typeof window === 'undefined' ? `http://localhost:${globalThis.__TF_PORT || 3000}` : '';
    let url = `${base}/api/binance/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;
    if (endTime) url += `&endTime=${endTime}`;
    if (startTime) url += `&startTime=${startTime}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10) * 1000;
        const err = new Error('Rate limited');
        err.status = 429;
        err.retryAfterMs = retryAfter;
        throw err;
      }
      return null;
    }
    const raw = await res.json();
    if (!Array.isArray(raw) || raw.length < 2) return null;
    return raw.map((k) => ({
      time: new Date(k[0]).toISOString(),
      _openMs: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));
  } catch (_) {
    return null;
  }
}

/**
 * Binance REST klines with backward pagination.
 * For longer timeframes, paginates backwards to fetch deeper history.
 */
export async function fetchBinance(sym, tfId, startTime) {
  const pair = toBinancePair(sym);
  const interval = BINANCE_INTERVALS[tfId];
  if (!interval) return null;
  const limit = BINANCE_LIMITS[tfId] || 200;

  const maxPages = BINANCE_PAGINATE_PAGES[tfId] || 1;
  if (maxPages <= 1) {
    const batch = await fetchBinanceBatch(pair, interval, limit, undefined, startTime);
    if (!batch) return null;
    return batch.map(({ _openMs, ...rest }) => rest);
  }

  const pages = [];
  let endTime = undefined;
  for (let page = 0; page < maxPages; page++) {
    const batch = await fetchBinanceBatch(pair, interval, 1000, endTime);
    if (!batch || batch.length === 0) break;
    pages.push(batch);
    endTime = batch[0]._openMs - 1;
    if (batch.length < 1000) break;
  }
  pages.reverse();
  const allBars = pages.flat();

  if (allBars.length < 2) return null;

  const seen = new Set();
  return allBars
    .filter((b) => { if (seen.has(b.time)) return false; seen.add(b.time); return true; })
    .map(({ _openMs, ...rest }) => rest);
}
