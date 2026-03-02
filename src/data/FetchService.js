// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — FetchService
// Extracted from v9.3 monolith. Improvements:
//   - Token bucket rate limiter (10 req/min for CoinGecko)
//   - Tiered TTL per timeframe
//   - Stale-while-revalidate (shared utility from swr.js)
//   - Deduplication of in-flight requests
//   - 4-tier cache (memory → IndexedDB → OPFS → network)
//   - Circuit breaker for adapter resilience
//   - Data validation & sanitization pipeline
//   - Yahoo Finance free equity fallback (no key required)
//   - Binance backward pagination for deeper history
// ═══════════════════════════════════════════════════════════════════

import { TFS, isCrypto, buildCacheKey } from '../constants.js';
import { opfsBarStore } from './engine/infra/OPFSBarStore.js';
import { withCircuitBreaker } from './engine/infra/AdapterCircuitBreaker.js';
import { validateCandleArray } from './engine/infra/DataValidator.js';
import { volatilityTTL } from './engine/infra/VolatilityTTL.js';
import { cacheManager } from './engine/infra/CacheManager.js';
import { staleWhileRevalidate } from './engine/swr.js';
import { CoinGeckoAdapter } from './adapters/CoinGeckoAdapter.js';
import { CryptoCompareAdapter } from './adapters/CryptoCompareAdapter.js';
import { YahooAdapter } from './adapters/YahooAdapter.js';
import { pipelineLogger } from './engine/infra/DataPipelineLogger.js';

// ─── Singleton adapter instances (avoid re-instantiation per fetch) ──
const _coinGeckoAdapter = new CoinGeckoAdapter();
const _cryptoCompareAdapter = new CryptoCompareAdapter();
const _yahooAdapter = new YahooAdapter();

const TTL = {
  '1m': 15000,    // 1-minute candles — refresh fast
  '5m': 15000,
  '15m': 30000,
  '30m': 30000,
  '1h': 60000,
  '4h': 300000,
  '1D': 1800000,
  '1w': 1800000,
};

// ─── Cache (delegated to CacheManager) ─────────────────────────
const _inflight = new Map();
let _lastWarning = null; // Set by fetchers when they fail



// ─── API Fetchers ───────────────────────────────────────────────

// C2.2: Binance interval + limit mapping
const BINANCE_INTERVALS = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '4h': '4h',
  '1D': '1d',
  '1w': '1w',
};
const BINANCE_LIMITS = {
  '1m': 1000,   // ~16 hours of 1-min candles
  '5m': 1000,   // ~3.5 days of 5-min candles
  '15m': 1000,  // ~10 days of 15-min candles
  '30m': 1000,  // ~20 days of 30-min candles
  '1h': 1000,   // ~41 days of 1-hour candles
  '4h': 1000,   // ~166 days of 4-hour candles
  '1D': 1000,   // ~2.7 years of daily candles
  '1w': 1000,   // ~19 years of weekly candles
};

/**
 * Resolve a symbol to a Binance trading pair.
 * Dynamically handles any USDT pair instead of hardcoding a whitelist.
 * @param {string} sym - Raw symbol (e.g. 'BTC', 'BTCUSDT', 'ETHUSDT')
 * @returns {string} Binance pair (e.g. 'BTCUSDT')
 */
function toBinancePair(sym) {
  const upper = (sym || '').toUpperCase();
  if (upper.endsWith('USDT') || upper.endsWith('BUSD') || upper.endsWith('USDC')) return upper;
  if (upper.endsWith('USD')) return upper.replace(/USD$/, 'USDT');
  return upper + 'USDT';
}

// Max pages for backward pagination on longer timeframes.
const BINANCE_PAGINATE_PAGES = {
  '1D': 3,   // 3 × 1000 = 3000 daily candles ≈ 8+ years
  '1w': 2,   // 2 × 1000 = 2000 weekly candles ≈ 38 years
  '4h': 2,   // 2 × 1000 = 2000 4h candles ≈ 11 months
  '1h': 2,   // 2 × 1000 = 2000 1h candles ≈ 83 days
};

/**
 * Fetch a single batch of Binance klines.
 * @param {string} pair   - e.g. 'BTCUSDT'
 * @param {string} interval - e.g. '1d', '5m'
 * @param {number} limit
 * @param {number} [endTime] - optional endTime (ms) for pagination
 * @returns {Promise<Array|null>}
 */
async function _fetchBinanceBatch(pair, interval, limit, endTime, startTime) {
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
    // Binance klines: [openTime, open, high, low, close, volume, closeTime, ...]
    return raw.map((k) => ({
      time: new Date(k[0]).toISOString(),
      _openMs: k[0], // kept for pagination cursor; stripped before return
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));
  } catch {
    return null;
  }
}

/**
 * C2.2: Binance REST klines with backward pagination.
 * For longer timeframes (3m, 6m, 1y), paginates backwards to fetch
 * deeper history (up to 5 pages × 1000 candles = 5000 candles).
 * @see https://binance-docs.github.io/apidocs/spot/en/#kline-candlestick-data
 */
async function fetchBinance(sym, tfId, startTime) {
  const pair = toBinancePair(sym);
  const interval = BINANCE_INTERVALS[tfId];
  if (!interval) return null;
  const limit = BINANCE_LIMITS[tfId] || 200;

  // Single-batch fetch for short timeframes (1d, 5d, 1m)
  const maxPages = BINANCE_PAGINATE_PAGES[tfId] || 1;
  if (maxPages <= 1) {
    const batch = await _fetchBinanceBatch(pair, interval, limit, undefined, startTime);
    if (!batch) return null;
    return batch.map(({ _openMs, ...rest }) => rest);
  }

  // Multi-page backward pagination for deeper history
  const pages = [];
  let endTime = undefined;
  for (let page = 0; page < maxPages; page++) {
    const batch = await _fetchBinanceBatch(pair, interval, 1000, endTime);
    if (!batch || batch.length === 0) break;
    pages.push(batch);
    // Next page ends just before the oldest candle of this batch
    endTime = batch[0]._openMs - 1;
    // If we got fewer than 1000, there's no more history
    if (batch.length < 1000) break;
  }
  // Merge pages oldest-first (reverse order, then flatten) — avoids O(n²) spreading
  pages.reverse();
  const allBars = pages.flat();

  if (allBars.length < 2) return null;

  // Deduplicate by timestamp and strip internal _openMs field
  const seen = new Set();
  return allBars
    .filter((b) => { if (seen.has(b.time)) return false; seen.add(b.time); return true; })
    .map(({ _openMs, ...rest }) => rest);
}

/**
 * C2.3: Binance REST Symbol Search
 * Fetches exchange info to provide symbol autocomplete.
 * Ideally this would hit a dedicated search endpoint, but Binance spot
 * only provides the full exchangeInfo payload. We cache it in memory.
 */
let _exchangeInfoCache = null;

async function fetchSymbolSearch(query) {
  if (!query || query.trim() === '') return [];
  const q = query.toUpperCase().trim();

  // ─── 1. Search the local SymbolRegistry first (instant, no network) ───
  // This includes Pyth-powered equities, FX, commodities, and all crypto
  let registryResults = [];
  try {
    // Dynamic import to avoid circular dependency
    const { SymbolRegistry } = await import('./SymbolRegistry.js');
    registryResults = SymbolRegistry.search(q, 10).map((info) => ({
      name: info.symbol,
      pair: info.symbol,
      description: info.displayName || info.symbol,
      exchange: info.exchange || info.provider || '',
      assetClass: info.assetClass || 'stock',
      provider: info.provider || 'yahoo',
    }));
  } catch {
    /* SymbolRegistry not available */
  }

  // ─── 2. Search Binance exchange info (for crypto not in registry) ───
  let binanceResults = [];
  try {
    if (!_exchangeInfoCache) {
      const base = typeof window === 'undefined' ? `http://localhost:${globalThis.__TF_PORT || 3000}` : '';
      const url = `${base}/api/binance/v3/exchangeInfo`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data && data.symbols) {
          _exchangeInfoCache = data.symbols
            .filter((s) => s.status === 'TRADING')
            .filter(
              (s) =>
                s.quoteAsset === 'USDT' || s.quoteAsset === 'BUSD' || s.quoteAsset === 'USDC' || s.quoteAsset === 'BTC',
            )
            .map((s) => ({
              name: s.baseAsset,
              pair: s.symbol,
              description: `${s.baseAsset} / ${s.quoteAsset}`,
              exchange: 'Binance',
            }));

          const unique = [];
          const seen = new Set();
          for (const s of _exchangeInfoCache) {
            if (!seen.has(s.name)) {
              seen.add(s.name);
              unique.push(s);
            }
          }
          _exchangeInfoCache = unique;
        }
      }
    }

    if (_exchangeInfoCache) {
      const exact = [];
      const startsWith = [];
      const contains = [];

      for (const s of _exchangeInfoCache) {
        if (s.name === q) exact.push(s);
        else if (s.name.startsWith(q)) startsWith.push(s);
        else if (s.name.includes(q)) contains.push(s);
        if (exact.length + startsWith.length + contains.length >= 10) break;
      }
      binanceResults = [...exact, ...startsWith, ...contains];
    }
  } catch (err) {
    console.warn('Binance symbol search failed:', err.message);
  }

  // ─── 3. Merge: registry first, then Binance (deduplicated) ───
  const seen = new Set(registryResults.map((r) => r.name));
  const merged = [...registryResults];
  for (const r of binanceResults) {
    if (!seen.has(r.name)) {
      seen.add(r.name);
      merged.push(r);
    }
  }

  return merged.slice(0, 15);
}

// ─── Main Fetch Function ────────────────────────────────────────
// Unified cache: CacheManager handles memory → IDB → OPFS
async function fetchOHLC(sym, tfId) {
  const tf = TFS.find((t) => t.id === tfId) || TFS[3];
  const key = buildCacheKey(sym, tfId);
  const baseTTL = TTL[tfId] || 60000;
  const ttl = volatilityTTL.getTTL(sym, tfId, baseTTL);

  // Unified 3-tier cache read (memory → IDB → OPFS)
  const cached = await cacheManager.read(sym, tfId, ttl);
  // SWR: fresh → return; stale → return + bg refresh; miss → null
  const swrResult = staleWhileRevalidate(cached, () => _bgRefresh(sym, tfId, tf, key));
  if (swrResult) {
    pipelineLogger.debug('FetchService', `SWR return (${swrResult.source}): ${key}`);
    return swrResult;
  }

  // Dedup in-flight requests (prevents cache stampede)
  if (_inflight.has(key)) return _inflight.get(key);

  // Network fetch
  const promise = _doFetch(sym, tfId, tf, key);
  _inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    _inflight.delete(key);
  }
}

async function _doFetch(sym, tfId, tf, key) {
  let data = null,
    source = 'no_data';
  _lastWarning = null;

  // ── Step 1: Crypto → Binance REST (with circuit breaker) ──────
  if (isCrypto(sym)) {
    // Delta-only: check last cached candle time to avoid re-fetching everything
    let deltaStartTime;
    try {
      const lastTime = await opfsBarStore.getLastCandleTime(sym, tfId);
      if (lastTime) {
        deltaStartTime = (typeof lastTime === 'string' ? new Date(lastTime).getTime() : lastTime) + 1;
      }
    } catch { /* OPFS unavailable — full fetch */ }
    data = await withCircuitBreaker('binance', () => fetchBinance(sym, tfId, deltaStartTime));
    // If delta fetch returned data, merge with CacheManager's last read (avoids double OPFS read)
    if (data && deltaStartTime) {
      try {
        const cachedResult = await cacheManager.read(sym, tfId, Infinity); // any cached version
        const cachedBars = cachedResult?.data;
        if (cachedBars && cachedBars.length > 0) {
          const lastCachedTime = cachedBars[cachedBars.length - 1].time;
          const newBars = data.filter(b => b.time > lastCachedTime);
          if (newBars.length > 0) {
            data = [...cachedBars, ...newBars];
          } else {
            data = cachedBars;
          }
        }
      } catch { /* merge failed — use delta data as-is */ }
    }
    if (data) source = 'binance';
  }

  // ── Step 1.5: Crypto → CoinGecko (free, 365 days daily) ──────
  if (!data && isCrypto(sym)) {
    data = await withCircuitBreaker('coingecko', async () => {
      const cg = _coinGeckoAdapter;
      const CG_TF_MAP = {
        '1m': { interval: '5m', days: 1 },
        '5m': { interval: '5m', days: 1 },
        '15m': { interval: '1h', days: 5 },
        '30m': { interval: '1h', days: 5 },
        '1h': { interval: '1h', days: 30 },
        '4h': { interval: '1d', days: 90 },
        '1D': { interval: '1d', days: 365 },
        '1w': { interval: '1d', days: 365 },
      };
      const cgTf = CG_TF_MAP[tfId] || { interval: '1d', days: 365 };
      const candles = await cg.fetchOHLCV(sym, cgTf.interval, { days: cgTf.days });
      return (candles && candles.length > 1) ? candles : null;
    });
    if (data) source = 'coingecko';
  }

  // ── Step 1.6: Crypto → CryptoCompare (free, 2000 daily candles) ──
  if (!data && isCrypto(sym)) {
    data = await withCircuitBreaker('cryptocompare', async () => {
      const cc = _cryptoCompareAdapter;
      const CC_TF_MAP = {
        '1m': '5m', '5m': '5m', '15m': '1h', '30m': '1h',
        '1h': '1h', '4h': '1d', '1D': '1d', '1w': '1d',
      };
      const ccInterval = CC_TF_MAP[tfId] || '1d';
      const candles = await cc.fetchOHLCV(sym, ccInterval);
      return (candles && candles.length > 1) ? candles : null;
    });
    if (data) source = 'cryptocompare';
  }

  // ── Step 2: Equities → Premium providers (Polygon, FMP, Alpha Vantage)
  if (!data && !isCrypto(sym)) {
    data = await withCircuitBreaker('equity-premium', async () => {
      // Dynamic import to avoid circular dependency (DataProvider imports from FetchService consumers)
      const { fetchEquityPremium } = await import('./DataProvider.js');
      const result = await fetchEquityPremium(sym, tfId);
      if (result && result.data) {
        source = result.source || 'polygon';
        return result.data;
      }
      return null;
    });
    if (data && source === 'no_data') source = 'polygon';
  }

  // ── Step 3: Equities → Yahoo Finance (free, no key required) ──
  if (!data && !isCrypto(sym)) {
    data = await withCircuitBreaker('yahoo', async () => {
      const yahoo = new YahooAdapter();
      const YAHOO_TF_MAP = {
        '1m': { interval: '1m', range: '1d' },
        '5m': { interval: '5m', range: '5d' },
        '15m': { interval: '15m', range: '5d' },
        '30m': { interval: '15m', range: '5d' },
        '1h': { interval: '60m', range: '1mo' },
        '4h': { interval: '1d', range: '3mo' },
        '1D': { interval: '1d', range: '1y' },
        '1w': { interval: '1wk', range: '5y' },
      };
      const yahooTf = YAHOO_TF_MAP[tfId] || { interval: '1d', range: '1y' };
      const candles = await yahoo.fetchOHLCV(sym, yahooTf.interval, { range: yahooTf.range });
      if (candles && candles.length > 1) {
        return candles.map(c => ({
          time: typeof c.time === 'number' ? new Date(c.time).toISOString() : c.time,
          open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
        }));
      }
      return null;
    });
    if (data) source = 'yahoo';
  }

  // ── Step 4: Offline fallback → OPFS cache ─────────────────────
  if (!data) {
    pipelineLogger.warn('FetchService', `All providers failed for ${sym}:${tfId}`);
    try {
      const offlineBars = await opfsBarStore.getCandles(sym, tfId);
      if (offlineBars && offlineBars.length > 0) {
        cacheManager.write(sym, tfId, offlineBars, 'cached');
        return { data: offlineBars, source: 'cached' };
      }
    } catch { /* OPFS unavailable */ }

    source = 'no_data';
    const warningMsg = !isCrypto(sym)
      ? `No data available for ${sym}. Try adding a Polygon.io or FMP API key in Settings for better data.`
      : `Unable to fetch data for ${sym}. Check your connection.`;
    _lastWarning = warningMsg;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('charEdge:data-warning', {
          detail: { message: warningMsg, symbol: sym },
        }),
      );
    }
  }

  // ── Validate & cache (unified write to all tiers) ─────────────
  if (data) {
    data = validateCandleArray(data);
    if (data.length === 0) data = null;
  }
  if (data) {
    cacheManager.write(sym, tfId, data, source);
    pipelineLogger.info('FetchService', `Fetched ${data.length} bars for ${sym}:${tfId} from ${source}`);
    // Record latest price for volatility tracking
    if (data.length > 0) {
      volatilityTTL.recordPrice(sym, data[data.length - 1].close);
    }
  }
  return { data, source };
}

// Background refresh with guard to prevent tight loops.
// Ensures at most one bg refresh per key every 10 seconds.
const _bgRefreshTimestamps = new Map();
function _bgRefresh(sym, tfId, tf, key) {
  const now = Date.now();
  const lastRefresh = _bgRefreshTimestamps.get(key) || 0;
  if (now - lastRefresh < 10_000) return; // Throttle: max 1 refresh per 10s per key
  _bgRefreshTimestamps.set(key, now);
  // Evict entries older than 5 minutes to prevent unbounded growth
  if (_bgRefreshTimestamps.size > 200) {
    const cutoff = now - 300_000;
    for (const [k, t] of _bgRefreshTimestamps) {
      if (t < cutoff) _bgRefreshTimestamps.delete(k);
    }
  }
  _doFetch(sym, tfId, tf, key).catch((err) => pipelineLogger.warn('FetchService', `Background refresh failed: ${key}`, err));
}

function clearCache() {
  cacheManager.clear();
  _bgRefreshTimestamps.clear();
}

function cacheStats() {
  return cacheManager.getStats();
}

function getLastWarning() {
  return _lastWarning;
}

/**
 * C2.6: Cache Warming — Pre-fetch adjacent timeframes for a symbol.
 * Called when user switches symbol. Fetches all timeframes in the background
 * so switching TFs after a symbol change is instant.
 *
 * @param {string} sym - Symbol to warm
 * @param {string} currentTfId - Currently active timeframe (skip — already fetched)
 */
function warmCache(sym, currentTfId) {
  // Now warming all asset types since Yahoo provides equity data too

  // Only warm 2 adjacent timeframes instead of all to reduce network load
  const ADJACENT = {
    '1m': ['5m', '15m'],
    '5m': ['1m', '15m'],
    '15m': ['5m', '30m'],
    '30m': ['15m', '1h'],
    '1h': ['30m', '4h'],
    '4h': ['1h', '1D'],
    '1D': ['4h', '1w'],
    '1w': ['1D', '4h'],
  };
  const toWarm = ADJACENT[currentTfId] || ['1m', '5m'];

  // Stagger fetches 300ms apart to avoid burst
  toWarm.forEach((tfId, i) => {
    setTimeout(
      () => {
        // Skip if already cached and fresh
        const ttl = TTL[tfId] || 60000;
        if (cacheManager.hasFresh(sym, tfId, ttl)) return;
        // Background fetch — errors silently caught
        fetchOHLC(sym, tfId).catch((err) => pipelineLogger.debug('FetchService', `Cache warm failed: ${sym}:${tfId}`, err));
      },
      (i + 1) * 300,
    );
  });
}

/**
 * Fetch 24hr ticker price change statistics for one or multiple symbols.
 * Crypto: uses Binance 24hr ticker API.
 * Equities: uses Yahoo Finance for change% data.
 */
async function fetch24hTicker(symbols) {
  if (!symbols || symbols.length === 0) return [];
  const symArray = Array.isArray(symbols) ? symbols : [symbols];

  const cryptoSyms = symArray.filter((sym) => isCrypto(sym));
  const equitySyms = symArray.filter((sym) => !isCrypto(sym));
  const results = [];

  // ── Crypto: Binance 24hr ticker ──
  if (cryptoSyms.length > 0) {
    const pairs = cryptoSyms.map((sym) => toBinancePair(sym));
    try {
      const base = typeof window === 'undefined' ? `http://localhost:${globalThis.__TF_PORT || 3000}` : '';
      const symbolsParam = encodeURIComponent(JSON.stringify(pairs));
      const url = `${base}/api/binance/v3/ticker/24hr?symbols=${symbolsParam}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        results.push(...(Array.isArray(data) ? data : [data]));
      }
    } catch { /* silent */ }
  }

  // ── Equities: Yahoo Finance quote for change% ──
  if (equitySyms.length > 0) {
    try {
      const yahoo = new YahooAdapter();
      for (const sym of equitySyms) {
        try {
          const candles = await yahoo.fetchOHLCV(sym, '5m', { range: '1d' });
          if (candles && candles.length >= 2) {
            const first = candles[0];
            const last = candles[candles.length - 1];
            const priceChange = last.close - first.open;
            const priceChangePct = ((priceChange / first.open) * 100).toFixed(2);
            results.push({
              symbol: sym,
              lastPrice: String(last.close),
              priceChange: String(priceChange.toFixed(4)),
              priceChangePercent: priceChangePct,
              highPrice: String(Math.max(...candles.map(c => c.high))),
              lowPrice: String(Math.min(...candles.map(c => c.low))),
              volume: String(candles.reduce((s, c) => s + (c.volume || 0), 0)),
            });
          }
        } catch { /* skip this equity symbol */ }
      }
    } catch { /* Yahoo adapter unavailable */ }
  }

  return results;
}

/**
 * Fetch lightweight sparkline data (recent closes).
 * Crypto: Binance 24 × 1h klines.
 * Equities: Yahoo Finance 1d chart with 15m candles.
 */
async function fetchSparkline(symbol, isCryptoAsset = true) {
  const s = (symbol || '').toUpperCase();

  // ── Equities: Yahoo Finance sparkline ──
  if (!isCryptoAsset || !isCrypto(s)) {
    try {
      const yahoo = new YahooAdapter();
      const candles = await yahoo.fetchOHLCV(s, '15m', { range: '1d' });
      if (candles && candles.length > 0) return candles.map(c => c.close);
    } catch { /* Yahoo unavailable */ }
    return [];
  }

  // ── Crypto: Binance klines ──
  let pair = toBinancePair(s);
  try {
    const base = typeof window === 'undefined' ? `http://localhost:${globalThis.__TF_PORT || 3000}` : '';
    const url = `${base}/api/binance/v3/klines?symbol=${pair}&interval=1h&limit=24`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const raw = await res.json();
    if (!Array.isArray(raw)) return [];
    return raw.map((k) => parseFloat(k[4]));
  } catch {
    return [];
  }
}

export {
  fetchOHLC,
  fetchSymbolSearch,
  clearCache,
  cacheStats,
  getLastWarning,
  warmCache,
  fetch24hTicker,
  fetchSparkline,
};
export default fetchOHLC;
