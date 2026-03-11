// ═══════════════════════════════════════════════════════════════════
// charEdge — Briefing Service
//
// Generates personalized morning briefing data by combining:
//   - Watchlist symbols (key levels, news, movement)
//   - Trade history (personal edge insights)
//   - Market sentiment (Fear & Greed, social)
//   - Economic calendar (today's events)
//
// Currently uses simulated data — designed for future API integration.
// ═══════════════════════════════════════════════════════════════════

// ─── Mock Market Data ───────────────────────────────────────────

const MOCK_PRICES = {
  BTC: { price: 68420, change: 3.2, prevClose: 66300 },
  ETH: { price: 3850, change: 2.1, prevClose: 3771 },
  SOL: { price: 148.5, change: 5.8, prevClose: 140.4 },
  ES: { price: 5285, change: 0.4, prevClose: 5264 },
  NQ: { price: 18720, change: 0.6, prevClose: 18608 },
  AAPL: { price: 182.5, change: -0.8, prevClose: 184.0 },
  SPY: { price: 528.2, change: 0.3, prevClose: 526.6 },
  DOGE: { price: 0.142, change: 8.2, prevClose: 0.131 },
  ADA: { price: 0.68, change: -1.4, prevClose: 0.69 },
  XRP: { price: 0.62, change: 1.1, prevClose: 0.613 },
  LINK: { price: 18.9, change: 4.3, prevClose: 18.12 },
  AVAX: { price: 42.1, change: 3.5, prevClose: 40.68 },
};

const MOCK_KEY_LEVELS = {
  BTC: { support: [65000, 62500, 60000], resistance: [70000, 72500, 75000] },
  ETH: { support: [3600, 3400, 3200], resistance: [4000, 4200, 4500] },
  SOL: { support: [135, 125, 115], resistance: [155, 165, 180] },
  ES: { support: [5250, 5220, 5200], resistance: [5300, 5320, 5350] },
  NQ: { support: [18500, 18300, 18000], resistance: [18850, 19000, 19200] },
  AAPL: { support: [178, 175, 172], resistance: [185, 188, 190] },
  SPY: { support: [525, 522, 520], resistance: [530, 533, 535] },
};

const MOCK_PATTERNS = {
  BTC: { pattern: 'Breakout', signal: 'bullish', description: 'Testing major resistance at $70k with increasing volume' },
  ETH: { pattern: 'Bull Flag', signal: 'bullish', description: 'Consolidating after breakout, flag forming on 4H' },
  SOL: { pattern: 'Cup & Handle', signal: 'bullish', description: 'Handle forming near $150, breakout target $180' },
  ES: { pattern: 'Range Bound', signal: 'neutral', description: 'Oscillating between 5250-5300 for 3 sessions' },
  NQ: { pattern: 'Higher Lows', signal: 'bullish', description: 'Trending up with compression — breakout imminent' },
  AAPL: { pattern: 'Bear Divergence', signal: 'bearish', description: 'RSI diverging on daily while price tests resistance' },
};

const MOCK_NEWS_MAP = {
  BTC: [
    { headline: 'Institutional BTC inflows hit weekly record', sentiment: 'bullish', source: 'CoinDesk' },
    { headline: 'ETF approval expectations rise ahead of SEC deadline', sentiment: 'bullish', source: 'Bloomberg' },
  ],
  ETH: [
    { headline: 'Ethereum Layer 2 TVL reaches $50B milestone', sentiment: 'bullish', source: 'The Block' },
  ],
  SOL: [
    { headline: 'Solana DEX volume surpasses Ethereum for third week', sentiment: 'bullish', source: 'DeFiLlama' },
  ],
  ES: [
    { headline: 'S&P futures steady ahead of FOMC minutes', sentiment: 'neutral', source: 'Reuters' },
  ],
  AAPL: [
    { headline: 'Apple faces EU antitrust fine over App Store policies', sentiment: 'bearish', source: 'FT' },
  ],
};

// ─── Market-wide Data ───────────────────────────────────────────

const MOCK_TOP_MOVERS = [
  { symbol: 'DOGE', change: 8.2, price: 0.142, direction: 'up' },
  { symbol: 'SOL', change: 5.8, price: 148.5, direction: 'up' },
  { symbol: 'LINK', change: 4.3, price: 18.9, direction: 'up' },
  { symbol: 'BTC', change: 3.2, price: 68420, direction: 'up' },
  { symbol: 'AAPL', change: -0.8, price: 182.5, direction: 'down' },
  { symbol: 'ADA', change: -1.4, price: 0.68, direction: 'down' },
];

const MOCK_EVENTS_TODAY = [
  { time: '08:30', event: 'Initial Jobless Claims', impact: 'high', previous: '215K', forecast: '220K', country: 'US' },
  { time: '10:00', event: 'Existing Home Sales', impact: 'medium', previous: '4.00M', forecast: '3.95M', country: 'US' },
  { time: '13:00', event: 'FOMC Minutes Released', impact: 'high', previous: '—', forecast: '—', country: 'US' },
  { time: '14:30', event: 'ECB Speech — Lagarde', impact: 'medium', previous: '—', forecast: '—', country: 'EU' },
];

const MOCK_SENTIMENT = {
  fearGreed: 68,
  fearGreedLabel: 'Greed',
  socialSentiment: 72,
  socialLabel: 'Bullish',
  btcDominance: 54.2,
  totalMarketCap: '2.78T',
};

// ─── Helper: Day-of-Week Win Rate Analysis ──────────────────────

function analyzeDayOfWeekEdge(trades) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = new Date().getDay();
  const todayName = days[today];

  const dayTrades = trades.filter((t) => {
    const tradeDate = new Date(t.date || t.entryDate);
    return tradeDate.getDay() === today;
  });

  if (dayTrades.length < 5) return null;

  const wins = dayTrades.filter((t) => (t.pnl || 0) > 0).length;
  const winRate = Math.round((wins / dayTrades.length) * 100);
  const avgPnl = dayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / dayTrades.length;

  return {
    day: todayName,
    winRate,
    avgPnl,
    tradeCount: dayTrades.length,
    isEdge: winRate >= 60,
  };
}

function analyzeRecentStreak(trades) {
  if (trades.length < 2) return null;

  const sorted = [...trades].sort((a, b) => new Date(b.date || b.entryDate) - new Date(a.date || a.entryDate));
  let streak = 0;
  let direction = null;

  for (const t of sorted) {
    const won = (t.pnl || 0) > 0;
    if (direction === null) {
      direction = won ? 'win' : 'loss';
      streak = 1;
    } else if ((won && direction === 'win') || (!won && direction === 'loss')) {
      streak++;
    } else {
      break;
    }
  }

  return streak >= 2 ? { streak, direction } : null;
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Generate the morning briefing data.
 * @param {Object} opts
 * @param {Array} opts.watchlistSymbols — Array of { symbol, name, assetClass }
 * @param {Array} opts.trades — User's trade history
 * @returns {Promise<Object>} Briefing data
 */
export async function fetchBriefingData({ watchlistSymbols = [], trades = [] } = {}) {
  // Simulate API delay
  await new Promise((r) => setTimeout(r, 500));

  // ─── 1. Watchlist Digest ──────────────────────────────────────
  const watchlistDigest = watchlistSymbols.slice(0, 8).map((item) => {
    const sym = item.symbol;
    const priceData = MOCK_PRICES[sym] || { price: 0, change: 0, prevClose: 0 };
    const levels = MOCK_KEY_LEVELS[sym] || null;
    const pattern = MOCK_PATTERNS[sym] || null;
    const news = MOCK_NEWS_MAP[sym] || [];

    return {
      symbol: sym,
      name: item.name || sym,
      assetClass: item.assetClass || 'other',
      price: priceData.price,
      change: priceData.change,
      prevClose: priceData.prevClose,
      keyLevels: levels,
      pattern,
      news: news.slice(0, 2),
    };
  });

  // ─── 2. Overnight Movers ──────────────────────────────────────
  const overnightMovers = MOCK_TOP_MOVERS;

  // ─── 3. Economic Events Today ─────────────────────────────────
  const eventsToday = MOCK_EVENTS_TODAY;

  // ─── 4. Sentiment Snapshot ────────────────────────────────────
  const sentiment = MOCK_SENTIMENT;

  // ─── 5. Your Edge Today (from trade history) ──────────────────
  const dayEdge = analyzeDayOfWeekEdge(trades);
  const streak = analyzeRecentStreak(trades);

  const edgeInsights = [];
  if (dayEdge) {
    if (dayEdge.isEdge) {
      edgeInsights.push({
        type: 'positive',
        text: `You win ${dayEdge.winRate}% of trades on ${dayEdge.day}s (${dayEdge.tradeCount} trades). Today could be your edge.`,
        icon: '🎯',
      });
    } else {
      edgeInsights.push({
        type: 'caution',
        text: `Your ${dayEdge.day} win rate is ${dayEdge.winRate}% (${dayEdge.tradeCount} trades). Consider smaller position sizes today.`,
        icon: '⚠️',
      });
    }
  }

  if (streak) {
    if (streak.direction === 'win') {
      edgeInsights.push({
        type: 'positive',
        text: `🔥 ${streak.streak}-trade win streak! Stay disciplined — don't let overconfidence creep in.`,
        icon: '🔥',
      });
    } else {
      edgeInsights.push({
        type: 'caution',
        text: `${streak.streak} losses in a row. Consider reviewing your last entries before trading today.`,
        icon: '🛡️',
      });
    }
  }

  // Add a general insight if we have trades
  if (trades.length > 0) {
    const recentTrades = trades.slice(0, 20);
    const avgHoldTime = recentTrades.reduce((sum, t) => {
      if (t.entryDate && t.exitDate) {
        return sum + (new Date(t.exitDate) - new Date(t.entryDate));
      }
      return sum;
    }, 0) / Math.max(recentTrades.filter(t => t.entryDate && t.exitDate).length, 1);

    const avgHoldMins = Math.round(avgHoldTime / 60000);
    if (avgHoldMins > 0) {
      edgeInsights.push({
        type: 'info',
        text: `Your average hold time is ${avgHoldMins < 60 ? `${avgHoldMins}m` : `${Math.round(avgHoldMins / 60)}h`}. Patience has been ${trades.filter(t => (t.pnl || 0) > 0).length > trades.length / 2 ? 'working for you' : 'a challenge'}.`,
        icon: '⏱️',
      });
    }
  }

  // ─── 6. Market Narrative ──────────────────────────────────────
  const hour = new Date().getHours();
  let marketNarrative;
  if (sentiment.fearGreed > 70) {
    marketNarrative = 'Markets are in greed territory — momentum is strong but watch for overextension. Stick to your plan.';
  } else if (sentiment.fearGreed > 50) {
    marketNarrative = 'Markets are cautiously optimistic. Good setups are forming — focus on high-confluence entries.';
  } else if (sentiment.fearGreed > 30) {
    marketNarrative = 'Markets are uncertain. Reduce position sizes and wait for clear signals.';
  } else {
    marketNarrative = 'Fear is elevated — contrarian opportunities may emerge. Keep tight stops and manage risk carefully.';
  }

  return {
    generatedAt: new Date().toISOString(),
    greeting: hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening',
    marketNarrative,
    watchlistDigest,
    overnightMovers,
    eventsToday,
    sentiment,
    edgeInsights,
    readTimeMinutes: 2,
    tradeCount: trades.length,
  };
}
