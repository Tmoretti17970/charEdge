// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Core Store (Sprint 5)
//
// Focused store for core chart state: symbol, timeframe, chart type,
// scale mode, and data metadata (bar count, wsStatus, pagination).
// These are the most performance-critical selectors — they must NOT
// re-evaluate when indicators, drawings, or trade state change.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

import { createCoreSlice } from './coreSlice';
import { createDataSlice } from './dataSlice';

const useChartCoreStore = create((...a: Parameters<Parameters<typeof create>[0]>) => ({
  ...createCoreSlice(...a),
  ...createDataSlice(...a),
}));

export { useChartCoreStore };
export default useChartCoreStore;
