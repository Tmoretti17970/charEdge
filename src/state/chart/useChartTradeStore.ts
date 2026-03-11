// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Trade Store (Sprint 5)
//
// Focused store for the chart-based trade entry workflow: pending
// levels, risk parameters, position sizing, and trade submission.
//
// NOTE: submitChartTrade() reads `symbol` via get() — this only
// works correctly when used through the combined `useChartStore`
// bridge. When using this store directly, pass `symbol` explicitly
// or read it from useChartCoreStore.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

import { createTradeSlice } from './tradeSlice';

const useChartTradeStore = create((...a: Parameters<Parameters<typeof create>[0]>) => ({
  ...createTradeSlice(...a),
}));

export { useChartTradeStore };
export default useChartTradeStore;
