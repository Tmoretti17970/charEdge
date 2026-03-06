// ═══════════════════════════════════════════════════════════════════
// charEdge — Quant Metrics (Tasks 4.4.1–2)
//
// Risk-adjusted return calculations:
//   - Sharpe Ratio  (excess return / total σ)
//   - Sortino Ratio (excess return / downside σ)
//   - Rolling windows for both
//
// All inputs are periodic returns (e.g. daily P&L / account equity).
// ═══════════════════════════════════════════════════════════════════

// ─── Constants ──────────────────────────────────────────────────

/** Default risk-free rate (annualized, e.g. 4% treasury yield) */
const DEFAULT_RF = 0.04;

/** Default annualization factor (252 trading days) */
const DEFAULT_PERIODS_PER_YEAR = 252;

// ─── Core Calculations ─────────────────────────────────────────

/**
 * Calculate the mean of a number array.
 */
export function mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate standard deviation (population).
 */
export function stdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const avg = mean(values);
    const squaredDiffs = values.map((v) => (v - avg) ** 2);
    return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length);
}

/**
 * Calculate downside deviation (only negative deviations from threshold).
 * Used in Sortino ratio — only penalizes downside risk.
 */
export function downsideDev(
    values: number[],
    threshold = 0,
): number {
    if (values.length < 2) return 0;
    const downsideSquared = values
        .map((v) => Math.min(0, v - threshold))
        .map((v) => v ** 2);
    return Math.sqrt(downsideSquared.reduce((sum, v) => sum + v, 0) / values.length);
}

// ─── Sharpe Ratio ───────────────────────────────────────────────

/**
 * Calculate the annualized Sharpe Ratio.
 *
 * Sharpe = (mean_return - rf_per_period) / σ_returns × √periods_per_year
 *
 * @param returns  - Array of periodic returns (e.g. daily P&L / equity)
 * @param riskFreeRate - Annualized risk-free rate (default: 4%)
 * @param periodsPerYear - Trading periods per year (default: 252)
 * @returns Annualized Sharpe ratio, or 0 if insufficient data
 */
export function sharpeRatio(
    returns: number[],
    riskFreeRate = DEFAULT_RF,
    periodsPerYear = DEFAULT_PERIODS_PER_YEAR,
): number {
    if (returns.length < 2) return 0;

    const rfPerPeriod = riskFreeRate / periodsPerYear;
    const excessReturns = returns.map((r) => r - rfPerPeriod);
    const avgExcess = mean(excessReturns);
    const sigma = stdDev(excessReturns);

    if (sigma === 0) return avgExcess >= 0 ? Infinity : -Infinity;

    return (avgExcess / sigma) * Math.sqrt(periodsPerYear);
}

// ─── Sortino Ratio ──────────────────────────────────────────────

/**
 * Calculate the annualized Sortino Ratio.
 *
 * Sortino = (mean_return - rf_per_period) / downside_σ × √periods_per_year
 *
 * Only penalizes downside deviation (below the minimum acceptable return).
 *
 * @param returns  - Array of periodic returns
 * @param riskFreeRate - Annualized risk-free rate (default: 4%)
 * @param periodsPerYear - Trading periods per year (default: 252)
 * @returns Annualized Sortino ratio, or 0 if insufficient data
 */
export function sortinoRatio(
    returns: number[],
    riskFreeRate = DEFAULT_RF,
    periodsPerYear = DEFAULT_PERIODS_PER_YEAR,
): number {
    if (returns.length < 2) return 0;

    const rfPerPeriod = riskFreeRate / periodsPerYear;
    const excessReturns = returns.map((r) => r - rfPerPeriod);
    const avgExcess = mean(excessReturns);
    const dsigma = downsideDev(excessReturns, 0);

    if (dsigma === 0) return avgExcess >= 0 ? Infinity : -Infinity;

    return (avgExcess / dsigma) * Math.sqrt(periodsPerYear);
}

// ─── Rolling Metrics ────────────────────────────────────────────

export interface RollingMetric {
    /** Window end index (inclusive) */
    index: number;
    /** Rolling Sharpe ratio */
    sharpe: number;
    /** Rolling Sortino ratio */
    sortino: number;
    /** Number of periods in this window */
    windowSize: number;
}

/**
 * Calculate rolling Sharpe + Sortino over a sliding window.
 *
 * @param returns - Full return series
 * @param windowSize - Rolling window size (default: 20)
 * @param riskFreeRate - Annualized risk-free rate
 * @param periodsPerYear - Periods per year
 * @returns Array of rolling metrics (one per valid window)
 */
export function rollingMetrics(
    returns: number[],
    windowSize = 20,
    riskFreeRate = DEFAULT_RF,
    periodsPerYear = DEFAULT_PERIODS_PER_YEAR,
): RollingMetric[] {
    if (returns.length < windowSize || windowSize < 2) return [];

    const results: RollingMetric[] = [];

    for (let i = windowSize - 1; i < returns.length; i++) {
        const window = returns.slice(i - windowSize + 1, i + 1);
        results.push({
            index: i,
            sharpe: sharpeRatio(window, riskFreeRate, periodsPerYear),
            sortino: sortinoRatio(window, riskFreeRate, periodsPerYear),
            windowSize,
        });
    }

    return results;
}

// ─── Convenience: Compute from P&L Array ────────────────────────

/**
 * Convert an array of P&L values into periodic returns.
 * Useful when you only have raw trade P&L amounts.
 *
 * @param pnlSeries - Array of cumulative P&L values
 * @param startingEquity - Starting account equity
 * @returns Array of periodic returns (percentage)
 */
export function pnlToReturns(
    pnlSeries: number[],
    startingEquity: number,
): number[] {
    if (pnlSeries.length < 2 || startingEquity <= 0) return [];

    const returns: number[] = [];
    let equity = startingEquity;

    for (let i = 0; i < pnlSeries.length; i++) {
        const curr = pnlSeries[i] ?? 0;
        const prev = i === 0 ? 0 : (pnlSeries[i - 1] ?? 0);
        const periodPnL = i === 0 ? curr : curr - prev;
        if (equity > 0) {
            returns.push(periodPnL / equity);
            equity += periodPnL;
        } else {
            returns.push(0);
        }
    }

    return returns;
}

// ─── Summary Function ───────────────────────────────────────────

export interface QuantSummary {
    sharpe: number;
    sortino: number;
    totalReturn: number;
    avgReturn: number;
    maxDrawdown: number;
    tradeCount: number;
}

/**
 * Compute a full quant summary from trade P&L history.
 */
export function computeQuantSummary(
    tradePnLs: number[],
    startingEquity = 10000,
    riskFreeRate = DEFAULT_RF,
): QuantSummary {
    if (tradePnLs.length === 0) {
        return {
            sharpe: 0,
            sortino: 0,
            totalReturn: 0,
            avgReturn: 0,
            maxDrawdown: 0,
            tradeCount: 0,
        };
    }

    // Build cumulative P&L series
    const cumulative: number[] = [];
    let running = 0;
    for (const pnl of tradePnLs) {
        running += pnl;
        cumulative.push(running);
    }

    const returns = pnlToReturns(cumulative, startingEquity);
    const totalReturn = running / startingEquity;
    const avgReturn = mean(tradePnLs);

    // Max drawdown
    let peak = 0;
    let maxDD = 0;
    for (const c of cumulative) {
        if (c > peak) peak = c;
        const dd = peak > 0 ? (peak - c) / (startingEquity + peak) : 0;
        if (dd > maxDD) maxDD = dd;
    }

    return {
        sharpe: sharpeRatio(returns, riskFreeRate),
        sortino: sortinoRatio(returns, riskFreeRate),
        totalReturn,
        avgReturn,
        maxDrawdown: maxDD,
        tradeCount: tradePnLs.length,
    };
}
