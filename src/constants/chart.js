// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Constants
//
// Chart sizing, chart types, cache configuration, emojis,
// storage key, and default settings.
//
// @module constants/chart
// ═══════════════════════════════════════════════════════════════════

/** @type {number} Width of the price (Y) axis in pixels */
export const AXIS_WIDTH = 68;

/** @type {number} Height of the time (X) axis in pixels */
export const TIME_AXIS_HEIGHT = 22;

/** @type {number} Default number of bars visible in the chart viewport */
export const DEFAULT_VISIBLE_BARS = 80;

/** @type {number} Empty bars added to the right of the latest candle */
export const RIGHT_PADDING_BARS = 5;

/** @type {number} Maximum pan speed in bars-per-frame during momentum scroll */
export const MAX_SCROLL_SPEED = 15;

/** @type {number} Minimum bars visible before zoom is clamped */
export const MIN_VISIBLE_BARS = 10;

/** @type {number} Cache time-to-live in milliseconds (60 seconds) */
export const CACHE_TTL_MS = 60_000;

/** @type {number} Maximum number of entries in the in-memory cache */
export const CACHE_MAX_ENTRIES = 50;


/**
 * Build a standardized cache key for symbol + timeframe.
 * Single source of truth — ALL cache layers (memory, IDB, OPFS) MUST use this.
 * Uses colon separator to match DataCache's IDB key format.
 * @param {string} sym  - Symbol (e.g., 'BTCUSDT')
 * @param {string} tfId - Timeframe ID (e.g., '1D')
 * @returns {string} Cache key (e.g., 'BTCUSDT:1D')
 */
export function buildCacheKey(sym, tfId) {
  return `${sym}:${tfId}`;
}

export const CHART_TYPES = [
  { id: 'candles', label: 'Candles', engineId: 'candlestick' },
  { id: 'hollow', label: 'Hollow', engineId: 'hollow' },
  { id: 'ohlc', label: 'OHLC', engineId: 'ohlc' },
  { id: 'line', label: 'Line', engineId: 'line' },
  { id: 'area', label: 'Area', engineId: 'area' },
  { id: 'heikinashi', label: 'Heikin-Ashi', engineId: 'heikinashi' },
  { id: 'baseline', label: 'Baseline', engineId: 'baseline' },
  { id: 'footprint', label: 'Footprint', engineId: 'footprint' },
  { id: 'renko', label: 'Renko', engineId: 'renko' },
  { id: 'range', label: 'Range Bars', engineId: 'range' },
  { id: 'kagi', label: 'Kagi', engineId: 'kagi' },
  { id: 'linebreak', label: 'Line Break', engineId: 'linebreak' },
  { id: 'pnf', label: 'Point & Figure', engineId: 'pointfigure' },
  { id: 'tick', label: 'Tick', engineId: 'tick' },
  { id: 'volumecandle', label: 'Vol Candles', engineId: 'volumecandle' },
  { id: 'hilo', label: 'Hi-Lo', engineId: 'hilo' },
  { id: 'columns', label: 'Columns', engineId: 'columns' },
  { id: 'stepline', label: 'Step Line', engineId: 'stepline' },
];

export const EMOJIS = [
  { e: '😌', l: 'Calm' },
  { e: '💪', l: 'Confident' },
  { e: '😐', l: 'Neutral' },
  { e: '🤔', l: 'Uncertain' },
  { e: '😰', l: 'Anxious' },
  { e: '😤', l: 'Frustrated' },
  { e: '🎯', l: 'Focused' },
  { e: '😴', l: 'Tired' },
];

export const STORAGE_KEY = 'charEdge-os-v10';

/**
 * @typedef {Object} ChartConfig
 * @property {boolean} simpleMode - Hide advanced UI (default: false)
 * @property {number} dailyLossLimit - Max daily loss in account currency, 0 = unlimited (default: 0)
 * @property {string} defaultSymbol - Symbol loaded on startup (default: 'BTC')
 * @property {string} defaultTf - Timeframe loaded on startup (default: '5m')
 * @property {number} accountSize - Account starting balance, 0 = not configured (default: 0)
 * @property {number} riskPerTrade - Fixed risk per trade in currency (default: 0)
 * @property {number} riskPerTradePct - Risk per trade as % of account (default: 1.0)
 * @property {number} maxDailyTrades - Max trades per day, 0 = unlimited (default: 0)
 * @property {number} maxOpenPositions - Max concurrent positions, 0 = unlimited (default: 0)
 * @property {number} riskFreeRate - Annual risk-free rate for Sharpe/Sortino (default: 0.05)
 * @property {'fixed_pct'|'kelly'|'fixed_amount'} positionSizing - Position sizing method (default: 'fixed_pct')
 * @property {number} kellyFraction - Kelly criterion fraction 0-1 (default: 0.5)
 * @property {string|null} activeRiskPreset - ID of active built-in risk preset, null for custom (default: null)
 */

/** @type {ChartConfig} Default application settings */
export const DEFAULT_SETTINGS = {
  simpleMode: false,
  dailyLossLimit: 0,
  defaultSymbol: 'BTC',
  defaultTf: '5m',
  accountSize: 0,
  riskPerTrade: 0,
  // ─── Risk Presets (Epic 5) ──────────────────────────────────
  riskPerTradePct: 1.0,
  maxDailyTrades: 0,
  maxOpenPositions: 0,
  riskFreeRate: 0.05,
  positionSizing: 'fixed_pct',
  kellyFraction: 0.5,
  activeRiskPreset: null, // ID of active built-in preset (or null for custom)
};
