// ═══════════════════════════════════════════════════════════════════
// charEdge — User Profile Intelligence Store (AI Copilot Sprint 1)
//
// Persistent user profile that learns HOW a trader trades. Aggregates
// data from journal trades into a rich profile: preferred style,
// best/worst hours & days, setup win rates, emotional patterns,
// position sizing habits, and more.
//
// All data stays in IndexedDB (encrypted via EncryptedStore). Profile
// is automatically updated when trades change and serves as the
// foundation for personalized AI coaching.
//
// Usage:
//   import { userProfileStore } from './UserProfileStore';
//   await userProfileStore.rebuild(trades);
//   const profile = userProfileStore.getProfile();
//   const summary = userProfileStore.getSummaryForAI();
// ═══════════════════════════════════════════════════════════════════

import { logger } from '@/observability/logger.js';
import { encryptedStore } from '../data/EncryptedStore.js';

// ─── Types ──────────────────────────────────────────────────────

export type TradingStyle = 'scalper' | 'day_trader' | 'swing_trader' | 'position_trader' | 'unknown';

export interface HourStats {
  hour: number;        // 0–23
  trades: number;
  wins: number;
  losses: number;
  winRate: number;     // 0–1
  totalPnl: number;
  avgPnl: number;
}

export interface DayStats {
  day: number;         // 0=Sun, 6=Sat
  dayName: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
}

export interface SetupStats {
  setup: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  avgHoldMinutes: number;
}

export interface EmotionStats {
  emotion: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
}

export interface SymbolStats {
  symbol: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
}

export interface TiltPattern {
  trigger: string;          // What caused it (consecutive losses, time-based, etc.)
  frequency: number;        // How often it happens
  avgLossAfterTilt: number; // Average P&L during tilt
  recoveryTime: number;     // Minutes to recover
}

export interface UserProfile {
  // ── Identity ──
  version: number;
  lastUpdated: number;       // Unix ms
  totalTradesAnalyzed: number;

  // ── Style Classification ──
  tradingStyle: TradingStyle;
  avgHoldMinutes: number;
  medianHoldMinutes: number;
  tradesPerDay: number;
  preferredSide: 'long' | 'short' | 'balanced';

  // ── Performance Overview ──
  overallWinRate: number;    // 0–1
  overallProfitFactor: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  expectancy: number;        // Expected $ per trade

  // ── Temporal Patterns ──
  bestHours: HourStats[];    // Top 3
  worstHours: HourStats[];   // Bottom 3
  allHourStats: HourStats[];
  bestDays: DayStats[];      // Top 2
  worstDays: DayStats[];     // Bottom 2
  allDayStats: DayStats[];

  // ── Setup Analysis ──
  topSetups: SetupStats[];   // By win rate (min 5 trades)
  worstSetups: SetupStats[];
  allSetupStats: SetupStats[];

  // ── Emotional Patterns ──
  emotionStats: EmotionStats[];
  tiltPatterns: TiltPattern[];
  mostProfitableEmotion: string;
  mostDangerousEmotion: string;

  // ── Symbol Preferences ──
  topSymbols: SymbolStats[];  // By trade count
  allSymbolStats: SymbolStats[];

  // ── Position Sizing ──
  avgPositionSize: number;
  positionSizeVariance: number; // High variance = inconsistent sizing
  oversizingAfterLoss: boolean; // Revenge trading indicator

  // ── Preferences (inferred) ──
  preferredTimeframes: string[];
  preferredIndicators: string[];

  // ── Coaching Metadata ──
  coachingDismissals: Record<string, number>;  // Type → count of dismissals
  coachingAcknowledgments: Record<string, number>;
  coachingEffectiveness: Record<string, number>; // Type → -1 to 1
}

// ─── Constants ──────────────────────────────────────────────────

const STORAGE_KEY = 'charEdge-user-profile';
const PROFILE_VERSION = 1;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const EMPTY_PROFILE: UserProfile = {
  version: PROFILE_VERSION,
  lastUpdated: 0,
  totalTradesAnalyzed: 0,

  tradingStyle: 'unknown',
  avgHoldMinutes: 0,
  medianHoldMinutes: 0,
  tradesPerDay: 0,
  preferredSide: 'balanced',

  overallWinRate: 0,
  overallProfitFactor: 0,
  avgWin: 0,
  avgLoss: 0,
  largestWin: 0,
  largestLoss: 0,
  maxConsecutiveWins: 0,
  maxConsecutiveLosses: 0,
  expectancy: 0,

  bestHours: [],
  worstHours: [],
  allHourStats: [],
  bestDays: [],
  worstDays: [],
  allDayStats: [],

  topSetups: [],
  worstSetups: [],
  allSetupStats: [],

  emotionStats: [],
  tiltPatterns: [],
  mostProfitableEmotion: '',
  mostDangerousEmotion: '',

  topSymbols: [],
  allSymbolStats: [],

  avgPositionSize: 0,
  positionSizeVariance: 0,
  oversizingAfterLoss: false,

  preferredTimeframes: [],
  preferredIndicators: [],

  coachingDismissals: {},
  coachingAcknowledgments: {},
  coachingEffectiveness: {},
};

// ─── Trade Record (loose type for flexibility) ──────────────────

interface TradeLike {
  id?: string;
  symbol?: string;
  side?: string;
  pnl?: number;
  entry?: number;
  exit?: number;
  entryPrice?: number;
  exitPrice?: number;
  date?: string;
  entryDate?: string;
  exitDate?: string;
  entryTime?: string | number;
  setup?: string;
  setupType?: string;
  strategy?: string;
  emotion?: string;
  qty?: number;
  quantity?: number;
  positionSize?: number;
  holdMinutes?: number;
  holdDuration?: number;
  tags?: string[];
  [key: string]: unknown;
}

// ─── Store Class ────────────────────────────────────────────────

export class UserProfileStore {
  private _profile: UserProfile = { ...EMPTY_PROFILE };
  private _loaded = false;
  private _listeners: Set<(profile: UserProfile) => void> = new Set();

  // ── Public API ──────────────────────────────────────────────

  /**
   * Get the current profile snapshot.
   */
  getProfile(): Readonly<UserProfile> {
    return this._profile;
  }

  /**
   * Subscribe to profile changes.
   */
  onChange(cb: (profile: UserProfile) => void): () => void {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  /**
   * Load profile from persistent storage.
   */
  async load(): Promise<void> {
    if (this._loaded) return;

    try {
      // Try encrypted store first (secure path)
      const encrypted = await encryptedStore.get('profiles', STORAGE_KEY);
      if (encrypted && typeof encrypted === 'object' && (encrypted as any).version === PROFILE_VERSION) {
        this._profile = { ...EMPTY_PROFILE, ...(encrypted as UserProfile) };
        this._loaded = true;
        logger.boot?.info?.('[UserProfile] Loaded from encrypted store');
        return;
      }

      // Fallback: migrate from legacy localStorage (one-time)
      const legacy = localStorage.getItem(STORAGE_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (parsed && parsed.version === PROFILE_VERSION) {
          this._profile = { ...EMPTY_PROFILE, ...parsed };
          // Migrate to encrypted store and remove plaintext
          await encryptedStore.put('profiles', STORAGE_KEY, this._profile);
          localStorage.removeItem(STORAGE_KEY);
          logger.boot?.info?.('[UserProfile] Migrated from localStorage to encrypted store');
        }
      }
      this._loaded = true;
    } catch (err) {
      logger.boot?.warn?.('[UserProfile] Failed to load, using defaults', err);
      this._loaded = true;
    }
  }

  /**
   * Rebuild the entire profile from trade history.
   * Call this when trades change or on first load.
   */
  async rebuild(trades: TradeLike[]): Promise<UserProfile> {
    await this.load();

    const closedTrades = trades.filter(t =>
      typeof t.pnl === 'number' && !isNaN(t.pnl)
    );

    if (closedTrades.length === 0) {
      this._profile = { ...EMPTY_PROFILE, lastUpdated: Date.now() };
      this._persist();
      return this._profile;
    }

    // Sort by date
    closedTrades.sort((a, b) => {
      const da = _getDate(a);
      const db = _getDate(b);
      return da.getTime() - db.getTime();
    });

    const profile: UserProfile = { ...EMPTY_PROFILE };
    profile.version = PROFILE_VERSION;
    profile.lastUpdated = Date.now();
    profile.totalTradesAnalyzed = closedTrades.length;

    // ── Overall Performance ──
    this._computeOverallStats(closedTrades, profile);

    // ── Temporal Patterns ──
    this._computeHourStats(closedTrades, profile);
    this._computeDayStats(closedTrades, profile);

    // ── Setup Analysis ──
    this._computeSetupStats(closedTrades, profile);

    // ── Emotional Patterns ──
    this._computeEmotionStats(closedTrades, profile);
    this._computeTiltPatterns(closedTrades, profile);

    // ── Symbol Analysis ──
    this._computeSymbolStats(closedTrades, profile);

    // ── Position Sizing ──
    this._computePositionSizing(closedTrades, profile);

    // ── Style Classification ──
    this._classifyStyle(closedTrades, profile);

    // ── Merge coaching data from existing profile ──
    profile.coachingDismissals = this._profile.coachingDismissals;
    profile.coachingAcknowledgments = this._profile.coachingAcknowledgments;
    profile.coachingEffectiveness = this._profile.coachingEffectiveness;
    profile.preferredTimeframes = this._profile.preferredTimeframes;
    profile.preferredIndicators = this._profile.preferredIndicators;

    this._profile = profile;
    this._persist();
    this._notify();

    logger.boot?.info?.(
      `[UserProfile] Rebuilt from ${closedTrades.length} trades — style: ${profile.tradingStyle}, WR: ${(profile.overallWinRate * 100).toFixed(1)}%`
    );

    return profile;
  }

  /**
   * Generate a concise summary for AI system prompt injection.
   * Kept short to save tokens.
   */
  getSummaryForAI(): string {
    const p = this._profile;
    if (p.totalTradesAnalyzed === 0) {
      return 'New trader — no historical data yet. Be welcoming and educational.';
    }

    const lines: string[] = [];

    // Style
    lines.push(`Trader Style: ${p.tradingStyle.replace('_', ' ')} (${p.totalTradesAnalyzed} trades analyzed)`);
    lines.push(`Win Rate: ${(p.overallWinRate * 100).toFixed(1)}% | PF: ${p.overallProfitFactor.toFixed(2)} | Avg Hold: ${p.avgHoldMinutes.toFixed(0)} min`);
    lines.push(`Avg Win: $${p.avgWin.toFixed(2)} | Avg Loss: $${p.avgLoss.toFixed(2)} | Expectancy: $${p.expectancy.toFixed(2)}/trade`);

    // Side preference
    lines.push(`Side: ${p.preferredSide} | Trades/day: ${p.tradesPerDay.toFixed(1)}`);

    // Best/worst hours
    if (p.bestHours.length > 0) {
      lines.push(`Best Hours: ${p.bestHours.map(h => `${h.hour}:00 (${(h.winRate * 100).toFixed(0)}% WR)`).join(', ')}`);
    }
    if (p.worstHours.length > 0) {
      lines.push(`Worst Hours: ${p.worstHours.map(h => `${h.hour}:00 (${(h.winRate * 100).toFixed(0)}% WR)`).join(', ')}`);
    }

    // Best/worst days
    if (p.bestDays.length > 0) {
      lines.push(`Best Days: ${p.bestDays.map(d => `${d.dayName} (${(d.winRate * 100).toFixed(0)}% WR)`).join(', ')}`);
    }

    // Top setups
    if (p.topSetups.length > 0) {
      lines.push(`Top Setups: ${p.topSetups.map(s => `${s.setup} (${(s.winRate * 100).toFixed(0)}% WR, ${s.trades} trades)`).join(', ')}`);
    }

    // Emotional insights
    if (p.mostProfitableEmotion) {
      lines.push(`Best Emotion: ${p.mostProfitableEmotion} | Worst: ${p.mostDangerousEmotion}`);
    }

    // Top symbols
    if (p.topSymbols.length > 0) {
      lines.push(`Preferred Symbols: ${p.topSymbols.slice(0, 5).map(s => s.symbol).join(', ')}`);
    }

    // Tilt patterns
    if (p.tiltPatterns.length > 0) {
      lines.push(`Tilt Triggers: ${p.tiltPatterns.map(t => t.trigger).join(', ')}`);
    }

    // Sizing
    if (p.oversizingAfterLoss) {
      lines.push('⚠️ Revenge sizing detected — increases position size after losses');
    }

    return lines.join('\n');
  }

  /**
   * Record a coaching interaction outcome.
   */
  recordCoachingFeedback(type: string, acknowledged: boolean): void {
    if (acknowledged) {
      this._profile.coachingAcknowledgments[type] =
        (this._profile.coachingAcknowledgments[type] || 0) + 1;
    } else {
      this._profile.coachingDismissals[type] =
        (this._profile.coachingDismissals[type] || 0) + 1;
    }

    // Update effectiveness score
    const acks = this._profile.coachingAcknowledgments[type] || 0;
    const dismissals = this._profile.coachingDismissals[type] || 0;
    const total = acks + dismissals;
    if (total > 0) {
      this._profile.coachingEffectiveness[type] =
        Math.round(((acks - dismissals) / total) * 100) / 100; // -1 to 1
    }

    this._persist();
    this._notify();
  }

  /**
   * Update inferred preferences (called by chart/feature usage tracking).
   */
  updatePreferences(updates: {
    timeframes?: string[];
    indicators?: string[];
  }): void {
    if (updates.timeframes) {
      // Merge and deduplicate, keep top 5 most recent
      const merged = [...updates.timeframes, ...this._profile.preferredTimeframes];
      this._profile.preferredTimeframes = [...new Set(merged)].slice(0, 5);
    }
    if (updates.indicators) {
      const merged = [...updates.indicators, ...this._profile.preferredIndicators];
      this._profile.preferredIndicators = [...new Set(merged)].slice(0, 10);
    }
    this._persist();
  }

  /**
   * Reset the profile entirely.
   */
  reset(): void {
    this._profile = { ...EMPTY_PROFILE };
    this._persist();
    this._notify();
  }

  // ── Computation Methods ─────────────────────────────────────

  private _computeOverallStats(trades: TradeLike[], profile: UserProfile): void {
    let wins = 0, losses = 0;
    let totalWinPnl = 0, totalLossPnl = 0;
    let largestWin = 0, largestLoss = 0;
    let curWinStreak = 0, curLossStreak = 0;
    let maxWinStreak = 0, maxLossStreak = 0;
    let longCount = 0, shortCount = 0;

    for (const t of trades) {
      const pnl = t.pnl as number;

      if (pnl > 0) {
        wins++;
        totalWinPnl += pnl;
        largestWin = Math.max(largestWin, pnl);
        curWinStreak++;
        maxWinStreak = Math.max(maxWinStreak, curWinStreak);
        curLossStreak = 0;
      } else {
        losses++;
        totalLossPnl += Math.abs(pnl);
        largestLoss = Math.max(largestLoss, Math.abs(pnl));
        curLossStreak++;
        maxLossStreak = Math.max(maxLossStreak, curLossStreak);
        curWinStreak = 0;
      }

      const side = String(t.side || '').toLowerCase();
      if (side === 'long') longCount++;
      else if (side === 'short') shortCount++;
    }

    const total = wins + losses;
    profile.overallWinRate = total > 0 ? wins / total : 0;
    profile.overallProfitFactor = totalLossPnl > 0 ? totalWinPnl / totalLossPnl : totalWinPnl > 0 ? Infinity : 0;
    profile.avgWin = wins > 0 ? totalWinPnl / wins : 0;
    profile.avgLoss = losses > 0 ? totalLossPnl / losses : 0;
    profile.largestWin = largestWin;
    profile.largestLoss = largestLoss;
    profile.maxConsecutiveWins = maxWinStreak;
    profile.maxConsecutiveLosses = maxLossStreak;
    profile.expectancy = total > 0
      ? (profile.overallWinRate * profile.avgWin) - ((1 - profile.overallWinRate) * profile.avgLoss)
      : 0;

    // Side preference
    const longPct = total > 0 ? longCount / total : 0.5;
    profile.preferredSide = longPct > 0.65 ? 'long' : longPct < 0.35 ? 'short' : 'balanced';
  }

  private _computeHourStats(trades: TradeLike[], profile: UserProfile): void {
    const buckets = new Map<number, { wins: number; losses: number; pnl: number }>();

    for (const t of trades) {
      const d = _getDate(t);
      const hour = d.getHours();
      if (!buckets.has(hour)) buckets.set(hour, { wins: 0, losses: 0, pnl: 0 });
      const b = buckets.get(hour)!;
      const pnl = t.pnl as number;
      if (pnl > 0) b.wins++;
      else b.losses++;
      b.pnl += pnl;
    }

    const hourStats: HourStats[] = [];
    for (const [hour, b] of buckets.entries()) {
      const total = b.wins + b.losses;
      hourStats.push({
        hour,
        trades: total,
        wins: b.wins,
        losses: b.losses,
        winRate: total > 0 ? b.wins / total : 0,
        totalPnl: b.pnl,
        avgPnl: total > 0 ? b.pnl / total : 0,
      });
    }

    hourStats.sort((a, b) => b.avgPnl - a.avgPnl);
    profile.allHourStats = hourStats;

    const qualified = hourStats.filter(h => h.trades >= 3);
    profile.bestHours = qualified.slice(0, 3);
    profile.worstHours = qualified.slice(-3).reverse();
  }

  private _computeDayStats(trades: TradeLike[], profile: UserProfile): void {
    const buckets = new Map<number, { wins: number; losses: number; pnl: number }>();

    for (const t of trades) {
      const d = _getDate(t);
      const day = d.getDay();
      if (!buckets.has(day)) buckets.set(day, { wins: 0, losses: 0, pnl: 0 });
      const b = buckets.get(day)!;
      const pnl = t.pnl as number;
      if (pnl > 0) b.wins++;
      else b.losses++;
      b.pnl += pnl;
    }

    const dayStats: DayStats[] = [];
    for (const [day, b] of buckets.entries()) {
      const total = b.wins + b.losses;
      dayStats.push({
        day,
        dayName: DAY_NAMES[day] || 'Unknown',
        trades: total,
        wins: b.wins,
        losses: b.losses,
        winRate: total > 0 ? b.wins / total : 0,
        totalPnl: b.pnl,
        avgPnl: total > 0 ? b.pnl / total : 0,
      });
    }

    dayStats.sort((a, b) => b.avgPnl - a.avgPnl);
    profile.allDayStats = dayStats;

    const qualified = dayStats.filter(d => d.trades >= 3);
    profile.bestDays = qualified.slice(0, 2);
    profile.worstDays = qualified.slice(-2).reverse();
  }

  private _computeSetupStats(trades: TradeLike[], profile: UserProfile): void {
    const buckets = new Map<string, { wins: number; losses: number; pnl: number; holdMins: number[] }>();

    for (const t of trades) {
      const setup = String(t.setup || t.setupType || t.strategy || '').toLowerCase().trim();
      if (!setup || setup === 'undefined' || setup === 'null') continue;

      if (!buckets.has(setup)) buckets.set(setup, { wins: 0, losses: 0, pnl: 0, holdMins: [] });
      const b = buckets.get(setup)!;
      const pnl = t.pnl as number;
      if (pnl > 0) b.wins++;
      else b.losses++;
      b.pnl += pnl;

      const hold = _getHoldMinutes(t);
      if (hold > 0) b.holdMins.push(hold);
    }

    const setupStats: SetupStats[] = [];
    for (const [setup, b] of buckets.entries()) {
      const total = b.wins + b.losses;
      setupStats.push({
        setup,
        trades: total,
        wins: b.wins,
        losses: b.losses,
        winRate: total > 0 ? b.wins / total : 0,
        totalPnl: b.pnl,
        avgPnl: total > 0 ? b.pnl / total : 0,
        avgHoldMinutes: b.holdMins.length > 0
          ? b.holdMins.reduce((s, v) => s + v, 0) / b.holdMins.length
          : 0,
      });
    }

    setupStats.sort((a, b) => b.winRate - a.winRate);
    profile.allSetupStats = setupStats;

    const qualified = setupStats.filter(s => s.trades >= 5);
    profile.topSetups = qualified.filter(s => s.winRate >= 0.5).slice(0, 5);
    profile.worstSetups = qualified.filter(s => s.winRate < 0.5).slice(-3).reverse();
  }

  private _computeEmotionStats(trades: TradeLike[], profile: UserProfile): void {
    const buckets = new Map<string, { wins: number; losses: number; pnl: number }>();

    for (const t of trades) {
      const emotion = String(t.emotion || '').toLowerCase().trim();
      if (!emotion || emotion === 'undefined' || emotion === 'null') continue;

      if (!buckets.has(emotion)) buckets.set(emotion, { wins: 0, losses: 0, pnl: 0 });
      const b = buckets.get(emotion)!;
      const pnl = t.pnl as number;
      if (pnl > 0) b.wins++;
      else b.losses++;
      b.pnl += pnl;
    }

    const stats: EmotionStats[] = [];
    for (const [emotion, b] of buckets.entries()) {
      const total = b.wins + b.losses;
      stats.push({
        emotion,
        trades: total,
        wins: b.wins,
        losses: b.losses,
        winRate: total > 0 ? b.wins / total : 0,
        totalPnl: b.pnl,
      });
    }

    stats.sort((a, b) => b.totalPnl - a.totalPnl);
    profile.emotionStats = stats;

    if (stats.length > 0) {
      profile.mostProfitableEmotion = stats[0]?.emotion || '';
      profile.mostDangerousEmotion = stats[stats.length - 1]?.emotion || '';
    }
  }

  private _computeTiltPatterns(trades: TradeLike[], profile: UserProfile): void {
    const patterns: TiltPattern[] = [];

    // Pattern 1: consecutive loss clusters (3+ losses in a row)
    let lossStreak = 0;
    let postStreakPnl: number[] = [];
    let streakCount = 0;

    for (let i = 0; i < trades.length; i++) {
      const trade = trades[i];
      if (!trade) continue;
      const pnl = trade.pnl as number;

      if (pnl <= 0) {
        lossStreak++;
      } else {
        if (lossStreak >= 3) {
          // This is a post-tilt trade
          postStreakPnl.push(pnl);
          streakCount++;
        }
        lossStreak = 0;
      }
    }

    if (streakCount >= 2) {
      patterns.push({
        trigger: `Consecutive losses (3+) — happened ${streakCount} times`,
        frequency: streakCount,
        avgLossAfterTilt: postStreakPnl.length > 0
          ? postStreakPnl.reduce((s, v) => s + v, 0) / postStreakPnl.length
          : 0,
        recoveryTime: 0,
      });
    }

    // Pattern 2: rapid-fire trading (multiple trades within 10 minutes)
    let rapidFireCount = 0;
    let rapidPnl: number[] = [];
    for (let i = 1; i < trades.length; i++) {
      const prevTrade = trades[i - 1];
      const currTrade = trades[i];
      if (!prevTrade || !currTrade) continue;
      const prev = _getDate(prevTrade).getTime();
      const curr = _getDate(currTrade).getTime();
      if (curr - prev < 10 * 60 * 1000 && curr - prev > 0) {
        rapidFireCount++;
        rapidPnl.push(currTrade.pnl as number);
      }
    }

    if (rapidFireCount >= 3) {
      patterns.push({
        trigger: `Rapid-fire trading (<10 min apart) — ${rapidFireCount} instances`,
        frequency: rapidFireCount,
        avgLossAfterTilt: rapidPnl.length > 0
          ? rapidPnl.reduce((s, v) => s + v, 0) / rapidPnl.length
          : 0,
        recoveryTime: 0,
      });
    }

    profile.tiltPatterns = patterns;
  }

  private _computeSymbolStats(trades: TradeLike[], profile: UserProfile): void {
    const buckets = new Map<string, { wins: number; losses: number; pnl: number }>();

    for (const t of trades) {
      const symbol = String(t.symbol || '').toUpperCase().trim();
      if (!symbol) continue;

      if (!buckets.has(symbol)) buckets.set(symbol, { wins: 0, losses: 0, pnl: 0 });
      const b = buckets.get(symbol)!;
      const pnl = t.pnl as number;
      if (pnl > 0) b.wins++;
      else b.losses++;
      b.pnl += pnl;
    }

    const stats: SymbolStats[] = [];
    for (const [symbol, b] of buckets.entries()) {
      const total = b.wins + b.losses;
      stats.push({
        symbol,
        trades: total,
        wins: b.wins,
        losses: b.losses,
        winRate: total > 0 ? b.wins / total : 0,
        totalPnl: b.pnl,
      });
    }

    stats.sort((a, b) => b.trades - a.trades);
    profile.allSymbolStats = stats;
    profile.topSymbols = stats.slice(0, 10);
  }

  private _computePositionSizing(trades: TradeLike[], profile: UserProfile): void {
    const sizes: number[] = [];
    for (const t of trades) {
      const size = typeof t.qty === 'number' ? t.qty
        : typeof t.quantity === 'number' ? t.quantity
        : typeof t.positionSize === 'number' ? t.positionSize
        : 0;
      if (size > 0) sizes.push(size);
    }

    if (sizes.length === 0) return;

    const avg = sizes.reduce((s, v) => s + v, 0) / sizes.length;
    profile.avgPositionSize = Math.round(avg * 100) / 100;

    // Variance = avg of squared diffs
    const variance = sizes.reduce((s, v) => s + (v - avg) ** 2, 0) / sizes.length;
    profile.positionSizeVariance = Math.round(Math.sqrt(variance) * 100) / 100;

    // Detect revenge sizing: after a loss, is the next trade larger?
    let oversizeCount = 0;
    let comparisonCount = 0;
    for (let i = 1; i < trades.length; i++) {
      const prevTrade = trades[i - 1];
      const currTrade = trades[i];
      if (!prevTrade || !currTrade) continue;
      const prevPnl = prevTrade.pnl as number;
      const prevSize = _getSize(prevTrade);
      const currSize = _getSize(currTrade);
      if (prevPnl < 0 && prevSize > 0 && currSize > 0) {
        comparisonCount++;
        if (currSize > prevSize * 1.3) oversizeCount++;
      }
    }

    profile.oversizingAfterLoss = comparisonCount >= 3 && oversizeCount / comparisonCount > 0.4;
  }

  private _classifyStyle(trades: TradeLike[], profile: UserProfile): void {
    // Compute hold times
    const holdMins: number[] = [];
    for (const t of trades) {
      const h = _getHoldMinutes(t);
      if (h > 0) holdMins.push(h);
    }

    if (holdMins.length > 0) {
      holdMins.sort((a, b) => a - b);
      profile.avgHoldMinutes = Math.round(holdMins.reduce((s, v) => s + v, 0) / holdMins.length);
      profile.medianHoldMinutes = Math.round(holdMins[Math.floor(holdMins.length / 2)] ?? 0);
    }

    // Trades per day
    const dates = new Set<string>();
    for (const t of trades) {
      const d = _getDate(t);
      dates.add(d.toISOString().slice(0, 10));
    }
    profile.tradesPerDay = dates.size > 0
      ? Math.round((trades.length / dates.size) * 10) / 10
      : 0;

    // Classify
    const med = profile.medianHoldMinutes;
    if (med > 0 && med <= 15) {
      profile.tradingStyle = 'scalper';
    } else if (med > 15 && med <= 240) {
      profile.tradingStyle = 'day_trader';
    } else if (med > 240 && med <= 7200) {
      profile.tradingStyle = 'swing_trader';
    } else if (med > 7200) {
      profile.tradingStyle = 'position_trader';
    } else {
      // Fallback: use trades per day
      if (profile.tradesPerDay >= 10) profile.tradingStyle = 'scalper';
      else if (profile.tradesPerDay >= 3) profile.tradingStyle = 'day_trader';
      else if (profile.tradesPerDay >= 0.5) profile.tradingStyle = 'swing_trader';
      else profile.tradingStyle = 'position_trader';
    }
  }

  // ── Persistence ─────────────────────────────────────────────

  private _persist(): void {
    // Write to encrypted store (async, fire-and-forget)
    encryptedStore.put('profiles', STORAGE_KEY, this._profile).catch(() => {
      // Encrypted store unavailable — non-critical
    });
  }

  private _notify(): void {
    const snap = { ...this._profile };
    for (const cb of this._listeners) {
      try { cb(snap); } catch { /* ignore */ }
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

function _getDate(t: TradeLike): Date {
  const raw = t.entryDate || t.date || t.entryTime;
  if (!raw) return new Date();
  const d = new Date(raw as string | number);
  return isNaN(d.getTime()) ? new Date() : d;
}

function _getHoldMinutes(t: TradeLike): number {
  if (typeof t.holdMinutes === 'number' && t.holdMinutes > 0) return t.holdMinutes;
  if (typeof t.holdDuration === 'number' && t.holdDuration > 0) return t.holdDuration / 60000;

  const entry = t.entryDate || t.date || t.entryTime;
  const exit = t.exitDate;
  if (entry && exit) {
    const entryMs = new Date(entry as string | number).getTime();
    const exitMs = new Date(exit as string).getTime();
    if (!isNaN(entryMs) && !isNaN(exitMs) && exitMs > entryMs) {
      return (exitMs - entryMs) / 60000;
    }
  }

  return 0;
}

function _getSize(t: TradeLike): number {
  return typeof t.qty === 'number' ? t.qty
    : typeof t.quantity === 'number' ? t.quantity
    : typeof t.positionSize === 'number' ? t.positionSize
    : 0;
}

// ─── Singleton ──────────────────────────────────────────────────

export const userProfileStore = new UserProfileStore();
export default userProfileStore;
