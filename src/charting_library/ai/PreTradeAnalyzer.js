// ═══════════════════════════════════════════════════════════════════
// charEdge — Pre-Trade Analyzer (H2.3 + 6.1.3)
//
// Matches a proposed trade setup against historical trade data to
// provide confidence scores, similar trades, and warnings.
//
// Architecture: structured data in → structured data out.
// 6.1.3: LLM-powered pattern explanation via LLMService.
// ═══════════════════════════════════════════════════════════════════

import { AI_DISCLAIMER } from './AIChartAnalysis.js';

/**
 * 6.1.3: LLM-powered pattern explanation.
 * Sends trade setup context to LLMService for natural language explanation.
 * Falls back to rule-based generateRecommendation() text.
 *
 * @param {Object} setup - { symbol, side, strategy, timeOfDay, emotion }
 * @param {Object} stats - { winRate, avgPnl, sampleSize }
 * @param {number} confidence - 'high' | 'medium' | 'low'
 * @returns {Promise<string>} Natural language explanation
 */
export async function explainPattern(setup, stats, confidence) {
  try {
    // Sprint 65: Route through AIRouter (WebLLM → cloud → template)
    const { aiRouter } = await import('../../ai/AIRouter');

    const prompt = `You are a trading coach. Explain this pattern analysis in 2-3 sentences.
Be specific and actionable.

Setup: ${setup.side || '?'} ${setup.symbol || '?'} using ${setup.strategy || 'unspecified'} strategy
Time: ${setup.timeOfDay || 'unspecified'}  Emotion: ${setup.emotion || 'neutral'}
Historical stats: ${stats.sampleSize} similar trades, ${stats.winRate}% win rate, avg P&L: $${stats.avgPnl}
Confidence: ${confidence}`;

    const result = await aiRouter.route({
      type: 'explain',
      messages: [
        { role: 'system', content: 'You are a data-driven trading coach. Be concise.' },
        { role: 'user', content: prompt },
      ],
      maxTokens: 150,
      temperature: 0.5,
    });

    // If we only got the L1 template, fall back to rule-based
    if (result.tier === 'L1') {
      return generateRecommendation(setup, stats, confidence, []);
    }

    return result.content;
  // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (_) {
    return generateRecommendation(setup, stats, confidence, []);
  }
}

/**
 * Analyze a proposed trade setup against historical performance.
 * @param {Object} setup - { symbol, side, strategy, timeOfDay, emotion }
 * @param {Object[]} trades - All historical trades
 * @param {Object|null} [analyticsResult=null] - Output from computeFast()
 * @returns {Object} Pre-trade analysis result
 */
export function analyzePreTrade(setup, trades, analyticsResult = null) {
  if (!setup || !trades || trades.length === 0) {
    return createEmptyResult('Not enough data to analyze.');
  }

  const { symbol, side, strategy, timeOfDay, emotion } = setup;

  // Score each historical trade for similarity to the proposed setup
  const scored = trades.map((trade, idx) => {
    let similarity = 0;
    let matchDims = 0;

    // Symbol match (weight: 30)
    if (symbol && (trade.symbol || '').toUpperCase() === symbol.toUpperCase()) {
      similarity += 30;
      matchDims++;
    }

    // Side match (weight: 20)
    if (side && (trade.side || '').toLowerCase() === side.toLowerCase()) {
      similarity += 20;
      matchDims++;
    }

    // Strategy match (weight: 25)
    if (strategy && strategy !== 'none' && (trade.strategy || '').toLowerCase() === strategy.toLowerCase()) {
      similarity += 25;
      matchDims++;
    }

    // Time of day match (weight: 15) — within 2 hours
    if (timeOfDay != null && trade.date) {
      const tradeHour = new Date(trade.date).getHours();
      const hourDiff = Math.abs(tradeHour - timeOfDay);
      if (hourDiff <= 1) { similarity += 15; matchDims++; }
      else if (hourDiff <= 2) { similarity += 8; matchDims++; }
    }

    // Emotion match (weight: 10)
    if (emotion && trade.emotion && trade.emotion.toLowerCase() === emotion.toLowerCase()) {
      similarity += 10;
      matchDims++;
    }

    return { trade, similarity, matchDims, idx };
  });

  // Filter to trades with at least some similarity
  const matches = scored
    .filter(s => s.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity);

  const topMatches = matches.slice(0, 5).map(m => ({
    trade: {
      id: m.trade.id,
      symbol: m.trade.symbol,
      side: m.trade.side,
      pnl: m.trade.pnl || 0,
      date: m.trade.date,
      strategy: m.trade.strategy,
      emotion: m.trade.emotion,
    },
    similarity: m.similarity,
  }));

  // Calculate stats from matching trades (threshold: similarity >= 20)
  const relevantTrades = matches.filter(m => m.similarity >= 20).map(m => m.trade);
  const stats = computeMatchStats(relevantTrades);

  // Determine confidence
  const sampleSize = relevantTrades.length;
  const confidence = sampleSize >= 10 ? 'high' : sampleSize >= 5 ? 'medium' : 'low';
  const score = sampleSize >= 5
    ? Math.round(stats.winRate * 0.5 + Math.min(sampleSize, 20) * 2.5)
    : Math.round(Math.min(sampleSize, 5) * 8);

  // Generate warnings
  const warnings = generateWarnings(setup, relevantTrades, analyticsResult);

  // Generate recommendation
  const recommendation = generateRecommendation(setup, stats, confidence, warnings);

  return {
    confidence,
    score: clamp(score, 0, 100),
    historicalMatches: topMatches,
    stats,
    warnings,
    recommendation,
    disclaimer: AI_DISCLAIMER,
  };
}

// ─── Stats Computation ───────────────────────────────────────────

function computeMatchStats(trades) {
  if (trades.length === 0) {
    return { winRate: 0, avgPnl: 0, avgR: 0, sampleSize: 0 };
  }

  const wins = trades.filter(t => (t.pnl || 0) > 0);
  const pnls = trades.map(t => t.pnl || 0);
  const totalPnl = pnls.reduce((a, b) => a + b, 0);
  const avgPnl = totalPnl / trades.length;

  // Compute average R-multiple if available
  const rMultiples = trades.filter(t => t.rMultiple != null).map(t => t.rMultiple);
  const avgR = rMultiples.length > 0
    ? rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length
    : 0;

  return {
    winRate: Math.round((wins.length / trades.length) * 100),
    avgPnl: Math.round(avgPnl * 100) / 100,
    avgR: Math.round(avgR * 100) / 100,
    sampleSize: trades.length,
  };
}

// ─── Warning Generator ──────────────────────────────────────────

function generateWarnings(setup, relevantTrades, analytics) {
  const warnings = [];

  if (relevantTrades.length < 3) {
    warnings.push('Limited historical data for this setup — trade with caution.');
    return warnings;
  }

  const wr = Math.round(
    (relevantTrades.filter(t => (t.pnl || 0) > 0).length / relevantTrades.length) * 100
  );

  if (wr < 40) {
    warnings.push(`Win rate for similar setups is only ${wr}%. Consider passing on this trade.`);
  }

  // Check recent performance for this setup
  const recentSimilar = relevantTrades
    .filter(t => t.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  const recentLosses = recentSimilar.filter(t => (t.pnl || 0) < 0).length;
  if (recentLosses >= 4) {
    warnings.push(`Your last ${recentLosses} similar trades were all losers. The setup may have deteriorated.`);
  }

  // Time-based warnings
  if (setup.timeOfDay != null) {
    if (setup.timeOfDay >= 15) warnings.push('Late-day trading tends to have wider spreads and less follow-through.');
    if (setup.timeOfDay < 10 && setup.timeOfDay >= 9) warnings.push('First hour of market is volatile — ensure tight risk management.');
  }

  // Emotion-based warnings
  if (setup.emotion) {
    const emotionLower = setup.emotion.toLowerCase();
    if (['frustrated', 'angry', 'anxious', 'fearful', 'revenge'].includes(emotionLower)) {
      warnings.push(`You're feeling "${setup.emotion}" — negative emotions correlate with worse outcomes. Consider sitting this one out.`);
    }
  }

  // Analytics-based warnings
  if (analytics?.streakImpact) {
    const si = analytics.streakImpact;
    if (si.streakSensitivity > 0.3) {
      warnings.push('Your recent performance is heavily streak-dependent. Be extra careful if you\'re on a losing streak.');
    }
  }

  return warnings;
}

// ─── Recommendation Generator ────────────────────────────────────

function generateRecommendation(setup, stats, confidence, warnings) {
  if (stats.sampleSize === 0) {
    return 'No historical data for this exact setup. Paper trade it first or use minimal size.';
  }

  if (confidence === 'low') {
    return `Limited data (${stats.sampleSize} trades). Consider starting with reduced position size.`;
  }

  if (stats.winRate >= 60 && warnings.length === 0) {
    return `Historically strong setup: ${stats.winRate}% WR across ${stats.sampleSize} trades. Trade your plan with normal size.`;
  }

  if (stats.winRate >= 50 && warnings.length <= 1) {
    return `Decent setup: ${stats.winRate}% WR from ${stats.sampleSize} trades. Proceed with standard risk management.`;
  }

  if (stats.winRate < 40) {
    return `Weak setup historically (${stats.winRate}% WR). Consider passing or reducing size significantly.`;
  }

  if (warnings.length >= 2) {
    return `Multiple caution flags. Historical WR: ${stats.winRate}%. If you take this, reduce size and tighten stops.`;
  }

  return `${stats.winRate}% WR from ${stats.sampleSize} similar trades. Manage risk appropriately.`;
}

// ─── Helpers ─────────────────────────────────────────────────────

function createEmptyResult(message) {
  return {
    confidence: 'low',
    score: 0,
    historicalMatches: [],
    stats: { winRate: 0, avgPnl: 0, avgR: 0, sampleSize: 0 },
    warnings: [message],
    recommendation: message,
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
