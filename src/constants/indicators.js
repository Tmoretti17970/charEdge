// ═══════════════════════════════════════════════════════════════════
// charEdge — Indicator Constants
//
// Indicator catalog (IND_CAT), category filter tabs (ICATS),
// and overlay color palette (OV_COLORS).
// ═══════════════════════════════════════════════════════════════════

import { C } from './theme.js';

export const IND_CAT = [
  {
    id: 'sma',
    name: 'SMA',
    full: 'Simple Moving Average',
    cat: 'trend',
    pane: 'overlay',
    params: [{ key: 'period', label: 'Period', def: 20, min: 1, max: 500 }],
  },
  {
    id: 'ema',
    name: 'EMA',
    full: 'Exponential Moving Average',
    cat: 'trend',
    pane: 'overlay',
    params: [{ key: 'period', label: 'Period', def: 21, min: 1, max: 500 }],
  },
  {
    id: 'wma',
    name: 'WMA',
    full: 'Weighted Moving Average',
    cat: 'trend',
    pane: 'overlay',
    params: [{ key: 'period', label: 'Period', def: 20, min: 1, max: 500 }],
  },
  {
    id: 'bollinger',
    name: 'BB',
    full: 'Bollinger Bands',
    cat: 'volatility',
    pane: 'overlay',
    params: [
      { key: 'period', label: 'Period', def: 20, min: 1, max: 200 },
      { key: 'multiplier', label: 'StdDev', def: 2, min: 0.5, max: 5, step: 0.1 },
    ],
  },
  { id: 'vwap', name: 'VWAP', full: 'Vol Weighted Avg Price', cat: 'trend', pane: 'overlay', params: [] },
  {
    id: 'rsi',
    name: 'RSI',
    full: 'Relative Strength Index',
    cat: 'momentum',
    pane: 'sub',
    params: [{ key: 'period', label: 'Period', def: 14, min: 2, max: 100 }],
  },
  {
    id: 'macd',
    name: 'MACD',
    full: 'MACD',
    cat: 'momentum',
    pane: 'sub',
    params: [
      { key: 'fast', label: 'Fast', def: 12, min: 2, max: 100 },
      { key: 'slow', label: 'Slow', def: 26, min: 2, max: 200 },
      { key: 'signal', label: 'Signal', def: 9, min: 2, max: 50 },
    ],
  },
  {
    id: 'stochastic',
    name: 'Stoch',
    full: 'Stochastic',
    cat: 'momentum',
    pane: 'sub',
    params: [
      { key: 'kPeriod', label: '%K', def: 14, min: 1, max: 100 },
      { key: 'dPeriod', label: '%D', def: 3, min: 1, max: 50 },
    ],
  },
  {
    id: 'atr',
    name: 'ATR',
    full: 'Average True Range',
    cat: 'volatility',
    pane: 'sub',
    params: [{ key: 'period', label: 'Period', def: 14, min: 1, max: 100 }],
  },
  {
    id: 'volumeDelta',
    name: 'Vol Δ',
    full: 'Volume Delta',
    cat: 'volume',
    pane: 'sub',
    params: [],
  },
  // ─── New H2.4 indicators ──────────────────────────────────
  {
    id: 'obv',
    name: 'OBV',
    full: 'On-Balance Volume',
    cat: 'volume',
    pane: 'sub',
    params: [],
  },
  {
    id: 'mfi',
    name: 'MFI',
    full: 'Money Flow Index',
    cat: 'volume',
    pane: 'sub',
    params: [{ key: 'period', label: 'Period', def: 14, min: 2, max: 100 }],
  },
  {
    id: 'ichimoku',
    name: 'Ichi',
    full: 'Ichimoku Cloud',
    cat: 'trend',
    pane: 'overlay',
    params: [
      { key: 'tenkanPeriod', label: 'Tenkan', def: 9, min: 1, max: 100 },
      { key: 'kijunPeriod', label: 'Kijun', def: 26, min: 1, max: 100 },
      { key: 'senkouBPeriod', label: 'Senkou B', def: 52, min: 1, max: 200 },
    ],
  },
  {
    id: 'supertrend',
    name: 'ST',
    full: 'Supertrend',
    cat: 'trend',
    pane: 'overlay',
    params: [
      { key: 'period', label: 'Period', def: 10, min: 1, max: 100 },
      { key: 'multiplier', label: 'Multiplier', def: 3, min: 0.5, max: 10, step: 0.5 },
    ],
  },
  {
    id: 'vwapBands',
    name: 'VWAP±',
    full: 'VWAP Bands (σ)',
    cat: 'trend',
    pane: 'overlay',
    params: [],
  },
  {
    id: 'anchoredVwap',
    name: 'AVWAP',
    full: 'Anchored VWAP',
    cat: 'trend',
    pane: 'overlay',
    params: [{ key: 'anchorIndex', label: 'Anchor Bar', def: 0, min: 0, max: 10000 }],
  },
  {
    id: 'roc',
    name: 'ROC',
    full: 'Rate of Change',
    cat: 'momentum',
    pane: 'sub',
    params: [{ key: 'period', label: 'Period', def: 12, min: 1, max: 200 }],
  },
  {
    id: 'williamsR',
    name: '%R',
    full: 'Williams %R',
    cat: 'momentum',
    pane: 'sub',
    params: [{ key: 'period', label: 'Period', def: 14, min: 1, max: 100 }],
  },
  {
    id: 'cmf',
    name: 'CMF',
    full: 'Chaikin Money Flow',
    cat: 'volume',
    pane: 'sub',
    params: [{ key: 'period', label: 'Period', def: 20, min: 1, max: 100 }],
  },
  {
    id: 'adx',
    name: 'ADX',
    full: 'Average Directional Index',
    cat: 'trend',
    pane: 'sub',
    params: [{ key: 'period', label: 'Period', def: 14, min: 1, max: 100 }],
  },
  {
    id: 'keltner',
    name: 'KC',
    full: 'Keltner Channels',
    cat: 'volatility',
    pane: 'overlay',
    params: [
      { key: 'emaPeriod', label: 'EMA', def: 20, min: 1, max: 200 },
      { key: 'atrPeriod', label: 'ATR', def: 10, min: 1, max: 100 },
      { key: 'multiplier', label: 'Mult', def: 2, min: 0.5, max: 5, step: 0.5 },
    ],
  },
  {
    id: 'donchian',
    name: 'DC',
    full: 'Donchian Channels',
    cat: 'volatility',
    pane: 'overlay',
    params: [{ key: 'period', label: 'Period', def: 20, min: 1, max: 200 }],
  },
];

export const ICATS = [
  { id: 'all', l: 'All' },
  { id: 'trend', l: 'Trend' },
  { id: 'momentum', l: 'Momentum' },
  { id: 'volatility', l: 'Volatility' },
  { id: 'volume', l: 'Volume' },
];

// Lazy getter — avoids TDZ when Rollup evaluates this before theme.js
let _OV_COLORS;
export function getOvColors() {
  return _OV_COLORS || (_OV_COLORS = [C.y, C.orange, C.p, C.cyan, C.pink, C.lime, '#6c5ce7', '#fd79a8']);
}
export const OV_COLORS = new Proxy([], {
  get(_, p) {
    return getOvColors()[p];
  },
});
