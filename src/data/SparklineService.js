// ═══════════════════════════════════════════════════════════════════
// charEdge — SparklineService
//
// Lightweight ticker and sparkline data fetching.
// Delegates to QuoteService unified cache (60s TTL) to prevent
// redundant API calls. Falls back to direct fetch on cache miss.
//
// Task 1B.4: Sparkline dedup via QuoteService cache
// ═══════════════════════════════════════════════════════════════════

import { getQuote, getSparkline as _getSparkline, batchGetQuotes } from './QuoteService.js';
import { logger } from '@/observability/logger';

/**
 * Fetch 24hr ticker price change statistics for one or multiple symbols.
 * Uses batchGetQuotes() to collapse crypto into a single API call.
 */
export async function fetch24hTicker(symbols) {
  if (!symbols || symbols.length === 0) return [];
  const symArray = Array.isArray(symbols) ? symbols : [symbols];

  try {
    const quoteMap = await batchGetQuotes(symArray);
    const results = [];
    for (const quote of quoteMap.values()) {
      if (quote?._raw) results.push(quote._raw);
    }
    return results;
  } catch (e) {
    logger.data.warn('[SparklineService] Batch ticker fetch failed, falling back to individual', e.message);
    // Fallback to individual fetches
    const results = [];
    const promises = symArray.map(async (sym) => {
      try {
        const quote = await getQuote(sym);
        if (quote?._raw) results.push(quote._raw);
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) { /* skip */ }
    });
    await Promise.all(promises);
    return results;
  }
}

/**
 * Fetch lightweight sparkline data (recent closes).
 * Now reads from QuoteService unified cache instead of making
 * standalone Binance kline / Yahoo requests.
 */
export async function fetchSparkline(symbol, isCryptoAsset = true) {
  const s = (symbol || '').toUpperCase();
  if (!s) return [];

  try {
    return await _getSparkline(s, isCryptoAsset);
  } catch (e) {
    logger.data.warn(`[SparklineService] Sparkline fetch failed for ${s}`, e.message);
    return [];
  }
}
