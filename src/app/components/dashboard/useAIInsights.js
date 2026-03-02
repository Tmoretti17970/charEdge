// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Insight Engine (Sprint 2)
//
// Rule-based insight generator that analyzes trade history and
// surfaces high-confidence, actionable coaching cards.
//
// Uses template matching — NOT LLMs — to ensure insights are fast,
// deterministic, and always correct. Each rule has a confidence
// threshold; only high-confidence insights are surfaced.
// ═══════════════════════════════════════════════════════════════════

/**
 * Analyze trades and generate a prioritized list of insights.
 * @param {Array} trades - All trades from the trade store
 * @param {Object} settings - User settings (dailyLossLimit, accountSize, etc.)
 * @returns {Array<{id: string, type: string, icon: string, title: string, body: string, priority: number, color: string}>}
 */
export function generateInsights(trades, settings = {}) {
  if (!trades || trades.length < 3) return [];

  const insights = [];
  const now = new Date();
  const today = startOfDay(now);

  // Group trades by various dimensions
  const byDay = groupBy(trades, (t) => startOfDay(t.date).toISOString().slice(0, 10));
  const byDow = groupBy(trades, (t) => new Date(t.date).getDay());
  const byHour = groupBy(trades, (t) => new Date(t.date).getHours());
  const bySymbol = groupBy(trades, (t) => (t.symbol || '').toUpperCase());
  const bySide = groupBy(trades, (t) => (t.side || '').toLowerCase());
  const byStrategy = groupBy(trades, (t) => (t.strategy || 'none').toLowerCase());

  // ─── Rule 1: Best Day of Week ───────────────────────────────
  const dowNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dowStats = Object.entries(byDow).map(([dow, ts]) => ({
    dow: Number(dow),
    name: dowNames[Number(dow)],
    pnl: sum(ts, 'pnl'),
    winRate: winRate(ts),
    count: ts.length,
  })).filter((d) => d.count >= 3);

  const bestDow = dowStats.sort((a, b) => b.pnl - a.pnl)[0];
  const worstDow = dowStats.sort((a, b) => a.pnl - b.pnl)[0];

  if (bestDow && bestDow.pnl > 0 && bestDow.count >= 5) {
    insights.push({
      id: 'best-dow',
      type: 'pattern',
      icon: '📅',
      title: `${bestDow.name}s are your best day`,
      body: `You've made ${fmtUSD(bestDow.pnl)} across ${bestDow.count} trades on ${bestDow.name}s with a ${bestDow.winRate}% win rate.`,
      priority: 7,
      color: 'green',
    });
  }

  if (worstDow && worstDow.pnl < 0 && worstDow.count >= 5 && worstDow.dow !== bestDow?.dow) {
    insights.push({
      id: 'worst-dow',
      type: 'warning',
      icon: '⚠️',
      title: `Careful on ${worstDow.name}s`,
      body: `You've lost ${fmtUSD(Math.abs(worstDow.pnl))} across ${worstDow.count} ${worstDow.name} trades (${worstDow.winRate}% WR). Consider reducing size or sitting out.`,
      priority: 8,
      color: 'yellow',
    });
  }

  // ─── Rule 2: Best Time of Day ──────────────────────────────
  const hourStats = Object.entries(byHour).map(([h, ts]) => ({
    hour: Number(h),
    label: `${Number(h) % 12 || 12}${Number(h) < 12 ? 'am' : 'pm'}`,
    pnl: sum(ts, 'pnl'),
    winRate: winRate(ts),
    count: ts.length,
  })).filter((h) => h.count >= 3);

  const bestHour = hourStats.sort((a, b) => b.pnl - a.pnl)[0];
  const worstHour = hourStats.sort((a, b) => a.pnl - b.pnl)[0];

  if (bestHour && bestHour.pnl > 0 && bestHour.count >= 5) {
    insights.push({
      id: 'best-hour',
      type: 'pattern',
      icon: '🕐',
      title: `Your power hour: ${bestHour.label}`,
      body: `${bestHour.count} trades near ${bestHour.label} generated ${fmtUSD(bestHour.pnl)} total. This is when you trade best.`,
      priority: 6,
      color: 'green',
    });
  }

  if (worstHour && worstHour.pnl < -50 && worstHour.count >= 5) {
    insights.push({
      id: 'worst-hour',
      type: 'warning',
      icon: '⏰',
      title: `Avoid trading at ${worstHour.label}`,
      body: `You've lost ${fmtUSD(Math.abs(worstHour.pnl))} in ${worstHour.count} trades around ${worstHour.label}. Consider a session cutoff.`,
      priority: 8,
      color: 'red',
    });
  }

  // ─── Rule 3: Best / Worst Symbol ───────────────────────────
  const symbolStats = Object.entries(bySymbol).map(([sym, ts]) => ({
    symbol: sym,
    pnl: sum(ts, 'pnl'),
    winRate: winRate(ts),
    count: ts.length,
    avgPnl: sum(ts, 'pnl') / ts.length,
  })).filter((s) => s.count >= 3);

  const bestSym = symbolStats.sort((a, b) => b.pnl - a.pnl)[0];
  const worstSym = symbolStats.sort((a, b) => a.pnl - b.pnl)[0];

  if (bestSym && bestSym.pnl > 0) {
    insights.push({
      id: 'best-symbol',
      type: 'pattern',
      icon: '🎯',
      title: `${bestSym.symbol} is your edge`,
      body: `${bestSym.count} trades, ${bestSym.winRate}% WR, ${fmtUSD(bestSym.pnl)} total. Average ${fmtUSD(bestSym.avgPnl)}/trade.`,
      priority: 7,
      color: 'green',
    });
  }

  if (worstSym && worstSym.pnl < 0 && worstSym.symbol !== bestSym?.symbol) {
    insights.push({
      id: 'worst-symbol',
      type: 'warning',
      icon: '💀',
      title: `${worstSym.symbol} is costing you`,
      body: `You've lost ${fmtUSD(Math.abs(worstSym.pnl))} in ${worstSym.count} trades. Consider removing it from your watchlist.`,
      priority: 7,
      color: 'red',
    });
  }

  // ─── Rule 4: Long vs Short Bias ────────────────────────────
  const longTrades = bySide['long'] || [];
  const shortTrades = bySide['short'] || [];

  if (longTrades.length >= 5 && shortTrades.length >= 5) {
    const longWR = winRate(longTrades);
    const shortWR = winRate(shortTrades);
    const diff = Math.abs(longWR - shortWR);

    if (diff >= 15) {
      const better = longWR > shortWR ? 'long' : 'short';
      const worse = longWR > shortWR ? 'short' : 'long';
      const betterWR = Math.max(longWR, shortWR);
      const worseWR = Math.min(longWR, shortWR);

      insights.push({
        id: 'side-bias',
        type: 'pattern',
        icon: better === 'long' ? '📈' : '📉',
        title: `You're a stronger ${better} trader`,
        body: `${betterWR}% WR going ${better} vs ${worseWR}% going ${worse}. Consider reducing ${worse}-side risk.`,
        priority: 6,
        color: 'blue',
      });
    }
  }

  // ─── Rule 5: Win/Loss Streaks ──────────────────────────────
  const sortedByDate = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));
  let currentStreak = 0;
  let streakType = null;
  for (const t of sortedByDate) {
    const isWin = (t.pnl || 0) > 0;
    if (streakType === null) {
      streakType = isWin ? 'win' : 'loss';
      currentStreak = 1;
    } else if ((isWin && streakType === 'win') || (!isWin && streakType === 'loss')) {
      currentStreak++;
    } else break;
  }

  if (currentStreak >= 4 && streakType === 'win') {
    insights.push({
      id: 'hot-streak',
      type: 'streak',
      icon: '🔥',
      title: `${currentStreak}-trade win streak!`,
      body: `You're on fire! Stay disciplined — don't increase risk just because you're winning. Lock in the gains.`,
      priority: 9,
      color: 'green',
    });
  }

  if (currentStreak >= 3 && streakType === 'loss') {
    insights.push({
      id: 'cold-streak',
      type: 'warning',
      icon: '❄️',
      title: `${currentStreak} losses in a row`,
      body: `Take a step back. Review your last trades for pattern breaks. Consider reducing position size until the streak breaks.`,
      priority: 9,
      color: 'red',
    });
  }

  // ─── Rule 6: Risk/Reward Ratio ─────────────────────────────
  const winners = trades.filter((t) => (t.pnl || 0) > 0);
  const losers = trades.filter((t) => (t.pnl || 0) < 0);

  if (winners.length >= 5 && losers.length >= 5) {
    const avgWin = sum(winners, 'pnl') / winners.length;
    const avgLoss = Math.abs(sum(losers, 'pnl') / losers.length);
    const rr = avgWin / avgLoss;

    if (rr < 1) {
      insights.push({
        id: 'rr-ratio',
        type: 'warning',
        icon: '⚖️',
        title: 'Your losses are bigger than your wins',
        body: `Average win: ${fmtUSD(avgWin)} vs average loss: ${fmtUSD(avgLoss)} (${rr.toFixed(2)}:1 R/R). Tighten your stops or let winners run longer.`,
        priority: 8,
        color: 'yellow',
      });
    }

    if (rr >= 2) {
      insights.push({
        id: 'rr-ratio-good',
        type: 'pattern',
        icon: '💎',
        title: 'Excellent risk/reward',
        body: `Your wins are ${rr.toFixed(1)}x your losses. Average win: ${fmtUSD(avgWin)} vs loss: ${fmtUSD(avgLoss)}. Keep cutting losers fast.`,
        priority: 5,
        color: 'green',
      });
    }
  }

  // ─── Rule 7: Overtrading Detection ─────────────────────────
  const dayTradeCounts = Object.values(byDay).map((ts) => ts.length);
  const avgDayTrades = dayTradeCounts.reduce((s, n) => s + n, 0) / dayTradeCounts.length;

  // Find days with high trade counts and negative P&L
  const overtradeDays = Object.entries(byDay).filter(([_, ts]) => {
    return ts.length > avgDayTrades * 1.5 && sum(ts, 'pnl') < 0;
  });

  if (overtradeDays.length >= 3) {
    insights.push({
      id: 'overtrading',
      type: 'warning',
      icon: '🔄',
      title: 'Overtrading loses you money',
      body: `On ${overtradeDays.length} high-volume days, you lost money. Your sweet spot is around ${Math.round(avgDayTrades)} trades/day.`,
      priority: 8,
      color: 'yellow',
    });
  }

  // ─── Rule 8: Rule Adherence ────────────────────────────────
  const recent30 = sortedByDate.slice(0, 30);
  const ruleBreaks = recent30.filter((t) => t.ruleBreak).length;
  const adherenceRate = recent30.length > 0 ? Math.round(((recent30.length - ruleBreaks) / recent30.length) * 100) : 100;

  if (ruleBreaks >= 3 && adherenceRate < 80) {
    insights.push({
      id: 'rule-breaks',
      type: 'warning',
      icon: '📋',
      title: `Rule adherence: ${adherenceRate}%`,
      body: `You broke your rules on ${ruleBreaks} of your last ${recent30.length} trades. Rule-following traders are more consistent long-term.`,
      priority: 7,
      color: 'red',
    });
  }

  if (adherenceRate >= 90 && recent30.length >= 10) {
    insights.push({
      id: 'rule-adherence-good',
      type: 'pattern',
      icon: '✅',
      title: 'Strong rule discipline',
      body: `${adherenceRate}% adherence over your last ${recent30.length} trades. This consistency is your biggest edge.`,
      priority: 4,
      color: 'green',
    });
  }

  // ─── Rule 9: Strategy Performance ──────────────────────────
  const stratStats = Object.entries(byStrategy)
    .filter(([s]) => s !== 'none')
    .map(([strat, ts]) => ({
      strategy: strat,
      pnl: sum(ts, 'pnl'),
      winRate: winRate(ts),
      count: ts.length,
    }))
    .filter((s) => s.count >= 5);

  const bestStrat = stratStats.sort((a, b) => b.pnl - a.pnl)[0];
  if (bestStrat && bestStrat.pnl > 0) {
    insights.push({
      id: 'best-strategy',
      type: 'pattern',
      icon: '🧪',
      title: `"${capitalize(bestStrat.strategy)}" is your best setup`,
      body: `${bestStrat.count} trades, ${bestStrat.winRate}% win rate, ${fmtUSD(bestStrat.pnl)} total profit. Double down on this strategy.`,
      priority: 6,
      color: 'green',
    });
  }

  // ─── Return sorted by priority ─────────────────────────────
  return insights.sort((a, b) => b.priority - a.priority);
}

// ─── Utilities ───────────────────────────────────────────────────

function startOfDay(d) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function groupBy(arr, fn) {
  const m = {};
  for (const item of arr) {
    if (!item.date) continue;
    const key = fn(item);
    if (!m[key]) m[key] = [];
    m[key].push(item);
  }
  return m;
}

function sum(arr, key) {
  return arr.reduce((s, t) => s + (t[key] || 0), 0);
}

function winRate(arr) {
  if (!arr.length) return 0;
  return Math.round((arr.filter((t) => (t.pnl || 0) > 0).length / arr.length) * 100);
}

function fmtUSD(n) {
  return (n >= 0 ? '+' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
