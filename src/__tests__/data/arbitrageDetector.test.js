import { describe, it, expect } from 'vitest';
import {
  detectArbitrage,
  getHighConfidenceArbitrage,
  computeTotalEdge,
} from '../../data/services/ArbitrageDetector.js';

describe('ArbitrageDetector', () => {
  // ─── detectArbitrage ────────────────────────────────────────
  describe('detectArbitrage', () => {
    it('returns empty when no markets have sourceVariants', () => {
      const markets = [{ id: 1, question: 'Test', outcomes: [{ probability: 50 }] }];
      expect(detectArbitrage(markets)).toEqual([]);
    });

    it('detects arbitrage when spread exceeds threshold', () => {
      const markets = [
        {
          id: 'market-1',
          question: 'Will BTC hit 100k?',
          category: 'crypto',
          source: 'kalshi',
          outcomes: [{ probability: 40 }],
          volume24h: 10000,
          sourceVariants: [{ source: 'polymarket', outcomes: [{ probability: 55 }], volume24h: 5000 }],
        },
      ];
      const opps = detectArbitrage(markets, 5);
      expect(opps).toHaveLength(1);
      expect(opps[0].spread).toBe(15);
      expect(opps[0].buyFrom.source).toBe('kalshi');
      expect(opps[0].sellAt.source).toBe('polymarket');
    });

    it('does not flag when spread is below threshold', () => {
      const markets = [
        {
          id: 'market-1',
          question: 'Test',
          source: 'kalshi',
          outcomes: [{ probability: 50 }],
          sourceVariants: [{ source: 'polymarket', outcomes: [{ probability: 52 }] }],
        },
      ];
      expect(detectArbitrage(markets, 5)).toHaveLength(0);
    });

    it('assigns confidence levels based on spread', () => {
      const mkMarket = (prob1, prob2) => ({
        id: `m-${prob1}-${prob2}`,
        question: 'Test',
        source: 'kalshi',
        outcomes: [{ probability: prob1 }],
        sourceVariants: [{ source: 'polymarket', outcomes: [{ probability: prob2 }] }],
      });

      const highSpread = detectArbitrage([mkMarket(30, 45)], 5);
      expect(highSpread[0].confidence).toBe('high');

      const medSpread = detectArbitrage([mkMarket(40, 48)], 5);
      expect(medSpread[0].confidence).toBe('medium');

      const lowSpread = detectArbitrage([mkMarket(45, 51)], 5);
      expect(lowSpread[0].confidence).toBe('low');
    });

    it('sorts opportunities by spread descending', () => {
      const markets = [
        {
          id: 'm1',
          question: 'Q1',
          source: 'kalshi',
          outcomes: [{ probability: 30 }],
          sourceVariants: [{ source: 'poly', outcomes: [{ probability: 40 }] }],
        },
        {
          id: 'm2',
          question: 'Q2',
          source: 'kalshi',
          outcomes: [{ probability: 20 }],
          sourceVariants: [{ source: 'poly', outcomes: [{ probability: 50 }] }],
        },
      ];
      const opps = detectArbitrage(markets, 5);
      expect(opps[0].spread).toBeGreaterThanOrEqual(opps[1].spread);
    });
  });

  // ─── getHighConfidenceArbitrage ─────────────────────────────
  describe('getHighConfidenceArbitrage', () => {
    it('only returns high-confidence (spread >= 10)', () => {
      const markets = [
        {
          id: 'm1',
          question: 'Q1',
          source: 'a',
          outcomes: [{ probability: 30 }],
          sourceVariants: [{ source: 'b', outcomes: [{ probability: 50 }] }],
        },
        {
          id: 'm2',
          question: 'Q2',
          source: 'a',
          outcomes: [{ probability: 45 }],
          sourceVariants: [{ source: 'b', outcomes: [{ probability: 52 }] }],
        },
      ];
      const opps = getHighConfidenceArbitrage(markets);
      expect(opps).toHaveLength(1);
      expect(opps[0].marketId).toBe('m1');
    });
  });

  // ─── computeTotalEdge ──────────────────────────────────────
  describe('computeTotalEdge', () => {
    it('computes totals across all opportunities', () => {
      const markets = [
        {
          id: 'm1',
          question: 'Q1',
          source: 'a',
          outcomes: [{ probability: 30 }],
          sourceVariants: [{ source: 'b', outcomes: [{ probability: 45 }] }],
        },
      ];
      const result = computeTotalEdge(markets);
      expect(result.count).toBe(1);
      expect(result.totalSpread).toBe(15);
      expect(result.avgSpread).toBe(15);
    });

    it('returns zeros when no opportunities', () => {
      const result = computeTotalEdge([{ id: 1, outcomes: [{ probability: 50 }] }]);
      expect(result.count).toBe(0);
      expect(result.avgSpread).toBe(0);
    });
  });
});
