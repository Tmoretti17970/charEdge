// ═══════════════════════════════════════════════════════════════════
// charEdge — PortfolioRiskAnalyzer Tests (Sprint 23)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { portfolioRiskAnalyzer } from '../../ai/PortfolioRiskAnalyzer';

// ─── Helpers ────────────────────────────────────────────────────

function makeOpen(overrides: Record<string, unknown> = {}) {
  return {
    symbol: 'BTC',
    side: 'long',
    isOpen: true,
    entryPrice: 65000,
    currentPrice: 66000,
    quantity: 0.1,
    pnl: 100,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('PortfolioRiskAnalyzer', () => {
  it('returns zero exposure for empty trades', () => {
    const result = portfolioRiskAnalyzer.analyze([]);
    expect(result.positionCount).toBe(0);
    expect(result.totalExposure).toBe(0);
    expect(result.summary).toContain('No open positions');
  });

  it('calculates exposure from open positions', () => {
    const trades = [
      makeOpen({ symbol: 'BTC', entryPrice: 65000, quantity: 0.1 }),
      makeOpen({ symbol: 'ETH', entryPrice: 3500, quantity: 1, currentPrice: 3600 }),
    ];
    const result = portfolioRiskAnalyzer.analyze(trades, 50000);
    expect(result.positionCount).toBe(2);
    expect(result.totalExposure).toBeGreaterThan(0);
  });

  it('ignores closed trades', () => {
    const trades = [
      makeOpen({ isOpen: true }),
      { symbol: 'ETH', pnl: 50, exitDate: '2025-03-01', entryPrice: 3500 }, // closed
    ];
    const result = portfolioRiskAnalyzer.analyze(trades, 50000);
    expect(result.positionCount).toBe(1);
  });

  it('warns on concentrated positions (>30%)', () => {
    const trades = [
      makeOpen({ entryPrice: 65000, quantity: 1, currentPrice: 65000 }),
    ];
    // Position = 65000, portfolio = 100000 → 65%
    const result = portfolioRiskAnalyzer.analyze(trades, 100000);
    expect(result.concentrationWarning).not.toBeNull();
    expect(result.concentrationWarning).toContain('BTC');
  });

  it('no concentration warning for small positions', () => {
    const trades = [
      makeOpen({ entryPrice: 100, quantity: 1, currentPrice: 100 }),
    ];
    // Position = 100, portfolio = 10000 → 1%
    const result = portfolioRiskAnalyzer.analyze(trades, 10000);
    expect(result.concentrationWarning).toBeNull();
  });

  it('calculates unrealized P&L', () => {
    const trades = [
      makeOpen({ pnl: 200 }),
      makeOpen({ pnl: -50 }),
    ];
    const result = portfolioRiskAnalyzer.analyze(trades);
    expect(result.totalUnrealizedPnl).toBe(150);
  });

  it('summary includes position count', () => {
    const trades = [makeOpen(), makeOpen({ symbol: 'ETH' })];
    const result = portfolioRiskAnalyzer.analyze(trades);
    expect(result.summary).toContain('2 open positions');
  });

  it('identifies largest position', () => {
    const trades = [
      makeOpen({ symbol: 'BTC', entryPrice: 65000, quantity: 1 }),
      makeOpen({ symbol: 'ETH', entryPrice: 3500, quantity: 1 }),
    ];
    const result = portfolioRiskAnalyzer.analyze(trades, 100000);
    expect(result.largestPosition).not.toBeNull();
    expect(result.largestPosition!.symbol).toBe('BTC');
  });
});
