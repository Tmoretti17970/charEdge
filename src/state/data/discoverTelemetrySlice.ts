// ═══════════════════════════════════════════════════════════════════
// charEdge — Discover Telemetry Slice
//
// Comprehensive engagement tracking for Discover widgets.
// Tracks impressions, interactions, dwell time, and conversion events.
// Extracted from useDiscoverTelemetry for useDataStore composition.
// ═══════════════════════════════════════════════════════════════════

const TELEMETRY_DEFAULTS = {
  sessionStart: null,
  tabDwellTimes: {},
  currentTab: null,
  currentTabStart: null,
  widgetMetrics: {},
  events: [],
  funnelCounts: {
    briefingViews: 0,
    briefingReadThroughs: 0,
    screenerOpens: 0,
    screenerToChart: 0,
    alertCreated: 0,
    alertFollowed: 0,
    copilotOpened: 0,
    copilotQueries: 0,
  },
};

export const createDiscoverTelemetrySlice = (set, get) => ({
  // ─── Session Tracking ──────────────────────────────────────────
  ...TELEMETRY_DEFAULTS,

  // ─── Actions ───────────────────────────────────────────────────

  /**
   * Start a new telemetry session.
   */
  startSession: () =>
    set({ sessionStart: Date.now() }),

  /**
   * Track tab switch — updates dwell time for previous tab.
   */
  switchTab: (tabId) => {
    const { currentTab, currentTabStart, tabDwellTimes } = get();
    const now = Date.now();
    const updates = {};

    // Accumulate dwell time for the previous tab
    if (currentTab && currentTabStart) {
      const elapsed = now - currentTabStart;
      updates.tabDwellTimes = {
        ...tabDwellTimes,
        [currentTab]: (tabDwellTimes[currentTab] || 0) + elapsed,
      };
    }

    updates.currentTab = tabId;
    updates.currentTabStart = now;

    set(updates);
    get().logEvent('tab_switch', { tab: tabId });
  },

  /**
   * Record a widget impression (visible in viewport).
   */
  trackImpression: (widgetId) => {
    set((s) => {
      const existing = s.widgetMetrics[widgetId] || { impressions: 0, clicks: 0, expands: 0, dismisses: 0, totalDwellMs: 0 };
      return {
        widgetMetrics: {
          ...s.widgetMetrics,
          [widgetId]: { ...existing, impressions: existing.impressions + 1 },
        },
      };
    });
  },

  /**
   * Record a widget interaction.
   * @param {'click'|'expand'|'dismiss'|'filter'} action
   */
  trackInteraction: (widgetId, action) => {
    set((s) => {
      const existing = s.widgetMetrics[widgetId] || { impressions: 0, clicks: 0, expands: 0, dismisses: 0, totalDwellMs: 0 };
      const updated = { ...existing };
      if (action === 'click') updated.clicks++;
      else if (action === 'expand') updated.expands++;
      else if (action === 'dismiss') updated.dismisses++;

      return {
        widgetMetrics: {
          ...s.widgetMetrics,
          [widgetId]: updated,
        },
      };
    });
    get().logEvent('widget_interaction', { widgetId, action });
  },

  /**
   * Track funnel steps.
   */
  trackFunnel: (step) => {
    set((s) => ({
      funnelCounts: {
        ...s.funnelCounts,
        [step]: (s.funnelCounts[step] || 0) + 1,
      },
    }));
    get().logEvent('funnel_step', { step });
  },

  /**
   * Log a timestamped event.
   */
  logEvent: (type, data = {}) => {
    set((s) => ({
      events: [
        { type, data, timestamp: Date.now() },
        ...s.events.slice(0, 99), // Keep last 100
      ],
    }));
  },

  // ─── Computed Metrics ──────────────────────────────────────────

  /**
   * Get session duration in ms.
   */
  getSessionDuration: () => {
    const { sessionStart } = get();
    return sessionStart ? Date.now() - sessionStart : 0;
  },

  /**
   * Get widget engagement rankings.
   */
  getWidgetRankings: () => {
    const { widgetMetrics } = get();
    return Object.entries(widgetMetrics)
      .map(([id, m]) => ({
        id,
        engagement: m.clicks + m.expands * 2, // Weight expands higher
        ...m,
      }))
      .sort((a, b) => b.engagement - a.engagement);
  },

  /**
   * Get funnel conversion rates.
   */
  getConversionRates: () => {
    const { funnelCounts: f } = get();
    return {
      briefingReadRate: f.briefingViews > 0 ? f.briefingReadThroughs / f.briefingViews : 0,
      screenerConversion: f.screenerOpens > 0 ? f.screenerToChart / f.screenerOpens : 0,
      alertFollowRate: f.alertCreated > 0 ? f.alertFollowed / f.alertCreated : 0,
      copilotQueryRate: f.copilotOpened > 0 ? f.copilotQueries / f.copilotOpened : 0,
    };
  },

  /**
   * Export all metrics as JSON (for weekly dashboard).
   */
  exportMetrics: () => {
    const s = get();
    return {
      sessionDuration: s.getSessionDuration(),
      tabDwellTimes: { ...s.tabDwellTimes },
      widgetMetrics: { ...s.widgetMetrics },
      funnelCounts: { ...s.funnelCounts },
      rankings: s.getWidgetRankings(),
      conversions: s.getConversionRates(),
      exportedAt: Date.now(),
    };
  },

  // ─── Reset ─────────────────────────────────────────────────────
  reset: () => set({ ...TELEMETRY_DEFAULTS }),
});
