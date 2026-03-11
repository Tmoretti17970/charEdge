// ═══════════════════════════════════════════════════════════════════
// charEdge — Batch 8A: Fatigue Analyzer Tests (Task 4.3.8)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { analyzeFatigue, type TradeLike } from '@/psychology/FatigueAnalyzer';

const makeTrade = (overrides: Partial<TradeLike> = {}): TradeLike => ({
    id: `t-${Math.random().toString(36).slice(2, 6)}`,
    date: new Date().toISOString(),
    pnl: 50,
    ...overrides,
});

describe('FatigueAnalyzer', () => {
    it('returns empty for no trades', () => {
        const report = analyzeFatigue([]);
        expect(report.bestHours).toBeNull();
        expect(report.worstHours).toBeNull();
        expect(report.hourlyBreakdown).toEqual([]);
        expect(report.weekdayMatrix).toEqual([]);
        expect(report.fatigueThreshold).toBeNull();
        expect(report.analyzedTrades).toBe(0);
    });

    it('buckets trades by time of day', () => {
        const base = new Date('2026-03-02T10:00:00Z'); // 10am = midday
        const trades = [
            makeTrade({ date: base.toISOString(), pnl: 100 }),
            makeTrade({ date: new Date(base.getTime() + 3600000).toISOString(), pnl: 50 }),
        ];
        const report = analyzeFatigue(trades);
        expect(report.hourlyBreakdown.length).toBeGreaterThan(0);
        expect(report.analyzedTrades).toBe(2);
    });

    it('creates weekday matrix', () => {
        // Create trades on different days
        const mon = new Date('2026-03-02T10:00:00Z'); // Monday
        const tue = new Date('2026-03-03T10:00:00Z'); // Tuesday
        const trades = [
            makeTrade({ date: mon.toISOString(), pnl: 100 }),
            makeTrade({ date: tue.toISOString(), pnl: -50 }),
        ];
        const report = analyzeFatigue(trades);
        expect(report.weekdayMatrix.length).toBeGreaterThan(0);
    });

    it('identifies best and worst hours', () => {
        const base = new Date('2026-03-02T11:00:00Z'); // midday
        const evening = new Date('2026-03-02T17:00:00Z'); // after-hours
        const trades = [
            makeTrade({ date: base.toISOString(), pnl: 200 }),
            makeTrade({ date: new Date(base.getTime() + 1800000).toISOString(), pnl: 100 }),
            makeTrade({ date: evening.toISOString(), pnl: -100 }),
            makeTrade({ date: new Date(evening.getTime() + 1800000).toISOString(), pnl: -80 }),
        ];
        const report = analyzeFatigue(trades);
        expect(report.bestHours).not.toBeNull();
        expect(report.worstHours).not.toBeNull();
        if (report.bestHours && report.worstHours) {
            expect(report.bestHours.avgPnl).toBeGreaterThan(report.worstHours.avgPnl);
        }
    });

    it('generates recommendations', () => {
        const base = new Date('2026-03-02T11:00:00Z');
        const evening = new Date('2026-03-02T17:00:00Z');
        const trades = [
            makeTrade({ date: base.toISOString(), pnl: 200 }),
            makeTrade({ date: new Date(base.getTime() + 1800000).toISOString(), pnl: 100 }),
            makeTrade({ date: evening.toISOString(), pnl: -100 }),
            makeTrade({ date: new Date(evening.getTime() + 1800000).toISOString(), pnl: -80 }),
        ];
        const report = analyzeFatigue(trades);
        expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('builds session fatigue curve', () => {
        // Simulate a long session: trades over 3 hours
        const sessionStart = new Date('2026-03-02T10:00:00Z');
        const trades = Array.from({ length: 8 }, (_, i) =>
            makeTrade({
                date: new Date(sessionStart.getTime() + i * 20 * 60000).toISOString(), // every 20 min
                pnl: i < 4 ? 50 : -40,  // positive early, negative late
            })
        );
        const report = analyzeFatigue(trades);
        expect(report.sessionFatigueCurve.length).toBeGreaterThan(0);
    });
});
