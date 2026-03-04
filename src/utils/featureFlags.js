// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Feature Flags
//
// Central gate for unstable or premium features.
// Flags persist in localStorage. All gated features default to OFF
// until explicitly enabled (e.g. via Settings or admin panel).
//
// Usage:
//   import { isEnabled, FEATURES } from '../utils/featureFlags.js';
//   if (isEnabled(FEATURES.SCRIPTING)) { /* show scripting UI */ }
// ═══════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'charEdge_featureFlags';

/**
 * Feature flag identifiers.
 * Each key maps to a unique flag name stored in localStorage.
 */
export const FEATURES = Object.freeze({
  SCRIPTING:      'scripting',       // Pine-compatible script engine
  BACKTESTING:    'backtesting',     // Walk-forward backtest engine
  PAPER_TRADING:  'paper_trading',   // Simulated order execution
  AI_COACH:       'ai_coach',        // AI trade coaching / Char
  SOCIAL:         'social',          // Community feed / social features
  WEBGPU:         'webgpu',          // WebGPU compute shaders
});

/** Default state for each flag (all off until proven stable) */
const DEFAULTS = {
  [FEATURES.SCRIPTING]:      false,
  [FEATURES.BACKTESTING]:    false,
  [FEATURES.PAPER_TRADING]:  false,
  [FEATURES.AI_COACH]:       true,   // AI Coach is stable — enabled by default
  [FEATURES.SOCIAL]:         false,
  [FEATURES.WEBGPU]:         false,
};

/** In-memory cache (avoids repeated localStorage reads) */
let _cache = null;

function _loadFlags() {
  if (_cache) return _cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    _cache = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    _cache = { ...DEFAULTS };
  }
  return _cache;
}

function _saveFlags(flags) {
  _cache = flags;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
  } catch {
    // Storage full or unavailable — flags still work in-memory
  }
}

/**
 * Check whether a feature is enabled.
 * @param {string} flag — one of FEATURES constants
 * @returns {boolean}
 */
export function isEnabled(flag) {
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
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

/**
 * Human-readable labels for each feature (for Settings UI).
 */
export const FEATURE_LABELS = Object.freeze({
  [FEATURES.SCRIPTING]:      'Script Engine (Pine-compatible)',
  [FEATURES.BACKTESTING]:    'Backtesting Engine',
  [FEATURES.PAPER_TRADING]:  'Paper Trading',
  [FEATURES.AI_COACH]:       'AI Coach (Char)',
  [FEATURES.SOCIAL]:         'Community & Social',
  [FEATURES.WEBGPU]:         'WebGPU Compute (Experimental)',
});
