// ═══════════════════════════════════════════════════════════════════
// charEdge — Trading Knowledge Base (AI Copilot Sprint 2, expanded Phase 2)
//
// Curated trading education: 150+ concepts with definitions,
// usage tips, common mistakes, and examples.
// Powers L1 router for instant educational answers (no LLM needed).
//
// Usage:
//   import { tradingKnowledgeBase } from './TradingKnowledgeBase';
//   const result = tradingKnowledgeBase.lookup('what is RSI');
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export interface KnowledgeEntry {
  id: string;
  terms: string[]; // Searchable keywords/phrases
  category: KnowledgeCategory;
  name: string; // Display name
  definition: string; // 1-2 sentence explanation
  howToUse: string; // Practical application
  commonMistakes: string; // What beginners get wrong
  example: string; // Concrete trading scenario
}

export type KnowledgeCategory =
  | 'indicators'
  | 'chart_patterns'
  | 'concepts'
  | 'risk_management'
  | 'psychology'
  | 'order_types'
  | 'market_structure';

export interface LookupResult {
  entry: KnowledgeEntry;
  score: number; // Match confidence 0-1
  matchedTerm: string; // Which term matched
}

// ─── Knowledge Entries ──────────────────────────────────────────

const ENTRIES: KnowledgeEntry[] = [
  // ── Indicators ──────────────────────────────────────────────
  {
    id: 'rsi',
    terms: ['rsi', 'relative strength index', 'overbought', 'oversold'],
    category: 'indicators',
    name: 'RSI (Relative Strength Index)',
    definition:
      'A momentum oscillator (0-100) that measures the speed and magnitude of recent price changes. Values above 70 suggest overbought conditions; below 30 suggest oversold.',
    howToUse:
      "Look for RSI divergences (price makes new high but RSI doesn't) as reversal signals. Use 70/30 or 80/20 levels depending on trend strength. In strong trends, RSI can stay overbought/oversold for extended periods.",
    commonMistakes:
      'Blindly selling when RSI hits 70 — in strong uptrends, RSI can stay above 70 for weeks. Always consider the broader trend context before acting on RSI signals alone.',
    example:
      'BTC RSI on 4H drops to 28 while price forms a higher low → bullish divergence. This often precedes a bounce, especially if aligned with a support level.',
  },
  {
    id: 'macd',
    terms: ['macd', 'moving average convergence divergence', 'macd crossover', 'macd histogram', 'signal line'],
    category: 'indicators',
    name: 'MACD (Moving Average Convergence Divergence)',
    definition:
      'A trend-following momentum indicator showing the relationship between two EMAs (typically 12 and 26 period). The MACD line crossing above the signal line is bullish; crossing below is bearish.',
    howToUse:
      'Use MACD crossovers for trend entry signals. Watch the histogram for momentum shifts — shrinking bars signal weakening momentum. MACD divergences from price are powerful reversal signals.',
    commonMistakes:
      "MACD is a lagging indicator — by the time it confirms a trend, a significant move may have already occurred. Don't use it alone for entries; combine with price action.",
    example:
      'ETH MACD line crosses above signal line while histogram turns positive → bullish momentum building. Enter on a pullback to the 20 EMA for better risk/reward.',
  },
  {
    id: 'bollinger_bands',
    terms: ['bollinger', 'bollinger bands', 'bb', 'bollinger squeeze', 'band width'],
    category: 'indicators',
    name: 'Bollinger Bands',
    definition:
      'Volatility bands plotted 2 standard deviations above and below a 20-period SMA. Band width reflects volatility — narrow bands (squeeze) often precede big moves.',
    howToUse:
      'A squeeze (narrowing bands) signals a breakout is coming. Price touching the upper band isn\'t automatically a sell signal — in trends, price "walks the band." Mean reversion works when price is range-bound.',
    commonMistakes:
      'Treating band touches as automatic reversal signals. In trending markets, price can ride the upper or lower band for extended moves. The squeeze is the signal, not the band touch.',
    example:
      'SOL Bollinger Bands squeeze to their tightest in 30 days → expect a breakout. Enter when price closes outside the bands with volume confirmation.',
  },
  {
    id: 'ema',
    terms: [
      'ema',
      'exponential moving average',
      'moving average',
      'ma',
      'sma',
      '20 ema',
      '50 ema',
      '200 ema',
      'golden cross',
      'death cross',
    ],
    category: 'indicators',
    name: 'EMA (Exponential Moving Average)',
    definition:
      'A moving average that gives more weight to recent prices, making it more responsive than a simple MA. Common periods: 9, 20, 50, 200. The 200 EMA is considered the trend dividing line.',
    howToUse:
      'Price above the 200 EMA = bullish bias, below = bearish. The 20 EMA acts as dynamic support/resistance in trends. EMA crossovers (e.g., 9 over 21) signal momentum shifts.',
    commonMistakes:
      "Using too many moving averages clutters the chart. Pick 2-3 key EMAs. Don't trade crossovers in choppy markets — they generate many false signals in ranges.",
    example:
      'BTC price pulls back to the 20 EMA on 4H, bounces with a bullish engulfing candle → trend continuation entry. Stop below the 50 EMA.',
  },
  {
    id: 'volume',
    terms: ['volume', 'volume profile', 'vol', 'volume spike', 'volume analysis', 'obv', 'on balance volume'],
    category: 'indicators',
    name: 'Volume',
    definition:
      'The number of shares or contracts traded in a period. Volume confirms price moves — high volume on breakouts validates the move; low volume suggests it may fail.',
    howToUse:
      'Look for volume spikes at key levels for confirmation. Rising price + rising volume = healthy trend. Rising price + declining volume = weakening trend (bearish divergence). Volume Profile shows where most trading occurred.',
    commonMistakes:
      'Ignoring volume entirely and trading on price alone. A breakout on low volume is much more likely to fail than one on 2-3x average volume.',
    example:
      'AAPL breaks above resistance at $180 on 3x average volume → strong breakout confirmation. Compare with a previous attempt that failed on below-average volume.',
  },
  {
    id: 'stochastic',
    terms: ['stochastic', 'stoch', 'stochastic oscillator', 'stochastic rsi', 'stoch rsi'],
    category: 'indicators',
    name: 'Stochastic Oscillator',
    definition:
      'A momentum indicator comparing closing price to the price range over a period. Values above 80 are overbought, below 20 are oversold. The %K and %D lines generate crossover signals.',
    howToUse:
      'Best in range-bound markets for mean reversion trades. In trends, use only the signals that align with the trend direction (buy oversold in uptrends, sell overbought in downtrends).',
    commonMistakes:
      'Using stochastic in strongly trending markets where it stays overbought/oversold for extended periods, generating many false reversal signals.',
    example:
      'ETH in a range between $3,000-$3,500. Stochastic hits 15 near $3,050 with %K crossing above %D → buy signal with stop below $2,980.',
  },
  {
    id: 'atr',
    terms: ['atr', 'average true range', 'volatility'],
    category: 'indicators',
    name: 'ATR (Average True Range)',
    definition:
      'Measures market volatility by calculating the average range of price bars. Not a directional indicator — it tells you how much an asset typically moves, not which direction.',
    howToUse:
      'Set stop losses at 1-2x ATR from entry. Use ATR to size positions (higher ATR = smaller position). ATR expansion signals increasing volatility; contraction signals a potential breakout.',
    commonMistakes:
      'Setting arbitrary stop losses (e.g., always 2%) instead of basing them on actual volatility via ATR. A $50 stop on a stock with $80 daily ATR is too tight.',
    example:
      'BTC 4H ATR is $800. Set stop loss at 1.5x ATR = $1,200 from entry. If your risk per trade is $500, position size = $500 / $1,200 = 0.42 BTC.',
  },
  {
    id: 'vwap',
    terms: ['vwap', 'volume weighted average price'],
    category: 'indicators',
    name: 'VWAP (Volume Weighted Average Price)',
    definition:
      'The average price weighted by volume, showing the "fair value" price for the session. Institutional traders use VWAP as a benchmark — trading above = bullish, below = bearish.',
    howToUse:
      'Day traders use VWAP as dynamic support/resistance. Buy pullbacks to VWAP in uptrends, sell rallies to VWAP in downtrends. VWAP resets each session.',
    commonMistakes:
      "Using VWAP on higher timeframes where it doesn't apply. VWAP is a session-based indicator, most relevant for intraday trading. It resets daily.",
    example:
      'TSLA opens above VWAP and pulls back to test it at $245. VWAP holds as support with a hammer candle → long entry with stop $1 below VWAP.',
  },
  {
    id: 'fibonacci',
    terms: [
      'fibonacci',
      'fib',
      'fib retracement',
      'fibonacci retracement',
      'fib levels',
      '0.618',
      '0.382',
      'golden ratio',
      'fib extension',
    ],
    category: 'indicators',
    name: 'Fibonacci Retracement',
    definition:
      'Horizontal lines at key ratios (23.6%, 38.2%, 50%, 61.8%, 78.6%) drawn between swing points. These levels often act as support/resistance because many traders watch them.',
    howToUse:
      'Draw from significant swing low to swing high (or vice versa). The 61.8% level (golden ratio) is the most reliable. Use fib levels in confluence with other support/resistance for higher probability.',
    commonMistakes:
      'Drawing fibs from insignificant swings or using them in isolation. Fib levels work best when they align with other signals (horizontal S/R, EMA, volume nodes).',
    example:
      'BTC rallies from $60K to $70K, then retraces. The 61.8% fib ($63,820) aligns with the 50 EMA and a previous resistance-turned-support → high-probability buy zone.',
  },
  {
    id: 'adx',
    terms: ['adx', 'average directional index', 'dmi', 'directional movement'],
    category: 'indicators',
    name: 'ADX (Average Directional Index)',
    definition:
      'Measures trend strength on a 0-100 scale regardless of direction. ADX below 20 = no trend (range). ADX above 25 = trending. ADX above 40 = strong trend.',
    howToUse:
      'Use ADX to decide your strategy: low ADX → use range strategies (mean reversion). High ADX → use trend strategies (breakout, momentum). The +DI and -DI crossovers indicate direction.',
    commonMistakes:
      "Confusing ADX direction with price direction. ADX only measures trend strength, not direction. A rising ADX means the trend is strengthening, whether it's up or down.",
    example:
      'SOL ADX rises from 15 to 35 as +DI crosses above -DI → strong uptrend forming. Switch from range-trading to trend-following strategies.',
  },

  // ── Chart Patterns ──────────────────────────────────────────
  {
    id: 'double_top',
    terms: ['double top', 'double bottom', 'w pattern', 'm pattern'],
    category: 'chart_patterns',
    name: 'Double Top / Double Bottom',
    definition:
      'A reversal pattern where price tests a level twice and fails. Double top (M shape) is bearish; double bottom (W shape) is bullish. Confirmed when price breaks the neckline.',
    howToUse:
      "Wait for neckline break confirmation — don't anticipate. Measure the height of the pattern and project it from the neckline for a price target. Volume should increase on the breakout.",
    commonMistakes:
      'Entering before neckline confirmation. Many "double tops" resolve higher. Also, ensure the two tops/bottoms are roughly equal — a significantly lower second top is a different pattern.',
    example:
      'BTC forms two equal highs at $67,500 with a neckline at $64,000. Short entry on neckline break with target at $60,500 (pattern height = $3,500).',
  },
  {
    id: 'head_shoulders',
    terms: ['head and shoulders', 'head shoulders', 'inverse head and shoulders', 'h&s', 'ihs'],
    category: 'chart_patterns',
    name: 'Head and Shoulders',
    definition:
      'A reversal pattern with three peaks: left shoulder, higher head, right shoulder. The neckline connects the two troughs. A break below the neckline confirms the reversal. Inverse H&S is bullish.',
    howToUse:
      'Measure from head to neckline for the price target. Volume typically decreases on the right shoulder. The neckline break should have increased volume. Can also trade the retest of the broken neckline.',
    commonMistakes:
      'Forcing the pattern — not every three-bump formation is H&S. The shoulders should be roughly symmetrical. Trading before neckline confirmation leads to trapped positions.',
    example:
      'ETH forms H&S on daily: left shoulder at $3,800, head at $4,100, right shoulder at $3,750. Neckline at $3,400. Short on break below with target at $2,700.',
  },
  {
    id: 'bull_flag',
    terms: ['bull flag', 'bear flag', 'flag pattern', 'pennant', 'continuation pattern'],
    category: 'chart_patterns',
    name: 'Bull/Bear Flag',
    definition:
      'A continuation pattern where a strong move (flagpole) is followed by a brief consolidation (flag) in a parallel channel against the trend. Breakout continues the original direction.',
    howToUse:
      "Enter on breakout from the flag with a stop below the flag's low. Target = flagpole length projected from breakout point. Flags that form over 1-3 weeks tend to be most reliable.",
    commonMistakes:
      'Confusing a flag with a reversal. Flags should consolidate gently — steep pullbacks suggest selling pressure, not healthy consolidation. Volume should contract during the flag.',
    example:
      'AAPL rallies $15 (flagpole), then consolidates in a $3 range for 5 days with declining volume. Breakout above the flag on rising volume → target $15 above breakout.',
  },
  {
    id: 'triangle',
    terms: [
      'triangle',
      'ascending triangle',
      'descending triangle',
      'symmetrical triangle',
      'wedge',
      'falling wedge',
      'rising wedge',
    ],
    category: 'chart_patterns',
    name: 'Triangle Patterns',
    definition:
      'Converging trendlines showing compression. Ascending triangle (flat top, rising bottom) = bullish. Descending triangle (flat bottom, falling top) = bearish. Symmetrical = neutral, breaks either way.',
    howToUse:
      'Trade the breakout direction. Triangles compress volatility — the breakout often produces a strong move. Measure the widest part of the triangle for the target. Enter on the first candle close outside.',
    commonMistakes:
      'Entering inside the triangle before the breakout. False breakouts are common — wait for a close outside the triangle, not just a wick. Also, triangles that extend too long (>75% to apex) tend to fizzle.',
    example:
      'SOL forms ascending triangle with resistance at $150 and rising support. Price breaks above $150 on high volume → target = triangle height ($30) → $180.',
  },
  {
    id: 'engulfing',
    terms: ['engulfing', 'bullish engulfing', 'bearish engulfing', 'candlestick pattern'],
    category: 'chart_patterns',
    name: 'Engulfing Candles',
    definition:
      "A two-candle reversal pattern where the second candle's body completely engulfs the first. Bullish engulfing: red candle followed by larger green candle. Bearish engulfing: green followed by larger red.",
    howToUse:
      'Most powerful at key support/resistance levels. A bullish engulfing at a major support zone is a strong buy signal. Combine with volume — higher volume on the engulfing candle adds confidence.',
    commonMistakes:
      "Trading engulfing patterns in the middle of a range where they have less meaning. They're most significant at swing points, support/resistance levels, or after extended moves.",
    example:
      'BTC drops to $60,000 support. First candle: red, body $500. Second candle: green, body $1,200, fully engulfing → bullish reversal signal at support.',
  },
  {
    id: 'doji',
    terms: [
      'doji',
      'spinning top',
      'hammer',
      'shooting star',
      'hanging man',
      'inverted hammer',
      'morning star',
      'evening star',
    ],
    category: 'chart_patterns',
    name: 'Doji & Reversal Candles',
    definition:
      'Doji: open and close are nearly equal, showing indecision. Hammer: long lower wick at support = bullish. Shooting star: long upper wick at resistance = bearish. These signal potential reversals.',
    howToUse:
      'Doji after a trend signals exhaustion — wait for the next candle for confirmation. Hammers at support are buy signals. Shooting stars at resistance are sell signals. Always require confirmation.',
    commonMistakes:
      'Trading a single doji in isolation. Dojis show indecision, not direction. You need the following candle to confirm. A doji in the middle of a range is meaningless.',
    example:
      "ETH at $3,500 resistance prints a shooting star with 3x upper wick. Next candle closes red below the doji's low → bearish reversal confirmed.",
  },

  // ── Concepts ────────────────────────────────────────────────
  {
    id: 'support_resistance',
    terms: ['support', 'resistance', 'support and resistance', 's/r', 'key levels', 'price levels'],
    category: 'concepts',
    name: 'Support & Resistance',
    definition:
      'Price levels where buying (support) or selling (resistance) pressure historically concentrates. Support is a floor; resistance is a ceiling. When broken, support becomes resistance and vice versa.',
    howToUse:
      'Buy near support with a stop below. Sell/short near resistance with a stop above. The more times a level is tested, the more significant it becomes. Look for rejection wicks at these levels.',
    commonMistakes:
      'Treating S/R as exact prices rather than zones. S/R is a $50-$200 area, not a single price. Also, a level tested too many times (4+) is likely to break.',
    example:
      'BTC has bounced from $60,000 three times over two weeks. Fourth test with declining volume on each bounce → weakening support, prepare for a break.',
  },
  {
    id: 'market_structure',
    terms: [
      'market structure',
      'higher high',
      'higher low',
      'lower high',
      'lower low',
      'hh',
      'hl',
      'lh',
      'll',
      'trend structure',
      'break of structure',
      'bos',
      'choch',
    ],
    category: 'market_structure',
    name: 'Market Structure',
    definition:
      'The sequence of highs and lows that defines a trend. Uptrend = higher highs + higher lows. Downtrend = lower highs + lower lows. A break of structure (BOS) signals a potential trend change.',
    howToUse:
      'Trade with the structure: buy at higher lows in uptrends, sell at lower highs in downtrends. A change of character (CHoCH) — first lower low in an uptrend — is an early reversal signal.',
    commonMistakes:
      'Ignoring the higher timeframe structure while trading lower timeframe setups. A "breakout" on 5M means nothing if the 4H structure is bearish.',
    example:
      'SOL on 4H: HH at $155, HL at $142, HH at $160, HL at $148. Structure is bullish. Buy on the next pullback to a HL with stop below $148.',
  },
  {
    id: 'trend',
    terms: ['trend', 'uptrend', 'downtrend', 'trend line', 'trendline', 'trend following', 'trending market'],
    category: 'concepts',
    name: 'Trend',
    definition:
      'The overall direction of price movement over a sustained period. "The trend is your friend" — trading with the trend has significantly higher win rates than trading against it.',
    howToUse:
      "Identify the trend on a higher timeframe, then find entries on a lower timeframe in that direction. Use EMAs (20, 50, 200) to objectively define the trend. Don't fight the trend.",
    commonMistakes:
      'Trying to pick tops and bottoms instead of trading with the trend. Most profitable trading strategies involve riding established trends, not predicting reversals.',
    example:
      'BTC daily shows price above 20, 50, and 200 EMA → strong uptrend. On 4H, wait for pullback to the 20 EMA for trend continuation entries.',
  },
  {
    id: 'liquidity',
    terms: [
      'liquidity',
      'liquidity pool',
      'stop hunt',
      'liquidity grab',
      'smart money',
      'order block',
      'imbalance',
      'fair value gap',
      'fvg',
    ],
    category: 'concepts',
    name: 'Liquidity & Smart Money Concepts',
    definition:
      'Liquidity concentrates at obvious highs, lows, and round numbers where stop losses cluster. Institutional traders ("smart money") often drive price to these levels to fill large orders.',
    howToUse:
      'Anticipate stop hunts beyond obvious levels. Look for liquidity grabs (quick spikes that reverse) as entry signals. Fair value gaps (3-candle imbalances) often get filled.',
    commonMistakes:
      "Seeing smart money manipulation everywhere. Sometimes a breakout is just a breakout. Don't overcomplicate — use liquidity concepts to refine entries, not as a standalone strategy.",
    example:
      'BTC has equal lows at $62,000. Price sweeps below to $61,800, takes out stops, then reverses hard with a bullish engulfing → liquidity grab entry.',
  },
  {
    id: 'divergence',
    terms: ['divergence', 'bullish divergence', 'bearish divergence', 'hidden divergence', 'rsi divergence'],
    category: 'concepts',
    name: 'Divergence',
    definition:
      'When price and an indicator move in opposite directions. Regular divergence (price new high, indicator lower high) signals reversal. Hidden divergence (price higher low, indicator lower low) signals continuation.',
    howToUse:
      "Regular divergence is a reversal warning — don't enter immediately, wait for price confirmation. Hidden divergence confirms the existing trend. RSI and MACD are the best indicators for spotting divergence.",
    commonMistakes:
      "Acting on divergence without confirmation. Divergence can persist for a long time before price reacts. It's a warning signal, not an immediate trade trigger.",
    example:
      'ETH makes a new high at $4,000 but RSI makes a lower high (65 vs 72) → bearish divergence. Wait for a breakdown below the previous low to confirm the reversal.',
  },
  {
    id: 'breakout',
    terms: ['breakout', 'breakdown', 'false breakout', 'fakeout', 'breakout trading'],
    category: 'concepts',
    name: 'Breakouts',
    definition:
      'When price moves above resistance or below support with conviction. True breakouts lead to continuation moves. False breakouts (fakeouts) reverse quickly and trap traders.',
    howToUse:
      'Confirm breakouts with volume (2x+ average) and a candle close beyond the level. Consider entering on the retest of the broken level rather than chasing the initial breakout.',
    commonMistakes:
      'Chasing every breakout without confirmation. False breakouts are more common than real ones. Wait for volume confirmation and preferably a retest before entering.',
    example:
      'AAPL consolidates in $175-$180 range. Breakout above $180 on 2.5x average volume with a strong close at $182 → confirmed breakout. First pullback to $180 is a retest entry.',
  },
  {
    id: 'timeframes',
    terms: [
      'timeframe',
      'time frame',
      'multi timeframe',
      'mtf',
      'higher timeframe',
      'lower timeframe',
      '1m',
      '5m',
      '15m',
      '1h',
      '4h',
      'daily',
      'weekly',
    ],
    category: 'concepts',
    name: 'Multi-Timeframe Analysis',
    definition:
      'Analyzing charts across multiple timeframes to get a complete picture. Higher timeframes show the trend; lower timeframes refine entries. The higher timeframe always takes priority.',
    howToUse:
      'Use a top-down approach: identify trend on Weekly/Daily, find setups on 4H, time entries on 1H/15M. Never trade a lower timeframe signal that contradicts the higher timeframe trend.',
    commonMistakes:
      'Being bullish on the 5M chart while ignoring that the Daily is in a strong downtrend. Lower timeframe signals in the direction of the higher timeframe trend have much higher win rates.',
    example:
      'Daily: BTC uptrend above 20 EMA. 4H: Pullback to rising trendline. 1H: Bullish engulfing at the trendline → triple-timeframe confluence for a long entry.',
  },
  {
    id: 'consolidation',
    terms: ['consolidation', 'range', 'sideways', 'chop', 'choppy market', 'accumulation', 'distribution'],
    category: 'concepts',
    name: 'Consolidation & Ranges',
    definition:
      'A period where price moves sideways between defined support and resistance. Consolidation compresses energy for the next big move. Accumulation = buying by institutions. Distribution = selling.',
    howToUse:
      'In ranges, buy at support and sell at resistance. Or wait for the breakout. The longer the consolidation, the more powerful the eventual breakout. Use ATR to identify narrowing ranges.',
    commonMistakes:
      'Using trend strategies in a ranging market (getting chopped up by false signals). Identify the environment first, then choose your strategy accordingly.',
    example:
      'SOL consolidates between $130-$150 for three weeks with declining volume. ATR at historical lows → expect a major breakout. Wait for a close above $150 or below $130.',
  },

  // ── Risk Management ─────────────────────────────────────────
  {
    id: 'position_sizing',
    terms: ['position size', 'position sizing', 'lot size', 'how much to risk', 'risk per trade'],
    category: 'risk_management',
    name: 'Position Sizing',
    definition:
      'The process of determining how much capital to allocate per trade based on your risk tolerance and stop loss distance. The #1 factor in long-term trading survival.',
    howToUse:
      'Risk 1-2% of total capital per trade maximum. Position Size = (Account Risk $) / (Entry Price - Stop Loss Price). Use ATR-based stops for dynamic sizing.',
    commonMistakes:
      'Risking too much per trade (5%+ of account). Even a 60% win rate strategy will blow up with excessive position sizes. Consistent small risk = long-term survival.',
    example:
      'Account: $10,000. Risk 1% = $100 per trade. BTC entry at $65,000, stop at $64,000 (ATR-based). Position = $100 / $1,000 = 0.1 BTC.',
  },
  {
    id: 'stop_loss',
    terms: ['stop loss', 'stop', 'stoploss', 'sl', 'trailing stop', 'mental stop', 'hard stop'],
    category: 'risk_management',
    name: 'Stop Losses',
    definition:
      'A predetermined exit price that limits your loss on a trade. Stop losses are the foundation of risk management. Place them where your trade thesis is invalidated, not at arbitrary percentages.',
    howToUse:
      'Place stops at technical levels (below support for longs, above resistance for shorts). Use ATR to set stop distance. Trailing stops lock in profits as the trade moves in your favor.',
    commonMistakes:
      'Moving stops further away when price approaches them (hope trading). Another mistake: stops too tight (within normal volatility) that get triggered before the move plays out.',
    example:
      'Long ETH at $3,200 with support at $3,100. Stop at $3,080 (below support with buffer). If ETH moves to $3,500, trail stop to $3,350 (below the last higher low).',
  },
  {
    id: 'risk_reward',
    terms: ['risk reward', 'risk/reward', 'r/r', 'rr', 'risk to reward', 'r:r', 'reward ratio'],
    category: 'risk_management',
    name: 'Risk-to-Reward Ratio',
    definition:
      'The ratio of potential loss (risk) to potential gain (reward). A 1:3 R:R means you risk $1 to make $3. Higher R:R ratios mean you can be profitable even with a lower win rate.',
    howToUse:
      "Only take trades with at least 1:2 R:R. At 1:3 R:R, you only need a 25% win rate to break even. Calculate R:R before entering every trade — if the math doesn't work, skip it.",
    commonMistakes:
      'Setting unrealistic targets to force a good R:R ratio. Your target should be at a logical level (next resistance, measured move), not an arbitrary multiple of your risk.',
    example:
      'Risk $200 (1% of $20K account). Target at next resistance $600 away → R:R = 1:3. If you win 40% of these trades: (4 × $600) - (6 × $200) = $1,200 profit per 10 trades.',
  },
  {
    id: 'kelly_criterion',
    terms: ['kelly', 'kelly criterion', 'optimal bet size', 'kelly formula'],
    category: 'risk_management',
    name: 'Kelly Criterion',
    definition:
      'A mathematical formula for optimal bet sizing: f* = (W × R - L) / R, where W = win rate, L = loss rate, R = ratio of avg win to avg loss. It maximizes long-term account growth.',
    howToUse:
      'Most traders use half-Kelly (50% of the calculated amount) for safety. If Kelly suggests 10%, risk 5%. Kelly assumes accurate stats — you need at least 50+ trades to calculate reliably.',
    commonMistakes:
      'Using full Kelly — it produces maximum theoretical growth but with extreme drawdowns. Half-Kelly gives ~75% of the growth with dramatically smoother equity curves.',
    example:
      'Win rate: 55%, Avg win: $300, Avg loss: $200. R = 1.5. Kelly = (0.55 × 1.5 - 0.45) / 1.5 = 25%. Half-Kelly = 12.5% of account per trade.',
  },
  {
    id: 'drawdown',
    terms: ['drawdown', 'max drawdown', 'mdd', 'equity curve', 'recovery'],
    category: 'risk_management',
    name: 'Drawdown',
    definition:
      'The peak-to-trough decline in account equity, measured as a percentage. Max drawdown is the worst-case scenario. A 50% drawdown requires a 100% gain to recover.',
    howToUse:
      'Track your drawdown religiously. Set a max drawdown rule (e.g., stop trading after -10% in a day or -20% in a month). Smaller position sizes = smaller drawdowns = easier recovery.',
    commonMistakes:
      'Increasing position size to "make it back" after a drawdown. This almost always makes it worse. The correct response is to reduce size and focus on process, not P&L.',
    example:
      'Account drops from $10K to $8K = 20% drawdown. To recover, you need 25% gain ($2K on $8K). If you had risked 1% per trade, max 10-loss streak = -10% drawdown → needs only 11% to recover.',
  },
  {
    id: 'portfolio_risk',
    terms: ['portfolio risk', 'correlation', 'diversification', 'concentration risk', 'hedging'],
    category: 'risk_management',
    name: 'Portfolio Risk & Correlation',
    definition:
      "The total risk exposure across all open positions. Correlated assets (e.g., BTC and ETH) count as similar risk — having 5 crypto positions isn't diversified if they all move together.",
    howToUse:
      "Limit total portfolio risk to 5-6% at any time. Count correlated positions as a single risk unit. If you're long 3 crypto positions, your real exposure is closer to 1 large position.",
    commonMistakes:
      "Thinking you're diversified because you hold 10 different crypto assets. If they're all correlated 0.8+ with BTC, you effectively have one big BTC position.",
    example:
      'Long BTC (2% risk), ETH (2% risk), SOL (2% risk). Correlation: ETH-BTC 0.85, SOL-BTC 0.75. Effective portfolio risk is closer to 4-5%, not the theoretical 6%.',
  },

  // ── Psychology ──────────────────────────────────────────────
  {
    id: 'fomo',
    terms: ['fomo', 'fear of missing out', 'chasing', 'chase trades'],
    category: 'psychology',
    name: 'FOMO (Fear of Missing Out)',
    definition:
      "The anxiety that you'll miss a profitable trade, leading to impulsive entries without proper analysis. FOMO entries typically have worse timing, wider stops, and lower win rates.",
    howToUse:
      "When you feel FOMO, that's a signal to pause. If a trade has moved significantly, the risk/reward is usually poor. Missed trades are free — FOMO trades cost money. Wait for pullbacks.",
    commonMistakes:
      'Entering a trade after it\'s already moved 5-10% because "it might go higher." By this point, you\'re buying what others are selling. The best entries come from patience, not panic.',
    example:
      'BTC pumps from $60K to $65K in an hour. FOMO screams "buy now!" Disciplined approach: wait for a pullback to $63K (38.2% fib) or the 20 EMA for a better entry.',
  },
  {
    id: 'revenge_trading',
    terms: ['revenge trading', 'revenge trade', 'tilt', 'emotional trading', 'overtrading after loss'],
    category: 'psychology',
    name: 'Revenge Trading',
    definition:
      'Taking impulsive trades to recover losses, usually with larger size and less planning. The emotional need to "get back" money leads to progressively worse decisions and larger losses.',
    howToUse:
      'Set a daily loss limit (e.g., 3% of account) that triggers a mandatory break. After a losing streak, reduce position size to minimum before gradually returning to normal size.',
    commonMistakes:
      'Doubling position size after a loss to "make it back." This is the #1 account killer. Accept losses as a normal cost of business and stick to your plan.',
    example:
      'After 3 consecutive losses (-$450), you feel the urge to enter a 3x position to recover. Stop. Walk away. Come back tomorrow with normal sizing.',
  },
  {
    id: 'overtrading',
    terms: ['overtrading', 'overtrade', 'too many trades', 'trading addiction', 'boredom trading'],
    category: 'psychology',
    name: 'Overtrading',
    definition:
      'Taking too many trades, often out of boredom, excitement, or the need to be "active." Quality setups are rare — most market time should be spent waiting, not trading.',
    howToUse:
      "Set a maximum number of trades per day/week. Keep a trading journal to track which trades were A+ setups vs. boredom trades. Review your stats — you'll likely find fewer trades = more profit.",
    commonMistakes:
      "Equating screen time with productivity. The best traders spend 90% of their time waiting and 10% executing. Not every day has a trade — and that's okay.",
    example:
      'You take 15 trades/week but only 4 are A+ setups. The other 11 average -$50 each (-$550). If you only took the 4 A+ setups: +$200 each = +$800. Net difference: $1,350.',
  },
  {
    id: 'trading_plan',
    terms: ['trading plan', 'trade plan', 'rules', 'trading rules', 'trading system', 'edge'],
    category: 'psychology',
    name: 'Trading Plan',
    definition:
      'A written document defining your strategy, entry/exit rules, risk management, and performance goals. A trading plan removes emotion from decision-making by pre-defining your actions.',
    howToUse:
      'Write your plan before the market opens. Include: what you trade, when you trade, entry criteria, exit criteria, position sizing rules, and daily limits. Follow it religiously.',
    commonMistakes:
      'Having a plan but not following it when emotions kick in. Having a plan you never review or update. A trading plan is a living document — update it monthly based on your results.',
    example:
      'Plan: Trade only BTC and ETH on 4H. Entry: breakout of consolidation with volume confirmation. Stop: below consolidation. Target: 1:3 R:R. Max 2 trades/day. Stop after -2% daily.',
  },
  {
    id: 'patience',
    terms: ['patience', 'waiting', 'sitting on hands', 'discipline', 'trading discipline'],
    category: 'psychology',
    name: 'Patience & Discipline',
    definition:
      "The ability to wait for high-probability setups and follow your plan without deviation. Patience means missing good trades sometimes — and that's okay because it avoids many bad ones.",
    howToUse:
      "Create a pre-trade checklist with 3-5 criteria. If the setup doesn't meet all criteria, don't trade. Review your journal — you'll find that your most profitable trades all had one thing in common: patience.",
    commonMistakes:
      "Confusing patience with inaction. Patience is an active decision to wait for ideal conditions. It's not about never trading; it's about only trading when conditions align with your edge.",
    example:
      'Your system requires: trend alignment + support/resistance + volume confirmation. A chart shows trend + S/R but low volume. Wait. The trade comes tomorrow with volume → stronger setup.',
  },
  {
    id: 'loss_aversion',
    terms: ['loss aversion', 'holding losers', 'cutting winners', 'prospect theory', 'letting losers run'],
    category: 'psychology',
    name: 'Loss Aversion',
    definition:
      'The tendency to feel losses 2x more than equivalent gains. This causes traders to hold losing trades (hoping for recovery) while cutting winning trades (locking in the pleasure of profit).',
    howToUse:
      'Use hard stop losses to override the psychological tendency to hold losers. Use trailing stops to let winners run. Pre-set your exit points before entering a trade.',
    commonMistakes:
      'Moving your stop loss further away as price approaches it ("just give it more room"). This is loss aversion in action — accept the loss and move on to the next trade.',
    example:
      "You're up $500 on a trade with a target of $1,500. The urge to take profit is strong. Trust your plan — the target was set for a reason. Let the trailing stop protect you.",
  },
  {
    id: 'journaling',
    terms: ['journaling', 'trading journal', 'trade journal', 'trade log', 'review trades'],
    category: 'psychology',
    name: 'Trade Journaling',
    definition:
      "Recording every trade with entries, exits, reasoning, emotions, and outcome. Journaling turns random trading into a systematic feedback loop. It's how you discover your edge (or lack of one).",
    howToUse:
      'Log every trade: date, symbol, setup type, entry/exit prices, P&L, screenshot, emotional state, and what you learned. Review weekly. After 50+ trades, patterns in your behavior become clear.',
    commonMistakes:
      'Only journaling winning trades (confirmation bias). Only logging numbers without context (what were you thinking/feeling?). Journaling but never reviewing. The review is where the value lies.',
    example:
      'After 100 journaled trades, you discover: breakout trades at the London open have a 72% win rate, but reversal trades after 2pm have only 35%. Adjust your strategy accordingly.',
  },

  // ── Order Types ─────────────────────────────────────────────
  {
    id: 'market_order',
    terms: ['market order', 'market buy', 'market sell', 'instant order'],
    category: 'order_types',
    name: 'Market Order',
    definition:
      'An order to buy or sell immediately at the current market price. Guarantees execution but not price — you may get slippage, especially in low-liquidity markets or during volatile moments.',
    howToUse:
      'Use market orders when speed matters more than price — entering/exiting during fast moves, managing risk (closing a losing position). For planned entries at specific levels, use limit orders.',
    commonMistakes:
      "Using market orders on low-liquidity assets where the spread is wide. A $0.50 spread on a $20 stock means you're immediately down 2.5%. Check the order book first.",
    example:
      'BTC flash-crashes and hits your support zone. Spread is tight (0.01%). Market buy is appropriate here because speed matters — a limit order might miss the bounce.',
  },
  {
    id: 'limit_order',
    terms: ['limit order', 'limit buy', 'limit sell', 'limit price'],
    category: 'order_types',
    name: 'Limit Order',
    definition:
      'An order to buy or sell at a specific price or better. Buy limits below current price; sell limits above. You control the price but not the timing — the order may never be filled.',
    howToUse:
      "Place buy limit orders at support levels or fib retracements for planned entries. Place sell limit orders at resistance for targets. Set GTC (Good Till Cancelled) so you don't have to watch constantly.",
    commonMistakes:
      "Setting limit orders at exact round numbers where everyone else's orders are. Place your buy limits slightly above the level (e.g., $3,010 instead of $3,000) for better fill probability.",
    example:
      "BTC support at $65,000. Set a buy limit at $65,050 (above the obvious level) with a stop at $64,500. If price dips, you get filled; if it doesn't, you don't chase.",
  },
  {
    id: 'take_profit',
    terms: ['take profit', 'tp', 'target', 'price target', 'profit target', 'scaling out'],
    category: 'order_types',
    name: 'Take Profit & Scaling Out',
    definition:
      'A predetermined price level where you close a winning position. Scaling out means closing partial positions at multiple targets. This locks in partial profits while letting the remainder run.',
    howToUse:
      'Set TP at logical levels: next S/R, measured move, or fib extension. Scale out: close 50% at 1:1 R:R, 25% at 1:2 R:R, let 25% run with a trailing stop. This smooths your equity curve.',
    commonMistakes:
      'Not having a take profit plan leads to watching winners turn into losers. On the flip side, taking profit too early on every trade (at 1:1) reduces overall profitability.',
    example:
      'Long BTC at $64,000 with $1,000 stop. TP1: $65,000 (1:1, close 50%). TP2: $66,000 (1:2, close 25%). Final TP: trail stop at $1,500 on remaining 25%.',
  },

  // ── More Concepts ───────────────────────────────────────────
  {
    id: 'confluence',
    terms: ['confluence', 'confluence zone', 'stacked levels', 'multiple signals'],
    category: 'concepts',
    name: 'Confluence',
    definition:
      'When multiple independent signals align at the same price level. A support level that coincides with a fib retracement, an EMA, and a trendline is a high-confluence zone and a much stronger signal.',
    howToUse:
      'Look for 2-3+ confluent factors before entering a trade. More confluence = higher probability. Rank your signals: price action > volume > indicators > secondary tools.',
    commonMistakes:
      "Mistaking redundant signals for confluence. RSI and stochastic are both momentum oscillators — they're not independent. True confluence uses different types of analysis.",
    example:
      'ETH at $3,200: 61.8% fib + 200 EMA + previous support + volume POC + bullish divergence on RSI = 5-factor confluence. This is an A+ entry.',
  },
  {
    id: 'gap',
    terms: ['gap', 'gap fill', 'opening gap', 'breakaway gap', 'exhaustion gap', 'gap up', 'gap down'],
    category: 'concepts',
    name: 'Price Gaps',
    definition:
      "A price gap occurs when a candle opens significantly above/below the previous close, leaving a gap on the chart. Most gaps fill (price returns) eventually, but not all. Breakaway gaps often don't fill for a long time.",
    howToUse:
      'Gap-fill strategy: trade toward the gap fill. Breakaway gap: trade in the gap direction. Gap + volume increase = likely continuation. Gap + volume decrease = likely fill.',
    commonMistakes:
      'Assuming all gaps must fill immediately. Breakaway gaps that form on major news or earnings may never fill. Context matters more than the "gaps always fill" rule.',
    example:
      "AAPL gaps up 5% on earnings with 4x average volume. This is a breakaway gap — don't short for the fill. Instead, wait for a pullback and buy the dip.",
  },
  {
    id: 'volatility',
    terms: ['volatility', 'vol', 'implied volatility', 'iv', 'historical volatility', 'vix'],
    category: 'concepts',
    name: 'Volatility',
    definition:
      'A measure of price variation over time. High volatility = large price swings. Low volatility = small swings. Volatility tends to mean-revert: high vol is followed by low vol, and vice versa. VIX measures S&P 500 implied volatility.',
    howToUse:
      'Use Bollinger Band width or ATR to measure volatility. Low vol environments are best for breakout strategies. High vol environments are best for mean reversion. Adjust position size based on volatility.',
    commonMistakes:
      'Using the same position size regardless of volatility. When volatility doubles, halve your position size to maintain consistent risk per trade.',
    example:
      'BTC Bollinger Bands at their tightest in 60 days (low vol). History shows this leads to a large expansion move. Position for a breakout but use smaller size since direction is uncertain.',
  },
  {
    id: 'backtesting',
    terms: ['backtest', 'backtesting', 'forward test', 'paper trading', 'demo trading', 'simulation'],
    category: 'concepts',
    name: 'Backtesting & Paper Trading',
    definition:
      "Testing a trading strategy on historical data (backtesting) or in real-time without real money (paper trading). This validates your edge before risking capital. A strategy that doesn't work in backtest won't work live.",
    howToUse:
      'Backtest with at least 100+ trades across different market conditions. Then paper trade for 2-4 weeks. Then go live with minimum size. Only scale up after proving consistency.',
    commonMistakes:
      'Overfitting: optimizing parameters until the backtest looks perfect, but it fails live because it was tailored to historical data. Use out-of-sample testing. Also: ignoring slippage and fees.',
    example:
      'Backtest your EMA crossover strategy on 5 years of BTC data. Results: 55% win rate, 1:2 R:R, 180 trades. Paper trade for a month. If results match within 10%, go live with minimum size.',
  },
  {
    id: 'expectancy',
    terms: ['expectancy', 'expected value', 'edge', 'trading edge', 'ev', 'positive expectancy'],
    category: 'risk_management',
    name: 'Trading Expectancy',
    definition:
      "The average amount you expect to win or lose per trade. Formula: (Win Rate × Avg Win) - (Loss Rate × Avg Loss). A positive expectancy means you'll be profitable over a large sample of trades.",
    howToUse:
      'Calculate your expectancy from your last 50-100 trades. If negative, fix your strategy before trading more. Even a small positive expectancy compounds powerfully over hundreds of trades.',
    commonMistakes:
      'Judging a strategy by individual trades instead of expectancy. A 40% win rate strategy can be very profitable with 1:3 R:R. Focus on the math, not the feelings.',
    example:
      'Win rate: 45%, Avg win: $400, Avg loss: $200. Expectancy = (0.45 × $400) - (0.55 × $200) = $180 - $110 = +$70 per trade. Over 100 trades = +$7,000.',
  },
  {
    id: 'slippage',
    terms: ['slippage', 'spread', 'bid ask', 'bid-ask spread', 'execution price', 'fills'],
    category: 'concepts',
    name: 'Slippage & Spread',
    definition:
      'Slippage is the difference between your expected price and actual fill price. Spread is the gap between bid and ask prices. Both are costs that reduce profitability, especially on frequent trades.',
    howToUse:
      'Account for slippage in your backtest (add 0.1-0.5% depending on the asset). Use limit orders to minimize slippage. Avoid trading during extreme volatility when spreads widen significantly.',
    commonMistakes:
      'Ignoring execution costs when evaluating a strategy. A scalping strategy with $10 average profit per trade and $5 in slippage + fees only nets $5 — halving your expected performance.',
    example:
      'Your backtest shows $50 avg profit per trade. Live trading shows $35. The $15 difference is slippage ($5) + spread ($5) + fees ($5). Adjust your system to account for these costs.',
  },

  // ── Market Structure (additional) ───────────────────────────
  {
    id: 'supply_demand',
    terms: ['supply zone', 'demand zone', 'supply and demand', 'order flow', 'institutional levels'],
    category: 'market_structure',
    name: 'Supply & Demand Zones',
    definition:
      'Price zones where institutional buying (demand) or selling (supply) caused a sharp move away. When price returns to these zones, it often reacts because unfilled orders may remain.',
    howToUse:
      'Mark zones from the last candle(s) before a sharp move. Demand zones: last bearish candle before a strong rally. Supply zones: last bullish candle before a strong drop. Trade the first retest.',
    commonMistakes:
      "Every support and resistance level is NOT a supply/demand zone. True zones have a strong departure — a weak bounce doesn't create a reliable zone. Quality over quantity.",
    example:
      'BTC consolidates at $62,000, then rockets to $68,000. The $62,000 zone is a demand zone. First retest of $62,000-$62,500 is a high-probability long entry.',
  },
  {
    id: 'wyckoff',
    terms: ['wyckoff', 'wyckoff accumulation', 'wyckoff distribution', 'composite operator', 'spring', 'upthrust'],
    category: 'market_structure',
    name: 'Wyckoff Method',
    definition:
      'A framework for understanding institutional accumulation and distribution. Accumulation: smart money buying during a range. Distribution: smart money selling during a range. Both precede major trend moves.',
    howToUse:
      'Look for the Wyckoff "spring" (a brief break below support that reverses) in accumulation — it\'s a high-probability long entry. In distribution, look for the "upthrust" (brief break above resistance that fails).',
    commonMistakes:
      "Trying to identify Wyckoff phases in real-time is very difficult. It's easier to identify in hindsight. Use Wyckoff as a mental model for understanding institutional behavior, not as a precise trading system.",
    example:
      'BTC ranges between $55K-$60K for weeks = possible accumulation. Price briefly drops to $54.5K (spring), then rockets back above $55K with volume → Wyckoff spring entry.',
  },
  {
    id: 'elliott_wave',
    terms: ['elliott wave', 'wave count', 'impulse wave', 'corrective wave', 'wave theory', '5 wave', '3 wave'],
    category: 'market_structure',
    name: 'Elliott Wave Theory',
    definition:
      'A theory that markets move in predictable wave patterns: 5 waves in the trend direction (impulse) followed by 3 waves against (correction). Wave 3 is typically the strongest and longest.',
    howToUse:
      'Use wave structure to anticipate where you are in a trend cycle. Wave 3 (strongest) offers the best risk/reward. Wave 5 is often the final push before a reversal. Correct more like guidelines than rules.',
    commonMistakes:
      'Over-relying on wave counts — different analysts can count waves differently on the same chart. Wave theory becomes an exercise in subjectivity. Use it as a supporting tool, not primary analysis.',
    example:
      'After a clear wave 1 (initial rally) and wave 2 (pullback to 50-61.8%), anticipate wave 3 (strongest move). Enter on the wave 2 pullback for the best risk/reward.',
  },

  // ── Phase 2 Task #23: Expanded Entries ─────────────────────

  // ── More Indicators ────────────────────────────────────────
  {
    id: 'ichimoku',
    terms: ['ichimoku', 'ichimoku cloud', 'kumo', 'tenkan', 'kijun', 'senkou span', 'chikou'],
    category: 'indicators',
    name: 'Ichimoku Cloud',
    definition:
      'A comprehensive indicator system showing support/resistance, trend direction, and momentum in one view. The "cloud" (Kumo) acts as dynamic S/R. Price above the cloud = bullish; below = bearish.',
    howToUse:
      'Tenkan-Sen crossing above Kijun-Sen is bullish. Cloud color flips signal trend changes. Use the cloud as a trailing stop zone. Works best on 4H and Daily timeframes.',
    commonMistakes:
      'Using Ichimoku on low timeframes (1M, 5M) where it generates too much noise. Also, ignoring the Chikou Span (lagging span) which confirms or denies current signals.',
    example:
      'BTC price breaks above the Ichimoku cloud on the Daily. Tenkan (red) crosses above Kijun (blue). Cloud turns green ahead → strong bullish confluence for a long entry.',
  },
  {
    id: 'rvi',
    terms: ['rvi', 'relative vigor index', 'vigor'],
    category: 'indicators',
    name: 'Relative Vigor Index (RVI)',
    definition:
      'Compares closing prices relative to the trading range. Based on the idea that prices tend to close higher in uptrends and lower in downtrends. Oscillates around a center line.',
    howToUse:
      'RVI crossing above its signal line is bullish. Best used with trend confirmation tools. Divergences between RVI and price work similarly to RSI divergences.',
    commonMistakes: "Using RVI alone without trend context. It's a confirming indicator, not a standalone signal.",
    example:
      'ETH in an uptrend. RVI crosses above signal line while price bounces off the 20 EMA → confluence for a continuation long.',
  },
  {
    id: 'cmf',
    terms: ['cmf', 'chaikin money flow', 'money flow', 'accumulation distribution'],
    category: 'indicators',
    name: 'Chaikin Money Flow (CMF)',
    definition:
      'Measures buying/selling pressure over a period. Positive CMF = accumulation (buying). Negative CMF = distribution (selling). Values range from -1 to +1.',
    howToUse:
      'CMF above zero confirms bullish moves. Divergences between CMF and price signal potential reversals. Rising CMF with rising price = strong trend.',
    commonMistakes:
      'Ignoring that CMF is volume-dependent — low-volume periods produce unreliable readings. Best used on liquid markets with consistent volume.',
    example:
      'AAPL breaks out above resistance while CMF rises from -0.05 to +0.15 → strong buying pressure confirms the breakout.',
  },
  {
    id: 'parabolic_sar',
    terms: ['parabolic sar', 'sar', 'stop and reverse', 'parabolic'],
    category: 'indicators',
    name: 'Parabolic SAR',
    definition:
      'Dots above or below price that indicate trend direction and potential reversal points. Dots below price = bullish. Dots above = bearish. When dots flip, the trend may be reversing.',
    howToUse:
      'Use SAR dots as trailing stop levels. In trends, SAR provides natural exit points. Combine with ADX — only follow SAR signals when ADX > 25 (trending).',
    commonMistakes:
      "Using Parabolic SAR in ranging markets where it whipsaws constantly. It's a trend tool — verify the trend exists before using it.",
    example:
      'SOL is trending up with SAR dots below price. Dots accelerate as the trend strengthens. When dots flip above price at $155, exit long → trend reversal signal.',
  },
  {
    id: 'williams_r',
    terms: ['williams %r', 'williams r', 'williams percent range', '%r'],
    category: 'indicators',
    name: 'Williams %R',
    definition:
      'A momentum oscillator measuring overbought/oversold conditions (-100 to 0). Above -20 = overbought. Below -80 = oversold. Similar to stochastic but inverted scale.',
    howToUse:
      'In ranges, buy when %R dips below -80 and starts rising. In trends, use only trend-aligned signals. Divergences work similarly to RSI.',
    commonMistakes: "Same as stochastic — don't counter-trade in strong trends just because %R says overbought.",
    example:
      'BTC in an uptrend. Williams %R drops to -85 during a pullback, then crosses back above -80 → pullback entry in the trend.',
  },
  {
    id: 'cci',
    terms: ['cci', 'commodity channel index'],
    category: 'indicators',
    name: 'CCI (Commodity Channel Index)',
    definition:
      'Measures price deviation from its statistical mean. Readings above +100 indicate overbought; below -100 indicate oversold. Originally for commodities but works on all assets.',
    howToUse:
      'CCI crossing above +100 can signal a strong uptrend starting. Crossing below -100 can signal a strong downtrend. Use for trend identification rather than reversal trading.',
    commonMistakes:
      'Treating +100/-100 as reversal levels. CCI can stay extreme for extended periods in strong trends.',
    example:
      'ETH CCI rises above +100 on the 4H as price breaks resistance → new uptrend confirmation. Stay long until CCI drops below +100.',
  },
  {
    id: 'pivot_points',
    terms: ['pivot point', 'pivot', 'pivot levels', 'r1', 'r2', 's1', 's2', 'daily pivot'],
    category: 'indicators',
    name: 'Pivot Points',
    definition:
      "Calculated S/R levels based on the previous session's high, low, and close. The central pivot (PP) acts as the day's bias level. R1, R2 are resistance targets; S1, S2 are support targets.",
    howToUse:
      'Price above the daily pivot = bullish bias. Target R1 for longs. Price below pivot = bearish bias. Target S1 for shorts. Used heavily by institutional and algorithmic traders.',
    commonMistakes:
      'Not accounting for the session used to calculate pivots (use the session relevant to your market). Pivots are most useful for intraday trading.',
    example:
      'BTC opens above the daily pivot at $64,800. First pullback to the pivot holds → long entry targeting R1 at $65,500.',
  },

  // ── More Chart Patterns ────────────────────────────────────
  {
    id: 'cup_handle',
    terms: ['cup and handle', 'cup handle', 'cup pattern', 'rounding bottom'],
    category: 'chart_patterns',
    name: 'Cup and Handle',
    definition:
      'A bullish continuation pattern shaped like a tea cup. The "cup" is a rounded bottom, the "handle" is a small pullback. Breakout above the handle\'s high confirms the pattern.',
    howToUse:
      'Enter on breakout above the handle with volume confirmation. Target = cup depth added to the breakout level. Handle should retrace 1/3 to 1/2 of the cup.',
    commonMistakes:
      'Forcing the pattern on V-shaped bottoms (should be rounded). The handle should be smaller than the cup — a deep handle invalidates the pattern.',
    example:
      'AAPL forms a 3-month cup from $150 to $170. Handle pulls back to $165. Breakout above $170 on high volume → target $190 (cup depth = $20).',
  },
  {
    id: 'three_drives',
    terms: ['three drives', 'three drives pattern', 'harmonic pattern', 'gartley', 'bat pattern', 'butterfly pattern'],
    category: 'chart_patterns',
    name: 'Harmonic Patterns',
    definition:
      'Geometric price patterns based on Fibonacci ratios. Include Gartley, Bat, Butterfly, and Three Drives. They identify potential reversal zones where multiple fib levels converge.',
    howToUse:
      'Wait for the pattern to complete at the D point (potential reversal zone). Enter with tight stops beyond the PRZ. These work best in ranging or corrective markets.',
    commonMistakes:
      'Forcing harmonics onto every chart. The fib ratios must be precise — approximate patterns have lower reliability. Also requires patience as patterns take time to form.',
    example:
      'A Bat pattern on ETH 4H completes at the D leg ($3,100) with 88.6% retracement. Combined with a demand zone → high-conviction long entry.',
  },
  {
    id: 'island_reversal',
    terms: ['island reversal', 'island top', 'island bottom', 'gap reversal'],
    category: 'chart_patterns',
    name: 'Island Reversal',
    definition:
      'A price cluster isolated by gaps on both sides, creating an "island." An island top (gap up, consolidation, gap down) is strongly bearish. Island bottom is strongly bullish.',
    howToUse:
      'Rare but reliable. Trade in the gap direction on the second gap. The island acts as strong S/R going forward. Volume typically confirms.',
    commonMistakes:
      "These are rare — don't search for them actively. They appear after exhaustion moves. In crypto, true gaps are rare (24/7 markets), so look for gap equivalents.",
    example:
      'TSLA gaps up to $260 on hype, trades there for 2 days, then gaps down to $248 → island top. Strong bearish signal; target the pre-rally low.',
  },
  {
    id: 'three_candle',
    terms: [
      'three white soldiers',
      'three black crows',
      'three inside up',
      'three inside down',
      'three candle pattern',
    ],
    category: 'chart_patterns',
    name: 'Three-Candle Patterns',
    definition:
      'Three White Soldiers: three consecutive bullish candles with higher closes → strong bullish reversal. Three Black Crows: three consecutive bearish candles → strong bearish reversal.',
    howToUse:
      'Most powerful after a trend or at key levels. Each candle should close near its high (soldiers) or low (crows). Diminishing candle size on the third suggests weakening momentum.',
    commonMistakes:
      'Ignoring the context — three white soldiers in the middle of a downtrend may just be a bear flag. Always check higher timeframe bias.',
    example:
      'BTC at $62,000 support. Three consecutive bullish candles, each closing higher with increasing volume → three white soldiers. Strong reversal signal.',
  },

  // ── Crypto-Specific ────────────────────────────────────────
  {
    id: 'funding_rate',
    terms: ['funding rate', 'funding', 'perp funding', 'perpetual swap', 'perps'],
    category: 'concepts',
    name: 'Funding Rate (Crypto)',
    definition:
      'A periodic payment between long and short traders on perpetual swaps to keep the price anchored to spot. Positive funding = longs pay shorts (market is overleveraged long). Negative = shorts pay longs.',
    howToUse:
      'Extremely high positive funding often precedes a long squeeze (dump). Extremely negative funding precedes a short squeeze (pump). Use funding as a contrarian sentiment indicator.',
    commonMistakes:
      'Trading based on funding alone — high funding can persist for days. Use it as confluence with other signals, not as a standalone trigger.',
    example:
      'BTC funding rate spikes to 0.05% per 8 hours (very high). Price at resistance. Overleveraged longs → high probability of a flush to liquidate positions.',
  },
  {
    id: 'open_interest',
    terms: ['open interest', 'oi', 'open interest delta', 'futures open interest'],
    category: 'concepts',
    name: 'Open Interest',
    definition:
      'The total number of outstanding derivative contracts. Rising OI + rising price = new longs entering (bullish). Rising OI + falling price = new shorts entering (bearish). Falling OI = positions closing.',
    howToUse:
      'OI spikes near key levels signal potential for liquidation cascades. Use OI divergences: price up + OI down = rally driven by short covering (weak). Price up + OI up = fresh longs (strong).',
    commonMistakes:
      'Confusing OI with volume. OI measures outstanding positions; volume measures traded contracts. They can diverge significantly.',
    example:
      'BTC at $65K resistance. OI rising sharply = lots of new positions being opened. If price breaks above, short liquidations create a cascade → violent breakout.',
  },
  {
    id: 'liquidation',
    terms: ['liquidation', 'liquidation cascade', 'liquidation heatmap', 'forced liquidation', 'margin call'],
    category: 'concepts',
    name: 'Liquidation Cascades',
    definition:
      'When leveraged positions are forcibly closed, creating aggressive buying (short liquidation) or selling (long liquidation). Liquidations fuel rapid price moves as forced orders hit the market.',
    howToUse:
      'Use liquidation heatmaps to identify where stop losses cluster. Price tends to hunt these levels. After a large liquidation event, the move often reverses (excess cleared).',
    commonMistakes:
      'Getting caught in a liquidation cascade by using too much leverage. Use 2-5x max for crypto. Higher leverage = closer liquidation price = higher risk.',
    example:
      '$500M in long liquidations between $62K-$63K on the BTC heatmap. Price drops to $62,500, triggers the cascade, flushes to $61,800, then reverses sharply → the flush is the entry.',
  },
  {
    id: 'defi_yield',
    terms: ['defi', 'yield farming', 'liquidity pool', 'impermanent loss', 'apy', 'tvl', 'total value locked'],
    category: 'concepts',
    name: 'DeFi & Yield Farming',
    definition:
      'Decentralized Finance protocols that offer yield for providing liquidity. APY can range from 5% to 1000%+. Higher APY = higher risk. TVL (Total Value Locked) measures protocol adoption.',
    howToUse:
      'Compare APY against impermanent loss risk. Stablecoin pools have lower IL. Use TVL trends as a health metric — declining TVL often precedes token price drops.',
    commonMistakes:
      'Chasing extremely high APYs without understanding the risks (smart contract bugs, token inflation, rug pulls). Sustainable yields are typically 5-20% on major protocols.',
    example:
      'ETH-USDC pool offering 15% APY on Uniswap with $500M TVL → relatively safe. A new protocol offering 500% APY with $2M TVL → extremely risky.',
  },
  {
    id: 'onchain',
    terms: [
      'on-chain',
      'on chain',
      'blockchain analysis',
      'whale watching',
      'whale wallet',
      'exchange flow',
      'net flow',
    ],
    category: 'concepts',
    name: 'On-Chain Analysis',
    definition:
      'Analyzing blockchain data (wallet movements, exchange flows, active addresses) for trading signals. Large inflows to exchanges suggest selling; outflows suggest accumulation.',
    howToUse:
      'Track whale wallets for large moves. Exchange net flow (inflows - outflows) declining = bullish (less selling pressure). NUPL, SOPR, and MVRV are key on-chain valuation metrics.',
    commonMistakes:
      'On-chain data can be misleading — an exchange inflow might be for trading, not selling. Use on-chain as one piece of a larger analysis framework.',
    example:
      '10,000 BTC moved to cold storage from Coinbase → bullish accumulation signal. Combined with declining exchange reserves → reducing sell-side supply.',
  },
  {
    id: 'correlation_crypto',
    terms: ['btc dominance', 'bitcoin dominance', 'alt season', 'altcoin season', 'crypto correlation', 'btc.d'],
    category: 'concepts',
    name: 'BTC Dominance & Alt Season',
    definition:
      'BTC dominance measures Bitcoin\'s market cap relative to total crypto. Rising BTC.D = money flowing to BTC (risk-off). Falling BTC.D = money flowing to alts (risk-on, "alt season").',
    howToUse:
      'When BTC.D peaks and starts declining while BTC price is stable/rising → alt season beginning. When BTC.D rises sharply → flee to safety (sell alts for BTC or stablecoins).',
    commonMistakes:
      'Buying random altcoins during alt season without selectivity. Even in alt season, many alts underperform. Focus on projects with strong narratives and volume.',
    example:
      'BTC.D drops from 52% to 48% over 2 weeks while ETH/BTC rises → alt season signal. Rotate into high-beta alts like SOL, AVAX.',
  },
  {
    id: 'tokenomics',
    terms: ['tokenomics', 'token supply', 'token unlock', 'vesting', 'inflation', 'deflation', 'burn', 'token burn'],
    category: 'concepts',
    name: 'Tokenomics',
    definition:
      'The economic design of a token: supply schedule, inflation rate, burn mechanisms, and vesting schedules. Upcoming large token unlocks increase supply → selling pressure. Burns decrease supply → bullish.',
    howToUse:
      'Check token unlock schedules before buying. Large unlocks (>5% of circulating supply) often cause price drops. Deflationary tokens with active burns have bullish supply dynamics.',
    commonMistakes:
      'Ignoring tokenomics entirely. A project with great tech but 500% annual inflation will underperform. Supply dynamics are among the strongest price drivers in crypto.',
    example:
      'A token has a 10M unlock next month (20% of circulating supply). Current price: $5. After unlock, selling pressure drives price to $3.50 → wait for the unlock to buy.',
  },

  // ── Execution Strategies ───────────────────────────────────
  {
    id: 'scaling_in',
    terms: ['scaling in', 'dollar cost average', 'dca', 'averaging in', 'ladder entry', 'scale in'],
    category: 'risk_management',
    name: 'Scaling In (DCA)',
    definition:
      'Entering a position in multiple parts rather than all at once. Reduces timing risk and improves average entry price if the trade moves against you initially.',
    howToUse:
      'Split your planned position into 3-4 entries. First entry at your initial level. Additional entries at lower support levels (for longs). This smooths your average cost.',
    commonMistakes:
      'Scaling into a losing trade without a plan (averaging down into a broken thesis). Only scale in if your original thesis remains valid and at pre-planned levels.',
    example:
      'Plan to buy 1 BTC. Buy 0.3 at $64,000. 0.3 at $63,000 (support). 0.4 at $62,000 (major support). Average: $62,900 vs. all-in at $64,000.',
  },
  {
    id: 'scaling_out',
    terms: ['scaling out', 'partial profit', 'partial take profit', 'scale out', 'trim position'],
    category: 'risk_management',
    name: 'Scaling Out',
    definition:
      'Exiting a position in stages at different profit targets. Locks in partial profits while allowing the remainder to capture bigger moves. Reduces regret of either exiting too early or too late.',
    howToUse:
      'Close 33% at TP1 (1:1 R:R), 33% at TP2 (1:2 R:R), trail stop on final 33%. Move stop to breakeven after first partial profit.',
    commonMistakes:
      'Scaling out too aggressively (taking 80% off at first target) leaves minimal exposure for the big move. Keep at least 25-33% for the runner.',
    example:
      'Long ETH at $3,200. TP1: $3,400 (close 33%, move stop to BE). TP2: $3,600 (close 33%). Trail final 33% with a $150 trailing stop.',
  },
  {
    id: 'time_stops',
    terms: ['time stop', 'time based exit', 'time decay', 'dead trade'],
    category: 'risk_management',
    name: 'Time-Based Stops',
    definition:
      "Exiting a trade if it hasn't moved in your favor within a predetermined time period. Dead capital in a stagnant trade has opportunity cost — free it for better setups.",
    howToUse:
      "Set a time limit based on your timeframe: day trades = 2-4 hours, swing trades = 3-5 days. If the setup hasn't triggered or moved, exit at breakeven.",
    commonMistakes:
      'Holding a "going nowhere" trade for days/weeks hoping it will eventually work. The best setups tend to work quickly.',
    example:
      'Enter a breakout trade on 4H. After 3 days, price is still within 0.5% of your entry → the breakout lost momentum. Exit and reallocate capital.',
  },
  {
    id: 'correlation_risk',
    terms: ['correlation', 'correlated positions', 'sector risk', 'beta', 'high beta'],
    category: 'risk_management',
    name: 'Correlation Risk',
    definition:
      'The risk of holding multiple positions that move together. If BTC pumps, ETH, SOL, and most alts pump too. Your "5 positions" might really be 1 big correlated bet.',
    howToUse:
      'Calculate correlation between your open positions. Count correlated positions as a single risk unit. Diversify across uncorrelated assets or sectors.',
    commonMistakes:
      "Thinking you're diversified by holding 10 crypto assets. If they're all correlated 0.7+ with BTC, you have one large BTC bet.",
    example:
      'Long BTC, ETH, SOL, AVAX = all highly correlated. Effective risk ≈ 1 large crypto position. Add an uncorrelated asset (gold, bonds) for true diversification.',
  },

  // ── More Psychology ─────────────────────────────────────────
  {
    id: 'confirmation_bias',
    terms: ['confirmation bias', 'bias', 'selective perception', 'tunnel vision'],
    category: 'psychology',
    name: 'Confirmation Bias',
    definition:
      'The tendency to seek information that confirms your existing belief about a trade while ignoring contradicting evidence. You see bullish signals everywhere after going long.',
    howToUse:
      'Before entering, actively look for reasons NOT to take the trade. If you can\'t find any, your analysis may be biased. Use a "devil\'s advocate" checklist.',
    commonMistakes:
      "Only following analysts who agree with your position. Muting bearish voices when you're long. The best traders actively seek disconfirming evidence.",
    example:
      "You're long BTC and find 5 bullish indicators. Force yourself to find 3 bearish ones. If the bearish evidence is weak, the trade is stronger. If it's valid, reconsider.",
  },
  {
    id: 'sunk_cost',
    terms: ['sunk cost', 'sunk cost fallacy', 'bag holding', 'holding the bag'],
    category: 'psychology',
    name: 'Sunk Cost Fallacy',
    definition:
      'Holding a losing trade because you\'ve "already lost too much" to sell now. The money lost is gone — your only decision should be whether you\'d open the same position today.',
    howToUse:
      'Ask yourself: "If I had no position, would I enter this trade right now?" If no, exit. Past losses shouldn\'t influence current decisions.',
    commonMistakes:
      'Adding to losers because you\'re "already in" — this compounds the mistake. Each decision to hold or add should be judged on its own merits.',
    example:
      "You're down 30% on an alt. The fundamentals haven't changed, but the chart is broken. Would you buy it today? If not, sell and redeploy capital to a better opportunity.",
  },
  {
    id: 'recency_bias',
    terms: ['recency bias', 'recent performance', 'hot hand fallacy', 'cold streak fear'],
    category: 'psychology',
    name: 'Recency Bias',
    definition:
      'Overweighting recent events when making decisions. After 5 wins, you feel invincible (oversize). After 5 losses, you feel broken (undersize or stop trading).',
    howToUse:
      "Use fixed position sizing rules that don't change based on recent performance. Your edge plays out over 100+ trades, not 5. Trust the process.",
    commonMistakes:
      'Increasing position size after a winning streak (results in giving back gains). Or stopping trading after a losing streak (missing the recovery trades).',
    example:
      'After 5 straight wins, resist the urge to "bet big on the next one." Your win rate is 55%, not 100%. The next trade has the same 55% chance regardless of the streak.',
  },
  {
    id: 'analysis_paralysis',
    terms: ['analysis paralysis', 'overthinking', 'too many indicators', 'information overload'],
    category: 'psychology',
    name: 'Analysis Paralysis',
    definition:
      "Overthinking a trade to the point of inaction. Adding more indicators, checking more timeframes, reading more opinions — until the setup is gone or you're too confused to act.",
    howToUse:
      'Limit yourself to 2-3 indicators. Use a simple checklist (3-5 items). If the checklist is satisfied, take the trade. Set a time limit for analysis (e.g., 5 minutes per trade).',
    commonMistakes:
      'Believing that more analysis = better decisions. After a point, additional analysis just adds noise and delays execution.',
    example:
      'Setup meets all 4 of your checklist items. RSI, MACD, volume all confirm. But you hesitate, add Ichimoku, check Twitter sentiment — price moves without you.',
  },
  {
    id: 'performance_anxiety',
    terms: ['performance anxiety', 'afraid to trade', 'fear of losing', 'trading fear', 'scared to enter'],
    category: 'psychology',
    name: 'Performance Anxiety',
    definition:
      'Fear of losing money that prevents you from taking valid setups. Often develops after a string of losses. Paradoxically, the missed good trades compound the psychological damage.',
    howToUse:
      'Trade with minimum position size until confidence returns. Focus on process (did I follow my plan?) not outcomes (did I make money?). Journal the fear itself.',
    commonMistakes:
      'Trying to overcome the fear by taking a big position to "prove yourself." Start small and rebuild gradually.',
    example:
      "After 4 losses, you see a perfect A+ setup but can't pull the trigger. Solution: take it with 25% of normal size. The outcome doesn't matter — your execution does.",
  },

  // ── More Order Types ───────────────────────────────────────
  {
    id: 'stop_limit',
    terms: ['stop limit', 'stop limit order', 'stop market vs stop limit'],
    category: 'order_types',
    name: 'Stop-Limit Order',
    definition:
      'Combines a stop trigger with a limit order. When the stop price is hit, a limit order is placed at the limit price. You control the execution price but risk non-execution if the market gaps.',
    howToUse:
      'Set the limit price slightly worse than the stop price ($0.50-$1 buffer). This gives room for execution while still controlling the price. Use for planned breakout entries.',
    commonMistakes:
      "Setting the stop and limit at the same price. In a fast market, the order won't fill because the price has already passed your limit. Always include a buffer.",
    example:
      'BTC at $64,000. Set a stop-limit buy: stop at $65,010, limit at $65,100. When price hits $65,010, a limit buy at $65,100 activates → controlled breakout entry.',
  },
  {
    id: 'oco',
    terms: ['oco', 'one cancels other', 'bracket order', 'oco order'],
    category: 'order_types',
    name: 'OCO (One-Cancels-Other)',
    definition:
      "Two orders linked together — when one executes, the other is automatically cancelled. Typically used for a take profit + stop loss pair. Ensures you're protected in both directions.",
    howToUse:
      'After entering a trade, place an OCO with your stop loss and take profit. This automates your exit plan and removes the temptation to move stops or targets.',
    commonMistakes:
      'Not using OCO orders and manually managing exits. This leads to emotional decisions, especially when watching the trade in real-time.',
    example:
      'Long BTC at $64,000. OCO: sell stop at $63,000 and sell limit at $67,000. If either hits, the other cancels. Your exits are automated.',
  },
  {
    id: 'twap',
    terms: ['twap', 'time weighted average', 'iceberg order', 'algorithmic execution'],
    category: 'order_types',
    name: 'TWAP & Algorithmic Orders',
    definition:
      'TWAP (Time-Weighted Average Price) splits a large order into smaller pieces executed over time. Iceberg orders hide the full size. Used by institutions to minimize market impact.',
    howToUse:
      "For large positions (>$50K in crypto), use an iceberg or split your order manually over 30-60 minutes. This avoids slippage and doesn't signal your intent to other traders.",
    commonMistakes:
      'Market-ordering a large position all at once, which moves the price against you. Even on liquid assets, large orders create visible impact.',
    example:
      'Want to buy 10 BTC. Instead of one market order ($640K), split into 20 orders of 0.5 BTC each over 1 hour = $5-10K less slippage.',
  },

  // ── Advanced Concepts ──────────────────────────────────────
  {
    id: 'market_regime',
    terms: ['market regime', 'regime detection', 'trending vs ranging', 'market environment', 'market phase'],
    category: 'concepts',
    name: 'Market Regimes',
    definition:
      'Markets alternate between four regimes: trending up, trending down, ranging, and volatile/chaotic. Each regime requires different strategies. The #1 mistake is using a trend strategy in a range.',
    howToUse:
      'Identify the current regime using ADX + ATR. ADX > 25 = trending. Low ATR = ranging. High ATR + no clear direction = volatile. Match your strategy to the regime.',
    commonMistakes:
      'Using one strategy in all regimes. A breakout strategy bleeds money in ranges. A mean-reversion strategy gets destroyed in trends. Adapt or sit out.',
    example:
      "BTC ADX at 18 (range) with ATR at daily lows. Don't trade breakouts. Instead, buy support ($62K) and sell resistance ($66K) until the range resolves.",
  },
  {
    id: 'mean_reversion',
    terms: ['mean reversion', 'reversion to mean', 'rubber band', 'stretched'],
    category: 'concepts',
    name: 'Mean Reversion',
    definition:
      'The tendency of price to return to its average after extended moves. When price stretches far from its moving average, it tends to snap back. Works best in ranging markets.',
    howToUse:
      'Measure distance from the 20 or 50 EMA. When price is 2+ standard deviations away, a snap-back is likely. Use Bollinger Bands or RSI for mean reversion signals.',
    commonMistakes:
      'Trying to mean-revert in a strong trend. Trends can extend much further than expected. Mean reversion only works reliably in ranges and after exhaustion moves.',
    example:
      'BTC drops 12% in 2 days, now 3 standard deviations below the 20 EMA with RSI at 22 → stretched. Mean reversion trade: buy for a bounce to the 20 EMA.',
  },
  {
    id: 'momentum',
    terms: ['momentum', 'momentum trading', 'momentum strategy', 'relative strength'],
    category: 'concepts',
    name: 'Momentum Trading',
    definition:
      'Assets that are going up tend to continue going up; assets going down tend to continue going down. Momentum strategies buy strength and sell weakness, riding existing trends.',
    howToUse:
      'Rank assets by recent performance (1-3 month returns). Buy the top performers, sell/avoid the bottom. Combine with relative strength analysis across sectors.',
    commonMistakes:
      'Catching a falling knife by buying weakness. Momentum strategies require buying things that are already moving, not trying to catch bottoms.',
    example:
      'SOL is up 40% this month while BTC is +5%. SOL has stronger momentum. Allocate more to SOL for a momentum trade with a trailing stop.',
  },
  {
    id: 'sector_rotation',
    terms: ['sector rotation', 'rotation', 'money flow', 'capital rotation', 'narrative trading'],
    category: 'concepts',
    name: 'Sector Rotation',
    definition:
      'Capital flows between sectors/themes in predictable cycles. In crypto: L1s → DeFi → NFTs → Gaming → AI → memes. Money typically flows from large caps to small caps as a cycle matures.',
    howToUse:
      'Track which sectors are gaining relative strength. Early rotation from BTC to ETH signals risk appetite. Late rotation to micro-caps and memes signals cycle top.',
    commonMistakes:
      "Chasing the rotation after it's already happened. By the time everyone is talking about a sector, the move is mostly done. Anticipate the next rotation.",
    example:
      'AI tokens surging while DeFi is flat. Capital is rotating into AI narrative. Position early in quality AI tokens. When meme coins start pumping → exit (late stage).',
  },
  {
    id: 'max_pain',
    terms: ['max pain', 'options max pain', 'options expiry', 'opex', 'pinning'],
    category: 'concepts',
    name: 'Max Pain & Options Expiry',
    definition:
      'Max pain is the price where most options expire worthless, causing maximum loss for option holders. Price tends to gravitate toward max pain near expiry dates due to market maker hedging.',
    howToUse:
      'Check max pain before major options expiries (monthly, quarterly). Avoid directional trades 2-3 days before expiry. After expiry, freed hedging positions can lead to sharp moves.',
    commonMistakes:
      'Ignoring options expiry dates. Billions in options expire quarterly — these events create pinning effects and post-expiry volatility that affect spot traders.',
    example:
      'BTC quarterly options expiry with max pain at $64,000. BTC trading at $67,000. Expect price gravitational pull toward $64K in the 3 days before expiry.',
  },
  {
    id: 'session_trading',
    terms: ['trading session', 'london session', 'new york session', 'asian session', 'killzone', 'market open'],
    category: 'concepts',
    name: 'Trading Sessions',
    definition:
      'Markets behave differently during each session. Asian: lower volatility, range-bound. London: highest volatility start, trend-setting moves. New York: continuation or reversal of London moves.',
    howToUse:
      'For crypto: most volume occurs during London + NY overlap (1-5 PM UTC). For stocks: the first 30 minutes and last 30 minutes have the most volatility and volume.',
    commonMistakes:
      'Trading during the Asian session expecting the same volatility as London. Low-volume periods lead to poor execution and false signals.',
    example:
      "Your best win rate is on London open setups (8-10 AM UTC). Focus your trading on this window. Asian session trades have a 40% win rate vs. London's 62%.",
  },
  {
    id: 'intermarket',
    terms: ['intermarket', 'dxy', 'dollar index', 'bonds', 'yields', 'spx correlation', 'macro'],
    category: 'concepts',
    name: 'Intermarket Analysis',
    definition:
      'How different markets influence each other. DXY (dollar strength) inverse to BTC/crypto. Rising yields = bearish for risk assets. SPX correlation with crypto increases during risk-off events.',
    howToUse:
      'Monitor DXY, US 10Y yields, and SPX alongside crypto. DXY falling + yields falling = risk-on environment (bullish crypto). DXY rising = headwind for crypto.',
    commonMistakes:
      'Trading crypto in isolation without considering macro. During risk-off events, correlations converge and all risky assets sell off together.',
    example:
      'DXY drops from 105 to 103, 10Y yields fall, SPX rallies → risk-on macro environment. Time to increase crypto exposure. When DXY reverses up → reduce exposure.',
  },

  // ── More Market Structure ──────────────────────────────────
  {
    id: 'order_blocks',
    terms: ['order block', 'ob', 'bullish order block', 'bearish order block', 'mitigation block'],
    category: 'market_structure',
    name: 'Order Blocks (ICT)',
    definition:
      'The last candle (or cluster) before a strong impulsive move in the opposite direction. Bullish OB: last bearish candle before a rally. Bearish OB: last bullish candle before a drop. Institutional orders are thought to originate here.',
    howToUse:
      'Mark OBs on higher timeframes (4H, Daily). When price returns to an OB, look for entries in the direction of the original move. First retests are the most reliable.',
    commonMistakes:
      "Every S/R level is not an order block. True OBs precede impulsive, displacement moves. Weak bounces don't create valid OBs.",
    example:
      'BTC drops from $66K. The last green candle before the drop ($65.5-$65.8K) = bearish OB. When price rallies back to $65.5-$65.8K → short entry.',
  },
  {
    id: 'breaker_block',
    terms: ['breaker block', 'breaker', 'mitigation', 'failed order block'],
    category: 'market_structure',
    name: 'Breaker Blocks (ICT)',
    definition:
      'A failed order block that gets broken through. When an OB is violated, it becomes a breaker block that acts as S/R in the opposite direction. They represent a shift in institutional positioning.',
    howToUse:
      'When a bullish OB fails (price breaks below it), the zone becomes a bearish breaker. Use it as resistance on the next retest. Vice versa for failed bearish OBs.',
    commonMistakes:
      'Not adapting when an OB fails. If the OB is broken, the thesis is invalidated. Flip your bias and use the breaker in the new direction.',
    example:
      'Bullish OB at $63K fails — price drops through to $61K. The $63K zone is now a bearish breaker. Next rally to $63K → short, as former support becomes resistance.',
  },
  {
    id: 'premium_discount',
    terms: ['premium', 'discount', 'premium zone', 'discount zone', 'equilibrium', '50% level'],
    category: 'market_structure',
    name: 'Premium & Discount Zones (ICT)',
    definition:
      'Dividing a price range into premium (above 50%) and discount (below 50%) zones. In uptrends, buy in the discount zone. In downtrends, sell in the premium zone. The 50% level is equilibrium.',
    howToUse:
      'Use the fib tool from swing low to swing high. Below 50% = discount (buy zone). Above 50% = premium (sell zone). This helps you avoid buying at the worst possible price in a trend.',
    commonMistakes:
      'Buying in the premium zone of an uptrend (too high) or selling in the discount zone of a downtrend (too low). Always trade from value.',
    example:
      "BTC swing: low $60K, high $70K. Equilibrium = $65K. Buy below $65K (discount). If price rallies above $65K without your entry, don't chase — wait for the next discount.",
  },

  // ── Options Basics ─────────────────────────────────────────
  {
    id: 'call_option',
    terms: ['call option', 'call', 'buying calls', 'long call'],
    category: 'concepts',
    name: 'Call Options',
    definition:
      'A contract giving the buyer the right (not obligation) to buy an asset at a set price (strike) before expiration. You profit when the asset rises above the strike + premium paid.',
    howToUse:
      "Buy calls when you're bullish. Choose a strike near or slightly above current price for higher probability. Further OTM = cheaper but lower win rate. Consider time to expiration.",
    commonMistakes:
      'Buying far OTM weekly calls ("lottery tickets"). These have very low probability of profit. Most expire worthless, slowly bleeding your account.',
    example:
      'AAPL at $175. Buy the $180 call expiring in 30 days for $3.00. Breakeven = $183. If AAPL reaches $190, profit = $7/share (133% return on premium).',
  },
  {
    id: 'put_option',
    terms: ['put option', 'put', 'buying puts', 'long put', 'protective put'],
    category: 'concepts',
    name: 'Put Options',
    definition:
      'A contract giving the buyer the right to sell an asset at a set price before expiration. You profit when the asset falls below the strike - premium paid. Used for bearish bets or portfolio protection.',
    howToUse:
      'Buy puts when bearish. "Protective puts" hedge a long stock position (insurance). ITM puts have higher delta and move more with the underlying.',
    commonMistakes:
      'Using puts as primary directional trades without understanding theta decay. Puts lose value every day, so timing matters more than with stock shorts.',
    example:
      'You hold 100 TSLA shares at $240. Buy the $230 put for $5.00 as insurance. If TSLA crashes to $200, your put gains $25 — offsetting most of the stock loss.',
  },
  {
    id: 'greeks',
    terms: ['greeks', 'delta', 'gamma', 'theta', 'vega', 'iv', 'option greeks'],
    category: 'concepts',
    name: 'Options Greeks',
    definition:
      'Delta: price sensitivity to underlying ($1 move). Gamma: rate of delta change. Theta: daily time decay. Vega: sensitivity to implied volatility. Understanding Greeks is essential for options trading.',
    howToUse:
      'High delta (0.7+) for directional trades. High theta (sell) for income strategies. High vega for volatility bets. Always check theta before holding options overnight.',
    commonMistakes:
      'Ignoring theta — it accelerates in the last 30 days. Holding short-dated options over weekends loses 2-3 days of theta. Also, ignoring vega crush after earnings.',
    example:
      'A call has delta 0.50, theta -0.05. If the stock moves $2 up, option gains ~$1.00. But each day, it loses $0.05 from time decay. Need the move to happen fast.',
  },
  {
    id: 'iv_crush',
    terms: ['iv crush', 'volatility crush', 'earnings play', 'implied volatility crush'],
    category: 'concepts',
    name: 'IV Crush',
    definition:
      "The sharp drop in implied volatility after an anticipated event (earnings, FOMC, etc.). Even if you're right about direction, you can lose money because the option value drops from reduced IV.",
    howToUse:
      'If you must trade earnings, use spreads (they neutralize vega). Or sell options before earnings to profit from IV crush. Never buy naked options right before earnings.',
    commonMistakes:
      'Buying calls before earnings expecting a 5% move. The stock moves 5% but your calls barely profit because IV dropped from 80% to 40% overnight.',
    example:
      'NVDA IV at 60% before earnings. You buy calls. NVDA beats and rises 3%. But IV drops to 35% → your calls are flat or down despite being right on direction.',
  },
  {
    id: 'spreads',
    terms: [
      'option spread',
      'vertical spread',
      'bull call spread',
      'bear put spread',
      'iron condor',
      'iron butterfly',
      'straddle',
      'strangle',
    ],
    category: 'concepts',
    name: 'Options Spreads',
    definition:
      'Multi-leg strategies combining bought and sold options. Vertical spreads: defined-risk directional bets. Iron condors: profit from range-bound markets. Straddles/strangles: profit from big moves in either direction.',
    howToUse:
      'Bull call spread: buy lower strike call, sell higher strike. Caps profit but reduces cost. Iron condor: sell OTM put + call, buy further OTM put + call. Profits when price stays in range.',
    commonMistakes:
      'Using single-leg options when spreads are more appropriate. Spreads define your risk and reduce capital requirements. Single legs have unlimited risk (on sells) or excessive theta (on buys).',
    example:
      'BTC at $65K. Sell $60K-$70K iron condor (sell $62K put + $68K call, buy $60K put + $70K call). Max profit if BTC stays between $62K-$68K by expiry.',
  },
  {
    id: 'covered_call',
    terms: ['covered call', 'covered calls', 'wheel strategy', 'cash secured put', 'csp'],
    category: 'concepts',
    name: 'Covered Calls & Wheel Strategy',
    definition:
      'Covered call: sell a call against shares you own → collect premium but cap upside. Wheel strategy: sell cash-secured puts → if assigned, sell covered calls. Repeat for income.',
    howToUse:
      'Sell calls 15-30 days out, 1-2 strikes OTM (30 delta). Collect 1-2% monthly premium. The wheel works best on stocks you want to own long-term.',
    commonMistakes:
      'Selling covered calls on volatile stocks right before catalysts. You miss the big move and cap your gains. Also: selling too close to the money and getting called away.',
    example:
      'Own 100 AAPL at $175. Sell the $185 call (30 delta) for $2.50. If AAPL stays below $185, keep premium. If above, sell at $185 + keep $2.50 = $187.50 effective.',
  },

  // ── Futures & Derivatives ──────────────────────────────────
  {
    id: 'futures',
    terms: ['futures', 'futures contract', 'futures trading', 'es futures', 'nq futures', 'btc futures'],
    category: 'concepts',
    name: 'Futures Contracts',
    definition:
      'An obligation to buy/sell an asset at a predetermined price on a future date. Unlike options, both buyer and seller are obligated. Futures use leverage (margin) and are marked to market daily.',
    howToUse:
      'Futures provide leveraged exposure with lower capital. Use for hedging or speculation. E-mini S&P 500 (ES) is the most liquid futures contract in the world.',
    commonMistakes:
      'Not understanding that futures have expiration dates and must be rolled. Also, the leverage works both ways — a 10% move with 10x leverage = 100% gain or 100% loss.',
    example:
      'Buy 1 ES futures at 5,000. Each point = $50. If ES rises to 5,020, profit = 20 × $50 = $1,000. Margin requirement: ~$13,000 (huge leverage on a $250,000 notional).',
  },
  {
    id: 'contango',
    terms: ['contango', 'backwardation', 'futures curve', 'roll yield', 'basis'],
    category: 'concepts',
    name: 'Contango & Backwardation',
    definition:
      'Contango: futures price > spot price (normal for most markets). Backwardation: futures < spot (indicates tight supply). The "basis" is the difference between futures and spot.',
    howToUse:
      'In contango, rolling futures loses value (negative roll yield). In backwardation, rolling gains value. BTC futures typically trade in contango — track the basis for funding income opportunities.',
    commonMistakes:
      'Holding leveraged ETFs or perpetual products without understanding the contango drag on returns. A contango of 1%/month = 12% annual drag.',
    example:
      'BTC spot: $64,000. Q2 futures: $65,500 (2.3% contango). This means the market expects BTC to be higher — but holding the future costs you 2.3% in roll yield.',
  },

  // ── More Chart Patterns (Batch 2) ─────────────────────────
  {
    id: 'channel',
    terms: ['channel', 'ascending channel', 'descending channel', 'parallel channel', 'regression channel'],
    category: 'chart_patterns',
    name: 'Price Channels',
    definition:
      'Parallel trendlines containing price movement. Ascending channel = bullish (higher highs + higher lows in parallel). Descending channel = bearish. Trade within the channel or on breakouts.',
    howToUse:
      'Buy at the lower channel line, sell at the upper. A breakout above the upper line signals acceleration. A breakdown below the lower line signals reversal.',
    commonMistakes:
      'Drawing channels with too few touches. A valid channel needs at least 2 touches on each line. More touches = more reliable channel.',
    example:
      'ETH in an ascending channel ($3,000-$3,200 → $3,300-$3,500 over 2 weeks). Buy at the lower line ($3,300). Stop below the channel. Target: upper line ($3,500).',
  },
  {
    id: 'rectangle',
    terms: ['rectangle pattern', 'box pattern', 'trading range', 'range bound'],
    category: 'chart_patterns',
    name: 'Rectangle Pattern',
    definition:
      "Price bouncing between horizontal support and resistance, forming a box. It's a consolidation pattern that typically resolves in the direction of the prior trend.",
    howToUse:
      'Trade the range: buy support, sell resistance. Or wait for the breakout. The longer the rectangle, the more powerful the eventual breakout.',
    commonMistakes:
      "Assuming rectangles always break in the prior trend direction. While they're more likely to, they can break either way. Trade the breakout, not the assumption.",
    example:
      'BTC ranges between $62K-$66K for 3 weeks. Prior trend was up. Breakout above $66K with volume → continuation. Target: rectangle height ($4K) → $70K.',
  },
  {
    id: 'broadening',
    terms: ['broadening formation', 'megaphone', 'expanding triangle', 'broadening wedge'],
    category: 'chart_patterns',
    name: 'Broadening Formation (Megaphone)',
    definition:
      'An expanding pattern with higher highs AND lower lows. Indicates increasing volatility and indecision. Often appears at market tops as sentiment oscillates wildly.',
    howToUse:
      'Trade the swings within the pattern (buy low, sell high) or wait for a definitive breakout. These are bearish when they form at the end of uptrends.',
    commonMistakes:
      'Trying to trade breakouts during the pattern — megaphones produce frequent fakeouts. Better to trade the oscillation within the pattern until it resolves.',
    example:
      'SPY forms a megaphone: HH at $460, LL at $445, HH at $465, LL at $440. Trade the oscillation. When price breaks below $440 decisively → bearish resolution.',
  },
  {
    id: 'tweezer',
    terms: ['tweezer top', 'tweezer bottom', 'tweezer', 'equal highs', 'equal lows candle'],
    category: 'chart_patterns',
    name: 'Tweezer Top/Bottom',
    definition:
      'Two consecutive candles with matching highs (top) or lows (bottom). Tweezer tops at resistance signal rejection. Tweezer bottoms at support signal buying interest.',
    howToUse:
      'Most effective at established S/R levels on higher timeframes (4H, Daily). The matching level shows consistent rejection. Enter on the third candle with a stop beyond the tweezer level.',
    commonMistakes:
      'Looking for exact pip-perfect matches. Tweezers can have a small tolerance (within 0.1%). Also less reliable on lower timeframes.',
    example:
      "BTC prints two candles at $67,500 resistance, both with highs at $67,520. Tweezer top. Short on the third candle's close below the tweezer low.",
  },

  // ── Position Management ────────────────────────────────────
  {
    id: 'breakeven_stop',
    terms: ['breakeven stop', 'breakeven', 'move stop to breakeven', 'be stop', 'free trade'],
    category: 'risk_management',
    name: 'Moving Stop to Breakeven',
    definition:
      'Once a trade moves in your favor by 1R or more, move your stop loss to your entry price. This creates a "free trade" — you can no longer lose money on the position.',
    howToUse:
      'Move to breakeven after price reaches 1:1 R:R. This allows you to let the trade run without risk. Some traders wait for 1.5R to avoid being stopped out on normal pullbacks.',
    commonMistakes:
      "Moving to breakeven too early. If you move your stop to BE after a $50 gain on a stock with $100 daily range, you'll frequently get stopped out before the move plays out.",
    example:
      "Long BTC at $64,000 with stop at $63,000 (1R = $1,000). Price reaches $65,000 (1R profit). Move stop to $64,000 (breakeven). Now it's a risk-free trade.",
  },
  {
    id: 'adding_to_winners',
    terms: ['adding to winners', 'pyramiding', 'pyramid position', 'scaling into winners'],
    category: 'risk_management',
    name: 'Pyramiding (Adding to Winners)',
    definition:
      'Adding to a winning position as it moves in your favor. The opposite of averaging down. Each addition should be smaller than the last and at pre-planned levels.',
    howToUse:
      'Start with 50% of your planned size. Add 30% after 1R profit. Add final 20% after 2R. Move all stops up so total risk never increases. This maximizes profits on your best trades.',
    commonMistakes:
      'Adding equal or larger amounts at each level (inverted pyramid). This raises your average cost dangerously. Each addition should be SMALLER than the previous.',
    example:
      'Long 0.5 BTC at $64K. Rises to $65K (1R) → add 0.3 BTC. Rises to $66K (2R) → add 0.2 BTC. Total: 1.0 BTC, avg $64,700. Stop at $64.5K for the pyramid.',
  },
  {
    id: 'risk_of_ruin',
    terms: ['risk of ruin', 'ruin probability', 'account blow up', 'going broke'],
    category: 'risk_management',
    name: 'Risk of Ruin',
    definition:
      'The probability of losing enough capital to stop trading. Even with a positive edge, excessive position sizing can lead to ruin through a bad streak. The math is harsh: risk 10% per trade → ~5% chance of ruin even with 55% win rate.',
    howToUse:
      'Calculate your risk of ruin based on win rate, position size, and R:R ratio. At 1% risk per trade with a 50% win rate, risk of ruin ≈ 0%. At 5% risk, it jumps to ~15%.',
    commonMistakes:
      'Thinking "it won\'t happen to me." A 20-loss streak is rare (~0.01% at 50% WR) but over thousands of trades, unlikely events become likely. Size for survival.',
    example:
      'Account: $10K. Risk 2% = $200/trade. Even after 10 losses in a row (-$2K), you still have $8K and can continue. Risk 10% = $1K/trade. 10 losses = blown account.',
  },
  {
    id: 'max_open',
    terms: ['max open positions', 'position limits', 'capital allocation', 'max risk'],
    category: 'risk_management',
    name: 'Maximum Open Positions',
    definition:
      'A rule limiting how many simultaneous positions you hold. Reduces portfolio risk, cognitive load, and prevents over-commitment. Professional traders typically hold 3-8 positions max.',
    howToUse:
      'Set a maximum (e.g., 5 positions). Each uses 1-2% risk. Total portfolio risk never exceeds 6-10%. This forces you to pick only the best setups.',
    commonMistakes:
      'Having 15+ open positions "because they all look good." This spreads attention too thin and usually means lower-quality setups are in the mix.',
    example:
      'Max 5 positions at 2% risk each = 10% total portfolio risk. Position #6 needs to be better than an existing one — force yourself to swap rather than accumulate.',
  },

  // ── Market Microstructure ──────────────────────────────────
  {
    id: 'orderbook',
    terms: ['order book', 'orderbook', 'depth of market', 'dom', 'level 2', 'bid ask', 'tape reading'],
    category: 'market_structure',
    name: 'Order Book & DOM',
    definition:
      'A real-time list of buy and sell orders at each price level. Depth of Market (DOM) visualizes this as a ladder. Large resting orders act as support/resistance. "Tape reading" involves watching order flow.',
    howToUse:
      'Look for large resting orders that act as magnets or barriers. Imbalanced order books (many more bids than asks) suggest buying pressure. Spoofing (fake orders) can mislead, so watch actual fills.',
    commonMistakes:
      'Taking order book at face value. Large orders can be spoofed (placed and cancelled). Focus on actual trades hitting the tape, not resting orders on the book.',
    example:
      'BTC order book shows a 500 BTC bid wall at $63,000 but only 20 BTC in asks above $64,000. The thinning asks suggest low resistance → likely to push higher.',
  },
  {
    id: 'market_makers',
    terms: ['market maker', 'mm', 'dealer', 'specialist', 'market making', 'providing liquidity'],
    category: 'market_structure',
    name: 'Market Makers',
    definition:
      'Firms that provide liquidity by continuously quoting buy and sell prices. They profit from the spread, not direction. Market makers often hedge with options and futures, creating predictable behaviors.',
    howToUse:
      'Understand that MMs are not your enemy — they provide the liquidity you need. But they will adjust spreads during volatile periods. Trade liquid assets to minimize MM spread impact.',
    commonMistakes:
      'Believing market makers are conspiring against retail traders. MMs are risk-neutral profit machines. Their behavior is algorithmic and predictable, not conspiratorial.',
    example:
      'A stock spread widens from $0.01 to $0.05 during a news event. This is the MM reducing risk exposure, not targeting you. Wait for the spread to normalize before trading.',
  },
  {
    id: 'dark_pool',
    terms: ['dark pool', 'dark pools', 'off exchange', 'institutional flow', 'block trade'],
    category: 'market_structure',
    name: 'Dark Pools',
    definition:
      'Private exchanges where institutional investors trade large blocks without impacting the public market. ~40% of US equity volume occurs in dark pools. Prints appear after execution.',
    howToUse:
      'Dark pool prints above the ask suggest institutional buying. Prints below the bid suggest selling. Track dark pool data for sentiment clues on large-cap stocks.',
    commonMistakes:
      'Overinterpreting every dark pool print. Many are hedging or internal crosses. Focus on unusually large prints at key levels for meaningful signals.',
    example:
      'AAPL dark pool prints: three 500K share blocks above the ask in one hour → significant institutional accumulation. Bullish signal when combined with price holding support.',
  },
  {
    id: 'market_hours',
    terms: ['pre-market', 'after hours', 'extended hours', 'market hours', 'opening bell', 'closing bell'],
    category: 'market_structure',
    name: 'Market Hours & Extended Trading',
    definition:
      'Regular market: 9:30AM-4:00PM EST. Pre-market: 4:00AM-9:30AM. After-hours: 4:00PM-8:00PM. Extended hours have lower liquidity, wider spreads, and more volatile price action.',
    howToUse:
      'Use pre-market for gap analysis and planning. The first 30 and last 30 minutes of regular hours have the most volume and best execution. Avoid large orders in extended hours.',
    commonMistakes:
      'Trading full-size positions in pre-market where a 50-share order can move the price 1%. Extended hours are for reconnaissance, not full commitment.',
    example:
      "TSLA gaps up 5% in pre-market on earnings. Don't chase at the open. Wait 15-30 minutes for the opening range to establish, then trade the breakout or fade.",
  },
  {
    id: 'auction_theory',
    terms: ['auction theory', 'market profile', 'value area', 'poc', 'point of control', 'tpo'],
    category: 'market_structure',
    name: 'Auction Theory & Market Profile',
    definition:
      'Markets seek fair value through a continuous auction process. Market Profile shows time spent at each price level. The Point of Control (POC) is the most-traded price. The Value Area (VA) contains 70% of the volume.',
    howToUse:
      'Price above the POC = bullish. Below = bearish. When price moves outside the value area, it either accepts (trend) or rejects (return to VA). High-volume nodes act as magnets.',
    commonMistakes:
      'Ignoring the concept of "value" in trading. Price always gravitates toward where the most trading has occurred. Don\'t fight the POC.',
    example:
      'BTC daily POC at $64,500, VA high at $65,200, VA low at $63,800. Price drops to $63,500 (outside VA), rejects with volume → long entry targeting POC at $64,500.',
  },

  // ── Trading Strategies ─────────────────────────────────────
  {
    id: 'scalping',
    terms: ['scalping', 'scalp', 'scalp trade', 'quick trade', 'micro trade'],
    category: 'concepts',
    name: 'Scalping',
    definition:
      'Taking many small, quick trades (seconds to minutes) with low profit targets. Scalpers aim for 3-10 point moves on high-frequency, capturing small bid-ask inefficiencies or momentum bursts.',
    howToUse:
      "Requires fast execution, low commissions, and tight spreads. Use 1M/5M timeframes. Focus on the most liquid assets. Exit immediately if the trade doesn't work.",
    commonMistakes:
      'Scalping without accounting for commissions and slippage. If you average $5 profit per trade but pay $3 in fees, your real edge is only $2. Many scalpers are profitable before fees and unprofitable after.',
    example:
      'ES futures 1M chart. Price breaks above a 5-minute high with tape acceleration. Enter market, target 2 points ($100/contract), stop 1.5 points ($75). Risk:Reward = 1:1.3.',
  },
  {
    id: 'swing_trading',
    terms: ['swing trading', 'swing trade', 'multi-day trade', 'position trade'],
    category: 'concepts',
    name: 'Swing Trading',
    definition:
      'Holding positions for days to weeks, capturing a "swing" within a larger trend. Less screen time than day trading, better work-life balance. Uses 4H and Daily timeframes primarily.',
    howToUse:
      'Find the higher timeframe trend (Weekly/Daily). Enter on 4H pullbacks to key levels (EMA, S/R, fib). Hold for 3-10 days targeting the next major level.',
    commonMistakes:
      "Day-trading a swing position — checking it every 5 minutes causes anxiety and premature exits. Set alerts and walk away. The 4H chart doesn't need attention every few minutes.",
    example:
      'BTC Daily trend: bullish above 50 EMA. 4H shows pullback to the 20 EMA + fib 38.2%. Enter with stop below the 50 EMA. Target: previous swing high. Hold time: 5-7 days.',
  },
  {
    id: 'trend_following',
    terms: ['trend following', 'turtle trading', 'donchian channel', 'channel breakout'],
    category: 'concepts',
    name: 'Trend Following',
    definition:
      'A systematic approach that enters when a trend starts and exits when it ends. Profitable ~35-40% of the time, but winners are much larger than losers. Made famous by the Turtle Traders.',
    howToUse:
      'Enter on 20-day or 55-day Donchian channel breakouts. Exit on a 10-day low (for longs). Use ATR-based position sizing. Accept many small losses for occasional big wins.',
    commonMistakes:
      'Giving up after a string of losses. Trend following has long losing streaks — 60% of trades are losers. The strategy works because the 40% winners are 3-10x larger than the losers.',
    example:
      'BTC breaks above the 20-day high ($66,000) → enter long. Trail stop at 2x ATR below. If trend continues to $80,000, you ride it. If it reverses quickly, lose 2x ATR.',
  },
  {
    id: 'gap_trading',
    terms: ['gap and go', 'gap fill strategy', 'morning gap', 'gap trade'],
    category: 'concepts',
    name: 'Gap Trading Strategies',
    definition:
      'Trading the opening gap direction (gap and go) or the gap fill (fade). Gap and go works on strong momentum with volume. Gap fill works on weak, low-volume gaps.',
    howToUse:
      'Gap and go: wait for the first 5M candle to close, enter on break of its range. Gap fill: if gap lacks volume or catalyst, sell the gap for a fade back to previous close.',
    commonMistakes:
      'Not distinguishing between gap types. News-driven gaps on high volume tend to continue. Technical gaps on low volume tend to fill. Treat them differently.',
    example:
      'NVDA gaps up 4% on AI revenue news. Volume is 5x average. First 5M candle closes at high. Break above → gap and go long with stop below the 5M low.',
  },

  // ── Risk Psychology ────────────────────────────────────────
  {
    id: 'gamblers_fallacy',
    terms: ['gamblers fallacy', 'due for a win', 'reversion fallacy', 'hot hand'],
    category: 'psychology',
    name: "Gambler's Fallacy",
    definition:
      'Believing that past losses make a win more likely ("I\'m due for a win"). Each trade is independent — your 6th trade doesn\'t know you lost the last 5. Statistical independence is counterintuitive.',
    howToUse:
      'Treat each trade as independent. Your win rate applies PER TRADE, not per streak. A 55% win rate means each new trade has a 55% chance — regardless of the previous 10 results.',
    commonMistakes:
      'Increasing position size because "I\'m due for a win." This is the gambler\'s fallacy in action. Your next trade probability is always the same.',
    example:
      'After 5 losses, you think "the next one HAS to be a winner." It doesn\'t. The probability is still 55%. Trade the same size, follow your plan, let the math work over 100+ trades.',
  },
  {
    id: 'ego_trading',
    terms: ['ego trading', 'need to be right', 'proving yourself', 'ego'],
    category: 'psychology',
    name: 'Ego in Trading',
    definition:
      'The need to be "right" about a trade overrides proper risk management. You see your stop loss approaching and move it because admitting the loss feels like a personal failure.',
    howToUse:
      'Separate your identity from your trades. Profitable traders are comfortable being wrong 40-60% of the time. Being wrong quickly (small loss) is better than being wrong slowly (large loss).',
    commonMistakes:
      'Holding losing positions to avoid admitting a mistake. Adding to losers to lower your average because "I know I\'m right." The market doesn\'t care about your thesis.',
    example:
      'You\'re publicly bullish on ETH and it drops 15%. Your ego says "hold and prove them wrong." Your plan says "stop was hit at -5%, exit." Follow the plan.',
  },
  {
    id: 'routine',
    terms: ['trading routine', 'pre-market routine', 'trading checklist', 'daily routine', 'preparation'],
    category: 'psychology',
    name: 'Trading Routine & Preparation',
    definition:
      "A consistent pre-market and post-market routine that ensures you're prepared and reflective. The best traders treat trading like a job with defined processes, not a casino visit.",
    howToUse:
      "Pre-market: review overnight moves, check calendar (economic events), identify key levels, update watchlist. Post-market: journal trades, review what worked/didn't, update plan for tomorrow.",
    commonMistakes:
      'Skipping preparation and trading reactively. Also, not doing a post-session review. Without reflection, you repeat mistakes indefinitely.',
    example:
      'Pre-market (30 min): Check DXY, BTC, ES. Mark key levels on 3 watchlist charts. Review economic calendar. Post-market (15 min): Log trades, screenshot setups, note emotional state.',
  },

  // ── Additional Practical Concepts ──────────────────────────
  {
    id: 'stop_hunting',
    terms: ['stop hunting', 'stop hunt', 'shakeout', 'fake break', 'liquidity sweep'],
    category: 'concepts',
    name: 'Stop Hunting & Shakeouts',
    definition:
      'Price temporarily piercing a key level to trigger clustered stop losses before reversing. Institutions need these stops to fill large orders. The "hunt" traps retail traders into closing positions before the real move.',
    howToUse:
      'Place stops beyond the obvious level with a buffer (10-20% of ATR). Watch for stop hunts AS an entry signal — a quick pierce below support that reverses is bullish.',
    commonMistakes:
      "Placing stops at obvious psychological levels ($60,000, $50,000, etc.) where everyone else's stops are. Add a buffer below to avoid the common hunts.",
    example:
      'BTC obvious support at $64,000. Stop losses clustered at $63,900-$64,000. Price drops to $63,750, sweeps stops, then rebounds to $64,500 in 15 minutes → classic stop hunt.',
  },
  {
    id: 'position_review',
    terms: ['position management', 'trade management', 'managing a trade', 'active management'],
    category: 'risk_management',
    name: 'Active Position Management',
    definition:
      'Managing an open trade: adjusting stops, scaling in/out, and deciding when to add, reduce, or exit. The entry is only 20% of a trade — management determines 80% of P&L.',
    howToUse:
      'Set rules before entry: where will I move stop to breakeven? Where will I take partial profits? Under what conditions will I add? Pre-defined rules prevent emotional management.',
    commonMistakes:
      'Set-and-forget without any management (missing better exits) OR micro-managing every tick (causing premature exits). Find a balance based on your timeframe.',
    example:
      'Plan before entry: Move stop to BE after 1R. Take 33% profit at 2R. Trail remaining stop at 1.5R below. Exit all if the 4H chart shows a bearish reversal structure.',
  },
  {
    id: 'win_loss_ratio',
    terms: ['win rate', 'loss rate', 'win loss ratio', 'batting average', 'hit rate'],
    category: 'risk_management',
    name: 'Win Rate vs. Win/Loss Ratio',
    definition:
      'Win rate (% of winning trades) matters less than most think. What matters is win rate × average win vs. loss rate × average loss. A 30% win rate strategy with 1:5 R:R is highly profitable.',
    howToUse:
      'Track both your win rate AND your avg win/loss ratio. Calculate expectancy per trade. Don\'t focus on "being right" — focus on making more when right than you lose when wrong.',
    commonMistakes:
      'Optimizing for win rate by taking small profits quickly (90% win rate but tiny gains). This feels good emotionally but is often less profitable than a 40% win rate with big R:R.',
    example:
      'Strategy A: 80% win rate, 1:1 R:R → +60 per 100 trades. Strategy B: 40% win rate, 1:3 R:R → +80 per 100 trades. Strategy B is more profitable despite losing more often.',
  },
  {
    id: 'journaling_review',
    terms: ['weekly review', 'monthly review', 'performance review', 'trading stats', 'trade analytics'],
    category: 'psychology',
    name: 'Performance Review & Analytics',
    definition:
      'Systematically analyzing your trading data to find patterns, strengths, and weaknesses. Weekly and monthly reviews turn random experiences into actionable insights for improvement.',
    howToUse:
      'Weekly: review all trades, calculate win rate, avg R:R, expectancy. Monthly: analyze by setup type, time of day, asset, day of week. Identify your top 2 strengths and top 2 leaks.',
    commonMistakes:
      'Reviewing only the P&L without analyzing the process. A profitable week of bad trades (lucky) and a losing week of good trades (unlucky) should be weighted differently.',
    example:
      'Monthly review reveals: breakout trades have 62% win rate. Reversal trades have 38% win rate. Action: eliminate reversal trades, focus exclusively on breakouts.',
  },
  {
    id: 'edge',
    terms: ['trading edge', 'statistical edge', 'why it works', 'alpha'],
    category: 'concepts',
    name: 'Understanding Your Edge',
    definition:
      "Your edge is the specific, repeatable reason your strategy makes money. Without a definable edge, you're gambling. Edges come from information advantage, timing, risk management, or behavioral exploits.",
    howToUse:
      "Write down in one sentence WHY your strategy works. If you can't, you might not have an edge. Track if your edge is degrading over time (adapt) or consistent (scale).",
    commonMistakes:
      'Assuming you have an edge without data to prove it. At least 50-100 trades of evidence is needed. Also, edges decay — what worked in 2020 may not work today.',
    example:
      'Your edge: "I buy the first pullback to the 20 EMA after a Bollinger squeeze breakout on the 4H chart in trending regimes." This is specific, testable, and repeatable.',
  },
  {
    id: 'compounding',
    terms: ['compounding', 'compound returns', 'compound interest', 'reinvesting profits', 'exponential growth'],
    category: 'risk_management',
    name: 'Compounding Returns',
    definition:
      'Reinvesting profits to grow your account exponentially rather than arithmetically. 1% daily compounded = 37x in a year (theoretical). Even small consistent returns compound powerfully over time.',
    howToUse:
      'As your account grows, increase position sizes proportionally (always risking the same percentage). Withdraw excess periodically to lock in profits and reduce emotional pressure.',
    commonMistakes:
      'Being impatient with compounding. It starts slow but accelerates dramatically. Also, losing 50% after compounding wipes out months of gains — protect the downside.',
    example:
      '$10K account. 3% monthly return compounded. Month 1: $10,300. Month 6: $11,941. Month 12: $14,258. Month 24: $20,328. Month 36: $29,000. Slow start, exponential finish.',
  },
  {
    id: 'leverage',
    terms: ['leverage', 'margin', 'margin trading', 'leveraged trading', '2x', '5x', '10x', '50x', '100x'],
    category: 'risk_management',
    name: 'Leverage & Margin',
    definition:
      'Trading with borrowed capital. 10x leverage means a 10% move doubles your money (or wipes it out). Leverage amplifies both gains and losses equally. It does NOT change the probability of winning.',
    howToUse:
      'Use leverage conservatively (2-5x max for crypto, 1-2x for stocks). Leverage should be used to free up capital, not to increase bet size. Risk per trade stays at 1-2% of YOUR capital.',
    commonMistakes:
      'Using leverage to make positions bigger instead of using it to make the same size positions with less capital. 10x on a 10% risk trade = 100% of your account at risk.',
    example:
      '10x leverage on BTC. $1K margin = $10K position. BTC drops 5% = $500 loss (50% of margin). BTC drops 10% = liquidation. With 3x: same 5% drop = $150 loss (15%). Much more survivable.',
  },
  {
    id: 'economic_calendar',
    terms: ['economic calendar', 'fomc', 'nfp', 'cpi', 'gdp', 'fed meeting', 'interest rate decision', 'economic data'],
    category: 'concepts',
    name: 'Economic Calendar Events',
    definition:
      'Scheduled releases of economic data (CPI, NFP, FOMC decisions) that move markets. High-impact events create volatility spikes. Markets often "buy the rumor, sell the news."',
    howToUse:
      "Check the economic calendar daily. Reduce positions before high-impact events. Don't open new positions 30 minutes before FOMC/NFP. Volatility after events creates better setups than before.",
    commonMistakes:
      "Trading through major events without awareness. A surprise CPI print can move BTC 5-10% in minutes. Even if you're right on direction, slippage and spread widening hurt.",
    example:
      'FOMC decision at 2PM EST. Reduce BTC position by 50% at 1:30PM. After the announcement, wait 15 minutes for the initial spike to settle, then trade the reaction.',
  },
  {
    id: 'news_trading',
    terms: ['news trading', 'catalyst', 'event driven', 'news based trading', 'reaction trading'],
    category: 'concepts',
    name: 'News & Catalyst Trading',
    definition:
      "Trading based on news events, earnings, product launches, or regulatory changes. The key insight: it's not the news that matters, it's the market's REACTION to the news. Bad news + price holds = bullish.",
    howToUse:
      "Don't trade the news itself — trade the market reaction. If good news causes a sell-off, the market is weak (bearish). If bad news causes a rally, the market is strong (bullish).",
    commonMistakes:
      'Trying to react faster than algorithms. HFT firms react in microseconds. Instead, wait for the initial reaction, identify the direction, then trade the second move.',
    example:
      'SEC announces crypto regulation (perceived negative). BTC drops 3% in 10 minutes, then recovers all losses by end of day. The recovery IS the signal — market absorbed the news.',
  },

  // ── Batch 3: More Indicators & Concepts ────────────────────
  {
    id: 'keltner',
    terms: ['keltner channel', 'keltner', 'keltner bands'],
    category: 'indicators',
    name: 'Keltner Channels',
    definition:
      'Volatility bands based on ATR around an EMA (typically 20-period EMA ± 2×ATR). Similar to Bollinger but uses ATR instead of standard deviation, making them smoother and less reactive.',
    howToUse:
      'Price above upper Keltner = strong uptrend. Below lower = strong downtrend. Keltner + Bollinger squeeze combo: when Bollinger Bands move inside Keltner Channels, a powerful breakout is imminent.',
    commonMistakes:
      'Using Keltner interchangeably with Bollinger. They measure different things — ATR vs std dev. Use together for the powerful "squeeze" signal.',
    example:
      'BTC Bollinger Bands contract inside Keltner Channels → "TTM Squeeze" firing. After 10 bars of squeeze, Bollinger breaks outside Keltner → explosive breakout entry.',
  },
  {
    id: 'elder_ray',
    terms: ['elder ray', 'bull power', 'bear power', 'elder'],
    category: 'indicators',
    name: 'Elder Ray Index',
    definition:
      'Measures Bull Power (high - EMA) and Bear Power (low - EMA). Positive Bull Power = buyers pushing above EMA. Negative Bear Power = sellers pushing below EMA. Created by Dr. Alexander Elder.',
    howToUse:
      'Buy when: 13-EMA rising + Bear Power negative but rising (sellers weakening). Sell when: 13-EMA falling + Bull Power positive but falling (buyers weakening).',
    commonMistakes:
      'Ignoring the EMA direction. Elder Ray signals only work in the direction of the trend (EMA slope).',
    example:
      'ETH 13-EMA rising. Bear Power at -50 and rising → sellers are weakening while uptrend continues. Enter long on the next pullback to the EMA.',
  },
  {
    id: 'mfi',
    terms: ['mfi', 'money flow index', 'volume rsi'],
    category: 'indicators',
    name: 'MFI (Money Flow Index)',
    definition:
      'A volume-weighted RSI. Combines price and volume data, making it more reliable than RSI alone. Above 80 = overbought with high volume. Below 20 = oversold with high volume.',
    howToUse:
      'MFI divergences from price are stronger than RSI divergences because they incorporate volume. Use MFI > 80 as a sell signal only if the trend is weakening.',
    commonMistakes:
      'Treating MFI exactly like RSI. MFI incorporates volume, so it can stay extreme longer in high-volume trends.',
    example:
      'BTC makes new high but MFI makes lower high (bearish divergence with volume confirmation) → stronger reversal signal than RSI divergence alone.',
  },
  {
    id: 'renko',
    terms: ['renko', 'renko chart', 'heikin ashi', 'ha', 'range bars'],
    category: 'indicators',
    name: 'Renko & Heikin Ashi Charts',
    definition:
      'Alternative chart types that filter noise. Renko: bricks form only when price moves a fixed amount (no time axis). Heikin Ashi: smoothed candlesticks showing clearer trends. Both reduce false signals.',
    howToUse:
      'Renko for trend identification — ignore the noise. HA for trend trading — buy when HA candles have no lower wick (strong bullish). Use as supplementary tools, not primary analysis.',
    commonMistakes:
      "Trading HA candles with precise entries/exits — they're smoothed, so the actual prices are different from what the chart shows. Use regular candles for execution.",
    example:
      'BTC Renko (500-point bricks) shows 8 consecutive green bricks → strong trend. Regular chart shows noise and pullbacks. Renko confirms: stay in the trade.',
  },
  {
    id: 'trin',
    terms: ['trin', 'arms index', 'advance decline', 'market breadth', 'breadth indicator', 'put call ratio'],
    category: 'indicators',
    name: 'Market Breadth Indicators',
    definition:
      'Measure how many stocks participate in a move. TRIN (Arms Index): < 1 = bullish breadth. > 1 = bearish. Advance-Decline line: cumulative advances minus declines. Put/Call ratio: sentiment gauge.',
    howToUse:
      'Breadth divergence: SPX makes new high but fewer stocks advancing = warning. Extreme put/call ratios (> 1.2 or < 0.5) are contrarian signals.',
    commonMistakes:
      "Using breadth indicators in isolation. They confirm or warn, but don't provide entries. Combine with price action for timing.",
    example:
      'SPX at all-time highs but only 45% of stocks above their 200 EMA (vs. 70% typical) → bearish breadth divergence. Reduce long exposure.',
  },

  // ── Crypto Cycles & Token Metrics ─────────────────────────
  {
    id: 'halving',
    terms: ['halving', 'bitcoin halving', 'halving cycle', 'block reward', 'mining reward'],
    category: 'concepts',
    name: 'Bitcoin Halving Cycle',
    definition:
      "Every ~210,000 blocks (~4 years), Bitcoin's block reward halves. This reduces supply issuance by 50%. Historically, BTC peaks 12-18 months after each halving, then enters a bear market.",
    howToUse:
      'Use the halving cycle as a macro framework. 6-18 months post-halving = historically the most bullish period. Track the cycle using days-since-halving metrics.',
    commonMistakes:
      'Assuming the halving guarantees a bull run. Each cycle is different. The supply reduction matters less as the % reduction decreases. External macro factors increasingly dominate.',
    example:
      'BTC halving in April 2024. Historical peaks: ~12-18 months later (Q2-Q4 2025). Scale into positions 3-6 months before halving, scale out as euphoria peaks.',
  },
  {
    id: 'nft',
    terms: ['nft', 'nfts', 'non fungible token', 'digital collectibles', 'floor price'],
    category: 'concepts',
    name: 'NFTs & Floor Price',
    definition:
      'Non-fungible tokens representing unique digital assets. Floor price is the lowest listing in a collection — the entry-level price. NFT markets are illiquid and sentiment-driven.',
    howToUse:
      'Track floor price trends and trading volume for NFT market sentiment. Rising floors with rising volume = healthy demand. Declining floors with low volume = avoid.',
    commonMistakes:
      "Treat NFTs as investments without understanding the extreme illiquidity. You can't exit at will — there must be a buyer. Floor prices can gap down 90% with no bids.",
    example:
      'An NFT collection floor drops from 5 ETH to 1 ETH over 3 months with declining volume. This isn\'t a "discount" — it\'s a dying collection. Look for rising floors instead.',
  },
  {
    id: 'stablecoin_flows',
    terms: ['stablecoin', 'usdt', 'usdc', 'stablecoin supply', 'stablecoin dominance', 'tether'],
    category: 'concepts',
    name: 'Stablecoin Flows',
    definition:
      'Total stablecoin supply and exchange reserves signal available buying power. Rising stablecoin market cap = more fiat entering crypto (bullish). Stablecoins moving to exchanges = ready to buy.',
    howToUse:
      'Track USDT/USDC market cap trends. Rising supply = new capital entering. Stablecoin dominance (% of total crypto market cap) falling = money rotating into risk assets (bullish).',
    commonMistakes:
      'Not monitoring stablecoins. They\'re the "cash on the sidelines" of crypto. High stablecoin reserves on exchanges are like loaded cannons waiting to buy.',
    example:
      'USDT market cap rises by $2B in a week while BTC is consolidating. Stablecoins flowing to Binance → buying power accumulating. Expect a rally when BTC breaks resistance.',
  },
  {
    id: 'mvrv',
    terms: ['mvrv', 'market value realized value', 'nupl', 'sopr', 'realized price'],
    category: 'concepts',
    name: 'MVRV & On-Chain Valuation',
    definition:
      'MVRV (Market Value to Realized Value) compares current market cap to the aggregate cost basis of all coins. MVRV > 3 = market overheated. MVRV < 1 = market undervalued (historically great buys).',
    howToUse:
      'Use MVRV for macro timing. Buy aggressively when MVRV < 1 (rare, happens in deep bears). Start scaling out when MVRV > 2.5. SOPR > 1 = holders in profit = sell pressure possible.',
    commonMistakes:
      "Using MVRV for short-term trading. It's a macro indicator — useful for monthly/quarterly positioning, not daily entries.",
    example:
      'BTC MVRV at 0.85 during bear market bottom → historically the best time to accumulate. MVRV at 3.2 during euphoria → time to start taking profits aggressively.',
  },

  // ── Advanced Risk Metrics ─────────────────────────────────
  {
    id: 'sharpe_ratio',
    terms: ['sharpe ratio', 'sortino ratio', 'risk adjusted return', 'information ratio'],
    category: 'risk_management',
    name: 'Sharpe & Sortino Ratios',
    definition:
      'Sharpe ratio = (return - risk-free rate) / volatility. Measures risk-adjusted returns. > 1 = good. > 2 = very good. Sortino is similar but only penalizes downside volatility (more relevant for traders).',
    howToUse:
      'Calculate your monthly Sharpe/Sortino ratio. Compare strategies on risk-adjusted basis, not raw returns. A strategy returning 20% with 5% volatility beats one returning 30% with 20% volatility.',
    commonMistakes:
      'Only looking at total returns without considering risk. A 100% return with 80% max drawdown is worse than a 50% return with 15% max drawdown.',
    example:
      'Strategy A: 24% annual return, 12% volatility → Sharpe 2.0. Strategy B: 40% return, 35% volatility → Sharpe 1.1. Strategy A is superior on a risk-adjusted basis.',
  },
  {
    id: 'calmar_ratio',
    terms: ['calmar ratio', 'profit factor', 'profit to drawdown', 'recovery factor'],
    category: 'risk_management',
    name: 'Calmar Ratio & Profit Factor',
    definition:
      'Calmar ratio = annual return / max drawdown. It tells you how much return you got per unit of pain. Profit Factor = gross wins / gross losses. PF > 1.5 is good. PF > 2.0 is excellent.',
    howToUse:
      'Track both metrics monthly. A declining Calmar ratio (returns shrinking while drawdowns persist) signals strategy degradation. Act before it gets worse.',
    commonMistakes:
      'Ignoring profit factor. A strategy with 70% win rate but 0.8 profit factor is losing money — the wins are too small relative to losses.',
    example:
      'Your strategy: $50,000 in gross wins, $30,000 in gross losses. Profit Factor = 1.67 (good). Max drawdown: 12%. Annual return: 36%. Calmar: 3.0 (excellent).',
  },

  // ── More Psychology ────────────────────────────────────────
  {
    id: 'anchoring',
    terms: ['anchoring', 'anchoring bias', 'reference point', 'price anchor'],
    category: 'psychology',
    name: 'Anchoring Bias',
    definition:
      'Fixating on a specific price point (your entry, an all-time high, a round number) and letting it distort your decision-making. "BTC was $69K so $50K is cheap" — anchoring to the ATH.',
    howToUse:
      "Evaluate current price on its own merits using current data (earnings, on-chain, technicals), not relative to arbitrary past prices. The market doesn't care about your entry price.",
    commonMistakes:
      "Not selling a losing position because \"it was $100 and now it's $50 — it's half price!\" The stock doesn't know what you paid. Evaluate it on current fundamentals.",
    example:
      'You bought ETH at $4,000. It drops to $2,500. Instead of anchoring to $4,000 (hoping for recovery), evaluate: would you buy ETH at $2,500 today? If not, sell.',
  },
  {
    id: 'disposition_effect',
    terms: ['disposition effect', 'selling winners early', 'holding losers too long'],
    category: 'psychology',
    name: 'Disposition Effect',
    definition:
      'The tendency to sell winning trades too early (locking in gratification) and hold losing trades too long (avoiding the pain of realization). This systematically reduces profitability.',
    howToUse:
      'Use mechanical exit rules (trailing stops, preset targets) to override your natural instincts. Let a system manage your exits rather than your emotions.',
    commonMistakes:
      'Taking profit at the first sign of pullback on winners, then watching them run 5x. Meanwhile, holding losers for months "hoping" they come back.',
    example:
      'Your data shows: avg winning trade held 2 days (small gain). Avg losing trade held 12 days (large loss). Solution: flip it. Let winners run 12 days. Cut losers in 2.',
  },
  {
    id: 'hindsight',
    terms: ['hindsight bias', 'i knew it', 'should have', 'would have', 'could have'],
    category: 'psychology',
    name: 'Hindsight Bias',
    definition:
      '"I knew that was going to happen" — no, you didn\'t. Hindsight bias makes past events seem predictable, leading to overconfidence in future predictions. Every chart looks obvious in hindsight.',
    howToUse:
      'Judge your decisions based on the information available AT THE TIME, not on what happened afterward. Cover the right half of the chart when reviewing — would you still see the setup?',
    commonMistakes:
      'Beating yourself up for "missing" a trade that was obvious in retrospect. Nothing is obvious in real-time with incomplete information.',
    example:
      'BTC pumped 20% and the daily chart shows a clear bull flag formation. "Obviously!" But in real-time, there were 3 other scenarios with equal probability. Accept the uncertainty.',
  },

  // ── Additional Trading Concepts ────────────────────────────
  {
    id: 'position_trading',
    terms: ['position trading', 'long term trading', 'buy and hold', 'investment vs trading'],
    category: 'concepts',
    name: 'Position Trading vs Day Trading',
    definition:
      'Position trading holds weeks to months, averaging 4-8 trades per month. Day trading holds minutes to hours, averaging 5-20 trades per day. Position trading is more accessible and less stressful.',
    howToUse:
      'Match your strategy to your personality and lifestyle. If you have a day job, swing/position trading is more realistic. Day trading requires full-time dedication and fast decision-making.',
    commonMistakes:
      "Thinking day trading is more profitable because it's more active. Studies show most day traders lose money. Position traders with strong selection and risk management often outperform.",
    example:
      'Position trader: 6 trades/month, 60% win rate, 1:3 R:R = very profitable. Day trader: 100 trades/month, 52% win rate, 1:1.5 R:R after fees = barely profitable.',
  },
  {
    id: 'pairs_trading',
    terms: ['pairs trading', 'statistical arbitrage', 'stat arb', 'relative value'],
    category: 'concepts',
    name: 'Pairs Trading',
    definition:
      'A market-neutral strategy: go long one asset and short a correlated asset when their ratio diverges. Profit when the ratio reverts. Works regardless of market direction.',
    howToUse:
      'Find two highly correlated assets (BTC/ETH, AAPL/MSFT). When their ratio deviates 2+ standard deviations from the mean, buy the underperformer and short the outperformer.',
    commonMistakes:
      'Assuming correlations are permanent. Correlations break during regime changes. Monitor the relationship actively and close if the correlation breaks down.',
    example:
      'ETH/BTC ratio at 2 std dev below mean → ETH is underperforming. Long ETH, short BTC. When ratio normalizes → close both. Profit regardless of whether crypto goes up or down.',
  },
  {
    id: 'dollar_cost_averaging',
    terms: ['dollar cost averaging', 'dca', 'auto invest', 'systematic buying'],
    category: 'concepts',
    name: 'Dollar Cost Averaging (Long-Term)',
    definition:
      'Investing a fixed dollar amount at regular intervals regardless of price. Over time, you buy more when prices are low and less when high, averaging your cost basis toward the long-term mean.',
    howToUse:
      'For long-term crypto/stock accumulation, DCA weekly or monthly. It removes timing pressure and emotional decision-making. Best for assets you hold 1+ years.',
    commonMistakes:
      'DCA into a fundamentally broken project hoping it will recover. DCA assumes the asset will appreciate long-term. If the thesis is broken, stop DCA and reassess.',
    example:
      'DCA $500/month into BTC for 4 years (one full halving cycle). You buy peaks and dips. Historical data shows DCA has positive returns over any 4-year period in BTC history.',
  },
  {
    id: 'market_sentiment',
    terms: ['sentiment', 'fear greed index', 'fear and greed', 'market sentiment', 'crowd psychology'],
    category: 'concepts',
    name: 'Market Sentiment & Fear/Greed',
    definition:
      'The overall attitude of investors toward a market. Extreme fear = buying opportunity (contrarian). Extreme greed = selling opportunity. The Fear & Greed Index (0-100) quantifies this.',
    howToUse:
      'Buy when Fear & Greed < 20 (extreme fear). Start selling when > 80 (extreme greed). Sentiment is a contrarian tool — go against the crowd at extremes.',
    commonMistakes:
      "Following the crowd at emotional extremes. When everyone is buying (greed), it's usually too late. When everyone is selling (fear), it's usually near the bottom.",
    example:
      'BTC Fear & Greed Index at 8 (extreme fear) during a 40% crash. Historically, buying at single-digit fear produces positive returns 95% of the time within 3 months.',
  },
  {
    id: 'asymmetric_risk',
    terms: ['asymmetric risk', 'asymmetric bet', 'convex trade', 'risk reward asymmetry'],
    category: 'risk_management',
    name: 'Asymmetric Risk/Reward',
    definition:
      "A trade where potential upside dramatically exceeds potential downside. Risk $1 to make $10+. These trades don't need high win rates — one big winner pays for many small losses.",
    howToUse:
      'Look for setups with 1:5+ R:R at key levels. Accept a lower win rate (20-30%) in exchange for massive winners. Size positions so the max loss is comfortable (0.5-1%).',
    commonMistakes:
      "Only looking at the potential gain without honestly assessing the probability. A 1:10 R:R trade with 5% probability isn't worth taking repeatedly.",
    example:
      'BTC at major monthly support with confluence. Risk $500 (stop just below support). If support holds and trend resumes, target = $5,000 (10R). This trade needs only 10% hit rate to profit.',
  },
  {
    id: 'market_cycle',
    terms: [
      'market cycle',
      'bull market',
      'bear market',
      'cycle',
      'accumulation phase',
      'distribution phase',
      'markdown phase',
      'markup phase',
    ],
    category: 'concepts',
    name: 'Market Cycles',
    definition:
      'Markets move through four phases: Accumulation (smart money buying at lows), Markup (trending up, retail enters), Distribution (smart money selling at highs), Markdown (trending down). Repeat.',
    howToUse:
      'Identify the current phase to align your strategy. Accumulation: quietly buy. Markup: ride the trend. Distribution: start taking profits. Markdown: go to cash or short.',
    commonMistakes:
      "Not recognizing distribution while it's happening. Distribution looks like a healthy range after a rally — everyone thinks it's consolidation. Track volume and on-chain data for clues.",
    example:
      'BTC after 300% rally. Price ranges sideways for 2 months. Volume declining. Exchange inflows increasing. Long-term holders selling → distribution phase. Reduce exposure before markdown.',
  },
  {
    id: 'survivorship_bias',
    terms: ['survivorship bias', 'selection bias', 'cherry picking', 'social media trading'],
    category: 'psychology',
    name: 'Survivorship Bias in Trading',
    definition:
      'Only seeing successful traders and strategies while the failures are invisible. Social media amplifies this — you see the 1% who made 1000% while ignoring the 99% who lost everything.',
    howToUse:
      'Judge strategies by verified track records, not screenshots. Ask for FULL history (losses included). Your own journal is the only reliable data source for YOUR trading performance.',
    commonMistakes:
      'Copying a "guru" based on their highlight reel. Ask: "what\'s your worst drawdown? How many losing months?" If they won\'t answer, their track record is cherry-picked.',
    example:
      '10,000 traders start a challenge. 100 make money (1%). Those 100 post their results on Twitter. You see 100 "success stories" and think trading is easy. The other 9,900 are silent.',
  },
  {
    id: 'curve_fitting',
    terms: ['curve fitting', 'overfitting', 'data mining', 'over optimization'],
    category: 'concepts',
    name: 'Curve Fitting & Overfitting',
    definition:
      "Over-optimizing a strategy to perfectly fit historical data, making it useless for future markets. A strategy with 20 parameters probably won't work live — it's memorized the past, not learned patterns.",
    howToUse:
      'Keep strategies simple (3-5 parameters max). Use out-of-sample testing (train on 2018-2022, test on 2023-2024). If performance drops significantly out-of-sample, the strategy is overfit.',
    commonMistakes:
      'Optimizing until the backtest shows 90% win rate and then wondering why it fails live. The more you optimize, the less robust the strategy becomes.',
    example:
      'Strategy with 15 parameters shows 85% win rate on 3 years of data. On fresh 6-month data: 42% win rate. It was overfit. Simplified to 4 parameters: 60% both in-sample and out-of-sample.',
  },
  {
    id: 'risk_budgeting',
    terms: ['risk budget', 'risk allocation', 'capital preservation', 'trading capital'],
    category: 'risk_management',
    name: 'Risk Budgeting',
    definition:
      'Allocating a specific amount of acceptable loss (your "risk budget") per day, week, or month. Once the budget is spent, you stop trading until the next period. Prevents catastrophic losses.',
    howToUse:
      'Set daily max loss at 2-3% of account, weekly at 5%, monthly at 10%. When hit, stop trading. This ensures survival even during your worst drawdowns.',
    commonMistakes:
      'Not having a risk budget = unlimited potential loss in a single day. Also, resetting your risk budget too frequently (daily) can prevent you from adjusting after a bad start.',
    example:
      "Account: $50K. Daily risk budget: $1,500 (3%). After 3 losses totaling $1,400, you have $100 left in today's budget. One more loss of any size → done for the day.",
  },
];

// ─── Knowledge Base Class ───────────────────────────────────────

export class TradingKnowledgeBase {
  private _entries: KnowledgeEntry[];

  constructor() {
    this._entries = ENTRIES;
  }

  /**
   * Look up a concept by matching user query against entry terms.
   * Returns the best match, or null if nothing relevant.
   */
  lookup(query: string): LookupResult | null {
    const normalized = query.toLowerCase().trim();
    const results = this._scoreAll(normalized);

    if (results.length === 0) return null;
    const best = results[0];
    return best && best.score >= 0.3 ? best : null;
  }

  /**
   * Search for multiple relevant entries.
   */
  search(query: string, limit = 3): LookupResult[] {
    const normalized = query.toLowerCase().trim();
    return this._scoreAll(normalized).slice(0, limit);
  }

  /**
   * Format a knowledge entry as a copilot response.
   */
  formatForCopilot(entry: KnowledgeEntry): string {
    const lines: string[] = [];
    lines.push(`**${entry.name}**`);
    lines.push('');
    lines.push(entry.definition);
    lines.push('');
    lines.push(`**How to use:** ${entry.howToUse}`);
    lines.push('');
    lines.push(`**Common mistake:** ${entry.commonMistakes}`);
    lines.push('');
    lines.push(`**Example:** ${entry.example}`);
    return lines.join('\n');
  }

  /**
   * Get a brief answer (definition only).
   */
  formatBrief(entry: KnowledgeEntry): string {
    return `**${entry.name}** — ${entry.definition}`;
  }

  /**
   * Get all entries for a category.
   */
  getByCategory(category: KnowledgeCategory): KnowledgeEntry[] {
    return this._entries.filter((e) => e.category === category);
  }

  /**
   * Get all available entry IDs.
   */
  getAllIds(): string[] {
    return this._entries.map((e) => e.id);
  }

  /**
   * Get entry count.
   */
  get count(): number {
    return this._entries.length;
  }

  /**
   * Get all available categories.
   */
  getCategories(): KnowledgeCategory[] {
    const cats = new Set(this._entries.map((e) => e.category));
    return [...cats];
  }

  // ─── Internal Scoring ────────────────────────────────────────

  private _scoreAll(query: string): LookupResult[] {
    const results: LookupResult[] = [];

    for (const entry of this._entries) {
      let bestScore = 0;
      let bestTerm = '';

      for (const term of entry.terms) {
        const score = this._scoreMatch(query, term);
        if (score > bestScore) {
          bestScore = score;
          bestTerm = term;
        }
      }

      // Also check entry name
      const nameScore = this._scoreMatch(query, entry.name.toLowerCase());
      if (nameScore > bestScore) {
        bestScore = nameScore;
        bestTerm = entry.name;
      }

      if (bestScore > 0.1) {
        results.push({ entry, score: bestScore, matchedTerm: bestTerm });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  private _scoreMatch(query: string, term: string): number {
    const termLower = term.toLowerCase();

    // Exact match
    if (query === termLower) return 1.0;

    // Query contains the term exactly
    if (query.includes(termLower)) return 0.9;

    // Term contains the query exactly
    if (termLower.includes(query)) return 0.7;

    // "What is X" pattern
    const whatIsMatch = query.match(/(?:what(?:'s|\s+is|\s+are))\s+(.+)/i);
    if (whatIsMatch && whatIsMatch[1]) {
      const subject = whatIsMatch[1]
        .toLowerCase()
        .replace(/[?.!]$/, '')
        .trim();
      if (subject === termLower) return 1.0;
      if (termLower.includes(subject)) return 0.85;
      if (subject.includes(termLower)) return 0.75;
    }

    // "How to use X" / "How does X work" patterns
    const howToMatch = query.match(/(?:how\s+(?:to\s+use|does|do|should\s+i\s+use))\s+(.+)/i);
    if (howToMatch && howToMatch[1]) {
      const subject = howToMatch[1]
        .toLowerCase()
        .replace(/[?.!]$/, '')
        .trim();
      if (termLower.includes(subject) || subject.includes(termLower)) return 0.8;
    }

    // "Explain X" / "Tell me about X"
    const explainMatch = query.match(/(?:explain|tell\s+me\s+about|describe)\s+(.+)/i);
    if (explainMatch && explainMatch[1]) {
      const subject = explainMatch[1]
        .toLowerCase()
        .replace(/[?.!]$/, '')
        .trim();
      if (termLower.includes(subject) || subject.includes(termLower)) return 0.8;
    }

    // Word overlap scoring
    const queryWords = query.split(/\s+/).filter((w) => w.length > 2);
    const termWords = termLower.split(/\s+/).filter((w) => w.length > 2);
    if (queryWords.length === 0 || termWords.length === 0) return 0;

    let matches = 0;
    for (const qw of queryWords) {
      for (const tw of termWords) {
        if (qw === tw || tw.includes(qw) || qw.includes(tw)) {
          matches++;
          break;
        }
      }
    }

    return (matches / Math.max(queryWords.length, termWords.length)) * 0.6;
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const tradingKnowledgeBase = new TradingKnowledgeBase();
export default tradingKnowledgeBase;
