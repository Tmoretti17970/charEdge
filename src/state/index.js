// ═══════════════════════════════════════════════════════════════════
// charEdge — State Barrel Export
// Central re-export of all Zustand stores for cleaner imports.
//
// Usage: import { useChartStore, useUserStore } from '../state';
//
// Phase 1: All deprecated shim re-exports and backward-compat aliases removed.
// ═══════════════════════════════════════════════════════════════════

// ─── Stores ─────────────────────────────────────────────────────
export { useAlertStore, checkSymbolAlerts, requestNotificationPermission } from './useAlertStore.js';
export { useAnalyticsStore } from './useAnalyticsStore.js';
export { useAnnotationStore } from './useAnnotationStore.js';
export { useBacktestStore } from './useBacktestStore.js';
export { useBriefingStore } from './useBriefingStore.js';
export { useChartStore } from './useChartStore.js';
export { useChecklistStore } from './useChecklistStore.js';
export { useDailyGuardStore } from './useDailyGuardStore.js';
export { useFocusStore } from './useFocusStore.js';
export { useGamificationStore } from './useGamificationStore.js';
export { useJournalStore } from './useJournalStore.js';
export { useLayoutStore } from './useLayoutStore.js';
export { useNotificationLog } from './useNotificationLog.js';
export { useNotificationStore } from './useNotificationStore.js';
export { usePaperTradeStore } from './usePaperTradeStore.js';
export { usePropFirmStore } from './usePropFirmStore.js';
export { useRuleEngine } from './useRuleEngine.js';
export { useScriptStore } from './useScriptStore.js';
export { useSignalStore } from './useSignalStore.js';
export { useSocialStore } from './useSocialStore.js';
export { useSyncStore } from './useSyncStore.js';
export { useTemplateStore } from './useTemplateStore.js';
export { useTradeTemplateStore } from './useTradeTemplateStore.js';
export { useUIStore } from './useUIStore.js';
export { useUserStore } from './useUserStore.js';
export { useWatchlistStore } from './useWatchlistStore.js';
export { useWorkspaceStore } from './useWorkspaceStore.js';
export { useAICoachStore } from './useAICoachStore.js';
export { usePanelStore } from './usePanelStore.js';

// ─── Named constant re-exports from slices ─────────────────────
export { TIERS, TIER_CONFIG, FEATURE_TIERS } from './user/personaSlice.js';
export { ACCENT_PRESETS, CHART_COLOR_PRESETS } from './user/themeSlice.js';
export { DENSITY_MODES, DENSITY_CONFIG } from './user/densitySlice.js';
export { SESSION_STATES } from './journal/sessionSlice.js';
export { MOCK_TOURNAMENTS } from './gamification/tournamentSlice.js';
export { GOAL_DEFAULTS } from './gamification/goalSlice.js';
export { calcRiskReward, calcPositionSize } from './chart/tradeSlice.js';
export { DEFAULT_CARDS } from './layout/bentoSlice.js';
export { DISCOVER_PRESETS, DISCOVER_PRESETS as PRESETS } from './layout/discoverLayoutSlice.js';
export { DEFAULT_TTL, STALE_TTL } from './data/discoverCacheSlice.js';
export { computeKPIs, TELEMETRY_DEFAULTS } from './analytics/telemetrySlice.js';
