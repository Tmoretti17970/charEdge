import { describe, it, expect } from 'vitest';
import { computeStats, formatStatValue, formatCount } from '../../data/services/PredictionStatsService.js';

describe('PredictionStatsService', () => {
  // ─── computeStats ───────────────────────────────────────────
  describe('computeStats', () => {
    it('returns zeros for empty/null markets', () => {
      const stats = computeStats([]);
      expect(stats.totalActiveMarkets).toBe(0);
      expect(stats.totalVolume).toBe(0);
      expect(stats.avgProbability).toBe(0);
      expect(stats.marketsByType).toEqual({ binary: 0, multi: 0, scalar: 0 });

      expect(computeStats(null).totalActiveMarkets).toBe(0);
    });

    it('aggregates volume and open interest', () => {
      const markets = [
        {
          totalVolume: 1000,
          volume24h: 100,
          openInterest: 50,
          liquidity: 200,
          category: 'crypto',
          source: 'kalshi',
          outcomes: [{ probability: 60 }],
        },
        {
          totalVolume: 2000,
          volume24h: 300,
          openInterest: 75,
          liquidity: 400,
          category: 'finance',
          source: 'polymarket',
          outcomes: [{ probability: 80 }],
        },
      ];
      const stats = computeStats(markets);
      expect(stats.totalActiveMarkets).toBe(2);
      expect(stats.totalVolume).toBe(3000);
      expect(stats.volume24h).toBe(400);
      expect(stats.totalOpenInterest).toBe(125);
      expect(stats.totalLiquidity).toBe(600);
      expect(stats.avgProbability).toBe(70);
    });

    it('counts categories and sources', () => {
      const markets = [
        { category: 'crypto', source: 'kalshi', outcomes: [{ probability: 50 }] },
        { category: 'crypto', source: 'polymarket', outcomes: [{ probability: 50 }] },
        { category: 'finance', source: 'kalshi', outcomes: [{ probability: 50 }] },
      ];
      const stats = computeStats(markets);
      expect(stats.categoryCounts.crypto).toBe(2);
      expect(stats.categoryCounts.finance).toBe(1);
      expect(stats.sourceCounts.kalshi).toBe(2);
      expect(stats.sourceCounts.polymarket).toBe(1);
    });

    it('counts market types', () => {
      const markets = [
        { marketType: 'binary', outcomes: [{ probability: 50 }] },
        { marketType: 'multi', outcomes: [{ probability: 50 }] },
        { marketType: 'binary', outcomes: [{ probability: 50 }] },
      ];
      const stats = computeStats(markets);
      expect(stats.marketsByType.binary).toBe(2);
      expect(stats.marketsByType.multi).toBe(1);
    });

    it('defaults missing fields to zero', () => {
      const markets = [{ outcomes: [{ probability: 40 }] }];
      const stats = computeStats(markets);
      expect(stats.totalVolume).toBe(0);
      expect(stats.categoryCounts.other).toBe(1);
      expect(stats.sourceCounts.unknown).toBe(1);
    });
  });

  // ─── formatStatValue ────────────────────────────────────────
  describe('formatStatValue', () => {
    it('formats billions', () => {
      expect(formatStatValue(2_500_000_000)).toBe('$2.50B');
    });

    it('formats millions', () => {
      expect(formatStatValue(5_600_000)).toBe('$5.6M');
    });

    it('formats thousands', () => {
      expect(formatStatValue(42_000)).toBe('$42.0K');
    });

    it('formats small positive values', () => {
      expect(formatStatValue(500)).toBe('$500');
    });

    it('returns $0 for zero', () => {
      expect(formatStatValue(0)).toBe('$0');
    });
  });

  // ─── formatCount ────────────────────────────────────────────
  describe('formatCount', () => {
    it('formats with comma separators', () => {
      expect(formatCount(1000)).toBe('1,000');
      expect(formatCount(1000000)).toBe('1,000,000');
    });

    it('handles small numbers', () => {
      expect(formatCount(42)).toBe('42');
    });
  });
});
