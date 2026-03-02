// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Coach Test Suite (H2.3)
// Tests for CoachingEngine, PreTradeAnalyzer, and JournalSummarizer.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import { generateWeeklyReport, scoreToGrade } from '../charting_library/ai/CoachingEngine.js';
import { analyzePreTrade } from '../charting_library/ai/PreTradeAnalyzer.js';
import { summarizeWeek } from '../charting_library/ai/JournalSummarizer.js';

// ─── Test Helpers ────────────────────────────────────────────────

function makeTrade(overrides = {}) {
  const base = {
    id: crypto.randomUUID(),
    symbol: 'AAPL',
    side: 'long',
    pnl: 50,
    date: new Date().toISOString(),
    strategy: 'breakout',
    emotion: 'confident',
    stopLoss: 145,
  };
  return { ...base, ...overrides };
}

function makeWeekTrades(count, opts = {}) {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => makeTrade({
    ...opts,
    date: new Date(now - i * 3600_000).toISOString(),
    pnl: opts.pnl !== undefined ? opts.pnl : (i % 3 === 0 ? -30 : 40 + i * 5),
  }));
}

// ═══════════════════════════════════════════════════════════════════
// CoachingEngine Tests
// ═══════════════════════════════════════════════════════════════════

describe('CoachingEngine — generateWeeklyReport', () => {
  it('returns null for empty trades', () => {
    expect(generateWeeklyReport([], null, {})).toBeNull();
  });

  it('returns null for too few trades', () => {
    expect(generateWeeklyReport([makeTrade()], null, {})).toBeNull();
    expect(generateWeeklyReport([makeTrade(), makeTrade()], null, {})).toBeNull();
  });

  it('returns null when no trades in current week', () => {
    const oldTrades = makeWeekTrades(5).map(t => ({
      ...t,
      date: new Date(Date.now() - 30 * 24 * 3600_000).toISOString(),
    }));
    expect(generateWeeklyReport(oldTrades, null, {})).toBeNull();
  });

  it('generates a structured report for a normal week', () => {
    const trades = makeWeekTrades(10);
    const report = generateWeeklyReport(trades, null, {});

    expect(report).not.toBeNull();
    expect(report.id).toBeDefined();
    expect(report.weekOf).toBeDefined();
    expect(report.generatedAt).toBeDefined();
    expect(['A', 'B', 'C', 'D', 'F']).toContain(report.grade);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(report.sections).toHaveLength(5);
    expect(report.topInsight).toBeTruthy();
    expect(report.focusArea).toBeTruthy();
    expect(report.comparison).toHaveProperty('thisWeekPnl');
    expect(report.comparison).toHaveProperty('prevWeekPnl');
    expect(report.comparison).toHaveProperty('trend');
  });

  it('grades all-winners higher than all-losers', () => {
    const winners = makeWeekTrades(8, { pnl: 100 });
    const losers = makeWeekTrades(8, { pnl: -100 });

    const winReport = generateWeeklyReport(winners, null, {});
    const loseReport = generateWeeklyReport(losers, null, {});

    expect(winReport.score).toBeGreaterThan(loseReport.score);
  });

  it('each section has required fields', () => {
    const trades = makeWeekTrades(10);
    const report = generateWeeklyReport(trades, null, {});

    for (const section of report.sections) {
      expect(section.title).toBeTruthy();
      expect(section.icon).toBeTruthy();
      expect(['A', 'B', 'C', 'D', 'F']).toContain(section.grade);
      expect(section.score).toBeGreaterThanOrEqual(0);
      expect(section.summary).toBeTruthy();
      expect(section.details).toBeTruthy();
      expect(Array.isArray(section.recommendations)).toBe(true);
      expect(section.recommendations.length).toBeGreaterThan(0);
    }
  });

  it('recommendations are non-empty strings', () => {
    const trades = makeWeekTrades(10);
    const report = generateWeeklyReport(trades, null, {});

    for (const section of report.sections) {
      for (const rec of section.recommendations) {
        expect(typeof rec).toBe('string');
        expect(rec.length).toBeGreaterThan(5);
      }
    }
  });

  it('comparison.trend reflects P&L direction', () => {
    const now = Date.now();
    // This week: profitable
    const thisWeek = Array.from({ length: 5 }, (_, i) => makeTrade({
      date: new Date(now - i * 3600_000).toISOString(), pnl: 100,
    }));
    // Last week: losing
    const lastWeek = Array.from({ length: 5 }, (_, i) => makeTrade({
      date: new Date(now - 8 * 24 * 3600_000 - i * 3600_000).toISOString(), pnl: -100,
    }));
    const all = [...thisWeek, ...lastWeek];
    const report = generateWeeklyReport(all, null, {});

    expect(report.comparison.trend).toBe('improving');
    expect(report.comparison.thisWeekPnl).toBeGreaterThan(report.comparison.prevWeekPnl);
  });

  it('scoreToGrade maps correctly', () => {
    expect(scoreToGrade(95)).toBe('A');
    expect(scoreToGrade(85)).toBe('B');
    expect(scoreToGrade(75)).toBe('C');
    expect(scoreToGrade(65)).toBe('D');
    expect(scoreToGrade(45)).toBe('F');
  });
});

// ═══════════════════════════════════════════════════════════════════
// PreTradeAnalyzer Tests
// ═══════════════════════════════════════════════════════════════════

describe('PreTradeAnalyzer — analyzePreTrade', () => {
  it('returns empty result for null inputs', () => {
    const r = analyzePreTrade(null, [], null);
    expect(r.confidence).toBe('low');
    expect(r.score).toBe(0);
    expect(r.historicalMatches).toHaveLength(0);
  });

  it('returns empty result for empty trades', () => {
    const r = analyzePreTrade({ symbol: 'AAPL', side: 'long' }, [], null);
    expect(r.confidence).toBe('low');
  });

  it('finds symbol matches in history', () => {
    const trades = [
      makeTrade({ symbol: 'AAPL', pnl: 100 }),
      makeTrade({ symbol: 'TSLA', pnl: -50 }),
      makeTrade({ symbol: 'AAPL', pnl: 80 }),
    ];

    const r = analyzePreTrade({ symbol: 'AAPL', side: 'long' }, trades);
    const aaplMatches = r.historicalMatches.filter(m => m.trade.symbol === 'AAPL');
    expect(aaplMatches.length).toBeGreaterThanOrEqual(1);
    expect(aaplMatches[0].similarity).toBeGreaterThan(0);
  });

  it('multi-dimension match scores higher', () => {
    const trades = [
      makeTrade({ symbol: 'AAPL', side: 'long', strategy: 'breakout' }),
      makeTrade({ symbol: 'AAPL', side: 'short', strategy: 'reversal' }),
    ];

    const r = analyzePreTrade({ symbol: 'AAPL', side: 'long', strategy: 'breakout' }, trades);
    // The first trade matches on all 3 dimensions, should score highest
    if (r.historicalMatches.length > 0) {
      expect(r.historicalMatches[0].similarity).toBeGreaterThanOrEqual(50);
    }
  });

  it('warns on negative emotion', () => {
    const trades = makeWeekTrades(5);
    const r = analyzePreTrade({ symbol: 'AAPL', side: 'long', emotion: 'frustrated' }, trades);
    const emotionWarning = r.warnings.find(w => w.includes('frustrated'));
    expect(emotionWarning).toBeDefined();
  });

  it('confidence is high for large sample', () => {
    const trades = Array.from({ length: 15 }, () => makeTrade({ symbol: 'AAPL', side: 'long', pnl: 50 }));
    const r = analyzePreTrade({ symbol: 'AAPL', side: 'long' }, trades);
    expect(r.confidence).toBe('high');
    expect(r.stats.sampleSize).toBeGreaterThanOrEqual(10);
  });
});

// ═══════════════════════════════════════════════════════════════════
// JournalSummarizer Tests
// ═══════════════════════════════════════════════════════════════════

describe('JournalSummarizer — summarizeWeek', () => {
  it('returns empty summary for no trades', () => {
    const s = summarizeWeek([]);
    expect(s.tradeCount).toBe(0);
    expect(s.netPnl).toBe(0);
    expect(s.narrative).toContain('No trades');
  });

  it('includes trade count and P&L in narrative', () => {
    const trades = makeWeekTrades(6);
    const s = summarizeWeek(trades);

    expect(s.tradeCount).toBe(6);
    expect(s.narrative).toContain('6');
    expect(s.narrative.length).toBeGreaterThan(20);
  });

  it('top symbols sorted by absolute P&L', () => {
    const trades = [
      makeTrade({ symbol: 'AAPL', pnl: 500 }),
      makeTrade({ symbol: 'TSLA', pnl: -200 }),
      makeTrade({ symbol: 'MSFT', pnl: 100 }),
    ];
    const s = summarizeWeek(trades);

    expect(s.topSymbols.length).toBeGreaterThan(0);
    expect(s.topSymbols[0].symbol).toBe('AAPL');
  });

  it('computes emotion breakdown', () => {
    const trades = [
      makeTrade({ emotion: 'confident', pnl: 200 }),
      makeTrade({ emotion: 'anxious', pnl: -100 }),
      makeTrade({ emotion: 'confident', pnl: 150 }),
    ];
    const s = summarizeWeek(trades);

    expect(s.emotionBreakdown.best).toBeDefined();
    expect(s.emotionBreakdown.best.emotion).toBe('confident');
    expect(s.emotionBreakdown.worst.emotion).toBe('anxious');
  });

  it('picks key moments from highest-magnitude P&L', () => {
    const trades = [
      makeTrade({ pnl: 10 }),
      makeTrade({ pnl: -500 }),
      makeTrade({ pnl: 300 }),
      makeTrade({ pnl: -20 }),
    ];
    const s = summarizeWeek(trades);

    expect(s.keyMoments.length).toBeLessThanOrEqual(3);
    // First key moment should be highest magnitude
    expect(Math.abs(s.keyMoments[0].pnl)).toBeGreaterThanOrEqual(Math.abs(s.keyMoments[1].pnl));
  });

  it('includes noteCount in summary', () => {
    const trades = makeWeekTrades(3);
    const notes = [{ date: new Date().toISOString(), content: 'Note 1' }];
    const s = summarizeWeek(trades, notes);

    expect(s.noteCount).toBe(1);
  });
});
