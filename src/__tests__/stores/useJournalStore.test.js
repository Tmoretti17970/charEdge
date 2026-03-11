// ═══════════════════════════════════════════════════════════════════
// charEdge — Journal Store Unit Tests
//
// P1-7: Tests for useJournalStore covering trade, session, and
// auto-archive slices.
// ═══════════════════════════════════════════════════════════════════

// eslint-disable-next-line import/order
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock telemetry to prevent side effects
vi.mock('../../utils/telemetry.js', () => ({
    trackFirstAction: vi.fn(),
    trackWorkflow: vi.fn(),
}));

import useJournalStore from '../../state/useJournalStore.ts';

const store = useJournalStore;

function makeTrade(overrides = {}) {
    return {
        id: `trade-${Date.now()}-${Math.random()}`,
        symbol: 'AAPL',
        side: 'long',
        entry: 150,
        exit: 155,
        pnl: 50,
        date: new Date().toISOString(),
        ...overrides,
    };
}

describe('Journal Store — Trade Slice', () => {
    beforeEach(() => {
        store.setState({ trades: [], playbooks: [], notes: [], tradePlans: [], loaded: false });
    });

    it('initializes with empty arrays', () => {
        const s = store.getState();
        expect(s.trades).toEqual([]);
        expect(s.playbooks).toEqual([]);
        expect(s.notes).toEqual([]);
        expect(s.tradePlans).toEqual([]);
    });

    // ─── Trade CRUD ────────────────────────────────────────────

    it('addTrade() prepends to trades list', () => {
        const t1 = makeTrade({ id: 't1' });
        const t2 = makeTrade({ id: 't2' });
        store.getState().addTrade(t1);
        store.getState().addTrade(t2);
        expect(store.getState().trades).toHaveLength(2);
        expect(store.getState().trades[0].id).toBe('t2'); // Most recent first
    });

    it('addTrades() bulk imports prepend', () => {
        const existing = makeTrade({ id: 'existing' });
        store.getState().addTrade(existing);

        const imports = [makeTrade({ id: 'i1' }), makeTrade({ id: 'i2' })];
        store.getState().addTrades(imports);

        expect(store.getState().trades).toHaveLength(3);
        expect(store.getState().trades[0].id).toBe('i1'); // Imported first
    });

    it('deleteTrade() removes by id', () => {
        const t = makeTrade({ id: 'del-me' });
        store.getState().addTrade(t);
        store.getState().deleteTrade('del-me');
        expect(store.getState().trades).toHaveLength(0);
    });

    it('updateTrade() merges updates', () => {
        const t = makeTrade({ id: 'upd', pnl: 50 });
        store.getState().addTrade(t);
        store.getState().updateTrade('upd', { pnl: 100, notes: 'great trade' });
        const updated = store.getState().trades.find(x => x.id === 'upd');
        expect(updated.pnl).toBe(100);
        expect(updated.notes).toBe('great trade');
    });

    // ─── Playbook CRUD ────────────────────────────────────────

    it('addPlaybook() / deletePlaybook()', () => {
        store.getState().addPlaybook({ id: 'pb1', name: 'Opening Range Breakout' });
        expect(store.getState().playbooks).toHaveLength(1);
        store.getState().deletePlaybook('pb1');
        expect(store.getState().playbooks).toHaveLength(0);
    });

    // ─── Note CRUD ─────────────────────────────────────────────

    it('addNote() prepends / deleteNote() removes', () => {
        store.getState().addNote({ id: 'n1', text: 'market is choppy' });
        store.getState().addNote({ id: 'n2', text: 'wait for trend' });
        expect(store.getState().notes).toHaveLength(2);
        expect(store.getState().notes[0].id).toBe('n2'); // Most recent first

        store.getState().deleteNote('n1');
        expect(store.getState().notes).toHaveLength(1);
    });

    it('updateNote() merges updates', () => {
        store.getState().addNote({ id: 'nu', text: 'draft' });
        store.getState().updateNote('nu', { text: 'final' });
        expect(store.getState().notes[0].text).toBe('final');
    });

    // ─── Trade Plan CRUD ──────────────────────────────────────

    it('addTradePlan() / deleteTradePlan() / updateTradePlan()', () => {
        store.getState().addTradePlan({ id: 'tp1', symbol: 'TSLA', thesis: 'breakout' });
        expect(store.getState().tradePlans).toHaveLength(1);

        store.getState().updateTradePlan('tp1', { thesis: 'fakeout' });
        expect(store.getState().tradePlans[0].thesis).toBe('fakeout');

        store.getState().deleteTradePlan('tp1');
        expect(store.getState().tradePlans).toHaveLength(0);
    });

    // ─── Hydration ─────────────────────────────────────────────

    it('hydrate() loads data and sets loaded=true', () => {
        store.getState().hydrate({
            trades: [makeTrade({ id: 'h1' })],
            playbooks: [{ id: 'pb-h', name: 'Test' }],
            notes: [],
            tradePlans: [],
        });
        const s = store.getState();
        expect(s.loaded).toBe(true);
        expect(s.trades).toHaveLength(1);
        expect(s.playbooks).toHaveLength(1);
    });

    it('hydrate() handles empty data gracefully', () => {
        store.getState().hydrate({});
        const s = store.getState();
        expect(s.loaded).toBe(true);
        expect(s.trades).toEqual([]);
    });

    // ─── Reset ─────────────────────────────────────────────────

    it('reset() restores to demo data', () => {
        store.getState().addTrade(makeTrade({ id: 'existing' }));
        const demoTrades = [makeTrade({ id: 'demo1' })];
        store.getState().reset(demoTrades, []);
        expect(store.getState().trades).toHaveLength(1);
        expect(store.getState().trades[0].id).toBe('demo1');
    });
});

describe('Journal Store — Session Slice', () => {
    beforeEach(() => {
        store.setState({ sessionOverride: null });
    });

    it('sessionState is a valid state key', () => {
        const s = store.getState();
        const valid = ['PRE_MARKET', 'ACTIVE', 'POST_MARKET', 'COOLING_DOWN', 'DEBRIEF'];
        expect(valid).toContain(s.sessionState);
    });

    it('getConfig() returns a state config object', () => {
        const config = store.getState().getConfig();
        expect(config).toHaveProperty('id');
        expect(config).toHaveProperty('label');
        expect(config).toHaveProperty('emoji');
        expect(config).toHaveProperty('coaching');
        expect(config).toHaveProperty('actions');
    });

    it('startDebrief() overrides state to DEBRIEF', () => {
        store.getState().startDebrief();
        expect(store.getState().sessionOverride).toBe('DEBRIEF');
        const config = store.getState().getConfig();
        expect(config.id).toBe('debrief');
    });

    it('endDebrief() clears override', () => {
        store.getState().startDebrief();
        store.getState().endDebrief();
        expect(store.getState().sessionOverride).toBeNull();
    });

    it('startCooldown() overrides state to COOLING_DOWN', () => {
        store.getState().startCooldown();
        expect(store.getState().sessionOverride).toBe('COOLING_DOWN');
    });

    it('endCooldown() clears override', () => {
        store.getState().startCooldown();
        store.getState().endCooldown();
        expect(store.getState().sessionOverride).toBeNull();
    });

    it('tick() does not override when sessionOverride is set', () => {
        store.getState().startDebrief();
        const original = store.getState().sessionState;
        store.getState().tick([], { consecLosses: 5 });
        expect(store.getState().sessionState).toBe(original); // Should not change
    });

    it('resetSession() clears override and auto-detects', () => {
        store.getState().startDebrief();
        store.getState().resetSession();
        expect(store.getState().sessionOverride).toBeNull();
        expect(store.getState().sessionState).toBeTruthy();
    });
});
