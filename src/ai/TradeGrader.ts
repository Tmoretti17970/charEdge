// ═══════════════════════════════════════════════════════════════════
// charEdge — Trade Grader (Sprint 25)
//
// Grades individual trades by entry, exit, and risk management.
// Uses SetupScorer for historical context, plus execution analysis.
// Powers L1 responses for "grade my trade" copilot queries.
//
// Usage:
//   import { tradeGrader } from './TradeGrader';
//   const grade = tradeGrader.grade(trade, allTrades);
// ═══════════════════════════════════════════════════════════════════

import { setupScorer } from './SetupScorer';
import type { SetupScore } from './SetupScorer';

// ─── Types ──────────────────────────────────────────────────────

export type LetterGrade = 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F';

export interface GradeComponent {
  grade: LetterGrade;
  score: number;        // 0-100
  note: string;
}

export interface TradeGrade {
  overall: LetterGrade;
  overallScore: number;
  entry: GradeComponent;
  exit: GradeComponent;
  riskMgmt: GradeComponent;
  setupScore: SetupScore;
  summary: string;
}

interface Trade {
  pnl?: number;
  side?: string;
  symbol?: string;
  setup?: string;
  setupType?: string;
  strategy?: string;
  timeframe?: string;
  quantity?: number;
  size?: number;
  amount?: number;
  entryPrice?: number;
  exitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  entryDate?: string | number | Date;
  exitDate?: string | number | Date;
  date?: string | number | Date;
  notes?: string;
  highPrice?: number;   // highest price during trade
  lowPrice?: number;    // lowest price during trade
}

// ─── Grader ─────────────────────────────────────────────────────

class TradeGrader {
  /**
   * Grade a single trade against historical data.
   */
  grade(trade: Trade, allTrades: Trade[] = []): TradeGrade {
    const setupName = trade.setup || trade.setupType || trade.strategy || 'unknown';
    const symbol = trade.symbol || 'unknown';

    // ── Setup Score (from SetupScorer) ────────────────────────
    const historicalScore = setupScorer.score(
      allTrades as any[],
      { symbol, setup: setupName, timeframe: trade.timeframe || undefined },
    );

    // ── Entry Grade ──────────────────────────────────────────
    const entry = this._gradeEntry(trade, historicalScore);

    // ── Exit Grade ───────────────────────────────────────────
    const exit = this._gradeExit(trade);

    // ── Risk Management Grade ────────────────────────────────
    const riskMgmt = this._gradeRisk(trade, allTrades);

    // ── Overall ──────────────────────────────────────────────
    const overallScore = Math.round(
      entry.score * 0.35 +
      exit.score * 0.35 +
      riskMgmt.score * 0.30,
    );
    const overall = this._scoreToGrade(overallScore);

    const summary = this._buildSummary(trade, overall, overallScore, entry, exit, riskMgmt, historicalScore);

    return {
      overall,
      overallScore,
      entry,
      exit,
      riskMgmt,
      setupScore: historicalScore,
      summary,
    };
  }

  // ── Entry Grading ──────────────────────────────────────────

  private _gradeEntry(trade: Trade, setupScore: SetupScore): GradeComponent {
    let score = 50; // baseline
    const notes: string[] = [];

    // Historical setup quality
    if (setupScore.signal === 'green') {
      score += 25;
      notes.push(`Strong setup: ${setupScore.historicalWinRate}% historical WR`);
    } else if (setupScore.signal === 'yellow') {
      score += 10;
      notes.push(`Mixed setup: ${setupScore.historicalWinRate}% historical WR`);
    } else if (setupScore.signal === 'red') {
      score -= 15;
      notes.push(`Weak setup: ${setupScore.historicalWinRate}% historical WR`);
    }

    // Named setup vs unknown
    const setupName = trade.setup || trade.setupType || trade.strategy;
    if (setupName && setupName !== 'unknown') {
      score += 10;
      notes.push(`Defined setup: ${setupName}`);
    } else {
      score -= 10;
      notes.push('No defined setup — consider labeling your entries');
    }

    // Having a stop loss planned from entry
    if (trade.stopLoss) {
      score += 10;
      notes.push('Stop loss defined at entry ✓');
    }

    score = Math.max(0, Math.min(100, score));
    return {
      grade: this._scoreToGrade(score),
      score,
      note: notes[0] || 'Entry graded',
    };
  }

  // ── Exit Grading ───────────────────────────────────────────

  private _gradeExit(trade: Trade): GradeComponent {
    let score = 50;
    const notes: string[] = [];
    const pnl = trade.pnl ?? 0;
    const isWin = pnl > 0;

    // Winning trade → baseline bump
    if (isWin) {
      score += 15;
    } else {
      score -= 5;
    }

    // Check profit capture (if high/low data available)
    if (trade.highPrice && trade.lowPrice && trade.entryPrice && trade.exitPrice) {
      const isLong = (trade.side || 'long').toLowerCase() !== 'short';
      const maxMove = isLong
        ? trade.highPrice - trade.entryPrice
        : trade.entryPrice - trade.lowPrice;
      const capturedMove = isLong
        ? trade.exitPrice - trade.entryPrice
        : trade.entryPrice - trade.exitPrice;

      if (maxMove > 0) {
        const capturePct = capturedMove / maxMove;

        if (capturePct >= 0.7) {
          score += 25;
          notes.push(`Captured ${(capturePct * 100).toFixed(0)}% of available move — excellent exit`);
        } else if (capturePct >= 0.4) {
          score += 10;
          notes.push(`Captured ${(capturePct * 100).toFixed(0)}% of available move — decent exit`);
        } else if (capturePct >= 0) {
          notes.push(`Captured only ${(capturePct * 100).toFixed(0)}% of move — left profit on the table`);
        } else {
          score -= 15;
          notes.push('Exited at a loss despite favorable move — poor timing');
        }
      }
    } else if (isWin) {
      score += 10;
      notes.push('Profitable exit');
    } else {
      // Check if loss was controlled
      if (trade.stopLoss && trade.exitPrice && trade.entryPrice) {
        const isLong = (trade.side || 'long').toLowerCase() !== 'short';
        const stoppedOut = isLong
          ? trade.exitPrice <= trade.stopLoss
          : trade.exitPrice >= trade.stopLoss;
        if (stoppedOut) {
          score += 15;
          notes.push('Hit stop loss — disciplined exit on a losing trade ✓');
        }
      } else {
        notes.push('Loss without defined stop — consider pre-planning exits');
      }
    }

    // Take profit target
    if (trade.takeProfit && trade.exitPrice) {
      const isLong = (trade.side || 'long').toLowerCase() !== 'short';
      const hitTP = isLong
        ? trade.exitPrice >= trade.takeProfit
        : trade.exitPrice <= trade.takeProfit;
      if (hitTP) {
        score += 10;
        notes.push('Hit take-profit target ✓');
      }
    }

    score = Math.max(0, Math.min(100, score));
    return {
      grade: this._scoreToGrade(score),
      score,
      note: notes[0] || (isWin ? 'Profitable exit' : 'Loss recorded'),
    };
  }

  // ── Risk Management Grading ────────────────────────────────

  private _gradeRisk(trade: Trade, allTrades: Trade[]): GradeComponent {
    let score = 50;
    const notes: string[] = [];

    // Stop loss present?
    if (trade.stopLoss) {
      score += 20;
      notes.push('Stop loss defined ✓');

      // Check risk/reward if take-profit also set
      if (trade.takeProfit && trade.entryPrice) {
        const isLong = (trade.side || 'long').toLowerCase() !== 'short';
        const risk = Math.abs(trade.entryPrice - trade.stopLoss);
        const reward = isLong
          ? trade.takeProfit - trade.entryPrice
          : trade.entryPrice - trade.takeProfit;
        const rr = risk > 0 ? reward / risk : 0;

        if (rr >= 3) {
          score += 15;
          notes.push(`R:R of ${rr.toFixed(1)} — excellent risk/reward`);
        } else if (rr >= 2) {
          score += 10;
          notes.push(`R:R of ${rr.toFixed(1)} — good risk/reward`);
        } else if (rr >= 1) {
          notes.push(`R:R of ${rr.toFixed(1)} — acceptable`);
        } else {
          score -= 10;
          notes.push(`R:R of ${rr.toFixed(1)} — unfavorable risk/reward`);
        }
      }
    } else {
      score -= 15;
      notes.push('No stop loss — always define your risk before entry');
    }

    // Position size relative to average
    if (allTrades.length >= 5) {
      const sizes = allTrades
        .map(t => t.quantity ?? t.size ?? t.amount ?? 0)
        .filter(s => s > 0);
      const tradeSize = trade.quantity ?? trade.size ?? trade.amount ?? 0;

      if (sizes.length >= 5 && tradeSize > 0) {
        const avgSize = sizes.reduce((s, v) => s + v, 0) / sizes.length;
        const sizeRatio = tradeSize / avgSize;

        if (sizeRatio > 2) {
          score -= 15;
          notes.push(`Position ${(sizeRatio).toFixed(1)}x your average — oversized`);
        } else if (sizeRatio > 1.5) {
          score -= 5;
          notes.push(`Position ${(sizeRatio).toFixed(1)}x your average — slightly large`);
        } else if (sizeRatio >= 0.5 && sizeRatio <= 1.5) {
          score += 10;
          notes.push('Consistent position sizing ✓');
        }
      }
    }

    score = Math.max(0, Math.min(100, score));
    return {
      grade: this._scoreToGrade(score),
      score,
      note: notes[0] || 'Risk management assessed',
    };
  }

  // ── Helpers ────────────────────────────────────────────────

  scoreToGrade(score: number): LetterGrade {
    return this._scoreToGrade(score);
  }

  private _scoreToGrade(score: number): LetterGrade {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B+';
    if (score >= 60) return 'B';
    if (score >= 50) return 'C';
    if (score >= 35) return 'D';
    return 'F';
  }

  private _buildSummary(
    trade: Trade,
    overall: LetterGrade,
    overallScore: number,
    entry: GradeComponent,
    exit: GradeComponent,
    riskMgmt: GradeComponent,
    setupScore: SetupScore,
  ): string {
    const parts: string[] = [];
    const symbol = (trade.symbol || 'Trade').toUpperCase();
    const side = (trade.side || 'long').charAt(0).toUpperCase() + (trade.side || 'long').slice(1).toLowerCase();
    const pnl = trade.pnl ?? 0;
    const pnlStr = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
    const pnlEmoji = pnl >= 0 ? '✅' : '❌';

    const gradeEmoji = overall === 'A+' || overall === 'A' ? '🏆' :
                       overall === 'B+' || overall === 'B' ? '👍' :
                       overall === 'C' ? '➡️' : '⚠️';

    parts.push(`**${gradeEmoji} Trade Grade: ${overall}** (${overallScore}/100)\n`);
    parts.push(`${side} **${symbol}** · ${pnlEmoji} ${pnlStr}\n`);

    // Component grades
    parts.push(`| Component | Grade | Detail |`);
    parts.push(`|-----------|-------|--------|`);
    parts.push(`| Entry | **${entry.grade}** | ${entry.note} |`);
    parts.push(`| Exit | **${exit.grade}** | ${exit.note} |`);
    parts.push(`| Risk Mgmt | **${riskMgmt.grade}** | ${riskMgmt.note} |`);

    // Setup score context
    parts.push('');
    parts.push(`**Setup quality:** ${setupScore.emoji} ${setupScore.reason}`);

    // Actionable advice
    const weakest = [
      { name: 'entry', score: entry.score },
      { name: 'exit', score: exit.score },
      { name: 'risk management', score: riskMgmt.score },
    ].sort((a, b) => a.score - b.score)[0];

    if (weakest && weakest.score < 60) {
      parts.push('');
      parts.push(`💡 **Focus area:** Your ${weakest.name} could use improvement. Review your process for this component.`);
    }

    return parts.join('\n');
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const tradeGrader = new TradeGrader();
export default tradeGrader;
