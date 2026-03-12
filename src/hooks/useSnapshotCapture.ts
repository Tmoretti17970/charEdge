// ═══════════════════════════════════════════════════════════════════
// charEdge — useSnapshotCapture (Task 5.6.2)
//
// Captures the current chart state and returns a TradeSnapshot.
// Called synchronously at trade execution time — all values are
// already in memory on useChartStore.
//
// Usage:
//   const capture = useSnapshotCapture();
//   const snapshot = capture(); // returns TradeSnapshot
// ═══════════════════════════════════════════════════════════════════

import { useCallback } from 'react';
import { useChartCoreStore } from '../state/chart/useChartCoreStore';
import { useChartToolsStore } from '../state/chart/useChartToolsStore';
import { createSnapshot, indicatorKey } from '../types/TradeSnapshot.js';
import type { TradeSnapshot, TradeContext } from '../types/TradeSnapshot.js';

// ─── Standalone capture (non-hook, for use in store actions) ─────

/**
 * Capture a TradeSnapshot from the current chart store state.
 * This is a pure read — no mutations, no side effects.
 * Can be called from store actions (outside React).
 */
export function captureSnapshotFromStore(): TradeSnapshot {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state = useChartCoreStore.getState() as any;

  // Build indicator values map
  const indicators: Record<string, number | null> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeIndicators: any[] = state.indicators || [];

  for (const ind of activeIndicators) {
    if (ind.visible === false) continue;
    const key = indicatorKey(ind);
    // Indicator values are computed by IndicatorChainEngine and stored
    // on the indicator object or in a separate computed cache.
    indicators[key] = ind._lastValue ?? null;
  }

  // Get latest bar from data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bars: any[] = state.data || [];
  const latestBar = bars.length > 0 ? bars[bars.length - 1] : undefined;
  const currentBar = latestBar
    ? {
        o: latestBar.open ?? latestBar.o ?? 0,
        h: latestBar.high ?? latestBar.h ?? 0,
        l: latestBar.low ?? latestBar.l ?? 0,
        c: latestBar.close ?? latestBar.c ?? 0,
        v: latestBar.volume ?? latestBar.v ?? 0,
        t: latestBar.time ?? latestBar.t ?? 0,
      }
    : undefined;

  // Price: prefer aggregated price, fall back to latest close
  const price: number = state.aggregatedPrice ?? currentBar?.c ?? 0;

  return createSnapshot({
    symbol: state.symbol || 'UNKNOWN',
    timeframe: state.tf || '1h',
    price,
    indicators,
    currentBar,
    volumeBar: currentBar?.v,
  });
}

/**
 * Build a full TradeContext from current chart state + trade levels.
 */
export function captureTradeContext(trade?: { stopLoss?: number | null; takeProfit?: number | null }): TradeContext {
  return {
    snapshot: captureSnapshotFromStore(),
    originalStopLoss: trade?.stopLoss ?? null,
    originalTakeProfit: trade?.takeProfit ?? null,
  };
}

// ─── React Hook ──────────────────────────────────────────────────

/**
 * React hook for snapshot capture. Returns a stable callback.
 * Prefer `captureSnapshotFromStore()` for non-React contexts.
 */
export function useSnapshotCapture() {
  return useCallback(() => captureSnapshotFromStore(), []);
}

export default useSnapshotCapture;
