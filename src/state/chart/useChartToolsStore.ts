// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Tools Store (Sprint 5)
//
// Focused store for chart tools: indicators, drawings, templates,
// and annotations. Changes to these do NOT trigger re-evaluation
// of core/data/features selectors.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

import { createIndicatorSlice } from './indicatorSlice';
import { createDrawingSlice } from './drawingSlice';
import { createTemplateSlice } from './templateSlice';
import { createAnnotationSlice } from './annotationSlice';

const useChartToolsStore = create((...a: Parameters<Parameters<typeof create>[0]>) => ({
  ...createIndicatorSlice(...a),
  ...createDrawingSlice(...a),
  ...createTemplateSlice(...a),
  ...createAnnotationSlice(...a),
}));

export { useChartToolsStore };
export default useChartToolsStore;
