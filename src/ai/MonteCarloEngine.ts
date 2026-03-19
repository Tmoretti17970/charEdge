// ═══════════════════════════════════════════════════════════════════
// charEdge — Monte Carlo Risk Forecaster (Sprint 81)
//
// Simulates N future equity paths from historical trade returns.
// Computes percentile curves, max drawdown distribution, and ruin
// probability. Designed to run in a Web Worker context.
//
// Usage:
//   import { monteCarloEngine } from './MonteCarloEngine';
//   const result = monteCarloEngine.simulate(returns, { paths: 1000, horizon: 100 });
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface MCOptions {
  paths?: number;        // Number of simulation paths (default 1000)
  horizon?: number;      // Number of future trades to simulate (default 100)
  startingBalance?: number;
  ruinThreshold?: number; // Drawdown % that counts as "ruin" (default 50)
}

export interface MCResult {
  percentiles: {
    p5: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p95: number[];
  };
  finalBalances: {
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
  maxDrawdowns: {
    p5: number;
    median: number;
    p95: number;
  };
  ruinProbability: number;
  profitProbability: number;
  paths: number;
  horizon: number;
}

// ─── Engine ─────────────────────────────────────────────────────

class MonteCarloEngine {
  /**
   * Run Monte Carlo simulation on historical trade returns.
   * @param returns Array of P&L values (absolute, not %)
   * @param opts Simulation options
   */
  simulate(returns: number[], opts: MCOptions = {}): MCResult {
    // Phase 3 Task #41: Configurable with validation
    const paths = Math.max(100, Math.min(100_000, opts.paths || 1000));
    const horizon = Math.max(1, Math.min(1000, opts.horizon || Math.min(returns.length * 2, 200)));
    const startBalance = opts.startingBalance || 10000;
    const ruinThreshold = opts.ruinThreshold || 50;

    if (returns.length < 5) {
      return this._emptyResult(paths, horizon);
    }

    // Run all paths
    const allPaths: number[][] = [];
    const finalBalances: number[] = [];
    const maxDrawdowns: number[] = [];
    let ruinCount = 0;
    let profitCount = 0;

    for (let p = 0; p < paths; p++) {
      const path = this._simulatePath(returns, horizon, startBalance);
      allPaths.push(path);

      const final = path[path.length - 1];
      finalBalances.push(final);

      if (final > startBalance) profitCount++;

      // Calculate max drawdown for this path
      let peak = startBalance;
      let maxDD = 0;
      for (const val of path) {
        if (val > peak) peak = val;
        const dd = ((peak - val) / peak) * 100;
        if (dd > maxDD) maxDD = dd;
      }
      maxDrawdowns.push(maxDD);
      if (maxDD >= ruinThreshold) ruinCount++;
    }

    // Compute percentile curves
    const percentiles = this._computePercentileCurves(allPaths, horizon);

    // Sort for percentile calculations
    finalBalances.sort((a, b) => a - b);
    maxDrawdowns.sort((a, b) => a - b);

    return {
      percentiles,
      finalBalances: {
        p5: this._percentile(finalBalances, 5),
        p25: this._percentile(finalBalances, 25),
        p50: this._percentile(finalBalances, 50),
        p75: this._percentile(finalBalances, 75),
        p95: this._percentile(finalBalances, 95),
      },
      maxDrawdowns: {
        p5: this._percentile(maxDrawdowns, 5),
        median: this._percentile(maxDrawdowns, 50),
        p95: this._percentile(maxDrawdowns, 95),
      },
      ruinProbability: Math.round((ruinCount / paths) * 100),
      profitProbability: Math.round((profitCount / paths) * 100),
      paths,
      horizon,
    };
  }

  // ─── Simulation ──────────────────────────────────────────────

  private _simulatePath(returns: number[], horizon: number, startBalance: number): number[] {
    const path: number[] = [startBalance];
    let balance = startBalance;

    for (let i = 0; i < horizon; i++) {
      // Random sample from historical returns (bootstrapping)
      const idx = Math.floor(Math.random() * returns.length);
      balance += returns[idx];
      path.push(Math.max(0, balance)); // Can't go below 0
    }

    return path;
  }

  private _computePercentileCurves(
    allPaths: number[][],
    horizon: number,
  ): MCResult['percentiles'] {
    const p5: number[] = [];
    const p25: number[] = [];
    const p50: number[] = [];
    const p75: number[] = [];
    const p95: number[] = [];

    for (let t = 0; t <= horizon; t++) {
      const values = allPaths.map(path => path[t] || 0).sort((a, b) => a - b);
      p5.push(this._percentile(values, 5));
      p25.push(this._percentile(values, 25));
      p50.push(this._percentile(values, 50));
      p75.push(this._percentile(values, 75));
      p95.push(this._percentile(values, 95));
    }

    return { p5, p25, p50, p75, p95 };
  }

  private _percentile(sorted: number[], pct: number): number {
    const idx = Math.ceil((pct / 100) * sorted.length) - 1;
    return Math.round((sorted[Math.max(0, idx)] || 0) * 100) / 100;
  }

  private _emptyResult(paths: number, horizon: number): MCResult {
    const emptyArr = new Array(horizon + 1).fill(0);
    return {
      percentiles: { p5: emptyArr, p25: emptyArr, p50: emptyArr, p75: emptyArr, p95: emptyArr },
      finalBalances: { p5: 0, p25: 0, p50: 0, p75: 0, p95: 0 },
      maxDrawdowns: { p5: 0, median: 0, p95: 0 },
      ruinProbability: 0,
      profitProbability: 0,
      paths,
      horizon,
    };
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const monteCarloEngine = new MonteCarloEngine();
export default monteCarloEngine;
