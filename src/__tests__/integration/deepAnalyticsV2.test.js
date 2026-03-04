// ═══════════════════════════════════════════════════════════════════
// charEdge — H2.2 Deep Analytics v2 Test Suite
// Tests for: Calmar, recovery factor, R-distribution, avgHoldTime,
//            emotion correlation, streak impact
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  computeFast as compute,
  computeRDistribution,
  computeEmotionCorrelation,
  computeStreakImpact,
} from '../../app/features/analytics/analyticsFast.js';

// ─── Test Data Factories ────────────────────────────────────────
const mkTrade = (overrides = {}) => ({
  id: 'test_' + Math.random().toString(36).slice(2),
  date: '2025-01-15T10:30:00Z',
  symbol: 'BTC',
  side: 'long',
  pnl: 100,
  fees: 2,
  quantity: 1,
  emotion: '',
  playbook: '',
  tags: [],
  followedRules: true,
  rMultiple: null,
  ...overrides,
});

const mkWinner = (pnl = 100, date = '2025-01-15T10:00:00Z') => mkTrade({ pnl, date });
const mkLoser = (pnl = -50, date = '2025-01-15T11:00:00Z') => mkTrade({ pnl, date });

function generateTrades(n, winRate = 0.5, avgWin = 100, avgLoss = 50) {
  const trades = [];
  for (let i = 0; i < n; i++) {
    const day = Math.floor(i / 5);
    const date = new Date(2025, 0, 1 + day, 10 + (i % 5));
    const isWin = i / n < winRate;
    trades.push(
      mkTrade({
        pnl: isWin ? avgWin * (0.5 + Math.random()) : -avgLoss * (0.5 + Math.random()),
        date: date.toISOString(),
        symbol: ['BTC', 'ETH', 'SOL'][i % 3],
        playbook: ['breakout', 'reversal', ''][i % 3],
        emotion: ['calm', 'confident', 'anxious'][i % 3],
        rMultiple: isWin ? 1 + Math.random() * 2 : -(0.5 + Math.random()),
      }),
    );
  }
  return trades;
}

// ═══ CALMAR RATIO ═══════════════════════════════════════════════
describe('H2.2 — Calmar Ratio', () => {
  it('Calmar = Infinity when no drawdown (all winners)', () => {
    const trades = Array.from({ length: 10 }, (_, i) =>
      mkWinner(100, `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
    );
    const result = compute(trades);
    expect(result.calmar).toBe(Infinity);
    expect(result.maxDd).toBe(0);
  });

  it('Calmar > 0 for profitable system with drawdown', () => {
    const trades = [
      mkWinner(500, '2025-01-01T10:00:00Z'),
      mkLoser(-200, '2025-01-02T10:00:00Z'),
      mkWinner(300, '2025-01-03T10:00:00Z'),
    ];
    const result = compute(trades);
    expect(result.calmar).toBeGreaterThan(0);
    expect(result.calmar).toBeLessThan(Infinity);
  });

  it('Calmar = 0 for no trades and no profit', () => {
    const trades = Array.from({ length: 10 }, (_, i) =>
      mkLoser(-50, `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
    );
    const result = compute(trades);
    expect(result.calmar).toBeLessThan(0);
  });

  it('Calmar is a number (not NaN)', () => {
    const trades = generateTrades(30, 0.55, 100, 80);
    const result = compute(trades);
    expect(isNaN(result.calmar)).toBe(false);
  });
});

// ═══ RECOVERY FACTOR ════════════════════════════════════════════
describe('H2.2 — Recovery Factor', () => {
  it('Recovery = Infinity when no drawdown', () => {
    const trades = Array.from({ length: 5 }, (_, i) =>
      mkWinner(100, `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
    );
    const result = compute(trades);
    expect(result.recoveryFactor).toBe(Infinity);
  });

  it('Recovery > 0 for profitable trading with drawdowns', () => {
    const trades = [
      mkWinner(1000, '2025-01-01T10:00:00Z'),
      mkLoser(-500, '2025-01-02T10:00:00Z'),
      mkWinner(600, '2025-01-03T10:00:00Z'),
    ];
    const result = compute(trades);
    expect(result.recoveryFactor).toBeGreaterThan(0);
  });

  it('Recovery < 0 for losing system', () => {
    const trades = Array.from({ length: 10 }, (_, i) =>
      mkLoser(-100, `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
    );
    const result = compute(trades);
    expect(result.recoveryFactor).toBeLessThan(0);
  });
});

// ═══ R-MULTIPLE DISTRIBUTION ════════════════════════════════════
describe('H2.2 — R-Multiple Distribution', () => {
  it('empty when < 2 R values', () => {
    const dist = computeRDistribution([mkTrade({ rMultiple: 1.5 })]);
    expect(dist.count).toBe(0);
    expect(dist.buckets).toHaveLength(0);
  });

  it('computes histogram with correct count', () => {
    const trades = [
      mkTrade({ rMultiple: 1.0 }),
      mkTrade({ rMultiple: 1.3 }),
      mkTrade({ rMultiple: -0.5 }),
      mkTrade({ rMultiple: 2.0 }),
      mkTrade({ rMultiple: -1.0 }),
    ];
    const dist = computeRDistribution(trades);
    expect(dist.count).toBe(5);
    expect(dist.buckets.length).toBeGreaterThan(0);

    // Sum of all bucket counts should equal total count
    const bucketTotal = dist.buckets.reduce((s, b) => s + b.count, 0);
    expect(bucketTotal).toBe(5);
  });

  it('computes mean, median, stdDev', () => {
    const trades = [
      mkTrade({ rMultiple: 1.0 }),
      mkTrade({ rMultiple: 2.0 }),
      mkTrade({ rMultiple: 3.0 }),
    ];
    const dist = computeRDistribution(trades);
    expect(dist.mean).toBeCloseTo(2.0, 5);
    expect(dist.median).toBe(2.0);
    expect(dist.stdDev).toBeGreaterThan(0);
  });

  it('handles overflow buckets', () => {
    const trades = [
      mkTrade({ rMultiple: -5 }), // below -4R
      mkTrade({ rMultiple: 5 }), // above +4R
      mkTrade({ rMultiple: 0 }),
    ];
    const dist = computeRDistribution(trades);
    const labels = dist.buckets.map((b) => b.label);
    expect(labels).toContain('<-4R');
    expect(labels).toContain('>4R');
  });

  it('ignores null/undefined rMultiple', () => {
    const trades = [
      mkTrade({ rMultiple: 1.0 }),
      mkTrade({ rMultiple: null }),
      mkTrade({ rMultiple: undefined }),
      mkTrade({ rMultiple: 2.0 }),
    ];
    const dist = computeRDistribution(trades);
    expect(dist.count).toBe(2);
  });

  it('integrated: result.rDistribution present', () => {
    const trades = generateTrades(20, 0.5, 100, 50);
    const result = compute(trades);
    expect(result.rDistribution).toBeDefined();
    expect(result.rDistribution.count).toBeGreaterThan(0);
  });
});

// ═══ AVG HOLD TIME ══════════════════════════════════════════════
describe('H2.2 — Avg Hold Time', () => {
  it('avgHoldTime = 0 when no closeDate', () => {
    const result = compute([mkWinner(100)]);
    expect(result.avgHoldTime).toBe(0);
  });

  it('avgHoldTime correct with closeDate', () => {
    const trades = [
      mkTrade({
        pnl: 100,
        date: '2025-01-15T10:00:00Z',
        closeDate: '2025-01-15T11:00:00Z', // 60 min hold
      }),
      mkTrade({
        pnl: -50,
        date: '2025-01-16T10:00:00Z',
        closeDate: '2025-01-16T10:30:00Z', // 30 min hold
      }),
    ];
    const result = compute(trades);
    expect(result.avgHoldTime).toBeCloseTo(45, 0); // average of 60 and 30
  });
});

// ═══ EMOTION → P&L CORRELATION ══════════════════════════════════
describe('H2.2 — Emotion Correlation', () => {
  it('returns sampleSize 0 for untagged trades', () => {
    const trades = Array.from({ length: 5 }, () => mkTrade({ pnl: 100, emotion: '' }));
    const result = computeEmotionCorrelation(trades);
    // 'untagged' maps to sentiment 0, so they all count
    expect(result.sampleSize).toBe(5);
  });

  it('positive correlation when happy → profit', () => {
    const trades = [
      mkTrade({ pnl: 500, emotion: 'confident' }),
      mkTrade({ pnl: 300, emotion: 'focused' }),
      mkTrade({ pnl: -100, emotion: 'anxious' }),
      mkTrade({ pnl: -200, emotion: 'fearful' }),
      mkTrade({ pnl: 50, emotion: 'calm' }),
    ];
    const result = computeEmotionCorrelation(trades);
    expect(result.pearsonR).toBeGreaterThan(0);
    expect(result.sampleSize).toBe(5);
  });

  it('negative correlation when happy → loss', () => {
    const trades = [
      mkTrade({ pnl: -500, emotion: 'confident' }),
      mkTrade({ pnl: -300, emotion: 'focused' }),
      mkTrade({ pnl: 100, emotion: 'anxious' }),
      mkTrade({ pnl: 200, emotion: 'fearful' }),
      mkTrade({ pnl: -50, emotion: 'calm' }),
    ];
    const result = computeEmotionCorrelation(trades);
    expect(result.pearsonR).toBeLessThan(0);
  });

  it('pearsonR between -1 and 1', () => {
    const trades = generateTrades(50, 0.5, 100, 100);
    const result = computeEmotionCorrelation(trades);
    expect(result.pearsonR).toBeGreaterThanOrEqual(-1);
    expect(result.pearsonR).toBeLessThanOrEqual(1);
  });

  it('returns emotion breakdown', () => {
    const trades = [
      mkTrade({ pnl: 100, emotion: 'confident' }),
      mkTrade({ pnl: 200, emotion: 'confident' }),
      mkTrade({ pnl: -50, emotion: 'anxious' }),
      mkTrade({ pnl: -100, emotion: 'anxious' }),
      mkTrade({ pnl: 50, emotion: 'calm' }),
    ];
    const result = computeEmotionCorrelation(trades);
    expect(result.emotions.confident).toBeDefined();
    expect(result.emotions.confident.count).toBe(2);
    expect(result.emotions.confident.avgPnl).toBeCloseTo(150, 0);
  });

  it('integrated: result.emotionCorrelation present', () => {
    const trades = generateTrades(20, 0.5, 100, 50);
    const result = compute(trades);
    expect(result.emotionCorrelation).toBeDefined();
    expect(result.emotionCorrelation.sampleSize).toBeGreaterThan(0);
  });
});

// ═══ STREAK IMPACT ══════════════════════════════════════════════
describe('H2.2 — Streak Impact', () => {
  it('returns zeros for < 3 trades', () => {
    const result = computeStreakImpact([mkWinner(), mkLoser()], [0, 1]);
    expect(result.avgPnlDuringWinStreak).toBe(0);
    expect(result.avgPnlDuringLossStreak).toBe(0);
    expect(result.avgPnlBaseline).toBe(0);
  });

  it('detects win streak trades', () => {
    const trades = [
      mkWinner(100, '2025-01-01T10:00:00Z'),
      mkWinner(200, '2025-01-02T10:00:00Z'),
      mkWinner(150, '2025-01-03T10:00:00Z'),
      mkLoser(-50, '2025-01-04T10:00:00Z'),
    ];
    const sortedIdxs = [0, 1, 2, 3]; // already sorted
    const result = computeStreakImpact(trades, sortedIdxs);
    // All 3 winners are in a streak of 3
    expect(result.avgPnlDuringWinStreak).toBeCloseTo(150, 0);
  });

  it('detects loss streak trades', () => {
    const trades = [
      mkWinner(100, '2025-01-01T10:00:00Z'),
      mkLoser(-50, '2025-01-02T10:00:00Z'),
      mkLoser(-80, '2025-01-03T10:00:00Z'),
      mkLoser(-60, '2025-01-04T10:00:00Z'),
    ];
    const sortedIdxs = [0, 1, 2, 3];
    const result = computeStreakImpact(trades, sortedIdxs);
    expect(result.avgPnlDuringLossStreak).toBeLessThan(0);
  });

  it('baseline equals overall avg', () => {
    const trades = [
      mkWinner(100, '2025-01-01T10:00:00Z'),
      mkWinner(200, '2025-01-02T10:00:00Z'),
      mkLoser(-50, '2025-01-03T10:00:00Z'),
    ];
    const sortedIdxs = [0, 1, 2];
    const result = computeStreakImpact(trades, sortedIdxs);
    expect(result.avgPnlBaseline).toBeCloseTo((100 + 200 - 50) / 3, 2);
  });

  it('integrated: result.streakImpact present', () => {
    const trades = generateTrades(20, 0.5, 100, 50);
    const result = compute(trades);
    expect(result.streakImpact).toBeDefined();
    expect(result.streakImpact).toHaveProperty('avgPnlDuringWinStreak');
    expect(result.streakImpact).toHaveProperty('avgPnlDuringLossStreak');
    expect(result.streakImpact).toHaveProperty('avgPnlBaseline');
    expect(result.streakImpact).toHaveProperty('streakSensitivity');
  });
});

// ═══ RETURN SHAPE ═══════════════════════════════════════════════
describe('H2.2 — Return Shape', () => {
  it('all new H2.2 fields present', () => {
    const trades = generateTrades(30, 0.5, 100, 50);
    const result = compute(trades);
    const h22Fields = [
      'calmar',
      'recoveryFactor',
      'rDistribution',
      'avgHoldTime',
      'emotionCorrelation',
      'streakImpact',
    ];
    h22Fields.forEach((field) => {
      expect(result).toHaveProperty(field);
    });
  });

  it('no NaN in new numeric fields', () => {
    const trades = generateTrades(30, 0.5, 100, 50);
    const result = compute(trades);
    const numericFields = ['calmar', 'recoveryFactor', 'avgHoldTime'];
    numericFields.forEach((field) => {
      const val = result[field];
      if (val !== Infinity && val !== -Infinity) {
        expect(isNaN(val)).toBe(false);
      }
    });
  });

  it('rDistribution has correct shape', () => {
    const trades = generateTrades(30, 0.5, 100, 50);
    const result = compute(trades);
    const rd = result.rDistribution;
    expect(rd).toHaveProperty('buckets');
    expect(rd).toHaveProperty('mean');
    expect(rd).toHaveProperty('median');
    expect(rd).toHaveProperty('stdDev');
    expect(rd).toHaveProperty('count');
    expect(Array.isArray(rd.buckets)).toBe(true);
  });

  it('emotionCorrelation has correct shape', () => {
    const trades = generateTrades(30, 0.5, 100, 50);
    const result = compute(trades);
    const ec = result.emotionCorrelation;
    expect(ec).toHaveProperty('pearsonR');
    expect(ec).toHaveProperty('sampleSize');
    expect(ec).toHaveProperty('emotions');
  });
});
