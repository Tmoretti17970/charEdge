// ═══════════════════════════════════════════════════════════════════
// charEdge — TradeCardFormatter Tests (Sprint 31)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { TradeCardFormatter } from '../../ai/TradeCardFormatter';

const formatter = new TradeCardFormatter();

describe('TradeCardFormatter', () => {
  const baseTrade = {
    symbol: 'BTCUSD',
    side: 'long' as const,
    entryPrice: 65000,
    exitPrice: 66200,
    pnl: 120,
    setup: 'Breakout',
    entryDate: '2025-03-10T10:00:00Z',
    exitDate: '2025-03-10T12:15:00Z',
  };

  describe('formatCard', () => {
    it('includes symbol and side', () => {
      const card = formatter.formatCard(baseTrade);
      expect(card).toContain('BTCUSD');
      expect(card).toContain('LONG');
    });

    it('shows entry and exit prices', () => {
      const card = formatter.formatCard(baseTrade);
      expect(card).toContain('Entry $65,000');
      expect(card).toContain('Exit $66,200');
    });

    it('shows P&L with emoji', () => {
      const card = formatter.formatCard(baseTrade);
      expect(card).toContain('+$120.00');
      expect(card).toContain('✅');
    });

    it('shows losing trade with ❌', () => {
      const card = formatter.formatCard({ ...baseTrade, pnl: -50 });
      expect(card).toContain('$-50.00');
      expect(card).toContain('❌');
    });

    it('shows setup name', () => {
      const card = formatter.formatCard(baseTrade);
      expect(card).toContain('Breakout');
    });

    it('shows duration', () => {
      const card = formatter.formatCard(baseTrade);
      expect(card).toContain('2h 15m');
    });

    it('handles open trade (no exit)', () => {
      const card = formatter.formatCard({ symbol: 'ETHUSD', side: 'long', entryPrice: 3000 });
      expect(card).toContain('(Open)');
    });

    it('truncates long notes', () => {
      const card = formatter.formatCard({
        ...baseTrade,
        notes: 'a'.repeat(100),
      });
      expect(card).toContain('…');
    });

    it('handles short side', () => {
      const card = formatter.formatCard({ ...baseTrade, side: 'short' });
      expect(card).toContain('SHORT');
      expect(card).toContain('🔴');
    });
  });

  describe('formatTrades', () => {
    it('returns "no matching" for empty array', () => {
      expect(formatter.formatTrades([])).toContain('No matching trades');
    });

    it('joins multiple cards with separators', () => {
      const trades = [baseTrade, { ...baseTrade, symbol: 'ETHUSD' }];
      const result = formatter.formatTrades(trades);
      expect(result).toContain('BTCUSD');
      expect(result).toContain('ETHUSD');
      expect(result).toContain('---');
    });

    it('limits to specified count', () => {
      const trades = Array(10).fill(baseTrade);
      const result = formatter.formatTrades(trades, 3);
      expect(result).toContain('and 7 more trades');
    });
  });

  describe('formatSearchResults', () => {
    it('includes search query in header', () => {
      const result = formatter.formatSearchResults('winning BTC', [baseTrade]);
      expect(result).toContain('winning BTC');
      expect(result).toContain('Found 1 matching trade');
    });

    it('pluralizes correctly', () => {
      const result = formatter.formatSearchResults('test', [baseTrade, baseTrade]);
      expect(result).toContain('Found 2 matching trades');
    });
  });
});
