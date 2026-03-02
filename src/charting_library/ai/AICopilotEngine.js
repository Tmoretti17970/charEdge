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
 * Parses a natural language string into a structured command object.
 * @param {string} input - The user's text input
 * @returns {object|null} - The parsed command { action: string, payload: any }, or null if misunderstood.
 */
export function parseChartCommand(input) {
  if (!input || typeof input !== 'string') return null;

  const text = input.trim().toLowerCase();

  // 1. ADD INDICATOR
  // e.g. "add rsi", "show macd", "put bollinger bands on chart"
  if (text.includes('add') || text.includes('show') || text.includes('put')) {
    for (const [key, id] of Object.entries(INDICATOR_MAP)) {
      if (text.includes(key)) {
        return { action: 'add_indicator', payload: id };
      }
    }
  }

  // 1b. REMOVE INDICATOR / CLEAR CHART
  if (text.includes('clear') || text.includes('remove all') || text.includes('clean')) {
      if (text.includes('indicator') || text.includes('study')) {
          return { action: 'clear_indicators' };
      }
      if (text.includes('drawing') || text.includes('line')) {
          return { action: 'clear_drawings' };
      }
      return { action: 'clear_all' };
  }

  // 2. CHANGE TIMEFRAME
  // e.g. "go to 15m", "switch to daily", "1h chart"
  for (const [key, tfId] of Object.entries(TIMEFRAME_MAP)) {
    // strict word boundary match to avoid matching 'd' inside 'add'
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(text)) {
      if (text.includes('go') || text.includes('switch') || text.includes('change') || text.includes('chart')) {
        return { action: 'change_tf', payload: tfId };
      }
      // If they just typed "15m"
      if (text === key) return { action: 'change_tf', payload: tfId };
    }
  }

  // 3. CHANGE SYMBOL
  // e.g. "chart tsla", "look at eth", "show me btc"
  const symbolRegex = /(?:chart|show me|look at|switch to) \b([a-z0-9]+)\b/i;
  const match = text.match(symbolRegex);
  if (match && match[1]) {
    // Avoid matching common words
    const sym = match[1].toUpperCase();
    if (!['THE', 'A', 'MY', 'ALL', 'ME'].includes(sym)) {
      return { action: 'change_symbol', payload: sym };
    }
  }
  // Fallback: If they just typed a ticker symbol (e.g. "AAPL", "BTCUSDT")
  // Let's assume a valid ticker is 2-8 uppercase letters/numbers.
  if (/^[a-z0-9]{2,8}$/i.test(text)) {
    return { action: 'change_symbol', payload: text.toUpperCase() };
  }

  // 4. DRAWING TOOLS
  if (text.includes('draw')) {
      if (text.includes('trend')) return { action: 'activate_tool', payload: 'trendline' };
      if (text.includes('fib')) return { action: 'activate_tool', payload: 'fib' };
      if (text.includes('horizontal') || text.includes('support')) return { action: 'activate_tool', payload: 'hline' };
      if (text.includes('rectangle') || text.includes('box')) return { action: 'activate_tool', payload: 'rect' };
  }


  // Unhandled
  return null;
}
