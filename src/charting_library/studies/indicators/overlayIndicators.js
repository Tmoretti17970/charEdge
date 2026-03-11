// charEdge — Overlay Indicator Definitions
// Core + Phase 1 Deep Dive overlay indicators.

import * as C from './computations.js';

export const OVERLAY_INDICATORS = {

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
    update(bars, params, _prevComputed) {
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
      multiplier: { default: 2, min: 0.5, max: 5, step: 0.5, label: 'Std Dev' },
    },
    outputs: [
      { key: 'upper', label: 'Upper', color: '#2962FF', width: 1, type: 'line', dash: [] },
      { key: 'middle', label: 'Middle', color: '#78909C', width: 1, type: 'line', dash: [4, 4] },
      { key: 'lower', label: 'Lower', color: '#2962FF', width: 1, type: 'line', dash: [] },
    ],
    fills: [{ upper: 'upper', lower: 'lower', color: 'rgba(41, 98, 255, 0.12)' }],
    compute(bars, params) {
      return C.bollingerBands(C.closes(bars), params.period, params.multiplier);
    },
    update(bars, params, _prevComputed) {
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
        upper: middle + params.multiplier * sd,
        lower: middle - params.multiplier * sd
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
      { upper: 'spanA', lower: 'spanB', color: 'rgba(76, 175, 80, 0.15)', dynamicFill: { bullColor: 'rgba(76, 175, 80, 0.12)', bearColor: 'rgba(239, 83, 80, 0.12)' } },
    ],
    compute(bars, params) {
      return C.ichimoku(bars, params.conversionPeriod, params.basePeriod, params.spanPeriod, params.displacement);
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
    outputs: [{ key: 'tema', label: 'TEMA', color: '#E91E63', width: 1, type: 'line' }],
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
    outputs: [{ key: 'hma', label: 'HMA', color: '#00E676', width: 1, type: 'line' }],
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
    outputs: [{ key: 'vwma', label: 'VWMA', color: '#7C4DFF', width: 1, type: 'line' }],
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
      multiplier: { default: 2.0, min: 0.5, max: 5, step: 0.1, label: 'Multiplier' },
    },
    outputs: [
      { key: 'upper', label: 'Upper', color: '#26A69A', width: 1, type: 'line' },
      { key: 'middle', label: 'Middle', color: '#78909C', width: 1, type: 'line', dash: [4, 4] },
      { key: 'lower', label: 'Lower', color: '#26A69A', width: 1, type: 'line' },
    ],
    fills: [{ upper: 'upper', lower: 'lower', color: 'rgba(38, 166, 154, 0.10)' }],
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
    fills: [{ upper: 'upper', lower: 'lower', color: 'rgba(66, 165, 245, 0.09)' }],
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
      multiplier: { default: 2, min: 0.5, max: 5, step: 0.5, label: 'Std Dev' },
    },
    outputs: [
      { key: 'upper', label: 'Upper', color: '#FF7043', width: 1, type: 'line' },
      { key: 'mid', label: 'Middle', color: '#FF7043', width: 1, type: 'line', dash: [4, 4] },
      { key: 'lower', label: 'Lower', color: '#FF7043', width: 1, type: 'line' },
    ],
    fills: [{ upper: 'upper', lower: 'lower', color: 'rgba(255, 112, 67, 0.06)' }],
    compute(bars, params) {
      return C.linearRegressionChannel(C.closes(bars), params.period, params.multiplier);
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
    outputs: [
      { key: 'supertrend', label: 'Supertrend', color: '#26A69A', width: 2, type: 'line', dynamicColor: { key: 'direction', bullColor: '#26A69A', bearColor: '#EF5350' } },
      { key: 'direction', label: 'Direction', color: 'transparent', width: 0, type: 'hidden' },
    ],
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
    outputs: [
      { key: 'sar', label: 'SAR', color: '#7C4DFF', width: 0, type: 'dots', dynamicColor: { key: 'isUpTrend', bullColor: '#26A69A', bearColor: '#EF5350' } },
      { key: 'isUpTrend', label: 'Trend', color: 'transparent', width: 0, type: 'hidden' },
    ],
    compute(bars, params) {
      return C.parabolicSAR(bars, params.step, params.max);
    },
  },
};
