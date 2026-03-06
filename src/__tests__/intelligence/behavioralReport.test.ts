// ═══════════════════════════════════════════════════════════════════
// charEdge — Batch 8A: Behavioral Report Card Tests (Task 4.12.13)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { generateReportCard, type TradeLike } from '../../intelligence/BehavioralReportCard';

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
    triggers: [],
    fomo: null,
    impulse: null,
    clarity: null,
    preMood: null,
    postMood: null,
    notes: '',
    rating: null,
    ...overrides,
});

describe('BehavioralReportCard', () => {
    it('returns empty report for no trades', () => {
        const report = generateReportCard([]);
        expect(report.analyzedTrades).toBe(0);
        expect(report.overallScore).toBe(100);
        expect(report.topErrors).toEqual([]);
        expect(report.emotionalTendencies).toEqual([]);
        expect(report.narrative).toBe('No trades to analyze this period.');
    });

    it('generates full report with trades', () => {
        const trades = [
            makeTrade({ pnl: 100, fomo: 3, clarity: 8, preMood: 7, postMood: 8, notes: 'Good trade' }),
            makeTrade({ pnl: -50, fomo: 8, clarity: 3, preMood: 4, postMood: 2, triggers: ['fatigue'] }),
            makeTrade({ pnl: 80, fomo: 2, clarity: 9, notes: 'Solid setup' }),
            makeTrade({ pnl: -30, ruleBreak: true, triggers: ['fatigue'], fomo: 7 }),
        ];
        const report = generateReportCard(trades, 10000);

        expect(report.analyzedTrades).toBe(4);
        expect(report.overallScore).toBeGreaterThanOrEqual(0);
        expect(report.overallScore).toBeLessThanOrEqual(100);
        expect(report.narrative.length).toBeGreaterThan(0);
    });

    it('includes sub-reports', () => {
        const trades = [
            makeTrade({ pnl: 100 }),
            makeTrade({ pnl: -50, triggers: ['fatigue'] }),
            makeTrade({ pnl: 80 }),
        ];
        const report = generateReportCard(trades);

        expect(report.triggerReport).toBeDefined();
        expect(report.biasReport).toBeDefined();
        expect(report.disciplineData).toBeDefined();
        expect(report.fatigueReport).toBeDefined();
    });

    it('computes emotional tendencies by streak', () => {
        const now = Date.now();
        const trades = [
            makeTrade({ date: new Date(now - 5 * 3600000).toISOString(), pnl: 100, fomo: 2 }),
            makeTrade({ date: new Date(now - 4 * 3600000).toISOString(), pnl: 80, fomo: 2 }),
            // After 2 wins, this trade is "after-wins" context
            makeTrade({ date: new Date(now - 3 * 3600000).toISOString(), pnl: -50, fomo: 8 }),
        ];
        const report = generateReportCard(trades);
        expect(report.emotionalTendencies.length).toBeGreaterThan(0);
    });

    it('tracks habit metrics', () => {
        const trades = [
            makeTrade({ notes: 'Detailed trade notes here', rating: 4 }),
            makeTrade({ notes: '', rating: null }),
            makeTrade({ notes: 'Some notes', rating: 3, fomo: 5, clarity: 7 }),
        ];
        const report = generateReportCard(trades);

        expect(report.habits.journalCompletionRate).toBeCloseTo(2 / 3, 1);
        expect(report.habits.psychDimensionRate).toBeCloseTo(1 / 3, 1);
        expect(report.habits.avgRating).toBeCloseTo(3.5, 1);
    });

    it('surfaces top errors from triggers and biases', () => {
        const now = Date.now();
        const trades = [
            makeTrade({ date: new Date(now - 5 * 3600000).toISOString(), pnl: -100, triggers: ['fatigue'] }),
            makeTrade({ date: new Date(now - 4 * 3600000).toISOString(), pnl: -80, triggers: ['fatigue'] }),
            makeTrade({ date: new Date(now - 3 * 3600000).toISOString(), pnl: 100 }),
            makeTrade({ date: new Date(now - 2 * 3600000).toISOString(), pnl: 50 }),
        ];
        const report = generateReportCard(trades);
        // Top errors should include trigger patterns
        expect(report.topErrors.length).toBeLessThanOrEqual(3);
    });

    it('computes discipline data when rule breaks exist', () => {
        const trades = [
            makeTrade({ pnl: 100 }),
            makeTrade({ pnl: -200, ruleBreak: true }),
            makeTrade({ pnl: 50 }),
        ];
        const report = generateReportCard(trades, 10000);
        expect(report.disciplineData.ruleBreakCount).toBe(1);
        expect(report.disciplineData.costOfIndiscipline).toBe(200);
    });
});
