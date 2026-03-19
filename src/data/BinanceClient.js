// ═══════════════════════════════════════════════════════════════════
// charEdge — BinanceClient
//
// Binance REST kline fetching with backward pagination for deeper
// history on longer timeframes. Extracted from FetchService.js.
// ═══════════════════════════════════════════════════════════════════

/** Negative cache: symbols that returned 400 (invalid pair). TTL = 5 min. */
const _badSymbolCache = new Map();
/** In-flight requests for pairs — prevents duplicate concurrent fetches */
const _pendingPairs = new Set();
const BAD_SYMBOL_TTL = 5 * 60 * 1000;

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

/** Max pages for backward pagination — enables deep scroll-back history. */
const BINANCE_PAGINATE_PAGES = {
  '1D': 5,   // 5 × 1000 = 5,000 daily bars (~14 years)
  '1w': 4,   // 4 × 1000 = 4,000 weekly bars (~77 years)
  '4h': 3,   // 3 × 1000 = 3,000 4h bars (~500 days)
  '1h': 2,   // 2 × 1000 = 2,000 1h bars (~83 days)
  '15m': 6,  // 6 × 500 = 3,000 bars (~32 days) — Task 2.10.1.1
  '30m': 4,  // 4 × 500 = 2,000 bars (~42 days) — Task 2.10.1.1
  '5m': 3,   // 3 × 500 = 1,500 bars (~5 days) — Task 2.10.1.1
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
  // Skip known-bad symbols (400 cache)
  const cacheKey = pair;
  const cached = _badSymbolCache.get(cacheKey);
  if (cached && Date.now() - cached < BAD_SYMBOL_TTL) return null;

  // Prevent concurrent duplicate requests for the same pair
  const inflightKey = `${pair}:${interval}:${endTime || ''}`;
  if (_pendingPairs.has(inflightKey)) return null;
  _pendingPairs.add(inflightKey);

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
      // Cache 400 responses — symbol is invalid on Binance
      if (res.status === 400) {
        _badSymbolCache.set(cacheKey, Date.now());
      }
      return null;
    }
    const raw = await res.json();
    if (!Array.isArray(raw) || raw.length < 2) return null;
    return raw.map((k) => ({
      time: k[0],
      _openMs: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));
  // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (_) {
    return null;
  } finally {
    _pendingPairs.delete(inflightKey);
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
  const pageSize = limit >= 1000 ? 1000 : limit; // Sub-hourly uses 500, longer TFs use 1000
  for (let page = 0; page < maxPages; page++) {
    const batch = await fetchBinanceBatch(pair, interval, pageSize, endTime);
    if (!batch || batch.length === 0) break;
    pages.push(batch);
    endTime = batch[0]._openMs - 1;
    if (batch.length < pageSize) break;
  }
  pages.reverse();
  const allBars = pages.flat();

  if (allBars.length < 2) return null;

  const seen = new Set();
  return allBars
    .filter((b) => { if (seen.has(b.time)) return false; seen.add(b.time); return true; })
    .map(({ _openMs, ...rest }) => rest);
}
