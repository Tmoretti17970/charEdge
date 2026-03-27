import { describe, it, expect } from 'vitest';
import {
  findCorrelatedMarkets,
  buildAssetCorrelationMap,
  getAssetOutlook,
} from '../../data/services/CrossAssetCorrelation.js';

describe('CrossAssetCorrelation', () => {
  const markets = [
    {
      id: 1,
      question: 'Will BTC hit $100k?',
      category: 'crypto',
      relatedTickers: ['BTC'],
      tags: ['bitcoin'],
      outcomes: [{ probability: 70 }],
      change24h: 5,
    },
    {
      id: 2,
      question: 'Will the S&P 500 reach 6000?',
      category: 'finance',
      relatedTickers: ['SPY'],
      tags: ['stocks'],
      outcomes: [{ probability: 60 }],
      change24h: 2,
    },
    {
      id: 3,
      question: 'Will ETH surpass $5000?',
      category: 'crypto',
      relatedTickers: ['ETH', 'BTC'],
      tags: ['ethereum'],
      outcomes: [{ probability: 45 }],
      change24h: -3,
    },
  ];

  // ─── findCorrelatedMarkets ──────────────────────────────────
  describe('findCorrelatedMarkets', () => {
    it('finds markets by relatedTickers', () => {
      const result = findCorrelatedMarkets(markets, 'BTC');
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0]).toHaveProperty('correlationRelevance');
    });

    it('finds markets by question text', () => {
      const result = findCorrelatedMarkets(markets, 'ETH');
      expect(result.some((m) => m.id === 3)).toBe(true);
    });

    it('adds category-based correlation for SPY', () => {
      const result = findCorrelatedMarkets(markets, 'SPY');
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('adds category-based correlation for BTC', () => {
      const result = findCorrelatedMarkets(markets, 'BTC');
      const btcMarkets = result.filter((m) => m.category === 'crypto');
      expect(btcMarkets.length).toBeGreaterThanOrEqual(1);
    });

    it('sorts by relevance descending', () => {
      const result = findCorrelatedMarkets(markets, 'BTC');
      for (let i = 1; i < result.length; i++) {
        expect(result[i].correlationRelevance).toBeLessThanOrEqual(result[i - 1].correlationRelevance);
      }
    });

    it('returns empty for unknown tickers', () => {
      const result = findCorrelatedMarkets(markets, 'ZZZZZ');
      expect(result).toHaveLength(0);
    });
  });

  // ─── buildAssetCorrelationMap ───────────────────────────────
  describe('buildAssetCorrelationMap', () => {
    it('builds a map of tickers to market counts', () => {
      const map = buildAssetCorrelationMap(markets);
      expect(map.length).toBeGreaterThan(0);
      const btcEntry = map.find((e) => e.ticker === 'BTC');
      expect(btcEntry).toBeDefined();
      expect(btcEntry.marketCount).toBe(2); // m1 and m3 have BTC
    });

    it('computes average probability', () => {
      const map = buildAssetCorrelationMap(markets);
      const btcEntry = map.find((e) => e.ticker === 'BTC');
      expect(btcEntry.avgProbability).toBe(Math.round((70 + 45) / 2));
    });

    it('assigns sentiment based on avgProbability', () => {
      const map = buildAssetCorrelationMap(markets);
      for (const entry of map) {
        expect(['Bullish', 'Bearish', 'Mixed']).toContain(entry.sentiment);
      }
    });

    it('sorts by marketCount descending', () => {
      const map = buildAssetCorrelationMap(markets);
      for (let i = 1; i < map.length; i++) {
        expect(map[i].marketCount).toBeLessThanOrEqual(map[i - 1].marketCount);
      }
    });
  });

  // ─── getAssetOutlook ───────────────────────────────────────
  describe('getAssetOutlook', () => {
    it('returns outlook for a known ticker', () => {
      const outlook = getAssetOutlook(markets, 'BTC');
      expect(outlook).not.toBeNull();
      expect(outlook.ticker).toBe('BTC');
      expect(outlook.marketCount).toBeGreaterThan(0);
      expect(['Bullish', 'Bearish', 'Mixed']).toContain(outlook.sentiment);
      expect(['Improving', 'Deteriorating', 'Stable']).toContain(outlook.momentum);
    });

    it('returns null for unknown ticker', () => {
      expect(getAssetOutlook(markets, 'ZZZZZ')).toBeNull();
    });

    it('includes top markets', () => {
      const outlook = getAssetOutlook(markets, 'BTC');
      expect(outlook.topMarkets.length).toBeGreaterThan(0);
      expect(outlook.topMarkets.length).toBeLessThanOrEqual(5);
    });
  });
});
