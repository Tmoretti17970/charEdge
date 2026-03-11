// ═══════════════════════════════════════════════════════════════════
// charEdge — Trade CRUD Integration Tests (Task 4.2.2)
//
// Tests create → read → update → delete trade through Zustand store.
// Verifies that store actions correctly mutate state.
// ═══════════════════════════════════════════════════════════════════

// eslint-disable-next-line import/order
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock telemetry to avoid side effects
vi.mock('../../utils/telemetry.js', () => ({
    trackFirstAction: vi.fn(),
    trackWorkflow: vi.fn(),
}));

import { useJournalStore } from '../../state/useJournalStore.ts';

describe('Trade CRUD — Journal Store', () => {
    beforeEach(() => {
        // Reset store data only (merge, not replace, preserves actions)
        useJournalStore.setState({
            trades: [],
            playbooks: [],
            notes: [],
            tradePlans: [],
            loaded: false,
        });
    });

    it('addTrade inserts a trade at the beginning', () => {
        const trade = { id: 't1', symbol: 'BTC', pnl: 100, side: 'long' };
        useJournalStore.getState().addTrade(trade);

        const { trades } = useJournalStore.getState();
        expect(trades).toHaveLength(1);
        expect(trades[0].id).toBe('t1');
        expect(trades[0].symbol).toBe('BTC');
    });

    it('addTrades bulk-inserts multiple trades', () => {
        const batch = [
            { id: 't1', symbol: 'BTC', pnl: 50 },
            { id: 't2', symbol: 'ETH', pnl: -20 },
            { id: 't3', symbol: 'SOL', pnl: 30 },
        ];
        useJournalStore.getState().addTrades(batch);

        const { trades } = useJournalStore.getState();
        expect(trades).toHaveLength(3);
    });

    it('updateTrade modifies an existing trade by id', () => {
        useJournalStore.getState().addTrade({ id: 't1', symbol: 'BTC', pnl: 100 });
        useJournalStore.getState().updateTrade('t1', { pnl: 200, notes: 'Great trade' });

        const updated = useJournalStore.getState().trades[0];
        expect(updated.pnl).toBe(200);
        expect(updated.notes).toBe('Great trade');
        expect(updated.symbol).toBe('BTC'); // Unchanged fields preserved
    });

    it('deleteTrade removes a trade by id', () => {
        useJournalStore.getState().addTrade({ id: 't1', symbol: 'BTC' });
        useJournalStore.getState().addTrade({ id: 't2', symbol: 'ETH' });

        useJournalStore.getState().deleteTrade('t1');

        const { trades } = useJournalStore.getState();
        expect(trades).toHaveLength(1);
        expect(trades[0].id).toBe('t2');
    });

    it('deleteTrade with non-existent id is a no-op', () => {
        useJournalStore.getState().addTrade({ id: 't1', symbol: 'BTC' });
        useJournalStore.getState().deleteTrade('nonexistent');

        expect(useJournalStore.getState().trades).toHaveLength(1);
    });

    it('hydrate replaces full state', () => {
        useJournalStore.getState().addTrade({ id: 't1', symbol: 'BTC' });
        useJournalStore.getState().hydrate({
            trades: [{ id: 'h1', symbol: 'SOL' }],
            playbooks: ['breakout'],
        });

        const state = useJournalStore.getState();
        expect(state.trades).toHaveLength(1);
        expect(state.trades[0].id).toBe('h1');
        expect(state.loaded).toBe(true);
    });
});
