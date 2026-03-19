// ═══════════════════════════════════════════════════════════════════
// charEdge — Predictive Setup Scorer (Sprint 75)
//
// Traffic-light scoring (🟢🟡🔴) for pre-trade setups based on
// historical performance. Analyzes win rate per setup + symbol +
// timeframe combination.
//
// Usage:
//   import { setupScorer } from './SetupScorer';
//   const score = setupScorer.score(trades, { symbol: 'NVDA', setup: 'breakout', tf: '15' });
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface SetupScore {
  score: number;           // 0–100
  signal: 'green' | 'yellow' | 'red';
  emoji: string;
  reason: string;
  historicalWinRate: number;
  avgPnl: number;
  sampleSize: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface SetupContext {
  symbol: string;
  setup: string;
  timeframe?: string;
  side?: string;
}

interface TradeRecord {
  [key: string]: unknown;
  pnl?: number;
  symbol?: string;
  setupType?: string;
  timeframe?: string;
  side?: string;
}

// ─── Scorer ─────────────────────────────────────────────────────

class SetupScorer {
  /**
   * Score a proposed setup against historical trade data.
   */
  score(trades: TradeRecord[], ctx: SetupContext): SetupScore {
    // Find matching historical trades with progressive relaxation
    let matches = this._findMatches(trades, ctx, 'exact');
    let matchLevel = 'exact';

    if (matches.length < 3) {
      matches = this._findMatches(trades, ctx, 'setup+symbol');
      matchLevel = 'setup+symbol';
    }
    if (matches.length < 3) {
      matches = this._findMatches(trades, ctx, 'setup');
      matchLevel = 'setup';
    }
    if (matches.length < 3) {
      matches = this._findMatches(trades, ctx, 'symbol');
      matchLevel = 'symbol';
    }

    if (matches.length < 2) {
      return {
        score: 50,
        signal: 'yellow',
        emoji: '🟡',
        reason: `Not enough historical data for ${ctx.setup} on ${ctx.symbol}. Trade with caution.`,
        historicalWinRate: 0,
        avgPnl: 0,
        sampleSize: 0,
        confidence: 'low',
      };
    }

    // Calculate metrics
    const wins = matches.filter(t => (t.pnl || 0) > 0);
    const winRate = wins.length / matches.length;
    const avgPnl = matches.reduce((s, t) => s + (t.pnl || 0), 0) / matches.length;
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.pnl || 0), 0) / wins.length : 0;
    const losses = matches.filter(t => (t.pnl || 0) <= 0);
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + (t.pnl || 0), 0) / losses.length) : 1;

    // Composite score (weighted)
    const winRateScore = winRate * 40;
    const profitScore = Math.min(30, Math.max(0, (avgPnl / (avgLoss || 1)) * 15));
    const sampleBonus = Math.min(20, matches.length * 2);
    const riskReward = avgLoss > 0 ? avgWin / avgLoss : 1;
    const rrBonus = Math.min(10, riskReward * 3);

    const raw = winRateScore + profitScore + sampleBonus + rrBonus;
    const score = Math.round(Math.max(0, Math.min(100, raw)));

    const signal = score >= 65 ? 'green' : score >= 40 ? 'yellow' : 'red';
    const emoji = signal === 'green' ? '🟢' : signal === 'yellow' ? '🟡' : '🔴';
    const confidence = matches.length >= 15 ? 'high' : matches.length >= 7 ? 'medium' : 'low';

    const reason = this._buildReason(ctx, winRate, avgPnl, matches.length, matchLevel, signal);

    return {
      score,
      signal,
      emoji,
      reason,
      historicalWinRate: Math.round(winRate * 100),
      avgPnl: Math.round(avgPnl * 100) / 100,
      sampleSize: matches.length,
      confidence,
    };
  }

  // ─── Matching Strategies ─────────────────────────────────────

  private _findMatches(trades: TradeRecord[], ctx: SetupContext, level: string): TradeRecord[] {
    return trades.filter(t => {
      if (typeof t.pnl !== 'number') return false;

      const sym = (typeof t.symbol === 'string' ? t.symbol : '').toUpperCase();
      const setup = (typeof t.setupType === 'string' ? t.setupType : '').toLowerCase();
      const tf = typeof t.timeframe === 'string' ? t.timeframe : '';

      switch (level) {
        case 'exact':
          return sym === ctx.symbol.toUpperCase() &&
                 setup === ctx.setup.toLowerCase() &&
                 (!ctx.timeframe || tf === ctx.timeframe);
        case 'setup+symbol':
          return sym === ctx.symbol.toUpperCase() && setup === ctx.setup.toLowerCase();
        case 'setup':
          return setup === ctx.setup.toLowerCase();
        case 'symbol':
          return sym === ctx.symbol.toUpperCase();
        default:
          return false;
      }
    });
  }

  private _buildReason(ctx: SetupContext, wr: number, avgPnl: number, n: number, level: string, signal: string): string {
    const pct = Math.round(wr * 100);
    const prefix = signal === 'green' ? 'Strong edge' : signal === 'yellow' ? 'Mixed results' : 'Historically weak';
    const match = level === 'exact' ? `${ctx.setup} on ${ctx.symbol}` :
                  level === 'setup+symbol' ? `${ctx.setup} on ${ctx.symbol}` :
                  level === 'setup' ? `${ctx.setup} setups` : `${ctx.symbol} trades`;

    return `${prefix}: ${pct}% win rate on ${n} ${match} (avg P&L: $${avgPnl.toFixed(2)})`;
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const setupScorer = new SetupScorer();
export default setupScorer;
