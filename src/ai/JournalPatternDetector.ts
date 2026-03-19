// ═══════════════════════════════════════════════════════════════════
// charEdge — Journal Pattern Detector (Sprint 22)
//
// Analyzes trade journal history for behavioral patterns:
// - Win rate, expectancy, avg win/loss
// - Current and longest streaks
// - Overtrading detection
// - Revenge trading detection
// - Time-of-day edge analysis
// - Setup-type win rate ranking
//
// Pure heuristic — no LLM needed. Powers L1 responses in
// AIRouter._handleJournal() and _handleCoaching().
//
// Usage:
//   import { journalPatternDetector } from './JournalPatternDetector';
//   const patterns = journalPatternDetector.analyze(trades);
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export type PatternType =
  | 'overtrading'
  | 'revenge'
  | 'tilt'
  | 'time_edge'
  | 'setup_edge'
  | 'size_drift'
  | 'streak'
  | 'improving'
  | 'cold_start';

export type PatternSeverity = 'info' | 'warning' | 'critical';

export interface DetectedPattern {
  type: PatternType;
  severity: PatternSeverity;
  description: string;
}

export interface Streak {
  type: 'win' | 'loss' | 'none';
  count: number;
}

export interface SetupStats {
  name: string;
  winRate: number;
  count: number;
  avgPnl: number;
}

export interface JournalPatterns {
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  profitFactor: number;
  patterns: DetectedPattern[];
  streaks: { current: Streak; longest: Streak };
  timeOfDay: { bestHour: number; worstHour: number } | null;
  topSetup: SetupStats | null;
  worstSetup: SetupStats | null;
  summary: string;
}

// ─── Trade interface (minimal — works with any journal shape) ───

interface Trade {
  pnl?: number;
  side?: string;
  symbol?: string;
  setup?: string;
  setupType?: string;
  strategy?: string;
  entryDate?: string | number | Date;
  exitDate?: string | number | Date;
  date?: string | number | Date;
  quantity?: number;
  size?: number;
  amount?: number;
}

// ─── Detector ───────────────────────────────────────────────────

class JournalPatternDetector {
  /**
   * Analyze an array of trades and detect behavioral patterns.
   */
  analyze(trades: Trade[]): JournalPatterns {
    const closed = trades.filter(t => typeof t.pnl === 'number' && !isNaN(t.pnl));

    if (closed.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        expectancy: 0,
        profitFactor: 0,
        patterns: [{ type: 'cold_start', severity: 'info', description: 'No closed trades yet — start journaling to unlock insights' }],
        streaks: { current: { type: 'none', count: 0 }, longest: { type: 'none', count: 0 } },
        timeOfDay: null,
        topSetup: null,
        worstSetup: null,
        summary: '📓 No closed trades to analyze yet. Start logging trades to unlock behavioral pattern detection and coaching insights.',
      };
    }

    // ── Core Stats ───────────────────────────────────────────
    const wins = closed.filter(t => (t.pnl ?? 0) > 0);
    const losses = closed.filter(t => (t.pnl ?? 0) < 0);

    const totalTrades = closed.length;
    const winRate = wins.length / totalTrades;
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.pnl ?? 0), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0) / losses.length) : 0;
    const expectancy = winRate * avgWin - (1 - winRate) * avgLoss;
    const totalWins = wins.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const totalLosses = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0));
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    // ── Streaks ──────────────────────────────────────────────
    const streaks = this._detectStreaks(closed);

    // ── Pattern Detection ────────────────────────────────────
    const patterns: DetectedPattern[] = [];

    // Streak pattern
    if (streaks.current.count >= 3) {
      const streakType = streaks.current.type;
      if (streakType === 'win') {
        patterns.push({
          type: 'streak',
          severity: 'info',
          description: `🔥 ${streaks.current.count}-trade winning streak! Stay disciplined — don't increase size just because you're hot`,
        });
      } else if (streakType === 'loss') {
        patterns.push({
          type: 'streak',
          severity: streaks.current.count >= 5 ? 'critical' : 'warning',
          description: `📉 ${streaks.current.count}-trade losing streak. Consider reducing size and reviewing your last entries for pattern degradation`,
        });
      }
    }

    // Overtrading detection
    this._detectOvertrading(closed, patterns);

    // Revenge trading detection
    this._detectRevenge(closed, patterns);

    // Tilt detection
    this._detectTilt(closed, patterns);

    // Size drift detection
    this._detectSizeDrift(closed, patterns);

    // Improving trend
    if (closed.length >= 20) {
      const recent20 = closed.slice(-20);
      const older20 = closed.slice(-40, -20);
      if (older20.length >= 10) {
        const recentWR = recent20.filter(t => (t.pnl ?? 0) > 0).length / recent20.length;
        const olderWR = older20.filter(t => (t.pnl ?? 0) > 0).length / older20.length;
        if (recentWR > olderWR + 0.1) {
          patterns.push({
            type: 'improving',
            severity: 'info',
            description: `📈 Win rate improving: ${(olderWR * 100).toFixed(0)}% → ${(recentWR * 100).toFixed(0)}% in last 20 trades`,
          });
        }
      }
    }

    // ── Time-of-Day Edge ─────────────────────────────────────
    const timeOfDay = this._analyzeTimeOfDay(closed);

    // Time edge pattern
    if (timeOfDay) {
      const hourBuckets = this._getHourBuckets(closed);
      const bestBucket = hourBuckets.get(timeOfDay.bestHour);
      const worstBucket = hourBuckets.get(timeOfDay.worstHour);
      if (bestBucket && worstBucket && bestBucket.count >= 5 && worstBucket.count >= 5) {
        if (bestBucket.winRate - worstBucket.winRate > 0.2) {
          patterns.push({
            type: 'time_edge',
            severity: 'info',
            description: `⏰ Best hour: ${this._formatHour(timeOfDay.bestHour)} (${(bestBucket.winRate * 100).toFixed(0)}% WR). Worst: ${this._formatHour(timeOfDay.worstHour)} (${(worstBucket.winRate * 100).toFixed(0)}% WR)`,
          });
        }
      }
    }

    // ── Setup Edge ───────────────────────────────────────────
    const setupStats = this._analyzeSetups(closed);
    const topSetup = setupStats.length > 0 ? setupStats[0] ?? null : null;
    const worstSetup = setupStats.length > 1 ? setupStats[setupStats.length - 1] ?? null : null;

    if (topSetup && topSetup.count >= 5) {
      patterns.push({
        type: 'setup_edge',
        severity: 'info',
        description: `🏆 Best setup: **${topSetup.name}** (${(topSetup.winRate * 100).toFixed(0)}% WR, ${topSetup.count} trades, avg $${topSetup.avgPnl.toFixed(0)}/trade)`,
      });
    }

    // Sort patterns: critical > warning > info
    const severityOrder: Record<PatternSeverity, number> = { critical: 0, warning: 1, info: 2 };
    patterns.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // ── Summary ──────────────────────────────────────────────
    const summary = this._buildSummary(totalTrades, winRate, avgWin, avgLoss, expectancy, profitFactor, patterns, streaks, topSetup);

    return {
      totalTrades,
      winRate,
      avgWin,
      avgLoss,
      expectancy,
      profitFactor,
      patterns,
      streaks,
      timeOfDay,
      topSetup,
      worstSetup,
      summary,
    };
  }

  // ── Streak Detection ───────────────────────────────────────

  private _detectStreaks(trades: Trade[]): { current: Streak; longest: Streak } {
    let currentType: 'win' | 'loss' | 'none' = 'none';
    let currentCount = 0;
    let longestType: 'win' | 'loss' | 'none' = 'none';
    let longestCount = 0;

    for (const t of trades) {
      const isWin = (t.pnl ?? 0) > 0;
      const type = isWin ? 'win' : 'loss';

      if (type === currentType) {
        currentCount++;
      } else {
        if (currentCount > longestCount) {
          longestCount = currentCount;
          longestType = currentType;
        }
        currentType = type;
        currentCount = 1;
      }
    }

    if (currentCount > longestCount) {
      longestCount = currentCount;
      longestType = currentType;
    }

    return {
      current: { type: currentType, count: currentCount },
      longest: { type: longestType, count: longestCount },
    };
  }

  // ── Overtrading Detection ──────────────────────────────────

  private _detectOvertrading(trades: Trade[], patterns: DetectedPattern[]): void {
    // Group trades by date
    const byDay = new Map<string, Trade[]>();
    for (const t of trades) {
      const d = this._getDateKey(t);
      if (!d) continue;
      const existing = byDay.get(d);
      if (existing) existing.push(t);
      else byDay.set(d, [t]);
    }

    // Find days with many trades
    let highActivityDays = 0;
    let totalHighActivityWR = 0;
    let totalNormalWR = 0;
    let normalDays = 0;

    for (const [, dayTrades] of byDay) {
      if (dayTrades.length >= 6) {
        highActivityDays++;
        const dayWins = dayTrades.filter(t => (t.pnl ?? 0) > 0).length;
        totalHighActivityWR += dayWins / dayTrades.length;
      } else if (dayTrades.length >= 2) {
        normalDays++;
        const dayWins = dayTrades.filter(t => (t.pnl ?? 0) > 0).length;
        totalNormalWR += dayWins / dayTrades.length;
      }
    }

    if (highActivityDays >= 3 && normalDays >= 3) {
      const avgHighWR = totalHighActivityWR / highActivityDays;
      const avgNormalWR = totalNormalWR / normalDays;

      if (avgHighWR < avgNormalWR - 0.1) {
        patterns.push({
          type: 'overtrading',
          severity: 'warning',
          description: `📊 Possible overtrading: on high-activity days (6+ trades), your win rate drops to ${(avgHighWR * 100).toFixed(0)}% vs ${(avgNormalWR * 100).toFixed(0)}% on normal days`,
        });
      }
    }
  }

  // ── Revenge Trading Detection ──────────────────────────────

  private _detectRevenge(trades: Trade[], patterns: DetectedPattern[]): void {
    // Look for pattern: loss followed by quick re-entry with larger size
    let revengeCount = 0;

    for (let i = 1; i < trades.length; i++) {
      const prev = trades[i - 1]!;
      const curr = trades[i]!;

      if ((prev.pnl ?? 0) < 0) {
        const prevSize = prev.quantity ?? prev.size ?? prev.amount ?? 0;
        const currSize = curr.quantity ?? curr.size ?? curr.amount ?? 0;

        // Size increase after loss
        if (prevSize > 0 && currSize > 0 && currSize > prevSize * 1.5) {
          revengeCount++;
        }

        // Quick re-entry (same day after loss)
        const prevDate = this._getDateKey(prev);
        const currDate = this._getDateKey(curr);
        if (prevDate && currDate && prevDate === currDate && (curr.pnl ?? 0) < 0) {
          revengeCount++;
        }
      }
    }

    if (revengeCount >= 3) {
      patterns.push({
        type: 'revenge',
        severity: revengeCount >= 6 ? 'critical' : 'warning',
        description: `⚠️ ${revengeCount} potential revenge trades detected (larger size or quick re-entry after losses)`,
      });
    }
  }

  // ── Tilt Detection ─────────────────────────────────────────

  private _detectTilt(trades: Trade[], patterns: DetectedPattern[]): void {
    // Detect clusters of 3+ losses within short time windows
    let tiltEpisodes = 0;

    for (let i = 0; i < trades.length - 2; i++) {
      const window = trades.slice(i, i + 3);
      const allLosses = window.every(t => (t.pnl ?? 0) < 0);

      if (allLosses) {
        // Check if they happened on the same day
        const dates = window.map(t => this._getDateKey(t)).filter(Boolean);
        const sameDay = dates.length >= 2 && new Set(dates).size === 1;

        if (sameDay) {
          tiltEpisodes++;
          i += 2; // skip past this cluster
        }
      }
    }

    if (tiltEpisodes >= 2) {
      patterns.push({
        type: 'tilt',
        severity: tiltEpisodes >= 4 ? 'critical' : 'warning',
        description: `🎭 ${tiltEpisodes} tilt episodes detected (3+ consecutive same-day losses). Consider implementing a daily loss limit`,
      });
    }
  }

  // ── Size Drift Detection ───────────────────────────────────

  private _detectSizeDrift(trades: Trade[], patterns: DetectedPattern[]): void {
    const sizes = trades
      .map(t => t.quantity ?? t.size ?? t.amount ?? 0)
      .filter(s => s > 0);

    if (sizes.length < 10) return;

    const firstHalf = sizes.slice(0, Math.floor(sizes.length / 2));
    const secondHalf = sizes.slice(Math.floor(sizes.length / 2));

    const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;

    if (avgFirst > 0 && avgSecond / avgFirst > 1.5) {
      patterns.push({
        type: 'size_drift',
        severity: 'warning',
        description: `📏 Position sizes have increased ${((avgSecond / avgFirst - 1) * 100).toFixed(0)}% over time. Ensure this is intentional and risk-managed`,
      });
    }
  }

  // ── Time-of-Day Analysis ───────────────────────────────────

  private _analyzeTimeOfDay(trades: Trade[]): { bestHour: number; worstHour: number } | null {
    const buckets = this._getHourBuckets(trades);
    if (buckets.size < 3) return null;

    let bestHour = -1;
    let bestWR = -1;
    let worstHour = -1;
    let worstWR = 2;

    for (const [hour, stats] of buckets) {
      if (stats.count < 3) continue;
      if (stats.winRate > bestWR) { bestWR = stats.winRate; bestHour = hour; }
      if (stats.winRate < worstWR) { worstWR = stats.winRate; worstHour = hour; }
    }

    if (bestHour < 0 || worstHour < 0) return null;
    return { bestHour, worstHour };
  }

  private _getHourBuckets(trades: Trade[]): Map<number, { count: number; winRate: number }> {
    const buckets = new Map<number, { wins: number; total: number }>();

    for (const t of trades) {
      const date = this._getDate(t);
      if (!date) continue;
      const hour = date.getHours();
      const existing = buckets.get(hour);
      const isWin = (t.pnl ?? 0) > 0;
      if (existing) {
        existing.total++;
        if (isWin) existing.wins++;
      } else {
        buckets.set(hour, { wins: isWin ? 1 : 0, total: 1 });
      }
    }

    const result = new Map<number, { count: number; winRate: number }>();
    for (const [hour, stats] of buckets) {
      result.set(hour, { count: stats.total, winRate: stats.total > 0 ? stats.wins / stats.total : 0 });
    }
    return result;
  }

  // ── Setup Analysis ─────────────────────────────────────────

  private _analyzeSetups(trades: Trade[]): SetupStats[] {
    const bySetup = new Map<string, { wins: number; total: number; totalPnl: number }>();

    for (const t of trades) {
      const setup = t.setup || t.setupType || t.strategy || '';
      if (!setup) continue;
      const existing = bySetup.get(setup);
      const isWin = (t.pnl ?? 0) > 0;
      const pnl = t.pnl ?? 0;
      if (existing) {
        existing.total++;
        existing.totalPnl += pnl;
        if (isWin) existing.wins++;
      } else {
        bySetup.set(setup, { wins: isWin ? 1 : 0, total: 1, totalPnl: pnl });
      }
    }

    const stats: SetupStats[] = [];
    for (const [name, data] of bySetup) {
      if (data.total < 3) continue;
      stats.push({
        name,
        winRate: data.wins / data.total,
        count: data.total,
        avgPnl: data.totalPnl / data.total,
      });
    }

    return stats.sort((a, b) => b.winRate - a.winRate || b.avgPnl - a.avgPnl);
  }

  // ── Helpers ────────────────────────────────────────────────

  private _getDate(t: Trade): Date | null {
    const raw = t.entryDate || t.exitDate || t.date;
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  private _getDateKey(t: Trade): string | null {
    const d = this._getDate(t);
    return d ? d.toISOString().split('T')[0] ?? null : null;
  }

  private _formatHour(h: number): string {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}${ampm}`;
  }

  // ── Summary Builder ────────────────────────────────────────

  private _buildSummary(
    totalTrades: number,
    winRate: number,
    avgWin: number,
    avgLoss: number,
    expectancy: number,
    profitFactor: number,
    patterns: DetectedPattern[],
    streaks: { current: Streak; longest: Streak },
    topSetup: SetupStats | null,
  ): string {
    const parts: string[] = [];

    // Header
    const wrEmoji = winRate >= 0.55 ? '🟢' : winRate >= 0.45 ? '🟡' : '🔴';
    parts.push(`**📓 Journal Analysis** (${totalTrades} trades)\n`);

    // Core stats
    parts.push(`${wrEmoji} Win rate: **${(winRate * 100).toFixed(1)}%** · Avg win: **$${avgWin.toFixed(0)}** · Avg loss: **$${avgLoss.toFixed(0)}**`);
    parts.push(`Expectancy: **$${expectancy.toFixed(0)}/trade** · Profit factor: **${profitFactor === Infinity ? '∞' : profitFactor.toFixed(2)}**`);

    // Current streak
    if (streaks.current.count >= 2) {
      const streakEmoji = streaks.current.type === 'win' ? '🔥' : '❄️';
      parts.push(`${streakEmoji} Current streak: **${streaks.current.count} ${streaks.current.type}s**`);
    }

    // Top patterns
    const criticalPatterns = patterns.filter(p => p.severity === 'critical' || p.severity === 'warning');
    const infoPatterns = patterns.filter(p => p.severity === 'info');

    if (criticalPatterns.length > 0) {
      parts.push('');
      parts.push('**⚠️ Attention:**');
      for (const p of criticalPatterns.slice(0, 3)) {
        parts.push(`• ${p.description}`);
      }
    }

    if (infoPatterns.length > 0) {
      parts.push('');
      parts.push('**Insights:**');
      for (const p of infoPatterns.slice(0, 3)) {
        parts.push(`• ${p.description}`);
      }
    }

    // Top setup
    if (topSetup && topSetup.count >= 5) {
      parts.push('');
      parts.push(`**Best setup:** ${topSetup.name} — ${(topSetup.winRate * 100).toFixed(0)}% WR over ${topSetup.count} trades`);
    }

    return parts.join('\n');
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const journalPatternDetector = new JournalPatternDetector();
export default journalPatternDetector;
