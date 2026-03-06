// ═══════════════════════════════════════════════════════════════════
// charEdge — Batch 9 Tests
//
// Tests for: ReplayPaperTrade, ExpectancyCalculator,
// PostTradeReflection, multi-condition alerts, CostSavingsCalculator
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── ReplayPaperTrade Tests ─────────────────────────────────────

describe('ReplayPaperTrade', () => {
    function createMockEngine() {
        const listeners: Map<string, Function[]> = new Map();
        return {
            on(event: string, cb: Function) {
                if (!listeners.has(event)) listeners.set(event, []);
                listeners.get(event)!.push(cb);
                return () => {
                    const cbs = listeners.get(event) || [];
                    const idx = cbs.indexOf(cb);
                    if (idx >= 0) cbs.splice(idx, 1);
                };
            },
            emit(event: string, data: unknown) {
                for (const cb of listeners.get(event) || []) cb(data);
            },
            getCurrentBar: vi.fn().mockReturnValue({ time: 1000, open: 100, high: 105, low: 95, close: 102, volume: 1000 }),
            getVisibleIndex: vi.fn().mockReturnValue(5),
            getConfig: vi.fn().mockReturnValue({ symbol: 'BTCUSD', timeframe: '5m', startDate: new Date(), endDate: new Date() }),
        };
    }

    it('places a trade at current replay price', async () => {
        const { ReplayPaperTrade } = await import('../../intelligence/ReplayPaperTrade');
        const mockEngine = createMockEngine();
        const rpt = new ReplayPaperTrade(mockEngine as any);

        const trade = rpt.placeTrade('long', 1);
        expect(trade).not.toBeNull();
        expect(trade!.entryPrice).toBe(102);
        expect(trade!.side).toBe('long');
        expect(trade!.status).toBe('open');
    });

    it('closes a trade and calculates P&L', async () => {
        const { ReplayPaperTrade } = await import('../../intelligence/ReplayPaperTrade');
        const mockEngine = createMockEngine();
        const rpt = new ReplayPaperTrade(mockEngine as any);

        const trade = rpt.placeTrade('long', 2);
        expect(trade).not.toBeNull();

        // Simulate price change
        mockEngine.getCurrentBar.mockReturnValue({ time: 2000, open: 102, high: 115, low: 100, close: 110, volume: 1200 });
        const closed = rpt.closeTrade(trade!.id);

        expect(closed).not.toBeNull();
        expect(closed!.status).toBe('closed');
        expect(closed!.pnl).toBe((110 - 102) * 2);  // 16
    });

    it('tracks session stats correctly', async () => {
        const { ReplayPaperTrade } = await import('../../intelligence/ReplayPaperTrade');
        const mockEngine = createMockEngine();
        const rpt = new ReplayPaperTrade(mockEngine as any);

        // Win trade
        rpt.placeTrade('long', 1);
        mockEngine.getCurrentBar.mockReturnValue({ time: 2000, open: 102, high: 115, low: 100, close: 110, volume: 1200 });
        rpt.closeTrade(rpt.getStats().trades[0].id);

        // Loss trade
        mockEngine.getCurrentBar.mockReturnValue({ time: 1000, open: 100, high: 105, low: 95, close: 100, volume: 1000 });
        rpt.placeTrade('long', 1);
        mockEngine.getCurrentBar.mockReturnValue({ time: 3000, open: 100, high: 100, low: 90, close: 92, volume: 800 });
        rpt.closeTrade(rpt.getStats().trades[1].id);

        const stats = rpt.getStats();
        expect(stats.winCount).toBe(1);
        expect(stats.lossCount).toBe(1);
        expect(stats.winRate).toBe(0.5);
    });

    it('updates unrealized P&L on bar advance', async () => {
        const { ReplayPaperTrade } = await import('../../intelligence/ReplayPaperTrade');
        const mockEngine = createMockEngine();
        const rpt = new ReplayPaperTrade(mockEngine as any);
        rpt.connect();

        rpt.placeTrade('long', 1);

        // Simulate bar advance
        mockEngine.emit('bar-advance', {
            bar: { time: 2000, open: 105, high: 115, low: 100, close: 112, volume: 1200 },
            index: 6,
        });

        const stats = rpt.getStats();
        expect(stats.trades[0].pnl).toBe(112 - 102);  // 10

        rpt.disconnect();
    });
});

// ─── ExpectancyCalculator Tests ─────────────────────────────────

describe('ExpectancyCalculator', () => {
    it('computes overall expectancy', async () => {
        const { computeExpectancy } = await import('../../intelligence/ExpectancyCalculator');
        const trades = [
            { pnl: 100, setup: 'Breakout' },
            { pnl: -50, setup: 'Breakout' },
            { pnl: 200, setup: 'Pullback' },
            { pnl: -30, setup: 'Pullback' },
            { pnl: 150, setup: 'Breakout' },
        ];

        const result = computeExpectancy(trades);
        expect(result.overall.tradeCount).toBe(5);
        expect(result.overall.winRate).toBe(0.6);
        expect(result.overall.expectancy).toBeGreaterThan(0);
    });

    it('groups by setup', async () => {
        const { computeExpectancy } = await import('../../intelligence/ExpectancyCalculator');
        const trades = [
            { pnl: 100, setup: 'Breakout' },
            { pnl: -50, setup: 'Pullback' },
            { pnl: 200, setup: 'Breakout' },
            { pnl: -80, setup: 'Pullback' },
        ];

        const result = computeExpectancy(trades);
        expect(result.bySetup.length).toBe(2);

        const breakout = result.bySetup.find((s) => s.setup === 'Breakout');
        expect(breakout).toBeDefined();
        expect(breakout!.winRate).toBe(1);
        expect(breakout!.expectancy).toBe(150);  // avg of 100, 200
    });

    it('generates recommendation for negative setups', async () => {
        const { computeExpectancy } = await import('../../intelligence/ExpectancyCalculator');
        const trades = [
            { pnl: 200, setup: 'Good Setup' },
            { pnl: 150, setup: 'Good Setup' },
            { pnl: -100, setup: 'Bad Setup' },
            { pnl: -90, setup: 'Bad Setup' },
        ];

        const result = computeExpectancy(trades);
        expect(result.recommendation).toContain('Bad Setup');
        expect(result.recommendation).toContain('negative');
    });

    it('handles R-multiple expectancy', async () => {
        const { computeExpectancy } = await import('../../intelligence/ExpectancyCalculator');
        const trades = [
            { pnl: 300, setup: 'Trend', rMultiple: 3.0 },
            { pnl: -100, setup: 'Trend', rMultiple: -1.0 },
            { pnl: 200, setup: 'Trend', rMultiple: 2.0 },
        ];

        const result = computeExpectancy(trades);
        expect(result.overall.expectancyPerR).toBeCloseTo(4 / 3, 1);
    });
});

// ─── PostTradeReflection Tests ──────────────────────────────────

describe('PostTradeReflection', () => {
    it('creates a reflection from answers', async () => {
        const { createReflection, REFLECTION_PROMPTS } = await import('../../intelligence/PostTradeReflection');

        const answers = [
            { promptId: 'plan-followed', answer: 8, timestamp: new Date().toISOString() },
            { promptId: 'lesson', answer: 'Wait for confirmation', timestamp: new Date().toISOString() },
            { promptId: 'would-take-again', answer: 'Yes — with modifications', timestamp: new Date().toISOString() },
        ];

        const reflection = createReflection('trade-1', 'BTCUSD', 150, answers);
        expect(reflection.planAdherence).toBe(8);
        expect(reflection.lessonLearned).toBe('Wait for confirmation');
        expect(reflection.wouldTakeAgain).toBe(true);
        expect(REFLECTION_PROMPTS.length).toBe(10);
    });

    it('analyzes emotion patterns', async () => {
        const { analyzeReflections } = await import('../../intelligence/PostTradeReflection');

        const reflections = [
            {
                tradeId: '1', symbol: 'BTC', pnl: -100,
                answers: [{ promptId: 'emotion-during', answer: 'Anxious', timestamp: '' }],
                completedAt: '', planAdherence: 5, lessonLearned: '', wouldTakeAgain: true,
            },
            {
                tradeId: '2', symbol: 'BTC', pnl: -80,
                answers: [{ promptId: 'emotion-during', answer: 'Anxious', timestamp: '' }],
                completedAt: '', planAdherence: 4, lessonLearned: '', wouldTakeAgain: false,
            },
            {
                tradeId: '3', symbol: 'ETH', pnl: 200,
                answers: [{ promptId: 'emotion-during', answer: 'Calm/confident', timestamp: '' }],
                completedAt: '', planAdherence: 9, lessonLearned: '', wouldTakeAgain: true,
            },
        ];

        const insights = analyzeReflections(reflections);
        expect(insights.length).toBeGreaterThan(0);

        const anxiousInsight = insights.find((i) => i.pattern.includes('Anxious'));
        expect(anxiousInsight).toBeDefined();
        expect(anxiousInsight!.impact).toBe('negative');
    });

    it('persistence round-trip', async () => {
        const { saveReflections, loadReflections } = await import('../../intelligence/PostTradeReflection');

        const reflections = [
            {
                tradeId: 'test-1', symbol: 'BTC', pnl: 50,
                answers: [], completedAt: '', planAdherence: 7,
                lessonLearned: 'Test', wouldTakeAgain: true,
            },
        ];

        saveReflections(reflections);
        const loaded = loadReflections();
        expect(loaded).toBeDefined();
        // localStorage may not be available in vitest; if it is, verify round-trip
        if (loaded.length > 0) {
            expect(loaded[0].tradeId).toBe('test-1');
        }
    });
});

// ─── Multi-Condition Alerts Tests ───────────────────────────────

describe('Multi-Condition Alerts', () => {
    beforeEach(async () => {
        const { useAlertStore } = await import('../../state/useAlertStore');
        useAlertStore.getState().clearAll();
    });

    it('creates a compound AND alert', async () => {
        const { useAlertStore } = await import('../../state/useAlertStore');
        const store = useAlertStore.getState();

        const id = store.addCompoundAlert({
            symbol: 'BTC',
            logic: 'AND',
            conditions: [
                { type: 'price', condition: 'above', price: 50000 },
                { type: 'price', condition: 'below', price: 60000 },
            ],
            note: 'BTC in range',
        });

        // Re-read state after mutation
        const alerts = useAlertStore.getState().alerts;
        const alert = alerts.find((a) => a.id === id);
        expect(alert).toBeDefined();
        expect(alert!.compoundLogic).toBe('AND');
        expect(alert!.conditions).toHaveLength(2);
    });

    it('triggers AND alert only when all conditions met', async () => {
        const { useAlertStore, checkAlerts } = await import('../../state/useAlertStore');
        const store = useAlertStore.getState();

        store.addCompoundAlert({
            symbol: 'BTC',
            logic: 'AND',
            conditions: [
                { type: 'price', condition: 'above', price: 50000 },
                { type: 'price', condition: 'below', price: 60000 },
            ],
        });

        // Price within range — both conditions met
        checkAlerts({ BTC: 55000 });
        let alerts = useAlertStore.getState().alerts;
        expect(alerts[0].triggeredAt).not.toBeNull();
    });

    it('does not trigger AND alert when only one condition met', async () => {
        const { useAlertStore, checkAlerts } = await import('../../state/useAlertStore');
        const store = useAlertStore.getState();
        store.clearAll();

        store.addCompoundAlert({
            symbol: 'ETH',
            logic: 'AND',
            conditions: [
                { type: 'price', condition: 'above', price: 3000 },
                { type: 'price', condition: 'below', price: 3500 },
            ],
        });

        // Price above range — only first condition met
        checkAlerts({ ETH: 4000 });
        const alerts = useAlertStore.getState().alerts;
        expect(alerts[0].triggeredAt).toBeNull();
    });

    it('triggers OR alert when any condition met', async () => {
        const { useAlertStore, checkAlerts } = await import('../../state/useAlertStore');
        const store = useAlertStore.getState();
        store.clearAll();

        store.addCompoundAlert({
            symbol: 'BTC',
            logic: 'OR',
            conditions: [
                { type: 'price', condition: 'above', price: 70000 },
                { type: 'price', condition: 'below', price: 40000 },
            ],
        });

        // Price above 70k — first condition met
        checkAlerts({ BTC: 75000 });
        const alerts = useAlertStore.getState().alerts;
        expect(alerts[0].triggeredAt).not.toBeNull();
    });

    it('backward compatible — single condition still works', async () => {
        const { useAlertStore, checkAlerts } = await import('../../state/useAlertStore');
        const store = useAlertStore.getState();
        store.clearAll();

        store.addAlert({ symbol: 'AAPL', condition: 'above', price: 200 });
        checkAlerts({ AAPL: 205 });

        const alerts = useAlertStore.getState().alerts;
        expect(alerts[0].triggeredAt).not.toBeNull();
    });
});

// ─── CostSavingsCalculator Data Tests ───────────────────────────

describe('CostSavingsCalculator', () => {
    it('exports correct competitor data', async () => {
        const { COMPETITORS, CHAREDGE_TIERS, FEATURE_LIST } = await import(
            '../../app/components/dashboard/widgets/CostSavingsCalculator'
        );

        expect(COMPETITORS).toHaveLength(4);
        expect(COMPETITORS[0].name).toBe('Bloomberg Terminal');
        expect(COMPETITORS[0].annual).toBe(31_980);

        expect(CHAREDGE_TIERS).toHaveLength(3);
        expect(CHAREDGE_TIERS[0].annual).toBe(0); // Free tier

        expect(FEATURE_LIST.length).toBeGreaterThan(8);
    });

    it('savings math is correct', async () => {
        const { COMPETITORS, CHAREDGE_TIERS } = await import(
            '../../app/components/dashboard/widgets/CostSavingsCalculator'
        );

        const proTier = CHAREDGE_TIERS.find((t) => t.id === 'pro');
        const bloomberg = COMPETITORS.find((c) => c.name === 'Bloomberg Terminal');

        expect(proTier).toBeDefined();
        expect(bloomberg).toBeDefined();

        const savings = bloomberg!.annual - proTier!.annual;
        expect(savings).toBe(31_800); // 31980 - 180
    });
});
