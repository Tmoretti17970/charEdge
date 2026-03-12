// ═══════════════════════════════════════════════════════════════════
// charEdge — Backtest Engine
//
// Single-symbol strategy backtester. Evaluates a strategy callback
// against historical OHLCV bars and produces comprehensive
// performance metrics including equity curve, trade list, and
// risk-adjusted return statistics.
//
// Usage:
//   const result = runBacktest(bars, strategy, config);
//   // result.metrics  → { netPnL, winRate, sharpe, maxDD, ... }
//   // result.trades   → [{ entry, exit, pnl, side, ... }, ...]
//   // result.equity   → [10000, 10050, 9980, ...]
// ═══════════════════════════════════════════════════════════════════

import { Calc } from '../model/Calc.js';
// #10: Single source of truth for risk-adjusted metrics
import { sharpeRatio as _sharpeRatio, sortinoRatio as _sortinoRatio } from '../../trading/QuantMetrics';

// ─── Default Configuration ───────────────────────────────────────

const DEFAULT_CONFIG = {
  initialCapital: 10000,
  commissionPerTrade: 0,      // Flat fee per trade
  commissionPercent: 0,       // Percentage of trade value
  slippageTicks: 0,           // Slippage in price ticks
  slippagePercent: 0,         // Slippage as percentage
  maxOpenPositions: 1,        // Simultaneous positions
  positionSizePercent: 100,   // % of equity to use per trade
  riskPerTradePercent: 0,     // Risk-based sizing (0 = disabled)
};

// ─── Strategy Signal Constants ───────────────────────────────────

export const SIGNAL = {
  NONE: 0,
  LONG: 1,
  SHORT: -1,
  CLOSE: 2,
};

// ─── Position Tracker ────────────────────────────────────────────

class Position {
  constructor(side, entryPrice, entryTime, entryIdx, size, stopLoss, takeProfit) {
    this.side = side;           // 'long' | 'short'
    this.entryPrice = entryPrice;
    this.entryTime = entryTime;
    this.entryIdx = entryIdx;
    this.size = size;           // Number of units/contracts
    this.stopLoss = stopLoss || null;
    this.takeProfit = takeProfit || null;
    this.exitPrice = null;
    this.exitTime = null;
    this.exitIdx = null;
    this.exitReason = null;     // 'signal' | 'stop_loss' | 'take_profit'
    this.pnl = 0;
    this.pnlPercent = 0;
    this.rMultiple = null;
  }

  close(exitPrice, exitTime, exitIdx, reason) {
    this.exitPrice = exitPrice;
    this.exitTime = exitTime;
    this.exitIdx = exitIdx;
    this.exitReason = reason;

    const rawPnl = this.side === 'long'
      ? (exitPrice - this.entryPrice) * this.size
      : (this.entryPrice - exitPrice) * this.size;
    this.pnl = rawPnl;
    this.pnlPercent = ((exitPrice - this.entryPrice) / this.entryPrice) * 100 * (this.side === 'short' ? -1 : 1);

    if (this.stopLoss) {
      const risk = Math.abs(this.entryPrice - this.stopLoss) * this.size;
      this.rMultiple = risk > 0 ? rawPnl / risk : null;
    }
  }

  get isOpen() { return this.exitPrice === null; }
  get isWin() { return this.pnl > 0; }
  get holdingBars() {
    return this.exitIdx !== null ? this.exitIdx - this.entryIdx : 0;
  }
}

// ─── Core Backtest Runner ────────────────────────────────────────

/**
 * Run a strategy backtest against historical bar data.
 *
 * @param {Object[]} bars - Array of { open, high, low, close, volume, time }
 * @param {Object} strategy - Strategy object with:
 *   - name {string} - Strategy name
 *   - onBar(bar, index, context) → { signal, stopLoss?, takeProfit? }
 *   - init?(bars) - Optional initialization (precompute indicators)
 * @param {Object} [config] - Backtest configuration (see DEFAULT_CONFIG)
 * @returns {BacktestResult}
 */
export function runBacktest(bars, strategy, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = performance.now();

  if (!bars || bars.length < 2) {
    return createEmptyResult('Insufficient data');
  }

  // ─── State ──────────────────────────────────────────────────────
  let equity = cfg.initialCapital;
  const equityCurve = [equity];
  const trades = [];
  let openPosition = null;
  let peakEquity = equity;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;

  // Precompute indicator data if strategy has init
  let strategyState = {};
  if (strategy.init) {
    try {
      strategyState = strategy.init(bars) || {};
    } catch (e) {
      return createEmptyResult(`Strategy init error: ${e.message}`);
    }
  }

  // ─── Context object passed to strategy.onBar ────────────────────
  const context = {
    bars,
    equity: cfg.initialCapital,
    position: null,
    barIndex: 0,
    state: strategyState,
    // Indicator helper shortcuts
    sma: (src, period) => Calc.sma(src, period),
    ema: (src, period) => Calc.ema(src, period),
    atr: (barsData, period) => Calc.atr(barsData, period),
    rsi: (src, period) => Calc.rsi(src, period),
    highest: (src, period) => Calc.highest(src, period),
    lowest: (src, period) => Calc.lowest(src, period),
  };

  // ─── Bar-by-bar simulation ──────────────────────────────────────

  for (let i = 1; i < bars.length; i++) {
    const bar = bars[i];
    const _prevBar = bars[i - 1];
    context.barIndex = i;
    context.equity = equity;
    context.position = openPosition ? {
      side: openPosition.side,
      entryPrice: openPosition.entryPrice,
      unrealizedPnl: openPosition.side === 'long'
        ? (bar.close - openPosition.entryPrice) * openPosition.size
        : (openPosition.entryPrice - bar.close) * openPosition.size,
    } : null;

    // ─── Check stop loss / take profit on open position ───────────
    if (openPosition) {
      let hitStop = false;
      let hitTP = false;

      if (openPosition.side === 'long') {
        if (openPosition.stopLoss && bar.low <= openPosition.stopLoss) hitStop = true;
        if (openPosition.takeProfit && bar.high >= openPosition.takeProfit) hitTP = true;
      } else {
        if (openPosition.stopLoss && bar.high >= openPosition.stopLoss) hitStop = true;
        if (openPosition.takeProfit && bar.low <= openPosition.takeProfit) hitTP = true;
      }

      if (hitStop) {
        const slippage = applySlippage(openPosition.stopLoss, openPosition.side === 'long' ? -1 : 1, cfg);
        openPosition.close(slippage, bar.time, i, 'stop_loss');
        equity += openPosition.pnl - getCommission(openPosition, cfg);
        trades.push(openPosition);
        openPosition = null;
      } else if (hitTP) {
        const slippage = applySlippage(openPosition.takeProfit, openPosition.side === 'long' ? 1 : -1, cfg);
        openPosition.close(slippage, bar.time, i, 'take_profit');
        equity += openPosition.pnl - getCommission(openPosition, cfg);
        trades.push(openPosition);
        openPosition = null;
      }
    }

    // ─── Get strategy signal ──────────────────────────────────────
    let signal;
    try {
      signal = strategy.onBar(bar, i, context);
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_e) {
      // Strategy error on this bar — skip
      equityCurve.push(equity);
      continue;
    }

    if (!signal) {
      // Update equity with unrealized P&L for curve
      const unrealized = openPosition
        ? (openPosition.side === 'long'
          ? (bar.close - openPosition.entryPrice) * openPosition.size
          : (openPosition.entryPrice - bar.close) * openPosition.size)
        : 0;
      equityCurve.push(equity + unrealized);
      updateDrawdown();
      continue;
    }

    const sig = signal.signal || signal;

    // ─── Close existing position ──────────────────────────────────
    if (sig === SIGNAL.CLOSE || (sig === SIGNAL.LONG && openPosition?.side === 'short') || (sig === SIGNAL.SHORT && openPosition?.side === 'long')) {
      if (openPosition) {
        const exitPrice = applySlippage(bar.open, openPosition.side === 'long' ? -1 : 1, cfg);
        openPosition.close(exitPrice, bar.time, i, 'signal');
        equity += openPosition.pnl - getCommission(openPosition, cfg);
        trades.push(openPosition);
        openPosition = null;
      }
    }

    // ─── Open new position ────────────────────────────────────────
    if ((sig === SIGNAL.LONG || sig === SIGNAL.SHORT) && !openPosition) {
      const side = sig === SIGNAL.LONG ? 'long' : 'short';
      const entryPrice = applySlippage(bar.open, side === 'long' ? 1 : -1, cfg);
      const positionValue = equity * (cfg.positionSizePercent / 100);
      const size = positionValue / entryPrice;
      const commission = getCommission({ entryPrice, size }, cfg);
      equity -= commission;

      openPosition = new Position(
        side, entryPrice, bar.time, i, size,
        signal.stopLoss || null,
        signal.takeProfit || null,
      );
    }

    // Update equity curve with unrealized P&L
    const unrealized = openPosition
      ? (openPosition.side === 'long'
        ? (bar.close - openPosition.entryPrice) * openPosition.size
        : (openPosition.entryPrice - bar.close) * openPosition.size)
      : 0;
    equityCurve.push(equity + unrealized);
    updateDrawdown();
  }

  // ─── Close any remaining position at last bar's close ───────────
  if (openPosition) {
    const lastBar = bars[bars.length - 1];
    openPosition.close(lastBar.close, lastBar.time, bars.length - 1, 'end_of_data');
    equity += openPosition.pnl - getCommission(openPosition, cfg);
    trades.push(openPosition);
    openPosition = null;
    equityCurve[equityCurve.length - 1] = equity;
  }

  function updateDrawdown() {
    const currentEquity = equityCurve[equityCurve.length - 1];
    if (currentEquity > peakEquity) peakEquity = currentEquity;
    const dd = peakEquity - currentEquity;
    const ddPct = peakEquity > 0 ? (dd / peakEquity) * 100 : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
    if (ddPct > maxDrawdownPercent) maxDrawdownPercent = ddPct;
  }

  // ─── Compute Metrics ───────────────────────────────────────────
  const execMs = performance.now() - startTime;
  const metrics = computeMetrics(trades, equityCurve, cfg, execMs);

  return {
    success: true,
    strategy: strategy.name || 'Unnamed Strategy',
    config: cfg,
    trades: trades.map(t => ({
      side: t.side,
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice,
      entryTime: t.entryTime,
      exitTime: t.exitTime,
      entryIdx: t.entryIdx,
      exitIdx: t.exitIdx,
      pnl: round2(t.pnl),
      pnlPercent: round2(t.pnlPercent),
      rMultiple: t.rMultiple !== null ? round2(t.rMultiple) : null,
      holdingBars: t.holdingBars,
      exitReason: t.exitReason,
      isWin: t.isWin,
    })),
    equity: equityCurve,
    metrics,
  };
}

// ─── Metrics Computation ─────────────────────────────────────────

function computeMetrics(trades, equityCurve, cfg, execMs) {
  const totalTrades = trades.length;
  if (totalTrades === 0) {
    return {
      totalTrades: 0, netPnL: 0, netPnLPercent: 0,
      winRate: 0, lossRate: 0,
      avgWin: 0, avgLoss: 0, avgTrade: 0,
      profitFactor: 0, expectancy: 0,
      maxDrawdown: 0, maxDrawdownPercent: 0,
      sharpeRatio: 0, sortinoRatio: 0, calmarRatio: 0,
      maxConsecutiveWins: 0, maxConsecutiveLosses: 0,
      avgHoldingBars: 0, longestTrade: 0, shortestTrade: 0,
      longTrades: 0, shortTrades: 0, longWinRate: 0, shortWinRate: 0,
      totalReturn: 0, annualizedReturn: 0,
      execMs: round2(execMs),
    };
  }

  const wins = trades.filter(t => t.isWin);
  const losses = trades.filter(t => !t.isWin);
  const longs = trades.filter(t => t.side === 'long');
  const shorts = trades.filter(t => t.side === 'short');

  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const netPnL = grossProfit - grossLoss;
  const netPnLPercent = (netPnL / cfg.initialCapital) * 100;

  // Win/loss rate
  const winRate = (wins.length / totalTrades) * 100;
  const lossRate = (losses.length / totalTrades) * 100;

  // Averages
  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
  const avgTrade = netPnL / totalTrades;

  // Profit Factor
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  // Expectancy (avg win * win rate - avg loss * loss rate)
  const expectancy = (avgWin * (winRate / 100)) - (avgLoss * (lossRate / 100));

  // Drawdown
  let peakEq = equityCurve[0];
  let maxDD = 0, maxDDPct = 0;
  for (const eq of equityCurve) {
    if (eq > peakEq) peakEq = eq;
    const dd = peakEq - eq;
    const ddPct = peakEq > 0 ? (dd / peakEq) * 100 : 0;
    if (dd > maxDD) maxDD = dd;
    if (ddPct > maxDDPct) maxDDPct = ddPct;
  }

  // #10: Sharpe/Sortino — delegated to QuantMetrics (single source of truth)
  const returns = [];
  for (let i = 1; i < equityCurve.length; i++) {
    returns.push((equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1]);
  }
  const sharpeRatio = _sharpeRatio(returns, 0.04, 252);
  const sortinoRatio = _sortinoRatio(returns, 0.04, 252);

  // Calmar Ratio
  const totalReturn = netPnLPercent;
  const calmarRatio = maxDDPct > 0 ? totalReturn / maxDDPct : 0;

  // Consecutive wins/losses
  let consWins = 0, consLosses = 0, maxConsWins = 0, maxConsLosses = 0;
  for (const t of trades) {
    if (t.isWin) {
      consWins++;
      consLosses = 0;
      if (consWins > maxConsWins) maxConsWins = consWins;
    } else {
      consLosses++;
      consWins = 0;
      if (consLosses > maxConsLosses) maxConsLosses = consLosses;
    }
  }

  // Holding periods
  const holdingBars = trades.map(t => t.holdingBars);
  const avgHoldingBars = holdingBars.reduce((s, h) => s + h, 0) / totalTrades;

  return {
    totalTrades,
    netPnL: round2(netPnL),
    netPnLPercent: round2(netPnLPercent),
    grossProfit: round2(grossProfit),
    grossLoss: round2(grossLoss),
    winRate: round2(winRate),
    lossRate: round2(lossRate),
    wins: wins.length,
    losses: losses.length,
    avgWin: round2(avgWin),
    avgLoss: round2(avgLoss),
    avgTrade: round2(avgTrade),
    profitFactor: round2(profitFactor),
    expectancy: round2(expectancy),
    maxDrawdown: round2(maxDD),
    maxDrawdownPercent: round2(maxDDPct),
    sharpeRatio: round2(sharpeRatio),
    sortinoRatio: round2(sortinoRatio),
    calmarRatio: round2(calmarRatio),
    maxConsecutiveWins: maxConsWins,
    maxConsecutiveLosses: maxConsLosses,
    avgHoldingBars: round2(avgHoldingBars),
    // #11: Safe reduce instead of Math.max/min(...spread) to avoid stack overflow
    longestTrade: holdingBars.reduce((a, b) => a > b ? a : b, 0),
    shortestTrade: holdingBars.reduce((a, b) => a < b ? a : b, Infinity),
    longTrades: longs.length,
    shortTrades: shorts.length,
    longWinRate: longs.length > 0 ? round2((longs.filter(t => t.isWin).length / longs.length) * 100) : 0,
    shortWinRate: shorts.length > 0 ? round2((shorts.filter(t => t.isWin).length / shorts.length) * 100) : 0,
    totalReturn: round2(totalReturn),
    execMs: round2(execMs),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────

function applySlippage(price, direction, cfg) {
  // direction: 1 = slippage against buyer, -1 = against seller
  const tickSlip = price * (cfg.slippagePercent / 100) + cfg.slippageTicks * 0.01;
  return price + (tickSlip * direction);
}

function getCommission(position, cfg) {
  const value = position.entryPrice * position.size;
  return cfg.commissionPerTrade + (value * cfg.commissionPercent / 100);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function createEmptyResult(error) {
  return {
    success: false,
    error,
    strategy: '',
    config: DEFAULT_CONFIG,
    trades: [],
    equity: [],
    metrics: computeMetrics([], [], DEFAULT_CONFIG, 0),
  };
}

// ─── Built-in Strategy Presets ───────────────────────────────────

export const PRESET_STRATEGIES = {
  sma_crossover: {
    name: 'SMA Crossover (20/50)',
    description: 'Buys when fast SMA crosses above slow SMA, sells on cross below.',
    init(bars) {
      const closes = bars.map(b => b.close);
      return {
        fastSMA: Calc.sma(closes, 20),
        slowSMA: Calc.sma(closes, 50),
      };
    },
    onBar(bar, idx, ctx) {
      const { fastSMA, slowSMA } = ctx.state;
      if (idx < 51 || !fastSMA[idx] || !slowSMA[idx]) return null;

      const fastNow = fastSMA[idx];
      const fastPrev = fastSMA[idx - 1];
      const slowNow = slowSMA[idx];
      const slowPrev = slowSMA[idx - 1];

      // Golden cross → long
      if (fastPrev <= slowPrev && fastNow > slowNow) {
        return { signal: SIGNAL.LONG };
      }
      // Death cross → close
      if (fastPrev >= slowPrev && fastNow < slowNow) {
        return { signal: SIGNAL.CLOSE };
      }
      return null;
    },
  },

  rsi_mean_reversion: {
    name: 'RSI Mean Reversion',
    description: 'Buys when RSI drops below 30, sells when RSI rises above 70.',
    init(bars) {
      const closes = bars.map(b => b.close);
      return { rsi: Calc.rsi(closes, 14) };
    },
    onBar(bar, idx, ctx) {
      const { rsi } = ctx.state;
      if (idx < 15 || !rsi[idx]) return null;

      if (rsi[idx] < 30 && !ctx.position) {
        return { signal: SIGNAL.LONG, stopLoss: bar.close * 0.97, takeProfit: bar.close * 1.06 };
      }
      if (rsi[idx] > 70 && ctx.position) {
        return { signal: SIGNAL.CLOSE };
      }
      return null;
    },
  },

  breakout: {
    name: 'Donchian Breakout (20)',
    description: 'Buys on 20-bar high breakout, sells on 20-bar low breakdown.',
    init(bars) {
      const h = bars.map(b => b.high);
      const l = bars.map(b => b.low);
      return {
        highest: Calc.highest(h, 20),
        lowest: Calc.lowest(l, 20),
      };
    },
    onBar(bar, idx, ctx) {
      const { highest, lowest } = ctx.state;
      if (idx < 21) return null;

      const prevHigh = highest[idx - 1];
      const prevLow = lowest[idx - 1];

      if (bar.close > prevHigh && !ctx.position) {
        return { signal: SIGNAL.LONG, stopLoss: prevLow };
      }
      if (bar.close < prevLow && ctx.position) {
        return { signal: SIGNAL.CLOSE };
      }
      return null;
    },
  },

  ema_trend_follow: {
    name: 'EMA Trend Follow (9/21)',
    description: 'Long when 9 EMA above 21 EMA and price above both. Exits on cross below.',
    init(bars) {
      const closes = bars.map(b => b.close);
      return {
        ema9: Calc.ema(closes, 9),
        ema21: Calc.ema(closes, 21),
      };
    },
    onBar(bar, idx, ctx) {
      const { ema9, ema21 } = ctx.state;
      if (idx < 22 || !ema9[idx] || !ema21[idx]) return null;

      const fast = ema9[idx];
      const slow = ema21[idx];
      const fastPrev = ema9[idx - 1];
      const slowPrev = ema21[idx - 1];

      if (fastPrev <= slowPrev && fast > slow && bar.close > fast) {
        return { signal: SIGNAL.LONG };
      }
      if (fast < slow && ctx.position) {
        return { signal: SIGNAL.CLOSE };
      }
      return null;
    },
  },

  macd_crossover: {
    name: 'MACD Crossover',
    description: 'Long on MACD line crossing above signal, exit on cross below.',
    init(bars) {
      const closes = bars.map(b => b.close);
      return { macd: Calc.macd(closes, 12, 26, 9) };
    },
    onBar(bar, idx, ctx) {
      const { macd: m } = ctx.state;
      if (idx < 27 || !m.macd[idx] || !m.signal[idx]) return null;

      const macdNow = m.macd[idx];
      const macdPrev = m.macd[idx - 1];
      const sigNow = m.signal[idx];
      const sigPrev = m.signal[idx - 1];

      if (macdPrev <= sigPrev && macdNow > sigNow) {
        return { signal: SIGNAL.LONG };
      }
      if (macdPrev >= sigPrev && macdNow < sigNow && ctx.position) {
        return { signal: SIGNAL.CLOSE };
      }
      return null;
    },
  },
};

export { DEFAULT_CONFIG };
