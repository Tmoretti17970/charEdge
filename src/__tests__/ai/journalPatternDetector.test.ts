// ═══════════════════════════════════════════════════════════════════
// charEdge — JournalPatternDetector Tests (Sprint 22)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { journalPatternDetector } from '../../ai/JournalPatternDetector';
import type { DetectedPattern } from '../../ai/JournalPatternDetector';

// ─── Helpers ────────────────────────────────────────────────────

function makeTrade(overrides: Record<string, unknown> = {}) {
  return {
    pnl: 100,
    side: 'long',
    symbol: 'BTCUSD',
    setup: 'breakout',
    entryDate: '2025-03-10T10:00:00Z',
    exitDate: '2025-03-10T11:00:00Z',
    quantity: 1,
    ...overrides,
  };
}

function makeWinner(overrides: Record<string, unknown> = {}) {
  return makeTrade({ pnl: 100, ...overrides });
}

function makeLosser(overrides: Record<string, unknown> = {}) {
  return makeTrade({ pnl: -80, ...overrides });
}

function hasPattern(patterns: DetectedPattern[], type: string): boolean {
  return patterns.some((p) => p.type === type);
}

// ─── Tests ──────────────────────────────────────────────────────

describe('JournalPatternDetector', () => {
  describe('Core Stats', () => {
    it('calculates win rate correctly', () => {
      const trades = [makeWinner(), makeWinner(), makeWinner(), makeLosser(), makeLosser()];
      const result = journalPatternDetector.analyze(trades);
      expect(result.winRate).toBeCloseTo(0.6, 1);
      expect(result.totalTrades).toBe(5);
    });

    it('calculates avg win and avg loss', () => {
      const trades = [
        makeTrade({ pnl: 200 }),
        makeTrade({ pnl: 100 }),
        makeTrade({ pnl: -50 }),
        makeTrade({ pnl: -150 }),
      ];
      const result = journalPatternDetector.analyze(trades);
      expect(result.avgWin).toBeCloseTo(150, 0);
      expect(result.avgLoss).toBeCloseTo(100, 0);
    });

    it('calculates expectancy', () => {
      const trades = [
        makeTrade({ pnl: 200 }),
        makeTrade({ pnl: 100 }),
        makeTrade({ pnl: -50 }),
        makeTrade({ pnl: -150 }),
      ];
      const result = journalPatternDetector.analyze(trades);
      // expectancy = winRate * avgWin - (1-winRate) * avgLoss
      // 0.5 * 150 - 0.5 * 100 = 75 - 50 = 25
      expect(result.expectancy).toBeCloseTo(25, 0);
    });

    it('handles empty trades', () => {
      const result = journalPatternDetector.analyze([]);
      expect(result.totalTrades).toBe(0);
      expect(result.winRate).toBe(0);
      expect(result.patterns).toHaveLength(1);
      expect(result.patterns[0]!.type).toBe('cold_start');
    });

    it('ignores trades without pnl', () => {
      const trades = [
        makeWinner(),
        { symbol: 'BTC', side: 'long' }, // no pnl
        makeLosser(),
      ];
      const result = journalPatternDetector.analyze(
        trades as unknown as Parameters<typeof journalPatternDetector.analyze>[0],
      );
      expect(result.totalTrades).toBe(2);
    });
  });

  describe('Streak Detection', () => {
    it('detects current winning streak', () => {
      const trades = [makeLosser(), makeWinner(), makeWinner(), makeWinner()];
      const result = journalPatternDetector.analyze(trades);
      expect(result.streaks.current.type).toBe('win');
      expect(result.streaks.current.count).toBe(3);
    });

    it('detects current losing streak', () => {
      const trades = [makeWinner(), makeLosser(), makeLosser(), makeLosser(), makeLosser()];
      const result = journalPatternDetector.analyze(trades);
      expect(result.streaks.current.type).toBe('loss');
      expect(result.streaks.current.count).toBe(4);
    });

    it('generates streak pattern for 3+ wins', () => {
      const trades = [makeLosser(), makeWinner(), makeWinner(), makeWinner()];
      const result = journalPatternDetector.analyze(trades);
      expect(hasPattern(result.patterns, 'streak')).toBe(true);
    });

    it('generates streak pattern for 3+ losses with warning severity', () => {
      const trades = [makeWinner(), makeLosser(), makeLosser(), makeLosser()];
      const result = journalPatternDetector.analyze(trades);
      const streakPattern = result.patterns.find((p) => p.type === 'streak');
      expect(streakPattern).toBeDefined();
      expect(streakPattern!.severity).toBe('warning');
    });
  });

  describe('Overtrading Detection', () => {
    it('detects overtrading on high-activity days with worse win rate', () => {
      const trades: ReturnType<typeof makeTrade>[] = [];
      // 3 days with 6+ trades each (high activity, low win rate - 1/6)
      for (let d = 1; d <= 3; d++) {
        for (let i = 0; i < 6; i++) {
          trades.push(
            makeTrade({
              pnl: i === 0 ? 100 : -50,
              entryDate: `2025-03-${String(d).padStart(2, '0')}T${String(9 + i).padStart(2, '0')}:00:00Z`,
            }),
          );
        }
      }
      // 3 days with normal activity (high win rate - 2/2)
      for (let d = 10; d <= 12; d++) {
        trades.push(makeWinner({ entryDate: `2025-03-${d}T10:00:00Z` }));
        trades.push(makeWinner({ entryDate: `2025-03-${d}T11:00:00Z` }));
      }

      const result = journalPatternDetector.analyze(trades);
      expect(hasPattern(result.patterns, 'overtrading')).toBe(true);
    });
  });

  describe('Revenge Trading Detection', () => {
    it('detects revenge trading when size increases after losses', () => {
      const trades = [];
      // 3+ instances of loss → larger size next trade
      for (let i = 0; i < 4; i++) {
        trades.push(makeLosser({ quantity: 1, entryDate: `2025-03-${10 + i}T10:00:00Z` }));
        trades.push(makeWinner({ quantity: 2, entryDate: `2025-03-${10 + i}T11:00:00Z` }));
      }
      const result = journalPatternDetector.analyze(trades);
      expect(hasPattern(result.patterns, 'revenge')).toBe(true);
    });
  });

  describe('Size Drift Detection', () => {
    it('detects increasing position sizes over time', () => {
      const trades = [];
      // First 10 trades: size 1
      for (let i = 0; i < 10; i++) {
        trades.push(makeWinner({ quantity: 1, entryDate: `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z` }));
      }
      // Next 10 trades: size 2 (2x increase > 1.5x threshold)
      for (let i = 0; i < 10; i++) {
        trades.push(makeWinner({ quantity: 2, entryDate: `2025-02-${String(i + 1).padStart(2, '0')}T10:00:00Z` }));
      }
      const result = journalPatternDetector.analyze(trades);
      expect(hasPattern(result.patterns, 'size_drift')).toBe(true);
    });
  });

  describe('Setup Edge Analysis', () => {
    it('identifies top setup by win rate', () => {
      const trades = [
        // Breakout: 4/5 = 80% WR
        ...Array.from({ length: 4 }, () => makeWinner({ setup: 'breakout' })),
        makeLosser({ setup: 'breakout' }),
        // Pullback: 2/5 = 40% WR
        ...Array.from({ length: 2 }, () => makeWinner({ setup: 'pullback' })),
        ...Array.from({ length: 3 }, () => makeLosser({ setup: 'pullback' })),
      ];
      const result = journalPatternDetector.analyze(trades);
      expect(result.topSetup).not.toBeNull();
      expect(result.topSetup!.name).toBe('breakout');
      expect(result.topSetup!.winRate).toBeCloseTo(0.8, 1);
    });

    it('generates setup_edge pattern for top setup', () => {
      const trades = [
        ...Array.from({ length: 5 }, () => makeWinner({ setup: 'breakout' })),
        ...Array.from({ length: 5 }, () => makeLosser({ setup: 'pullback' })),
      ];
      const result = journalPatternDetector.analyze(trades);
      expect(hasPattern(result.patterns, 'setup_edge')).toBe(true);
    });
  });

  describe('Summary Generation', () => {
    it('includes win rate in summary', () => {
      const trades = [makeWinner(), makeWinner(), makeLosser()];
      const result = journalPatternDetector.analyze(trades);
      expect(result.summary).toContain('Win rate');
    });

    it('includes trade count in summary', () => {
      const trades = [makeWinner(), makeWinner(), makeLosser()];
      const result = journalPatternDetector.analyze(trades);
      expect(result.summary).toContain('3 trades');
    });

    it('includes expectancy in summary', () => {
      const trades = [makeWinner(), makeWinner(), makeLosser()];
      const result = journalPatternDetector.analyze(trades);
      expect(result.summary).toContain('Expectancy');
    });

    it('returns cold start summary for empty trades', () => {
      const result = journalPatternDetector.analyze([]);
      expect(result.summary).toContain('No closed trades');
    });
  });

  describe('Pattern Sorting', () => {
    it('sorts patterns by severity (critical first)', () => {
      // Create conditions that trigger multiple severity levels
      const trades: ReturnType<typeof makeTrade>[] = [];
      // 5+ losses in a row for critical streak
      for (let i = 0; i < 6; i++) {
        trades.push(makeLosser({ entryDate: `2025-03-01T${String(10 + i).padStart(2, '0')}:00:00Z` }));
      }
      // Add some winners at the end
      for (let i = 0; i < 5; i++) {
        trades.push(
          makeWinner({ setup: 'breakout', entryDate: `2025-03-15T${String(10 + i).padStart(2, '0')}:00:00Z` }),
        );
      }

      const result = journalPatternDetector.analyze(trades);
      if (result.patterns.length >= 2) {
        const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
        for (let i = 1; i < result.patterns.length; i++) {
          const prev = severityOrder[result.patterns[i - 1]!.severity] ?? 2;
          const curr = severityOrder[result.patterns[i]!.severity] ?? 2;
          expect(prev).toBeLessThanOrEqual(curr);
        }
      }
    });
  });
});
