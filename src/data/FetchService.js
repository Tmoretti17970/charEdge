// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — FetchService
//
// Core OHLCV fetch orchestrator with 4-tier cache, SWR, circuit
// breaker, and multi-provider fallback. Binance-specific logic is
// in BinanceClient.js; sparklines in SparklineService.js; history
// pagination in HistoryPaginator.js.
// ═══════════════════════════════════════════════════════════════════

import { TFS, isCrypto, buildCacheKey } from '../constants.js';
import { opfsBarStore } from './engine/infra/OPFSBarStore.js';
import { withCircuitBreaker } from './engine/infra/CircuitBreaker';
import { validateCandleArray } from './engine/infra/DataValidator.js';
import { volatilityTTL } from './engine/infra/VolatilityTTL.js';
import { cacheManager } from './engine/infra/CacheManager.js';
import { staleWhileRevalidate } from './engine/swr.js';
import { CoinGeckoAdapter } from './adapters/CoinGeckoAdapter.js';
import { CryptoCompareAdapter } from './adapters/CryptoCompareAdapter.js';
import { YahooAdapter } from './adapters/YahooAdapter.js';
import { pipelineLogger } from './engine/infra/DataPipelineLogger.js';
import { apiMeter } from './engine/infra/ApiMeter.js';
import { fetchBinance } from './BinanceClient.js';
import { fetch24hTicker, fetchSparkline } from './SparklineService.js';
import { fetchOHLCPage } from './HistoryPaginator.js';

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



// ─── Symbol Search (extracted to SymbolSearch.js) ──────────────
import { fetchSymbolSearch } from './SymbolSearch.js';


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
    apiMeter.record('binance', `${sym}:${tfId}`);
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

  // ── Step 1.5: Crypto → CryptoCompare (free, 100K/month, has volume) ──
  // Moved before CoinGecko (Task 1B.3): higher rate limit + volume data
  if (!data && isCrypto(sym)) {
    data = await withCircuitBreaker('cryptocompare', async () => {
      const cc = _cryptoCompareAdapter;
      const CC_TF_MAP = {
        '1m': '5m', '5m': '5m', '15m': '1h', '30m': '1h',
        '1h': '1h', '4h': '1d', '1D': '1d', '1w': '1d',
      };
      const ccInterval = CC_TF_MAP[tfId] || '1d';
      const candles = await cc.fetchOHLCV(sym, ccInterval);
      apiMeter.record('cryptocompare', `${sym}:${ccInterval}`);
      return (candles && candles.length > 1) ? candles : null;
    });
    if (data) source = 'cryptocompare';
  }

  // ── Step 1.6: Crypto → CoinGecko (free, 10K/month, no volume) ──
  // Last-resort crypto fallback (lower rate limit, no volume data)
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
      apiMeter.record('coingecko', `${sym}:${cgTf.interval}`);
      return (candles && candles.length > 1) ? candles : null;
    });
    if (data) source = 'coingecko';
  }

  // ── Step 2: Equities → Premium providers (Polygon, FMP, Alpha Vantage)
  if (!data && !isCrypto(sym)) {
    data = await withCircuitBreaker('equity-premium', async () => {
      // Dynamic import to avoid circular dependency (DataProvider imports from FetchService consumers)
      const { fetchEquityPremium } = await import('./DataProvider.js');
      const result = await fetchEquityPremium(sym, tfId);
      apiMeter.record(result?.source || 'polygon', `${sym}:${tfId}`);
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
      apiMeter.record('yahoo', `${sym}:${yahooTf.interval}`);
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

export {
  fetchOHLC,
  fetchOHLCPage,
  fetchSymbolSearch,
  clearCache,
  cacheStats,
  getLastWarning,
  warmCache,
  fetch24hTicker,
  fetchSparkline,
};
export default fetchOHLC;

