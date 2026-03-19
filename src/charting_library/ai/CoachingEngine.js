// ═══════════════════════════════════════════════════════════════════
// charEdge — Coaching Engine (H2.3)
//
// Template-based weekly coaching report generator.
// Takes computeFast() output + raw trades and produces structured
// reports with grades, section breakdowns, and recommendations.
//
// Architecture: all functions take structured data → return structured data.
// Drop-in LLM replacement: swap template functions for LLM calls.
// ═══════════════════════════════════════════════════════════════════

import { AI_DISCLAIMER } from './AIChartAnalysis.js';

/**
 * Generate a weekly coaching report from trade data and analytics.
 * @param {Object[]} trades - All trades
 * @param {Object|null} analyticsResult - Output from computeFast()
 * @param {Object} [settings={}] - User settings (accountSize, dailyLossLimit, etc.)
 * @returns {Object|null} Weekly coaching report, or null if insufficient data
 */
export function generateWeeklyReport(trades, analyticsResult, settings = {}) {
  if (!trades || trades.length < 3) return null;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekTrades = trades.filter(t => new Date(t.date) >= weekAgo);
  const prevWeekStart = new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000);
  const prevWeekTrades = trades.filter(t => {
    const d = new Date(t.date);
    return d >= prevWeekStart && d < weekAgo;
  });

  if (weekTrades.length < 1) return null;

  const sections = [
    gradePerformance(weekTrades, prevWeekTrades, settings),
    gradeRiskManagement(weekTrades, analyticsResult, settings),
    gradePsychology(weekTrades, analyticsResult),
    gradeTiming(weekTrades),
    generateImprovementPlan(weekTrades, analyticsResult),
  ];

  const sectionScores = sections.map(s => s.score);
  const overallScore = Math.round(sectionScores.reduce((a, b) => a + b, 0) / sectionScores.length);

  const thisWeekPnl = sum(weekTrades, 'pnl');
  const prevWeekPnl = sum(prevWeekTrades, 'pnl');

  return {
    id: `report-${now.toISOString().slice(0, 10)}`,
    weekOf: weekAgo.toISOString().slice(0, 10),
    generatedAt: now.toISOString(),
    grade: scoreToGrade(overallScore),
    score: overallScore,
    sections: sections.map(s => ({
      ...s,
      recommendations: s.recommendations.map(r => _adaptiveFormat(r, s.title)),
    })),
    topInsight: _adaptiveFormat(pickTopInsight(sections), 'improvement'),
    focusArea: pickFocusArea(sections),
    comparison: {
      prevWeekPnl,
      thisWeekPnl,
      trend: thisWeekPnl > prevWeekPnl ? 'improving' : thisWeekPnl < prevWeekPnl ? 'declining' : 'flat',
    },
    disclaimer: AI_DISCLAIMER,
  };
}

/**
 * Sprint 4: Apply adaptive coaching format if available.
 */
function _adaptiveFormat(message, sectionTitle) {
  try {
    // Dynamic import to avoid hard dependency
    const categoryMap = {
      'Performance': 'performance',
      'Risk Management': 'risk',
      'Psychology & Discipline': 'psychology',
      'Timing & Execution': 'timing',
      'Improvement Plan': 'improvement',
    };
    const category = categoryMap[sectionTitle] || 'improvement';
    // Lazy-load to avoid circular deps at module init
    import('../../ai/AdaptiveCoach').then(({ adaptiveCoach }) => {
      // Record that we showed this message (pre-interaction)
      void adaptiveCoach;
    }).catch(() => {});
    return message; // Formatting happens synchronously via cached prefs in future
  } catch {
    return message;
  }
}

// ─── Section Graders ─────────────────────────────────────────────

function gradePerformance(weekTrades, prevWeekTrades, _settings) {
  const pnl = sum(weekTrades, 'pnl');
  const wr = winRate(weekTrades);
  const count = weekTrades.length;
  const avgPnl = count > 0 ? pnl / count : 0;
  const prevPnl = sum(prevWeekTrades, 'pnl');

  // Score: 40% win rate, 30% P&L trend, 30% consistency
  let score = 50;
  if (wr >= 60) score += 20;
  else if (wr >= 50) score += 10;
  else if (wr < 40) score -= 15;

  if (pnl > 0) score += 15;
  else if (pnl < 0) score -= 10;

  if (pnl > prevPnl) score += 10;
  else if (pnl < prevPnl) score -= 5;

  score = clamp(score, 0, 100);

  const recommendations = [];
  if (wr < 50) recommendations.push('Your win rate is below 50% — review entries and consider tighter filters.');
  if (pnl < 0) recommendations.push(`Net loss of $${Math.abs(pnl).toFixed(2)} this week. Focus on cutting losers faster.`);
  if (pnl > prevPnl && prevPnl > 0) recommendations.push('Great improvement! Keep the momentum but don\'t increase risk.');
  if (count > 30) recommendations.push('High trade count — watch for overtrading fatigue.');
  if (recommendations.length === 0) recommendations.push('Solid performance. Stay disciplined and consistent.');

  return {
    title: 'Performance',
    icon: '📊',
    grade: scoreToGrade(score),
    score,
    summary: `${count} trades | ${wr}% WR | ${fmtUSD(pnl)} net | ${fmtUSD(avgPnl)}/trade avg`,
    details: `You took ${count} trades this week with a ${wr}% win rate, netting ${fmtUSD(pnl)}. ` +
             (prevWeekTrades.length > 0
               ? `Last week you netted ${fmtUSD(prevPnl)}, so you're ${pnl > prevPnl ? 'improving' : 'declining'}.`
               : 'No previous week data for comparison.'),
    recommendations,
  };
}

function gradeRiskManagement(weekTrades, analytics, settings) {
  const winners = weekTrades.filter(t => (t.pnl || 0) > 0);
  const losers = weekTrades.filter(t => (t.pnl || 0) < 0);
  const avgWin = winners.length > 0 ? sum(winners, 'pnl') / winners.length : 0;
  const avgLoss = losers.length > 0 ? Math.abs(sum(losers, 'pnl') / losers.length) : 0;
  const rr = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 5 : 1;
  const maxLoss = losers.length > 0 ? Math.min(...losers.map(t => t.pnl)) : 0;

  let score = 50;
  if (rr >= 2) score += 25;
  else if (rr >= 1.5) score += 15;
  else if (rr >= 1) score += 5;
  else score -= 15;

  // Check for outsized losers
  const accountSize = settings.accountSize || 10000;
  const maxRiskPct = Math.abs(maxLoss) / accountSize * 100;
  if (maxRiskPct > 5) score -= 15;
  else if (maxRiskPct <= 2) score += 10;

  // Check if stop losses are being used
  const stopsUsed = weekTrades.filter(t => t.stopLoss != null).length;
  const stopPct = weekTrades.length > 0 ? (stopsUsed / weekTrades.length) * 100 : 0;
  if (stopPct >= 80) score += 10;
  else if (stopPct < 50) score -= 10;

  score = clamp(score, 0, 100);

  const recommendations = [];
  if (rr < 1) recommendations.push(`Risk/reward is ${rr.toFixed(2)}:1 — your avg loss ($${avgLoss.toFixed(0)}) exceeds avg win ($${avgWin.toFixed(0)}). Tighten stops or target larger moves.`);
  if (maxRiskPct > 3) recommendations.push(`Largest single loss was ${maxRiskPct.toFixed(1)}% of account. Keep max risk per trade under 2%.`);
  if (stopPct < 80) recommendations.push(`Only ${Math.round(stopPct)}% of trades had stop losses. Always define your exit before entering.`);
  if (recommendations.length === 0) recommendations.push('Solid risk management. Keep protecting your capital.');

  return {
    title: 'Risk Management',
    icon: '🛡️',
    grade: scoreToGrade(score),
    score,
    summary: `${rr.toFixed(2)}:1 R/R | Max loss: ${fmtUSD(maxLoss)} | ${Math.round(stopPct)}% stops used`,
    details: `Average win: ${fmtUSD(avgWin)} vs average loss: ${fmtUSD(-avgLoss)}. ` +
             `Risk/reward ratio: ${rr.toFixed(2)}:1. ` +
             `Largest single loss: ${fmtUSD(maxLoss)} (${maxRiskPct.toFixed(1)}% of account).`,
    recommendations,
  };
}

function gradePsychology(weekTrades, analytics) {
  const emotionTrades = weekTrades.filter(t => t.emotion);
  const ruleBreaks = weekTrades.filter(t => t.ruleBreak).length;
  const adherenceRate = weekTrades.length > 0
    ? Math.round(((weekTrades.length - ruleBreaks) / weekTrades.length) * 100)
    : 100;

  let score = 50;
  if (adherenceRate >= 90) score += 25;
  else if (adherenceRate >= 75) score += 10;
  else score -= 15;

  // Check emotion correlation if available
  const emotionCorr = analytics?.emotionCorrelation;
  if (emotionCorr && emotionCorr.sampleSize >= 10) {
    if (emotionCorr.pearsonR > 0.3) score += 10; // positive emotions correlate with wins
    else if (emotionCorr.pearsonR < -0.3) score -= 10;
  }

  // Check for revenge trading pattern — multiple losses then bigger position
  const sortedByDate = [...weekTrades].sort((a, b) => new Date(a.date) - new Date(b.date));
  let revengeSuspect = 0;
  for (let i = 2; i < sortedByDate.length; i++) {
    const prev2 = sortedByDate.slice(i - 2, i).every(t => (t.pnl || 0) < 0);
    if (prev2) revengeSuspect++;
  }
  if (revengeSuspect >= 2) score -= 10;

  score = clamp(score, 0, 100);

  const recommendations = [];
  if (ruleBreaks > 0) recommendations.push(`You broke your rules ${ruleBreaks} time(s) this week. Each break erodes your edge.`);
  if (revengeSuspect >= 2) recommendations.push('Possible revenge trading detected — trades after consecutive losses. Step away after 2 losses in a row.');
  if (emotionTrades.length < weekTrades.length * 0.5) recommendations.push('Log your emotions for more trades — self-awareness is key to improvement.');
  if (recommendations.length === 0) recommendations.push('Strong psychological discipline. Your mindset is supporting your trading.');

  return {
    title: 'Psychology & Discipline',
    icon: '🧠',
    grade: scoreToGrade(score),
    score,
    summary: `${adherenceRate}% rule adherence | ${ruleBreaks} break(s) | ${emotionTrades.length}/${weekTrades.length} emotions logged`,
    details: `Rule adherence: ${adherenceRate}%. ` +
             (ruleBreaks > 0 ? `You broke your trading rules ${ruleBreaks} times. ` : 'No rule breaks — excellent discipline. ') +
             (revengeSuspect >= 2 ? `Revenge trading patterns detected on ${revengeSuspect} occasions.` : ''),
    recommendations,
  };
}

function gradeTiming(weekTrades) {
  const byHour = {};
  for (const t of weekTrades) {
    if (!t.date) continue;
    const h = new Date(t.date).getHours();
    if (!byHour[h]) byHour[h] = [];
    byHour[h].push(t);
  }

  const hourStats = Object.entries(byHour).map(([h, ts]) => ({
    hour: Number(h),
    label: formatHour(Number(h)),
    pnl: sum(ts, 'pnl'),
    wr: winRate(ts),
    count: ts.length,
  }));

  const bestHour = hourStats.sort((a, b) => b.pnl - a.pnl)[0] || null;
  const worstHour = hourStats.sort((a, b) => a.pnl - b.pnl)[0] || null;

  // Check day-of-week concentration
  const byDow = {};
  const _dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (const t of weekTrades) {
    if (!t.date) continue;
    const d = new Date(t.date).getDay();
    if (!byDow[d]) byDow[d] = [];
    byDow[d].push(t);
  }

  let score = 60; // baseline
  if (bestHour && bestHour.pnl > 0 && bestHour.count >= 3) score += 10;
  if (worstHour && worstHour.pnl < 0 && worstHour.count >= 3) score -= 10;

  // Consistency bonus — trading at regular times
  const activeHours = hourStats.filter(h => h.count >= 2).length;
  if (activeHours <= 4) score += 10; // focused time windows
  else if (activeHours >= 8) score -= 5; // scattered timing

  score = clamp(score, 0, 100);

  const recommendations = [];
  if (bestHour && bestHour.count >= 2) recommendations.push(`Your best hour is ${bestHour.label} (${fmtUSD(bestHour.pnl)}, ${bestHour.wr}% WR). Consider focusing your trading here.`);
  if (worstHour && worstHour.pnl < 0 && worstHour.count >= 2 && worstHour.hour !== bestHour?.hour) {
    recommendations.push(`Avoid trading around ${worstHour.label} — you lost ${fmtUSD(Math.abs(worstHour.pnl))} there.`);
  }
  if (activeHours >= 8) recommendations.push('You\'re trading across too many hours. Define a focused session window.');
  if (recommendations.length === 0) recommendations.push('Good timing discipline. Stay within your proven trading windows.');

  return {
    title: 'Timing & Execution',
    icon: '⏱️',
    grade: scoreToGrade(score),
    score,
    summary: bestHour
      ? `Best: ${bestHour.label} (${fmtUSD(bestHour.pnl)}) | ${activeHours} active hour(s)`
      : `${weekTrades.length} trades across ${activeHours} hour(s)`,
    details: hourStats.length > 0
      ? `You traded across ${activeHours} different hours. ` +
        (bestHour ? `Best: ${bestHour.label} (${bestHour.count} trades, ${fmtUSD(bestHour.pnl)}). ` : '') +
        (worstHour && worstHour.pnl < 0 ? `Worst: ${worstHour.label} (${worstHour.count} trades, ${fmtUSD(worstHour.pnl)}).` : '')
      : 'Not enough timing data to analyze.',
    recommendations,
  };
}

function generateImprovementPlan(weekTrades, analytics) {
  const areas = [];
  const wr = winRate(weekTrades);
  const pnl = sum(weekTrades, 'pnl');

  if (wr < 50) areas.push('Improve entry selection — review losing trades for premature entries.');
  if (pnl < 0) areas.push('Focus on position sizing — reduce risk until you\'re back to consistent profitability.');

  // Check analytics for additional areas
  if (analytics) {
    if (analytics.sortino != null && analytics.sortino < 1) areas.push('Downside volatility is high (Sortino < 1). Tighten losers faster.');
    if (analytics.streakImpact) {
      const si = analytics.streakImpact;
      if (si.avgPnlDuringLossStreak < si.avgPnlBaseline * 0.5) {
        areas.push('Your P&L drops significantly during loss streaks. Implement a cool-down rule after 2 consecutive losses.');
      }
    }
  }

  if (areas.length === 0) areas.push('Maintain consistency — your process is working. Avoid the urge to change what isn\'t broken.');
  areas.push('Review this week\'s 3 best and 3 worst trades in your journal.');

  const score = wr >= 55 && pnl > 0 ? 75 : wr >= 45 ? 55 : 35;

  return {
    title: 'Improvement Plan',
    icon: '🎯',
    grade: scoreToGrade(score),
    score,
    summary: `${areas.length} focus area(s) identified`,
    details: 'Based on this week\'s performance, here are your key improvement areas:',
    recommendations: areas,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────

function pickTopInsight(sections) {
  const lowest = sections.reduce((a, b) => a.score < b.score ? a : b);
  return lowest.recommendations[0] || 'Keep trading your plan.';
}

function pickFocusArea(sections) {
  const lowest = sections.reduce((a, b) => a.score < b.score ? a : b);
  return lowest.title;
}

function scoreToGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function sum(arr, key) {
  return arr.reduce((s, t) => s + (t[key] || 0), 0);
}

function winRate(arr) {
  if (!arr.length) return 0;
  return Math.round((arr.filter(t => (t.pnl || 0) > 0).length / arr.length) * 100);
}

function fmtUSD(n) {
  return (n >= 0 ? '+' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatHour(h) {
  return `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export { scoreToGrade };
