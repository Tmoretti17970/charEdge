// charEdge — Pane Indicator Definitions
// Core + Phase 1 Deep Dive pane indicators.

import * as C from './computations.js';
import { computeVolumeDelta } from './volumeDelta.js';

export const PANE_INDICATORS = {

  rsi: {
    id: 'rsi',
    name: 'Relative Strength Index',
    shortName: 'RSI',
    mode: 'pane',
    params: {
      period: { default: 14, min: 2, max: 100, step: 1, label: 'Period' },
      divergence: { default: false, label: 'Detect Divergences', type: 'boolean' },
    },
    outputs: [{ key: 'rsi', label: 'RSI', color: '#AB47BC', width: 1.5, type: 'line' }],
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
      const src = C.closes(bars);
      const rsiVals = C.rsi(src, params.period);
      const result = { rsi: rsiVals };
      if (params.divergence) {
        result._divergences = C.detectDivergences(bars, { values: rsiVals }, { sensitivity: 'medium' });
      }
      return result;
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
      divergence: { default: false, label: 'Detect Divergences', type: 'boolean' },
    },
    outputs: [
      { key: 'macd', label: 'MACD', color: '#2962FF', width: 1.5, type: 'line' },
      { key: 'signal', label: 'Signal', color: '#FF6D00', width: 1, type: 'line' },
      { key: 'histogram', label: 'Histogram', color: '#26A69A', width: 0, type: 'histogram' },
    ],
    paneConfig: {
      bands: [{ value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }],
    },
    compute(bars, params) {
      const result = C.macd(C.closes(bars), params.fast, params.slow, params.signal);
      if (params.divergence) {
        result._divergences = C.detectDivergences(bars, { values: result.macd }, { sensitivity: 'medium' });
      }
      return result;
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
      divergence: { default: false, label: 'Detect Divergences', type: 'boolean' },
    },
    outputs: [
      { key: 'k', label: '%K', color: '#2962FF', width: 1.5, type: 'line' },
      { key: 'd', label: '%D', color: '#FF6D00', width: 1, type: 'line', dash: [4, 4] },
    ],
    paneConfig: {
      min: 0,
      max: 100,
      bands: [
        { value: 80, color: 'rgba(239, 83, 80, 0.3)', dash: [4, 4] },
        { value: 20, color: 'rgba(38, 166, 154, 0.3)', dash: [4, 4] },
      ],
      fills: [
        { above: 80, color: 'rgba(239, 83, 80, 0.06)' },
        { below: 20, color: 'rgba(38, 166, 154, 0.06)' },
      ],
    },
    compute(bars, params) {
      const result = C.stochastic(bars, params.kPeriod, params.dPeriod);
      if (params.divergence) {
        result._divergences = C.detectDivergences(bars, { values: result.k }, { sensitivity: 'medium' });
      }
      return result;
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
      divergence: { default: false, label: 'Detect Divergences', type: 'boolean' },
    },
    outputs: [{ key: 'cci', label: 'CCI', color: '#FF6D00', width: 1.5, type: 'line' }],
    paneConfig: {
      bands: [
        { value: 100, color: 'rgba(239, 83, 80, 0.3)', dash: [4, 4] },
        { value: -100, color: 'rgba(38, 166, 154, 0.3)', dash: [4, 4] },
        { value: 0, color: 'rgba(120, 123, 134, 0.2)', dash: [2, 4] },
      ],
      fills: [
        { above: 100, color: 'rgba(239, 83, 80, 0.06)' },
        { below: -100, color: 'rgba(38, 166, 154, 0.06)' },
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
    outputs: [{ key: 'mfi', label: 'MFI', color: '#42A5F5', width: 1.5, type: 'line' }],
    paneConfig: {
      min: 0,
      max: 100,
      bands: [
        { value: 80, color: 'rgba(239, 83, 80, 0.3)', dash: [4, 4] },
        { value: 20, color: 'rgba(38, 166, 154, 0.3)', dash: [4, 4] },
      ],
      fills: [
        { above: 80, color: 'rgba(239, 83, 80, 0.06)' },
        { below: 20, color: 'rgba(38, 166, 154, 0.06)' },
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
    outputs: [{ key: 'williamsR', label: '%R', color: '#EC407A', width: 1.5, type: 'line' }],
    paneConfig: {
      min: -100,
      max: 0,
      bands: [
        { value: -20, color: 'rgba(239, 83, 80, 0.3)', dash: [4, 4] },
        { value: -80, color: 'rgba(38, 166, 154, 0.3)', dash: [4, 4] },
      ],
      fills: [
        { above: -20, color: 'rgba(239, 83, 80, 0.06)' },
        { below: -80, color: 'rgba(38, 166, 154, 0.06)' },
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
    outputs: [{ key: 'uo', label: 'UO', color: '#42A5F5', width: 1.5, type: 'line' }],
    paneConfig: {
      min: 0,
      max: 100,
      bands: [
        { value: 70, color: 'rgba(239, 83, 80, 0.3)', dash: [4, 4] },
        { value: 30, color: 'rgba(38, 166, 154, 0.3)', dash: [4, 4] },
        { value: 50, color: 'rgba(120, 123, 134, 0.2)', dash: [2, 4] },
      ],
      fills: [
        { above: 70, color: 'rgba(239, 83, 80, 0.06)' },
        { below: 30, color: 'rgba(38, 166, 154, 0.06)' },
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
};
