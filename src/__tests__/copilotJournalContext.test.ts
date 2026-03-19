// ═══════════════════════════════════════════════════════════════════
// charEdge — Copilot Journal Context Tests (Sprint 7)
//
// Tests for trade query intent detection and recent trade formatting.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { isTradeQuery, formatRecentTrades } from '../hooks/useCopilotChat';

// ─── isTradeQuery Tests ─────────────────────────────────────────

describe('isTradeQuery', () => {
  it('detects "my best trade" queries', () => {
    expect(isTradeQuery('What was my best trade this week?')).toBe(true);
    expect(isTradeQuery('show me my best trade')).toBe(true);
  });

  it('detects "worst trade" queries', () => {
    expect(isTradeQuery('What was my worst trade?')).toBe(true);
    expect(isTradeQuery('worst trade this month')).toBe(true);
  });

  it('detects "last trade" queries', () => {
    expect(isTradeQuery('What was my last trade?')).toBe(true);
    expect(isTradeQuery('review my last trade')).toBe(true);
  });

  it('detects win rate queries', () => {
    expect(isTradeQuery("What's my win rate?")).toBe(true);
    expect(isTradeQuery('my winrate on ETH')).toBe(true);
  });

  it('detects journal/logbook queries', () => {
    expect(isTradeQuery('search my journal')).toBe(true);
    expect(isTradeQuery('show logbook')).toBe(true);
  });

  it('detects "how did I do" queries', () => {
    expect(isTradeQuery('How did I do this week?')).toBe(true);
    expect(isTradeQuery('How am I doing today?')).toBe(true);
  });

  it('detects "show me my" queries', () => {
    expect(isTradeQuery('Show me my performance')).toBe(true);
    expect(isTradeQuery('show me my trades this week')).toBe(true);
  });

  it('detects time-based queries', () => {
    expect(isTradeQuery('trades this week')).toBe(true);
    expect(isTradeQuery('trades last month')).toBe(true);
    expect(isTradeQuery('this week performance')).toBe(true);
  });

  it('detects symbol-specific queries', () => {
    expect(isTradeQuery('my ETH trades')).toBe(true);
    expect(isTradeQuery('BTC trades today')).toBe(true);
    expect(isTradeQuery('my SOL performance')).toBe(true);
  });

  it('detects preset chip pattern', () => {
    expect(isTradeQuery('🏆 Best trade this week')).toBe(true);
  });

  it('detects P&L queries', () => {
    expect(isTradeQuery("What's my P&L?")).toBe(true);
    expect(isTradeQuery('show my pnl')).toBe(true);
    expect(isTradeQuery('my profit this week')).toBe(true);
  });

  it('detects behavioral pattern queries', () => {
    expect(isTradeQuery('Am I overtrading?')).toBe(true);
    expect(isTradeQuery('revenge trading pattern')).toBe(true);
  });

  it('does NOT match non-trade queries', () => {
    expect(isTradeQuery('What is RSI?')).toBe(false);
    expect(isTradeQuery('Analyze this chart')).toBe(false);
    expect(isTradeQuery('What do you see?')).toBe(false);
    expect(isTradeQuery('Add MACD indicator')).toBe(false);
    expect(isTradeQuery('Hello')).toBe(false);
    expect(isTradeQuery('What is support and resistance?')).toBe(false);
  });
});

// ─── formatRecentTrades Tests ───────────────────────────────────

describe('formatRecentTrades', () => {
  const SAMPLE_TRADES = [
    { id: 't1', symbol: 'BTCUSDT', side: 'long', pnl: 150.50, entryDate: '2024-03-10', exitDate: '2024-03-10', setup: 'breakout' },
    { id: 't2', symbol: 'ETHUSDT', side: 'short', pnl: -75.00, entryDate: '2024-03-09', exitDate: '2024-03-09', setup: 'fade' },
    { id: 't3', symbol: 'SOLUSDT', side: 'long', pnl: 200.00, entryDate: '2024-03-11', exitDate: '2024-03-11', strategy: 'momentum' },
    { id: 't4', symbol: 'BTCUSDT', side: 'long', pnl: 0, entryDate: '2024-03-08', exitDate: '2024-03-08' },
  ];

  it('returns empty string for empty array', () => {
    expect(formatRecentTrades([])).toBe('');
    expect(formatRecentTrades(null)).toBe('');
    expect(formatRecentTrades(undefined)).toBe('');
  });

  it('formats trades as numbered list', () => {
    const result = formatRecentTrades(SAMPLE_TRADES);
    expect(result).toContain('--- Recent Trades');
    expect(result).toContain('1.');
    expect(result).toContain('2.');
  });

  it('shows correct side and symbol', () => {
    const result = formatRecentTrades(SAMPLE_TRADES);
    expect(result).toContain('Long BTCUSDT');
    expect(result).toContain('Short ETHUSDT');
    expect(result).toContain('Long SOLUSDT');
  });

  it('shows P&L with correct sign', () => {
    const result = formatRecentTrades(SAMPLE_TRADES);
    expect(result).toContain('+$150.50');
    expect(result).toContain('-$75.00');
    expect(result).toContain('+$200.00');
    expect(result).toContain('+$0.00');
  });

  it('includes setup type when available', () => {
    const result = formatRecentTrades(SAMPLE_TRADES);
    expect(result).toContain('(breakout)');
    expect(result).toContain('(fade)');
    expect(result).toContain('(momentum)');
  });

  it('sorts by most recent first', () => {
    const result = formatRecentTrades(SAMPLE_TRADES);
    const lines = result.split('\n').filter(l => l.match(/^\d+\./));
    // SOL (Mar 11) should be first, then BTC (Mar 10), then ETH (Mar 9)
    expect(lines[0]).toContain('SOLUSDT');
    expect(lines[1]).toContain('BTCUSDT');
    expect(lines[2]).toContain('ETHUSDT');
  });

  it('respects limit parameter', () => {
    const result = formatRecentTrades(SAMPLE_TRADES, 2);
    const lines = result.split('\n').filter(l => l.match(/^\d+\./));
    expect(lines.length).toBe(2);
  });

  it('filters out trades without pnl', () => {
    const trades = [
      { id: 'a', symbol: 'BTC', side: 'long', pnl: 100 },
      { id: 'b', symbol: 'ETH', side: 'long' },  // no pnl — open trade
    ];
    const result = formatRecentTrades(trades);
    expect(result).toContain('BTC');
    expect(result).not.toContain('ETH');
  });

  it('includes count in header', () => {
    const result = formatRecentTrades(SAMPLE_TRADES);
    expect(result).toContain('Recent Trades (4)');
  });
});
