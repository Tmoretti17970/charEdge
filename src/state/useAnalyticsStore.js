// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Analytics Store (Zustand, Consolidated)
//
// Holds computed analytics results + telemetry metrics.
// Absorbs: useAnalyticsStore (original), useTelemetryStore
//
// Persistence: telemetry data persisted via safePersist.
// Analytics results are transient (recomputed each session).
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { safePersist } from '../utils/safePersist.js';

import { createAnalyticsSlice } from './analytics/analyticsSlice.js';
import { createTelemetrySlice, TELEMETRY_DEFAULTS } from './analytics/telemetrySlice.js';

const MAX_SESSIONS = 200;

const useAnalyticsStore = create(
  safePersist(
    (...a) => ({
      ...createAnalyticsSlice(...a),
      ...createTelemetrySlice(...a),
    }),
    {
      name: 'charEdge-analytics',
      version: 1,
      defaults: TELEMETRY_DEFAULTS,
      partialize: (state) => ({
        events: state.events?.slice?.(-1000) || [],
        pageViews: state.pageViews || {},
        featureUsage: state.featureUsage || {},
        clickMap: state.clickMap || {},
        workflows: state.workflows || {},
        sessions: state.sessions?.slice?.(-MAX_SESSIONS) || [],
        kpis: state.kpis || TELEMETRY_DEFAULTS.kpis,
      }),
      migrate: (persisted, version) => {
        // Migrate from old tf-telemetry key on first load
        if (version === 0 || !persisted) {
          try {
            const raw = localStorage.getItem('tf-telemetry');
            if (raw) {
              const old = JSON.parse(raw);
              const oldState = old?.state || old;
              localStorage.removeItem('tf-telemetry');
              return { ...TELEMETRY_DEFAULTS, ...oldState };
            }
          } catch { /* ignore */ }
        }
        return persisted;
      },
    },
  ),
);

export { useAnalyticsStore };
export default useAnalyticsStore;
