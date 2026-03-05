// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Store Tests
// Tests for: useJournalStore, useChartStore, useUserStore, useUIStore
// ═══════════════════════════════════════════════════════════════════

import { useUserStore } from '../../state/useUserStore.ts';
import { describe, it, expect } from 'vitest';
import { useJournalStore } from '../../state/useJournalStore.ts';
import { useChartStore } from '../../state/useChartStore.ts';
import { useUIStore } from '../../state/useUIStore.ts';

const mkTrade = (id = 'test_1', pnl = 100) => ({
  id,
  date: '2025-01-15T10:00:00Z',
  symbol: 'BTC',
  side: 'long',
  pnl,
  fees: 2,
});

// ═══ Trade Store ════════════════════════════════════════════════
describe('useJournalStore', () => {
  it('starts with empty arrays', () => {
    const s = useJournalStore.getState();
    expect(Array.isArray(s.trades)).toBe(true);
    expect(Array.isArray(s.playbooks)).toBe(true);
    expect(Array.isArray(s.notes)).toBe(true);
  });

  it('addTrade prepends to array', () => {
    useJournalStore.setState({ trades: [] });
    useJournalStore.getState().addTrade(mkTrade('t1', 100));
    useJournalStore.getState().addTrade(mkTrade('t2', 200));
    const trades = useJournalStore.getState().trades;
    expect(trades.length).toBe(2);
    expect(trades[0].id).toBe('t2');
  });

  it('addTrades prepends batch', () => {
    useJournalStore.setState({ trades: [mkTrade('old', 50)] });
    useJournalStore.getState().addTrades([mkTrade('n1', 100), mkTrade('n2', 200)]);
    const trades = useJournalStore.getState().trades;
    expect(trades.length).toBe(3);
    expect(trades[0].id).toBe('n1');
    expect(trades[2].id).toBe('old');
  });

  it('deleteTrade removes by id', () => {
    useJournalStore.setState({ trades: [mkTrade('a'), mkTrade('b'), mkTrade('c')] });
    useJournalStore.getState().deleteTrade('b');
    const ids = useJournalStore.getState().trades.map((t) => t.id);
    expect(ids).toEqual(['a', 'c']);
  });

  it('updateTrade merges fields', () => {
    useJournalStore.setState({ trades: [mkTrade('x', 100)] });
    useJournalStore.getState().updateTrade('x', { pnl: 999, emotion: 'calm' });
    const t = useJournalStore.getState().trades[0];
    expect(t.pnl).toBe(999);
    expect(t.emotion).toBe('calm');
    expect(t.symbol).toBe('BTC');
  });

  it('addPlaybook / deletePlaybook', () => {
    useJournalStore.setState({ playbooks: [] });
    useJournalStore.getState().addPlaybook({ id: 'pb1', name: 'Breakout' });
    useJournalStore.getState().addPlaybook({ id: 'pb2', name: 'Reversal' });
    expect(useJournalStore.getState().playbooks.length).toBe(2);
    useJournalStore.getState().deletePlaybook('pb1');
    expect(useJournalStore.getState().playbooks.length).toBe(1);
    expect(useJournalStore.getState().playbooks[0].id).toBe('pb2');
  });

  it('addNote / deleteNote', () => {
    useJournalStore.setState({ notes: [] });
    useJournalStore.getState().addNote({ id: 'n1', text: 'Hello' });
    expect(useJournalStore.getState().notes[0].id).toBe('n1');
    useJournalStore.getState().deleteNote('n1');
    expect(useJournalStore.getState().notes.length).toBe(0);
  });

  it('hydrate replaces all data', () => {
    useJournalStore.getState().hydrate({
      trades: [mkTrade('h1')],
      playbooks: [{ id: 'p1', name: 'Test' }],
      notes: [{ id: 'n1', text: 'Note' }],
      tradePlans: [],
    });
    const s = useJournalStore.getState();
    expect(s.trades.length).toBe(1);
    expect(s.playbooks.length).toBe(1);
    expect(s.loaded).toBe(true);
  });

  it('reset clears to demo data', () => {
    useJournalStore.setState({ trades: [mkTrade('a'), mkTrade('b')], notes: [{ id: 'n' }] });
    useJournalStore.getState().reset([mkTrade('demo1')], [{ id: 'dpb' }]);
    const s = useJournalStore.getState();
    expect(s.trades.length).toBe(1);
    expect(s.trades[0].id).toBe('demo1');
    expect(s.playbooks.length).toBe(1);
    expect(s.notes.length).toBe(0);
  });

  it('subscribe fires on state change', () => {
    useJournalStore.setState({ trades: [] });
    let called = false;
    const unsub = useJournalStore.subscribe(() => {
      called = true;
    });
    useJournalStore.getState().addTrade(mkTrade('sub1'));
    expect(called).toBe(true);
    unsub();
  });

  it('selector returns slice via getState', () => {
    useJournalStore.setState({ trades: [mkTrade('s1', 500)] });
    const trades = useJournalStore.getState().trades;
    expect(trades.length).toBe(1);
    expect(trades[0].pnl).toBe(500);
  });
});

// ═══ Chart Store ════════════════════════════════════════════════
describe('useChartStore', () => {
  it('has default symbol and tf', () => {
    const s = useChartStore.getState();
    expect(s.symbol).toBe('BTC');
    expect(s.tf).toBe('1h');
  });

  it('setSymbol uppercases', () => {
    useChartStore.getState().setSymbol('eth');
    expect(useChartStore.getState().symbol).toBe('ETH');
  });

  it('setTf updates timeframe', () => {
    useChartStore.getState().setTf('1d');
    expect(useChartStore.getState().tf).toBe('1d');
  });

  it('toggleLogScale flips', () => {
    useChartStore.setState({ logScale: false });
    useChartStore.getState().toggleLogScale();
    expect(useChartStore.getState().logScale).toBe(true);
    useChartStore.getState().toggleLogScale();
    expect(useChartStore.getState().logScale).toBe(false);
  });

  it('addIndicator / removeIndicator', () => {
    useChartStore.setState({ indicators: [] });
    useChartStore.getState().addIndicator({ type: 'rsi', params: { period: 14 } });
    expect(useChartStore.getState().indicators.length).toBe(1);
    useChartStore.getState().removeIndicator(0);
    expect(useChartStore.getState().indicators.length).toBe(0);
  });

  it('toggleReplay enters/exits replay mode', () => {
    useChartStore.setState({
      replayMode: false,
      data: Array(100).fill({ close: 100 }),
    });
    useChartStore.getState().toggleReplay();
    expect(useChartStore.getState().replayMode).toBe(true);
    useChartStore.getState().toggleReplay();
    expect(useChartStore.getState().replayMode).toBe(false);
  });
});

// ═══ Settings Store ═════════════════════════════════════════════
describe('useUserStore', () => {
  it('has default settings', () => {
    const s = useUserStore.getState();
    expect(s.dailyLossLimit).toBe(0);
    expect(s.defaultSymbol).toBe('BTC');
  });

  it('update merges settings', () => {
    useUserStore.getState().update({ dailyLossLimit: 500 });
    expect(useUserStore.getState().dailyLossLimit).toBe(500);
    expect(useUserStore.getState().defaultSymbol).toBe('BTC');
  });

  it('hydrate restores from storage', () => {
    useUserStore.getState().hydrateSettings({
      dailyLossLimit: 1000,
      defaultSymbol: 'ETH',
    });
    expect(useUserStore.getState().dailyLossLimit).toBe(1000);
    expect(useUserStore.getState().defaultSymbol).toBe('ETH');
  });

  it('reset restores defaults', () => {
    useUserStore.getState().update({ dailyLossLimit: 9999 });
    useUserStore.getState().resetSettings();
    expect(useUserStore.getState().dailyLossLimit).toBe(0);
  });
});

// ═══ UI Store ═══════════════════════════════════════════════════
describe('useUIStore', () => {
  it('starts on dashboard', () => {
    expect(useUIStore.getState().page).toBe('dashboard');
  });

  it('setPage changes page', () => {
    useUIStore.getState().setPage('charts');
    expect(useUIStore.getState().page).toBe('charts');
  });

  it('modal open/close', () => {
    useUIStore.getState().openModal({ id: 't1', pnl: 100 });
    expect(useUIStore.getState().modal).not.toBeNull();
    expect(useUIStore.getState().modal.id).toBe('t1');
    useUIStore.getState().closeModal();
    expect(useUIStore.getState().modal).toBeNull();
  });

  it('toggleZen flips', () => {
    useUIStore.setState({ zenMode: false });
    useUIStore.getState().toggleZen();
    expect(useUIStore.getState().zenMode).toBe(true);
  });

  it('closeAll closes everything', () => {
    useUIStore.setState({
      modal: { id: 'x' },
      confirmDialog: { msg: 'y' },
      cmdPaletteOpen: true,
      shortcutsOpen: true,
      quickTradeOpen: true,
    });
    useUIStore.getState().closeAll();
    const s = useUIStore.getState();
    expect(s.modal).toBeNull();
    expect(s.confirmDialog).toBeNull();
    expect(s.cmdPaletteOpen).toBe(false);
    expect(s.shortcutsOpen).toBe(false);
    expect(s.quickTradeOpen).toBe(false);
  });
});
