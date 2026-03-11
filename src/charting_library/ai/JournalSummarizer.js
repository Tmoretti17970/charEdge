// ═══════════════════════════════════════════════════════════════════
// charEdge — Journal Summarizer (H2.3 + 6.1.2)
//
// Weekly auto-summary of trading activity. Produces a human-readable
// narrative from trade data, notes, and analytics.
//
// Architecture: structured data in → structured data out.
// 6.1.2: LLM-powered narrative via LLMService (falls back to template).
// ═══════════════════════════════════════════════════════════════════

import { AI_DISCLAIMER } from './AIChartAnalysis.js';

/**
 * 6.1.2: LLM-powered weekly summary.
 * Sends structured trade data to LLMService for richer narrative.
 * Falls back to template-based summarizeWeek() if LLM unavailable.
 *
 * @param {Object[]} trades
 * @param {Object[]} [notes=[]]
 * @param {Object|null} [analyticsResult=null]
 * @returns {Promise<Object>} Weekly summary with LLM narrative
 */
export async function summarizeWeekWithLLM(trades, notes = [], analyticsResult = null) {
  // Always compute structured data first
  const base = summarizeWeek(trades, notes, analyticsResult);
  if (base.tradeCount === 0) return base;

  try {
    const { llmService } = await import('./LLMService.ts');
    if (!llmService.hasExternalProvider()) return base;

    const prompt = `You are a trading coach reviewing a trader's weekly performance.
Summarize this week concisely (3-5 sentences). Be encouraging but honest about areas to improve.

Data:
- Trades: ${base.tradeCount}, Win Rate: ${base.winRate}%, Net P&L: $${base.netPnl}
- Top symbols: ${base.topSymbols.map(s => `${s.symbol} ($${s.pnl}, ${s.count} trades)`).join(', ')}
- Best emotion: ${base.emotionBreakdown.best?.emotion || 'N/A'} ($${base.emotionBreakdown.best?.pnl || 0})
- Worst emotion: ${base.emotionBreakdown.worst?.emotion || 'N/A'} ($${base.emotionBreakdown.worst?.pnl || 0})
- Key moments: ${base.keyMoments.map(m => m.description).join('; ')}`;

    const response = await llmService.complete(prompt, {
      maxTokens: 256,
      temperature: 0.6,
      systemPrompt: 'You are a supportive trading coach. Keep responses concise and actionable.',
    });

    return { ...base, narrative: response.text, narrativeSource: response.provider };
  // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (_) {
    // LLM unavailable — return template-based summary
    return base;
  }
}

/**
 * Summarize a week of trading activity.
 * @param {Object[]} trades - All trades
 * @param {Object[]} [notes=[]] - Journal notes
 * @param {Object|null} [analyticsResult=null] - Output from computeFast()
 * @returns {Object} Weekly summary
 */
export function summarizeWeek(trades, notes = [], _analyticsResult = null) {
  if (!trades || trades.length === 0) {
    return createEmptySummary();
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekTrades = trades.filter(t => t.date && new Date(t.date) >= weekAgo);

  if (weekTrades.length === 0) {
    return createEmptySummary();
  }

  const netPnl = weekTrades.reduce((s, t) => s + (t.pnl || 0), 0);
  const wr = computeWinRate(weekTrades);
  const topSymbols = computeTopSymbols(weekTrades);
  const emotionBreakdown = computeEmotionBreakdown(weekTrades);
  const keyMoments = computeKeyMoments(weekTrades);

  // Filter notes for the current week
  const weekNotes = (notes || []).filter(n => n.date && new Date(n.date) >= weekAgo);

  const narrative = buildNarrative(weekTrades, netPnl, wr, topSymbols, emotionBreakdown, keyMoments);

  return {
    weekOf: weekAgo.toISOString().slice(0, 10),
    tradeCount: weekTrades.length,
    netPnl: Math.round(netPnl * 100) / 100,
    winRate: wr,
    topSymbols,
    emotionBreakdown,
    narrative,
    keyMoments,
    noteCount: weekNotes.length,
    disclaimer: AI_DISCLAIMER,
  };
}

// ─── Top Symbols ─────────────────────────────────────────────────

function computeTopSymbols(trades) {
  const bySymbol = {};
  for (const t of trades) {
    const sym = (t.symbol || 'Unknown').toUpperCase();
    if (!bySymbol[sym]) bySymbol[sym] = { symbol: sym, pnl: 0, count: 0 };
    bySymbol[sym].pnl += (t.pnl || 0);
    bySymbol[sym].count++;
  }

  return Object.values(bySymbol)
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
    .slice(0, 5)
    .map(s => ({
      symbol: s.symbol,
      pnl: Math.round(s.pnl * 100) / 100,
      count: s.count,
    }));
}

// ─── Emotion Breakdown ───────────────────────────────────────────

function computeEmotionBreakdown(trades) {
  const byEmotion = {};
  for (const t of trades) {
    if (!t.emotion) continue;
    const e = t.emotion.toLowerCase();
    if (!byEmotion[e]) byEmotion[e] = { emotion: e, pnl: 0, count: 0 };
    byEmotion[e].pnl += (t.pnl || 0);
    byEmotion[e].count++;
  }

  const entries = Object.values(byEmotion);
  if (entries.length === 0) return { best: null, worst: null };

  entries.sort((a, b) => b.pnl - a.pnl);
  return {
    best: entries[0] ? { emotion: entries[0].emotion, pnl: entries[0].pnl, count: entries[0].count } : null,
    worst: entries.length > 1 ? { emotion: entries[entries.length - 1].emotion, pnl: entries[entries.length - 1].pnl, count: entries[entries.length - 1].count } : null,
  };
}

// ─── Key Moments ─────────────────────────────────────────────────

function computeKeyMoments(trades) {
  return [...trades]
    .sort((a, b) => Math.abs(b.pnl || 0) - Math.abs(a.pnl || 0))
    .slice(0, 3)
    .map(t => ({
      date: t.date,
      description: `${(t.pnl || 0) > 0 ? 'Win' : 'Loss'} on ${(t.symbol || 'Unknown').toUpperCase()} (${(t.side || '?').toLowerCase()})`,
      pnl: Math.round((t.pnl || 0) * 100) / 100,
    }));
}

// ─── Narrative Builder ───────────────────────────────────────────

function buildNarrative(trades, netPnl, wr, topSymbols, emotionBreakdown, _keyMoments) {
  const parts = [];

  // Opening sentence
  const pnlStr = fmtUSD(netPnl);
  parts.push(
    `This week you took ${trades.length} trade${trades.length !== 1 ? 's' : ''} ` +
    `with a ${wr}% win rate, netting ${pnlStr}.`
  );

  // Best performer
  if (topSymbols.length > 0) {
    const best = topSymbols[0];
    if (best.pnl > 0) {
      parts.push(`Your best performer was ${best.symbol} (${fmtUSD(best.pnl)} from ${best.count} trade${best.count !== 1 ? 's' : ''}).`);
    } else {
      parts.push(`Your most active symbol was ${best.symbol} (${best.count} trade${best.count !== 1 ? 's' : ''}, ${fmtUSD(best.pnl)}).`);
    }
  }

  // Warning about worst area
  if (topSymbols.length > 1) {
    const worst = topSymbols.filter(s => s.pnl < 0).sort((a, b) => a.pnl - b.pnl)[0];
    if (worst) {
      parts.push(`Watch ${worst.symbol} — you lost ${fmtUSD(Math.abs(worst.pnl))} there.`);
    }
  }

  // Emotion comment
  if (emotionBreakdown.best && emotionBreakdown.worst && emotionBreakdown.best.emotion !== emotionBreakdown.worst.emotion) {
    parts.push(
      `You traded best when feeling "${emotionBreakdown.best.emotion}" (${fmtUSD(emotionBreakdown.best.pnl)}) ` +
      `and worst when "${emotionBreakdown.worst.emotion}" (${fmtUSD(emotionBreakdown.worst.pnl)}).`
    );
  }

  return parts.join(' ');
}

// ─── Helpers ─────────────────────────────────────────────────────

function computeWinRate(trades) {
  if (!trades.length) return 0;
  return Math.round((trades.filter(t => (t.pnl || 0) > 0).length / trades.length) * 100);
}

function fmtUSD(n) {
  return (n >= 0 ? '+' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function createEmptySummary() {
  return {
    weekOf: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    tradeCount: 0,
    netPnl: 0,
    winRate: 0,
    topSymbols: [],
    emotionBreakdown: { best: null, worst: null },
    narrative: 'No trades this week. Take some time to review your strategy and come back refreshed.',
    keyMoments: [],
    noteCount: 0,
  };
}
