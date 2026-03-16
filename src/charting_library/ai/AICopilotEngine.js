// MVP Regex/Keyword-based NLP Engine for charEdge Chat-to-Chart

const INDICATOR_MAP = {
  rsi: 'RSI',
  macd: 'MACD',
  bollinger: 'BB',
  bands: 'BB',
  sma: 'SMA',
  ema: 'EMA',
  vwap: 'VWAP',
  volume: 'Volume',
  stochastic: 'Stochastic',
  atr: 'ATR',
};

const TIMEFRAME_MAP = {
  '1m': '1m', '1 min': '1m', 'minute': '1m',
  '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '1h', 'hour': '1h', '2h': '2h', '4h': '4h',
  '1d': '1D', 'daily': '1D', 'day': '1D',
  '1w': '1W', 'weekly': '1W', 'week': '1W',
};

/**
 * Simple Levenshtein distance for fuzzy matching.
 */
function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Fuzzy match a word against a dictionary. Returns best match if distance ≤ 2.
 */
function fuzzyMatch(word, dict) {
  let best = null;
  let bestDist = 3; // max allowed
  for (const key of Object.keys(dict)) {
    const d = levenshtein(word, key);
    if (d < bestDist) { bestDist = d; best = key; }
  }
  return best;
}

/**
 * Parses a natural language string into a structured command object.
 * Supports ~40 patterns with fuzzy matching for typo tolerance.
 * @param {string} input - The user's text input
 * @returns {object|null} - The parsed command { action: string, payload: any }, or null if misunderstood.
 */
export function parseChartCommand(input) {
  if (!input || typeof input !== 'string') return null;

  const text = input.trim().toLowerCase();

  // ── 0. ANALYSIS / INSIGHT TRIGGERS ──────────────────────────
  if (text.includes('what') && text.includes('happening')) return { action: 'analyze', payload: 'pulse' };
  if (text.includes('analyze') || text.includes('analysis')) return { action: 'analyze', payload: 'full' };
  if (text.includes('grade') || text.includes('score') || text.includes('quality')) return { action: 'analyze', payload: 'grade' };
  if (text.includes('key level') || text.includes('support') && text.includes('resistance')) return { action: 'analyze', payload: 'levels' };
  if (text.includes('what') && text.includes('rsi')) return { action: 'query_indicator', payload: 'RSI' };
  if (text.includes('what') && text.includes('macd')) return { action: 'query_indicator', payload: 'MACD' };
  if (text.includes('what') && text.includes('volume')) return { action: 'query_indicator', payload: 'Volume' };

  // ── 0b. PATTERN & ANOMALY QUERIES (Sprint 7) ───────────────
  if (text.includes('pattern') && (text.includes('scan') || text.includes('detect') || text.includes('find'))) return { action: 'analyze', payload: 'patterns' };
  if (text.includes('anomal') || text.includes('unusual')) return { action: 'analyze', payload: 'anomalies' };
  if (text.includes('regime') || text.includes('market type')) return { action: 'analyze', payload: 'regime' };
  if (text.includes('divergence') || text.includes('diverging')) return { action: 'analyze', payload: 'divergence' };
  if (text.includes('multi') && text.includes('timeframe') || text.includes('mtf')) return { action: 'analyze', payload: 'multi_tf' };
  if (text.includes('psychology') || text.includes('behavioral') || text.includes('tilt')) return { action: 'analyze', payload: 'psychology' };

  // ── 1. ADD INDICATOR ────────────────────────────────────────
  if (text.includes('add') || text.includes('show') || text.includes('put') || text.includes('overlay')) {
    // Exact match first
    for (const [key, id] of Object.entries(INDICATOR_MAP)) {
      if (text.includes(key)) return { action: 'add_indicator', payload: id };
    }
    // Fuzzy match for typos (e.g. "add rsi" with typo "add rci")
    const words = text.split(/\s+/);
    for (const word of words) {
      const match = fuzzyMatch(word, INDICATOR_MAP);
      if (match) return { action: 'add_indicator', payload: INDICATOR_MAP[match] };
    }
  }

  // ── 1b. REMOVE INDICATOR ───────────────────────────────────
  if (text.includes('remove') || text.includes('delete') || text.includes('hide')) {
    for (const [key, id] of Object.entries(INDICATOR_MAP)) {
      if (text.includes(key)) return { action: 'remove_indicator', payload: id };
    }
  }

  // ── 1c. CLEAR / RESET ──────────────────────────────────────
  if (text.includes('clear') || text.includes('remove all') || text.includes('clean') || text.includes('reset')) {
    if (text.includes('indicator') || text.includes('study')) return { action: 'clear_indicators' };
    if (text.includes('drawing') || text.includes('line')) return { action: 'clear_drawings' };
    return { action: 'clear_all' };
  }

  // ── 2. CHANGE TIMEFRAME ────────────────────────────────────
  for (const [key, tfId] of Object.entries(TIMEFRAME_MAP)) {
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(text)) {
      if (text.includes('go') || text.includes('switch') || text.includes('change') || text.includes('chart') || text.includes('set')) {
        return { action: 'change_tf', payload: tfId };
      }
      if (text === key) return { action: 'change_tf', payload: tfId };
    }
  }

  // ── 3. CHANGE SYMBOL ───────────────────────────────────────
  const symbolRegex = /(?:chart|show me|look at|switch to|compare|open) \b([a-z0-9]+)\b/i;
  const match = text.match(symbolRegex);
  if (match && match[1]) {
    const sym = match[1].toUpperCase();
    if (!['THE', 'A', 'MY', 'ALL', 'ME', 'IT', 'THIS', 'THAT'].includes(sym)) {
      return { action: 'change_symbol', payload: sym };
    }
  }
  if (/^[a-z0-9]{2,8}$/i.test(text)) {
    return { action: 'change_symbol', payload: text.toUpperCase() };
  }

  // ── 4. DRAWING TOOLS ───────────────────────────────────────
  if (text.includes('draw')) {
    if (text.includes('trend')) return { action: 'activate_tool', payload: 'trendline' };
    if (text.includes('fib')) return { action: 'activate_tool', payload: 'fib' };
    if (text.includes('horizontal') || text.includes('support') || text.includes('hline')) return { action: 'activate_tool', payload: 'hline' };
    if (text.includes('rectangle') || text.includes('box')) return { action: 'activate_tool', payload: 'rect' };
    if (text.includes('channel')) return { action: 'activate_tool', payload: 'channel' };
    if (text.includes('measure') || text.includes('ruler')) return { action: 'activate_tool', payload: 'measure' };
  }

  // ── 4b. DRAWING CONTEXT ACTIONS (Sprint 7) ─────────────────
  if (text.includes('fib') && text.includes('swing')) return { action: 'smart_draw', payload: 'fib_last_swing' };
  if (text.includes('mirror') && text.includes('trend')) return { action: 'smart_draw', payload: 'mirror_trendline' };
  if (text.includes('measure') && (text.includes('move') || text.includes('this'))) return { action: 'smart_draw', payload: 'measure_move' };

  // ── 5. ZOOM CONTROLS ──────────────────────────────────────
  if (text.includes('zoom in') || text.includes('closer')) return { action: 'zoom', payload: 'in' };
  if (text.includes('zoom out') || text.includes('wider') || text.includes('further')) return { action: 'zoom', payload: 'out' };
  if (text.includes('fit') || text.includes('reset zoom')) return { action: 'zoom', payload: 'fit' };

  // ── 6. THEME ───────────────────────────────────────────────
  if (text.includes('dark mode') || text.includes('dark theme')) return { action: 'theme', payload: 'dark' };
  if (text.includes('light mode') || text.includes('light theme')) return { action: 'theme', payload: 'light' };

  // ── 7. ALERT COMMANDS (Sprint 7) ───────────────────────────
  if (text.includes('alert') || text.includes('notify')) {
    if (text.includes('rsi') && text.includes('over')) return { action: 'smart_alert', payload: 'rsi_overbought' };
    if (text.includes('rsi') && text.includes('under')) return { action: 'smart_alert', payload: 'rsi_oversold' };
    if (text.includes('squeeze') || text.includes('bollinger')) return { action: 'smart_alert', payload: 'bb_squeeze' };
    if (text.includes('volume') && text.includes('spike')) return { action: 'smart_alert', payload: 'volume_spike' };
    if (text.includes('breakout')) return { action: 'smart_alert', payload: 'key_level_breakout' };
    if (text.includes('cross')) return { action: 'smart_alert', payload: 'macd_bullish_cross' };
    return { action: 'open_alerts' };
  }

  // ── 8. TRADE COMMANDS (Sprint 7) ───────────────────────────
  if (text.includes('r:r') || text.includes('risk reward') || text.includes('reward ratio')) return { action: 'trade_query', payload: 'risk_reward' };
  if (text.includes('trail') && text.includes('stop')) return { action: 'trade_action', payload: 'trail_stop' };
  if (text.includes('grade') && (text.includes('entry') || text.includes('trade'))) return { action: 'analyze', payload: 'grade' };
  if (text.includes('should') && text.includes('exit')) return { action: 'trade_query', payload: 'exit_advice' };

  // ── 9. JOURNAL & SCREENSHOT (Sprint 7) ─────────────────────
  if (text.includes('journal') && (text.includes('add') || text.includes('log') || text.includes('note'))) return { action: 'journal_add' };
  if (text.includes('screenshot') || text.includes('capture') || text.includes('snap')) return { action: 'screenshot' };
  if (text.includes('compare') && text.includes('trade')) return { action: 'journal_compare' };
  if (text.includes('what went wrong') || text.includes('review') && text.includes('trade')) return { action: 'trade_review' };

  // ── 10. STRATEGY COMMANDS (Sprint 7) ───────────────────────
  if (text.includes('backtest') || text.includes('back test')) return { action: 'open_backtest' };
  if (text.includes('strategy') && (text.includes('build') || text.includes('create'))) return { action: 'open_strategy' };
  if (text.includes('optimize') && text.includes('strategy')) return { action: 'strategy_optimize' };

  // Unhandled
  return null;
}

// ─── Contextual Suggestions Engine (Sprint 7) ──────────────────

/**
 * Contextual quick-action banks keyed by user mode / state.
 * Each entry: { label, icon, command }
 */
const CONTEXTUAL_BANKS = {
  idle: [
    { label: "What's happening?", icon: '🔍', command: "what's happening" },
    { label: 'Full Analysis', icon: '📊', command: 'full analysis' },
    { label: 'Key Levels', icon: '📐', command: 'key levels' },
    { label: 'Pattern Scan', icon: '🔎', command: 'pattern scan' },
    { label: 'Grade Setup', icon: '⭐', command: 'grade this setup' },
  ],
  drawing: [
    { label: 'Fib from Swing', icon: '🌀', command: 'draw fib from last swing' },
    { label: 'Mirror Trendline', icon: '🪞', command: 'mirror trendline' },
    { label: 'Measure Move', icon: '📏', command: 'measure this move' },
    { label: 'Clear Drawings', icon: '🧹', command: 'clear drawings' },
    { label: 'Add Horizontal', icon: '➖', command: 'draw horizontal' },
  ],
  trade_active: [
    { label: "What's my R:R?", icon: '⚖️', command: 'risk reward ratio' },
    { label: 'Trail Stop', icon: '🎯', command: 'trail stop' },
    { label: 'Grade Entry', icon: '⭐', command: 'grade this entry' },
    { label: 'Exit Advice', icon: '🚪', command: 'should I exit' },
    { label: 'Journal Trade', icon: '📓', command: 'journal add trade' },
  ],
  post_trade: [
    { label: 'Journal This', icon: '📓', command: 'journal add trade' },
    { label: 'Compare Similar', icon: '🔄', command: 'compare trades' },
    { label: 'What Went Wrong?', icon: '🔍', command: 'what went wrong' },
    { label: 'Screenshot', icon: '📸', command: 'screenshot' },
    { label: 'Full Analysis', icon: '📊', command: 'full analysis' },
  ],
  alert_creating: [
    { label: 'RSI Overbought', icon: '🔥', command: 'alert rsi overbought' },
    { label: 'BB Squeeze', icon: '🔋', command: 'alert bollinger squeeze' },
    { label: 'Volume Spike', icon: '📊', command: 'alert volume spike' },
    { label: 'Breakout', icon: '🚀', command: 'alert breakout' },
    { label: 'MACD Cross', icon: '📈', command: 'alert macd cross' },
  ],
  strategy: [
    { label: 'Run Backtest', icon: '▶️', command: 'backtest' },
    { label: 'Optimize', icon: '⚡', command: 'optimize strategy' },
    { label: 'Grade Setup', icon: '⭐', command: 'grade this setup' },
    { label: 'Regime Check', icon: '🌊', command: 'market regime' },
    { label: 'Full Analysis', icon: '📊', command: 'full analysis' },
  ],
};

/**
 * Get contextual quick-action suggestions based on the user's current mode.
 *
 * @param {string} mode - Current UI mode: 'idle' | 'drawing' | 'trade_active' | 'post_trade' | 'alert_creating' | 'strategy'
 * @param {Object} [chartState] - Optional current chart state for further refinement
 * @returns {Array<{label: string, icon: string, command: string}>} Top 5 suggestions
 */
export function getContextualSuggestions(mode = 'idle', chartState = {}) {
  const bank = CONTEXTUAL_BANKS[mode] || CONTEXTUAL_BANKS.idle;

  // If we have chart state, we can refine further
  if (chartState.hasActiveAlert && mode === 'idle') {
    return CONTEXTUAL_BANKS.alert_creating;
  }
  if (chartState.hasActivePosition && mode === 'idle') {
    return CONTEXTUAL_BANKS.trade_active;
  }

  return bank;
}

