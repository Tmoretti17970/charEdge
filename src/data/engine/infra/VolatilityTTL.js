// ═══════════════════════════════════════════════════════════════════
// charEdge v12 — Volatility-Aware TTL (#13)
//
// Adjusts FetchService cache TTLs based on recent price movement.
// High volatility → halve TTL (refresh more frequently)
// Low volatility → 1.5× TTL (save bandwidth)
// Market hours awareness for equities.
//
// Usage:
//   import { volatilityTTL } from './infra/VolatilityTTL.js';
//   const ttl = volatilityTTL.getTTL(symbol, tfId, baseTTL);
// ═══════════════════════════════════════════════════════════════════

const HISTORY_SIZE = 20;  // Track last 20 price updates per symbol
const HIGH_VOL_THRESHOLD = 0.02;  // >2% stddev of returns → high volatility
const LOW_VOL_THRESHOLD = 0.005;  // <0.5% stddev → low volatility

// Market hours (US Eastern): 9:30 AM — 4:00 PM
const MARKET_OPEN_HOUR = 9.5;   // 9:30 AM
const MARKET_CLOSE_HOUR = 16;   // 4:00 PM

// Known equity symbols (simple heuristic — no 'USDT' suffix)
const EQUITY_PATTERN = /^[A-Z]{1,5}$/;
const CRYPTO_PATTERN = /USDT$|^(BTC|ETH|SOL|BNB|XRP|DOGE|ADA|AVAX)$/;

class _VolatilityTTL {
  constructor() {
    /** @type {Map<string, number[]>} symbol → recent prices */
    this._prices = new Map();
  }

  /**
   * Record a price update for volatility tracking.
   * @param {string} symbol
   * @param {number} price
   */
  recordPrice(symbol, price) {
    if (!price || price <= 0) return;

    let history = this._prices.get(symbol);
    if (!history) {
      history = [];
      this._prices.set(symbol, history);
    }

    history.push(price);
    if (history.length > HISTORY_SIZE) {
      history.shift(); // Keep bounded
    }
  }

  /**
   * Compute rolling volatility (stddev of log returns) for a symbol.
   * @param {string} symbol
   * @returns {number} volatility (0 if insufficient data)
   */
  getVolatility(symbol) {
    const history = this._prices.get(symbol);
    if (!history || history.length < 3) return 0;

    // Compute log returns
    const returns = [];
    for (let i = 1; i < history.length; i++) {
      returns.push(Math.log(history[i] / history[i - 1]));
    }

    // Standard deviation
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
    return Math.sqrt(variance);
  }

  /**
   * Check if we're currently in US equity market hours.
   * @returns {boolean}
   */
  isMarketHours() {
    const now = new Date();
    // Convert to US Eastern (approximate: UTC-5 in winter, UTC-4 in summer)
    const utcHour = now.getUTCHours() + now.getUTCMinutes() / 60;
    // EST = UTC-5, EDT = UTC-4. Use a simple heuristic:
    // March–November → EDT (UTC-4), else EST (UTC-5)
    const month = now.getUTCMonth(); // 0-indexed
    const offset = (month >= 2 && month <= 10) ? 4 : 5;
    const easternHour = (utcHour - offset + 24) % 24;

    const dayOfWeek = now.getUTCDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

    return isWeekday && easternHour >= MARKET_OPEN_HOUR && easternHour < MARKET_CLOSE_HOUR;
  }

  /**
   * Check if a symbol is likely an equity (not crypto).
   * @param {string} symbol
   * @returns {boolean}
   */
  isEquity(symbol) {
    if (CRYPTO_PATTERN.test(symbol)) return false;
    return EQUITY_PATTERN.test(symbol);
  }

  /**
   * Get the adjusted TTL for a symbol and timeframe.
   * @param {string} symbol
   * @param {string} tfId - Timeframe ID (e.g., '1d', '1m', '1y')
   * @param {number} baseTTL - Base TTL in milliseconds
   * @returns {number} Adjusted TTL in milliseconds
   */
  getTTL(symbol, tfId, baseTTL) {
    let multiplier = 1.0;

    // 1. Volatility adjustment
    const vol = this.getVolatility(symbol);
    if (vol > HIGH_VOL_THRESHOLD) {
      multiplier *= 0.5;  // High vol → refresh faster
    } else if (vol < LOW_VOL_THRESHOLD && vol > 0) {
      multiplier *= 1.5;  // Low vol → save bandwidth
    }

    // 2. Market hours adjustment for equities
    if (this.isEquity(symbol)) {
      if (!this.isMarketHours()) {
        multiplier *= 3.0;  // Off-hours → much less frequent refresh
      }
    }

    // Clamp: never go below 25% of base or above 5× base
    const adjusted = Math.round(baseTTL * multiplier);
    return Math.max(Math.round(baseTTL * 0.25), Math.min(adjusted, baseTTL * 5));
  }

  /**
   * Get stats for debugging / dashboard.
   * @returns {Object}
   */
  getStats() {
    const stats = {};
    for (const [symbol, history] of this._prices) {
      stats[symbol] = {
        dataPoints: history.length,
        volatility: this.getVolatility(symbol),
        lastPrice: history[history.length - 1],
      };
    }
    return stats;
  }

  /** Clear all tracked data */
  reset() {
    this._prices.clear();
  }
}

export const volatilityTTL = new _VolatilityTTL();
export { _VolatilityTTL };
export default volatilityTTL;
