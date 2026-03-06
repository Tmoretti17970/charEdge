// ═══════════════════════════════════════════════════════════════════
// charEdge — Batch 8A: Bias Detector Tests (Task 4.3.10)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { detectBiases, type TradeLike } from '../../intelligence/BiasDetector';

const makeTrade = (overrides: Partial<TradeLike> = {}): TradeLike => ({
    id: `t-${Math.random().toString(36).slice(2, 6)}`,
    date: new Date().toISOString(),
    pnl: 50,
    qty: 1,
    entry: 100,
    exit: 105,
    side: 'long',
    playbook: 'breakout',
    tags: [],
    ruleBreak: false,
    ...overrides,
});

describe('BiasDetector', () => {
    it('returns empty for < 3 trades', () => {
        const report = detectBiases([makeTrade(), makeTrade()]);
        expect(report.biases).toEqual([]);
        expect(report.score).toBe(100);
        expect(report.overallSeverity).toBe('none');
    });

    it('detects overconfidence (size increase after wins)', () => {
        const trades = [
            makeTrade({ pnl: 100, qty: 1 }),
            makeTrade({ pnl: 80, qty: 1 }),
            makeTrade({ pnl: -200, qty: 3 }), // 3x size after wins → overconfidence
        ];
        const report = detectBiases(trades);
        const overconf = report.biases.filter(b => b.type === 'OVERCONFIDENCE');
        expect(overconf.length).toBeGreaterThan(0);
    });

    it('detects recency bias (strategy switch after losses)', () => {
        const trades = [
            makeTrade({ pnl: -100, playbook: 'breakout' }),
            makeTrade({ pnl: -80, playbook: 'breakout' }),
            makeTrade({ pnl: 50, playbook: 'mean-reversion' }), // switched strategy
        ];
        const report = detectBiases(trades);
        const recency = report.biases.filter(b => b.type === 'RECENCY');
        expect(recency.length).toBeGreaterThan(0);
    });

    it('detects anchoring (held past stop loss)', () => {
        const trades = [
            makeTrade({ pnl: -200, entry: 100, exit: 85, stopLoss: 95, side: 'long' }),
            makeTrade({ pnl: 50 }),
            makeTrade({ pnl: 50 }),
        ];
        const report = detectBiases(trades);
        const anchoring = report.biases.filter(b => b.type === 'ANCHORING');
        expect(anchoring.length).toBeGreaterThan(0);
    });

    it('detects disposition effect (large losses vs small wins)', () => {
        const trades = [
            makeTrade({ pnl: 20 }),
            makeTrade({ pnl: 15 }),
            makeTrade({ pnl: 25 }),
            makeTrade({ pnl: -100 }),
            makeTrade({ pnl: -90 }),
            makeTrade({ pnl: -120 }),
        ];
        const report = detectBiases(trades);
        const disposition = report.biases.filter(b => b.type === 'DISPOSITION_EFFECT');
        expect(disposition.length).toBeGreaterThan(0);
    });

    it('detects loss aversion (dramatic size reduction after loss)', () => {
        const trades = [
            makeTrade({ pnl: -200, qty: 10 }),
            makeTrade({ pnl: 30, qty: 2 }), // 80% reduction
            makeTrade({ pnl: 30, qty: 2 }),
        ];
        const report = detectBiases(trades);
        const lossAversion = report.biases.filter(b => b.type === 'LOSS_AVERSION');
        expect(lossAversion.length).toBeGreaterThan(0);
    });

    it('identifies dominant bias', () => {
        const trades = [
            makeTrade({ pnl: 100, qty: 1 }),
            makeTrade({ pnl: 80, qty: 1 }),
            makeTrade({ pnl: -200, qty: 3 }),
            makeTrade({ pnl: 100, qty: 1 }),
            makeTrade({ pnl: 80, qty: 1 }),
            makeTrade({ pnl: -200, qty: 4 }),
        ];
        const report = detectBiases(trades);
        expect(report.dominantBias).not.toBeNull();
    });

    it('computes score 0-100', () => {
        const trades = Array.from({ length: 10 }, (_, i) =>
            makeTrade({ pnl: i % 2 === 0 ? 50 : -30 })
        );
        const report = detectBiases(trades);
        expect(report.score).toBeGreaterThanOrEqual(0);
        expect(report.score).toBeLessThanOrEqual(100);
    });
});
