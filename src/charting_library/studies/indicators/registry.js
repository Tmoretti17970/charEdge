// ═══════════════════════════════════════════════════════════════════
// charEdge — Indicator Registry
// Central registry of all indicators with metadata, default params,
// computation bindings, and rendering configuration.
//
// Two rendering modes:
//   overlay — renders on the main chart pane (SMA, EMA, BB, VWAP)
//   pane    — renders in a separate pane below (RSI, MACD, Stoch)
//
// Each indicator definition:
//   - id, name, shortName
//   - mode: 'overlay' | 'pane'
//   - params: configurable parameters with defaults
//   - outputs: what the compute function returns
//   - compute(bars, params): returns computed values
//   - render config: colors, line styles, fills, bands
// ═══════════════════════════════════════════════════════════════════

import * as C from './computations.js';
import { computeVolumeDelta } from './volumeDelta.js';

/**
 * @typedef {Object} IndicatorOutput
 * @property {string} key    - Output key name
 * @property {string} label  - Display label
 * @property {string} color  - Default color
 * @property {number} width  - Line width
 * @property {string} type   - 'line' | 'histogram' | 'band' | 'dots'
 * @property {number[]} [dash] - Dash pattern
 */

/**
 * @typedef {Object} IndicatorDef
 * @property {string}   id
 * @property {string}   name
 * @property {string}   shortName
 * @property {string}   mode       - 'overlay' | 'pane'
 * @property {Object}   params     - { paramName: { default, min, max, step, label } }
 * @property {IndicatorOutput[]} outputs
 * @property {Function} compute    - (bars, params) => { [outputKey]: number[] }
 * @property {Object}   [paneConfig] - For pane indicators: { min, max, bands }
 */

/** All built-in indicators */
export const INDICATORS = {
  // ═══ Overlay Indicators ═══

  sma: {
    id: 'sma',
    name: 'Simple Moving Average',
    shortName: 'SMA',
    mode: 'overlay',
    params: {
      period: { default: 20, min: 2, max: 500, step: 1, label: 'Period' },
    },
    outputs: [{ key: 'sma', label: 'SMA', color: '#2962FF', width: 2, type: 'line' }],
    compute(bars, params) {
      return { sma: C.sma(C.closes(bars), params.period) };
    },
    update(bars, params, prevComputed) {
      const cls = C.closes(bars);
      const period = params.period;
      if (cls.length < period) return { sma: NaN };
      const sum = cls.slice(-period).reduce((a, b) => a + b, 0);
      return { sma: sum / period };
    }
  },

  ema: {
    id: 'ema',
    name: 'Exponential Moving Average',
    shortName: 'EMA',
    mode: 'overlay',
    params: {
      period: { default: 20, min: 2, max: 500, step: 1, label: 'Period' },
    },
    outputs: [{ key: 'ema', label: 'EMA', color: '#FF6D00', width: 2, type: 'line' }],
    compute(bars, params) {
      return { ema: C.ema(C.closes(bars), params.period) };
    },
    update(bars, params, prevComputed) {
      const prev = prevComputed.ema[prevComputed.ema.length - (bars.length > prevComputed.ema.length ? 1 : 2)];
      const current = bars[bars.length - 1].close;
      return { ema: C.nextEma(prev, current, params.period) };
    }
  },

  wma: {
    id: 'wma',
    name: 'Weighted Moving Average',
    shortName: 'WMA',
    mode: 'overlay',
    params: {
      period: { default: 20, min: 2, max: 500, step: 1, label: 'Period' },
    },
    outputs: [{ key: 'wma', label: 'WMA', color: '#AB47BC', width: 2, type: 'line' }],
    compute(bars, params) {
      return { wma: C.wma(C.closes(bars), params.period) };
    },
  },

  dema: {
    id: 'dema',
    name: 'Double EMA',
    shortName: 'DEMA',
    mode: 'overlay',
    params: {
      period: { default: 20, min: 2, max: 500, step: 1, label: 'Period' },
    },
    outputs: [{ key: 'dema', label: 'DEMA', color: '#00BCD4', width: 2, type: 'line' }],
    compute(bars, params) {
      return { dema: C.dema(C.closes(bars), params.period) };
    },
  },

  bb: {
    id: 'bb',
    name: 'Bollinger Bands',
    shortName: 'BB',
    mode: 'overlay',
    params: {
      period: { default: 20, min: 5, max: 200, step: 1, label: 'Period' },
      stdDev: { default: 2, min: 0.5, max: 5, step: 0.5, label: 'Std Dev' },
    },
    outputs: [
      { key: 'upper', label: 'Upper', color: '#2962FF', width: 1, type: 'line', dash: [] },
      { key: 'middle', label: 'Middle', color: '#2962FF', width: 1, type: 'line', dash: [4, 4] },
      { key: 'lower', label: 'Lower', color: '#2962FF', width: 1, type: 'line', dash: [] },
    ],
    fills: [{ upper: 'upper', lower: 'lower', color: 'rgba(41, 98, 255, 0.08)' }],
    compute(bars, params) {
      return C.bollingerBands(C.closes(bars), params.period, params.stdDev);
    },
    update(bars, params, prevComputed) {
      const cls = C.closes(bars);
      const period = params.period;
      if (cls.length < period) return { middle: NaN, upper: NaN, lower: NaN };
      const middle = cls.slice(-period).reduce((a, b) => a + b, 0) / period;
      let sumSq = 0;
      for (let j = cls.length - period; j < cls.length; j++) {
        const diff = cls[j] - middle;
        sumSq += diff * diff;
      }
      const sd = Math.sqrt(sumSq / period);
      return {
         middle,
         upper: middle + params.stdDev * sd,
         lower: middle - params.stdDev * sd
      };
    }
  },

  vwap: {
    id: 'vwap',
    name: 'VWAP + Bands',
    shortName: 'VWAP',
    mode: 'overlay',
    params: {
      anchorTime: { default: null, label: 'Anchor Time' },
    },
    outputs: [
      { key: 'vwap', label: 'VWAP', color: '#FF6D00', width: 2, type: 'line' },
      { key: 'upper1', label: '+1σ', color: 'rgba(255,109,0,0.5)', width: 1, type: 'line', dash: [4, 4] },
      { key: 'lower1', label: '-1σ', color: 'rgba(255,109,0,0.5)', width: 1, type: 'line', dash: [4, 4] },
      { key: 'upper2', label: '+2σ', color: 'rgba(255,109,0,0.3)', width: 1, type: 'line', dash: [4, 4] },
      { key: 'lower2', label: '-2σ', color: 'rgba(255,109,0,0.3)', width: 1, type: 'line', dash: [4, 4] },
      { key: 'upper3', label: '+3σ', color: 'rgba(255,109,0,0.15)', width: 1, type: 'line', dash: [4, 4] },
      { key: 'lower3', label: '-3σ', color: 'rgba(255,109,0,0.15)', width: 1, type: 'line', dash: [4, 4] },
    ],
    fills: [
      { upper: 'upper1', lower: 'lower1', color: 'rgba(255, 109, 0, 0.06)' },
      { upper: 'upper2', lower: 'lower2', color: 'rgba(255, 109, 0, 0.03)' },
      { upper: 'upper3', lower: 'lower3', color: 'rgba(255, 109, 0, 0.015)' },
    ],
    compute(bars, params) {
      return C.vwapBands(bars, params.anchorTime);
    },
  },

  vrvp: {
    id: 'vrvp',
    name: 'Volume Profile (Visible Range)',
    shortName: 'VRVP',
    mode: 'overlay',
    params: {
      rowCount: { default: 24, min: 10, max: 100, step: 1, label: 'Row Size' },
    },
    outputs: [{ key: 'vrvp', label: 'VRVP', color: '#B2B5BE', width: 0, type: 'vrvp' }],
    compute(bars, params) {
      // VRVP requires the raw visible bars to be passed down dynamically in the render loop,
      // not pre-computed on the full dataset, because it strictly depends on what is visible.
      // So this compute just returns a flag that the renderer will catch.
      return { vrvp: params.rowCount };
    },
  },

  ichimoku: {
    id: 'ichimoku',
    name: 'Ichimoku Cloud',
    shortName: 'Ichimoku',
    mode: 'overlay',
    params: {
      conversionPeriod: { default: 9, min: 1, max: 100, step: 1, label: 'Conversion' },
      basePeriod: { default: 26, min: 1, max: 100, step: 1, label: 'Base' },
      spanPeriod: { default: 52, min: 1, max: 200, step: 1, label: 'Lagging Span 2' },
      displacement: { default: 26, min: 1, max: 100, step: 1, label: 'Displacement' },
    },
    outputs: [
      { key: 'conversion', label: 'Conversion', color: '#2962FF', width: 1, type: 'line' },
      { key: 'base', label: 'Base', color: '#B71C1C', width: 1, type: 'line' },
      { key: 'lagging', label: 'Lagging Span', color: '#880E4F', width: 1, type: 'line', dash: [2, 2] },
      { key: 'spanA', label: 'Lead 1 (A)', color: '#4CAF50', width: 1, type: 'line' },
      { key: 'spanB', label: 'Lead 2 (B)', color: '#FF5252', width: 1, type: 'line' },
    ],
    fills: [
      { upper: 'spanA', lower: 'spanB', color: 'rgba(76, 175, 80, 0.15)' }, // We'll let the renderer handle bullish/bearish logic, standard fill uses the lead spans. Ideally a complex fill.
      // We will enhance the renderer to handle dynamic green/red fill based on which is higher.
    ],
    compute(bars, params) {
      return C.ichimoku(bars, params.conversionPeriod, params.basePeriod, params.spanPeriod, params.displacement);
    },
  },

  // ═══ Pane Indicators ═══

  rsi: {
    id: 'rsi',
    name: 'Relative Strength Index',
    shortName: 'RSI',
    mode: 'pane',
    params: {
      period: { default: 14, min: 2, max: 100, step: 1, label: 'Period' },
    },
    outputs: [{ key: 'rsi', label: 'RSI', color: '#AB47BC', width: 2, type: 'line' }],
    paneConfig: {
      min: 0,
      max: 100,
      bands: [
        { value: 70, color: 'rgba(239, 83, 80, 0.3)', label: '70', dash: [4, 4] },
        { value: 30, color: 'rgba(38, 166, 154, 0.3)', label: '30', dash: [4, 4] },
        { value: 50, color: 'rgba(120, 123, 134, 0.2)', dash: [2, 4] },
      ],
      fills: [
        { above: 70, color: 'rgba(239, 83, 80, 0.06)' },
        { below: 30, color: 'rgba(38, 166, 154, 0.06)' },
      ],
    },
    compute(bars, params) {
      return { rsi: C.rsi(C.closes(bars), params.period) };
    },
  },

  macd: {
    id: 'macd',
    name: 'MACD',
    shortName: 'MACD',
    mode: 'pane',
    params: {
      fast: { default: 12, min: 2, max: 100, step: 1, label: 'Fast' },
      slow: { default: 26, min: 2, max: 200, step: 1, label: 'Slow' },
      signal: { default: 9, min: 2, max: 100, step: 1, label: 'Signal' },
    },
    outputs: [
      { key: 'macd', label: 'MACD', color: '#2962FF', width: 2, type: 'line' },
      { key: 'signal', label: 'Signal', color: '#FF6D00', width: 1, type: 'line' },
      { key: 'histogram', label: 'Histogram', color: '#26A69A', width: 0, type: 'histogram' },
    ],
    paneConfig: {
      bands: [{ value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }],
    },
    compute(bars, params) {
      return C.macd(C.closes(bars), params.fast, params.slow, params.signal);
    },
  },

  stochastic: {
    id: 'stochastic',
    name: 'Stochastic Oscillator',
    shortName: 'Stoch',
    mode: 'pane',
    params: {
      kPeriod: { default: 14, min: 2, max: 100, step: 1, label: '%K' },
      dPeriod: { default: 3, min: 2, max: 50, step: 1, label: '%D' },
    },
    outputs: [
      { key: 'k', label: '%K', color: '#2962FF', width: 2, type: 'line' },
      { key: 'd', label: '%D', color: '#FF6D00', width: 1, type: 'line', dash: [4, 4] },
    ],
    paneConfig: {
      min: 0,
      max: 100,
      bands: [
        { value: 80, color: 'rgba(239, 83, 80, 0.3)', dash: [4, 4] },
        { value: 20, color: 'rgba(38, 166, 154, 0.3)', dash: [4, 4] },
      ],
    },
    compute(bars, params) {
      return C.stochastic(bars, params.kPeriod, params.dPeriod);
    },
  },

  atr: {
    id: 'atr',
    name: 'Average True Range',
    shortName: 'ATR',
    mode: 'pane',
    params: {
      period: { default: 14, min: 2, max: 100, step: 1, label: 'Period' },
    },
    outputs: [{ key: 'atr', label: 'ATR', color: '#26A69A', width: 2, type: 'line' }],
    paneConfig: {},
    compute(bars, params) {
      return { atr: C.atr(bars, params.period) };
    },
  },

  cci: {
    id: 'cci',
    name: 'Commodity Channel Index',
    shortName: 'CCI',
    mode: 'pane',
    params: {
      period: { default: 20, min: 5, max: 100, step: 1, label: 'Period' },
    },
    outputs: [{ key: 'cci', label: 'CCI', color: '#FF6D00', width: 2, type: 'line' }],
    paneConfig: {
      bands: [
        { value: 100, color: 'rgba(239, 83, 80, 0.3)', dash: [4, 4] },
        { value: -100, color: 'rgba(38, 166, 154, 0.3)', dash: [4, 4] },
        { value: 0, color: 'rgba(120, 123, 134, 0.2)', dash: [2, 4] },
      ],
    },
    compute(bars, params) {
      return { cci: C.cci(bars, params.period) };
    },
  },

  mfi: {
    id: 'mfi',
    name: 'Money Flow Index',
    shortName: 'MFI',
    mode: 'pane',
    params: {
      period: { default: 14, min: 2, max: 100, step: 1, label: 'Period' },
    },
    outputs: [{ key: 'mfi', label: 'MFI', color: '#42A5F5', width: 2, type: 'line' }],
    paneConfig: {
      min: 0,
      max: 100,
      bands: [
        { value: 80, color: 'rgba(239, 83, 80, 0.3)', dash: [4, 4] },
        { value: 20, color: 'rgba(38, 166, 154, 0.3)', dash: [4, 4] },
      ],
    },
    compute(bars, params) {
      return { mfi: C.mfi(bars, params.period) };
    },
  },

  williamsR: {
    id: 'williamsR',
    name: 'Williams %R',
    shortName: '%R',
    mode: 'pane',
    params: {
      period: { default: 14, min: 2, max: 100, step: 1, label: 'Period' },
    },
    outputs: [{ key: 'williamsR', label: '%R', color: '#EC407A', width: 2, type: 'line' }],
    paneConfig: {
      min: -100,
      max: 0,
      bands: [
        { value: -20, color: 'rgba(239, 83, 80, 0.3)', dash: [4, 4] },
        { value: -80, color: 'rgba(38, 166, 154, 0.3)', dash: [4, 4] },
      ],
    },
    compute(bars, params) {
      return { williamsR: C.williamsR(bars, params.period) };
    },
  },

  obv: {
    id: 'obv',
    name: 'On Balance Volume',
    shortName: 'OBV',
    mode: 'pane',
    params: {},
    outputs: [{ key: 'obv', label: 'OBV', color: '#66BB6A', width: 2, type: 'line' }],
    paneConfig: {},
    compute(bars) {
      return { obv: C.obv(bars) };
    },
  },

  roc: {
    id: 'roc',
    name: 'Rate of Change',
    shortName: 'ROC',
    mode: 'pane',
    params: {
      period: { default: 12, min: 1, max: 200, step: 1, label: 'Period' },
    },
    outputs: [{ key: 'roc', label: 'ROC', color: '#78909C', width: 2, type: 'line' }],
    paneConfig: {
      bands: [{ value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }],
    },
    compute(bars, params) {
      return { roc: C.roc(C.closes(bars), params.period) };
    },
  },

  volumeDelta: {
    id: 'volumeDelta',
    name: 'Volume Delta',
    shortName: 'Vol Δ',
    mode: 'pane',
    params: {
      showCumulative: { default: false, label: 'Show Cumulative' },
    },
    outputs: [
      { key: 'delta', label: 'Delta', color: '#26A69A', width: 0, type: 'histogram' },
      { key: 'cumDelta', label: 'Cum Δ', color: '#2962FF', width: 1.5, type: 'line' },
    ],
    paneConfig: {
      bands: [{ value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }],
    },
    compute(bars, params) {
      const result = computeVolumeDelta(bars);
      if (!params.showCumulative) {
        result.cumDelta = result.cumDelta.map(() => NaN);
      }
      return result;
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // Phase 1 Deep Dive — Overlay Indicators
  // ═══════════════════════════════════════════════════════════════

  tema: {
    id: 'tema',
    name: 'Triple EMA',
    shortName: 'TEMA',
    mode: 'overlay',
    params: {
      period: { default: 20, min: 2, max: 500, step: 1, label: 'Period' },
    },
    outputs: [{ key: 'tema', label: 'TEMA', color: '#E91E63', width: 2, type: 'line' }],
    compute(bars, params) {
      return { tema: C.tema(C.closes(bars), params.period) };
    },
  },

  hma: {
    id: 'hma',
    name: 'Hull Moving Average',
    shortName: 'HMA',
    mode: 'overlay',
    params: {
      period: { default: 9, min: 2, max: 500, step: 1, label: 'Period' },
    },
    outputs: [{ key: 'hma', label: 'HMA', color: '#00E676', width: 2, type: 'line' }],
    compute(bars, params) {
      return { hma: C.hma(C.closes(bars), params.period) };
    },
  },

  vwma: {
    id: 'vwma',
    name: 'Volume Weighted MA',
    shortName: 'VWMA',
    mode: 'overlay',
    params: {
      period: { default: 20, min: 2, max: 500, step: 1, label: 'Period' },
    },
    outputs: [{ key: 'vwma', label: 'VWMA', color: '#7C4DFF', width: 2, type: 'line' }],
    compute(bars, params) {
      return { vwma: C.vwma(bars, params.period) };
    },
  },

  keltner: {
    id: 'keltner',
    name: 'Keltner Channel',
    shortName: 'KC',
    mode: 'overlay',
    params: {
      emaPeriod: { default: 20, min: 2, max: 200, step: 1, label: 'EMA Period' },
      atrPeriod: { default: 10, min: 2, max: 100, step: 1, label: 'ATR Period' },
      multiplier: { default: 1.5, min: 0.5, max: 5, step: 0.1, label: 'Multiplier' },
    },
    outputs: [
      { key: 'upper', label: 'Upper', color: '#26A69A', width: 1, type: 'line' },
      { key: 'middle', label: 'Middle', color: '#26A69A', width: 1, type: 'line', dash: [4, 4] },
      { key: 'lower', label: 'Lower', color: '#26A69A', width: 1, type: 'line' },
    ],
    fills: [{ upper: 'upper', lower: 'lower', color: 'rgba(38, 166, 154, 0.08)' }],
    compute(bars, params) {
      return C.keltnerChannel(bars, params.emaPeriod, params.atrPeriod, params.multiplier);
    },
  },

  donchian: {
    id: 'donchian',
    name: 'Donchian Channel',
    shortName: 'DC',
    mode: 'overlay',
    params: {
      period: { default: 20, min: 5, max: 200, step: 1, label: 'Period' },
    },
    outputs: [
      { key: 'upper', label: 'Upper', color: '#42A5F5', width: 1, type: 'line' },
      { key: 'basis', label: 'Basis', color: '#42A5F5', width: 1, type: 'line', dash: [4, 4] },
      { key: 'lower', label: 'Lower', color: '#42A5F5', width: 1, type: 'line' },
    ],
    fills: [{ upper: 'upper', lower: 'lower', color: 'rgba(66, 165, 245, 0.06)' }],
    compute(bars, params) {
      return C.donchianChannel(bars, params.period);
    },
  },

  linreg: {
    id: 'linreg',
    name: 'Linear Regression Channel',
    shortName: 'LinReg',
    mode: 'overlay',
    params: {
      period: { default: 20, min: 5, max: 200, step: 1, label: 'Period' },
      stdDevMult: { default: 2, min: 0.5, max: 5, step: 0.5, label: 'Std Dev' },
    },
    outputs: [
      { key: 'upper', label: 'Upper', color: '#FF7043', width: 1, type: 'line' },
      { key: 'mid', label: 'Middle', color: '#FF7043', width: 1, type: 'line', dash: [4, 4] },
      { key: 'lower', label: 'Lower', color: '#FF7043', width: 1, type: 'line' },
    ],
    fills: [{ upper: 'upper', lower: 'lower', color: 'rgba(255, 112, 67, 0.06)' }],
    compute(bars, params) {
      return C.linearRegressionChannel(C.closes(bars), params.period, params.stdDevMult);
    },
  },

  supertrend: {
    id: 'supertrend',
    name: 'Supertrend',
    shortName: 'ST',
    mode: 'overlay',
    params: {
      period: { default: 10, min: 2, max: 100, step: 1, label: 'ATR Period' },
      multiplier: { default: 3, min: 1, max: 10, step: 0.5, label: 'Multiplier' },
    },
    outputs: [{ key: 'supertrend', label: 'Supertrend', color: '#26A69A', width: 2, type: 'line' }],
    compute(bars, params) {
      return C.supertrend(bars, params.period, params.multiplier);
    },
  },

  psar: {
    id: 'psar',
    name: 'Parabolic SAR',
    shortName: 'PSAR',
    mode: 'overlay',
    params: {
      step: { default: 0.02, min: 0.001, max: 0.1, step: 0.001, label: 'Step' },
      max: { default: 0.2, min: 0.05, max: 0.5, step: 0.01, label: 'Max' },
    },
    outputs: [{ key: 'sar', label: 'SAR', color: '#7C4DFF', width: 0, type: 'dots' }],
    compute(bars, params) {
      return C.parabolicSAR(bars, params.step, params.max);
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // Phase 1 Deep Dive — Pane Indicators
  // ═══════════════════════════════════════════════════════════════

  adx: {
    id: 'adx',
    name: 'ADX / DMI',
    shortName: 'ADX',
    mode: 'pane',
    params: {
      period: { default: 14, min: 2, max: 100, step: 1, label: 'Period' },
    },
    outputs: [
      { key: 'adx', label: 'ADX', color: '#FF6D00', width: 2, type: 'line' },
      { key: 'plusDI', label: '+DI', color: '#26A69A', width: 1, type: 'line' },
      { key: 'minusDI', label: '-DI', color: '#EF5350', width: 1, type: 'line' },
    ],
    paneConfig: {
      min: 0,
      max: 100,
      bands: [
        { value: 25, color: 'rgba(120, 123, 134, 0.3)', dash: [4, 4] },
      ],
    },
    compute(bars, params) {
      return C.adx(bars, params.period);
    },
  },

  aroon: {
    id: 'aroon',
    name: 'Aroon',
    shortName: 'Aroon',
    mode: 'pane',
    params: {
      period: { default: 25, min: 5, max: 200, step: 1, label: 'Period' },
    },
    outputs: [
      { key: 'up', label: 'Aroon Up', color: '#26A69A', width: 1.5, type: 'line' },
      { key: 'down', label: 'Aroon Down', color: '#EF5350', width: 1.5, type: 'line' },
      { key: 'osc', label: 'Oscillator', color: '#42A5F5', width: 1, type: 'line', dash: [4, 4] },
    ],
    paneConfig: {
      min: -100,
      max: 100,
      bands: [
        { value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] },
      ],
    },
    compute(bars, params) {
      return C.aroon(bars, params.period);
    },
  },

  cmf: {
    id: 'cmf',
    name: 'Chaikin Money Flow',
    shortName: 'CMF',
    mode: 'pane',
    params: {
      period: { default: 20, min: 5, max: 100, step: 1, label: 'Period' },
    },
    outputs: [{ key: 'cmf', label: 'CMF', color: '#26A69A', width: 2, type: 'line' }],
    paneConfig: {
      bands: [{ value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }],
    },
    compute(bars, params) {
      return { cmf: C.cmf(bars, params.period) };
    },
  },

  trix: {
    id: 'trix',
    name: 'TRIX',
    shortName: 'TRIX',
    mode: 'pane',
    params: {
      period: { default: 15, min: 2, max: 100, step: 1, label: 'Period' },
    },
    outputs: [{ key: 'trix', label: 'TRIX', color: '#AB47BC', width: 2, type: 'line' }],
    paneConfig: {
      bands: [{ value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }],
    },
    compute(bars, params) {
      return { trix: C.trix(C.closes(bars), params.period) };
    },
  },

  chaikin: {
    id: 'chaikin',
    name: 'Chaikin Oscillator',
    shortName: 'CHO',
    mode: 'pane',
    params: {
      fast: { default: 3, min: 2, max: 50, step: 1, label: 'Fast' },
      slow: { default: 10, min: 2, max: 100, step: 1, label: 'Slow' },
    },
    outputs: [{ key: 'chaikin', label: 'CHO', color: '#FF7043', width: 2, type: 'line' }],
    paneConfig: {
      bands: [{ value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }],
    },
    compute(bars, params) {
      return { chaikin: C.chaikinOscillator(bars, params.fast, params.slow) };
    },
  },

  ppo: {
    id: 'ppo',
    name: 'Percentage Price Oscillator',
    shortName: 'PPO',
    mode: 'pane',
    params: {
      fast: { default: 12, min: 2, max: 100, step: 1, label: 'Fast' },
      slow: { default: 26, min: 2, max: 200, step: 1, label: 'Slow' },
      signal: { default: 9, min: 2, max: 100, step: 1, label: 'Signal' },
    },
    outputs: [
      { key: 'ppo', label: 'PPO', color: '#2962FF', width: 2, type: 'line' },
      { key: 'signal', label: 'Signal', color: '#FF6D00', width: 1, type: 'line' },
      { key: 'histogram', label: 'Histogram', color: '#26A69A', width: 0, type: 'histogram' },
    ],
    paneConfig: {
      bands: [{ value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }],
    },
    compute(bars, params) {
      return C.ppo(C.closes(bars), params.fast, params.slow, params.signal);
    },
  },

  dpo: {
    id: 'dpo',
    name: 'Detrended Price Oscillator',
    shortName: 'DPO',
    mode: 'pane',
    params: {
      period: { default: 20, min: 5, max: 200, step: 1, label: 'Period' },
    },
    outputs: [{ key: 'dpo', label: 'DPO', color: '#78909C', width: 2, type: 'line' }],
    paneConfig: {
      bands: [{ value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }],
    },
    compute(bars, params) {
      return { dpo: C.dpo(C.closes(bars), params.period) };
    },
  },

  massIndex: {
    id: 'massIndex',
    name: 'Mass Index',
    shortName: 'MI',
    mode: 'pane',
    params: {
      emaPeriod: { default: 9, min: 2, max: 50, step: 1, label: 'EMA Period' },
      sumPeriod: { default: 25, min: 5, max: 100, step: 1, label: 'Sum Period' },
    },
    outputs: [{ key: 'massIndex', label: 'MI', color: '#FF5252', width: 2, type: 'line' }],
    paneConfig: {
      bands: [
        { value: 27, color: 'rgba(239, 83, 80, 0.3)', dash: [4, 4] },
        { value: 26.5, color: 'rgba(38, 166, 154, 0.3)', dash: [4, 4] },
      ],
    },
    compute(bars, params) {
      return { massIndex: C.massIndex(bars, params.emaPeriod, params.sumPeriod) };
    },
  },

  kst: {
    id: 'kst',
    name: 'Know Sure Thing',
    shortName: 'KST',
    mode: 'pane',
    params: {},
    outputs: [
      { key: 'kst', label: 'KST', color: '#2962FF', width: 2, type: 'line' },
      { key: 'signal', label: 'Signal', color: '#FF6D00', width: 1, type: 'line', dash: [4, 4] },
    ],
    paneConfig: {
      bands: [{ value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }],
    },
    compute(bars) {
      return C.kst(C.closes(bars));
    },
  },

  coppock: {
    id: 'coppock',
    name: 'Coppock Curve',
    shortName: 'Coppock',
    mode: 'pane',
    params: {
      longP: { default: 14, min: 5, max: 50, step: 1, label: 'Long ROC' },
      shortP: { default: 11, min: 5, max: 50, step: 1, label: 'Short ROC' },
      wmaP: { default: 10, min: 2, max: 50, step: 1, label: 'WMA' },
    },
    outputs: [{ key: 'coppock', label: 'Coppock', color: '#00BCD4', width: 2, type: 'line' }],
    paneConfig: {
      bands: [{ value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }],
    },
    compute(bars, params) {
      return { coppock: C.coppock(C.closes(bars), params.longP, params.shortP, params.wmaP) };
    },
  },

  squeeze: {
    id: 'squeeze',
    name: 'Squeeze Momentum',
    shortName: 'Squeeze',
    mode: 'pane',
    params: {
      bbPeriod: { default: 20, min: 5, max: 100, step: 1, label: 'BB Period' },
      bbMult: { default: 2, min: 0.5, max: 5, step: 0.5, label: 'BB Mult' },
      kcPeriod: { default: 20, min: 5, max: 100, step: 1, label: 'KC Period' },
      kcMult: { default: 1.5, min: 0.5, max: 5, step: 0.5, label: 'KC Mult' },
    },
    outputs: [
      { key: 'momentum', label: 'Momentum', color: '#26A69A', width: 0, type: 'histogram' },
    ],
    paneConfig: {
      bands: [{ value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }],
    },
    compute(bars, params) {
      return C.squeezeMomentum(bars, params.bbPeriod, params.bbMult, params.kcPeriod, params.kcMult);
    },
  },

  adLine: {
    id: 'adLine',
    name: 'Accumulation/Distribution',
    shortName: 'A/D',
    mode: 'pane',
    params: {},
    outputs: [{ key: 'adLine', label: 'A/D', color: '#66BB6A', width: 2, type: 'line' }],
    paneConfig: {},
    compute(bars) {
      return { adLine: C.adLine(bars) };
    },
  },

  momentum: {
    id: 'momentum',
    name: 'Momentum',
    shortName: 'MOM',
    mode: 'pane',
    params: {
      period: { default: 10, min: 1, max: 200, step: 1, label: 'Period' },
    },
    outputs: [{ key: 'momentum', label: 'MOM', color: '#78909C', width: 2, type: 'line' }],
    paneConfig: {
      bands: [{ value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }],
    },
    compute(bars, params) {
      return { momentum: C.momentum(C.closes(bars), params.period) };
    },
  },

  tsi: {
    id: 'tsi',
    name: 'True Strength Index',
    shortName: 'TSI',
    mode: 'pane',
    params: {
      longP: { default: 25, min: 5, max: 100, step: 1, label: 'Long' },
      shortP: { default: 13, min: 2, max: 50, step: 1, label: 'Short' },
      signalP: { default: 13, min: 2, max: 50, step: 1, label: 'Signal' },
    },
    outputs: [
      { key: 'tsi', label: 'TSI', color: '#2962FF', width: 2, type: 'line' },
      { key: 'signal', label: 'Signal', color: '#FF6D00', width: 1, type: 'line', dash: [4, 4] },
    ],
    paneConfig: {
      bands: [{ value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }],
    },
    compute(bars, params) {
      return C.tsi(C.closes(bars), params.longP, params.shortP, params.signalP);
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // Phase 1 Deep Dive — 8 Additional Indicators
  // ═══════════════════════════════════════════════════════════════

  vortex: {
    id: 'vortex',
    name: 'Vortex Indicator',
    shortName: 'VI',
    mode: 'pane',
    params: {
      period: { default: 14, min: 2, max: 100, step: 1, label: 'Period' },
    },
    outputs: [
      { key: 'plusVI', label: '+VI', color: '#26A69A', width: 2, type: 'line' },
      { key: 'minusVI', label: '-VI', color: '#EF5350', width: 2, type: 'line' },
    ],
    paneConfig: {
      bands: [{ value: 1, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }],
    },
    compute(bars, params) {
      return C.vortex(bars, params.period);
    },
  },

  ultimateOsc: {
    id: 'ultimateOsc',
    name: 'Ultimate Oscillator',
    shortName: 'UO',
    mode: 'pane',
    params: {
      p1: { default: 7, min: 2, max: 50, step: 1, label: 'Short' },
      p2: { default: 14, min: 2, max: 100, step: 1, label: 'Medium' },
      p3: { default: 28, min: 2, max: 200, step: 1, label: 'Long' },
    },
    outputs: [{ key: 'uo', label: 'UO', color: '#42A5F5', width: 2, type: 'line' }],
    paneConfig: {
      min: 0,
      max: 100,
      bands: [
        { value: 70, color: 'rgba(239, 83, 80, 0.3)', dash: [4, 4] },
        { value: 30, color: 'rgba(38, 166, 154, 0.3)', dash: [4, 4] },
        { value: 50, color: 'rgba(120, 123, 134, 0.2)', dash: [2, 4] },
      ],
    },
    compute(bars, params) {
      return { uo: C.ultimateOscillator(bars, params.p1, params.p2, params.p3) };
    },
  },

  klinger: {
    id: 'klinger',
    name: 'Klinger Volume Oscillator',
    shortName: 'KVO',
    mode: 'pane',
    params: {
      fast: { default: 34, min: 5, max: 100, step: 1, label: 'Fast' },
      slow: { default: 55, min: 10, max: 200, step: 1, label: 'Slow' },
      signal: { default: 13, min: 2, max: 50, step: 1, label: 'Signal' },
    },
    outputs: [
      { key: 'kvo', label: 'KVO', color: '#2962FF', width: 2, type: 'line' },
      { key: 'signal', label: 'Signal', color: '#FF6D00', width: 1, type: 'line', dash: [4, 4] },
    ],
    paneConfig: {
      bands: [{ value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }],
    },
    compute(bars, params) {
      return C.klinger(bars, params.fast, params.slow, params.signal);
    },
  },

  stdDev: {
    id: 'stdDev',
    name: 'Standard Deviation',
    shortName: 'StdDev',
    mode: 'pane',
    params: {
      period: { default: 20, min: 2, max: 200, step: 1, label: 'Period' },
    },
    outputs: [{ key: 'stdDev', label: 'StdDev', color: '#FF7043', width: 2, type: 'line' }],
    paneConfig: {},
    compute(bars, params) {
      return { stdDev: C.stdDev(C.closes(bars), params.period) };
    },
  },

  historicalVol: {
    id: 'historicalVol',
    name: 'Historical Volatility',
    shortName: 'HV',
    mode: 'pane',
    params: {
      period: { default: 20, min: 5, max: 100, step: 1, label: 'Period' },
    },
    outputs: [{ key: 'hv', label: 'HV%', color: '#AB47BC', width: 2, type: 'line' }],
    paneConfig: {},
    compute(bars, params) {
      return { hv: C.historicalVolatility(C.closes(bars), params.period) };
    },
  },

  awesomeOsc: {
    id: 'awesomeOsc',
    name: 'Awesome Oscillator',
    shortName: 'AO',
    mode: 'pane',
    params: {},
    outputs: [{ key: 'ao', label: 'AO', color: '#26A69A', width: 0, type: 'histogram' }],
    paneConfig: {
      bands: [{ value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }],
    },
    compute(bars) {
      return { ao: C.awesomeOscillator(bars) };
    },
  },

  acceleratorOsc: {
    id: 'acceleratorOsc',
    name: 'Accelerator Oscillator',
    shortName: 'AC',
    mode: 'pane',
    params: {},
    outputs: [{ key: 'ac', label: 'AC', color: '#66BB6A', width: 0, type: 'histogram' }],
    paneConfig: {
      bands: [{ value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }],
    },
    compute(bars) {
      return { ac: C.acceleratorOscillator(bars) };
    },
  },

  chandeMO: {
    id: 'chandeMO',
    name: 'Chande Momentum Oscillator',
    shortName: 'CMO',
    mode: 'pane',
    params: {
      period: { default: 9, min: 2, max: 100, step: 1, label: 'Period' },
    },
    outputs: [{ key: 'cmo', label: 'CMO', color: '#EC407A', width: 2, type: 'line' }],
    paneConfig: {
      min: -100,
      max: 100,
      bands: [
        { value: 50, color: 'rgba(239, 83, 80, 0.3)', dash: [4, 4] },
        { value: -50, color: 'rgba(38, 166, 154, 0.3)', dash: [4, 4] },
        { value: 0, color: 'rgba(120, 123, 134, 0.2)', dash: [2, 4] },
      ],
    },
    compute(bars, params) {
      return { cmo: C.chandeMomentumOscillator(C.closes(bars), params.period) };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // Phase 2 Deep Dive — 5 Final Indicators (→ 50 total)
  // ═══════════════════════════════════════════════════════════════

  sessionVwap: {
    id: 'sessionVwap',
    name: 'Session VWAP',
    shortName: 'sVWAP',
    mode: 'overlay',
    params: {
      resetHour: { default: 0, min: 0, max: 23, step: 1, label: 'Reset Hour (UTC)' },
    },
    outputs: [
      { key: 'vwap', label: 'sVWAP', color: '#FF6D00', width: 2, type: 'line' },
      { key: 'upper', label: 'Upper', color: '#FF6D00', width: 1, type: 'line', dash: [4, 4] },
      { key: 'lower', label: 'Lower', color: '#FF6D00', width: 1, type: 'line', dash: [4, 4] },
    ],
    fills: [{ upper: 'upper', lower: 'lower', color: 'rgba(255, 109, 0, 0.06)' }],
    compute(bars, params) {
      return C.sessionVWAP(bars, params.resetHour);
    },
  },

  anchoredVwap: {
    id: 'anchoredVwap',
    name: 'Anchored VWAP',
    shortName: 'aVWAP',
    mode: 'overlay',
    params: {
      anchorTime: { default: null, label: 'Anchor Time' },
    },
    outputs: [
      { key: 'vwap', label: 'aVWAP', color: '#E040FB', width: 2, type: 'line' },
      { key: 'upper1', label: '+1σ', color: '#E040FB', width: 1, type: 'line', dash: [4, 4] },
      { key: 'lower1', label: '-1σ', color: '#E040FB', width: 1, type: 'line', dash: [4, 4] },
    ],
    fills: [{ upper: 'upper1', lower: 'lower1', color: 'rgba(224, 64, 251, 0.06)' }],
    compute(bars, params) {
      const result = C.vwapBands(bars, params.anchorTime);
      return { vwap: result.vwap, upper1: result.upper1, lower1: result.lower1 };
    },
  },

  vwRsi: {
    id: 'vwRsi',
    name: 'Volume-Weighted RSI',
    shortName: 'vwRSI',
    mode: 'pane',
    params: {
      period: { default: 14, min: 2, max: 100, step: 1, label: 'Period' },
    },
    outputs: [{ key: 'vwRsi', label: 'vwRSI', color: '#00BCD4', width: 2, type: 'line' }],
    paneConfig: {
      min: 0,
      max: 100,
      bands: [
        { value: 70, color: 'rgba(239, 83, 80, 0.3)', dash: [4, 4] },
        { value: 30, color: 'rgba(38, 166, 154, 0.3)', dash: [4, 4] },
        { value: 50, color: 'rgba(120, 123, 134, 0.2)', dash: [2, 4] },
      ],
    },
    compute(bars, params) {
      return { vwRsi: C.volumeWeightedRSI(bars, params.period) };
    },
  },

  fearGreed: {
    id: 'fearGreed',
    name: 'Fear & Greed Index',
    shortName: 'F&G',
    mode: 'pane',
    params: {
      period: { default: 14, min: 5, max: 50, step: 1, label: 'Period' },
    },
    outputs: [{ key: 'index', label: 'F&G', color: '#FFD54F', width: 2, type: 'line' }],
    paneConfig: {
      min: 0,
      max: 100,
      bands: [
        { value: 80, color: 'rgba(76, 175, 80, 0.2)', dash: [4, 4] },
        { value: 60, color: 'rgba(255, 213, 79, 0.15)', dash: [2, 4] },
        { value: 40, color: 'rgba(255, 213, 79, 0.15)', dash: [2, 4] },
        { value: 20, color: 'rgba(239, 83, 80, 0.2)', dash: [4, 4] },
      ],
      fills: [
        { above: 80, color: 'rgba(76, 175, 80, 0.06)' },
        { below: 20, color: 'rgba(239, 83, 80, 0.06)' },
      ],
    },
    compute(bars, params) {
      return C.fearGreedIndex(bars, params.period);
    },
  },

  liquidationLevels: {
    id: 'liquidationLevels',
    name: 'Liquidation Levels',
    shortName: 'Liq',
    mode: 'overlay',
    params: {
      leverages: { default: '5,10,25,50', label: 'Leverages (comma-separated)' },
    },
    outputs: [
      { key: 'longLiq', label: 'Long Liq', color: '#EF5350', width: 1, type: 'line', dash: [6, 3] },
      { key: 'shortLiq', label: 'Short Liq', color: '#26A69A', width: 1, type: 'line', dash: [6, 3] },
    ],
    compute(bars, params) {
      // Estimate liquidation levels using leverage-based distance from current price
      const leverages = String(params.leverages).split(',').map(Number).filter(n => n > 0);
      const mainLev = leverages[0] || 10;
      const len = bars.length;
      const longLiq = new Array(len).fill(NaN);
      const shortLiq = new Array(len).fill(NaN);
      for (let i = 0; i < len; i++) {
        const price = bars[i].close;
        // Simplified liquidation estimate: price * (1 ± 1/leverage)
        longLiq[i]  = price * (1 - 1 / mainLev);
        shortLiq[i] = price * (1 + 1 / mainLev);
      }
      return { longLiq, shortLiq };
    },
  },

  chaikinVol: {
    id: 'chaikinVol',
    name: 'Chaikin Volatility',
    shortName: 'CV',
    mode: 'pane',
    params: {
      emaPeriod: { default: 10, min: 2, max: 50, step: 1, label: 'EMA Period' },
      rocPeriod: { default: 10, min: 2, max: 50, step: 1, label: 'ROC Period' },
    },
    outputs: [{ key: 'cv', label: 'CV', color: '#FF7043', width: 2, type: 'line' }],
    paneConfig: {
      bands: [{ value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }],
    },
    compute(bars, params) {
      return { cv: C.chaikinVolatility(bars, params.emaPeriod, params.rocPeriod) };
    },
  },
};

/** Get an indicator definition by ID */
export function getIndicator(id) {
  return INDICATORS[id] || null;
}

/** Get all overlay indicators */
export function getOverlayIndicators() {
  return Object.values(INDICATORS).filter((i) => i.mode === 'overlay');
}

/** Get all pane indicators */
export function getPaneIndicators() {
  return Object.values(INDICATORS).filter((i) => i.mode === 'pane');
}

/** Get all indicator definitions as a list */
export function getAllIndicators() {
  return Object.values(INDICATORS);
}

/**
 * Create an active indicator instance from a definition.
 * @param {string} indicatorId
 * @param {Object} [paramOverrides]
 * @param {Object} [styleOverrides]
 * @returns {Object} Active indicator instance
 */
export function createIndicatorInstance(indicatorId, paramOverrides = {}, styleOverrides = {}) {
  const def = INDICATORS[indicatorId];
  if (!def) throw new Error(`Unknown indicator: ${indicatorId}`);

  // Build params from defaults + overrides
  const params = {};
  for (const [key, config] of Object.entries(def.params)) {
    params[key] = paramOverrides[key] !== undefined ? paramOverrides[key] : config.default;
  }

  // Build outputs with style overrides
  const outputs = def.outputs.map((o) => ({
    ...o,
    ...styleOverrides[o.key],
  }));

  return {
    id: `${indicatorId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    indicatorId,
    name: def.name,
    shortName: def.shortName,
    mode: def.mode,
    params,
    outputs,
    fills: def.fills,
    paneConfig: def.paneConfig,
    visible: true,
    computed: null, // Filled after compute()

    /** Compute indicator values from bar data */
    compute(bars) {
      this.computed = def.compute(bars, this.params);
      return this.computed;
    },

    /** Incrementally update indicator values on tick */
    update(bars) {
      if (!this.computed || !def.update) return this.compute(bars);

      const lastVals = def.update(bars, this.params, this.computed);
      const isNewBar = bars.length > Object.values(this.computed)[0].length;

      for (const [key, val] of Object.entries(lastVals)) {
        if (!this.computed[key]) continue;
        if (isNewBar) {
          this.computed[key].push(val);
        } else {
          this.computed[key][this.computed[key].length - 1] = val;
        }
      }
      return this.computed;
    },

    /** Get the parameter label string (e.g., "SMA(20)") */
    get label() {
      const paramStr = Object.values(this.params).join(', ');
      return paramStr ? `${def.shortName}(${paramStr})` : def.shortName;
    },
  };
}
