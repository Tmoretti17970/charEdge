// ═══════════════════════════════════════════════════════════════════
// charEdge — Settings Slice
// Extracted from useSettingsStore for useUserStore consolidation.
//
// NOTE: DEFAULT_SETTINGS is inlined here (not imported from the
// constants barrel) to avoid a Rollup module-evaluation-order bug
// that causes "Cannot access before initialization" in production.
// Keep in sync with constants/chart.js → DEFAULT_SETTINGS.
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_SETTINGS = {
  simpleMode: false,
  dailyLossLimit: 0,
  defaultSymbol: 'BTC',
  defaultTf: '5m',
  accountSize: 0,
  riskPerTrade: 0,
  riskPerTradePct: 1.0,
  maxDailyTrades: 0,
  maxOpenPositions: 0,
  riskFreeRate: 0.05,
  positionSizing: 'fixed_pct',
  kellyFraction: 0.5,
  activeRiskPreset: null,
};

export const createSettingsSlice = (set) => ({
  ...DEFAULT_SETTINGS,

  update: (updates) => set((s) => ({ ...s, ...updates })),

  hydrateSettings: (saved = {}) => set({ ...DEFAULT_SETTINGS, ...saved }),

  resetSettings: () => set({ ...DEFAULT_SETTINGS }),
});
