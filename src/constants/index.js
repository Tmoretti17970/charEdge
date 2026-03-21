// ═══════════════════════════════════════════════════════════════════
// charEdge — Constants Barrel Index
//
// Re-exports everything from focused modules.
// Import from here or from 'src/constants.js' (which re-exports this).
// ═══════════════════════════════════════════════════════════════════

// C, F, M, and palettes come from _colors.js (leaf module, ZERO imports)
// to guarantee they are initialized before any consumer.
export { C, F, M, DARK_COLORS, LIGHT_COLORS, DEEP_SEA_COLORS } from './_colors.js';

// refreshThemeCache, GLASS, DEPTH come from theme.js (has side effects: earlyThemeInit)
export { refreshThemeCache, GLASS, DEPTH } from './theme.js';

export {
  AXIS_WIDTH,
  TIME_AXIS_HEIGHT,
  DEFAULT_VISIBLE_BARS,
  RIGHT_PADDING_BARS,
  MAX_SCROLL_SPEED,
  MIN_VISIBLE_BARS,
  CACHE_TTL_MS,
  CACHE_MAX_ENTRIES,
  buildCacheKey,
  CHART_TYPES,
  EMOJIS,
  STORAGE_KEY,
  DEFAULT_SETTINGS,
} from './chart.js';

export { TFS, CRYPTO_TFS } from './timeframes.js';

export {
  CRYPTO_IDS,
  isCrypto,
  FUTURES_ROOTS,
  FOREX_PAIRS,
  getAssetClass,
  isFutures,
  isForex,
  toYahooSymbol,
} from './assets.js';

export { IND_CAT, ICATS, OV_COLORS } from './indicators.js';
