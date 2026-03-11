// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Features Store (Sprint 5)
//
// Focused store for feature flags and chart UI state: overlays,
// appearance, layout, replay, intelligence toggles, etc.
// Changes here (toggling heatmap, sessions, etc.) do NOT trigger
// re-evaluation of core, indicator, or trade selectors.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

import { createFeaturesSlice } from './featuresSlice';
import { createUISlice } from './uiSlice';

const useChartFeaturesStore = create((...a: Parameters<Parameters<typeof create>[0]>) => ({
  ...createFeaturesSlice(...a),
  ...createUISlice(...a),
}));

export { useChartFeaturesStore };
export default useChartFeaturesStore;
