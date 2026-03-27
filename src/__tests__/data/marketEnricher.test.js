import { describe, it, expect } from 'vitest';
import { enrichMarkets, getHealthGrade } from '../../data/services/MarketEnricher.js';

describe('MarketEnricher', () => {
  // ─── enrichMarkets ──────────────────────────────────────────
  describe('enrichMarkets', () => {
    it('returns markets unchanged when no context', () => {
      const markets = [{ id: 1, question: 'Test', relatedTickers: [] }];
      const result = enrichMarkets(markets);
      expect(result).toHaveLength(1);
    });

    it('attaches ticker prices when available', () => {
      const markets = [{ id: 1, question: 'Will AAPL hit $200?', relatedTickers: ['AAPL', 'MSFT'] }];
      const context = {
        prices: {
          AAPL: { price: 195.5, change24h: 2.3 },
        },
      };
      const result = enrichMarkets(markets, context);
      expect(result[0].tickerPrices).toBeDefined();
      expect(result[0].tickerPrices).toHaveLength(1);
      expect(result[0].tickerPrices[0].ticker).toBe('AAPL');
    });

    it('attaches related events', () => {
      const markets = [{ id: 1, question: 'Will the Fed cut rates?', relatedTickers: [] }];
      const context = {
        events: [{ title: 'Fed FOMC Meeting' }, { title: 'Apple Earnings Call' }],
      };
      const result = enrichMarkets(markets, context);
      expect(result[0].relatedEvents).toBeDefined();
      expect(result[0].relatedEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('computes health score', () => {
      const markets = [{ id: 1, question: 'Test', volume24h: 5000000, liquidity: 500000, change24h: 3 }];
      const result = enrichMarkets(markets);
      expect(result[0].healthScore).toBeDefined();
      expect(result[0].healthScore).toBeGreaterThan(50);
    });

    it('health score increases with higher volume and liquidity', () => {
      const lowVolume = enrichMarkets([{ id: 1, question: 'Q', volume24h: 100 }])[0];
      const highVolume = enrichMarkets([
        { id: 2, question: 'Q', volume24h: 10000000, liquidity: 1000000, change24h: 10 },
      ])[0];
      expect(highVolume.healthScore).toBeGreaterThan(lowVolume.healthScore);
    });
  });

  // ─── getHealthGrade ─────────────────────────────────────────
  describe('getHealthGrade', () => {
    it('returns grade A for score >= 80', () => {
      const result = getHealthGrade(85);
      expect(result.grade).toBe('A');
      expect(result.label).toBe('Excellent');
    });

    it('returns grade B for score >= 60', () => {
      const result = getHealthGrade(65);
      expect(result.grade).toBe('B');
    });

    it('returns grade C for score >= 40', () => {
      const result = getHealthGrade(45);
      expect(result.grade).toBe('C');
    });

    it('returns grade D for score >= 20', () => {
      const result = getHealthGrade(25);
      expect(result.grade).toBe('D');
    });

    it('returns grade F for score < 20', () => {
      const result = getHealthGrade(10);
      expect(result.grade).toBe('F');
      expect(result.label).toBe('Thin');
    });
  });
});
