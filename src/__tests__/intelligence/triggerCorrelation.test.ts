// ═══════════════════════════════════════════════════════════════════
// charEdge — Batch 8A: Trigger Correlation Tests (Task 4.12.12)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { analyzeTriggerCorrelation, type TradeLike } from '@/psychology/TriggerCorrelation';

const makeTrade = (overrides: Partial<TradeLike> = {}): TradeLike => ({
  id: `t-${Math.random().toString(36).slice(2, 6)}`,
  date: new Date().toISOString(),
  pnl: 50,
  triggers: [],
  fomo: null,
  impulse: null,
  clarity: null,
  preMood: null,
  postMood: null,
  ...overrides,
});

describe('TriggerCorrelation', () => {
  it('returns empty report for no trades', () => {
    const report = analyzeTriggerCorrelation([]);
    expect(report.topPatterns).toEqual([]);
    expect(report.clusters).toEqual([]);
    expect(report.triggerDisciplineScore).toBe(100);
    expect(report.analyzedTrades).toBe(0);
  });

  it('returns 100 score when no triggers logged', () => {
    const trades = [makeTrade(), makeTrade({ pnl: -20 })];
    const report = analyzeTriggerCorrelation(trades);
    expect(report.triggerDisciplineScore).toBe(100);
    expect(report.tradesWithTriggers).toBe(0);
  });

  it('detects trigger → loss correlation', () => {
    const trades = [
      makeTrade({ pnl: -100, triggers: ['fatigue'] }),
      makeTrade({ pnl: -50, triggers: ['fatigue'] }),
      makeTrade({ pnl: 80, triggers: ['fatigue'] }),
      makeTrade({ pnl: 100 }), // no trigger
    ];
    const report = analyzeTriggerCorrelation(trades);
    expect(report.topPatterns.length).toBeGreaterThan(0);
    expect(report.topPatterns[0].trigger).toBe('fatigue');
    expect(report.topPatterns[0].lossCount).toBe(2);
    expect(report.topPatterns[0].totalCount).toBe(3);
  });

  it('derives implicit triggers from psych dimensions', () => {
    const trades = [
      makeTrade({ pnl: -100, fomo: 9 }), // high-fomo derived
      makeTrade({ pnl: -50, impulse: 8 }), // high-impulse derived
      makeTrade({ pnl: 100, clarity: 2 }), // low-clarity derived
    ];
    const report = analyzeTriggerCorrelation(trades);
    expect(report.tradesWithTriggers).toBe(3);
    const triggerNames = report.topPatterns.map((p) => p.trigger);
    expect(triggerNames).toContain('high-fomo');
  });

  it('classifies severity correctly', () => {
    const trades = [
      makeTrade({ pnl: -100, triggers: ['overtrading'] }),
      makeTrade({ pnl: -80, triggers: ['overtrading'] }),
      makeTrade({ pnl: -60, triggers: ['overtrading'] }),
      // 100% loss rate → critical
    ];
    const report = analyzeTriggerCorrelation(trades);
    expect(report.topPatterns[0].severity).toBe('critical');
  });

  it('detects sabotage clusters', () => {
    // 3 losses on same day-of-week and within the same time bucket (afternoon: 12–15)
    // Use fixed dates to avoid timezone/bucket-boundary flakiness
    const base = new Date('2025-03-10T13:00:00'); // Monday 1pm (afternoon bucket)
    const trades = [
      makeTrade({ pnl: -100, triggers: ['fatigue'], date: new Date(base.getTime()).toISOString() }),
      makeTrade({ pnl: -80, triggers: ['fatigue'], date: new Date(base.getTime() + 30 * 60000).toISOString() }), // +30min
      makeTrade({ pnl: -60, triggers: ['fatigue'], date: new Date(base.getTime() + 60 * 60000).toISOString() }), // +60min
    ];
    const report = analyzeTriggerCorrelation(trades);
    expect(report.clusters.length).toBeGreaterThan(0);
    expect(report.clusters[0].lossCount).toBeGreaterThanOrEqual(2);
  });

  it('respects topN parameter', () => {
    const trades = [
      makeTrade({ pnl: -100, triggers: ['a'] }),
      makeTrade({ pnl: -90, triggers: ['b'] }),
      makeTrade({ pnl: -80, triggers: ['c'] }),
      makeTrade({ pnl: -70, triggers: ['d'] }),
    ];
    const report = analyzeTriggerCorrelation(trades, { topN: 2 });
    expect(report.topPatterns.length).toBeLessThanOrEqual(2);
  });
});
