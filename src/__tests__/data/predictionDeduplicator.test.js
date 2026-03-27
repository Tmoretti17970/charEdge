import { describe, it, expect } from 'vitest';
import { deduplicateMarkets } from '../../data/services/PredictionDeduplicator.js';

describe('PredictionDeduplicator', () => {
  it('returns empty for null/empty input', () => {
    expect(deduplicateMarkets(null)).toEqual({ markets: [], duplicatesRemoved: 0 });
    expect(deduplicateMarkets([])).toEqual({ markets: [], duplicatesRemoved: 0 });
  });

  it('preserves unique markets unchanged', () => {
    const markets = [
      { id: 1, question: 'Will Bitcoin reach $100k by 2025?', volume24h: 100 },
      { id: 2, question: 'Will the Fed cut rates in September?', volume24h: 200 },
    ];
    const result = deduplicateMarkets(markets);
    expect(result.markets).toHaveLength(2);
    expect(result.duplicatesRemoved).toBe(0);
  });

  it('merges duplicate markets, keeping highest volume', () => {
    const markets = [
      { id: 1, question: 'Will Bitcoin reach $100,000 by end of 2025?', volume24h: 100, source: 'kalshi' },
      { id: 2, question: 'Will Bitcoin reach $100,000 by end of 2025?', volume24h: 500, source: 'polymarket' },
    ];
    const result = deduplicateMarkets(markets);
    expect(result.markets).toHaveLength(1);
    expect(result.duplicatesRemoved).toBe(1);
    // Winner should be the one with higher volume
    expect(result.markets[0].volume24h).toBe(500);
    expect(result.markets[0].sourceVariants).toHaveLength(1);
  });

  it('detects similar questions as duplicates', () => {
    const markets = [
      { id: 1, question: 'Will NVIDIA stock price close above $1000 by December 2025?', volume24h: 300 },
      { id: 2, question: 'NVIDIA stock price closing above $1000 December 2025', volume24h: 100 },
    ];
    const result = deduplicateMarkets(markets);
    expect(result.markets).toHaveLength(1);
    expect(result.duplicatesRemoved).toBe(1);
  });

  it('keeps different questions separate', () => {
    const markets = [
      { id: 1, question: 'Will Bitcoin reach $100,000?', volume24h: 100 },
      { id: 2, question: 'Will unemployment rate exceed 5%?', volume24h: 200 },
      { id: 3, question: 'Will the next hurricane be Category 5?', volume24h: 150 },
    ];
    const result = deduplicateMarkets(markets);
    expect(result.markets).toHaveLength(3);
    expect(result.duplicatesRemoved).toBe(0);
  });

  it('handles markets with empty/null questions', () => {
    const markets = [
      { id: 1, question: null, volume24h: 100 },
      { id: 2, question: '', volume24h: 200 },
      { id: 3, question: 'Valid question about Bitcoin', volume24h: 150 },
    ];
    const result = deduplicateMarkets(markets);
    expect(result.markets.length).toBeGreaterThanOrEqual(1);
  });

  it('handles clusters of 3+ duplicates', () => {
    const markets = [
      { id: 1, question: 'Will Trump win the 2024 presidential election?', volume24h: 100 },
      { id: 2, question: 'Will Trump win the 2024 presidential election?', volume24h: 500 },
      { id: 3, question: 'Trump winning the 2024 presidential election?', volume24h: 200 },
    ];
    const result = deduplicateMarkets(markets);
    expect(result.markets).toHaveLength(1);
    expect(result.duplicatesRemoved).toBe(2);
    expect(result.markets[0].volume24h).toBe(500);
  });
});
