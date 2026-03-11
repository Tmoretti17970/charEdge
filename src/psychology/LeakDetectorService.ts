// ═══════════════════════════════════════════════════════════════════
// charEdge — LeakDetector (Task 6.5.1)
//
// Automatic behavioral tagging for trades. Pure function module —
// no React dependency. Analyzes a trade against recent history to
// detect behavioral "leaks" that hurt trading performance.
//
// Usage:
//   import { detectLeaks } from './LeakDetector.js';
//   const tags = detectLeaks(trade, recentTrades);
//   trade.tags = [...(trade.tags || []), ...tags];
// ═══════════════════════════════════════════════════════════════════

// ─── Leak Tag Definitions ────────────────────────────────────────

export const LEAK_TAGS = {
  EARLY_EXIT_FEAR: 'EARLY_EXIT_FEAR',
  HOPE_TRADING: 'HOPE_TRADING',
  REVENGE_TRADE: 'REVENGE_TRADE',
  FOMO_ENTRY: 'FOMO_ENTRY',
  OVERSIZED: 'OVERSIZED',
  PERFECT_EXECUTION: 'PERFECT_EXECUTION',
} as const;

export type LeakTag = (typeof LEAK_TAGS)[keyof typeof LEAK_TAGS];

/** Description for each tag, used in tooltips and analytics. */
export const LEAK_DESCRIPTIONS: Record<LeakTag, string> = {
  EARLY_EXIT_FEAR: 'Closed >50% before take-profit — possible fear-based exit',
  HOPE_TRADING: 'Stop-loss was moved away from entry — holding and hoping',
  REVENGE_TRADE: 'Opened <2 minutes after a losing trade',
  FOMO_ENTRY: 'No trade plan or playbook attached — impulsive entry',
  OVERSIZED: 'Position size exceeded 2× default risk',
  PERFECT_EXECUTION: 'Hit target, followed plan, R ≥ 1 — textbook trade',
};

// ─── Configuration ───────────────────────────────────────────────

export interface LeakDetectorConfig {
  /** Max milliseconds between consecutive trades to flag REVENGE_TRADE. Default: 120000 (2min) */
  revengeWindowMs: number;
  /** Percentage of TP distance to flag EARLY_EXIT_FEAR. Default: 0.5 (50%) */
  earlyExitThreshold: number;
  /** Multiplier over default risk % to flag OVERSIZED. Default: 2 */
  oversizedMultiplier: number;
  /** Default risk percent for OVERSIZED detection. Default: 1 */
  defaultRiskPercent: number;
}

const DEFAULT_CONFIG: LeakDetectorConfig = {
  revengeWindowMs: 2 * 60 * 1000, // 2 minutes
  earlyExitThreshold: 0.5, // 50% before TP
  oversizedMultiplier: 2,
  defaultRiskPercent: 1,
};

// ─── Trade Shape ─────────────────────────────────────────────────
// Minimal interface — works with any trade object that has these fields.

interface TradeInput {
  date?: string;
  closeDate?: string;
  pnl?: number;
  side?: string;
  entry?: number;
  exit?: number;
  stopLoss?: number;
  takeProfit?: number;
  riskPercent?: number;
  playbook?: string;
  setup?: string;
  tags?: string[];
  rMultiple?: number;
  context?: {
    originalStopLoss?: number | null;
    originalTakeProfit?: number | null;
  };
}

// ─── Core Detection ──────────────────────────────────────────────

/**
 * Analyze a trade and return an array of behavioral leak tags.
 * Pure function — no side effects, no store access.
 *
 * @param trade - The trade to analyze
 * @param recentTrades - Recent trades (sorted newest first) for context
 * @param config - Optional configuration overrides
 * @returns Array of detected leak tags
 */
export function detectLeaks(
  trade: TradeInput,
  recentTrades: TradeInput[] = [],
  config: Partial<LeakDetectorConfig> = {},
): LeakTag[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const tags: LeakTag[] = [];

  // ── FOMO_ENTRY: No plan attached ──────────────────────────────
  if (!trade.playbook && !trade.setup) {
    tags.push(LEAK_TAGS.FOMO_ENTRY);
  }

  // ── REVENGE_TRADE: <2min after a losing trade ─────────────────
  if (trade.date && recentTrades.length > 0) {
    const tradeTime = new Date(trade.date).getTime();
    if (!isNaN(tradeTime)) {
      for (const prev of recentTrades) {
        // Use closeDate if available, else date
        const prevTime = new Date(prev.closeDate || prev.date || '').getTime();
        if (isNaN(prevTime)) continue;

        const gap = tradeTime - prevTime;
        if (gap >= 0 && gap <= cfg.revengeWindowMs && (prev.pnl ?? 0) < 0) {
          tags.push(LEAK_TAGS.REVENGE_TRADE);
          break;
        }
      }
    }
  }

  // ── EARLY_EXIT_FEAR: Closed >50% before TP ───────────────────
  const tp = trade.takeProfit ?? trade.context?.originalTakeProfit;
  if (tp != null && trade.entry != null && trade.exit != null && trade.entry !== tp) {
    const totalDistance = Math.abs(tp - trade.entry);
    const actualDistance = Math.abs(trade.exit - trade.entry);

    // Only flag if trade was in the right direction (profit side)
    const isLong = trade.side === 'long' || trade.side === undefined;
    const wentRight = isLong ? trade.exit > trade.entry : trade.exit < trade.entry;

    if (wentRight && totalDistance > 0 && actualDistance < totalDistance * cfg.earlyExitThreshold) {
      tags.push(LEAK_TAGS.EARLY_EXIT_FEAR);
    }
  }

  // ── HOPE_TRADING: SL moved away from entry ───────────────────
  const originalSL = trade.context?.originalStopLoss;
  if (originalSL != null && trade.stopLoss != null && originalSL !== trade.stopLoss) {
    const isLong = trade.side === 'long' || trade.side === undefined;
    // For longs, SL moved down = moved away from entry (hoping)
    // For shorts, SL moved up = moved away from entry (hoping)
    const movedAway = isLong ? trade.stopLoss < originalSL : trade.stopLoss > originalSL;

    if (movedAway) {
      tags.push(LEAK_TAGS.HOPE_TRADING);
    }
  }

  // ── OVERSIZED: Position risk > 2× default ────────────────────
  if (trade.riskPercent != null && trade.riskPercent > cfg.defaultRiskPercent * cfg.oversizedMultiplier) {
    tags.push(LEAK_TAGS.OVERSIZED);
  }

  // ── PERFECT_EXECUTION: Hit TP, followed plan, R ≥ 1 ──────────
  if (tags.length === 0 && (trade.playbook || trade.setup) && (trade.rMultiple ?? 0) >= 1 && (trade.pnl ?? 0) > 0) {
    tags.push(LEAK_TAGS.PERFECT_EXECUTION);
  }

  return tags;
}

/**
 * Apply leak detection to a trade and merge tags into its tags array.
 * Returns a new trade object — does NOT mutate the input.
 */
export function applyLeakTags(
  trade: TradeInput,
  recentTrades: TradeInput[] = [],
  config?: Partial<LeakDetectorConfig>,
): TradeInput {
  const leaks = detectLeaks(trade, recentTrades, config);
  if (leaks.length === 0) return trade;

  const existing = new Set(trade.tags || []);
  const newTags = leaks.filter((t) => !existing.has(t));
  if (newTags.length === 0) return trade;

  return {
    ...trade,
    tags: [...(trade.tags || []), ...newTags],
  };
}
