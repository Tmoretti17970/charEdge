// ═══════════════════════════════════════════════════════════════════
// charEdge — Trading DNA Fingerprint (AI Copilot Sprint 5)
//
// Builds a composite trader identity from UserProfileStore data.
// Produces a concise natural-language DNA string that becomes the
// system prompt prefix for all LLM interactions.
//
// Example output:
//   "Momentum scalper. 62% WR on breakouts, weak on reversals.
//    Overtrades after 2pm. Best day: Tuesday. Tilt-prone after
//    2 consecutive losses. Avg hold: 23min."
//
// Usage:
//   import { traderDNA } from './TraderDNA';
//   const prompt = traderDNA.getDNAForPrompt();
// ═══════════════════════════════════════════════════════════════════

import { userProfileStore } from './UserProfileStore';

// ─── Types ──────────────────────────────────────────────────────

export type TraderArchetype = 'scalper' | 'day_trader' | 'swing_trader' | 'position_trader' | 'mixed';

export interface DNA {
  archetype: TraderArchetype;
  archetypeLabel: string;
  strengths: string[];
  weaknesses: string[];
  bestSetup: string | null;
  worstSetup: string | null;
  bestDay: string | null;
  bestHour: string | null;
  avgHoldMinutes: number;
  winRate: number;
  tradeCount: number;
  tiltTrigger: string | null;
  riskProfile: string;
  summary: string;
}

// ─── Constants ──────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ARCHETYPE_LABELS: Record<TraderArchetype, string> = {
  scalper: 'Scalper',
  day_trader: 'Day Trader',
  swing_trader: 'Swing Trader',
  position_trader: 'Position Trader',
  mixed: 'Mixed Style Trader',
};

// ─── DNA Builder ────────────────────────────────────────────────

export class TraderDNA {
  /**
   * Generate the full DNA profile from UserProfileStore.
   */
  generateDNA(): DNA {
    const profile = userProfileStore.getProfile() as unknown as Record<string, unknown>;

    const archetype = this._classifyArchetype(profile);
    const strengths = this._extractStrengths(profile);
    const weaknesses = this._extractWeaknesses(profile);
    const bestSetup = this._getBestSetup(profile);
    const worstSetup = this._getWorstSetup(profile);
    const bestDay = this._getBestDay(profile);
    const bestHour = this._getBestHour(profile);
    const avgHold = this._getAvgHoldMinutes(profile);
    const winRate = (profile.winRate as number) ?? 0;
    const tradeCount = (profile.totalTrades as number) ?? 0;
    const tiltTrigger = this._getTiltTrigger(profile);
    const riskProfile = this._classifyRisk(profile);

    const dna: DNA = {
      archetype,
      archetypeLabel: ARCHETYPE_LABELS[archetype],
      strengths,
      weaknesses,
      bestSetup,
      worstSetup,
      bestDay,
      bestHour,
      avgHoldMinutes: avgHold,
      winRate,
      tradeCount,
      tiltTrigger,
      riskProfile,
      summary: '',
    };

    dna.summary = this._buildSummary(dna);
    return dna;
  }

  /**
   * Get the DNA as a formatted string for LLM system prompt injection.
   */
  getDNAForPrompt(): string {
    const profile = userProfileStore.getProfile() as unknown as Record<string, unknown>;
    if (!profile || ((profile.totalTrades as number) ?? 0) < 3) {
      return ''; // Not enough data for DNA
    }

    const dna = this.generateDNA();
    return `--- Trader DNA ---\n${dna.summary}`;
  }

  /**
   * Get strengths as an array.
   */
  getStrengths(): string[] {
    return this.generateDNA().strengths;
  }

  /**
   * Get weaknesses as an array.
   */
  getWeaknesses(): string[] {
    return this.generateDNA().weaknesses;
  }

  /**
   * Get the classified trader archetype.
   */
  getTraderArchetype(): TraderArchetype {
    return this.generateDNA().archetype;
  }

  // ── Classification ──────────────────────────────────────────

  private _classifyArchetype(profile: Record<string, unknown>): TraderArchetype {
    const style = profile.tradingStyle as string | undefined;

    if (style) {
      if (style.includes('scalp')) return 'scalper';
      if (style.includes('day')) return 'day_trader';
      if (style.includes('swing')) return 'swing_trader';
      if (style.includes('position')) return 'position_trader';
    }

    // Fallback: classify by average hold time
    const avgHold = this._getAvgHoldMinutes(profile);
    if (avgHold > 0) {
      if (avgHold < 15) return 'scalper';
      if (avgHold < 240) return 'day_trader';
      if (avgHold < 1440 * 5) return 'swing_trader';
      return 'position_trader';
    }

    return 'mixed';
  }

  private _classifyRisk(profile: Record<string, unknown>): string {
    const variance = profile.positionSizeVariance as number | undefined;
    const maxDrawdown = profile.maxDrawdown as number | undefined;

    if (variance !== undefined && variance > 0.5) return 'aggressive';
    if (maxDrawdown !== undefined && Math.abs(maxDrawdown as number) > 20) return 'aggressive';
    if (variance !== undefined && variance < 0.2) return 'conservative';
    return 'moderate';
  }

  // ── Strength/Weakness Extraction ────────────────────────────

  private _extractStrengths(profile: Record<string, unknown>): string[] {
    const strengths: string[] = [];
    const winRate = (profile.winRate as number) ?? 0;
    const totalTrades = (profile.totalTrades as number) ?? 0;

    if (winRate >= 60 && totalTrades >= 10) {
      strengths.push(`High win rate (${winRate.toFixed(0)}%)`);
    }

    const bestSetup = this._getBestSetup(profile);
    if (bestSetup) {
      strengths.push(`Strong on ${bestSetup} setups`);
    }

    const bestDay = this._getBestDay(profile);
    if (bestDay) {
      strengths.push(`Best performance on ${bestDay}s`);
    }

    // Check consistency
    const profitFactor = profile.profitFactor as number | undefined;
    if (profitFactor !== undefined && profitFactor > 1.5) {
      strengths.push(`Good profit factor (${profitFactor.toFixed(1)})`);
    }

    if (strengths.length === 0 && totalTrades >= 5) {
      strengths.push('Building trading experience');
    }

    return strengths;
  }

  private _extractWeaknesses(profile: Record<string, unknown>): string[] {
    const weaknesses: string[] = [];
    const winRate = (profile.winRate as number) ?? 0;
    const totalTrades = (profile.totalTrades as number) ?? 0;

    if (winRate < 45 && totalTrades >= 10) {
      weaknesses.push(`Low win rate (${winRate.toFixed(0)}%)`);
    }

    const worstSetup = this._getWorstSetup(profile);
    if (worstSetup) {
      weaknesses.push(`Weak on ${worstSetup} setups`);
    }

    // Check overtrading
    const overtradingScore = profile.overtradingScore as number | undefined;
    if (overtradingScore !== undefined && overtradingScore > 0.6) {
      weaknesses.push('Tends to overtrade');
    }

    // Check tilt
    const tiltScore = profile.tiltScore as number | undefined;
    if (tiltScore !== undefined && tiltScore > 50) {
      weaknesses.push('Tilt-prone after losses');
    }

    // Check timing
    const worstHour = this._getWorstHour(profile);
    if (worstHour) {
      weaknesses.push(`Poor performance around ${worstHour}`);
    }

    return weaknesses;
  }

  // ── Data Extraction Helpers ─────────────────────────────────

  private _getBestSetup(profile: Record<string, unknown>): string | null {
    const setups = profile.setupStats as Record<string, { winRate: number; count: number }> | undefined;
    if (!setups) return null;

    let best: string | null = null;
    let bestWR = 0;
    for (const [setup, stats] of Object.entries(setups)) {
      if (stats.count >= 3 && stats.winRate > bestWR) {
        bestWR = stats.winRate;
        best = setup;
      }
    }
    return best;
  }

  private _getWorstSetup(profile: Record<string, unknown>): string | null {
    const setups = profile.setupStats as Record<string, { winRate: number; count: number }> | undefined;
    if (!setups) return null;

    let worst: string | null = null;
    let worstWR = 100;
    for (const [setup, stats] of Object.entries(setups)) {
      if (stats.count >= 3 && stats.winRate < worstWR) {
        worstWR = stats.winRate;
        worst = setup;
      }
    }
    return worst;
  }

  private _getBestDay(profile: Record<string, unknown>): string | null {
    const dayStats = profile.dayOfWeekStats as Record<string, { pnl: number; count: number }> | undefined;
    if (!dayStats) return null;

    let bestDay: string | null = null;
    let bestPnl = -Infinity;
    for (const [day, stats] of Object.entries(dayStats)) {
      if (stats.count >= 2 && stats.pnl > bestPnl) {
        bestPnl = stats.pnl;
        const idx = parseInt(day);
        bestDay = DAY_NAMES[idx] || day;
      }
    }
    return bestPnl > 0 ? bestDay : null;
  }

  private _getBestHour(profile: Record<string, unknown>): string | null {
    const hourStats = profile.hourStats as Record<string, { pnl: number; count: number }> | undefined;
    if (!hourStats) return null;

    let bestHour: string | null = null;
    let bestPnl = -Infinity;
    for (const [hour, stats] of Object.entries(hourStats)) {
      if (stats.count >= 2 && stats.pnl > bestPnl) {
        bestPnl = stats.pnl;
        const h = parseInt(hour);
        bestHour = `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
      }
    }
    return bestPnl > 0 ? bestHour : null;
  }

  private _getWorstHour(profile: Record<string, unknown>): string | null {
    const hourStats = profile.hourStats as Record<string, { pnl: number; count: number }> | undefined;
    if (!hourStats) return null;

    let worstHour: string | null = null;
    let worstPnl = Infinity;
    for (const [hour, stats] of Object.entries(hourStats)) {
      if (stats.count >= 2 && stats.pnl < worstPnl) {
        worstPnl = stats.pnl;
        const h = parseInt(hour);
        worstHour = `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
      }
    }
    return worstPnl < 0 ? worstHour : null;
  }

  private _getAvgHoldMinutes(profile: Record<string, unknown>): number {
    const avgHold = profile.avgHoldMinutes as number | undefined;
    if (typeof avgHold === 'number' && avgHold > 0) return avgHold;

    const avgHoldMs = profile.avgHoldDuration as number | undefined;
    if (typeof avgHoldMs === 'number' && avgHoldMs > 0) return avgHoldMs / 60000;

    return 0;
  }

  private _getTiltTrigger(profile: Record<string, unknown>): string | null {
    const tiltScore = profile.tiltScore as number | undefined;
    if (tiltScore === undefined || tiltScore < 30) return null;

    const consecutiveLossThreshold = profile.tiltThreshold as number | undefined;
    if (consecutiveLossThreshold) {
      return `${consecutiveLossThreshold} consecutive losses`;
    }

    return tiltScore > 60 ? '2+ consecutive losses' : 'extended loss streaks';
  }

  // ── Summary Builder ─────────────────────────────────────────

  private _buildSummary(dna: DNA): string {
    const parts: string[] = [];

    // Archetype
    parts.push(dna.archetypeLabel);

    // Win rate
    if (dna.tradeCount >= 5) {
      parts.push(`${dna.winRate.toFixed(0)}% win rate over ${dna.tradeCount} trades`);
    }

    // Best/worst setup
    if (dna.bestSetup) parts.push(`strong on ${dna.bestSetup}`);
    if (dna.worstSetup) parts.push(`weak on ${dna.worstSetup}`);

    // Timing
    if (dna.bestDay) parts.push(`best day: ${dna.bestDay}`);
    if (dna.bestHour) parts.push(`peak hours around ${dna.bestHour}`);

    // Hold time
    if (dna.avgHoldMinutes > 0) {
      if (dna.avgHoldMinutes < 60) {
        parts.push(`avg hold: ${Math.round(dna.avgHoldMinutes)}min`);
      } else {
        parts.push(`avg hold: ${(dna.avgHoldMinutes / 60).toFixed(1)}h`);
      }
    }

    // Tilt
    if (dna.tiltTrigger) parts.push(`tilt trigger: ${dna.tiltTrigger}`);

    // Risk
    parts.push(`${dna.riskProfile} risk profile`);

    // Strengths/weaknesses
    if (dna.strengths.length > 0) {
      parts.push(`strengths: ${dna.strengths.slice(0, 2).join(', ')}`);
    }
    if (dna.weaknesses.length > 0) {
      parts.push(`areas to improve: ${dna.weaknesses.slice(0, 2).join(', ')}`);
    }

    return parts.join('. ') + '.';
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const traderDNA = new TraderDNA();
export default traderDNA;
