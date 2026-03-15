// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Alert Curation (Sprint 22)
//
// Smart priority scoring and noise reduction.
// Reduce noise, surface signal — the ultimate competitive advantage.
//
// Features:
//   - Smart priority scoring (proximity, volume, timing, history)
//   - Focus Mode: only show high-priority alerts
//   - Weekly review summary
//   - Anomaly detection (unusual price movement)
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ──────────────────────────────────────────────────────

export interface ScoredAlert {
  alertId: string;
  symbol: string;
  score: number;       // 0–100, higher = more important
  factors: ScoreFactor[];
  recommendation: 'show' | 'suppress' | 'silent';
}

export interface ScoreFactor {
  name: string;
  weight: number;     // contribution to final score
  value: number;      // raw metric value
  description: string;
}

export interface WeeklyReview {
  weekStart: number;
  weekEnd: number;
  totalAlerts: number;
  highValue: number;     // score > 70
  noise: number;         // score < 30
  topSymbols: string[];
  suggestions: string[];
}

// ─── Scoring Weights ────────────────────────────────────────────

const WEIGHTS = {
  /** How close is the alert to user's entry price? */
  entryProximity: 25,
  /** Volume context: is this a high-volume move? */
  volumeContext: 20,
  /** Time of day: NY open = higher, off-hours = lower */
  timingRelevance: 15,
  /** User's historical response rate to this type */
  historicalResponse: 20,
  /** Alert age: newer alerts are slightly more important */
  recency: 10,
  /** Symbol importance: watchlisted or actively traded = higher */
  symbolImportance: 10,
};

// ─── Scoring Engine ─────────────────────────────────────────────

interface ScoringContext {
  /** User's entry price for this symbol (if any) */
  entryPrice?: number;
  /** Current volume vs average volume ratio */
  volumeRatio?: number;
  /** Current hour (0–23) */
  currentHour?: number;
  /** How often user has responded to this alert type (0–1) */
  responseRate?: number;
  /** When the alert was created */
  alertCreatedAt?: number;
  /** Is this symbol in the watchlist? */
  isWatchlisted?: boolean;
  /** Is there an open position on this symbol? */
  hasPosition?: boolean;
}

/**
 * Score an alert for priority ranking.
 * Returns 0–100 with factor breakdown.
 */
export function scoreAlert(
  alertId: string,
  symbol: string,
  triggerPrice: number,
  context: ScoringContext = {},
): ScoredAlert {
  const factors: ScoreFactor[] = [];
  let totalScore = 0;

  // 1. Entry proximity (higher if alert is near user's entry)
  if (context.entryPrice && context.entryPrice > 0) {
    const pctFromEntry = Math.abs((triggerPrice - context.entryPrice) / context.entryPrice);
    const proximity = Math.max(0, 1 - pctFromEntry * 5); // within 20% gets some score
    const score = proximity * WEIGHTS.entryProximity;
    totalScore += score;
    factors.push({
      name: 'Entry Proximity',
      weight: WEIGHTS.entryProximity,
      value: proximity,
      description: `${(pctFromEntry * 100).toFixed(1)}% from entry`,
    });
  }

  // 2. Volume context
  const volumeRatio = context.volumeRatio || 1;
  const volumeScore = Math.min(1, volumeRatio / 2) * WEIGHTS.volumeContext;
  totalScore += volumeScore;
  factors.push({
    name: 'Volume Context',
    weight: WEIGHTS.volumeContext,
    value: volumeRatio,
    description: `${volumeRatio.toFixed(1)}x average volume`,
  });

  // 3. Timing relevance (higher during market hours)
  const hour = context.currentHour ?? new Date().getHours();
  const isMarketHours = (hour >= 9 && hour <= 16); // NY market hours
  const isAsianSession = (hour >= 20 || hour <= 4);
  const timingMultiplier = isMarketHours ? 1.0 : isAsianSession ? 0.6 : 0.4;
  const timingScore = timingMultiplier * WEIGHTS.timingRelevance;
  totalScore += timingScore;
  factors.push({
    name: 'Timing',
    weight: WEIGHTS.timingRelevance,
    value: timingMultiplier,
    description: isMarketHours ? 'Market hours' : isAsianSession ? 'Asian session' : 'Off-hours',
  });

  // 4. Historical response rate
  const responseRate = context.responseRate ?? 0.5;
  const responseScore = responseRate * WEIGHTS.historicalResponse;
  totalScore += responseScore;
  factors.push({
    name: 'Response History',
    weight: WEIGHTS.historicalResponse,
    value: responseRate,
    description: `${(responseRate * 100).toFixed(0)}% response rate`,
  });

  // 5. Recency
  const age = context.alertCreatedAt ? Date.now() - context.alertCreatedAt : 86400000;
  const recencyMultiplier = Math.max(0.2, 1 - age / (30 * 86400000)); // decays over 30 days
  const recencyScore = recencyMultiplier * WEIGHTS.recency;
  totalScore += recencyScore;
  factors.push({
    name: 'Recency',
    weight: WEIGHTS.recency,
    value: recencyMultiplier,
    description: `${Math.floor(age / 86400000)}d old`,
  });

  // 6. Symbol importance
  const importanceMultiplier = (context.hasPosition ? 0.6 : 0) + (context.isWatchlisted ? 0.4 : 0.1);
  const importanceScore = importanceMultiplier * WEIGHTS.symbolImportance;
  totalScore += importanceScore;
  factors.push({
    name: 'Symbol Importance',
    weight: WEIGHTS.symbolImportance,
    value: importanceMultiplier,
    description: context.hasPosition ? 'Active position' : context.isWatchlisted ? 'Watchlisted' : 'No position',
  });

  // Normalize to 0–100
  const normalizedScore = Math.round(Math.min(100, totalScore));

  // Recommendation
  let recommendation: 'show' | 'suppress' | 'silent' = 'show';
  if (normalizedScore < 20) recommendation = 'silent';
  else if (normalizedScore < 40) recommendation = 'suppress';

  return {
    alertId,
    symbol,
    score: normalizedScore,
    factors,
    recommendation,
  };
}

// ─── Focus Mode Store ───────────────────────────────────────────

interface FocusModeState {
  /** Whether focus mode is active */
  enabled: boolean;
  /** Minimum score to show in focus mode (0–100) */
  threshold: number;
  toggle: () => void;
  setThreshold: (t: number) => void;
}

export const useFocusMode = create<FocusModeState>()(
  persist(
    (set) => ({
      enabled: false,
      threshold: 50,
      toggle: () => set((s) => ({ enabled: !s.enabled })),
      setThreshold: (t) => set({ threshold: Math.max(0, Math.min(100, t)) }),
    }),
    { name: 'charEdge-focus-mode' },
  ),
);

// ─── Weekly Review Generator ────────────────────────────────────

interface ReviewEntry {
  symbol: string;
  score: number;
  timestamp: number;
}

/**
 * Generate weekly review from scored alert history.
 */
export function generateWeeklyReview(entries: ReviewEntry[]): WeeklyReview {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const weekStart = now - weekMs;

  const thisWeek = entries.filter((e) => e.timestamp >= weekStart);
  const highValue = thisWeek.filter((e) => e.score >= 70);
  const noise = thisWeek.filter((e) => e.score < 30);

  // Top symbols by frequency
  const symbolCounts: Record<string, number> = {};
  thisWeek.forEach((e) => {
    symbolCounts[e.symbol] = (symbolCounts[e.symbol] || 0) + 1;
  });
  const topSymbols = Object.entries(symbolCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([sym]) => sym);

  // Suggestions
  const suggestions: string[] = [];
  if (noise.length > highValue.length * 2) {
    suggestions.push(`${noise.length} alerts were noise this week. Try enabling Focus Mode.`);
  }
  if (thisWeek.length > 50) {
    suggestions.push(`${thisWeek.length} alerts is a lot. Consider switching to Balanced or Quiet mode.`);
  }
  if (highValue.length === 0 && thisWeek.length > 0) {
    suggestions.push('No high-value alerts this week. Review your alert conditions.');
  }

  return {
    weekStart,
    weekEnd: now,
    totalAlerts: thisWeek.length,
    highValue: highValue.length,
    noise: noise.length,
    topSymbols,
    suggestions,
  };
}

// ─── Anomaly Detection ──────────────────────────────────────────

interface PriceSnapshot {
  symbol: string;
  price: number;
  avgPrice24h: number;
  volume24h: number;
  avgVolume24h: number;
}

/**
 * Detect unusual price movement that the user might want to know about.
 * Returns symbols with anomalous behavior.
 */
export function detectAnomalies(snapshots: PriceSnapshot[]): {
  symbol: string;
  type: 'unusualVolume' | 'largePriceMove' | 'volatilitySpike';
  description: string;
  severity: 'low' | 'medium' | 'high';
}[] {
  const anomalies: ReturnType<typeof detectAnomalies> = [];

  for (const snap of snapshots) {
    const pricePctChange = Math.abs((snap.price - snap.avgPrice24h) / snap.avgPrice24h) * 100;
    const volumeRatio = snap.avgVolume24h > 0 ? snap.volume24h / snap.avgVolume24h : 1;

    // Unusual volume (3x+ average)
    if (volumeRatio >= 3) {
      anomalies.push({
        symbol: snap.symbol,
        type: 'unusualVolume',
        description: `${snap.symbol} volume is ${volumeRatio.toFixed(1)}x average`,
        severity: volumeRatio >= 5 ? 'high' : 'medium',
      });
    }

    // Large price move (5%+)
    if (pricePctChange >= 5) {
      anomalies.push({
        symbol: snap.symbol,
        type: 'largePriceMove',
        description: `${snap.symbol} moved ${pricePctChange.toFixed(1)}% from 24h average`,
        severity: pricePctChange >= 10 ? 'high' : 'medium',
      });
    }
  }

  return anomalies;
}

export default { scoreAlert, useFocusMode, generateWeeklyReview, detectAnomalies };
