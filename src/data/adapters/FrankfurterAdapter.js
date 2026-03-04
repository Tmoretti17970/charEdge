import { logger } from '../../utils/logger.ts';
// ═══════════════════════════════════════════════════════════════════
// charEdge v12 — Frankfurter Adapter (ECB Exchange Rates)
//
// Free, open-source currency data API.
// Tracks reference exchange rates published by the European Central Bank.
// No API key, no usage caps, no auth.
//
// Data: 30+ currency pairs, daily rates, historical back to 1999.
// Update: Daily around 16:00 CET.
//
// Usage:
//   import { frankfurterAdapter } from './FrankfurterAdapter.js';
//   const rate = await frankfurterAdapter.fetchRate('EUR', 'USD');
//   const history = await frankfurterAdapter.fetchHistory('EUR', 'USD', 30);
// ═══════════════════════════════════════════════════════════════════

const BASE_URL = 'https://api.frankfurter.dev/v1';
const CACHE = new Map();
const CACHE_TTL = 600000; // 10 min (ECB updates daily anyway)

class _FrankfurterAdapter {
  /**
   * Fetch the latest exchange rate.
   * @param {string} from - Base currency (e.g., 'EUR')
   * @param {string} to - Target currency (e.g., 'USD')
   * @returns {Promise<{ rate, from, to, date }|null>}
   */
  async fetchRate(from, to) {
    const key = `${from}-${to}`;
    const cached = CACHE.get(key);
    if (cached && Date.now() < cached.expiry) return cached.data;

    try {
      const resp = await fetch(`${BASE_URL}/latest?base=${from}&symbols=${to}`);
      if (!resp.ok) return null;

      const json = await resp.json();
      const result = {
        rate: json.rates?.[to] || null,
        from,
        to,
        date: json.date,
      };

      CACHE.set(key, { data: result, expiry: Date.now() + CACHE_TTL });
      return result;
    } catch (err) {
      logger.data.warn('[FrankfurterAdapter] fetchRate failed:', err.message);
      return null;
    }
  }

  /**
   * Fetch rates for multiple target currencies.
   * @param {string} from - Base currency
   * @param {string[]} [targets] - Target currencies (omit for all)
   * @returns {Promise<Object|null>}
   */
  async fetchAllRates(from = 'USD', targets) {
    try {
      let url = `${BASE_URL}/latest?base=${from}`;
      if (targets?.length) url += `&symbols=${targets.join(',')}`;

      const resp = await fetch(url);
      if (!resp.ok) return null;

      return await resp.json();
    } catch {
      return null;
    }
  }

  /**
   * Fetch historical exchange rate time series.
   * @param {string} from - Base currency
   * @param {string} to - Target currency
   * @param {number} [days=30] - Days of history
   * @returns {Promise<Array<{ date, rate }>>}
   */
  async fetchHistory(from, to, days = 30) {
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

    try {
      const resp = await fetch(`${BASE_URL}/${startDate}..${endDate}?base=${from}&symbols=${to}`);
      if (!resp.ok) return [];

      const json = await resp.json();
      if (!json.rates) return [];

      return Object.entries(json.rates)
        .map(([date, rates]) => ({
          date,
          time: new Date(date).getTime(),
          rate: rates[to],
        }))
        .sort((a, b) => a.time - b.time);
    } catch (err) {
      logger.data.warn('[FrankfurterAdapter] fetchHistory failed:', err.message);
      return [];
    }
  }

  /**
   * Fetch rate for a specific historical date.
   * @param {string} date - YYYY-MM-DD
   * @param {string} from
   * @param {string} to
   * @returns {Promise<{ rate, date }|null>}
   */
  async fetchHistoricalRate(date, from, to) {
    try {
      const resp = await fetch(`${BASE_URL}/${date}?base=${from}&symbols=${to}`);
      if (!resp.ok) return null;

      const json = await resp.json();
      return {
        rate: json.rates?.[to] || null,
        date: json.date,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get list of available currencies.
   * @returns {Promise<Object>} { USD: 'United States Dollar', EUR: 'Euro', ... }
   */
  async fetchCurrencies() {
    try {
      const resp = await fetch(`${BASE_URL}/currencies`);
      if (!resp.ok) return {};
      return await resp.json();
    } catch {
      return {};
    }
  }

  /**
   * Compute a DXY proxy from major currencies.
   * DXY = weighted average of USD against EUR, JPY, GBP, CAD, SEK, CHF.
   * @returns {Promise<number|null>}
   */
  async computeDXYProxy() {
    try {
      const data = await this.fetchAllRates('USD', ['EUR', 'JPY', 'GBP', 'CAD', 'SEK', 'CHF']);
      if (!data?.rates) return null;

      const r = data.rates;
      // DXY weights (approximate): EUR 57.6%, JPY 13.6%, GBP 11.9%, CAD 9.1%, SEK 4.2%, CHF 3.6%
      const dxy = 50.14348112 *
        Math.pow(r.EUR, -0.576) *
        Math.pow(r.JPY, 0.136) *
        Math.pow(r.GBP, -0.119) *
        Math.pow(r.CAD, 0.091) *
        Math.pow(r.SEK, 0.042) *
        Math.pow(r.CHF, 0.036);

      return Math.round(dxy * 100) / 100;
    } catch {
      return null;
    }
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const frankfurterAdapter = new _FrankfurterAdapter();
export default frankfurterAdapter;
