// ═══════════════════════════════════════════════════════════════════
// charEdge — Batch 8A: Discipline Curve Tests (Task 4.3.3)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { computeDisciplineCurve, type TradeLike } from '@/psychology/DisciplineCurve';

const makeTrade = (overrides: Partial<TradeLike> = {}): TradeLike => ({
    id: `t-${Math.random().toString(36).slice(2, 6)}`,
    date: new Date().toISOString(),
    pnl: 50,
    ruleBreak: false,
    ...overrides,
});

describe('DisciplineCurve', () => {
    it('returns empty for no trades', () => {
        const result = computeDisciplineCurve([], 10000);
        expect(result.points).toEqual([]);
        expect(result.finalActualEquity).toBe(10000);
        expect(result.finalDisciplinedEquity).toBe(10000);
        expect(result.costOfIndiscipline).toBe(0);
        expect(result.disciplineRate).toBe(1);
    });

    it('computes equity without rule breaks', () => {
        const trades = [
            makeTrade({ pnl: 100 }),
            makeTrade({ pnl: -30 }),
            makeTrade({ pnl: 50 }),
        ];
        const result = computeDisciplineCurve(trades, 10000);
        expect(result.finalActualEquity).toBe(10120);
        expect(result.finalDisciplinedEquity).toBe(10120);
        expect(result.costOfIndiscipline).toBe(0);
        expect(result.ruleBreakCount).toBe(0);
        expect(result.disciplineRate).toBe(1);
    });

    it('skips rule-breaking trades in disciplined equity', () => {
        const trades = [
            makeTrade({ pnl: 100 }),
            makeTrade({ pnl: -200, ruleBreak: true }), // skipped in disciplined
            makeTrade({ pnl: 50 }),
        ];
        const result = computeDisciplineCurve(trades, 10000);
        expect(result.finalActualEquity).toBe(9950);     // 10000 + 100 - 200 + 50
        expect(result.finalDisciplinedEquity).toBe(10150); // 10000 + 100 + 50 (skipped -200)
        expect(result.costOfIndiscipline).toBe(200);
        expect(result.ruleBreakCount).toBe(1);
    });

    it('tracks points correctly', () => {
        const trades = [
            makeTrade({ id: 't1', pnl: 100 }),
            makeTrade({ id: 't2', pnl: -50, ruleBreak: true }),
        ];
        const result = computeDisciplineCurve(trades, 10000);
        expect(result.points.length).toBe(2);
        expect(result.points[0].actualEquity).toBe(10100);
        expect(result.points[0].disciplinedEquity).toBe(10100);
        expect(result.points[0].wasRuleBreak).toBe(false);
        expect(result.points[1].actualEquity).toBe(10050);
        expect(result.points[1].disciplinedEquity).toBe(10100);
        expect(result.points[1].wasRuleBreak).toBe(true);
        expect(result.points[1].gap).toBe(50);
    });

    it('computes discipline rate', () => {
        const trades = [
            makeTrade({ ruleBreak: true }),
            makeTrade({ ruleBreak: true }),
            makeTrade({ ruleBreak: false }),
            makeTrade({ ruleBreak: false }),
        ];
        const result = computeDisciplineCurve(trades, 10000);
        expect(result.disciplineRate).toBe(0.5);
    });
});
