// ═══════════════════════════════════════════════════════════════════
// charEdge — Persona / Progression Slice
// Extracted from usePersonaStore for useUserStore consolidation.
// ═══════════════════════════════════════════════════════════════════

import { BETA_MODE } from '../../shared/featureFlags';

// ─── Tiers ───────────────────────────────────────────────────────

export const TIERS = {
  EXPLORER: 'explorer',
  BUILDER: 'builder',
  ARCHITECT: 'architect',
};

export const TIER_CONFIG = {
  [TIERS.EXPLORER]: {
    label: 'Explorer',
    icon: '🧭',
    color: '#6366f1',
    minTrades: 0,
    maxTrades: 9,
    description: 'Getting started — simple tools, guided experience',
  },
  [TIERS.BUILDER]: {
    label: 'Builder',
    icon: '🔧',
    color: '#f59e0b',
    minTrades: 10,
    maxTrades: 49,
    description: 'Intermediate tools — analytics, templates, indicators',
  },
  [TIERS.ARCHITECT]: {
    label: 'Architect',
    icon: '🏛️',
    color: '#10b981',
    minTrades: 50,
    maxTrades: Infinity,
    description: 'Full power — all tools, customization, advanced analytics',
  },
};

export const FEATURE_TIERS = {
  trade_logging: TIERS.EXPLORER,
  chart_basic: TIERS.EXPLORER,
  symbol_search: TIERS.EXPLORER,
  equity_curve: TIERS.EXPLORER,
  daily_pnl: TIERS.EXPLORER,

  chart_indicators: TIERS.BUILDER,
  chart_drawings: TIERS.BUILDER,
  playbooks: TIERS.BUILDER,
  trade_analytics: TIERS.BUILDER,
  csv_import: TIERS.BUILDER,
  chart_templates: TIERS.BUILDER,
  ai_insights: TIERS.BUILDER,
  alerts: TIERS.BUILDER,
  watchlists: TIERS.BUILDER,
  trade_replay: TIERS.BUILDER,
  multi_chart: TIERS.BUILDER,
  notes: TIERS.BUILDER,
  trade_plans: TIERS.BUILDER,
  heatmap: TIERS.BUILDER,
  gamification: TIERS.BUILDER,

  custom_indicators: TIERS.ARCHITECT,
  scripting: TIERS.ARCHITECT,
  backtesting: TIERS.ARCHITECT,
  screener: TIERS.ARCHITECT,
  strategy_builder: TIERS.ARCHITECT,
  paper_trading: TIERS.ARCHITECT,
  social_sharing: TIERS.ARCHITECT,
  copy_trading: TIERS.ARCHITECT,
  tournaments: TIERS.ARCHITECT,
  live_rooms: TIERS.ARCHITECT,
  prop_firm_tracking: TIERS.ARCHITECT,
  indicator_marketplace: TIERS.ARCHITECT,
  workspace_layouts: TIERS.ARCHITECT,
  quad_chart: TIERS.ARCHITECT,
  depth_chart: TIERS.ARCHITECT,
  dom_ladder: TIERS.ARCHITECT,
  risk_simulator: TIERS.ARCHITECT,
  fundamentals: TIERS.ARCHITECT,
};

// ─── Helpers ─────────────────────────────────────────────────────

const TIER_ORDER = [TIERS.EXPLORER, TIERS.BUILDER, TIERS.ARCHITECT];

function tierIndex(tier) {
  const idx = TIER_ORDER.indexOf(tier);
  return idx >= 0 ? idx : 0;
}

function computeTier(tradeCount) {
  if (tradeCount >= 50) return TIERS.ARCHITECT;
  if (tradeCount >= 10) return TIERS.BUILDER;
  return TIERS.EXPLORER;
}

// ─── Persona Defaults ────────────────────────────────────────────

const PERSONA_DEFAULTS = {
  tier: BETA_MODE ? TIERS.ARCHITECT : TIERS.EXPLORER,
  manualTier: BETA_MODE ? TIERS.ARCHITECT : null,
  tradeCount: 0,
  tierHistory: [],
  unlockedFeatures: [],
};

// ─── Slice ───────────────────────────────────────────────────────

export const createPersonaSlice = (set, get) => ({
  ...PERSONA_DEFAULTS,

  updateFromTrades: (trades) => {
    const count = Array.isArray(trades) ? trades.length : 0;
    const newTier = computeTier(count);
    const current = get().tier;

    set((s) => {
      const updates = { tradeCount: count, tier: newTier };
      if (newTier !== current) {
        updates.tierHistory = [
          ...s.tierHistory,
          { tier: newTier, ts: Date.now(), tradeCount: count },
        ];
      }
      return updates;
    });
  },

  setManualTier: (tier) => {
    if (!TIER_ORDER.includes(tier)) return;
    set({ manualTier: tier });
  },

  clearOverride: () => set({ manualTier: null }),

  isFeatureUnlocked: (featureId) => {
    const s = get();
    if (s.unlockedFeatures.includes(featureId)) return true;
    const requiredTier = FEATURE_TIERS[featureId];
    if (!requiredTier) return true;
    const activeTier = s.manualTier || s.tier;
    return tierIndex(activeTier) >= tierIndex(requiredTier);
  },

  getFeatureTier: (featureId) => {
    return FEATURE_TIERS[featureId] || TIERS.EXPLORER;
  },

  unlockFeature: (featureId) => {
    set((s) => ({
      unlockedFeatures: [...new Set([...s.unlockedFeatures, featureId])],
    }));
  },

  lockFeature: (featureId) => {
    set((s) => ({
      unlockedFeatures: s.unlockedFeatures.filter((f) => f !== featureId),
    }));
  },

  getTierConfig: () => TIER_CONFIG[get().manualTier || get().tier],

  getAllFeatures: () => {
    const s = get();
    return Object.entries(FEATURE_TIERS).map(([id, requiredTier]) => ({
      id,
      requiredTier,
      unlocked: s.isFeatureUnlocked(id),
    }));
  },

  hydratePersona: (saved = {}) => set({ ...PERSONA_DEFAULTS, ...saved }),
  personaToJSON: () => {
    const { tier, manualTier, tradeCount, tierHistory, unlockedFeatures } = get();
    return { tier, manualTier, tradeCount, tierHistory, unlockedFeatures };
  },

  resetPersona: () => set({ ...PERSONA_DEFAULTS }),
});
