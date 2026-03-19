// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Feature Flags
//
// Central gate for unstable or premium features.
// Flags persist in localStorage. All gated features default to OFF
// until explicitly enabled (e.g. via Settings or admin panel).
//
// Usage:
//   import { isEnabled, FEATURES } from '@/shared/featureFlags';
//   if (isEnabled(FEATURES.SCRIPTING)) { /* show scripting UI */ }
// ═══════════════════════════════════════════════════════════════════

/**
 * BETA_MODE — flip to `true` to force ALL features on during testing.
 * Set back to `false` before shipping to production.
 */
export const BETA_MODE = true;

const STORAGE_KEY = 'charEdge_featureFlags';

/**
 * Feature flag identifiers.
 * Each key maps to a unique flag name stored in localStorage.
 */
export const FEATURES = Object.freeze({
  SCRIPTING: 'scripting',       // Pine-compatible script engine
  BACKTESTING: 'backtesting',     // Walk-forward backtest engine
  PAPER_TRADING: 'paper_trading',   // Simulated order execution
  AI_COACH: 'ai_coach',        // Smart Insights (rebranded from AI Coach / Char)
  SOCIAL: 'social',          // Community feed / social features
  WEBGPU: 'webgpu',          // WebGPU compute shaders
});

/** Default state for each flag (BETA_MODE overrides all to true) */
const DEFAULTS = {
  [FEATURES.SCRIPTING]: BETA_MODE || false,
  [FEATURES.BACKTESTING]: BETA_MODE || false,
  [FEATURES.PAPER_TRADING]: BETA_MODE || false,
  [FEATURES.AI_COACH]: true,   // Smart Insights — always on
  [FEATURES.SOCIAL]: BETA_MODE || false,
  [FEATURES.WEBGPU]: BETA_MODE || false,
};

/** In-memory cache (avoids repeated localStorage reads) */
let _cache = null;

// eslint-disable-next-line @typescript-eslint/naming-convention
function _loadFlags() {
  if (_cache) return _cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    _cache = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_) {
    _cache = { ...DEFAULTS };
  }
  return _cache;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function _saveFlags(flags) {
  _cache = flags;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_) {
    // Storage full or unavailable — flags still work in-memory
  }
}

/**
 * Check whether a feature is enabled.
 * @param {string} flag — one of FEATURES constants
 * @returns {boolean}
 */
export function isEnabled(flag) {
  if (BETA_MODE) return true;
  return !!_loadFlags()[flag];
}

/**
 * Enable or disable a feature flag.
 * @param {string} flag — one of FEATURES constants
 * @param {boolean} value
 */
export function setFlag(flag, value) {
  const flags = { ..._loadFlags(), [flag]: !!value };
  _saveFlags(flags);
}

/**
 * Get all current flag states (for Settings UI).
 * @returns {Record<string, boolean>}
 */
export function getAllFlags() {
  return { ..._loadFlags() };
}

/**
 * Reset all flags to defaults.
 */
export function resetFlags() {
  _cache = null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* storage/API may be blocked */ }
}

/**
 * Human-readable labels for each feature (for Settings UI).
 */
export const FEATURE_LABELS = Object.freeze({
  [FEATURES.SCRIPTING]: 'Script Engine (Pine-compatible)',
  [FEATURES.BACKTESTING]: 'Backtesting Engine',
  [FEATURES.PAPER_TRADING]: 'Paper Trading',
  [FEATURES.AI_COACH]: 'Smart Insights',
  [FEATURES.SOCIAL]: 'Community & Social',
  [FEATURES.WEBGPU]: 'WebGPU Compute (Experimental)',
});
