// ═══════════════════════════════════════════════════════════════════
// charEdge — useChartStore (Backward-Compatible Bridge)
//
// Sprint 5: The monolithic mega-store has been split into 4 focused
// stores for better performance and isolation:
//
//   useChartCoreStore     — symbol, tf, chartType, scale, data metadata
//   useChartToolsStore    — indicators, drawings, templates, annotations
//   useChartFeaturesStore — feature flags, overlays, appearance, replay
//   useChartTradeStore    — chart-based trade entry workflow
//
// This file keeps the combined store for backward compatibility.
// Cross-slice get() calls (e.g. templateSlice reading indicators,
// tradeSlice reading symbol) only work through this combined store.
//
// Migration path: import from the specific store for new code.
// After all ~170 selectors are migrated, this bridge can be deleted.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

import { createCoreSlice } from './chart/coreSlice';
import { createDataSlice } from './chart/dataSlice';
import { createIndicatorSlice } from './chart/indicatorSlice';
import { createDrawingSlice } from './chart/drawingSlice';
import { createUISlice } from './chart/uiSlice';
import { createFeaturesSlice } from './chart/featuresSlice';
import { createTemplateSlice } from './chart/templateSlice';
import { createTradeSlice } from './chart/tradeSlice';
import { createAnnotationSlice } from './chart/annotationSlice';

// ─── Combined store (backward compatibility) ────────────────────
// All 9 slices merged — any set() in any slice causes all selectors
// on this store to re-evaluate. Use the focused stores above for
// new code to avoid this.
const useChartStore = create((...a: Parameters<Parameters<typeof create>[0]>) => ({
    ...createCoreSlice(...a),
    ...createDataSlice(...a),
    ...createIndicatorSlice(...a),
    ...createDrawingSlice(...a),
    ...createUISlice(...a),
    ...createFeaturesSlice(...a),
    ...createTemplateSlice(...a),
    ...createTradeSlice(...a),
    ...createAnnotationSlice(...a),
}));

// Re-export focused stores for gradual migration
export { useChartCoreStore } from './chart/useChartCoreStore';
export { useChartToolsStore } from './chart/useChartToolsStore';
export { useChartFeaturesStore } from './chart/useChartFeaturesStore';
export { useChartTradeStore } from './chart/useChartTradeStore';

export { useChartStore };
export default useChartStore;
