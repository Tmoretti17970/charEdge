// ═══════════════════════════════════════════════════════════════════
// charEdge — Proactive Coach Service (Sprint 68)
//
// Auto-triggers AI coaching at key moments:
//   1. Post-trade debrief — 30s after a trade is closed
//   2. Weekly digest — generates performance summary on Sunday/Monday
//   3. Pre-session warning — alerts before historically bad sessions
//
// Uses AIRouter for LLM access and useAICoachStore for persistence.
// Respects adaptive coaching preferences (tone, frequency, verbosity).
// ═══════════════════════════════════════════════════════════════════

import { logger } from '@/observability/logger';

// ─── Types ──────────────────────────────────────────────────────

export interface TradeForDebrief {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  pnl: number;
  rMultiple?: number;
  duration?: number;
  setup?: string;
  emotion?: string;
  fomo?: number | null;
  impulse?: number | null;
  clarity?: number | null;
  triggers?: string[];
  confluences?: string[];
}

export interface DebriefResult {
  summary: string;
  gradeLabel: string;
  strengths: string[];
  improvements: string[];
  emotionalNote: string | null;
  timestamp: number;
}

export interface WeeklyDigestResult {
  narrative: string;
  grade: string;
  topPatterns: string[];
  riskWarnings: string[];
  focusAreas: string[];
  timestamp: number;
}

// ─── Throttle: prevent spam ─────────────────────────────────────

const DEBRIEF_COOLDOWN_MS = 60_000; // 1 min between debriefs
const WEEKLY_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours between weekly digests
let _lastDebriefAt = 0;
let _lastWeeklyAt = 0;

// ─── Post-Trade Debrief ─────────────────────────────────────────

/**
 * Auto-triggered after a trade is closed.
 * Returns a quick debrief with grade, strengths, and improvements.
 * Debounced to prevent spamming on bulk imports.
 */
export async function generatePostTradeDebrief(trade: TradeForDebrief): Promise<DebriefResult | null> {
  const now = Date.now();
  if (now - _lastDebriefAt < DEBRIEF_COOLDOWN_MS) {
    logger.ai?.debug('[ProactiveCoach] Debrief throttled — too soon after last');
    return null;
  }
  _lastDebriefAt = now;

  try {
    const { aiRouter } = await import('./AIRouter');

    const pnlLabel = trade.pnl >= 0 ? `+$${trade.pnl.toFixed(2)}` : `-$${Math.abs(trade.pnl).toFixed(2)}`;
    const emotionContext = trade.emotion ? ` Emotion: ${trade.emotion}.` : '';
    const fomoContext = trade.fomo != null && trade.fomo >= 7 ? ' High FOMO detected.' : '';
    const impulseContext = trade.impulse != null && trade.impulse >= 7 ? ' Impulsive entry.' : '';
    const clarityContext = trade.clarity != null && trade.clarity <= 3 ? ' Low clarity.' : '';
    const triggerContext = trade.triggers?.length ? ` Triggers: ${trade.triggers.join(', ')}.` : '';
    const setupContext = trade.setup ? ` Setup: ${trade.setup}.` : '';
    const rContext = trade.rMultiple != null ? ` R-multiple: ${trade.rMultiple.toFixed(1)}R.` : '';

    const prompt = `You are a trading coach. Give a quick post-trade debrief for this trade:

${trade.symbol} ${trade.side} — ${pnlLabel}${rContext}${setupContext}${emotionContext}${fomoContext}${impulseContext}${clarityContext}${triggerContext}

Respond in this exact format (keep each section to 1-2 sentences):
GRADE: [A+/A/B/C/D/F]
SUMMARY: [What happened]
STRENGTH: [What was done well]
IMPROVE: [What to work on]
EMOTION: [Emotional observation, or "None" if n/a]`;

    const result = await aiRouter.route({
      type: 'post_trade_debrief',
      messages: [
        { role: 'system', content: 'You are a concise trading coach. Be direct and specific.' },
        { role: 'user', content: prompt },
      ],
      maxTokens: 256,
      temperature: 0.3,
    });

    // Parse structured response
    const lines = result.content.split('\n').filter(Boolean);
    const get = (prefix: string) =>
      lines
        .find((l) => l.startsWith(prefix))
        ?.replace(prefix, '')
        .trim() || '';

    return {
      summary: get('SUMMARY:') || result.content.slice(0, 200),
      gradeLabel: get('GRADE:') || 'B',
      strengths: [get('STRENGTH:')].filter(Boolean),
      improvements: [get('IMPROVE:')].filter(Boolean),
      emotionalNote: get('EMOTION:') === 'None' ? null : get('EMOTION:') || null,
      timestamp: now,
    };
  } catch (err) {
    logger.ai?.warn('[ProactiveCoach] Debrief failed:', (err as Error).message);
    return null;
  }
}

// ─── Weekly Digest ──────────────────────────────────────────────

/**
 * Generates a weekly performance summary.
 * Should be called once per week (e.g., Sunday evening or Monday morning).
 */
export async function generateWeeklyDigest(weekStats: {
  totalTrades: number;
  winRate: number;
  netPnl: number;
  bestTrade: string;
  worstTrade: string;
  avgRMultiple: number;
  emotionBreakdown: Record<string, number>;
  topSetups: string[];
  triggerFrequency: Record<string, number>;
}): Promise<WeeklyDigestResult | null> {
  const now = Date.now();
  if (now - _lastWeeklyAt < WEEKLY_COOLDOWN_MS) {
    logger.ai?.debug('[ProactiveCoach] Weekly digest throttled');
    return null;
  }
  _lastWeeklyAt = now;

  try {
    const { aiRouter } = await import('./AIRouter');

    const pnlLabel =
      weekStats.netPnl >= 0 ? `+$${weekStats.netPnl.toFixed(2)}` : `-$${Math.abs(weekStats.netPnl).toFixed(2)}`;
    const topTriggers = Object.entries(weekStats.triggerFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([t, c]) => `${t} (${c}x)`)
      .join(', ');

    const prompt = `You are a trading coach reviewing this week's performance:

Trades: ${weekStats.totalTrades} | Win Rate: ${weekStats.winRate.toFixed(0)}% | Net P&L: ${pnlLabel}
Avg R-Multiple: ${weekStats.avgRMultiple.toFixed(1)}R
Best: ${weekStats.bestTrade} | Worst: ${weekStats.worstTrade}
Top Setups: ${weekStats.topSetups.join(', ') || 'None tracked'}
Frequent Triggers: ${topTriggers || 'None'}

Respond in this exact format:
GRADE: [A+/A/B/C/D/F]
NARRATIVE: [2-3 sentence weekly summary]
PATTERN1: [Key pattern observed]
PATTERN2: [Second pattern]
RISK: [Risk warning if any, or "None"]
FOCUS: [One specific thing to focus on next week]`;

    const result = await aiRouter.route({
      type: 'weekly_digest',
      messages: [
        {
          role: 'system',
          content: 'You are a concise trading coach giving a weekly performance review. Be honest and constructive.',
        },
        { role: 'user', content: prompt },
      ],
      maxTokens: 384,
      temperature: 0.3,
    });

    const lines = result.content.split('\n').filter(Boolean);
    const get = (prefix: string) =>
      lines
        .find((l) => l.startsWith(prefix))
        ?.replace(prefix, '')
        .trim() || '';

    return {
      narrative: get('NARRATIVE:') || result.content.slice(0, 300),
      grade: get('GRADE:') || 'B',
      topPatterns: [get('PATTERN1:'), get('PATTERN2:')].filter(Boolean),
      riskWarnings: get('RISK:') === 'None' ? [] : [get('RISK:')].filter(Boolean),
      focusAreas: [get('FOCUS:')].filter(Boolean),
      timestamp: now,
    };
  } catch (err) {
    logger.ai?.warn('[ProactiveCoach] Weekly digest failed:', (err as Error).message);
    return null;
  }
}

// ─── Pre-Session Warning ────────────────────────────────────────

/**
 * Check if the current time matches a historically bad trading session.
 * Returns a warning message if the trader should be cautious.
 */
export function checkPreSessionWarning(hourlyPnl: Record<number, { pnl: number; trades: number }>): string | null {
  const currentHour = new Date().getHours();
  const stats = hourlyPnl[currentHour];
  if (!stats || stats.trades < 5) return null;

  const avgPnl = stats.pnl / stats.trades;
  if (avgPnl < -50) {
    return `Heads up: You've historically lost an average of $${Math.abs(avgPnl).toFixed(0)} per trade during the ${currentHour}:00 hour (${stats.trades} trades). Consider sitting this session out or reducing size.`;
  }
  return null;
}
