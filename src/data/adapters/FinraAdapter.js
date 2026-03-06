import { logger } from '../../utils/logger.ts';
// ═══════════════════════════════════════════════════════════════════
// charEdge v14 — FINRA Data Adapter
//
// Free institutional data from FINRA's public APIs:
//   - Short Interest (bi-monthly reports)
//   - Dark Pool / ATS Volume (weekly, 2-week delay)
//   - Short Sale Volume (daily ratio)
//
// No API key required. Data is publicly available.
// Rate limit: ~10 req/sec (generous).
//
// Usage:
//   import { finraAdapter } from './FinraAdapter.js';
//   const si = await finraAdapter.fetchShortInterest('AAPL');
//   const dp = await finraAdapter.fetchDarkPoolVolume('AAPL');
// ═══════════════════════════════════════════════════════════════════

const FINRA_BASE = 'https://api.finra.org/data/group/otcMarket';
const FINRA_HEADERS = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
};

// In-memory cache (FINRA data updates infrequently)
const CACHE = new Map();
const CACHE_TTL = 1800000; // 30 min

function cached(key) {
  const entry = CACHE.get(key);
  if (entry && Date.now() < entry.expiry) return entry.data;
  return null;
}

function setCache(key, data) {
  CACHE.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

// ─── FINRA Adapter ─────────────────────────────────────────────

class _FinraAdapter {

  /**
   * Fetch consolidated short interest data for a symbol.
   * FINRA provides bi-monthly short interest reports for all equity securities.
   *
   * @param {string} symbol - e.g., 'AAPL'
   * @param {number} [limit=20] - Number of reporting periods to return
   * @returns {Promise<Array<{
   *   settlementDate: string,
   *   shortInterest: number,
   *   avgDailyVolume: number,
   *   daysToCover: number,
   *   shortInterestRatio: number
   * }>>}
   */
  async fetchShortInterest(symbol, limit = 20) {
    const cacheKey = `si:${symbol}`;
    const hit = cached(cacheKey);
    if (hit) return hit;

    const upper = (symbol || '').toUpperCase().trim();

    try {
      // Use FINRA's free short interest Query API
      // This endpoint provides consolidated short interest across exchanges
      const resp = await fetch(`${FINRA_BASE}/cnsSiSummary`, {
        method: 'POST',
        headers: FINRA_HEADERS,
        body: JSON.stringify({
          fields: ['settlementDate', 'symbolCode', 'currentShortPositionQuantity',
                   'averageDailyVolumeQuantity', 'daysToCoverQuantity',
                   'previousShortPositionQuantity', 'changePreviousNumber',
                   'changePercent'],
          compareFilters: [
            { fieldName: 'symbolCode', fieldValue: upper, compareType: 'EQUAL' },
          ],
          limit,
          sortFields: ['-settlementDate'],
        }),
      });

      if (!resp.ok) {
        // Fallback: try computing from publicly available data
        return this._computeShortInterestFallback(upper);
      }

      const data = await resp.json();
      const result = (data || []).map(row => ({
        settlementDate: row.settlementDate,
        shortInterest: row.currentShortPositionQuantity || 0,
        previousShortInterest: row.previousShortPositionQuantity || 0,
        change: row.changePreviousNumber || 0,
        changePercent: row.changePercent || 0,
        avgDailyVolume: row.averageDailyVolumeQuantity || 0,
        daysToCover: row.daysToCoverQuantity || 0,
      }));

      setCache(cacheKey, result);
      return result;
    } catch (err) {
      logger.data.warn('[FinraAdapter] Short interest error:', err.message);
      return this._computeShortInterestFallback(upper);
    }
  }

  /**
   * Fetch dark pool (ATS) volume for a symbol.
   * ATS = Alternative Trading System (dark pools like Citadel Connect, Virtu).
   * Data is published weekly with a ~2 week delay.
   *
   * @param {string} symbol - e.g., 'AAPL'
   * @param {number} [limit=20] - Number of weeks to return
   * @returns {Promise<Array<{
   *   weekOf: string,
   *   totalWeeklyShareQuantity: number,
   *   totalWeeklyTradeCount: number,
   *   atsName: string
   * }>>}
   */
  async fetchDarkPoolVolume(symbol, limit = 20) {
    const cacheKey = `dp:${symbol}`;
    const hit = cached(cacheKey);
    if (hit) return hit;

    const upper = (symbol || '').toUpperCase().trim();

    try {
      const resp = await fetch(`${FINRA_BASE}/weeklySummary`, {
        method: 'POST',
        headers: FINRA_HEADERS,
        body: JSON.stringify({
          fields: ['weekStartDate', 'issueSymbolIdentifier', 'totalWeeklyShareQuantity',
                   'totalWeeklyTradeCount', 'lastUpdateDate'],
          compareFilters: [
            { fieldName: 'issueSymbolIdentifier', fieldValue: upper, compareType: 'EQUAL' },
          ],
          limit,
          sortFields: ['-weekStartDate'],
        }),
      });

      if (!resp.ok) return [];

      const data = await resp.json();
      const result = (data || []).map(row => ({
        weekOf: row.weekStartDate,
        totalShares: row.totalWeeklyShareQuantity || 0,
        totalTrades: row.totalWeeklyTradeCount || 0,
        lastUpdate: row.lastUpdateDate || '',
      }));

      setCache(cacheKey, result);
      return result;
    } catch (err) {
      logger.data.warn('[FinraAdapter] Dark pool volume error:', err.message);
      return [];
    }
  }

  /**
   * Fetch short sale volume ratio (daily).
   * Shows what percentage of daily volume was short selling.
   *
   * @param {string} symbol
   * @param {number} [limit=30] - Number of days
   * @returns {Promise<Array<{
   *   date: string,
   *   shortVolume: number,
   *   totalVolume: number,
   *   shortRatio: number
   * }>>}
   */
  async fetchShortSaleVolume(symbol, limit = 30) {
    const cacheKey = `ssv:${symbol}`;
    const hit = cached(cacheKey);
    if (hit) return hit;

    const upper = (symbol || '').toUpperCase().trim();

    try {
      // FINRA publishes daily short sale volume files
      const resp = await fetch(`${FINRA_BASE}/regShoDaily`, {
        method: 'POST',
        headers: FINRA_HEADERS,
        body: JSON.stringify({
          fields: ['tradeReportDate', 'securitiesInformationProcessorSymbolIdentifier',
                   'shortVolume', 'shortExemptVolume', 'totalVolume'],
          compareFilters: [
            { fieldName: 'securitiesInformationProcessorSymbolIdentifier',
              fieldValue: upper, compareType: 'EQUAL' },
          ],
          limit,
          sortFields: ['-tradeReportDate'],
        }),
      });

      if (!resp.ok) return [];

      const data = await resp.json();
      const result = (data || []).map(row => ({
        date: row.tradeReportDate,
        shortVolume: row.shortVolume || 0,
        shortExemptVolume: row.shortExemptVolume || 0,
        totalVolume: row.totalVolume || 0,
        shortRatio: row.totalVolume > 0
          ? Math.round((row.shortVolume / row.totalVolume) * 10000) / 100
          : 0,
      }));

      setCache(cacheKey, result);
      return result;
    } catch (err) {
      logger.data.warn('[FinraAdapter] Short sale volume error:', err.message);
      return [];
    }
  }

  /**
   * @private Fallback short interest computation when API is unavailable.
   * Returns empty array — UI will show "data unavailable" message.
   */
  _computeShortInterestFallback(symbol) {
    logger.data.info(`[FinraAdapter] Short interest API unavailable for ${symbol}, returning empty`);
    return [];
  }

  /**
   * Check if a symbol supports FINRA data (US equities only).
   * @param {string} symbol
   * @returns {boolean}
   */
  supports(symbol) {
    const upper = (symbol || '').toUpperCase();
    return /^[A-Z]{1,5}$/.test(upper);
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const finraAdapter = new _FinraAdapter();

export default finraAdapter;
