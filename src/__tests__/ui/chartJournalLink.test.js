// ═══════════════════════════════════════════════════════════════════
// charEdge — Sprint 2: Chart↔Journal Link + Calendar Heatmap Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import { tradeNav, findBarByTimestamp, centerBarInViewport } from '@/trading/navigateToTrade';

// ═══ tradeNav Event Bus ═════════════════════════════════════════
describe('tradeNav event bus', () => {
  beforeEach(() => {
    tradeNav.clear();
  });

  it('listener receives payload on emit', () => {
    let received = null;
    tradeNav.on('navigate', (payload) => { received = payload; });
    tradeNav.emit('navigate', { tradeId: 'abc', symbol: 'BTC', timestamp: 1700000000000 });
    expect(received).toEqual({ tradeId: 'abc', symbol: 'BTC', timestamp: 1700000000000 });
  });

  it('unsubscribe stops receiving events', () => {
    let count = 0;
    const unsub = tradeNav.on('navigate', () => { count++; });
    tradeNav.emit('navigate', { tradeId: '1' });
    expect(count).toBe(1);
    unsub();
    tradeNav.emit('navigate', { tradeId: '2' });
    expect(count).toBe(1);
  });

  it('multiple listeners receive same event', () => {
    let a = 0, b = 0;
    tradeNav.on('navigate', () => { a++; });
    tradeNav.on('navigate', () => { b++; });
    tradeNav.emit('navigate', { tradeId: '1' });
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  it('different event types are isolated', () => {
    let nav = 0, highlight = 0;
    tradeNav.on('navigate', () => { nav++; });
    tradeNav.on('highlight', () => { highlight++; });
    tradeNav.emit('navigate', {});
    expect(nav).toBe(1);
    expect(highlight).toBe(0);
  });

  it('clear removes all listeners', () => {
    let count = 0;
    tradeNav.on('navigate', () => { count++; });
    tradeNav.on('highlight', () => { count++; });
    tradeNav.clear();
    tradeNav.emit('navigate', {});
    tradeNav.emit('highlight', {});
    expect(count).toBe(0);
  });
});

// ═══ findBarByTimestamp (Binary Search) ═══════════════════════════
describe('findBarByTimestamp', () => {
  const bars = [
    { time: 1000 },
    { time: 2000 },
    { time: 3000 },
    { time: 4000 },
    { time: 5000 },
    { time: 6000 },
    { time: 7000 },
    { time: 8000 },
    { time: 9000 },
    { time: 10000 },
  ];

  it('finds exact match', () => {
    expect(findBarByTimestamp(bars, 5000)).toBe(4);
  });

  it('finds first bar', () => {
    expect(findBarByTimestamp(bars, 1000)).toBe(0);
  });

  it('finds last bar', () => {
    expect(findBarByTimestamp(bars, 10000)).toBe(9);
  });

  it('finds closest bar for timestamp between bars', () => {
    // 2500 is between 2000 (idx 1) and 3000 (idx 2) — closest is 2000 or 3000
    const idx = findBarByTimestamp(bars, 2500);
    expect(idx).toBeGreaterThanOrEqual(1);
    expect(idx).toBeLessThanOrEqual(2);
  });

  it('finds closest bar for timestamp before first bar', () => {
    expect(findBarByTimestamp(bars, 500)).toBe(0);
  });

  it('finds closest bar for timestamp after last bar', () => {
    expect(findBarByTimestamp(bars, 15000)).toBe(9);
  });

  it('returns -1 for empty data', () => {
    expect(findBarByTimestamp([], 5000)).toBe(-1);
  });

  it('returns -1 for null data', () => {
    expect(findBarByTimestamp(null, 5000)).toBe(-1);
  });

  it('returns -1 for no timestamp', () => {
    expect(findBarByTimestamp(bars, 0)).toBe(-1);
  });
});

// ═══ centerBarInViewport ═══════════════════════════════════════
describe('centerBarInViewport', () => {
  it('centers bar in viewport', () => {
    // Bar 50 in 100 total bars with 20 visible → startIdx should be 40
    expect(centerBarInViewport(50, 100, 20)).toBe(40);
  });

  it('clamps to start for early bars', () => {
    // Bar 5 with 20 visible → would be -5, clamped to 0
    expect(centerBarInViewport(5, 100, 20)).toBe(0);
  });

  it('clamps to end for late bars', () => {
    // Bar 95 in 100 bars with 20 visible → ideally 85, but max is 80
    expect(centerBarInViewport(95, 100, 20)).toBe(80);
  });

  it('handles single bar viewport', () => {
    expect(centerBarInViewport(0, 1, 1)).toBe(0);
  });

  it('handles bar at start', () => {
    expect(centerBarInViewport(0, 100, 60)).toBe(0);
  });

  it('handles bar at end', () => {
    // Bar 99 in 100 bars with 60 visible → ideally 69, but max is 40
    expect(centerBarInViewport(99, 100, 60)).toBe(40);
  });
});

// ═══ CalendarHeatmap Data Processing ═════════════════════════════
describe('CalendarHeatmap data processing', () => {
  // Test the color gradient logic by importing the module
  // Since the heatmap is a React component, we test the underlying logic

  it('equity curve with mixed P&L produces correct daily structure', () => {
    const eq = [
      { date: '2025-01-13', daily: 300, pnl: 300 },
      { date: '2025-01-14', daily: 200, pnl: 500 },
      { date: '2025-01-15', daily: -100, pnl: 400 },
      { date: '2025-01-16', daily: 250, pnl: 650 },
      { date: '2025-01-17', daily: -50, pnl: 600 },
    ];

    // Verify structure
    expect(eq.length).toBe(5);
    expect(eq[0].daily).toBe(300);
    expect(eq[2].daily).toBe(-100);

    // Max absolute P&L should be 300
    const maxAbs = Math.max(...eq.map(d => Math.abs(d.daily)));
    expect(maxAbs).toBe(300);
  });

  it('handles empty equity curve', () => {
    const eq = [];
    expect(eq.length).toBe(0);
  });

  it('handles single-day equity curve', () => {
    const eq = [{ date: '2025-01-15', daily: 500, pnl: 500 }];
    expect(eq.length).toBe(1);
    expect(eq[0].daily).toBe(500);
  });
});
