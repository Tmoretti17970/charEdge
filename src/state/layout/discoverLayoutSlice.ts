// ═══════════════════════════════════════════════════════════════════
// charEdge — Discover Layout Slice
// Extracted from useDiscoverLayoutStore for useLayoutStore consolidation.
// ═══════════════════════════════════════════════════════════════════

const DISCOVER_PRESETS = {
  daytrader: {
    label: '📊 Day Trader',
    description: 'Screener + flow + news prominent',
    visible: ['smartScreener', 'optionsFlow', 'sentimentNews', 'technicalScanner', 'watchlistIntel', 'smartAlerts'],
  },
  swing: {
    label: '📈 Swing Trader',
    description: 'Technicals + sectors + earnings prominent',
    visible: ['technicalScanner', 'sectorRotation', 'earningsIntel', 'confluenceView', 'analystConsensus', 'smartAlerts'],
  },
  investor: {
    label: '💼 Investor',
    description: 'Fundamentals + analyst + macro prominent',
    visible: ['analystConsensus', 'insiderTracker', 'correlationMatrix', 'volatilityDash', 'earningsIntel', 'economicCalendar'],
  },
  learner: {
    label: '🎓 Learner',
    description: 'Education + simple metrics prominent',
    visible: ['education', 'morningBriefing', 'watchlistIntel', 'sentimentNews', 'socialValidation'],
  },
};

export const createDiscoverLayoutSlice = (set) => ({
  // ─── Discover Layout State ────────────────────────────────────
  discoverPreset: null,
  hiddenWidgets: [],
  widgetSizes: {},

  // ─── Discover Layout Actions ──────────────────────────────────
  applyDiscoverPreset: (presetId) => set({ discoverPreset: presetId }),

  toggleDiscoverWidget: (widgetId) =>
    set((s) => ({
      hiddenWidgets: s.hiddenWidgets.includes(widgetId)
        ? s.hiddenWidgets.filter((w) => w !== widgetId)
        : [...s.hiddenWidgets, widgetId],
    })),

  setWidgetSize: (widgetId, size) =>
    set((s) => ({ widgetSizes: { ...s.widgetSizes, [widgetId]: size } })),

  resetDiscoverLayout: () => set({ discoverPreset: null, hiddenWidgets: [], widgetSizes: {} }),
});

export { DISCOVER_PRESETS };
// Backward-compat alias
export { DISCOVER_PRESETS as PRESETS };
