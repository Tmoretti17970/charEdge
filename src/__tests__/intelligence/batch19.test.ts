// ═══════════════════════════════════════════════════════════════════
// charEdge — Batch 19: Intelligence Pipe Tests
//
// Tests for: MFEMAETracker, AlphaTagEngine, GhostTradeEngine,
// DecisionTreeJournal, TruePnL integration, Trade Narrative
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';

// ─── 19.3: MFE/MAE Tracker ─────────────────────────────────────

describe('19.3 — MFEMAETracker', () => {
    let tracker;

    beforeEach(async () => {
        const mod = await import('../../trading/MFEMAETracker.ts');
        tracker = new mod.MFEMAETracker();
    });

    it('tracks a long trade MFE correctly', () => {
        tracker.startTracking('t1', 100, 'long');
        tracker.updateTick('t1', 105); // +5 MFE
        tracker.updateTick('t1', 102);
        const result = tracker.closeTracking('t1', 103);
        expect(result).not.toBeNull();
        expect(result.mfe).toBe(5);
        expect(result.mae).toBe(0); // never went below entry
    });

    it('tracks a long trade MAE correctly', () => {
        tracker.startTracking('t1', 100, 'long');
        tracker.updateTick('t1', 97); // -3 MAE
        tracker.updateTick('t1', 102); // +2 MFE
        const result = tracker.closeTracking('t1', 101);
        expect(result.mfe).toBe(2);
        expect(result.mae).toBe(3);
    });

    it('tracks a short trade correctly', () => {
        tracker.startTracking('t1', 100, 'short');
        tracker.updateTick('t1', 95); // +5 MFE (price went down = good for short)
        tracker.updateTick('t1', 103); // +3 MAE (price went up = bad for short)
        const result = tracker.closeTracking('t1', 97);
        expect(result.mfe).toBe(5);
        expect(result.mae).toBe(3);
    });

    it('computes efficiency ratio', () => {
        tracker.startTracking('t1', 100, 'long');
        tracker.updateTick('t1', 110); // MFE = 10
        const result = tracker.closeTracking('t1', 105); // captured 5 of 10
        expect(result.efficiencyRatio).toBe(0.5);
    });

    it('handles flat trade (no movement)', () => {
        tracker.startTracking('t1', 100, 'long');
        const result = tracker.closeTracking('t1', 100);
        expect(result.mfe).toBe(0);
        expect(result.mae).toBe(0);
        expect(result.efficiencyRatio).toBe(0);
    });

    it('returns null for unknown trade', () => {
        const result = tracker.closeTracking('unknown', 100);
        expect(result).toBeNull();
    });

    it('tracks multiple trades independently', () => {
        tracker.startTracking('t1', 100, 'long');
        tracker.startTracking('t2', 200, 'short');
        tracker.updateTick('t1', 110);
        tracker.updateTick('t2', 190);
        const r1 = tracker.closeTracking('t1', 108);
        const r2 = tracker.closeTracking('t2', 195);
        expect(r1.mfe).toBe(10);
        expect(r2.mfe).toBe(10); // short: 200 - 190 = 10
    });

    it('peek shows current state without closing', () => {
        tracker.startTracking('t1', 100, 'long');
        tracker.updateTick('t1', 110);
        const peek = tracker.peek('t1', 108);
        expect(peek.mfe).toBe(10);
        expect(tracker.isTracking('t1')).toBe(true);
    });

    it('tick count is accurate', () => {
        tracker.startTracking('t1', 100, 'long');
        tracker.updateTick('t1', 101);
        tracker.updateTick('t1', 102);
        tracker.updateTick('t1', 103);
        const result = tracker.closeTracking('t1', 102);
        expect(result.tickCount).toBe(3);
    });

    it('mfePct and maePct are calculated', () => {
        tracker.startTracking('t1', 100, 'long');
        tracker.updateTick('t1', 110); // 10% MFE
        tracker.updateTick('t1', 95);  // 5% MAE
        const result = tracker.closeTracking('t1', 105);
        expect(result.mfePct).toBe(10);
        expect(result.maePct).toBe(5);
    });
});

// ─── 19.5: AlphaTagEngine ───────────────────────────────────────

describe('19.5 — AlphaTagEngine', () => {
    let engine;

    beforeEach(async () => {
        const mod = await import('../../psychology/AlphaTagEngine.ts');
        engine = new mod.AlphaTagEngine();
    });

    it('tags RSI oversold', () => {
        const result = engine.generateTags([{ name: 'RSI', value: 25 }], []);
        expect(result.tags).toContain('rsi-oversold');
    });

    it('tags RSI overbought', () => {
        const result = engine.generateTags([{ name: 'RSI', value: 75 }], []);
        expect(result.tags).toContain('rsi-overbought');
    });

    it('tags MACD bullish', () => {
        const result = engine.generateTags([{ name: 'MACD', value: 0.5 }], []);
        expect(result.tags).toContain('macd-bullish');
    });

    it('generates signals with descriptions', () => {
        const result = engine.generateTags([{ name: 'RSI', value: 25 }], []);
        expect(result.signals.length).toBeGreaterThan(0);
        expect(result.signals[0].description).toBeTruthy();
    });

    it('deduplicates tags', () => {
        // Two indicators that could generate the same tag
        const result = engine.generateTags(
            [{ name: 'RSI', value: 25 }, { name: 'RSI', value: 20 }],
            [],
        );
        const rsiTags = result.tags.filter((t) => t === 'rsi-oversold');
        expect(rsiTags.length).toBe(1);
    });

    it('detects volume spike from bars', () => {
        const bars = Array.from({ length: 20 }, (_, _i) => ({
            open: 100, high: 102, low: 98, close: 101, volume: 1000,
        }));
        // Last bar with 3x volume
        bars.push({ open: 100, high: 102, low: 98, close: 101, volume: 3500 });
        const result = engine.generateTags([], bars);
        expect(result.tags).toContain('volume-spike');
    });

    it('detects gap up from bars', () => {
        const bars = [
            { open: 100, high: 102, low: 98, close: 100, volume: 1000 },
            { open: 102, high: 104, low: 101, close: 103, volume: 1000 }, // gap up 2%
        ];
        const result = engine.generateTags([], bars);
        expect(result.tags).toContain('gap-up');
    });

    it('detects gap down from bars', () => {
        const bars = [
            { open: 100, high: 102, low: 98, close: 100, volume: 1000 },
            { open: 97, high: 99, low: 96, close: 97, volume: 1000 }, // gap down 3%
        ];
        const result = engine.generateTags([], bars);
        expect(result.tags).toContain('gap-down');
    });

    it('does NOT flag tiny gap (0.5%)', () => {
        const bars = [
            { open: 100, high: 102, low: 98, close: 100, volume: 1000 },
            { open: 100.5, high: 103, low: 100, close: 102, volume: 1000 }, // 0.5% — well below threshold
        ];
        const result = engine.generateTags([], bars);
        expect(result.tags).not.toContain('gap-up');
        expect(result.tags).not.toContain('gap-down');
    });

    it('flags gap at exact boundary (2%)', () => {
        const bars = [
            { open: 100, high: 102, low: 98, close: 100, volume: 1000 },
            { open: 102, high: 104, low: 101, close: 103, volume: 1000 }, // exactly 2%
        ];
        const result = engine.generateTags([], bars);
        expect(result.tags).toContain('gap-up');
    });

    it('queryByTag computes win rate', () => {
        const trades = [
            { tags: ['rsi-oversold'], pnl: 50 },
            { tags: ['rsi-oversold'], pnl: -20 },
            { tags: ['rsi-oversold'], pnl: 30 },
            { tags: ['macd-bullish'], pnl: 10 },
        ];
        const result = engine.queryByTag(trades, 'rsi-oversold');
        expect(result.tradeCount).toBe(3);
        expect(result.winCount).toBe(2);
        expect(result.winRate).toBeCloseTo(66.67, 0);
    });

    it('getAllTagStats returns sorted results', () => {
        const trades = [
            { tags: ['rsi-oversold', 'macd-bullish'], pnl: 50 },
            { tags: ['rsi-oversold'], pnl: 30 },
            { tags: ['macd-bullish'], pnl: -10 },
        ];
        const stats = engine.getAllTagStats(trades);
        expect(stats.length).toBe(2);
        expect(stats[0].tradeCount).toBeGreaterThanOrEqual(stats[1].tradeCount);
    });
});

// ─── 19.2: GhostTradeEngine ────────────────────────────────────

describe('19.2 — GhostTradeEngine', () => {
    let engine;

    beforeEach(async () => {
        const mod = await import('../../trading/GhostTradeEngine.ts');
        engine = new mod.GhostTradeEngine();
        engine.setSymbol('BTCUSD');
    });

    it('creates ghost trade on hline crossover (up)', () => {
        engine.addDrawing({ id: 'd1', type: 'hline', price: 100 });
        engine.onTick({ close: 99, high: 99, low: 98, time: 1000 }); // below
        engine.onTick({ close: 101, high: 101, low: 99, time: 2000 }); // crossed up
        const ghosts = engine.getActiveGhosts();
        expect(ghosts.length).toBe(1);
        expect(ghosts[0].side).toBe('long');
    });

    it('creates ghost trade on hline crossover (down)', () => {
        engine.addDrawing({ id: 'd1', type: 'hline', price: 100 });
        engine.onTick({ close: 101, high: 102, low: 100, time: 1000 }); // above
        engine.onTick({ close: 99, high: 100, low: 98, time: 2000 }); // crossed down
        const ghosts = engine.getActiveGhosts();
        expect(ghosts.length).toBe(1);
        expect(ghosts[0].side).toBe('short');
    });

    it('updates ghost PnL on subsequent ticks', () => {
        engine.addDrawing({ id: 'd1', type: 'hline', price: 100 });
        engine.onTick({ close: 99, high: 99, low: 98, time: 1000 });
        engine.onTick({ close: 101, high: 101, low: 99, time: 2000 }); // entry
        engine.onTick({ close: 105, high: 105, low: 101, time: 3000 }); // +4
        const ghosts = engine.getActiveGhosts();
        expect(ghosts[0].currentPnL).toBeGreaterThan(0);
    });

    it('emits events on ghost trade creation', () => {
        const events = [];
        engine.onGhostTrade((e) => events.push(e));
        engine.addDrawing({ id: 'd1', type: 'hline', price: 100 });
        engine.onTick({ close: 99, high: 99, low: 98, time: 1000 });
        engine.onTick({ close: 101, high: 101, low: 99, time: 2000 });
        expect(events.some((e) => e.type === 'entry')).toBe(true);
    });

    it('does not create duplicate ghosts for same drawing', () => {
        engine.addDrawing({ id: 'd1', type: 'hline', price: 100 });
        engine.onTick({ close: 99, high: 99, low: 98, time: 1000 });
        engine.onTick({ close: 101, high: 101, low: 99, time: 2000 }); // first cross
        engine.onTick({ close: 99, high: 100, low: 98, time: 3000 });
        engine.onTick({ close: 101, high: 101, low: 99, time: 4000 }); // second cross - no dup
        expect(engine.getActiveGhosts().length).toBe(1);
    });

    it('closes ghost trades', () => {
        engine.addDrawing({ id: 'd1', type: 'hline', price: 100 });
        engine.onTick({ close: 99, high: 99, low: 98, time: 1000 });
        engine.onTick({ close: 101, high: 101, low: 99, time: 2000 });
        const ghost = engine.getActiveGhosts()[0];
        const closed = engine.closeGhost(ghost.id, 105);
        expect(closed.closed).toBe(true);
        expect(engine.getActiveGhosts().length).toBe(0);
    });

    it('respects maxGhosts limit', () => {
        engine.setMaxGhosts(2);
        // Create 3 drawings
        for (let i = 0; i < 3; i++) {
            engine.addDrawing({ id: `d${i}`, type: 'hline', price: 100 + i * 10 });
        }
        engine.onTick({ close: 95, high: 95, low: 90, time: 1000 }); // below all
        engine.onTick({ close: 125, high: 125, low: 95, time: 2000 }); // above all — creates 3
        expect(engine.getActiveGhosts().length).toBeLessThanOrEqual(2);
    });
});

// ─── 19.8: DecisionTreeJournal ──────────────────────────────────

describe('19.8 — DecisionTreeJournal', () => {
    let tree;

    beforeEach(async () => {
        const mod = await import('../../journal/DecisionTreeJournal.ts');
        tree = new mod.DecisionTreeJournal();
    });

    it('starts and returns first node', () => {
        const node = tree.start();
        expect(node).not.toBeNull();
        expect(node.question).toBeTruthy();
        expect(node.choices.length).toBeGreaterThan(0);
    });

    it('navigates through all steps', () => {
        let node = tree.start();
        const selections = [];
        while (node) {
            selections.push(node.question);
            node = tree.selectChoice(0); // Always pick first
        }
        expect(selections.length).toBe(4); // 4 default levels
        expect(tree.isComplete()).toBe(true);
    });

    it('produces result with tags and classifications', () => {
        tree.start();
        tree.selectChoice(0); // setup
        tree.selectChoice(0); // conviction
        tree.selectChoice(0); // rr
        tree.selectChoice(0); // timeframe
        const result = tree.getResult();
        expect(result.classifications.length).toBe(4);
        expect(result.tags.length).toBe(4);
        expect(result.tags[0]).toContain('setup:');
    });

    it('skip advances without selection', () => {
        tree.start();
        tree.skip(); // skip setup
        const node = tree.getCurrentNode();
        expect(node.id).toBe('conviction');
        expect(tree.getStepInfo().current).toBe(2);
    });

    it('goBack returns to previous node', () => {
        tree.start();
        tree.selectChoice(0);
        const node = tree.goBack();
        expect(node.id).toBe('setup');
    });

    it('progress is calculated correctly', () => {
        tree.start();
        expect(tree.getProgress()).toBe(0);
        tree.selectChoice(0);
        expect(tree.getProgress()).toBe(0.25);
        tree.selectChoice(0);
        expect(tree.getProgress()).toBe(0.5);
    });

    it('reset clears all state', () => {
        tree.start();
        tree.selectChoice(0);
        tree.reset();
        expect(tree.getCurrentNode()).toBeNull();
        expect(tree.getResult().classifications.length).toBe(0);
    });

    it('getDefaultTree returns a copy', async () => {
        const mod = await import('../../journal/DecisionTreeJournal.ts');
        const config = mod.DecisionTreeJournal.getDefaultTree();
        expect(config.nodes.length).toBe(4);
        expect(config.nodeOrder.length).toBe(4);
    });
});

// ─── 19.4: TruePnL Integration ─────────────────────────────────

describe('19.4 — TruePnL computation', () => {
    it('computeTruePnL handles all cost components', async () => {
        const { computeTruePnL } = await import('../../trading/TruePnL.ts');
        const result = computeTruePnL({
            entry: 100,
            exit: 110,
            qty: 10,
            fees: 5,
            fundingRate: 2,
            intendedEntry: 99,
            intendedExit: 111,
            side: 'long',
        });
        expect(result.grossPnL).toBe(100); // (110-100)*10
        expect(result.commissions).toBe(5);
        expect(result.fundingRate).toBe(2);
        expect(result.slippage).toBeGreaterThan(0); // intended vs actual
        expect(result.netPnL).toBeLessThan(result.grossPnL);
    });

    it('computeBatchTruePnL aggregates correctly', async () => {
        const { computeBatchTruePnL } = await import('../../trading/TruePnL.ts');
        const summary = computeBatchTruePnL([
            { entry: 100, exit: 110, qty: 1, fees: 2 },
            { entry: 200, exit: 190, qty: 1, fees: 3, side: 'short' },
        ]);
        expect(summary.perTrade.length).toBe(2);
        expect(summary.totalCommissions).toBe(5);
    });
});

// ─── 19.7: Trade Narrative Template ─────────────────────────────

describe('19.7 — Trade Narrative template generation', () => {
    it('TradeNarrativeCard exports without errors', async () => {
        // Just verify the module loads
        const mod = await import('../../app/components/journal/TradeNarrativeCard.jsx');
        expect(mod.default).toBeDefined();
        expect(mod.TradeNarrativeCard).toBeDefined();
    });
});

// ─── 19.1: CopilotStreamBar ────────────────────────────────────

describe('19.1 — CopilotStreamBar', () => {
    it('exports without errors', async () => {
        const mod = await import('../../app/components/chart/CopilotStreamBar.jsx');
        expect(mod.default).toBeDefined();
    });
});
