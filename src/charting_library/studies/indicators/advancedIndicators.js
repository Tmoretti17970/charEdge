// ═══════════════════════════════════════════════════════════════════
// charEdge — Advanced Indicator Definitions (Phase 2+)
// All indicators split into category sub-modules under ./advanced/
// This file merges them into a single ADVANCED_INDICATORS export.
// ═══════════════════════════════════════════════════════════════════

import { ADAPTIVE_INDICATORS } from './advanced/adaptiveIndicators.js';
import { CORE_INDICATORS } from './advanced/coreIndicators.js';
import { EXOTIC_INDICATORS } from './advanced/exoticIndicators.js';
import { QUICKWIN_INDICATORS } from './advanced/quickwinIndicators.js';

export const ADVANCED_INDICATORS = {
  ...CORE_INDICATORS,
  ...QUICKWIN_INDICATORS,
  ...ADAPTIVE_INDICATORS,
  ...EXOTIC_INDICATORS,
};
