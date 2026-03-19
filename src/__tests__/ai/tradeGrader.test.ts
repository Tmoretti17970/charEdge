// ═══════════════════════════════════════════════════════════════════
// charEdge — TradeGrader Tests (Sprint 25)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { tradeGrader } from '../../ai/TradeGrader';

// ─── Helpers ────────────────────────────────────────────────────

function makeTrade(overrides: Record<string, unknown> = {}) {
  return {
    symbol: 'BTCUSD',
    side: 'long',
    setup: 'breakout',
    setupType: 'breakout',
    pnl: 150,
    entryPrice: 65000,
    exitPrice: 65500,
    stopLoss: 64000,
    takeProfit: 66000,
    quantity: 1,
    entryDate: '2025-03-10T10:00:00Z',
    exitDate: '2025-03-10T12:00:00Z',
    ...overrides,
  };
}

function makeHistory(count: number, overrides: Record<string, unknown> = {}) {
  return Array.from({ length: count }, (_, i) => makeTrade({
    pnl: i % 3 === 0 ? -50 : 100,
    entryDate: `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
    ...overrides,
  }));
}

// ─── Tests ──────────────────────────────────────────────────────

describe('TradeGrader', () => {
  describe('Overall Grade', () => {
    it('grades a well-executed winning trade', () => {
      const trade = makeTrade({ pnl: 200, stopLoss: 64000, takeProfit: 66000 });
      const result = tradeGrader.grade(trade, makeHistory(20));
      expect(['A+', 'A', 'B+', 'B']).toContain(result.overall);
      expect(result.overallScore).toBeGreaterThanOrEqual(50);
    });

    it('grades a losing trade with good risk management', () => {
      const trade = makeTrade({
        pnl: -100,
        stopLoss: 64500,
        exitPrice: 64500, // hit stop exactly
      });
      const result = tradeGrader.grade(trade, makeHistory(20));
      // Should still get decent risk mgmt grade
      expect(result.riskMgmt.score).toBeGreaterThanOrEqual(50);
    });

    it('grades poorly when no stop loss and losing', () => {
      const trade = makeTrade({
        pnl: -500,
        stopLoss: undefined,
        takeProfit: undefined,
        setup: undefined,
        setupType: undefined,
      });
      const result = tradeGrader.grade(trade, []);
      expect(result.riskMgmt.score).toBeLessThan(50);
    });
  });

  describe('Entry Grading', () => {
    it('rewards defined setup', () => {
      const withSetup = tradeGrader.grade(makeTrade({ setup: 'breakout' }), makeHistory(10));
      const noSetup = tradeGrader.grade(makeTrade({ setup: undefined, setupType: undefined, strategy: undefined }), makeHistory(10));
      expect(withSetup.entry.score).toBeGreaterThan(noSetup.entry.score);
    });

    it('rewards having a stop loss at entry', () => {
      const withStop = tradeGrader.grade(makeTrade({ stopLoss: 64000 }), []);
      const noStop = tradeGrader.grade(makeTrade({ stopLoss: undefined }), []);
      expect(withStop.entry.score).toBeGreaterThan(noStop.entry.score);
    });
  });

  describe('Exit Grading', () => {
    it('rewards profitable exits', () => {
      const winner = tradeGrader.grade(makeTrade({ pnl: 200 }), []);
      const loser = tradeGrader.grade(makeTrade({ pnl: -200 }), []);
      expect(winner.exit.score).toBeGreaterThan(loser.exit.score);
    });

    it('rewards capturing most of the move', () => {
      const trade = makeTrade({
        entryPrice: 100,
        exitPrice: 170,
        highPrice: 180,
        lowPrice: 95,
        pnl: 70,
      });
      const result = tradeGrader.grade(trade, []);
      expect(result.exit.note).toContain('Captured');
    });
  });

  describe('Risk Management Grading', () => {
    it('rewards favorable R:R', () => {
      const goodRR = tradeGrader.grade(makeTrade({
        entryPrice: 100,
        stopLoss: 95,
        takeProfit: 115,  // R:R = 3
      }), []);
      expect(goodRR.riskMgmt.score).toBeGreaterThanOrEqual(70);
    });

    it('penalizes oversized positions', () => {
      const history = makeHistory(10, { quantity: 1 });
      const result = tradeGrader.grade(makeTrade({ quantity: 5 }), history);
      // Should note oversized
      expect(result.riskMgmt.score).toBeLessThan(70);
    });
  });

  describe('Letter Grade Boundaries', () => {
    it('maps 90+ to A+', () => {
      expect(tradeGrader.scoreToGrade(95)).toBe('A+');
    });

    it('maps 80-89 to A', () => {
      expect(tradeGrader.scoreToGrade(85)).toBe('A');
    });

    it('maps 70-79 to B+', () => {
      expect(tradeGrader.scoreToGrade(75)).toBe('B+');
    });

    it('maps 60-69 to B', () => {
      expect(tradeGrader.scoreToGrade(65)).toBe('B');
    });

    it('maps 50-59 to C', () => {
      expect(tradeGrader.scoreToGrade(55)).toBe('C');
    });

    it('maps 35-49 to D', () => {
      expect(tradeGrader.scoreToGrade(40)).toBe('D');
    });

    it('maps <35 to F', () => {
      expect(tradeGrader.scoreToGrade(20)).toBe('F');
    });
  });

  describe('Summary Generation', () => {
    it('includes overall grade in summary', () => {
      const result = tradeGrader.grade(makeTrade(), []);
      expect(result.summary).toContain('Trade Grade');
    });

    it('includes component grades table', () => {
      const result = tradeGrader.grade(makeTrade(), []);
      expect(result.summary).toContain('Entry');
      expect(result.summary).toContain('Exit');
      expect(result.summary).toContain('Risk Mgmt');
    });

    it('includes symbol in summary', () => {
      const result = tradeGrader.grade(makeTrade({ symbol: 'ETHUSD' }), []);
      expect(result.summary).toContain('ETHUSD');
    });
  });
});
