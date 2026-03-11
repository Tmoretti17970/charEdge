// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart-to-Journal Pipeline (Sprint 12)
// One-click capture of chart state into a journal entry.
// Captures: symbol, timeframe, indicators, drawings, screenshot,
//           price context, and auto-generates trade notes.
// ═══════════════════════════════════════════════════════════════════

/**
 * Capture the current chart state for journaling.
 * @param {Object} chartState - Current chart configuration
 * @param {HTMLCanvasElement} canvas - Chart canvas for screenshot
 * @returns {Object} Journal entry data
 */
export function captureChartState(chartState) {
  const {
    symbol, tf, chartType, indicators, drawings,
    data, _activeTool, _drawingColor, _stickyMode,
  } = chartState;

  const lastBar = data?.[data.length - 1];
  const firstBar = data?.[0];

  // Determine market context
  let marketContext = 'neutral';
  if (data?.length > 20) {
    const sma20 = data.slice(-20).reduce((s, b) => s + b.close, 0) / 20;
    if (lastBar.close > sma20 * 1.01) marketContext = 'bullish';
    else if (lastBar.close < sma20 * 0.99) marketContext = 'bearish';
  }

  // Classify based on drawing types used
  const drawingTypes = [...new Set((drawings || []).map(d => d.type))];
  const analysisType = classifyAnalysis(drawingTypes, indicators);

  // Auto-generate notes
  const notes = generateAutoNotes(symbol, tf, lastBar, marketContext, drawingTypes, indicators);

  return {
    id: `j_${Date.now()}`,
    timestamp: Date.now(),
    symbol,
    timeframe: tf,
    chartType,
    price: lastBar?.close || 0,
    priceChange: lastBar && firstBar ? ((lastBar.close - firstBar.open) / firstBar.open * 100).toFixed(2) + '%' : null,
    volume: lastBar?.volume || 0,
    marketContext,
    analysisType,
    indicators: (indicators || []).map(i => ({ type: i.type || i.indicatorId, params: i.params })),
    drawingCount: drawings?.length || 0,
    drawingTypes,
    notes,
    tags: generateAutoTags(symbol, tf, marketContext, drawingTypes),
    mood: null, // User can add manually
    setup: null, // User can classify
  };
}

/**
 * Classify the type of analysis based on tools used.
 */
function classifyAnalysis(drawingTypes, indicators) {
  const hasSpR = drawingTypes.some(t => ['hline', 'hray', 'rect'].includes(t));
  const hasTrend = drawingTypes.some(t => ['trendline', 'channel', 'ray'].includes(t));
  const hasFib = drawingTypes.some(t => t.startsWith('fib'));
  const hasMomentum = (indicators || []).some(i => ['rsi', 'macd', 'stochastic'].includes(i.type || i.indicatorId));

  if (hasFib && hasSpR) return 'fibonacci-snr';
  if (hasTrend && hasMomentum) return 'trend-momentum';
  if (hasSpR) return 'support-resistance';
  if (hasTrend) return 'trend-analysis';
  if (hasFib) return 'fibonacci';
  if (hasMomentum) return 'momentum';
  return 'general';
}

/**
 * Generate automatic trading notes from chart state.
 */
function generateAutoNotes(symbol, tf, lastBar, context, drawingTypes, indicators) {
  const parts = [];
  parts.push(`📊 ${symbol} on ${tf}`);
  if (lastBar) parts.push(`Price: $${lastBar.close.toLocaleString()}`);
  parts.push(`Bias: ${context}`);
  if (drawingTypes.length > 0) parts.push(`Tools used: ${drawingTypes.join(', ')}`);
  if (indicators?.length > 0) parts.push(`Indicators: ${indicators.map(i => i.type || i.indicatorId).join(', ')}`);
  return parts.join(' | ');
}

/**
 * Generate auto-tags for quick filtering.
 */
function generateAutoTags(symbol, tf, context, drawingTypes) {
  const tags = [symbol, tf, context];
  if (drawingTypes.includes('fib_retracement') || drawingTypes.includes('fib')) tags.push('fibonacci');
  if (drawingTypes.includes('trendline')) tags.push('trendline');
  if (drawingTypes.includes('hline')) tags.push('levels');
  return tags;
}

/**
 * Quick-journal: creates a minimal entry with one click.
 */
export function quickJournalEntry(symbol, price, side, notes = '') {
  return {
    id: `qj_${Date.now()}`,
    timestamp: Date.now(),
    symbol,
    price,
    side, // 'long' | 'short' | 'watchlist'
    notes: notes || `Quick note on ${symbol} at $${price}`,
    tags: [symbol, side],
    source: 'chart-quick-journal',
  };
}
