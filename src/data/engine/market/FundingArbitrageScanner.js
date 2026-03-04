// ═══════════════════════════════════════════════════════════════════
// charEdge v15 — Funding Arbitrage Scanner
//
// Scans all crypto perpetual pairs across Binance + Bybit to
// identify funding rate arbitrage opportunities and extremes.
//
// Strategies detected:
//   1. Cross-exchange funding spread (Binance vs Bybit)
//   2. Extreme funding rates (contrarian reversal signal)
//   3. Funding rate trend (accumulating longs/shorts)
//
// Usage:
//   import { fundingScanner } from './FundingArbitrageScanner.js';
//   fundingScanner.startScanning();
//   fundingScanner.onOpportunity(({ symbol, spread, ... }) => { ... });
//   const opportunities = fundingScanner.getOpportunities();
// ═══════════════════════════════════════════════════════════════════

import { bybitFuturesAdapter } from '../../adapters/BybitFuturesAdapter.js';

import { logger } from '../../../utils/logger.ts';
// ─── Constants ─────────────────────────────────────────────────

const SCAN_INTERVAL_MS = 5 * 60 * 1000;       // Scan every 5 minutes
const SPREAD_THRESHOLD_BPS = 3;                 // 0.03% funding spread threshold
const EXTREME_FUNDING_THRESHOLD = 0.001;        // 0.1% extreme funding rate
const MAX_OPPORTUNITIES = 100;
const BINANCE_TICKER_URL = 'https://fapi.binance.com/fapi/v1/premiumIndex';
const HISTORY_LENGTH = 48;                      // Keep 48 readings (~4 hours)

// ─── Opportunity Types ─────────────────────────────────────────

const OPP_TYPE = {
  CROSS_EXCHANGE_SPREAD: 'cross_exchange_spread',
  EXTREME_FUNDING: 'extreme_funding',
  FUNDING_REVERSAL: 'funding_reversal',
};

// ─── Funding Scanner ───────────────────────────────────────────

class _FundingArbitrageScanner {
  constructor() {
    this._scanTimer = null;
    this._opportunities = [];          // Active opportunities
    this._alertCallbacks = new Set();
    this._history = new Map();         // symbol → [{ binance, bybit, spread, time }]
    this._isScanning = false;
    this._lastScan = 0;
    this._scanCount = 0;
  }

  // ─── Public API ──────────────────────────────────────────────

  /**
   * Start periodic funding rate scanning.
   */
  startScanning() {
    if (this._isScanning) return;
    this._isScanning = true;

    // Initial scan
    this._scan().catch((err) => logger.data.warn('[FundingScanner] Initial scan failed:', err?.message));

    // Periodic scans
    this._scanTimer = setInterval(() => {
      this._scan().catch((err) => logger.data.warn('[FundingScanner] Periodic scan failed:', err?.message));
    }, SCAN_INTERVAL_MS);
  }

  /**
   * Stop scanning.
   */
  stopScanning() {
    this._isScanning = false;
    if (this._scanTimer) {
      clearInterval(this._scanTimer);
      this._scanTimer = null;
    }
  }

  /**
   * Force an immediate scan.
   * @returns {Promise<Array>} New opportunities found
   */
  async scan() {
    return this._scan();
  }

  /**
   * Register alert callback for new opportunities.
   *
   * @param {Function} callback - (opportunity) => void
   * @returns {Function} unsubscribe
   */
  onOpportunity(callback) {
    this._alertCallbacks.add(callback);
    return () => this._alertCallbacks.delete(callback);
  }

  /**
   * Get all current opportunities, sorted by spread.
   *
   * @param {number} [limit=20]
   * @returns {Array}
   */
  getOpportunities(limit = 20) {
    return this._opportunities
      .sort((a, b) => Math.abs(b.spreadBps) - Math.abs(a.spreadBps))
      .slice(0, limit);
  }

  /**
   * Get funding rate history for a symbol.
   *
   * @param {string} symbol
   * @returns {Array<{ binance, bybit, spread, time }>}
   */
  getHistory(symbol) {
    return this._history.get((symbol || '').toUpperCase()) || [];
  }

  /**
   * Get scanner stats.
   */
  getStats() {
    return {
      isScanning: this._isScanning,
      lastScan: this._lastScan,
      scanCount: this._scanCount,
      opportunityCount: this._opportunities.length,
      trackedSymbols: this._history.size,
    };
  }

  /**
   * Set the funding spread threshold (basis points).
   * @param {number} bps
   */
  setThreshold(bps) {
    // Only used for filtering; scanning still collects all data
  }

  /**
   * Dispose.
   */
  dispose() {
    this.stopScanning();
    this._opportunities = [];
    this._alertCallbacks.clear();
    this._history.clear();
  }

  // ─── Private Methods ─────────────────────────────────────────

  /** @private — Execute one scan cycle */
  async _scan() {
    this._scanCount++;
    this._lastScan = Date.now();
    const newOpps = [];

    try {
      // Fetch funding rates from both exchanges in parallel
      const [binanceTickers, bybitTickers] = await Promise.allSettled([
        this._fetchBinanceFunding(),
        bybitFuturesAdapter.getLinearTickers(),
      ]);

      const binanceMap = new Map();
      if (binanceTickers.status === 'fulfilled') {
        for (const t of binanceTickers.value) {
          binanceMap.set(t.symbol, t);
        }
      }

      const bybitMap = new Map();
      if (bybitTickers.status === 'fulfilled') {
        for (const t of bybitTickers.value) {
          bybitMap.set(t.symbol, t);
        }
      }

      // Find common symbols and compute spreads
      const commonSymbols = [...binanceMap.keys()].filter(s => bybitMap.has(s));

      for (const symbol of commonSymbols) {
        const binance = binanceMap.get(symbol);
        const bybit = bybitMap.get(symbol);

        const binanceFunding = binance.fundingRate || 0;
        const bybitFunding = bybit.fundingRate || 0;
        const spread = binanceFunding - bybitFunding;
        const spreadBps = Math.round(spread * 10000 * 100) / 100; // Basis points

        // Record to history
        if (!this._history.has(symbol)) this._history.set(symbol, []);
        const hist = this._history.get(symbol);
        hist.push({
          binance: binanceFunding,
          bybit: bybitFunding,
          spread: spreadBps,
          time: Date.now(),
        });
        if (hist.length > HISTORY_LENGTH) hist.shift();

        // Check for opportunities
        // 1. Cross-exchange spread
        if (Math.abs(spreadBps) >= SPREAD_THRESHOLD_BPS) {
          const opp = {
            type: OPP_TYPE.CROSS_EXCHANGE_SPREAD,
            symbol,
            binanceFunding: Math.round(binanceFunding * 10000) / 100, // As percentage
            bybitFunding: Math.round(bybitFunding * 10000) / 100,
            spreadBps,
            direction: spreadBps > 0 ? 'short_binance_long_bybit' : 'short_bybit_long_binance',
            timestamp: Date.now(),
          };
          newOpps.push(opp);
        }

        // 2. Extreme funding (contrarian signal)
        const maxFunding = Math.max(Math.abs(binanceFunding), Math.abs(bybitFunding));
        if (maxFunding >= EXTREME_FUNDING_THRESHOLD) {
          const direction = binanceFunding > 0 ? 'longs_paying' : 'shorts_paying';
          newOpps.push({
            type: OPP_TYPE.EXTREME_FUNDING,
            symbol,
            fundingRate: Math.round(maxFunding * 10000 * (binanceFunding > 0 ? 1 : -1)) / 100,
            direction,
            contrarian: direction === 'longs_paying' ? 'bearish' : 'bullish',
            exchange: Math.abs(binanceFunding) > Math.abs(bybitFunding) ? 'binance' : 'bybit',
            timestamp: Date.now(),
          });
        }

        // 3. Funding reversal (trend change)
        if (hist.length >= 6) {
          const recent3 = hist.slice(-3);
          const prev3 = hist.slice(-6, -3);
          const recentAvg = recent3.reduce((s, h) => s + h.binance, 0) / 3;
          const prevAvg = prev3.reduce((s, h) => s + h.binance, 0) / 3;

          if (Math.sign(recentAvg) !== Math.sign(prevAvg) && Math.abs(recentAvg) > 0.0001) {
            newOpps.push({
              type: OPP_TYPE.FUNDING_REVERSAL,
              symbol,
              previousDirection: prevAvg > 0 ? 'positive' : 'negative',
              newDirection: recentAvg > 0 ? 'positive' : 'negative',
              currentRate: Math.round(recentAvg * 10000) / 100,
              timestamp: Date.now(),
            });
          }
        }
      }

      // Update opportunities list
      this._opportunities = newOpps;
      if (this._opportunities.length > MAX_OPPORTUNITIES) {
        this._opportunities = this._opportunities.slice(0, MAX_OPPORTUNITIES);
      }

      // Notify listeners
      for (const opp of newOpps) {
        this._emit(opp);
      }

    } catch (err) {
      logger.data.warn('[FundingScanner] Scan failed:', err.message);
    }

    return newOpps;
  }

  /** @private — Fetch Binance funding rates */
  async _fetchBinanceFunding() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(BINANCE_TICKER_URL, { signal: controller.signal });
      const data = await res.json();
      return data.map(t => ({
        symbol: t.symbol,
        fundingRate: parseFloat(t.lastFundingRate) || 0,
        markPrice: parseFloat(t.markPrice) || 0,
        nextFundingTime: parseInt(t.nextFundingTime) || 0,
      }));
    } finally {
      clearTimeout(timer);
    }
  }

  /** @private */
  _emit(opportunity) {
    for (const cb of this._alertCallbacks) {
      try { cb(opportunity); } catch { /* ignore */ }
    }
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const fundingScanner = new _FundingArbitrageScanner();
export default fundingScanner;
