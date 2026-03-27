import { describe, it, expect } from 'vitest';
import { runBacktest, compareStrategies, PRESET_STRATEGIES } from '../../data/services/PredictionBacktester.js';

describe('PredictionBacktester', () => {
  const resolvedMarkets = [
    {
      id: 'm1',
      question: 'Will BTC hit 100k?',
      category: 'crypto',
      outcomes: [{ label: 'Yes', probability: 30 }],
      resolvedOutcome: 'Yes',
    },
    {
      id: 'm2',
      question: 'Will Fed cut rates?',
      category: 'economy',
      outcomes: [{ label: 'Yes', probability: 70 }],
      resolvedOutcome: 'Yes',
    },
    {
      id: 'm3',
      question: 'Will gold hit $3000?',
      category: 'finance',
      outcomes: [{ label: 'Yes', probability: 50 }],
      resolvedOutcome: 'No',
    },
    {
      id: 'm4',
      question: 'Market without resolution',
      outcomes: [{ label: 'Yes', probability: 60 }],
      resolvedOutcome: null, // Not resolved - should be excluded
    },
  ];

  // ─── runBacktest ────────────────────────────────────────────
  describe('runBacktest', () => {
    it('returns correct result structure', () => {
      const strategy = { name: 'Test', side: 'yes', minProb: 0, maxProb: 100, positionSize: 100 };
      const result = runBacktest(strategy, resolvedMarkets);
      expect(result).toHaveProperty('strategyName', 'Test');
      expect(result).toHaveProperty('totalTrades');
      expect(result).toHaveProperty('wins');
      expect(result).toHaveProperty('losses');
      expect(result).toHaveProperty('winRate');
      expect(result).toHaveProperty('totalPnL');
      expect(result).toHaveProperty('sharpeRatio');
      expect(result).toHaveProperty('trades');
      expect(result).toHaveProperty('equityCurve');
    });

    it('excludes unresolved markets', () => {
      const strategy = { name: 'Test', side: 'yes', minProb: 0, maxProb: 100, positionSize: 100 };
      const result = runBacktest(strategy, resolvedMarkets);
      expect(result.totalTrades).toBe(3); // Only 3 resolved
    });

    it('filters by category', () => {
      const strategy = {
        name: 'Crypto Only',
        side: 'yes',
        minProb: 0,
        maxProb: 100,
        positionSize: 100,
        category: 'crypto',
      };
      const result = runBacktest(strategy, resolvedMarkets);
      expect(result.totalTrades).toBe(1);
    });

    it('filters by probability range', () => {
      const strategy = { name: 'Low Prob', side: 'yes', minProb: 20, maxProb: 40, positionSize: 100 };
      const result = runBacktest(strategy, resolvedMarkets);
      expect(result.totalTrades).toBe(1); // Only m1 with 30% probability
    });

    it('computes win rate correctly', () => {
      const strategy = { name: 'All Yes', side: 'yes', minProb: 0, maxProb: 100, positionSize: 100 };
      const result = runBacktest(strategy, resolvedMarkets);
      expect(result.wins + result.losses).toBe(result.totalTrades);
      expect(result.winRate).toBe(Math.round((result.wins / result.totalTrades) * 100));
    });

    it('tracks equity curve', () => {
      const strategy = { name: 'Test', side: 'yes', minProb: 0, maxProb: 100, positionSize: 100 };
      const result = runBacktest(strategy, resolvedMarkets);
      expect(result.equityCurve).toHaveLength(result.totalTrades);
      expect(result.equityCurve[0]).toHaveProperty('tradeNum', 1);
    });

    it('handles no-side strategy defaults', () => {
      const result = runBacktest({}, resolvedMarkets);
      expect(result.strategyName).toBe('Unnamed Strategy');
    });

    it('computes max drawdown', () => {
      const strategy = { name: 'Test', side: 'yes', minProb: 0, maxProb: 100, positionSize: 100 };
      const result = runBacktest(strategy, resolvedMarkets);
      expect(result.maxDrawdown).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── compareStrategies ──────────────────────────────────────
  describe('compareStrategies', () => {
    it('returns results for each strategy', () => {
      const strategies = [
        { name: 'A', side: 'yes', minProb: 0, maxProb: 50, positionSize: 100 },
        { name: 'B', side: 'no', minProb: 50, maxProb: 100, positionSize: 100 },
      ];
      const results = compareStrategies(strategies, resolvedMarkets);
      expect(results).toHaveLength(2);
      expect(results[0].strategyName).toBe('A');
      expect(results[1].strategyName).toBe('B');
    });
  });

  // ─── PRESET_STRATEGIES ─────────────────────────────────────
  describe('PRESET_STRATEGIES', () => {
    it('has well-formed preset strategies', () => {
      expect(PRESET_STRATEGIES.length).toBeGreaterThan(0);
      for (const preset of PRESET_STRATEGIES) {
        expect(preset).toHaveProperty('name');
        expect(preset).toHaveProperty('side');
        expect(preset).toHaveProperty('minProb');
        expect(preset).toHaveProperty('maxProb');
        expect(preset.minProb).toBeLessThan(preset.maxProb);
      }
    });
  });
});
