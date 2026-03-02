// ═══════════════════════════════════════════════════════════════════
// charEdge — Walk-Forward & Monte Carlo Analysis
//
// Walk-Forward: Splits data into in-sample (optimize) and
// out-of-sample (validate) windows to prevent overfitting.
//
// Monte Carlo: Randomizes trade order and adds random noise to
// simulate thousands of possible outcomes, producing confidence
// intervals for key metrics.
// ═══════════════════════════════════════════════════════════════════

import { runBacktest } from './BacktestEngine.js';

// ─── Walk-Forward Analysis ───────────────────────────────────────

/**
 * Perform walk-forward analysis by splitting bars into windows.
 *
 * @param {Object[]} bars - Full OHLCV dataset
 * @param {Object} strategy - Strategy to test
 * @param {Object} config - Backtest config
 * @param {Object} [options]
 * @param {number} [options.numFolds=5] - Number of out-of-sample folds
 * @param {number} [options.inSampleRatio=0.7] - Ratio of in-sample data
 * @returns {WalkForwardResult}
 */
export function walkForwardAnalysis(bars, strategy, config = {}, options = {}) {
  const { numFolds = 5, inSampleRatio = 0.7 } = options;

  if (!bars?.length || bars.length < 100) {
    return { success: false, error: 'Need at least 100 bars for walk-forward analysis' };
  }

  const foldSize = Math.floor(bars.length / numFolds);
  const folds = [];

  for (let i = 0; i < numFolds; i++) {
    const foldStart = i * foldSize;
    const foldEnd = Math.min(foldStart + foldSize, bars.length);
    const foldBars = bars.slice(foldStart, foldEnd);

    const splitIdx = Math.floor(foldBars.length * inSampleRatio);
    const inSample = foldBars.slice(0, splitIdx);
    const outOfSample = foldBars.slice(splitIdx);

    const isResult = runBacktest(inSample, strategy, config);
    const oosResult = runBacktest(outOfSample, strategy, config);

    folds.push({
      fold: i + 1,
      inSample: {
        bars: inSample.length,
        ...(isResult.success ? {
          netPnL: isResult.metrics.netPnL,
          winRate: isResult.metrics.winRate,
          sharpe: isResult.metrics.sharpeRatio,
          trades: isResult.metrics.totalTrades,
        } : { error: isResult.error }),
      },
      outOfSample: {
        bars: outOfSample.length,
        ...(oosResult.success ? {
          netPnL: oosResult.metrics.netPnL,
          winRate: oosResult.metrics.winRate,
          sharpe: oosResult.metrics.sharpeRatio,
          trades: oosResult.metrics.totalTrades,
        } : { error: oosResult.error }),
      },
    });
  }

  // Aggregate OOS results
  const oosResults = folds.filter(f => f.outOfSample.netPnL != null);
  const oosPnLs = oosResults.map(f => f.outOfSample.netPnL);

  const avgOosPnL = oosPnLs.length ? oosPnLs.reduce((s, v) => s + v, 0) / oosPnLs.length : 0;
  const avgOosWinRate = oosResults.length
    ? oosResults.reduce((s, f) => s + f.outOfSample.winRate, 0) / oosResults.length : 0;

  // Consistency: how many OOS folds are profitable
  const profitableFolds = oosPnLs.filter(p => p > 0).length;

  // Efficiency ratio: OOS performance / IS performance
  const isPnLs = folds.filter(f => f.inSample.netPnL != null).map(f => f.inSample.netPnL);
  const avgIsPnL = isPnLs.length ? isPnLs.reduce((s, v) => s + v, 0) / isPnLs.length : 1;
  const efficiencyRatio = avgIsPnL !== 0 ? avgOosPnL / avgIsPnL : 0;

  return {
    success: true,
    numFolds,
    inSampleRatio,
    folds,
    aggregate: {
      avgOosPnL: Math.round(avgOosPnL * 100) / 100,
      avgOosWinRate: Math.round(avgOosWinRate * 100) / 100,
      profitableFolds,
      totalFolds: numFolds,
      consistencyScore: Math.round((profitableFolds / numFolds) * 100),
      efficiencyRatio: Math.round(efficiencyRatio * 100) / 100,
      isOverfit: efficiencyRatio < 0.3,
    },
  };
}

// ─── Monte Carlo Simulation ──────────────────────────────────────

/**
 * Run Monte Carlo simulation on backtest results.
 * Randomizes trade order and applies noise to estimate
 * confidence intervals for key metrics.
 *
 * @param {Object} backtestResult - Result from runBacktest()
 * @param {Object} [options]
 * @param {number} [options.simulations=1000]
 * @param {number} [options.noisePercent=5] - Random P&L noise %
 * @param {number} [options.confidenceLevel=95]
 * @returns {MonteCarloResult}
 */
export function monteCarloSimulation(backtestResult, options = {}) {
  const { simulations = 1000, noisePercent = 5, confidenceLevel = 95 } = options;

  if (!backtestResult?.trades?.length) {
    return { success: false, error: 'No trades to simulate' };
  }

  const trades = backtestResult.trades;
  const initialCapital = backtestResult.config?.initialCapital || 10000;

  const finalEquities = [];
  const maxDrawdowns = [];
  const winRates = [];
  const sharpeRatios = [];

  for (let sim = 0; sim < simulations; sim++) {
    // Shuffle trades (Fisher-Yates)
    const shuffled = [...trades];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Run equity curve with noise
    let equity = initialCapital;
    let peak = equity;
    let maxDD = 0;
    let wins = 0;
    const returns = [];

    for (const trade of shuffled) {
      // Add random noise to P&L
      const noise = 1 + (Math.random() - 0.5) * 2 * (noisePercent / 100);
      const pnl = (trade.pnl || 0) * noise;

      const prevEquity = equity;
      equity += pnl;
      if (equity > peak) peak = equity;
      const dd = peak > 0 ? (peak - equity) / peak : 0;
      if (dd > maxDD) maxDD = dd;

      if (pnl > 0) wins++;
      if (prevEquity > 0) returns.push(pnl / prevEquity);
    }

    finalEquities.push(equity);
    maxDrawdowns.push(maxDD * 100);
    winRates.push(trades.length > 0 ? (wins / trades.length) * 100 : 0);

    // Sharpe
    if (returns.length > 1) {
      const avg = returns.reduce((s, v) => s + v, 0) / returns.length;
      const std = Math.sqrt(returns.reduce((s, v) => s + (v - avg) ** 2, 0) / (returns.length - 1));
      sharpeRatios.push(std > 0 ? (avg / std) * Math.sqrt(252) : 0);
    }
  }

  // Sort for percentile calculations
  finalEquities.sort((a, b) => a - b);
  maxDrawdowns.sort((a, b) => a - b);

  const pctIdx = (arr, pct) => arr[Math.floor(arr.length * pct / 100)] || 0;
  const lower = (100 - confidenceLevel) / 2;
  const upper = 100 - lower;

  return {
    success: true,
    simulations,
    noisePercent,
    confidenceLevel,
    equity: {
      mean: Math.round((finalEquities.reduce((s, v) => s + v, 0) / finalEquities.length) * 100) / 100,
      median: Math.round(pctIdx(finalEquities, 50) * 100) / 100,
      worst: Math.round(finalEquities[0] * 100) / 100,
      best: Math.round(finalEquities[finalEquities.length - 1] * 100) / 100,
      ci: [
        Math.round(pctIdx(finalEquities, lower) * 100) / 100,
        Math.round(pctIdx(finalEquities, upper) * 100) / 100,
      ],
      probabilityOfProfit: Math.round((finalEquities.filter(e => e > initialCapital).length / simulations) * 10000) / 100,
    },
    drawdown: {
      mean: Math.round((maxDrawdowns.reduce((s, v) => s + v, 0) / maxDrawdowns.length) * 100) / 100,
      worst: Math.round(maxDrawdowns[maxDrawdowns.length - 1] * 100) / 100,
      ci: [
        Math.round(pctIdx(maxDrawdowns, lower) * 100) / 100,
        Math.round(pctIdx(maxDrawdowns, upper) * 100) / 100,
      ],
    },
    winRate: {
      mean: Math.round((winRates.reduce((s, v) => s + v, 0) / winRates.length) * 100) / 100,
    },
    sharpe: {
      mean: sharpeRatios.length
        ? Math.round((sharpeRatios.reduce((s, v) => s + v, 0) / sharpeRatios.length) * 100) / 100
        : 0,
    },
    distribution: {
      equityBins: buildHistogram(finalEquities, 20),
      drawdownBins: buildHistogram(maxDrawdowns, 20),
    },
  };
}

// ─── Histogram Helper ────────────────────────────────────────────

function buildHistogram(values, numBins) {
  if (!values.length) return [];
  const min = values[0];
  const max = values[values.length - 1];
  const range = max - min || 1;
  const binSize = range / numBins;

  const bins = [];
  for (let i = 0; i < numBins; i++) {
    bins.push({
      min: min + i * binSize,
      max: min + (i + 1) * binSize,
      count: 0,
    });
  }

  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binSize), numBins - 1);
    bins[idx].count++;
  }

  const maxCount = Math.max(...bins.map(b => b.count));
  for (const b of bins) {
    b.normalized = maxCount > 0 ? b.count / maxCount : 0;
  }

  return bins;
}
