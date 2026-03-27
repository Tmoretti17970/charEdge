import { describe, it, expect } from 'vitest';
import { calculateTaxLots, generateTaxSummary } from '../../data/TaxLotEngine.js';

describe('TaxLotEngine', () => {
  const trades = [
    { symbol: 'AAPL', side: 'buy', quantity: 10, price: 100, date: '2025-01-01' },
    { symbol: 'AAPL', side: 'buy', quantity: 10, price: 120, date: '2025-02-01' },
    { symbol: 'AAPL', side: 'sell', quantity: 15, price: 130, date: '2025-03-01' },
  ];

  // ─── calculateTaxLots ──────────────────────────────────────
  describe('calculateTaxLots (FIFO)', () => {
    it('creates closed tax lots', () => {
      const lots = calculateTaxLots(trades, 'fifo');
      expect(lots.length).toBeGreaterThan(0);
    });

    it('FIFO closes oldest lots first', () => {
      const lots = calculateTaxLots(trades, 'fifo');
      // First lot should be from the $100 buy
      expect(lots[0].costBasis / lots[0].quantity).toBe(100);
    });

    it('computes gain/loss correctly', () => {
      const lots = calculateTaxLots(trades, 'fifo');
      const totalGain = lots.reduce((s, l) => s + l.gainLoss, 0);
      // Bought 10@100 + 10@120 = $2200 total cost
      // Sold 15@130 = $1950 proceeds
      // FIFO: close 10@100 = gain $300, then 5@120 = gain $50 → total $350
      expect(totalGain).toBeCloseTo(350, 0);
    });

    it('marks holding period correctly', () => {
      const lots = calculateTaxLots(trades, 'fifo');
      for (const lot of lots) {
        expect(['short-term', 'long-term']).toContain(lot.holdingPeriod);
      }
    });
  });

  describe('calculateTaxLots (LIFO)', () => {
    it('LIFO closes newest lots first', () => {
      const lots = calculateTaxLots(trades, 'lifo');
      // First lot closed should be from the $120 buy
      expect(lots[0].costBasis / lots[0].quantity).toBe(120);
    });
  });

  describe('calculateTaxLots (avgcost)', () => {
    it('uses average cost basis', () => {
      const lots = calculateTaxLots(trades, 'avgcost');
      expect(lots.length).toBeGreaterThan(0);
      // Average cost = (10*100 + 10*120) / 20 = $110
      const avgCost = lots[0].costBasis / lots[0].quantity;
      expect(avgCost).toBeCloseTo(110, 0);
    });
  });

  // ─── Wash sale detection ────────────────────────────────────
  describe('wash sale detection', () => {
    it('detects wash sales within 30-day window', () => {
      const washTrades = [
        { symbol: 'AAPL', side: 'buy', quantity: 10, price: 150, date: '2025-01-01' },
        { symbol: 'AAPL', side: 'sell', quantity: 10, price: 100, date: '2025-01-15' }, // Loss of $500
        { symbol: 'AAPL', side: 'buy', quantity: 10, price: 105, date: '2025-01-20' }, // Repurchase within 30 days
        { symbol: 'AAPL', side: 'sell', quantity: 10, price: 110, date: '2025-03-01' },
      ];
      const lots = calculateTaxLots(washTrades, 'fifo');
      const washSales = lots.filter((l) => l.washSale);
      expect(washSales.length).toBeGreaterThanOrEqual(1);
      expect(washSales[0].washSaleDisallowed).toBeGreaterThan(0);
    });

    it('does not flag wash sale when repurchase is > 30 days later', () => {
      const noWashTrades = [
        { symbol: 'AAPL', side: 'buy', quantity: 10, price: 150, date: '2025-01-01' },
        { symbol: 'AAPL', side: 'sell', quantity: 10, price: 100, date: '2025-01-15' },
        { symbol: 'AAPL', side: 'buy', quantity: 10, price: 105, date: '2025-03-01' }, // > 30 days later
        { symbol: 'AAPL', side: 'sell', quantity: 10, price: 110, date: '2025-05-01' },
      ];
      const lots = calculateTaxLots(noWashTrades, 'fifo');
      const washSales = lots.filter((l) => l.washSale);
      expect(washSales).toHaveLength(0);
    });
  });

  // ─── generateTaxSummary ─────────────────────────────────────
  describe('generateTaxSummary', () => {
    it('generates summary from tax lots', () => {
      const lots = calculateTaxLots(trades, 'fifo');
      const summary = generateTaxSummary(lots);
      expect(summary.totalLots).toBeGreaterThan(0);
      expect(summary.total).toHaveProperty('proceeds');
      expect(summary.total).toHaveProperty('costBasis');
      expect(summary.total).toHaveProperty('gainLoss');
    });

    it('filters by year', () => {
      const lots = calculateTaxLots(trades, 'fifo');
      const summary = generateTaxSummary(lots, 2025);
      expect(summary.year).toBe(2025);
      expect(summary.totalLots).toBeGreaterThan(0);
    });

    it('filters to zero for wrong year', () => {
      const lots = calculateTaxLots(trades, 'fifo');
      const summary = generateTaxSummary(lots, 2020);
      expect(summary.totalLots).toBe(0);
    });

    it('separates short-term and long-term', () => {
      const lots = calculateTaxLots(trades, 'fifo');
      const summary = generateTaxSummary(lots);
      expect(summary.shortTerm).toHaveProperty('count');
      expect(summary.longTerm).toHaveProperty('count');
      expect(summary.shortTerm.count + summary.longTerm.count).toBe(summary.totalLots);
    });
  });
});
