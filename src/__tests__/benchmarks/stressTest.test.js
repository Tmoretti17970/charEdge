// ═══════════════════════════════════════════════════════════════════
// Phase 4 P2 — 1,000+ Trades Stress Test
//
// Verifies analytics/grouping functions handle large trade volumes
// without performance degradation or errors.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { groupTradesBy, groupTradesByTime } from '@/trading/groupTradesBy';

// ─── Trade Generator ────────────────────────────────────────────

const SYMBOLS = ['BTC', 'ETH', 'ES', 'NQ', 'AAPL', 'TSLA', 'SPY', 'QQQ', 'MSFT', 'NVDA'];
const SIDES = ['long', 'short'];
const PLAYBOOKS = ['Trend', 'Reversal', 'Breakout', 'Mean Reversion', 'Momentum', 'Scalp'];
const EMOTIONS = ['Calm', 'Excited', 'Anxious', 'Neutral', 'Confident', 'Frustrated'];

function generateTrades(count) {
  const trades = [];
  const baseDate = new Date('2025-01-01T09:30:00Z');

  for (let i = 0; i < count; i++) {
    const date = new Date(baseDate.getTime() + i * 3600000); // 1hr apart
    const pnl = Math.round((Math.random() - 0.45) * 2000); // Slight positive bias
    trades.push({
      id: `stress-${i}`,
      date: date.toISOString(),
      symbol: SYMBOLS[i % SYMBOLS.length],
      side: SIDES[i % 2],
      pnl,
      fees: Math.round(Math.random() * 10),
      playbook: PLAYBOOKS[i % PLAYBOOKS.length],
      emotion: EMOTIONS[i % EMOTIONS.length],
      rMultiple: pnl > 0 ? Math.random() * 5 : -Math.random() * 3,
    });
  }
  return trades;
}

// ═══ Performance Tests ══════════════════════════════════════════

describe('Stress Test: 2,000 trades', () => {
  const trades = generateTrades(2000);

  it('generates 2,000 valid trade objects', () => {
    expect(trades).toHaveLength(2000);
    expect(trades[0]).toHaveProperty('id');
    expect(trades[0]).toHaveProperty('date');
    expect(trades[0]).toHaveProperty('symbol');
    expect(trades[0]).toHaveProperty('pnl');
  });

  it('groupTradesBy(symbol) completes in <500ms for 2,000 trades', () => {
    const start = performance.now();
    const groups = groupTradesBy(trades, t => t.symbol);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(groups.length).toBe(SYMBOLS.length);

    // Verify correctness
    const totalCount = groups.reduce((sum, g) => sum + g.count, 0);
    expect(totalCount).toBe(2000);
  });

  it('groupTradesBy(playbook) completes in <500ms for 2,000 trades', () => {
    const start = performance.now();
    const groups = groupTradesBy(trades, t => t.playbook);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(groups.length).toBe(PLAYBOOKS.length);
  });

  it('groupTradesBy(side) completes in <500ms for 2,000 trades', () => {
    const start = performance.now();
    const groups = groupTradesBy(trades, t => t.side);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(groups.length).toBe(2);
  });

  it('groupTradesByTime(dayOfWeek) completes in <500ms for 2,000 trades', () => {
    const start = performance.now();
    const groups = groupTradesByTime(trades, 'dayOfWeek');
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(groups).toHaveLength(7);
  });

  it('groupTradesByTime(hour) completes in <500ms for 2,000 trades', () => {
    const start = performance.now();
    const groups = groupTradesByTime(trades, 'hour');
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(groups).toHaveLength(24);
  });

  it('groupTradesByTime(month) completes in <500ms for 2,000 trades', () => {
    const start = performance.now();
    const groups = groupTradesByTime(trades, 'month');
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(groups.length).toBeGreaterThan(0);
  });

  it('groupTradesBy(custom) with complex key fn completes in <500ms', () => {
    const start = performance.now();
    // Complex: bucket by $500 P&L ranges
    const groups = groupTradesBy(trades, t => {
      const bucket = Math.floor(t.pnl / 500) * 500;
      return `${bucket < 0 ? '' : '+'}${bucket} to ${bucket < 0 ? '' : '+'}${bucket + 499}`;
    });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(groups.length).toBeGreaterThan(0);
  });

  it('stats are mathematically correct at scale', () => {
    const groups = groupTradesBy(trades, t => t.symbol);

    for (const group of groups) {
      // winRate between 0 and 100
      expect(group.winRate).toBeGreaterThanOrEqual(0);
      expect(group.winRate).toBeLessThanOrEqual(100);

      // wins + losses <= count (some may be 0 P&L)
      expect(group.wins + group.losses).toBeLessThanOrEqual(group.count);

      // bestTrade >= worstTrade
      expect(group.bestTrade).toBeGreaterThanOrEqual(group.worstTrade);

      // profitFactor is non-negative
      expect(group.profitFactor).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('Stress Test: 5,000 trades (extreme)', () => {
  const megaTrades = generateTrades(5000);

  it('groupTradesBy handles 5,000 trades in <1000ms', () => {
    const start = performance.now();
    const groups = groupTradesBy(megaTrades, t => t.symbol);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1000);
    expect(groups.length).toBe(SYMBOLS.length);
    const total = groups.reduce((s, g) => s + g.count, 0);
    expect(total).toBe(5000);
  });

  it('groupTradesByTime handles 5,000 trades in <1000ms', () => {
    const start = performance.now();
    const groups = groupTradesByTime(megaTrades, 'dayOfWeek');
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1000);
    expect(groups).toHaveLength(7);
    const total = groups.reduce((s, g) => s + g.count, 0);
    expect(total).toBe(5000);
  });

  it('no memory leak — groups do not hold references to original trades', () => {
    const groups = groupTradesBy(megaTrades, t => t.symbol);
    // Groups should have aggregated data, not copies of all trade objects
    for (const g of groups) {
      expect(g).not.toHaveProperty('trades');
    }
  });
});
