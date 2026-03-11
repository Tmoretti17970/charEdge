// ═══════════════════════════════════════════════════════════════════
// charEdge — Session Summary Generator (P1-B #11)
// Generates a daily narrative summary of trading activity.
// Designed to populate the "Today" card in the dashboard.
// ═══════════════════════════════════════════════════════════════════

import { llmService } from '../ai/LLMService';
import { computeFast } from '../app/features/analytics/analyticsFast.js';

/**
 * @typedef {Object} SessionNarrative
 * @property {string} headline   - One-liner for the dashboard card
 * @property {string} narrative  - 2-3 sentence daily summary
 * @property {string} mood       - Overall session mood: 'green' | 'yellow' | 'red'
 * @property {Object} stats      - { trades, pnl, winRate, bestTrade, worstTrade }
 * @property {string[]} lessons  - 1-3 key takeaways
 */

/**
 * Generate a daily session summary narrative.
 *
 * @param {Object[]} todaysTrades - Trades executed today
 * @param {Object} [journalEntry] - Optional journal entry for the day
 * @returns {Promise<SessionNarrative>}
 */
export async function generateSessionSummary(todaysTrades, journalEntry) {
  if (!todaysTrades?.length) {
    return {
      headline: 'No trades today',
      narrative: 'No trades were logged for today. Take time to review your watchlist and prepare for tomorrow.',
      mood: 'yellow',
      stats: { trades: 0, pnl: 0, winRate: 0, bestTrade: 0, worstTrade: 0 },
      lessons: [],
    };
  }

  // ─── Compute Core Stats ──────────────────────────────────────
  const result = computeFast(todaysTrades);
  const pnl = result?.pnl || 0;
  const winRate = result?.winRate || 0;
  const trades = todaysTrades.length;
  const bestTrade = result?.largest || 0;
  const worstTrade = result?.worstTrade || 0;

  const mood = pnl > 0 ? 'green' : pnl === 0 ? 'yellow' : 'red';

  // ─── LLM Path ────────────────────────────────────────────────
  if (llmService.isAvailable()) {
    try {
      const prompt = `Generate a 2-sentence trading day summary:
${trades} trades, ${winRate.toFixed(0)}% win rate, $${pnl.toFixed(2)} P&L.
Best: $${bestTrade.toFixed(2)}, Worst: $${worstTrade.toFixed(2)}.
${journalEntry?.notes ? `Trader notes: "${journalEntry.notes}"` : ''}
${journalEntry?.emotion ? `Mood: ${journalEntry.emotion}` : ''}
Also provide 1 headline (8 words max) and 1–2 key lessons.`;

      const response = await llmService._chat([
        { role: 'system', content: 'You are a concise trading coach. Respond with: HEADLINE: ...\nNARRATIVE: ...\nLESSONS:\n- ...' },
        { role: 'user', content: prompt },
      ]);

      const parsed = _parseSessionResponse(response.content);
      return {
        headline: parsed.headline || _generateHeadline(pnl, winRate, trades),
        narrative: parsed.narrative || _generateNarrative(pnl, winRate, trades, bestTrade, worstTrade),
        mood,
        stats: { trades, pnl, winRate, bestTrade, worstTrade },
        lessons: parsed.lessons.length > 0 ? parsed.lessons : _generateLessons(result),
      };
    } catch {
      // Fall through
    }
  }

  // ─── Rule-Based Fallback ──────────────────────────────────────
  return {
    headline: _generateHeadline(pnl, winRate, trades),
    narrative: _generateNarrative(pnl, winRate, trades, bestTrade, worstTrade),
    mood,
    stats: { trades, pnl, winRate, bestTrade, worstTrade },
    lessons: _generateLessons(result),
  };
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function _generateHeadline(pnl, winRate, trades) {
  if (pnl > 0 && winRate > 60) return `Strong day: ${trades} trades, +$${pnl.toFixed(0)}`;
  if (pnl > 0) return `Green day with ${trades} trades`;
  if (pnl < 0 && winRate < 40) return `Rough session — review your setups`;
  if (pnl < 0) return `Red day: -$${Math.abs(pnl).toFixed(0)} across ${trades} trades`;
  return `Breakeven day: ${trades} trades taken`;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function _generateNarrative(pnl, winRate, trades, best, worst) {
  const direction = pnl >= 0 ? 'positive' : 'negative';
  return `Today's session produced a ${direction} result with ${trades} trades at a ${winRate.toFixed(0)}% win rate ($${pnl.toFixed(2)} net). Your best trade was +$${best.toFixed(2)} and worst was $${worst.toFixed(2)}.`;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function _generateLessons(result) {
  const lessons = [];
  if (result?.avgHoldTimeWinners && result?.avgHoldTimeLosers) {
    if (result.avgHoldTimeLosers > result.avgHoldTimeWinners * 1.5) {
      lessons.push('You held losers significantly longer than winners — tighten your stop discipline.');
    }
  }
  if (result?.winRate < 40 && result?.rr > 2) {
    lessons.push('Low win rate but high R:R — your edge is in sizing winners, keep letting them run.');
  }
  if (result?.consLoss3 > 0) {
    lessons.push('Consecutive losses detected — consider a mandatory break after 3 losses.');
  }
  if (!lessons.length) {
    lessons.push('Review winning trades for repeatable patterns.');
  }
  return lessons;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function _parseSessionResponse(content) {
  const lines = content.split('\n');
  let headline = '';
  let narrative = '';
  const lessons = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('HEADLINE:')) headline = trimmed.replace('HEADLINE:', '').trim();
    else if (trimmed.startsWith('NARRATIVE:')) narrative = trimmed.replace('NARRATIVE:', '').trim();
    else if (trimmed.startsWith('-') && lessons.length < 3) lessons.push(trimmed.slice(1).trim());
  }

  return { headline, narrative, lessons };
}
