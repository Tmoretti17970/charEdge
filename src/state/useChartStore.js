// ═══════════════════════════════════════════════════════════════════
// charEdge v11 — Chart Store (Zustand)
// Updated for Sprint 1-5 chart engine integration.
// Refactored into specialized slices for better maintainability.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

import { createCoreSlice } from './chart/coreSlice.js';
import { createDataSlice } from './chart/dataSlice.js';
import { createIndicatorSlice } from './chart/indicatorSlice.js';
import { createDrawingSlice } from './chart/drawingSlice.js';
import { createUISlice } from './chart/uiSlice.js';
import { createFeaturesSlice } from './chart/featuresSlice.js';
import { createTemplateSlice } from './chart/templateSlice.js';
import { createTradeSlice } from './chart/tradeSlice.js';
import { createAnnotationSlice } from './chart/annotationSlice.js';

const useChartStore = create((...a) => ({
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

export { useChartStore };
export default useChartStore;
