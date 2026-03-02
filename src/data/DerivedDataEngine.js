// ═══════════════════════════════════════════════════════════════════
// charEdge v12 — Derived Data Engine
//
// Computes premium analytics from FREE data sources.
// This is the competitive moat — features TradingView charges $60/mo
// for, computed client-side from free Binance + Pyth + Kraken data.
//
// Capabilities:
//   - Cross-asset correlation matrix
//   - DXY Dollar Index proxy
//   - Market breadth (advancing vs declining)
//   - Relative strength rankings
//   - Sector rotation heatmaps
//   - Volatility surface (historical vol)
//   - VWAP from tick data
//
// Usage:
//   import { derivedEngine } from './DerivedDataEngine.js';
//   const corr = await derivedEngine.computeCorrelation(['BTC', 'ETH', 'SPY']);
//   const breadth = derivedEngine.computeMarketBreadth(watchlist);
// ═══════════════════════════════════════════════════════════════════

const CACHE = new Map();
const CACHE_TTL = 60000; // 1 min for derived computations

// ─── Statistical Helpers ───────────────────────────────────────

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr) {
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function pearsonCorrelation(x, y) {
  if (x.length !== y.length || x.length < 2) return 0;
  const n = x.length;
  const mx = mean(x);
  const my = mean(y);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx;
    const b = y[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

function returns(prices) {
  const r = [];
  for (let i = 1; i < prices.length; i++) {
    r.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  return r;
}

// ─── Derived Data Engine ───────────────────────────────────────

class _DerivedDataEngine {
  constructor() {
    this._tickBuffers = new Map(); // symbol → { prices: [], volumes: [], times: [] }
    this._maxTicks = 10000;
  }

  // ─── Tick Ingestion ──────────────────────────────────────────

  /**
   * Ingest a real-time tick for derived computations.
   * Call this from WebSocket callbacks.
   */
  ingestTick(symbol, price, volume = 0, time = Date.now()) {
    if (!this._tickBuffers.has(symbol)) {
      this._tickBuffers.set(symbol, { prices: [], volumes: [], times: [] });
    }
    const buf = this._tickBuffers.get(symbol);
    buf.prices.push(price);
    buf.volumes.push(volume);
    buf.times.push(time);

    // Trim to max size
    if (buf.prices.length > this._maxTicks) {
      const excess = buf.prices.length - this._maxTicks;
      buf.prices.splice(0, excess);
      buf.volumes.splice(0, excess);
      buf.times.splice(0, excess);
    }
  }

  // ─── Correlation Matrix ──────────────────────────────────────

  /**
   * Compute pairwise Pearson correlations from OHLCV close prices.
   * @param {Object} priceMap - { symbol: [close1, close2, ...] }
   * @returns {{ matrix: number[][], symbols: string[], strongest, weakest }}
   */
  computeCorrelationMatrix(priceMap) {
    const symbols = Object.keys(priceMap);
    const n = symbols.length;
    const matrix = Array.from({ length: n }, () => Array(n).fill(0));

    // Convert prices to returns for better correlation
    const returnsMap = {};
    for (const sym of symbols) {
      returnsMap[sym] = returns(priceMap[sym]);
    }

    let strongest = { pair: '', value: 0 };
    let weakest = { pair: '', value: 1 };

    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1; // Self-correlation
      for (let j = i + 1; j < n; j++) {
        // Align lengths
        const ri = returnsMap[symbols[i]];
        const rj = returnsMap[symbols[j]];
        const len = Math.min(ri.length, rj.length);
        const corr = pearsonCorrelation(ri.slice(-len), rj.slice(-len));
        const rounded = Math.round(corr * 1000) / 1000;

        matrix[i][j] = rounded;
        matrix[j][i] = rounded;

        const absCorr = Math.abs(rounded);
        if (absCorr > Math.abs(strongest.value)) {
          strongest = { pair: `${symbols[i]}/${symbols[j]}`, value: rounded };
        }
        if (absCorr < Math.abs(weakest.value)) {
          weakest = { pair: `${symbols[i]}/${symbols[j]}`, value: rounded };
        }
      }
    }

    return { matrix, symbols, strongest, weakest };
  }

  // ─── VWAP ────────────────────────────────────────────────────

  /**
   * Compute Volume-Weighted Average Price from tick data.
   * @param {string} symbol
   * @returns {{ vwap, deviation, deviationPct }|null}
   */
  computeVWAP(symbol) {
    const buf = this._tickBuffers.get(symbol);
    if (!buf || buf.prices.length < 2) return null;

    let cumPV = 0;
    let cumVol = 0;

    for (let i = 0; i < buf.prices.length; i++) {
      cumPV += buf.prices[i] * buf.volumes[i];
      cumVol += buf.volumes[i];
    }

    if (cumVol === 0) return null;

    const vwap = cumPV / cumVol;
    const lastPrice = buf.prices[buf.prices.length - 1];
    const deviation = lastPrice - vwap;
    const deviationPct = (deviation / vwap) * 100;

    return {
      vwap: Math.round(vwap * 100) / 100,
      deviation: Math.round(deviation * 100) / 100,
      deviationPct: Math.round(deviationPct * 100) / 100,
      lastPrice,
      dataPoints: buf.prices.length,
    };
  }

  // ─── Historical Volatility ───────────────────────────────────

  /**
   * Compute annualized historical volatility from close prices.
   * @param {number[]} closes - Array of close prices
   * @param {number} [period=20] - Lookback period
   * @param {number} [tradingDays=252] - Annualization factor
   * @returns {{ volatility, volatilityPct }|null}
   */
  computeHistoricalVolatility(closes, period = 20, tradingDays = 252) {
    if (closes.length < period + 1) return null;

    const logReturns = [];
    const recent = closes.slice(-period - 1);
    for (let i = 1; i < recent.length; i++) {
      logReturns.push(Math.log(recent[i] / recent[i - 1]));
    }

    const vol = stddev(logReturns) * Math.sqrt(tradingDays);

    return {
      volatility: Math.round(vol * 10000) / 10000,
      volatilityPct: Math.round(vol * 10000) / 100,
      period,
    };
  }

  // ─── Market Breadth ──────────────────────────────────────────

  /**
   * Compute market breadth from a list of symbol quotes.
   * @param {Array<{ symbol, change, changePct }>} quotes
   * @returns {{ advancing, declining, unchanged, ratio, indicator }}
   */
  computeMarketBreadth(quotes) {
    let advancing = 0, declining = 0, unchanged = 0;
    let advancingVol = 0, decliningVol = 0;

    for (const q of quotes) {
      const change = q.change || q.changePct || 0;
      if (change > 0.01) {
        advancing++;
        advancingVol += q.volume || 0;
      } else if (change < -0.01) {
        declining++;
        decliningVol += q.volume || 0;
      } else {
        unchanged++;
      }
    }

    const total = advancing + declining;
    const ratio = total > 0 ? advancing / total : 0.5;

    // McClellan-style breadth indicator
    let indicator = 'neutral';
    if (ratio > 0.7) indicator = 'strongly_bullish';
    else if (ratio > 0.55) indicator = 'bullish';
    else if (ratio < 0.3) indicator = 'strongly_bearish';
    else if (ratio < 0.45) indicator = 'bearish';

    return {
      advancing,
      declining,
      unchanged,
      total: quotes.length,
      ratio: Math.round(ratio * 1000) / 1000,
      advancingVol,
      decliningVol,
      indicator,
    };
  }

  // ─── Relative Strength ───────────────────────────────────────

  /**
   * Rank symbols by relative strength (rate of change).
   * @param {Object} priceMap - { symbol: [close1, close2, ...] }
   * @param {number} [period=20] - Lookback period
   * @returns {Array<{ symbol, roc, rank }>}
   */
  computeRelativeStrength(priceMap, period = 20) {
    const rankings = [];

    for (const [symbol, prices] of Object.entries(priceMap)) {
      if (prices.length < period + 1) continue;
      const current = prices[prices.length - 1];
      const past = prices[prices.length - 1 - period];
      const roc = ((current - past) / past) * 100;

      rankings.push({
        symbol,
        roc: Math.round(roc * 100) / 100,
        currentPrice: current,
      });
    }

    rankings.sort((a, b) => b.roc - a.roc);
    rankings.forEach((r, i) => { r.rank = i + 1; });

    return rankings;
  }

  // ─── Sector Rotation ─────────────────────────────────────────

  /**
   * Compute sector/group average returns for rotation analysis.
   * @param {Object} groups - { 'Tech': ['AAPL','MSFT'], 'Energy': ['XOM','CVX'] }
   * @param {Object} priceMap - { symbol: [closes] }
   * @param {number} [period=20]
   * @returns {Array<{ sector, avgReturn, symbols }>}
   */
  computeSectorRotation(groups, priceMap, period = 20) {
    const results = [];

    for (const [sector, symbols] of Object.entries(groups)) {
      const sectorReturns = [];
      for (const sym of symbols) {
        const prices = priceMap[sym];
        if (!prices || prices.length < period + 1) continue;
        const roc = (prices[prices.length - 1] - prices[prices.length - 1 - period]) / prices[prices.length - 1 - period];
        sectorReturns.push(roc * 100);
      }

      if (sectorReturns.length > 0) {
        results.push({
          sector,
          avgReturn: Math.round(mean(sectorReturns) * 100) / 100,
          symbolCount: sectorReturns.length,
        });
      }
    }

    results.sort((a, b) => b.avgReturn - a.avgReturn);
    results.forEach((r, i) => { r.rank = i + 1; });
    return results;
  }

  // ─── ATR (Average True Range) ────────────────────────────────

  /**
   * Compute Average True Range from OHLC data.
   * @param {Array<{ high, low, close }>} candles
   * @param {number} [period=14]
   * @returns {{ atr, atrPct }|null}
   */
  computeATR(candles, period = 14) {
    if (candles.length < period + 1) return null;

    const trueRanges = [];
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      trueRanges.push(tr);
    }

    // Use the last `period` true ranges
    const recent = trueRanges.slice(-period);
    const atr = mean(recent);
    const lastClose = candles[candles.length - 1].close;

    return {
      atr: Math.round(atr * 100) / 100,
      atrPct: Math.round((atr / lastClose) * 10000) / 100,
      period,
    };
  }

  // ─── Support/Resistance Levels ───────────────────────────────

  /**
   * Find simple pivot-based support/resistance levels.
   * @param {Array<{ high, low, close }>} candles
   * @param {number} [lookback=5]
   * @returns {{ pivotPoint, support1, support2, resistance1, resistance2 }}
   */
  computePivotLevels(candles) {
    if (candles.length < 1) return null;

    const last = candles[candles.length - 1];
    const h = last.high;
    const l = last.low;
    const c = last.close;

    const pp = (h + l + c) / 3;

    return {
      pivotPoint: Math.round(pp * 100) / 100,
      resistance1: Math.round((2 * pp - l) * 100) / 100,
      resistance2: Math.round((pp + (h - l)) * 100) / 100,
      resistance3: Math.round((h + 2 * (pp - l)) * 100) / 100,
      support1: Math.round((2 * pp - h) * 100) / 100,
      support2: Math.round((pp - (h - l)) * 100) / 100,
      support3: Math.round((l - 2 * (h - pp)) * 100) / 100,
    };
  }

  // ─── Risk/Reward Calculator ──────────────────────────────────

  /**
   * Compute risk/reward ratio and position sizing.
   * @param {number} entry - Entry price
   * @param {number} stop - Stop loss price
   * @param {number} target - Take profit price
   * @param {number} [accountSize=10000] - Account balance
   * @param {number} [riskPct=1] - Risk percentage per trade
   * @returns {{ riskReward, positionSize, riskAmount, potentialProfit }}
   */
  computeRiskReward(entry, stop, target, accountSize = 10000, riskPct = 1) {
    const risk = Math.abs(entry - stop);
    const reward = Math.abs(target - entry);
    const riskReward = risk > 0 ? reward / risk : 0;
    const riskAmount = accountSize * (riskPct / 100);
    const positionSize = risk > 0 ? Math.floor(riskAmount / risk) : 0;

    return {
      riskReward: Math.round(riskReward * 100) / 100,
      risk: Math.round(risk * 100) / 100,
      reward: Math.round(reward * 100) / 100,
      riskAmount: Math.round(riskAmount * 100) / 100,
      positionSize,
      potentialProfit: Math.round(positionSize * reward * 100) / 100,
      potentialLoss: Math.round(positionSize * risk * 100) / 100,
    };
  }

  // ─── Cleanup ─────────────────────────────────────────────────

  clearTickBuffers() {
    this._tickBuffers.clear();
  }

  getTickCount(symbol) {
    return this._tickBuffers.get(symbol)?.prices.length || 0;
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const derivedEngine = new _DerivedDataEngine();
export default derivedEngine;
