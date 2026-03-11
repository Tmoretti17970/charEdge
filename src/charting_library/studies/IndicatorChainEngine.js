// ═══════════════════════════════════════════════════════════════════
// charEdge — Indicator Chain Engine (Sprint 10)
// Allows indicators to be applied on top of other indicators.
// e.g. RSI of RSI, EMA of RSI, Bollinger of MACD, etc.
// ═══════════════════════════════════════════════════════════════════

import * as comp from './indicators/computations.js';

/**
 * Apply a chain of indicator transformations.
 * Each step takes the output of the previous step as input.
 *
 * @param {Object[]} bars - Raw OHLCV bars
 * @param {Object[]} chain - Array of { type, params, inputKey? }
 *   - type: indicator function name (e.g. 'ema', 'rsi', 'bollingerBands')
 *   - params: object of params to pass to the function
 *   - inputKey: which key from the previous multi-output result to use (e.g. 'k' from stochastic)
 * @returns {Object} { values: number[], chain: details[] }
 *
 * @example
 * // EMA(14) of RSI(14) — smoothed RSI
 * computeChain(bars, [
 *   { type: 'rsi', params: { period: 14 } },
 *   { type: 'ema', params: { period: 14 } },
 * ]);
 *
 * // Bollinger Bands of MACD hist
 * computeChain(bars, [
 *   { type: 'macd', params: { fast: 12, slow: 26, signal: 9 }, inputKey: 'histogram' },
 *   { type: 'bollingerBands', params: { period: 20, stdDev: 2 } },
 * ]);
 */
export function computeChain(bars, chain) {
  if (!chain || chain.length === 0) return { values: [], chain: [] };

  const closes = bars.map(b => b.close);
  let currentInput = closes; // Start from price closes
  const details = [];

  for (let i = 0; i < chain.length; i++) {
    const step = chain[i];
    const fn = getComputationFn(step.type);
    if (!fn) {
      details.push({ step: i, type: step.type, error: 'Unknown function' });
      continue;
    }

    // Determine if this function expects bars or a simple array
    const needsBars = BARS_FUNCTIONS.has(step.type);
    const params = step.params || {};

    let result;
    try {
      if (i === 0 && needsBars) {
        // First step with bars-based function
        result = fn(bars, ...Object.values(params));
      } else if (needsBars && i > 0) {
        // Can't apply bars-based function on derived data
        // Fallback: try with closes-like input
        result = fn(currentInput, ...Object.values(params));
      } else {
        // Simple array-based function
        result = fn(currentInput, ...Object.values(params));
      }
    } catch (err) {
      details.push({ step: i, type: step.type, error: err.message });
      continue;
    }

    // Extract the right output
    if (typeof result === 'object' && !Array.isArray(result)) {
      // Multi-output indicator (e.g. MACD, Stochastic, BBands)
      const key = step.inputKey || Object.keys(result)[0];
      details.push({ step: i, type: step.type, outputKey: key, keys: Object.keys(result) });
      currentInput = result[key] || [];

      // If this is the last step, return the full multi-output
      if (i === chain.length - 1) {
        return { values: currentInput, multiOutput: result, chain: details };
      }
    } else {
      details.push({ step: i, type: step.type });
      currentInput = result;
    }
  }

  return { values: currentInput, chain: details };
}

/** Functions that require bars (not a simple number[]) */
const BARS_FUNCTIONS = new Set([
  'stochastic', 'atr', 'adx', 'cci', 'obv', 'williamsR', 'mfi',
  'vwap', 'vwapBands', 'ichimoku', 'cmf', 'keltnerChannel', 'vwma',
  'donchianChannel', 'chaikinOscillator', 'aroon', 'massIndex',
  'squeezeMomentum',
]);

/** Resolve computation function by name */
function getComputationFn(name) {
  const map = {
    sma: comp.sma,
    ema: comp.ema,
    wma: comp.wma,
    dema: comp.dema,
    tema: comp.tema,
    hma: comp.hma,
    kama: comp.kama,
    vidya: comp.vidya,
    frama: comp.frama,
    rsi: (src, period = 14) => comp.rsi(src, period),
    macd: (src, fast, slow, signal) => comp.macd(src, fast, slow, signal),
    bollingerBands: (src, period, stdDev) => comp.bollingerBands(src, period, stdDev),
    stochastic: (bars, kP, dP) => comp.stochastic(bars, kP, dP),
    atr: (bars, period) => comp.atr(bars, period),
    adx: (bars, period) => comp.adx(bars, period),
    cci: (bars, period) => comp.cci(bars, period),
    obv: (bars) => comp.obv(bars),
    williamsR: (bars, period) => comp.williamsR(bars, period),
    roc: (src, period) => comp.roc(src, period),
    mfi: (bars, period) => comp.mfi(bars, period),
    vwap: (bars) => comp.vwap(bars),
    cmf: (bars, period) => comp.cmf(bars, period),
    keltnerChannel: (bars, ...args) => comp.keltnerChannel(bars, ...args),
    vwma: (bars, period) => comp.vwma(bars, period),
    donchianChannel: (bars, period) => comp.donchianChannel(bars, period),
    linearRegressionChannel: (src, ...args) => comp.linearRegressionChannel(src, ...args),
    trix: (src, period) => comp.trix(src, period),
    chaikinOscillator: (bars, ...args) => comp.chaikinOscillator(bars, ...args),
    aroon: (bars, period) => comp.aroon(bars, period),
    ppo: (src, ...args) => comp.ppo(src, ...args),
    dpo: (src, period) => comp.dpo(src, period),
    massIndex: (bars, ...args) => comp.massIndex(bars, ...args),
    kst: (src) => comp.kst(src),
    coppock: (src, ...args) => comp.coppock(src, ...args),
    squeezeMomentum: (bars, ...args) => comp.squeezeMomentum(bars, ...args),
  };
  return map[name] || null;
}

/**
 * Get available indicators for chaining UI.
 */
export function getChainableIndicators() {
  return [
    { id: 'sma', label: 'SMA', category: 'overlay', needsBars: false },
    { id: 'ema', label: 'EMA', category: 'overlay', needsBars: false },
    { id: 'wma', label: 'WMA', category: 'overlay', needsBars: false },
    { id: 'hma', label: 'HMA', category: 'overlay', needsBars: false },
    { id: 'kama', label: 'KAMA', category: 'adaptive', needsBars: false },
    { id: 'vidya', label: 'VIDYA', category: 'adaptive', needsBars: false },
    { id: 'frama', label: 'FRAMA', category: 'adaptive', needsBars: false },
    { id: 'rsi', label: 'RSI', category: 'oscillator', needsBars: false },
    { id: 'macd', label: 'MACD', category: 'oscillator', needsBars: false },
    { id: 'bollingerBands', label: 'BB', category: 'overlay', needsBars: false },
    { id: 'roc', label: 'ROC', category: 'oscillator', needsBars: false },
    { id: 'trix', label: 'TRIX', category: 'oscillator', needsBars: false },
    { id: 'ppo', label: 'PPO', category: 'oscillator', needsBars: false },
    { id: 'dpo', label: 'DPO', category: 'oscillator', needsBars: false },
    { id: 'kst', label: 'KST', category: 'oscillator', needsBars: false },
    { id: 'coppock', label: 'Coppock', category: 'oscillator', needsBars: false },
  ];
}
