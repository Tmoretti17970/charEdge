// ═══════════════════════════════════════════════════════════════════
// charEdge — UserProfileStore Tests (AI Copilot Sprint 1)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import { UserProfileStore } from '../ai/UserProfileStore';

// Helper: generate a batch of trades
function makeTrade(overrides: Record<string, unknown> = {}) {
  return {
    id: `t-${Math.random().toString(36).slice(2, 8)}`,
    symbol: 'BTCUSDT',
    side: 'long',
    pnl: 100,
    entryDate: '2025-03-10T10:30:00Z',
    exitDate: '2025-03-10T11:00:00Z',
    setup: 'breakout',
    emotion: 'confident',
    qty: 0.5,
    ...overrides,
  };
}

describe('UserProfileStore', () => {
  let store: InstanceType<typeof UserProfileStore>;

  beforeEach(() => {
    // Create a fresh store for each test (not the singleton)
    store = new UserProfileStore();
  });

  it('returns empty profile for zero trades', async () => {
    const profile = await store.rebuild([]);
    expect(profile.totalTradesAnalyzed).toBe(0);
    expect(profile.tradingStyle).toBe('unknown');
  });

  it('computes overall win rate correctly', async () => {
    const trades = [
      makeTrade({ pnl: 100 }),
      makeTrade({ pnl: 50 }),
      makeTrade({ pnl: -30 }),
      makeTrade({ pnl: -20 }),
      makeTrade({ pnl: 80 }),
    ];

    const profile = await store.rebuild(trades);
    expect(profile.totalTradesAnalyzed).toBe(5);
    expect(profile.overallWinRate).toBeCloseTo(0.6, 2);
    expect(profile.avgWin).toBeCloseTo(230 / 3, 0);
    expect(profile.avgLoss).toBeCloseTo(50 / 2, 0);
  });

  it('classifies trading style based on hold time', async () => {
    // 30-minute hold times → day trader
    const trades = Array.from({ length: 10 }, (_, i) =>
      makeTrade({
        entryDate: `2025-03-10T10:00:00Z`,
        exitDate: `2025-03-10T10:30:00Z`,
        pnl: i % 2 === 0 ? 50 : -20,
      }),
    );

    const profile = await store.rebuild(trades);
    expect(profile.tradingStyle).toBe('day_trader');
    expect(profile.avgHoldMinutes).toBeGreaterThan(0);
  });

  it('identifies preferred side', async () => {
    const trades = [
      ...Array.from({ length: 8 }, () => makeTrade({ side: 'long', pnl: 50 })),
      ...Array.from({ length: 2 }, () => makeTrade({ side: 'short', pnl: 50 })),
    ];

    const profile = await store.rebuild(trades);
    expect(profile.preferredSide).toBe('long');
  });

  it('tracks emotion statistics', async () => {
    const trades = [
      makeTrade({ emotion: 'confident', pnl: 100 }),
      makeTrade({ emotion: 'confident', pnl: 50 }),
      makeTrade({ emotion: 'fearful', pnl: -80 }),
      makeTrade({ emotion: 'fearful', pnl: -30 }),
    ];

    const profile = await store.rebuild(trades);
    expect(profile.emotionStats.length).toBe(2);
    expect(profile.mostProfitableEmotion).toBe('confident');
    expect(profile.mostDangerousEmotion).toBe('fearful');
  });

  it('tracks symbol statistics', async () => {
    const trades = [
      makeTrade({ symbol: 'BTCUSDT', pnl: 100 }),
      makeTrade({ symbol: 'BTCUSDT', pnl: 50 }),
      makeTrade({ symbol: 'ETHUSDT', pnl: -30 }),
    ];

    const profile = await store.rebuild(trades);
    expect(profile.topSymbols.length).toBe(2);
    expect(profile.topSymbols[0]?.symbol).toBe('BTCUSDT');
  });

  it('detects consecutive loss tilt pattern', async () => {
    const trades = [
      makeTrade({ pnl: 100 }),
      makeTrade({ pnl: -10 }),
      makeTrade({ pnl: -20 }),
      makeTrade({ pnl: -30 }),
      makeTrade({ pnl: 50 }), // Post-tilt recovery
      makeTrade({ pnl: -10 }),
      makeTrade({ pnl: -20 }),
      makeTrade({ pnl: -30 }),
      makeTrade({ pnl: 40 }), // Post-tilt again
    ];

    const profile = await store.rebuild(trades);
    expect(profile.tiltPatterns.length).toBeGreaterThan(0);
    expect(profile.tiltPatterns[0]?.trigger).toContain('Consecutive losses');
  });

  it('generates AI summary string', async () => {
    const trades = [
      makeTrade({ pnl: 100, setup: 'breakout', emotion: 'confident', symbol: 'BTCUSDT' }),
      makeTrade({ pnl: -50, setup: 'breakout', emotion: 'fearful', symbol: 'BTCUSDT' }),
      makeTrade({ pnl: 80, setup: 'pullback', emotion: 'confident', symbol: 'ETHUSDT' }),
    ];

    await store.rebuild(trades);
    const summary = store.getSummaryForAI();

    expect(summary).toContain('Trader Style');
    expect(summary).toContain('Win Rate');
    expect(summary).toContain('BTCUSDT');
  });

  it('returns educational message for new traders', async () => {
    const summary = store.getSummaryForAI();
    expect(summary).toContain('New trader');
  });

  it('records coaching feedback and updates effectiveness', () => {
    store.recordCoachingFeedback('tilt_warning', true);
    store.recordCoachingFeedback('tilt_warning', true);
    store.recordCoachingFeedback('tilt_warning', false);

    const profile = store.getProfile();
    expect(profile.coachingAcknowledgments['tilt_warning']).toBe(2);
    expect(profile.coachingDismissals['tilt_warning']).toBe(1);
    expect(profile.coachingEffectiveness['tilt_warning']).toBeCloseTo(0.33, 1);
  });

  it('computes setup statistics with min threshold', async () => {
    const trades = [
      ...Array.from({ length: 6 }, () => makeTrade({ setup: 'breakout', pnl: 50 })),
      ...Array.from({ length: 3 }, () => makeTrade({ setup: 'reversal', pnl: -10 })),
    ];

    const profile = await store.rebuild(trades);
    // breakout has 6 trades (above 5 threshold), reversal has 3 (below)
    expect(profile.topSetups.some((s: { setup: string }) => s.setup === 'breakout')).toBe(true);
    expect(profile.topSetups.some((s: { setup: string }) => s.setup === 'reversal')).toBe(false);
  });

  it('calculates position size variance', async () => {
    const trades = [
      makeTrade({ qty: 1.0, pnl: 50 }),
      makeTrade({ qty: 1.0, pnl: -20 }),
      makeTrade({ qty: 5.0, pnl: -100 }), // Oversized
      makeTrade({ qty: 1.0, pnl: 30 }),
    ];

    const profile = await store.rebuild(trades);
    expect(profile.avgPositionSize).toBeGreaterThan(0);
    expect(profile.positionSizeVariance).toBeGreaterThan(0);
  });
});
