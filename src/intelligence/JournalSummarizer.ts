// ═══════════════════════════════════════════════════════════════════
// charEdge — Journal Summarizer (P1-B #10)
// Produces actionable summaries from journal entries using LLM.
// Falls back to rule-based summaries when LLM is unavailable.
// ═══════════════════════════════════════════════════════════════════

import { llmService } from './LLMService.js';

/**
 * @typedef {Object} JournalSummary
 * @property {string} narrative   - Natural-language summary
 * @property {string[]} keyInsights - Top 3 actionable takeaways
 * @property {string[]} patterns  - Detected behavioral patterns
 * @property {number} tradeCount
 * @property {number} pnl
 */

/**
 * Summarize a batch of journal entries into actionable insights.
 * Uses LLM when available, falls back to rule-based extraction.
 *
 * @param {Object[]} journalEntries - Array of journal entries with { date, notes, emotion, trades }
 * @param {'day' | 'week' | 'month'} period - Summary period
 * @returns {Promise<JournalSummary>}
 */
export async function summarizeJournal(journalEntries, period = 'day') {
  if (!journalEntries?.length) {
    return {
      narrative: 'No journal entries to summarize.',
      keyInsights: [],
      patterns: [],
      tradeCount: 0,
      pnl: 0,
    };
  }

  const tradeCount = journalEntries.reduce((s, e) => s + (e.trades?.length || 0), 0);
  const pnl = journalEntries.reduce(
    (s, e) => s + (e.trades || []).reduce((ts, t) => ts + (t.pnl || 0), 0),
    0,
  );

  // ─── Try LLM Path ─────────────────────────────────────────────
  if (llmService.isAvailable()) {
    try {
      const prompt = _buildJournalPrompt(journalEntries, period, tradeCount, pnl);
      const response = await llmService._chat([
        { role: 'system', content: 'You are a trading coach reviewing journal entries. Be direct and actionable. Format: 1 paragraph narrative, then 3 bullet key insights, then any patterns spotted.' },
        { role: 'user', content: prompt },
      ]);

      const { narrative, insights, patterns } = _parseLLMResponse(response.content);
      return { narrative, keyInsights: insights, patterns, tradeCount, pnl };
    } catch {
      // Fall through to rule-based
    }
  }

  // ─── Rule-Based Fallback ───────────────────────────────────────
  return _ruleBased(journalEntries, period, tradeCount, pnl);
}

function _buildJournalPrompt(entries, period, tradeCount, pnl) {
  const notes = entries
    .filter((e) => e.notes)
    .map((e) => `[${e.date}] ${e.emotion || ''}: ${e.notes}`)
    .join('\n');

  return `Summarize this trader's ${period} journal (${tradeCount} trades, $${pnl.toFixed(2)} P&L):\n\n${notes}`;
}

function _parseLLMResponse(content) {
  const lines = content.split('\n').filter((l) => l.trim());
  const insights = [];
  const patterns = [];
  let narrative = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.match(/^\d\./)) {
      const text = trimmed.replace(/^[-•\d.]\s*/, '');
      if (text.toLowerCase().includes('pattern') || text.toLowerCase().includes('tend to')) {
        patterns.push(text);
      } else {
        insights.push(text);
      }
    } else if (!narrative) {
      narrative = trimmed;
    } else {
      narrative += ' ' + trimmed;
    }
  }

  return {
    narrative: narrative || content.slice(0, 300),
    insights: insights.slice(0, 3),
    patterns: patterns.slice(0, 5),
  };
}

function _ruleBased(entries, period, tradeCount, pnl) {
  const emotions = entries.filter((e) => e.emotion).map((e) => e.emotion);
  const emotionCounts = {};
  for (const em of emotions) {
    emotionCounts[em] = (emotionCounts[em] || 0) + 1;
  }
  const topEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

  const winCount = entries.reduce(
    (s, e) => s + (e.trades || []).filter((t) => t.pnl > 0).length,
    0,
  );
  const winRate = tradeCount > 0 ? ((winCount / tradeCount) * 100).toFixed(0) : '0';

  const narrative = `This ${period} you took ${tradeCount} trades with a ${winRate}% win rate ($${pnl.toFixed(2)} net P&L). Your dominant emotional state was "${topEmotion}".`;

  const insights = [];
  if (pnl > 0) insights.push('Profitable session — review winners for repeatable setups.');
  if (pnl < 0) insights.push('Net loss — check if any single trade drove most of the damage.');
  if (parseInt(winRate) > 60) insights.push('High win rate — verify risk:reward isn\'t being sacrificed.');
  if (parseInt(winRate) < 40) insights.push('Low win rate — check if entries align with your playbook.');

  const patterns = [];
  if (topEmotion === 'anxious' || topEmotion === 'fearful') {
    patterns.push('Anxiety noted — may correlate with early exits or missed entries.');
  }
  if (topEmotion === 'confident' || topEmotion === 'greedy') {
    patterns.push('Overconfidence detected — watch for oversizing or ignoring stops.');
  }

  return { narrative, keyInsights: insights, patterns, tradeCount, pnl };
}
