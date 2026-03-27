import { describe, it, expect } from 'vitest';
import { scoreImport } from '../../data/importExport/ImportScorer.js';

describe('ImportScorer', () => {
  it('returns zero score for empty input', () => {
    expect(scoreImport([]).score).toBe(0);
    expect(scoreImport(null).score).toBe(0);
    expect(scoreImport([]).grade).toBe('low');
  });

  it('gives high score for well-formed trades', () => {
    const trades = [
      { date: '2025-01-01', symbol: 'AAPL', side: 'buy', quantity: 10, price: 150 },
      { date: '2025-01-02', symbol: 'MSFT', side: 'sell', quantity: 5, price: 350 },
    ];
    const result = scoreImport(trades);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.grade).toBe('high');
    expect(result.warnings).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('deducts for missing dates', () => {
    const trades = [{ symbol: 'AAPL', side: 'buy', quantity: 10, price: 150 }];
    const result = scoreImport(trades);
    expect(result.score).toBeLessThan(100);
    expect(result.stats.missingDates).toBe(1);
  });

  it('deducts for missing symbols', () => {
    const trades = [{ date: '2025-01-01', side: 'buy', quantity: 10, price: 150 }];
    const result = scoreImport(trades);
    expect(result.score).toBeLessThan(100);
    expect(result.stats.missingSymbols).toBe(1);
  });

  it('deducts for zero prices', () => {
    const trades = [{ date: '2025-01-01', symbol: 'AAPL', side: 'buy', quantity: 10, price: 0 }];
    const result = scoreImport(trades);
    expect(result.stats.zeroPrices).toBe(1);
  });

  it('warns about future dates', () => {
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();
    const trades = [{ date: futureDate, symbol: 'AAPL', side: 'buy', quantity: 10, price: 150 }];
    const result = scoreImport(trades);
    expect(result.stats.futureDates).toBe(1);
    expect(result.warnings.some((w) => w.includes('future'))).toBe(true);
  });

  it('detects duplicate trades', () => {
    const trade = { date: '2025-01-01', symbol: 'AAPL', side: 'buy', quantity: 10, price: 150 };
    const result = scoreImport([trade, { ...trade }]);
    expect(result.stats.duplicateCount).toBe(1);
  });

  it('detects negative quantities', () => {
    const trades = [{ date: '2025-01-01', symbol: 'AAPL', side: 'buy', quantity: -10, price: 150 }];
    const result = scoreImport(trades);
    expect(result.stats.negativeQty).toBe(1);
  });

  it('assigns correct grade based on score', () => {
    // High: score >= 80
    const good = scoreImport([{ date: '2025-01-01', symbol: 'AAPL', side: 'buy', quantity: 10, price: 150 }]);
    expect(good.grade).toBe('high');

    // Low: many issues
    const bad = scoreImport([{}, {}, {}, {}]);
    expect(bad.grade).toBe('low');
  });
});
