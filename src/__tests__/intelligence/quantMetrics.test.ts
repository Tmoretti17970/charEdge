// ═══════════════════════════════════════════════════════════════════
// charEdge — Batch 7: Quant Metrics Tests (Tasks 4.4.1–2)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
    mean,
    stdDev,
    downsideDev,
    sharpeRatio,
    sortinoRatio,
    rollingMetrics,
    pnlToReturns,
    computeQuantSummary,
} from '@/trading/QuantMetrics.ts';

// ─── mean / stdDev / downsideDev ────────────────────────────────

describe('QuantMetrics — Helpers', () => {
    it('mean of empty array is 0', () => {
        expect(mean([])).toBe(0);
    });

    it('mean of [1, 2, 3] is 2', () => {
        expect(mean([1, 2, 3])).toBe(2);
    });

    it('stdDev of single value is 0', () => {
        expect(stdDev([5])).toBe(0);
    });

    it('stdDev of identical values is 0', () => {
        expect(stdDev([3, 3, 3, 3])).toBe(0);
    });

    it('downsideDev only penalizes negative values', () => {
        const values = [0.05, -0.03, 0.02, -0.01, 0.04];
        const dd = downsideDev(values, 0);
        expect(dd).toBeGreaterThan(0);
        // Compare with all-positive array → downside dev should be 0
        const positiveOnly = [0.05, 0.02, 0.04, 0.01, 0.03];
        expect(downsideDev(positiveOnly, 0)).toBe(0);
    });
});

// ─── Sharpe Ratio ───────────────────────────────────────────────

describe('QuantMetrics — Sharpe Ratio', () => {
    it('returns 0 for empty array', () => {
        expect(sharpeRatio([])).toBe(0);
    });

    it('returns 0 for single value', () => {
        expect(sharpeRatio([0.01])).toBe(0);
    });

    it('positive returns → positive Sharpe', () => {
        const returns = [0.01, 0.02, 0.015, 0.01, 0.02, 0.01, 0.015, 0.02, 0.01, 0.015];
        const sharpe = sharpeRatio(returns, 0.04, 252);
        expect(sharpe).toBeGreaterThan(0);
    });

    it('negative returns → negative Sharpe', () => {
        const returns = [-0.01, -0.02, -0.015, -0.01, -0.02, -0.01, -0.015, -0.02, -0.01, -0.015];
        const sharpe = sharpeRatio(returns, 0.04, 252);
        expect(sharpe).toBeLessThan(0);
    });

    it('zero variance returns → capped at 99.99', () => {
        const returns = [0.005, 0.005, 0.005, 0.005, 0.005];
        // After subtracting rf, all values identical → σ = 0 → capped at 99.99
        const sharpe = sharpeRatio(returns, 0, 252);
        expect(sharpe).toBe(99.99);
    });
});

// ─── Sortino Ratio ──────────────────────────────────────────────

describe('QuantMetrics — Sortino Ratio', () => {
    it('returns 0 for empty array', () => {
        expect(sortinoRatio([])).toBe(0);
    });

    it('all positive returns → capped at 99.99 (no downside risk)', () => {
        const returns = [0.01, 0.02, 0.015, 0.01, 0.02];
        const sortino = sortinoRatio(returns, 0, 252);
        expect(sortino).toBe(99.99);
    });

    it('Sortino >= Sharpe when there is upside volatility (normal series)', () => {
        // When there's more upside than downside volatility, Sortino > Sharpe
        const returns = [0.03, -0.01, 0.04, -0.005, 0.02, 0.01, -0.01, 0.05, 0.02, -0.003];
        const sharpe = sharpeRatio(returns, 0.04, 252);
        const sortino = sortinoRatio(returns, 0.04, 252);
        expect(sortino).toBeGreaterThanOrEqual(sharpe);
    });
});

// ─── Rolling Metrics ────────────────────────────────────────────

describe('QuantMetrics — Rolling', () => {
    it('returns empty for insufficient data', () => {
        expect(rollingMetrics([0.01], 5)).toEqual([]);
        expect(rollingMetrics([0.01, 0.02, 0.03], 5)).toEqual([]);
    });

    it('returns correct number of windows', () => {
        const returns = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? 0.01 : -0.005));
        const rolling = rollingMetrics(returns, 10);
        expect(rolling.length).toBe(21); // 30 - 10 + 1
    });

    it('each metric has sharpe and sortino', () => {
        const returns = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? 0.01 : -0.005));
        const rolling = rollingMetrics(returns, 10);
        for (const m of rolling) {
            expect(m).toHaveProperty('sharpe');
            expect(m).toHaveProperty('sortino');
            expect(m).toHaveProperty('index');
            expect(m).toHaveProperty('windowSize');
            expect(Number.isFinite(m.sharpe) || m.sharpe === Infinity || m.sharpe === -Infinity).toBe(true);
        }
    });
});

// ─── pnlToReturns ───────────────────────────────────────────────

describe('QuantMetrics — pnlToReturns', () => {
    it('returns empty for insufficient data', () => {
        expect(pnlToReturns([], 10000)).toEqual([]);
        expect(pnlToReturns([100], 10000)).toEqual([]);
    });

    it('converts cumulative P&L to returns', () => {
        const pnl = [100, 250]; // Day 1: +100, Day 2: +150
        const returns = pnlToReturns(pnl, 10000);
        expect(returns.length).toBe(2);
        expect(returns[0]).toBeCloseTo(0.01, 4);       // 100 / 10000
        expect(returns[1]).toBeCloseTo(150 / 10100, 4); // 150 / (10000 + 100)
    });
});

// ─── computeQuantSummary ────────────────────────────────────────

describe('QuantMetrics — computeQuantSummary', () => {
    it('returns zeroes for empty trades', () => {
        const summary = computeQuantSummary([]);
        expect(summary.sharpe).toBe(0);
        expect(summary.sortino).toBe(0);
        expect(summary.tradeCount).toBe(0);
    });

    it('computes summary from real P&L', () => {
        const pnls = [100, -50, 200, -30, 150, 75, -20, 180, -40, 100];
        const summary = computeQuantSummary(pnls, 10000);
        expect(summary.tradeCount).toBe(10);
        expect(summary.totalReturn).toBeGreaterThan(0);
        expect(summary.avgReturn).toBeCloseTo(mean(pnls), 2);
        expect(summary.maxDrawdown).toBeGreaterThanOrEqual(0);
        expect(summary.maxDrawdown).toBeLessThanOrEqual(1);
    });
});
