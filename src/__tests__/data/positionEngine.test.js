import { describe, it, expect } from 'vitest';
import { computePositions, getOpenPositions, updateWithPrices, computeExposure } from '../../data/PositionEngine.js';

describe('PositionEngine', () => {
  // ─── computePositions ───────────────────────────────────────
  describe('computePositions', () => {
    it('creates a long position from buy trade', () => {
      const trades = [{ symbol: 'AAPL', side: 'buy', quantity: 10, price: 150, date: '2025-01-01' }];
      const positions = computePositions(trades);
      const pos = positions.get('AAPL');
      expect(pos).toBeDefined();
      expect(pos.direction).toBe('long');
      expect(pos.size).toBe(10);
      expect(pos.avgEntry).toBe(150);
    });

    it('creates a short position from sell trade', () => {
      const trades = [{ symbol: 'TSLA', side: 'sell', quantity: 5, price: 200, date: '2025-01-01' }];
      const positions = computePositions(trades);
      const pos = positions.get('TSLA');
      expect(pos.direction).toBe('short');
      expect(pos.size).toBe(-5);
    });

    it('computes weighted average entry for multiple buys', () => {
      const trades = [
        { symbol: 'AAPL', side: 'buy', quantity: 10, price: 100, date: '2025-01-01' },
        { symbol: 'AAPL', side: 'buy', quantity: 10, price: 200, date: '2025-01-02' },
      ];
      const positions = computePositions(trades);
      expect(positions.get('AAPL').avgEntry).toBe(150);
      expect(positions.get('AAPL').size).toBe(20);
    });

    it('computes realized P&L when closing a long', () => {
      const trades = [
        { symbol: 'AAPL', side: 'buy', quantity: 10, price: 100, date: '2025-01-01' },
        { symbol: 'AAPL', side: 'sell', quantity: 10, price: 120, date: '2025-01-10' },
      ];
      const positions = computePositions(trades);
      const pos = positions.get('AAPL');
      expect(pos.direction).toBe('flat');
      expect(pos.size).toBe(0);
      expect(pos.realizedPnl).toBe(200); // (120 - 100) * 10
    });

    it('handles partial closes', () => {
      const trades = [
        { symbol: 'AAPL', side: 'buy', quantity: 10, price: 100, date: '2025-01-01' },
        { symbol: 'AAPL', side: 'sell', quantity: 5, price: 120, date: '2025-01-10' },
      ];
      const positions = computePositions(trades);
      const pos = positions.get('AAPL');
      expect(pos.direction).toBe('long');
      expect(pos.size).toBe(5);
      expect(pos.realizedPnl).toBe(100); // (120 - 100) * 5
    });

    it('skips trades with missing data', () => {
      const trades = [
        { symbol: '', side: 'buy', quantity: 10, price: 100 },
        { symbol: 'AAPL', side: 'buy', quantity: 0, price: 100 },
        { symbol: 'AAPL', side: 'buy', quantity: 10, price: 0 },
      ];
      const positions = computePositions(trades);
      expect(positions.size).toBe(0);
    });

    it('handles multiple symbols', () => {
      const trades = [
        { symbol: 'AAPL', side: 'buy', quantity: 10, price: 100, date: '2025-01-01' },
        { symbol: 'TSLA', side: 'buy', quantity: 5, price: 200, date: '2025-01-01' },
      ];
      const positions = computePositions(trades);
      expect(positions.size).toBe(2);
    });

    it('supports alternative side values', () => {
      const trades = [
        { symbol: 'AAPL', side: 'long', quantity: 10, price: 100, date: '2025-01-01' },
        { symbol: 'TSLA', side: 'bto', quantity: 5, price: 200, date: '2025-01-01' },
      ];
      const positions = computePositions(trades);
      expect(positions.get('AAPL').direction).toBe('long');
      expect(positions.get('TSLA').direction).toBe('long');
    });
  });

  // ─── getOpenPositions ───────────────────────────────────────
  describe('getOpenPositions', () => {
    it('excludes flat positions', () => {
      const trades = [
        { symbol: 'AAPL', side: 'buy', quantity: 10, price: 100, date: '2025-01-01' },
        { symbol: 'AAPL', side: 'sell', quantity: 10, price: 120, date: '2025-01-10' },
        { symbol: 'TSLA', side: 'buy', quantity: 5, price: 200, date: '2025-01-01' },
      ];
      const open = getOpenPositions(trades);
      expect(open).toHaveLength(1);
      expect(open[0].symbol).toBe('TSLA');
    });
  });

  // ─── updateWithPrices ───────────────────────────────────────
  describe('updateWithPrices', () => {
    it('computes unrealized P&L', () => {
      const positions = [
        { symbol: 'AAPL', direction: 'long', size: 10, avgEntry: 100, currentPrice: 0, unrealizedPnl: 0 },
      ];
      const updated = updateWithPrices(positions, { AAPL: 120 });
      expect(updated[0].currentPrice).toBe(120);
      expect(updated[0].unrealizedPnl).toBe(200); // (120 - 100) * 10
    });

    it('handles short positions', () => {
      const positions = [
        { symbol: 'TSLA', direction: 'short', size: -5, avgEntry: 200, currentPrice: 0, unrealizedPnl: 0 },
      ];
      const updated = updateWithPrices(positions, { TSLA: 180 });
      // (180 - 200) * -5 = 100 (profit on short)
      expect(updated[0].unrealizedPnl).toBe(100);
    });
  });

  // ─── computeExposure ───────────────────────────────────────
  describe('computeExposure', () => {
    it('computes long and short exposure', () => {
      const positions = [
        { symbol: 'AAPL', direction: 'long', size: 10, currentPrice: 150, avgEntry: 100 },
        { symbol: 'TSLA', direction: 'short', size: -5, currentPrice: 200, avgEntry: 200 },
      ];
      const exposure = computeExposure(positions);
      expect(exposure.longExposure).toBe(1500); // 10 * 150
      expect(exposure.shortExposure).toBe(1000); // 5 * 200
      expect(exposure.netExposure).toBe(500);
      expect(exposure.grossExposure).toBe(2500);
    });

    it('returns zeros for empty positions', () => {
      const exposure = computeExposure([]);
      expect(exposure.longExposure).toBe(0);
      expect(exposure.shortExposure).toBe(0);
    });
  });
});
