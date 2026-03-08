// ═══════════════════════════════════════════════════════════════════
// charEdge — SparklineService
//
// Lightweight ticker and sparkline data fetching.
// Delegates to QuoteService unified cache (60s TTL) to prevent
// redundant API calls. Falls back to direct fetch on cache miss.
//
// Task 1B.4: Sparkline dedup via QuoteService cache
// ═══════════════════════════════════════════════════════════════════

import { isCrypto } from '../constants.js';
import { getQuote, getSparkline as _getSparkline } from './QuoteService.js';
import { logger } from '../utils/logger';

/**
 * Fetch 24hr ticker price change statistics for one or multiple symbols.
 * Now reads from QuoteService unified cache instead of making separate
 * Binance/Yahoo requests per symbol.
 */
export async function fetch24hTicker(symbols) {
  if (!symbols || symbols.length === 0) return [];
  const symArray = Array.isArray(symbols) ? symbols : [symbols];

  const results = [];

  // Fetch all symbols through QuoteService (which caches + deduplicates)
  const promises = symArray.map(async (sym) => {
    try {
      const quote = await getQuote(sym);
      if (quote && quote._raw) {
        results.push(quote._raw);
      }
    } catch (e) {
      logger.data.warn(`[SparklineService] Ticker fetch failed for ${sym}`, e.message);
    }
  });

  await Promise.all(promises);
  return results;
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
