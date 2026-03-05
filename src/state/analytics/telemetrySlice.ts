// ═══════════════════════════════════════════════════════════════════
// charEdge — Telemetry Metrics Slice
//
// Accumulates telemetry events from the track() utility and computes
// aggregate metrics: page visit distribution, feature activation,
// session durations, time-to-first-action, and click heatmap zones.
// Extracted from useTelemetryStore for useAnalyticsStore composition.
// ═══════════════════════════════════════════════════════════════════

const MAX_EVENTS = 5000; // max raw events kept
const MAX_SESSIONS = 200; // max session summaries kept
const RETENTION_DAYS = 30;
const MS_PER_DAY = 86400000;

export const TELEMETRY_DEFAULTS = {
  // Raw event log (rolling window)
  events: [],

  // Aggregated metrics
  pageViews: {},       // { charts: 142, journal: 89, ... }
  featureUsage: {},    // { replay_mode: 12, strategy_builder: 3, ... }
  clickMap: {},        // { add_trade: 45, indicator_panel: 22, ... }
  workflows: {},       // { trade_logged: 67, csv_imported: 2, ... }

  // Session metrics
  sessions: [],        // [{ id, start, duration, firstActionMs, pageSequence }]
  currentSession: null,

  // Derived KPIs (recomputed on flush)
  kpis: {
    avgSessionDuration: 0,
    avgTimeToFirstAction: 0,
    totalSessions: 0,
    totalPageViews: 0,
    totalFeatureUses: 0,
    topPages: [],        // [{ page, count }] sorted desc
    topFeatures: [],     // [{ feature, count }] sorted desc
    dailyActiveMinutes: {}, // { '2026-02-24': 45, ... }
  },
};

export const createTelemetrySlice = (set, get) => ({
  ...TELEMETRY_DEFAULTS,

  // ─── Ingest a batch of raw events from the buffer ──────
  ingestEvents: (batch) => {
    if (!batch || batch.length === 0) return;

    set((state) => {
      const events = [...state.events, ...batch].slice(-MAX_EVENTS);
      const pageViews = { ...state.pageViews };
      const featureUsage = { ...state.featureUsage };
      const clickMap = { ...state.clickMap };
      const workflows = { ...state.workflows };
      let sessions = [...state.sessions];
      let currentSession = state.currentSession ? { ...state.currentSession } : null;

      for (const evt of batch) {
        switch (evt.event) {
          case 'page_view':
            if (evt.page) {
              pageViews[evt.page] = (pageViews[evt.page] || 0) + 1;
            }
            if (currentSession) {
              if (!currentSession.pageSequence) currentSession.pageSequence = [];
              currentSession.pageSequence.push(evt.page);
            }
            break;

          case 'feature_use':
            if (evt.feature) {
              featureUsage[evt.feature] = (featureUsage[evt.feature] || 0) + 1;
            }
            break;

          case 'click':
            if (evt.target) {
              clickMap[evt.target] = (clickMap[evt.target] || 0) + 1;
            }
            break;

          case 'workflow_complete':
            if (evt.workflow) {
              workflows[evt.workflow] = (workflows[evt.workflow] || 0) + 1;
            }
            break;

          case 'session_start':
            currentSession = {
              id: evt.session,
              start: evt.ts,
              viewport: evt.viewport,
              pageSequence: [],
              firstActionMs: null,
            };
            break;

          case 'first_action':
            if (currentSession) {
              currentSession.firstActionMs = evt.elapsed_ms;
            }
            break;

          case 'session_end':
            if (currentSession) {
              currentSession.duration = evt.duration_ms;
              sessions.push({ ...currentSession });
              sessions = sessions.slice(-MAX_SESSIONS);
              currentSession = null;
            }
            break;
        }
      }

      // Recompute KPIs
      const kpis = computeKPIs(pageViews, featureUsage, sessions);

      return {
        events,
        pageViews,
        featureUsage,
        clickMap,
        workflows,
        sessions,
        currentSession,
        kpis,
      };
    });
  },

  // ─── Get metrics for a specific date range ─────────────
  getMetrics: (daysBack = 30) => {
    const state = get();
    const cutoff = Date.now() - daysBack * MS_PER_DAY;
    const recentSessions = state.sessions.filter((s) => s.start >= cutoff);
    return {
      ...state.kpis,
      recentSessions,
      pageViews: state.pageViews,
      featureUsage: state.featureUsage,
      clickMap: state.clickMap,
      workflows: state.workflows,
    };
  },

  // ─── Prune old data beyond retention window ────────────
  prune: () => {
    const cutoff = Date.now() - RETENTION_DAYS * MS_PER_DAY;
    set((state) => ({
      events: state.events.filter((e) => e.ts >= cutoff),
      sessions: state.sessions.filter((s) => s.start >= cutoff),
    }));
  },

  // ─── Reset all telemetry data ──────────────────────────
  reset: () => set({ ...TELEMETRY_DEFAULTS }),

  // ─── Persistence helpers ───────────────────────────────
  hydrate: (saved = {}) => set({ ...TELEMETRY_DEFAULTS, ...saved }),
  toJSON: () => {
    const s = get();
    return {
      events: s.events.slice(-1000), // persist last 1000 only
      pageViews: s.pageViews,
      featureUsage: s.featureUsage,
      clickMap: s.clickMap,
      workflows: s.workflows,
      sessions: s.sessions.slice(-MAX_SESSIONS),
      kpis: s.kpis,
    };
  },
});

// ─── KPI Computation ───────────────────────────────────────────────

export function computeKPIs(pageViews, featureUsage, sessions) {
  const totalSessions = sessions.length;
  const totalPageViews = Object.values(pageViews).reduce((a, b) => a + b, 0);
  const totalFeatureUses = Object.values(featureUsage).reduce((a, b) => a + b, 0);

  // Average session duration
  const durations = sessions.filter((s) => s.duration > 0).map((s) => s.duration);
  const avgSessionDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  // Average time-to-first-action
  const firstActions = sessions.filter((s) => s.firstActionMs > 0).map((s) => s.firstActionMs);
  const avgTimeToFirstAction = firstActions.length > 0
    ? Math.round(firstActions.reduce((a, b) => a + b, 0) / firstActions.length)
    : 0;

  // Top pages sorted by count
  const topPages = Object.entries(pageViews)
    .map(([page, count]) => ({ page, count }))
    .sort((a, b) => b.count - a.count);

  // Top features sorted by count
  const topFeatures = Object.entries(featureUsage)
    .map(([feature, count]) => ({ feature, count }))
    .sort((a, b) => b.count - a.count);

  // Daily active minutes (from sessions with duration)
  const dailyActiveMinutes = {};
  for (const s of sessions) {
    if (!s.start || !s.duration) continue;
    const day = new Date(s.start).toISOString().slice(0, 10);
    dailyActiveMinutes[day] = (dailyActiveMinutes[day] || 0) + Math.round(s.duration / 60000);
  }

  return {
    avgSessionDuration,
    avgTimeToFirstAction,
    totalSessions,
    totalPageViews,
    totalFeatureUses,
    topPages,
    topFeatures,
    dailyActiveMinutes,
  };
}
