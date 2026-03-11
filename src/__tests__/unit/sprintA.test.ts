// ═══════════════════════════════════════════════════════════════════
// Sprint A Tests — LeakDetector + TruePnL + TradeSnapshot
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { detectLeaks, applyLeakTags, LEAK_TAGS } from '@/psychology/LeakDetectorService.js';
import { computeTruePnL, computeBatchTruePnL } from '@/trading/TruePnL.js';
import { createSnapshot, indicatorKey } from '../../types/TradeSnapshot.js';

// ═══════════════════════════════════════════════════════════════════
// LeakDetector
// ═══════════════════════════════════════════════════════════════════

describe('LeakDetector', () => {
  describe('FOMO_ENTRY', () => {
    it('flags trades without a playbook or setup', () => {
      const tags = detectLeaks({ date: '2025-01-01', pnl: 50 });
      expect(tags).toContain(LEAK_TAGS.FOMO_ENTRY);
    });

    it('does NOT flag trades with a playbook', () => {
      const tags = detectLeaks({ date: '2025-01-01', pnl: 50, playbook: 'Breakout' });
      expect(tags).not.toContain(LEAK_TAGS.FOMO_ENTRY);
    });

    it('does NOT flag trades with a setup', () => {
      const tags = detectLeaks({ date: '2025-01-01', pnl: 50, setup: 'DB' });
      expect(tags).not.toContain(LEAK_TAGS.FOMO_ENTRY);
    });
  });

  describe('REVENGE_TRADE', () => {
    it('flags trades opened <2min after a losing trade', () => {
      const recentTrades = [
        { date: '2025-01-01T10:00:00Z', closeDate: '2025-01-01T10:00:30Z', pnl: -100, playbook: 'x' },
      ];
      const trade = { date: '2025-01-01T10:01:00Z', pnl: 50, playbook: 'x' };
      const tags = detectLeaks(trade, recentTrades);
      expect(tags).toContain(LEAK_TAGS.REVENGE_TRADE);
    });

    it('does NOT flag trades opened >2min after a losing trade', () => {
      const recentTrades = [
        { date: '2025-01-01T10:00:00Z', closeDate: '2025-01-01T10:00:30Z', pnl: -100, playbook: 'x' },
      ];
      const trade = { date: '2025-01-01T10:10:00Z', pnl: 50, playbook: 'x' };
      const tags = detectLeaks(trade, recentTrades);
      expect(tags).not.toContain(LEAK_TAGS.REVENGE_TRADE);
    });

    it('does NOT flag trades after a winning trade', () => {
      const recentTrades = [
        { date: '2025-01-01T10:00:00Z', closeDate: '2025-01-01T10:00:30Z', pnl: 100, playbook: 'x' },
      ];
      const trade = { date: '2025-01-01T10:01:00Z', pnl: 50, playbook: 'x' };
      const tags = detectLeaks(trade, recentTrades);
      expect(tags).not.toContain(LEAK_TAGS.REVENGE_TRADE);
    });
  });

  describe('EARLY_EXIT_FEAR', () => {
    it('flags long trades closed <50% to TP', () => {
      const trade = {
        entry: 100,
        exit: 105,
        takeProfit: 120,
        side: 'long',
        playbook: 'x',
        date: '2025-01-01',
      };
      const tags = detectLeaks(trade);
      expect(tags).toContain(LEAK_TAGS.EARLY_EXIT_FEAR);
    });

    it('does NOT flag trades that reached TP', () => {
      const trade = {
        entry: 100,
        exit: 118,
        takeProfit: 120,
        side: 'long',
        playbook: 'x',
        date: '2025-01-01',
      };
      const tags = detectLeaks(trade);
      expect(tags).not.toContain(LEAK_TAGS.EARLY_EXIT_FEAR);
    });
  });

  describe('HOPE_TRADING', () => {
    it('flags long trades where SL was moved down', () => {
      const trade = {
        entry: 100,
        stopLoss: 90,
        playbook: 'x',
        date: '2025-01-01',
        context: { originalStopLoss: 95 },
      };
      const tags = detectLeaks(trade);
      expect(tags).toContain(LEAK_TAGS.HOPE_TRADING);
    });

    it('does NOT flag if SL was tightened (moved up for longs)', () => {
      const trade = {
        entry: 100,
        stopLoss: 97,
        playbook: 'x',
        date: '2025-01-01',
        context: { originalStopLoss: 95 },
      };
      const tags = detectLeaks(trade);
      expect(tags).not.toContain(LEAK_TAGS.HOPE_TRADING);
    });
  });

  describe('OVERSIZED', () => {
    it('flags trades with risk% > 2× default (2%)', () => {
      const trade = { riskPercent: 3, playbook: 'x', date: '2025-01-01' };
      const tags = detectLeaks(trade);
      expect(tags).toContain(LEAK_TAGS.OVERSIZED);
    });

    it('does NOT flag normal-sized trades', () => {
      const trade = { riskPercent: 1.5, playbook: 'x', date: '2025-01-01' };
      const tags = detectLeaks(trade);
      expect(tags).not.toContain(LEAK_TAGS.OVERSIZED);
    });
  });

  describe('PERFECT_EXECUTION', () => {
    it('flags textbook trades (plan + R>=1 + profit + no other tags)', () => {
      const trade = {
        playbook: 'Breakout',
        rMultiple: 1.5,
        pnl: 150,
        date: '2025-01-01',
        riskPercent: 1,
      };
      const tags = detectLeaks(trade);
      expect(tags).toContain(LEAK_TAGS.PERFECT_EXECUTION);
      expect(tags).toHaveLength(1);
    });
  });

  describe('applyLeakTags', () => {
    it('merges leak tags into trade.tags', () => {
      const trade = { date: '2025-01-01', pnl: 50 };
      const result = applyLeakTags(trade);
      expect(result.tags).toContain(LEAK_TAGS.FOMO_ENTRY);
    });

    it('does not duplicate existing tags', () => {
      const trade = { date: '2025-01-01', pnl: 50, tags: [LEAK_TAGS.FOMO_ENTRY] };
      const result = applyLeakTags(trade);
      expect(result.tags.filter((t) => t === LEAK_TAGS.FOMO_ENTRY)).toHaveLength(1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// TruePnL
// ═══════════════════════════════════════════════════════════════════

describe('TruePnL', () => {
  describe('computeTruePnL', () => {
    it('computes gross, fees, and net for a long trade', () => {
      const result = computeTruePnL({
        entry: 100,
        exit: 110,
        qty: 10,
        fees: 5,
        side: 'long',
      });
      expect(result.grossPnL).toBe(100);
      expect(result.commissions).toBe(5);
      expect(result.netPnL).toBe(95);
    });

    it('computes gross PnL for a short trade', () => {
      const result = computeTruePnL({
        entry: 110,
        exit: 100,
        qty: 10,
        fees: 5,
        side: 'short',
      });
      expect(result.grossPnL).toBe(100);
      expect(result.netPnL).toBe(95);
    });

    it('includes funding rate cost', () => {
      const result = computeTruePnL({
        entry: 100,
        exit: 110,
        qty: 10,
        fees: 5,
        fundingRate: 3,
      });
      expect(result.fundingRate).toBe(3);
      expect(result.totalCosts).toBe(8);
      expect(result.netPnL).toBe(92);
    });

    it('computes slippage from intended vs actual prices', () => {
      const result = computeTruePnL({
        entry: 100.5,
        exit: 110,
        qty: 10,
        fees: 0,
        intendedEntry: 100,
      });
      expect(result.slippage).toBe(5); // 0.50 * 10
    });

    it('computes fee impact percentage', () => {
      const result = computeTruePnL({
        entry: 100,
        exit: 110,
        qty: 10,
        fees: 50,
      });
      expect(result.feeImpactPct).toBe(50); // 50/100 * 100
    });
  });

  describe('computeBatchTruePnL', () => {
    it('aggregates multiple trades', () => {
      const trades = [
        { entry: 100, exit: 110, qty: 10, fees: 5 },
        { entry: 200, exit: 190, qty: 5, fees: 3, side: 'short' },
      ];
      const result = computeBatchTruePnL(trades);
      expect(result.perTrade).toHaveLength(2);
      expect(result.total.grossPnL).toBe(150);
      expect(result.totalCommissions).toBe(8);
    });

    it('counts high-fee trades (>50% impact)', () => {
      const trades = [
        { entry: 100, exit: 101, qty: 1, fees: 1 }, // 1 gross, 1 fee = 100% impact
        { entry: 100, exit: 200, qty: 1, fees: 1 }, // 100 gross, 1 fee = 1% impact
      ];
      const result = computeBatchTruePnL(trades);
      expect(result.highFeeTradeCount).toBe(1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// TradeSnapshot
// ═══════════════════════════════════════════════════════════════════

describe('TradeSnapshot', () => {
  describe('createSnapshot', () => {
    it('creates a snapshot with required fields', () => {
      const snap = createSnapshot({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        price: 50000,
        indicators: { sma_20: 49500 },
      });
      expect(snap.symbol).toBe('BTCUSDT');
      expect(snap.timeframe).toBe('1h');
      expect(snap.price).toBe(50000);
      expect(snap.indicators.sma_20).toBe(49500);
      expect(snap.capturedAt).toBeGreaterThan(0);
    });

    it('computes spread from bid/ask', () => {
      const snap = createSnapshot({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        price: 50000,
        indicators: {},
        bid: 49999,
        ask: 50001,
      });
      expect(snap.spread).toBe(2);
    });

    it('excludes optional fields when not provided', () => {
      const snap = createSnapshot({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        price: 50000,
        indicators: {},
      });
      expect(snap.bid).toBeUndefined();
      expect(snap.ask).toBeUndefined();
      expect(snap.spread).toBeUndefined();
    });
  });

  describe('indicatorKey', () => {
    it('generates key from indicatorId + period', () => {
      expect(indicatorKey({ indicatorId: 'sma', params: { period: 20 } })).toBe('sma_20');
    });

    it('uses type fallback when indicatorId missing', () => {
      expect(indicatorKey({ type: 'rsi', params: { period: 14 } })).toBe('rsi_14');
    });

    it('handles indicators without period', () => {
      expect(indicatorKey({ indicatorId: 'vwap' })).toBe('vwap');
    });
  });
});
