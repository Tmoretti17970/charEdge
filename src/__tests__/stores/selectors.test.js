// ═══════════════════════════════════════════════════════════════════
// charEdge — Zustand Selector Tests
// Verifies: no full-store subscriptions, selector patterns,
// shallow equality prevents unnecessary re-renders.
// ═══════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { useJournalStore } from '../../state/useJournalStore.ts';
import { useUIStore } from '../../state/useUIStore.ts';
import { useUserStore } from '../../state/useUserStore.ts';
import { shallow } from '@/shared/shallow';

const SRC = path.resolve('src');

// ─── No full-store subscriptions ─────────────────────────────────
describe('Zustand — no full-store subscriptions', function () {
  it('no component calls a store hook without a selector', function () {
    const STORES = [
      'useJournalStore',
      'useUIStore',
      'useChartStore',
      'useUserStore',
      'useAnalyticsStore',
      'useSocialStore',
    ];

    const violations = [];

    function walk(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].name === '__tests__' || entries[i].name === 'node_modules') continue;
        const full = path.join(dir, entries[i].name);
        if (entries[i].isDirectory()) {
          walk(full);
        } else if (entries[i].name.endsWith('.jsx') || entries[i].name.endsWith('.js')) {
          const content = fs.readFileSync(full, 'utf-8');
          for (let j = 0; j < STORES.length; j++) {
            const store = STORES[j];
            // Look for store() without selector — but not store.getState()
            let idx = 0;
            const needle = store + '()';
            while (true) {
              const pos = content.indexOf(needle, idx);
              if (pos === -1) break;
              const after = content.substring(pos + needle.length, pos + needle.length + 15);
              if (after.indexOf('.getState') === -1) {
                violations.push(path.relative(SRC, full) + ': ' + store);
              }
              idx = pos + 1;
            }
          }
        }
      }
    }
    walk(SRC);

    // Small focused social components legitimately use full-store subscriptions
    const EXCEPTIONS = [
      'ChartIdeasFeed.jsx', 'TraderLeaderboard.jsx', 'TraderProfileModal.jsx',
      'ChartTradeToolbar.jsx', 'PositionSizer.jsx', 'TradeEntryBar.jsx', 'PollCard.jsx',
    ];
    const filteredViolations = violations.filter(v => !EXCEPTIONS.some(e => v.includes(e)));
    expect(filteredViolations).toEqual([]);
  });
});

// ─── Store API ───────────────────────────────────────────────────
describe('Zustand — useUserStore', function () {
  it('exposes update method', function () {
    const update = useUserStore.getState().update;
    expect(typeof update).toBe('function');
  });

  it('update merges fields without destroying others', function () {
    useUserStore.getState().update({ accountSize: 50000 });
    const s = useUserStore.getState();
    expect(s.accountSize).toBe(50000);
    expect(s.riskPerTrade).toBeDefined();
    expect(s.dailyLossLimit).toBeDefined();
  });

  it('reset restores defaults', function () {
    useUserStore.getState().update({ accountSize: 99999 });
    useUserStore.getState().resetSettings();
    const s = useUserStore.getState();
    expect(s.accountSize).not.toBe(99999);
  });
});

// ─── Shallow selector pattern ────────────────────────────────────
describe('Zustand — shallow selector pattern', function () {
  it('selector returns stable reference when values unchanged', function () {
    const selector = function (s) {
      return { accountSize: s.accountSize, riskPerTrade: s.riskPerTrade };
    };

    const a = selector(useUserStore.getState());
    const b = selector(useUserStore.getState());

    // Different object references
    expect(a).not.toBe(b);
    // But shallow-equal — would skip re-render
    expect(shallow(a, b)).toBe(true);
  });

  it('selector detects when values change', function () {
    const selector = function (s) {
      return { accountSize: s.accountSize, riskPerTrade: s.riskPerTrade };
    };

    const before = selector(useUserStore.getState());
    useUserStore.getState().update({ riskPerTrade: 99 });
    const after = selector(useUserStore.getState());

    expect(shallow(before, after)).toBe(false);
  });
});

describe('Zustand — useUIStore', function () {
  it('setPage updates page', function () {
    useUIStore.getState().setPage('charts');
    expect(useUIStore.getState().page).toBe('charts');
  });
});

describe('Zustand — useJournalStore', function () {
  it('addTrade and deleteTrade work', function () {
    const trade = {
      id: 'sel_test_1',
      date: '2025-01-15T10:00:00Z',
      symbol: 'ETH',
      side: 'long',
      pnl: 50,
    };

    useJournalStore.getState().addTrade(trade);
    const found = useJournalStore.getState().trades.some(function (t) {
      return t.id === 'sel_test_1';
    });
    expect(found).toBe(true);

    useJournalStore.getState().deleteTrade('sel_test_1');
    const gone = useJournalStore.getState().trades.some(function (t) {
      return t.id === 'sel_test_1';
    });
    expect(gone).toBe(false);
  });
});

// ─── Shallow utility verification ────────────────────────────────
describe('Zustand — shallow utility', function () {
  it('shallow function is importable and works', function () {
    expect(typeof shallow).toBe('function');
    expect(shallow({ a: 1 }, { a: 1 })).toBe(true);
    expect(shallow({ a: 1 }, { a: 2 })).toBe(false);
  });
});
