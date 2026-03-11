// ═══════════════════════════════════════════════════════════════════
// charEdge — Feature Gates (4.3.15)
//
// Level-gated feature unlock system. Maps XP levels to features
// that get progressively unlocked as the user's skill grows.
// Integrates with the existing gamification/XP store.
// ═══════════════════════════════════════════════════════════════════

export interface FeatureGate {
  /** Unique feature ID */
  id: string;
  /** Human-readable feature name */
  name: string;
  /** XP level required to unlock */
  requiredLevel: number;
  /** Description shown in locked state */
  description: string;
  /** Category for grouping */
  category: 'chart' | 'analysis' | 'intelligence' | 'social';
}

/** Feature unlock registry — ordered by required level */
export const FEATURE_GATES: FeatureGate[] = [
  // Level 1 — Basics (always unlocked)
  { id: 'basic_charts', name: 'Basic Charts', requiredLevel: 1, description: 'Candlestick, line, and bar charts', category: 'chart' },
  { id: 'basic_indicators', name: 'Basic Indicators', requiredLevel: 1, description: 'SMA, EMA, RSI, MACD, Bollinger Bands', category: 'analysis' },

  // Level 3 — Drawing tools
  { id: 'drawing_tools', name: 'Drawing Tools', requiredLevel: 3, description: 'Trendlines, horizontal rays, rectangles', category: 'chart' },
  { id: 'trade_journal', name: 'Trade Journal', requiredLevel: 3, description: 'Log and review your trades', category: 'analysis' },

  // Level 5 — Advanced analysis
  { id: 'footprint_chart', name: 'Footprint Chart', requiredLevel: 5, description: 'Volume-at-price footprint visualization', category: 'chart' },
  { id: 'advanced_drawings', name: 'Advanced Drawings', requiredLevel: 5, description: 'Fibonacci, Gann, and Pitchfork tools', category: 'chart' },
  { id: 'ai_copilot', name: 'AI Co-Pilot', requiredLevel: 5, description: 'Real-time AI insights and trade coaching', category: 'intelligence' },

  // Level 7 — Pro features
  { id: 'ghost_trades', name: 'Ghost Trades', requiredLevel: 7, description: 'Paper trade from drawings with AI monitoring', category: 'intelligence' },
  { id: 'voice_notes', name: 'Voice-to-Chart', requiredLevel: 7, description: 'Voice notes pinned to candles', category: 'analysis' },
  { id: 'equity_curve', name: 'Equity Curve', requiredLevel: 7, description: 'Visual equity performance with smoothing', category: 'analysis' },

  // Level 10 — Expert
  { id: 'webgpu_engine', name: 'WebGPU Engine', requiredLevel: 10, description: 'GPU-accelerated rendering for 1M+ candles', category: 'chart' },
  { id: 'alpha_tags', name: 'Alpha Tags', requiredLevel: 10, description: 'Auto-tag trades with indicator signals', category: 'intelligence' },
  { id: 'decision_tree', name: 'Decision Tree', requiredLevel: 10, description: 'Forced-choice pre-trade classification', category: 'intelligence' },

  // Level 15 — Master
  { id: 'market_replay', name: 'Market Replay', requiredLevel: 15, description: 'Replay historical data with intra-candle interpolation', category: 'chart' },
  { id: 'post_trade_replay', name: 'Post-Trade Replay', requiredLevel: 15, description: 'Current vs Past Self split panel', category: 'intelligence' },
  { id: 'custom_scripts', name: 'Custom Scripts', requiredLevel: 15, description: 'Custom indicator scripting engine', category: 'analysis' },
];

/**
 * Check if a feature is unlocked at a given level.
 */
export function isFeatureUnlocked(featureId: string, userLevel: number): boolean {
  const gate = FEATURE_GATES.find((g) => g.id === featureId);
  if (!gate) return true; // Unknown features are unlocked by default
  return userLevel >= gate.requiredLevel;
}

/**
 * Get all features available at a given level.
 */
export function getUnlockedFeatures(userLevel: number): FeatureGate[] {
  return FEATURE_GATES.filter((g) => userLevel >= g.requiredLevel);
}

/**
 * Get the next features to be unlocked.
 */
export function getNextUnlocks(userLevel: number, limit: number = 3): FeatureGate[] {
  return FEATURE_GATES
    .filter((g) => g.requiredLevel > userLevel)
    .sort((a, b) => a.requiredLevel - b.requiredLevel)
    .slice(0, limit);
}

/**
 * Get unlock progress for a specific feature.
 * Returns 0-1 representing how close the user is to unlocking.
 */
export function getUnlockProgress(featureId: string, userLevel: number): number {
  const gate = FEATURE_GATES.find((g) => g.id === featureId);
  if (!gate) return 1;
  if (userLevel >= gate.requiredLevel) return 1;
  return Math.min(1, userLevel / gate.requiredLevel);
}

/**
 * Get features grouped by category.
 */
export function getFeaturesByCategory(
  userLevel: number,
): Record<FeatureGate['category'], { unlocked: FeatureGate[]; locked: FeatureGate[] }> {
  const categories: FeatureGate['category'][] = ['chart', 'analysis', 'intelligence', 'social'];
  const result = {} as ReturnType<typeof getFeaturesByCategory>;

  for (const cat of categories) {
    const features = FEATURE_GATES.filter((g) => g.category === cat);
    result[cat] = {
      unlocked: features.filter((g) => userLevel >= g.requiredLevel),
      locked: features.filter((g) => userLevel < g.requiredLevel),
    };
  }

  return result;
}

export default {
  FEATURE_GATES,
  isFeatureUnlocked,
  getUnlockedFeatures,
  getNextUnlocks,
  getUnlockProgress,
  getFeaturesByCategory,
};
