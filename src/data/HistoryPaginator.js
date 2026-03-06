// ═══════════════════════════════════════════════════════════════════
// charEdge — HistoryPaginator
//
// Paginated history fetching for scroll-left prefetch.
// Returns { data: [...bars], hasMore: boolean }.
// Extracted from FetchService.js.
// ═══════════════════════════════════════════════════════════════════

import { isCrypto } from '../constants.js';
import { validateCandleArray } from './engine/infra/DataValidator';
import { toBinancePair, BINANCE_INTERVALS, fetchBinanceBatch } from './BinanceClient.js';
import { logger } from '../utils/logger';

/** Dedup in-flight pagination requests. */
const _historyInflight = new Map();

/**
 * Fetch a single page of older bars ending before `beforeTime`.
 * Returns { data: [...bars], hasMore: boolean }.
 * Used by scroll-left prefetch to load history incrementally.
 */
export async function fetchOHLCPage(sym, tfId, beforeTime) {
  const key = `${sym}:${tfId}:page`;

  // ── Cache-first — check for cached page ──
  try {
    const { cacheManager } = await import('./engine/infra/CacheManager.js');
    const cached = cacheManager.readPage(sym, tfId, beforeTime);
    if (cached) return cached;
  } catch (e) { logger.data.warn('Operation failed', e); }

  // Dedup in-flight pagination requests
  if (_historyInflight.has(key)) return _historyInflight.get(key);

  const promise = _doFetchPage(sym, tfId, beforeTime).then(async (result) => {
    // Write to page cache on successful fetch
    if (result.data.length > 0) {
      try {
        const { cacheManager } = await import('./engine/infra/CacheManager.js');
        cacheManager.writePage(sym, tfId, beforeTime, result.data, result.hasMore);
      } catch (e) { logger.data.warn('Operation failed', e); }
    }
    return result;
  });

  _historyInflight.set(key, promise);
  try {
    return await promise;
  } finally {
    _historyInflight.delete(key);
  }
}

async function _doFetchPage(sym, tfId, beforeTime) {
  const PAGE_SIZE = 500;

  const endTimeMs = typeof beforeTime === 'string'
    ? new Date(beforeTime).getTime() - 1
    : beforeTime - 1;

  if (isCrypto(sym)) {
    const pair = toBinancePair(sym);
    const interval = BINANCE_INTERVALS[tfId];
    if (!interval) return { data: [], hasMore: false };

    const batch = await fetchBinanceBatch(pair, interval, PAGE_SIZE, endTimeMs);
    if (!batch || batch.length === 0) return { data: [], hasMore: false };

    const bars = batch.map(({ _openMs, ...rest }) => rest);
    return {
      data: validateCandleArray(bars),
      hasMore: batch.length >= PAGE_SIZE,
    };
  }

  // Non-crypto: paginate via equity provider chain (Polygon → FMP → AlphaVantage)
  try {
    const { fetchEquityPage } = await import('./providers/EquityPaginator.js');
    return fetchEquityPage(sym, tfId, endTimeMs, PAGE_SIZE);
  } catch (e) {
    logger.data.warn('[HistoryPaginator] Equity pagination failed', e?.message);
    return { data: [], hasMore: false };
  }
}
