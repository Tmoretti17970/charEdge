// ═══════════════════════════════════════════════════════════════════
// charEdge — Data Slice (Sprint 3: Lightweight Metadata Only)
//
// Historical bars are NOT stored in Zustand.  The ChartEngine receives
// them directly via TickChannel, and DatafeedService owns the canonical
// copy.  This slice only holds metadata that React components need
// for rendering (bar count, timestamps, source label, etc.).
// ═══════════════════════════════════════════════════════════════════

import { warnIfNonCanonicalChartDataWrite } from './dataAuthorityGuard';

export const createDataSlice = (set, get) => ({
  // ── Bar metadata (no array — engine / DatafeedService own the data) ──
  barCount: 0,
  source: null,
  loading: false,
  wsStatus: 'disconnected',

  // ── Pagination state ──────────────────────────────────────────
  historyLoading: false,     // True while fetching older bars
  historyExhausted: false,   // True when no more history is available
  oldestTime: null,          // Timestamp of the oldest bar (for pagination cursor)

  // Aggregated price data from TickerPlant
  aggregatedPrice: null,     // Latest aggregated price
  confidence: null,          // 'high' | 'medium' | 'low' | 'stale' | null
  sourceCount: 0,            // Number of active sources contributing
  priceSpread: 0,            // Price spread across sources
  priceSources: [],          // Source IDs used for current price

  /**
   * Sprint 3: Replace the old setData() which stored the entire bars array.
   * Now only stores lightweight metadata. The actual bars live in
   * DatafeedService.cache and are delivered to ChartEngine via TickChannel.
   */
  setDataMeta: (barCount, source, oldestTime = null) => {
    set({ barCount, source, loading: false, oldestTime, historyExhausted: false });
  },

  // Legacy compat: setData still works but only extracts metadata
  setData: (data, source) => {
    warnIfNonCanonicalChartDataWrite(source);
    const barCount = data?.length ?? 0;
    const oldestTime = data?.[0]?.time ?? null;
    set({ barCount, source, loading: false, oldestTime, historyExhausted: false });
  },

  setLoading: (loading) => set({ loading }),
  setWsStatus: (wsStatus) => set({ wsStatus }),
  setHistoryLoading: (historyLoading) => set({ historyLoading }),

  /**
   * Prepend older bars.  Delegates to DatafeedService for actual bar storage.
   * Only updates metadata (bar count, oldest time) in Zustand.
   */
  prependData: (olderBars, currentBarCount) => {
    if (!olderBars || olderBars.length === 0) {
      set({ historyLoading: false, historyExhausted: true });
      return;
    }
    // Actual bar merging is handled by DatafeedService.prependBars()
    // We just track the metadata change
    const newCount = (currentBarCount || get().barCount || 0) + olderBars.length;
    set({
      barCount: newCount,
      oldestTime: olderBars[0]?.time ?? get().oldestTime,
      historyLoading: false,
      lastPrependCount: olderBars.length, // Sprint 8: viewport offset preservation
    });
  },

  setAggregatedData: (aggData) => set({
    aggregatedPrice: aggData?.price ?? null,
    confidence: aggData?.confidence ?? null,
    sourceCount: aggData?.sourceCount ?? 0,
    priceSpread: aggData?.spread ?? 0,
    priceSources: aggData?.sourcesUsed ?? [],
  }),
});
