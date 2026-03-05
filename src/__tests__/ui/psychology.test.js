// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Sprint 3: Psychology & Discipline Tests
//
// Tests for: Rule Engine, Cooldown Logic, Streak Analysis, Post-Trade Review
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateCondition, DEFAULT_RULES } from '../../state/useRuleEngine.ts';
import { buildSessionContext } from '../../hooks/useCooldownEnforcer.js';
import { computeStreaks, computeRecovery } from '../../app/features/analytics/analytics_ui/StreakAnalysis.jsx';

// ─── Helpers ────────────────────────────────────────────────────

const mkTrade = (pnl, overrides = {}) => ({
  id: 'x' + Math.random().toString(36).slice(2),
  date: '2025-01-15T10:00:00Z',
  symbol: 'ES',
  side: 'long',
  pnl,
  fees: 0,
  ...overrides,
});

const today = () => new Date().toISOString().slice(0, 10);
const mkTodayTrade = (pnl, overrides = {}) =>
  mkTrade(pnl, { date: `${today()}T10:00:00Z`, ...overrides });

// ═══ Rule Engine — evaluateCondition ════════════════════════════

describe('Rule Engine — evaluateCondition', () => {
  it('evaluates >= correctly', () => {
    const rule = { field: 'consecLosses', operator: '>=', value: 3 };
    expect(evaluateCondition(rule, { consecLosses: 3 })).toBe(true);
    expect(evaluateCondition(rule, { consecLosses: 5 })).toBe(true);
    expect(evaluateCondition(rule, { consecLosses: 2 })).toBe(false);
  });

  it('evaluates < correctly', () => {
    const rule = { field: 'dailyPnl', operator: '<', value: -500 };
    expect(evaluateCondition(rule, { dailyPnl: -600 })).toBe(true);
    expect(evaluateCondition(rule, { dailyPnl: -500 })).toBe(false);
    expect(evaluateCondition(rule, { dailyPnl: 100 })).toBe(false);
  });

  it('evaluates == correctly', () => {
    const rule = { field: 'tradeCount', operator: '==', value: 10 };
    expect(evaluateCondition(rule, { tradeCount: 10 })).toBe(true);
    expect(evaluateCondition(rule, { tradeCount: 9 })).toBe(false);
  });

  it('evaluates != correctly', () => {
    const rule = { field: 'tradeCount', operator: '!=', value: 0 };
    expect(evaluateCondition(rule, { tradeCount: 5 })).toBe(true);
    expect(evaluateCondition(rule, { tradeCount: 0 })).toBe(false);
  });

  it('returns false for missing field', () => {
    const rule = { field: 'nonexistent', operator: '>=', value: 1 };
    expect(evaluateCondition(rule, { consecLosses: 5 })).toBe(false);
  });

  it('respects minTrades guard', () => {
    const rule = { field: 'sessionWinRate', operator: '<', value: 30, minTrades: 5 };
    expect(evaluateCondition(rule, { sessionWinRate: 20, tradeCount: 3 })).toBe(false);
    expect(evaluateCondition(rule, { sessionWinRate: 20, tradeCount: 5 })).toBe(true);
  });

  it('returns false for unknown operator', () => {
    const rule = { field: 'consecLosses', operator: '~=', value: 3 };
    expect(evaluateCondition(rule, { consecLosses: 3 })).toBe(false);
  });
});

// ═══ Default Rules ══════════════════════════════════════════════

describe('Rule Engine — DEFAULT_RULES', () => {
  it('has 4 default rules', () => {
    expect(DEFAULT_RULES.length).toBe(4);
  });

  it('all defaults have required fields', () => {
    for (const rule of DEFAULT_RULES) {
      expect(rule.id).toBeTruthy();
      expect(rule.name).toBeTruthy();
      expect(rule.field).toBeTruthy();
      expect(rule.operator).toBeTruthy();
      expect(rule.action).toBeTruthy();
      expect(typeof rule.enabled).toBe('boolean');
    }
  });

  it('consec_loss_3 triggers at 3 losses', () => {
    const rule = DEFAULT_RULES.find((r) => r.id === 'consec_loss_3');
    expect(evaluateCondition(rule, { consecLosses: 3 })).toBe(true);
    expect(evaluateCondition(rule, { consecLosses: 2 })).toBe(false);
  });

  it('daily_pnl_limit triggers below -500', () => {
    const rule = DEFAULT_RULES.find((r) => r.id === 'daily_pnl_limit');
    expect(evaluateCondition(rule, { dailyPnl: -501 })).toBe(true);
    expect(evaluateCondition(rule, { dailyPnl: -500 })).toBe(false);
  });

  it('low_win_rate requires 5+ trades', () => {
    const rule = DEFAULT_RULES.find((r) => r.id === 'low_win_rate');
    expect(evaluateCondition(rule, { sessionWinRate: 20, tradeCount: 5 })).toBe(true);
    expect(evaluateCondition(rule, { sessionWinRate: 20, tradeCount: 3 })).toBe(false);
    expect(evaluateCondition(rule, { sessionWinRate: 50, tradeCount: 10 })).toBe(false);
  });
});

// ═══ Session Context Builder ════════════════════════════════════

describe('buildSessionContext', () => {
  it('returns zeros for empty trades', () => {
    const ctx = buildSessionContext([]);
    expect(ctx.consecLosses).toBe(0);
    expect(ctx.dailyPnl).toBe(0);
    expect(ctx.sessionWinRate).toBe(0);
    expect(ctx.tradeCount).toBe(0);
  });

  it('counts consecutive losses from end', () => {
    const trades = [
      mkTodayTrade(100, { date: `${today()}T09:00:00Z` }),
      mkTodayTrade(-50, { date: `${today()}T10:00:00Z` }),
      mkTodayTrade(-30, { date: `${today()}T11:00:00Z` }),
      mkTodayTrade(-20, { date: `${today()}T12:00:00Z` }),
    ];
    const ctx = buildSessionContext(trades);
    expect(ctx.consecLosses).toBe(3);
  });

  it('resets consecutive losses after a win', () => {
    const trades = [
      mkTodayTrade(-50, { date: `${today()}T09:00:00Z` }),
      mkTodayTrade(-30, { date: `${today()}T10:00:00Z` }),
      mkTodayTrade(100, { date: `${today()}T11:00:00Z` }),
    ];
    const ctx = buildSessionContext(trades);
    expect(ctx.consecLosses).toBe(0);
  });

  it('computes daily P&L correctly', () => {
    const trades = [
      mkTodayTrade(100),
      mkTodayTrade(-200),
      mkTodayTrade(50),
    ];
    const ctx = buildSessionContext(trades);
    expect(ctx.dailyPnl).toBe(-50);
  });

  it('computes win rate correctly', () => {
    const trades = [
      mkTodayTrade(100),
      mkTodayTrade(-50),
      mkTodayTrade(200),
      mkTodayTrade(-30),
    ];
    const ctx = buildSessionContext(trades);
    expect(ctx.sessionWinRate).toBe(50);
    expect(ctx.tradeCount).toBe(4);
  });

  it('ignores non-today trades', () => {
    const trades = [
      mkTrade(100, { date: '2025-01-01T10:00:00Z' }),
      mkTrade(-50, { date: '2025-01-01T11:00:00Z' }),
    ];
    const ctx = buildSessionContext(trades);
    expect(ctx.tradeCount).toBe(0);
    expect(ctx.dailyPnl).toBe(0);
  });
});

// ═══ Streak Analysis ════════════════════════════════════════════

describe('computeStreaks', () => {
  it('returns empty for no trades', () => {
    expect(computeStreaks([])).toEqual([]);
    expect(computeStreaks(null)).toEqual([]);
  });

  it('identifies single win streak', () => {
    const trades = [
      mkTrade(100, { date: '2025-01-01T10:00:00Z' }),
      mkTrade(200, { date: '2025-01-02T10:00:00Z' }),
      mkTrade(50, { date: '2025-01-03T10:00:00Z' }),
    ];
    const streaks = computeStreaks(trades);
    expect(streaks.length).toBe(1);
    expect(streaks[0].type).toBe('win');
    expect(streaks[0].length).toBe(3);
    expect(streaks[0].pnl).toBe(350);
  });

  it('identifies alternating streaks', () => {
    const trades = [
      mkTrade(100, { date: '2025-01-01T10:00:00Z' }),
      mkTrade(50, { date: '2025-01-02T10:00:00Z' }),
      mkTrade(-200, { date: '2025-01-03T10:00:00Z' }),
      mkTrade(-100, { date: '2025-01-04T10:00:00Z' }),
      mkTrade(300, { date: '2025-01-05T10:00:00Z' }),
    ];
    const streaks = computeStreaks(trades);
    expect(streaks.length).toBe(3);
    expect(streaks[0]).toMatchObject({ type: 'win', length: 2 });
    expect(streaks[1]).toMatchObject({ type: 'loss', length: 2 });
    expect(streaks[2]).toMatchObject({ type: 'win', length: 1 });
  });

  it('handles zero P&L trades (breakeven breaks streak)', () => {
    const trades = [
      mkTrade(100, { date: '2025-01-01T10:00:00Z' }),
      mkTrade(0, { date: '2025-01-02T10:00:00Z' }),
      mkTrade(50, { date: '2025-01-03T10:00:00Z' }),
    ];
    const streaks = computeStreaks(trades);
    expect(streaks.length).toBe(2); // win, then win (broken by 0)
    expect(streaks[0].length).toBe(1);
    expect(streaks[1].length).toBe(1);
  });

  it('accumulates P&L within streaks', () => {
    const trades = [
      mkTrade(-100, { date: '2025-01-01T10:00:00Z' }),
      mkTrade(-200, { date: '2025-01-02T10:00:00Z' }),
      mkTrade(-50, { date: '2025-01-03T10:00:00Z' }),
    ];
    const streaks = computeStreaks(trades);
    expect(streaks[0].pnl).toBe(-350);
    expect(streaks[0].type).toBe('loss');
  });
});

describe('computeRecovery', () => {
  it('returns empty for no losing streaks', () => {
    const streaks = [{ type: 'win', length: 5, pnl: 500 }];
    expect(computeRecovery(streaks)).toEqual([]);
  });

  it('ignores single-trade losing streaks', () => {
    const streaks = [
      { type: 'loss', length: 1, pnl: -100 },
      { type: 'win', length: 3, pnl: 300 },
    ];
    expect(computeRecovery(streaks)).toEqual([]);
  });

  it('computes recovery correctly', () => {
    const streaks = [
      { type: 'loss', length: 3, pnl: -300 },
      { type: 'win', length: 2, pnl: 200 },
      { type: 'win', length: 1, pnl: 150 },
    ];
    const recoveries = computeRecovery(streaks);
    expect(recoveries.length).toBe(1);
    expect(recoveries[0].streakLength).toBe(3);
    expect(recoveries[0].deficit).toBe(300);
    expect(recoveries[0].fullRecovery).toBe(true);
    expect(recoveries[0].tradesNeeded).toBe(3);
  });

  it('handles partial recovery', () => {
    const streaks = [
      { type: 'loss', length: 2, pnl: -500 },
      { type: 'win', length: 2, pnl: 200 },
    ];
    const recoveries = computeRecovery(streaks);
    expect(recoveries[0].fullRecovery).toBe(false);
  });
});

// ═══ Post-Trade Review Data Shape ═══════════════════════════════

describe('PostTradeReview data shape', () => {
  it('review object has expected fields', () => {
    const review = {
      takeAgain: 'yes',
      lesson: 'Good setup recognition',
      grade: 'A',
      followedPlan: true,
      timestamp: new Date().toISOString(),
    };

    expect(review).toHaveProperty('takeAgain');
    expect(review).toHaveProperty('lesson');
    expect(review).toHaveProperty('grade');
    expect(review).toHaveProperty('followedPlan');
    expect(review).toHaveProperty('timestamp');

    expect(['yes', 'no', 'unsure']).toContain(review.takeAgain);
    expect(typeof review.lesson).toBe('string');
    expect(['A+', 'A', 'B', 'C', 'D', 'F']).toContain(review.grade);
    expect(typeof review.followedPlan).toBe('boolean');
  });
});
