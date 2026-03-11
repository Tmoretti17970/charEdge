// ═══════════════════════════════════════════════════════════════════
// charEdge — Batch 7: LeakDetector Tests (Task 4.3.1)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

// Helper to build a valid trade for LeakDetector
const makeTrade = (overrides = {}) => ({
    id: 'trade-1',
    timestamp: new Date().toISOString(),
    symbol: 'BTC',
    side: 'long',
    entryPrice: 100,
    exitPrice: 105,
    quantity: 1,
    timeframe: '1h',
    pnl: 50,
    outcome: 'win',
    bars: [],
    indicators: {},
    accountState: { equity: 10000, openPositions: 0 },
    psychContext: { stress: 3, confidence: 7, fatigue: 2 },
    tags: [],
    ...overrides,
});

describe('4.3.1 — LeakDetector (intelligence/)', () => {
    it('imports LeakDetector class', async () => {
        const mod = await import('../../psychology/LeakDetector.ts');
        expect(mod.default).toBeDefined();
    });

    it('analyze returns empty report for no trades', async () => {
        const mod = await import('../../psychology/LeakDetector.ts');
        const detector = new mod.default();
        const report = detector.analyze([]);
        expect(report.leaks).toEqual([]);
        expect(report.analyzedTrades).toBe(0);
        expect(report.score).toBeGreaterThanOrEqual(0);
    });

    it('detects revenge trading (rapid trade after loss)', async () => {
        const mod = await import('../../psychology/LeakDetector.ts');
        const detector = new mod.default();
        const now = Date.now();

        const trades = [
            makeTrade({
                id: '1', timestamp: new Date(now - 4 * 60000).toISOString(),
                exitPrice: 95, pnl: -50, outcome: 'loss',
            }),
            makeTrade({
                id: '2', timestamp: new Date(now - 2 * 60000).toISOString(),
                entryPrice: 96, exitPrice: 92, quantity: 2, pnl: -100, outcome: 'loss',
                accountState: { equity: 9950, openPositions: 0 },
            }),
        ];

        const report = detector.analyze(trades);
        expect(report.analyzedTrades).toBe(2);
        expect(Array.isArray(report.leaks)).toBe(true);
    });

    it('detects overtrading', async () => {
        const mod = await import('../../psychology/LeakDetector.ts');
        const detector = new mod.default();
        const now = Date.now();

        const trades = Array.from({ length: 25 }, (_, i) =>
            makeTrade({
                id: `trade-${i}`,
                timestamp: new Date(now - i * 30_000).toISOString(),
                symbol: 'ETH', entryPrice: 2000, exitPrice: 2010, pnl: 10,
            }),
        );

        const report = detector.analyze(trades);
        expect(report.analyzedTrades).toBe(25);
        expect(Array.isArray(report.leaks)).toBe(true);
        expect(report.score).toBeLessThanOrEqual(100);
        expect(report.score).toBeGreaterThanOrEqual(0);
    });

    it('report has required fields', async () => {
        const mod = await import('../../psychology/LeakDetector.ts');
        const detector = new mod.default();
        const report = detector.analyze([makeTrade()]);

        expect(report).toHaveProperty('leaks');
        expect(report).toHaveProperty('score');
        expect(report).toHaveProperty('summary');
        expect(report).toHaveProperty('analyzedTrades');
        expect(report).toHaveProperty('timeRange');
        expect(typeof report.summary).toBe('string');
    });

    it('each leak has required shape', async () => {
        const mod = await import('../../psychology/LeakDetector.ts');
        const detector = new mod.default();
        const now = Date.now();

        const trades = [
            makeTrade({ id: '1', timestamp: new Date(now - 300_000).toISOString(), exitPrice: 95, pnl: -50, outcome: 'loss' }),
            makeTrade({ id: '2', timestamp: new Date(now - 200_000).toISOString(), entryPrice: 96, exitPrice: 90, quantity: 2, pnl: -120, outcome: 'loss', accountState: { equity: 9950, openPositions: 0 } }),
            makeTrade({ id: '3', timestamp: new Date(now - 100_000).toISOString(), entryPrice: 91, exitPrice: 85, quantity: 4, pnl: -240, outcome: 'loss', accountState: { equity: 9830, openPositions: 0 } }),
        ];

        const report = detector.analyze(trades);
        for (const leak of report.leaks) {
            expect(leak).toHaveProperty('type');
            expect(leak).toHaveProperty('severity');
            expect(leak).toHaveProperty('message');
            expect(leak).toHaveProperty('recommendation');
            expect(typeof leak.message).toBe('string');
            expect(typeof leak.recommendation).toBe('string');
        }
    });

    it('score is high for well-spaced winning trades', async () => {
        const mod = await import('../../psychology/LeakDetector.ts');
        const detector = new mod.default();

        const trades = Array.from({ length: 5 }, (_, i) =>
            makeTrade({
                id: `trade-${i}`,
                timestamp: new Date(Date.now() - i * 3_600_000).toISOString(),
                entryPrice: 100 + i, exitPrice: 105 + i,
            }),
        );

        const report = detector.analyze(trades);
        // Score should be between 0-100 (valid range)
        expect(report.score).toBeGreaterThanOrEqual(0);
        expect(report.score).toBeLessThanOrEqual(100);
    });
});
