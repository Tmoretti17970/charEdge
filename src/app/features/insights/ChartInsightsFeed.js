// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Insights Feed (Sprint 20)
// Aggregates chart insights, ideas, patterns, and signals into
// a unified feed for discovery and learning.
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate an insights feed from multiple data sources.
 * @param {Object} sources
 * @returns {Object[]} Sorted feed items
 */
export function generateInsightsFeed(sources = {}) {
  const {
    ideas = [],      // Published chart ideas
    signals = [],    // Confluence signals
    breakouts = [],  // Trendline breakouts
    srLevels = [],   // Auto S/R levels
    achievements = [],// Gamification unlocks
    _sessions = [],   // Session completions
  } = sources;

  const feed = [];

  // Published ideas
  for (const idea of ideas.slice(0, 20)) {
    feed.push({
      id: idea.id,
      type: 'idea',
      icon: '💡',
      title: idea.title,
      subtitle: `${idea.symbol} ${idea.tf} — ${idea.bias}`,
      timestamp: idea.createdAt,
      author: idea.author,
      likes: idea.likes,
      tags: idea.tags,
      action: { type: 'load-idea', data: idea },
    });
  }

  // Confluence signals
  for (const signal of signals) {
    feed.push({
      id: `sig_${signal.type}_${Date.now()}`,
      type: 'signal',
      icon: signal.bias === 'bullish' ? '🟢' : signal.bias === 'bearish' ? '🔴' : '⚪',
      title: formatSignalTitle(signal),
      subtitle: signal.desc || '',
      timestamp: Date.now(),
      tags: [signal.type, signal.bias],
      priority: signal.strength || 0.5,
    });
  }

  // Trendline breakouts
  for (const bo of breakouts) {
    feed.push({
      id: `bo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'breakout',
      icon: bo.direction === 'bullish' ? '📈' : '📉',
      title: bo.message,
      subtitle: `${bo.trendline.type} with ${bo.trendline.touches} touches`,
      timestamp: Date.now(),
      priority: 0.9,
      tags: ['breakout', bo.direction],
    });
  }

  // S/R level alerts
  for (const level of srLevels.filter(l => l.strength > 3)) {
    feed.push({
      id: `sr_${level.price}`,
      type: 'level',
      icon: level.type === 'support' ? '🟩' : '🟥',
      title: `Strong ${level.type} at ${level.price.toFixed(2)}`,
      subtitle: `${level.touches} touches, strength ${level.strength.toFixed(1)}`,
      timestamp: level.mostRecentTime || Date.now(),
      tags: [level.type, 'sr'],
    });
  }

  // Achievements
  for (const ach of achievements) {
    feed.push({
      id: ach.id,
      type: 'achievement',
      icon: '🏆',
      title: `Unlocked: ${ach.name}`,
      subtitle: ach.desc,
      timestamp: Date.now(),
      tags: ['achievement'],
    });
  }

  // Sort by timestamp (newest first), then by priority
  feed.sort((a, b) => {
    const priorityDiff = (b.priority || 0) - (a.priority || 0);
    if (Math.abs(priorityDiff) > 0.3) return priorityDiff;
    return (b.timestamp || 0) - (a.timestamp || 0);
  });

  return feed;
}

function formatSignalTitle(signal) {
  const titles = {
    rsi_oversold: 'RSI Oversold — Potential Bounce',
    rsi_overbought: 'RSI Overbought — Potential Reversal',
    macd_bull_cross: 'MACD Bullish Crossover',
    macd_bear_cross: 'MACD Bearish Crossover',
    bullish_divergence: 'Bullish Divergence Detected',
    bearish_divergence: 'Bearish Divergence Detected',
    high_confluence: 'High Confluence Signal',
    at_support: 'Price at Key Support',
    at_resistance: 'Price at Key Resistance',
    volume_spike: 'Volume Spike Detected',
  };
  return titles[signal.type] || signal.type;
}
