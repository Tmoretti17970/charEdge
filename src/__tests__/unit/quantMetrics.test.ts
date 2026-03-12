// ═══════════════════════════════════════════════════════════════════
// charEdge — QuantMetrics Regression Tests (#51)
//
// Verifies Sharpe, Sortino, rolling metrics, pnlToReturns, and
// computeQuantSummary against hand-calculated expected values.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  mean,
  stdDev,
  downsideDev,
  sharpeRatio,
  sortinoRatio,
  pnlToReturns,
  rollingMetrics,
  computeQuantSummary,
} from '@/trading/QuantMetrics';

// ─── mean() ─────────────────────────────────────────────────────

describe('mean()', () => {
  it('returns 0 for empty array', () => {
    expect(mean([])).toBe(0);
  });

  it('returns the value for single element', () => {
    expect(mean([5])).toBe(5);
  });

  it('calculates correct mean', () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3);
  });

  it('handles negative values', () => {
    expect(mean([-2, -1, 0, 1, 2])).toBe(0);
  });
});

// ─── stdDev() ───────────────────────────────────────────────────

describe('stdDev()', () => {
  it('returns 0 for empty array', () => {
    expect(stdDev([])).toBe(0);
  });

  it('returns 0 for single element', () => {
    expect(stdDev([42])).toBe(0);
  });

  it('calculates sample standard deviation', () => {
    // [2, 4, 4, 4, 5, 5, 7, 9] → mean=5, sample σ ≈ 2.138
    const result = stdDev([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(result).toBeCloseTo(2.138, 2);
  });

  it('returns 0 for identical values', () => {
    expect(stdDev([3, 3, 3, 3])).toBe(0);
  });
});

// ─── downsideDev() ──────────────────────────────────────────────

describe('downsideDev()', () => {
  it('returns 0 for empty array', () => {
    expect(downsideDev([])).toBe(0);
  });

  it('returns 0 when all values are positive', () => {
    // All above threshold=0, so downside squared = [0,0,0,0]
    expect(downsideDev([1, 2, 3, 4])).toBe(0);
  });

  it('only considers values below threshold', () => {
    // [-2, -1, 0, 1, 2] → min(0, v-0) = [-2, -1, 0, 0, 0]
    // squared = [4, 1, 0, 0, 0] → sum=5 → 5/(5-1)=1.25 → √1.25 ≈ 1.118
    const result = downsideDev([-2, -1, 0, 1, 2]);
    expect(result).toBeCloseTo(1.118, 2);
  });

  it('is less than or equal to stdDev for same data', () => {
    const data = [-3, -1, 0, 2, 5, -2, 1];
    expect(downsideDev(data)).toBeLessThanOrEqual(stdDev(data));
  });
});

// ─── sharpeRatio() ──────────────────────────────────────────────

describe('sharpeRatio()', () => {
  it('returns 0 for fewer than 2 data points', () => {
    expect(sharpeRatio([])).toBe(0);
    expect(sharpeRatio([0.01])).toBe(0);
  });

  it('caps at 99.99 when σ is 0 and returns are positive', () => {
    // Identical positive returns → σ=0, excess>0 → capped at 99.99
    const result = sharpeRatio([0.01, 0.01, 0.01, 0.01, 0.01]);
    expect(result).toBe(99.99);
  });

  it('caps at -99.99 when σ is 0 and returns are negative', () => {
    const result = sharpeRatio([-0.01, -0.01, -0.01, -0.01, -0.01]);
    expect(result).toBe(-99.99);
  });

  it('produces a positive Sharpe for consistently positive returns', () => {
    const returns = [0.02, 0.03, 0.01, 0.04, 0.02, 0.01, 0.03, 0.02, 0.01, 0.02];
    const result = sharpeRatio(returns);
    expect(result).toBeGreaterThan(0);
  });

  it('produces a negative Sharpe for consistently negative returns', () => {
    const returns = [-0.02, -0.03, -0.01, -0.04, -0.02, -0.01, -0.03, -0.02, -0.01, -0.02];
    const result = sharpeRatio(returns);
    expect(result).toBeLessThan(0);
  });

  it('accepts custom risk-free rate and periods', () => {
    const returns = [0.02, 0.03, 0.01, 0.04, 0.02];
    const withDefault = sharpeRatio(returns);
    const withZeroRf = sharpeRatio(returns, 0);
    // Zero RF should give higher Sharpe (no deduction)
    expect(withZeroRf).toBeGreaterThan(withDefault);
  });
});

// ─── sortinoRatio() ─────────────────────────────────────────────

describe('sortinoRatio()', () => {
  it('returns 0 for fewer than 2 data points', () => {
    expect(sortinoRatio([])).toBe(0);
    expect(sortinoRatio([0.01])).toBe(0);
  });

  it('is >= Sharpe for positively skewed returns', () => {
    // Positively skewed: most positive, few negative
    const returns = [0.05, 0.03, 0.04, 0.02, -0.01, 0.06, 0.03, 0.02, 0.04, 0.01];
    const sharpe = sharpeRatio(returns);
    const sortino = sortinoRatio(returns);
    // Sortino should be >= Sharpe when upside volatility dominates
    expect(sortino).toBeGreaterThanOrEqual(sharpe);
  });

  it('caps at 99.99 when no downside deviation exists', () => {
    // All positive excess returns → downside σ = 0 → capped
    const result = sortinoRatio([0.05, 0.06, 0.07, 0.08, 0.09]);
    expect(result).toBe(99.99);
  });
});

// ─── pnlToReturns() ────────────────────────────────────────────

describe('pnlToReturns()', () => {
  it('returns empty for fewer than 2 values', () => {
    expect(pnlToReturns([], 10000)).toEqual([]);
    expect(pnlToReturns([100], 10000)).toEqual([]);
  });

  it('returns empty for zero starting equity', () => {
    expect(pnlToReturns([100, 200], 0)).toEqual([]);
  });

  it('converts cumulative PnL to periodic returns', () => {
    // Cumulative: [100, 250] → period PnL: [100, 150]
    // Returns: [100/10000=0.01, 150/10100≈0.01485]
    const result = pnlToReturns([100, 250], 10000);
    expect(result).toHaveLength(2);
    expect(result[0]).toBeCloseTo(0.01, 4);
    expect(result[1]).toBeCloseTo(0.01485, 3);
  });

  it('handles negative PnL correctly', () => {
    // Cumulative: [-100, -300] → period PnL: [-100, -200]
    const result = pnlToReturns([-100, -300], 10000);
    expect(result[0]).toBeCloseTo(-0.01, 4);
    expect(result[1]).toBeLessThan(0);
  });
});

// ─── rollingMetrics() ───────────────────────────────────────────

describe('rollingMetrics()', () => {
  it('returns empty when data < window', () => {
    expect(rollingMetrics([0.01, 0.02], 5)).toEqual([]);
  });

  it('returns empty when window < 2', () => {
    expect(rollingMetrics([0.01, 0.02, 0.03], 1)).toEqual([]);
  });

  it('produces correct number of windows', () => {
    const returns = Array.from({ length: 30 }, () => Math.random() * 0.04 - 0.02);
    const result = rollingMetrics(returns, 10);
    // 30 items, window 10 → 21 windows (30 - 10 + 1)
    expect(result).toHaveLength(21);
  });

  it('each window has sharpe and sortino', () => {
    const returns = Array.from({ length: 25 }, () => Math.random() * 0.04 - 0.02);
    const result = rollingMetrics(returns, 10);
    for (const m of result) {
      expect(m).toHaveProperty('sharpe');
      expect(m).toHaveProperty('sortino');
      expect(m).toHaveProperty('index');
      expect(m).toHaveProperty('windowSize', 10);
    }
  });
});

// ─── computeQuantSummary() ──────────────────────────────────────

describe('computeQuantSummary()', () => {
  it('returns zeroed summary for empty trades', () => {
    const s = computeQuantSummary([]);
    expect(s.sharpe).toBe(0);
    expect(s.sortino).toBe(0);
    expect(s.totalReturn).toBe(0);
    expect(s.avgReturn).toBe(0);
    expect(s.maxDrawdown).toBe(0);
    expect(s.tradeCount).toBe(0);
  });

  it('handles single trade', () => {
    const s = computeQuantSummary([500]);
    expect(s.tradeCount).toBe(1);
    expect(s.totalReturn).toBeCloseTo(500 / 10000, 4);
    expect(s.avgReturn).toBe(500);
  });

  it('calculates positive Sharpe for all winning trades', () => {
    const wins = [100, 200, 150, 300, 250, 100, 200, 150, 300, 250];
    const s = computeQuantSummary(wins);
    expect(s.sharpe).toBeGreaterThan(0);
    expect(s.sortino).toBeGreaterThan(0);
    expect(s.maxDrawdown).toBe(0); // all wins → no drawdown
    expect(s.tradeCount).toBe(10);
  });

  it('calculates negative Sharpe for all losing trades', () => {
    const losses = [-100, -200, -150, -300, -250, -100, -200, -150, -300, -250];
    const s = computeQuantSummary(losses);
    expect(s.sharpe).toBeLessThan(0);
    expect(s.maxDrawdown).toBeGreaterThan(0);
    expect(s.tradeCount).toBe(10);
  });

  it('max drawdown is correct for mixed trades', () => {
    // +500, -300, -400, +200 → cumulative: [500, 200, -200, 0]
    // equity: [10500, 10200, 9800, 10000]
    // peak: 10500, trough: 9800 → DD = 700/10500 ≈ 0.0667
    const s = computeQuantSummary([500, -300, -400, 200]);
    expect(s.maxDrawdown).toBeCloseTo(700 / 10500, 3);
  });

  it('respects custom starting equity', () => {
    const s1 = computeQuantSummary([100, 200], 10000);
    const s2 = computeQuantSummary([100, 200], 100000);
    // Same absolute PnL but different equity → different return
    expect(s1.totalReturn).toBeGreaterThan(s2.totalReturn);
  });
});
