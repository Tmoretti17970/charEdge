// ═══════════════════════════════════════════════════════════════════
// charEdge — Smart Widget Suggestion Engine (Sprint 18)
//
// Analyzes trading behavior and suggests relevant dashboard widgets.
// Pure function — no side effects. Called from DashboardPanel.
// ═══════════════════════════════════════════════════════════════════

/**
 * Evaluate trading behavior signals and return widget suggestions.
 *
 * @param {Array} trades - User's trade array
 * @param {Array} activeWidgets - Currently active widget IDs
 * @param {Array} dismissed - Previously dismissed suggestion IDs
 * @returns {Array<{id, widgetId, title, reason, priority, icon}>}
 */
export function evaluateSuggestions(trades = [], activeWidgets = [], dismissed = []) {
  const suggestions = [];
  const now = Date.now();
  const DAY = 86_400_000;

  if (trades.length < 3) return []; // Not enough data

  // Sort trades by date desc
  const sorted = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));

  // ─── Signal 1: Losing streak (3+ consecutive losses) → Risk Calculator ──
  {
    let streak = 0;
    for (const t of sorted) {
      if ((t.pnl || 0) < 0) streak++;
      else break;
    }
    if (streak >= 3 && !activeWidgets.includes('risk-sim')) {
      suggestions.push({
        id: 'suggest-risk-calc',
        widgetId: 'risk-sim',
        title: 'Risk Simulator',
        reason: `You have a ${streak}-trade losing streak. The risk simulator can help evaluate your exposure.`,
        priority: 90,
        icon: '⚠️',
      });
    }
  }

  // ─── Signal 2: 5+ distinct symbols → Breakdown Chart ──────────────────
  {
    const symbols = new Set(trades.map((t) => t.symbol).filter(Boolean));
    if (symbols.size >= 5 && !activeWidgets.includes('breakdown')) {
      suggestions.push({
        id: 'suggest-breakdown',
        widgetId: 'breakdown',
        title: 'Breakdown Chart',
        reason: `You trade ${symbols.size} different symbols. See performance broken down by symbol.`,
        priority: 70,
        icon: '📊',
      });
    }
  }

  // ─── Signal 3: Detailed notes → Journal Evolution ─────────────────────
  {
    const withNotes = trades.filter((t) => t.notes && t.notes.trim().length > 50);
    if (withNotes.length >= 5 && !activeWidgets.includes('evolution')) {
      suggestions.push({
        id: 'suggest-evolution',
        widgetId: 'evolution',
        title: 'Journal Evolution',
        reason: `You write detailed trade notes. Track how your journaling evolves over time.`,
        priority: 60,
        icon: '📝',
      });
    }
  }

  // ─── Signal 4: Declining equity → Psychology / Review ─────────────────
  {
    const recent20 = sorted.slice(0, 20);
    if (recent20.length >= 10) {
      const firstHalf = recent20.slice(0, 10).reduce((s, t) => s + (t.pnl || 0), 0);
      const secondHalf = recent20.slice(10, 20).reduce((s, t) => s + (t.pnl || 0), 0);
      if (firstHalf < secondHalf * 0.5 && !activeWidgets.includes('similar-trades')) {
        suggestions.push({
          id: 'suggest-similar',
          widgetId: 'similar-trades',
          title: 'Similar Trades',
          reason: `Your recent P&L is declining. Review patterns from similar past trades to course-correct.`,
          priority: 85,
          icon: '🔍',
        });
      }
    }
  }

  // ─── Signal 5: High volume of trades → Heatmap ────────────────────────
  {
    const last30d = trades.filter((t) => now - new Date(t.date).getTime() < 30 * DAY);
    if (last30d.length >= 30 && !activeWidgets.includes('heatmap')) {
      suggestions.push({
        id: 'suggest-heatmap',
        widgetId: 'heatmap',
        title: 'Calendar Heatmap',
        reason: `You've logged ${last30d.length} trades in 30 days. Visualize your activity patterns.`,
        priority: 50,
        icon: '🗓️',
      });
    }
  }

  // ─── Signal 6: Consistent emotions logged → R Distribution ────────────
  {
    const withEmotions = trades.filter((t) => t.emotion);
    if (withEmotions.length >= 10 && !activeWidgets.includes('r-distribution')) {
      suggestions.push({
        id: 'suggest-r-dist',
        widgetId: 'r-distribution',
        title: 'R-Multiple Distribution',
        reason: `You track emotions on trades. See how your mental state correlates with R-outcomes.`,
        priority: 55,
        icon: '📈',
      });
    }
  }

  // Filter out dismissed and sort by priority
  return suggestions
    .filter((s) => !dismissed.includes(s.id))
    .sort((a, b) => b.priority - a.priority);
}
