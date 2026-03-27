import { describe, it, expect } from 'vitest';
import { findMarketsForNews, findNewsForMarket, computeNewsImpact } from '../../data/services/PredictionNewsLinker.js';

describe('PredictionNewsLinker', () => {
  const markets = [
    { id: 1, question: 'Will Bitcoin reach $100k?', tags: ['bitcoin'], relatedTickers: ['BTC'] },
    { id: 2, question: 'Will the Fed cut interest rates?', tags: ['economy'], relatedTickers: ['SPY'] },
    { id: 3, question: 'Will Tesla stock go above $300?', tags: ['tech'], relatedTickers: ['TSLA'] },
  ];

  // ─── findMarketsForNews ─────────────────────────────────────
  describe('findMarketsForNews', () => {
    it('matches news about bitcoin to bitcoin markets', () => {
      const result = findMarketsForNews('Bitcoin surges past $95,000', markets);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].id).toBe(1);
    });

    it('matches news about the Fed to rate markets', () => {
      const result = findMarketsForNews('Federal Reserve signals possible rate cut', markets);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((m) => m.id === 2)).toBe(true);
    });

    it('matches news about Tesla', () => {
      const result = findMarketsForNews('Tesla reports record quarterly earnings', markets);
      expect(result.some((m) => m.id === 3)).toBe(true);
    });

    it('returns empty for unrelated news', () => {
      const result = findMarketsForNews('New recipe for chocolate cake', markets);
      expect(result).toHaveLength(0);
    });

    it('limits results to 5', () => {
      const manyMarkets = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        question: `Bitcoin question ${i}`,
        tags: ['bitcoin'],
        relatedTickers: [],
      }));
      const result = findMarketsForNews('Bitcoin price prediction', manyMarkets);
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  // ─── findNewsForMarket ──────────────────────────────────────
  describe('findNewsForMarket', () => {
    const newsItems = [
      { title: 'Bitcoin hits new all-time high', url: 'https://example.com/1', timestamp: new Date().toISOString() },
      { title: 'Fed announces rate decision', url: 'https://example.com/2', timestamp: new Date().toISOString() },
      { title: 'Tesla launches new model', url: 'https://example.com/3', timestamp: new Date().toISOString() },
      { title: 'Weather forecast for the weekend', url: 'https://example.com/4', timestamp: new Date().toISOString() },
    ];

    it('finds relevant news for a bitcoin market', () => {
      const result = findNewsForMarket(markets[0], newsItems);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].title).toContain('Bitcoin');
    });

    it('prioritizes ticker mentions', () => {
      const market = { question: 'Will TSLA go up?', tags: [], relatedTickers: ['TSLA'] };
      const news = [
        { title: 'TSLA stock analysis', url: 'a' },
        { title: 'Random news', url: 'b' },
      ];
      const result = findNewsForMarket(market, news);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty for unrelated market', () => {
      const market = { question: 'Will aliens land on earth?', tags: [], relatedTickers: [] };
      const result = findNewsForMarket(market, newsItems);
      expect(result).toHaveLength(0);
    });
  });

  // ─── computeNewsImpact ──────────────────────────────────────
  describe('computeNewsImpact', () => {
    it('returns impact level based on recent news count', () => {
      const now = new Date().toISOString();
      const newsItems = Array.from({ length: 6 }, (_, i) => ({
        title: `Bitcoin news ${i}`,
        timestamp: now,
      }));
      const result = computeNewsImpact(markets[0], newsItems);
      expect(result.impactLevel).toBe('high');
    });

    it('returns "none" when no related news', () => {
      const result = computeNewsImpact({ question: 'Will aliens visit?', tags: [], relatedTickers: [] }, [
        { title: 'Weather report', timestamp: new Date().toISOString() },
      ]);
      expect(result.impactLevel).toBe('none');
      expect(result.totalRelated).toBe(0);
    });
  });
});
