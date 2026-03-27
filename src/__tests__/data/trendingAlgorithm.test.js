import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeTrending, getTopTrending, getBreakingMarkets } from '../../data/services/TrendingAlgorithm.js';

describe('TrendingAlgorithm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── computeTrending ───────────────────────────────────────
  describe('computeTrending', () => {
    it('returns empty for null/empty', () => {
      expect(computeTrending(null)).toEqual([]);
      expect(computeTrending([])).toEqual([]);
    });

    it('attaches trendingScore to each market', () => {
      const markets = [
        { id: 1, volume24h: 100000, change24h: 5 },
        { id: 2, volume24h: 50000, change24h: -2 },
      ];
      const result = computeTrending(markets);
      expect(result[0]).toHaveProperty('trendingScore');
      expect(typeof result[0].trendingScore).toBe('number');
    });

    it('sorts by trendingScore descending', () => {
      const markets = [
        { id: 1, volume24h: 10000, change24h: 1 },
        {
          id: 2,
          volume24h: 500000,
          change24h: 20,
          createdDate: '2025-06-14T00:00:00Z',
          closeDate: '2025-06-18T00:00:00Z',
        },
      ];
      const result = computeTrending(markets);
      expect(result[0].id).toBe(2);
      expect(result[0].trendingScore).toBeGreaterThan(result[1].trendingScore);
    });

    it('gives recency bonus to recently created markets', () => {
      const markets = [
        { id: 'old', volume24h: 100, change24h: 1, createdDate: '2024-01-01T00:00:00Z' },
        { id: 'new', volume24h: 100, change24h: 1, createdDate: '2025-06-14T00:00:00Z' },
      ];
      const result = computeTrending(markets);
      const oldItem = result.find((m) => m.id === 'old');
      const newItem = result.find((m) => m.id === 'new');
      expect(newItem.trendingScore).toBeGreaterThanOrEqual(oldItem.trendingScore);
    });

    it('gives closing-soon bonus', () => {
      const markets = [
        { id: 'far', volume24h: 100, change24h: 1, closeDate: '2026-01-01T00:00:00Z' },
        { id: 'soon', volume24h: 100, change24h: 1, closeDate: '2025-06-17T00:00:00Z' },
      ];
      const result = computeTrending(markets);
      const farItem = result.find((m) => m.id === 'far');
      const soonItem = result.find((m) => m.id === 'soon');
      expect(soonItem.trendingScore).toBeGreaterThanOrEqual(farItem.trendingScore);
    });
  });

  // ─── getTopTrending ─────────────────────────────────────────
  describe('getTopTrending', () => {
    it('returns top N markets', () => {
      const markets = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        volume24h: i * 1000,
        change24h: i,
      }));
      const top5 = getTopTrending(markets, 5);
      expect(top5).toHaveLength(5);
    });

    it('defaults to 10', () => {
      const markets = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        volume24h: i * 100,
        change24h: 1,
      }));
      const top = getTopTrending(markets);
      expect(top).toHaveLength(10);
    });
  });

  // ─── getBreakingMarkets ─────────────────────────────────────
  describe('getBreakingMarkets', () => {
    it('returns markets with >= 10% probability shift', () => {
      const markets = [
        { id: 1, change24h: 15 },
        { id: 2, change24h: -12 },
        { id: 3, change24h: 5 },
        { id: 4, change24h: 0 },
      ];
      const breaking = getBreakingMarkets(markets);
      expect(breaking).toHaveLength(2);
      expect(breaking.map((m) => m.id)).toEqual([1, 2]);
    });

    it('handles markets with no change', () => {
      const markets = [{ id: 1, change24h: 0 }, { id: 2 }];
      expect(getBreakingMarkets(markets)).toHaveLength(0);
    });
  });
});
