import { describe, it, expect } from 'vitest';
import { computePredictionFearGreed } from '../../data/services/PredictionFearGreed.js';

describe('PredictionFearGreed', () => {
  it('returns neutral defaults for empty markets', () => {
    const result = computePredictionFearGreed([]);
    expect(result.score).toBe(50);
    expect(result.label).toBe('Neutral');

    const resultNull = computePredictionFearGreed(null);
    expect(resultNull.score).toBe(50);
  });

  it('returns a score between 0 and 100', () => {
    const markets = [
      { volume24h: 1000000, outcomes: [{ probability: 80 }], change24h: 5 },
      { volume24h: 500000, outcomes: [{ probability: 30 }], change24h: -3 },
    ];
    const result = computePredictionFearGreed(markets);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('labels scores correctly', () => {
    // Test with extreme greed scenario (high volume, extreme probs, positive momentum)
    const greedyMarkets = Array.from({ length: 10 }, () => ({
      volume24h: 10000000,
      outcomes: [{ probability: 95 }],
      change24h: 5,
    }));
    const greedResult = computePredictionFearGreed(greedyMarkets);
    expect(['Greed', 'Extreme Greed']).toContain(greedResult.label);

    // Test with fear scenario (low volume, uncertain probs, negative momentum)
    const fearMarkets = Array.from({ length: 10 }, () => ({
      volume24h: 0,
      outcomes: [{ probability: 50 }],
      change24h: -15,
    }));
    const fearResult = computePredictionFearGreed(fearMarkets);
    expect(['Fear', 'Extreme Fear', 'Neutral']).toContain(fearResult.label);
  });

  it('includes component breakdown', () => {
    const markets = [{ volume24h: 500000, outcomes: [{ probability: 70 }], change24h: 2 }];
    const result = computePredictionFearGreed(markets);
    expect(result.components).toBeDefined();
    expect(result.components.volume).toBeDefined();
    expect(result.components.extremity).toBeDefined();
    expect(result.components.momentum).toBeDefined();
    expect(result.components.breadth).toBeDefined();
    expect(result.components.volatility).toBeDefined();
    expect(result.components.volume.weight).toBe(0.25);
  });

  it('assigns correct colors for score ranges', () => {
    // Test various ranges by simulating different market conditions
    const result = computePredictionFearGreed([{ volume24h: 100, outcomes: [{ probability: 50 }], change24h: 0 }]);
    // The color should be one of the defined colors
    expect(['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e']).toContain(result.color);
  });

  it('handles markets without volume', () => {
    const markets = [{ outcomes: [{ probability: 60 }], change24h: 0 }];
    const result = computePredictionFearGreed(markets);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
