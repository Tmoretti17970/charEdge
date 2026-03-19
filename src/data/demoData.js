// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Demo Data Generator
// Extracted from v9.3 monolith genDemoData().
// Generates realistic sample trades + playbooks for new users.
// ═══════════════════════════════════════════════════════════════════

let _uidCounter = 0;

/** Generate a simple unique ID */
function uid() {
  return 'tf_' + Date.now().toString(36) + '_' + (++_uidCounter).toString(36);
}

/** Create ISO date string for N days ago at given hour:minute */
function isoAt(daysAgo, hour = 10, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/**
 * Generate demo trades and playbooks.
 * Returns { trades, playbooks } with ~12 sample trades spanning a week.
 *
 * @returns {{ trades: Object[], playbooks: Object[] }}
 */
function genDemoData() {
  _uidCounter = 0; // Reset for deterministic IDs in tests

  const playbooks = [
    {
      id: 'pb1',
      name: 'Trend Following',
      rules: ['Wait for 20 EMA alignment', 'Confirm with volume', 'Risk max 1% per trade'],
    },
    {
      id: 'pb2',
      name: 'Mean Reversion',
      rules: ['RSI below 30 or above 70', 'Wait for reversal candle', 'Tight stop-loss at swing point'],
    },
    {
      id: 'pb3',
      name: 'Breakout',
      rules: ['Wait for consolidation squeeze', 'Enter on volume breakout', 'Trail stop at prior swing'],
    },
  ];

  const trades = [
    {
      id: uid(),
      date: isoAt(0, 9, 30),
      symbol: 'ES',
      assetClass: 'futures',
      side: 'long',
      qty: 2,
      entry: 6045.25,
      pnl: 487.5,
      fees: 4.6,
      playbook: 'Trend Following',
      emotion: 'Confident',
      rMultiple: 2.4,
      rating: 4,
      notes: 'Clean trend day. Held through morning pullback.',
      tags: ['A+setup', 'trendday'],
    },
    {
      id: uid(),
      date: isoAt(0, 14, 15),
      symbol: 'BTC',
      assetClass: 'crypto',
      side: 'long',
      qty: 0.15,
      entry: 97250,
      pnl: 312.0,
      fees: 8.4,
      playbook: 'Breakout',
      emotion: 'Focused',
      rMultiple: 1.8,
      rating: 3,
      notes: 'Breakout above 97k resistance.',
    },
    {
      id: uid(),
      date: isoAt(2, 10, 0),
      symbol: 'NQ',
      assetClass: 'futures',
      side: 'short',
      qty: 1,
      entry: 21420,
      pnl: -225.0,
      fees: 4.6,
      playbook: 'Mean Reversion',
      emotion: 'Anxious',
      rMultiple: -1.2,
      rating: 2,
      notes: 'Faded the gap but trend continued. Should have waited.',
    },
    {
      id: uid(),
      date: isoAt(3, 9, 45),
      symbol: 'CL',
      assetClass: 'futures',
      side: 'long',
      qty: 1,
      entry: 68.2,
      pnl: 340.0,
      fees: 4.6,
      playbook: 'Trend Following',
      emotion: 'Calm',
      rMultiple: 2.1,
      rating: 4,
    },
    {
      id: uid(),
      date: isoAt(3, 13, 0),
      symbol: 'BTC',
      assetClass: 'crypto',
      side: 'short',
      qty: 0.1,
      entry: 96800,
      pnl: -180.0,
      fees: 5.2,
      playbook: 'Mean Reversion',
      emotion: 'Frustrated',
      rMultiple: -0.9,
      rating: 1,
      notes: 'Revenge trade after morning miss. Bad discipline.',
      tags: ['revenge', 'overtrading'],
    },
    {
      id: uid(),
      date: isoAt(4, 10, 30),
      symbol: 'ES',
      assetClass: 'futures',
      side: 'long',
      qty: 2,
      entry: 6020.5,
      pnl: 625.0,
      fees: 4.6,
      playbook: 'Breakout',
      emotion: 'Confident',
      rMultiple: 3.1,
      rating: 5,
      notes: 'Perfect breakout. Added on pullback.',
      tags: ['A+setup'],
    },
    {
      id: uid(),
      date: isoAt(4, 15, 0),
      symbol: 'SOL',
      assetClass: 'crypto',
      side: 'long',
      qty: 10,
      entry: 178.5,
      pnl: 145.0,
      fees: 3.8,
      playbook: 'Trend Following',
      emotion: 'Neutral',
      rMultiple: 1.1,
      rating: 3,
    },
    {
      id: uid(),
      date: isoAt(5, 9, 30),
      symbol: 'NQ',
      assetClass: 'futures',
      side: 'long',
      qty: 1,
      entry: 21350,
      pnl: 475.0,
      fees: 4.6,
      playbook: 'Trend Following',
      emotion: 'Focused',
      rMultiple: 2.6,
      rating: 4,
      notes: 'Gap and go setup. Held for full move.',
      tags: ['gapandgo'],
    },
    {
      id: uid(),
      date: isoAt(5, 11, 0),
      symbol: 'ETH',
      assetClass: 'crypto',
      side: 'long',
      qty: 1.5,
      entry: 3380,
      pnl: -95.0,
      fees: 6.2,
      playbook: 'Breakout',
      emotion: 'Uncertain',
      rMultiple: -0.5,
      rating: 2,
      notes: 'False breakout. Cut quickly.',
    },
    {
      id: uid(),
      date: isoAt(6, 14, 30),
      symbol: 'ES',
      assetClass: 'futures',
      side: 'short',
      qty: 2,
      entry: 6080,
      pnl: -312.5,
      fees: 4.6,
      playbook: 'Mean Reversion',
      emotion: 'Anxious',
      rMultiple: -1.5,
      rating: 1,
      notes: 'Faded strength into FOMC. Should know better.',
      tags: ['FOMC', 'overtrading'],
    },
    {
      id: uid(),
      date: isoAt(6, 10, 0),
      symbol: 'BTC',
      assetClass: 'crypto',
      side: 'long',
      qty: 0.2,
      entry: 95800,
      pnl: 520.0,
      fees: 9.6,
      playbook: 'Trend Following',
      emotion: 'Calm',
      rMultiple: 2.8,
      rating: 5,
      tags: ['A+setup', 'trendday'],
    },
  ];

  // ─── Generate ~240 more trades spanning Jan 2025 – Mar 2026 ────
  // Total ~250 with the hand-crafted trades above.

  const allSymbols = [
    // Crypto
    'BTC', 'ETH', 'SOL', 'AVAX', 'DOGE', 'LINK', 'ARB',
    // Futures
    'ES', 'NQ', 'CL', 'GC', 'YM', 'RTY',
    // Stocks
    'AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'META', 'SPY', 'QQQ', 'AMD', 'GOOG',
  ];

  const symbolMeta = {
    BTC:  { asset: 'crypto',  basePrice: 62000, vol: 8000 },
    ETH:  { asset: 'crypto',  basePrice: 3200,  vol: 600 },
    SOL:  { asset: 'crypto',  basePrice: 145,   vol: 40 },
    AVAX: { asset: 'crypto',  basePrice: 35,    vol: 12 },
    DOGE: { asset: 'crypto',  basePrice: 0.14,  vol: 0.06 },
    LINK: { asset: 'crypto',  basePrice: 18,    vol: 6 },
    ARB:  { asset: 'crypto',  basePrice: 1.20,  vol: 0.4 },
    ES:   { asset: 'futures', basePrice: 5800,  vol: 200 },
    NQ:   { asset: 'futures', basePrice: 20500, vol: 800 },
    CL:   { asset: 'futures', basePrice: 72,    vol: 8 },
    GC:   { asset: 'futures', basePrice: 2050,  vol: 100 },
    YM:   { asset: 'futures', basePrice: 38500, vol: 1000 },
    RTY:  { asset: 'futures', basePrice: 2050,  vol: 80 },
    AAPL: { asset: 'stocks',  basePrice: 195,   vol: 20 },
    TSLA: { asset: 'stocks',  basePrice: 245,   vol: 50 },
    NVDA: { asset: 'stocks',  basePrice: 780,   vol: 120 },
    MSFT: { asset: 'stocks',  basePrice: 420,   vol: 30 },
    AMZN: { asset: 'stocks',  basePrice: 185,   vol: 25 },
    META: { asset: 'stocks',  basePrice: 510,   vol: 60 },
    SPY:  { asset: 'stocks',  basePrice: 580,   vol: 25 },
    QQQ:  { asset: 'stocks',  basePrice: 500,   vol: 30 },
    AMD:  { asset: 'stocks',  basePrice: 165,   vol: 30 },
    GOOG: { asset: 'stocks',  basePrice: 165,   vol: 20 },
  };

  const allEmotions = [
    'Calm', 'Confident', 'Neutral', 'Uncertain', 'Focused',
    'Anxious', 'Frustrated', 'Patient', 'Greedy', 'Disciplined',
  ];

  const allPlaybooks = [
    'Trend Following', 'Mean Reversion', 'Breakout', 'Scalp',
    'Gap & Go', 'VWAP Bounce', 'Momentum Fade', 'Support Bounce',
    'Range Breakout', 'Pull-back Entry', 'Earnings Play', 'Swing Hold',
  ];

  const allTags = [
    'A+setup', 'trendday', 'reversal', 'breakout', 'scalp',
    'momentum', 'FOMC', 'CPI', 'earnings', 'overtrading',
    'revenge', 'patience', 'volume', 'gapandgo', 'rangebound',
    'premarket', 'afterhours', 'swinghold', 'hedged', 'thesis-driven',
  ];

  // Trade type determines holding period & P/L magnitude
  const tradeTypes = [
    { name: 'Scalp',      weight: 0.25, minHoldH: 0.1,  maxHoldH: 1,    pnlScale: 0.4 },
    { name: 'Day Trade',  weight: 0.35, minHoldH: 0.5,  maxHoldH: 6,    pnlScale: 1.0 },
    { name: 'Swing',      weight: 0.25, minHoldH: 24,   maxHoldH: 168,  pnlScale: 2.0 },  // 1-7 days
    { name: 'Position',   weight: 0.15, minHoldH: 168,  maxHoldH: 1440, pnlScale: 4.0 },  // 1-8 weeks
  ];

  const tradeNotes = [
    'Clean setup, followed the plan.',
    'Entry was late, chased a bit.',
    'Held through a scary drawdown but thesis played out.',
    'Stopped out on a wick, re-entered later.',
    'Took profit too early, left 2R on the table.',
    'FOMO entry. Need to be more patient.',
    'Textbook breakout with volume confirmation.',
    'News catalyst drove the move. Lucky timing.',
    'Pre-market gap filled perfectly.',
    'Scaled in on pullback, great average.',
    'Revenge trade after a loss. Bad discipline.',
    'Held overnight, gap up next morning.',
    'Cut the loser fast, good risk management.',
    'VWAP rejection trade, quick scalp.',
    'Overtraded today, too many setups.',
    'Caught the trend early, trailed stop well.',
    'False breakout trapped shorts, rode the squeeze.',
    'Late day reversal caught me off guard.',
    'Perfect plan execution, A+ trade.',
    'Choppy day, took too many mediocre setups.',
    'Earnings surprise, held through gap.',
    'Waited for confirmation, paid off.',
    'Should have sized up on conviction play.',
    'Tight range all day, barely any opportunity.',
    'Market structure shift, adapted well.',
    '',
    '',
    '',
  ];

  // Deterministic seeded RNG
  const seed = 42;
  let s = seed;
  const rand = () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };

  // Pick a random trade type using weighted selection
  function pickTradeType() {
    const r = rand();
    let cumulative = 0;
    for (const tt of tradeTypes) {
      cumulative += tt.weight;
      if (r < cumulative) return tt;
    }
    return tradeTypes[1]; // fallback: Day Trade
  }

  // Generate a date between Jan 1, 2025 and Mar 16, 2026
  const startDate = new Date('2025-01-01T00:00:00Z');
  const endDate   = new Date('2026-03-16T00:00:00Z');
  const totalDays = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));

  const TARGET_TRADES = 240;

  for (let i = 0; i < TARGET_TRADES; i++) {
    const daysOffset = Math.floor(rand() * totalDays);
    const entryHour = 6 + Math.floor(rand() * 12); // 6am – 6pm
    const entryMinute = Math.floor(rand() * 60);

    const entryDate = new Date(startDate);
    entryDate.setDate(entryDate.getDate() + daysOffset);
    entryDate.setHours(entryHour, entryMinute, 0, 0);

    const sym = allSymbols[Math.floor(rand() * allSymbols.length)];
    const meta = symbolMeta[sym];
    const side = rand() > 0.45 ? 'long' : 'short'; // slight long bias
    const tt = pickTradeType();
    const pb = allPlaybooks[Math.floor(rand() * allPlaybooks.length)];
    const emo = allEmotions[Math.floor(rand() * allEmotions.length)];

    // Realistic entry price with drift
    const priceNoise = (rand() - 0.5) * meta.vol * 2;
    const entry = Math.round((meta.basePrice + priceNoise) * 100) / 100;

    // Holding period in hours
    const holdHours = tt.minHoldH + rand() * (tt.maxHoldH - tt.minHoldH);
    const exitDate = new Date(entryDate.getTime() + holdHours * 3600000);

    // P/L: 58% win rate, scaled by trade type
    const isWin = rand() < 0.58;
    const basePnl = (50 + rand() * 500) * tt.pnlScale;
    const pnl = isWin
      ? Math.round(basePnl * 100) / 100
      : -Math.round((basePnl * (0.4 + rand() * 0.6)) * 100) / 100;

    const fees = Math.round((1 + rand() * 12) * 100) / 100;
    const rMultiple = Math.round((pnl / (basePnl * 0.3)) * 100) / 100;

    // Qty based on asset class
    let qty;
    if (meta.asset === 'crypto') {
      qty = sym === 'BTC' ? Math.round(rand() * 5 * 100) / 100 || 0.01
        : sym === 'ETH' ? Math.round(rand() * 20 * 100) / 100 || 0.1
        : Math.ceil(rand() * 200);
    } else if (meta.asset === 'futures') {
      qty = Math.ceil(rand() * 5);
    } else {
      qty = Math.ceil(rand() * 100) * 5; // stocks in lots of 5
    }

    // Rating 1-5, skewed toward 3
    const rating = Math.min(5, Math.max(1, Math.round(3 + (rand() - 0.5) * 4)));

    // Pick 0-3 random tags
    const tagCount = Math.floor(rand() * 4);
    const tradeTags = [];
    for (let t = 0; t < tagCount; t++) {
      const tag = allTags[Math.floor(rand() * allTags.length)];
      if (!tradeTags.includes(tag)) tradeTags.push(tag);
    }

    // ~60% of trades get a note
    const note = rand() < 0.6
      ? tradeNotes[Math.floor(rand() * tradeNotes.length)]
      : undefined;

    trades.push({
      id: uid(),
      date: entryDate.toISOString(),
      exitDate: exitDate.toISOString(),
      symbol: sym,
      assetClass: meta.asset,
      side,
      qty,
      entry,
      exit: Math.round((entry + (isWin ? 1 : -1) * (side === 'long' ? 1 : -1) * (pnl / (qty || 1))) * 100) / 100,
      pnl,
      fees,
      emotion: emo,
      playbook: pb,
      rMultiple,
      rating,
      notes: note,
      tags: tradeTags,
      tradeType: tt.name,
    });
  }

  // Sort trades by date descending (newest first)
  trades.sort((a, b) => new Date(b.date) - new Date(a.date));

  return { trades, playbooks };
}

/**
 * Generate N random trades for stress testing.
 * @param {number} n — number of trades
 * @param {Object} [opts]
 * @param {string[]} [opts.symbols] — symbol pool
 * @param {number} [opts.maxPnl] — max absolute P&L
 * @returns {Object[]}
 */
function genRandomTrades(n, opts = {}) {
  const { symbols = ['ES', 'NQ', 'BTC', 'ETH', 'AAPL', 'SPY', 'CL', 'SOL'], maxPnl = 1000 } = opts;

  const sides = ['long', 'short'];
  const emotions = ['Calm', 'Confident', 'Neutral', 'Uncertain', 'Anxious', 'Focused'];
  const playbooks = ['Trend Following', 'Mean Reversion', 'Breakout', 'Scalp'];

  return Array.from({ length: n }, (_, _i) => {
    const daysAgo = Math.floor(Math.random() * 90);
    const hour = 8 + Math.floor(Math.random() * 8);
    const minute = Math.floor(Math.random() * 60);
    const pnl = (Math.random() - 0.45) * maxPnl * 2; // slight positive bias

    return {
      id: uid(),
      date: isoAt(daysAgo, hour, minute),
      symbol: symbols[Math.floor(Math.random() * symbols.length)],
      side: sides[Math.floor(Math.random() * sides.length)],
      pnl: Math.round(pnl * 100) / 100,
      fees: Math.round(Math.random() * 10 * 100) / 100,
      emotion: emotions[Math.floor(Math.random() * emotions.length)],
      playbook: playbooks[Math.floor(Math.random() * playbooks.length)],
      rMultiple: Math.round((pnl / (maxPnl * 0.3)) * 100) / 100,
    };
  });
}

export { genDemoData, genRandomTrades, uid, isoAt };
export default genDemoData;
