export const createDataSlice = (set, get) => ({
  data: null,
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

  setData: (data, source) => {
    const oldestTime = data?.[0]?.time ?? null;
    set({ data, source, loading: false, oldestTime, historyExhausted: false });
  },
  setLoading: (loading) => set({ loading }),
  setWsStatus: (wsStatus) => set({ wsStatus }),
  setHistoryLoading: (historyLoading) => set({ historyLoading }),

  /**
   * Prepend older bars to the front of the data array.
   * Deduplicates by timestamp. Updates oldestTime cursor.
   * Sets historyExhausted if no new bars were added.
   */
  prependData: (olderBars) => {
    const { data } = get();
    if (!olderBars || olderBars.length === 0) {
      set({ historyLoading: false, historyExhausted: true });
      return;
    }
    const existingTimes = new Set((data || []).map(b => b.time));
    const unique = olderBars.filter(b => !existingTimes.has(b.time));
    if (unique.length === 0) {
      set({ historyLoading: false, historyExhausted: true });
      return;
    }
    const merged = [...unique, ...(data || [])];
    merged.sort((a, b) => {
      const ta = typeof a.time === 'string' ? new Date(a.time).getTime() : a.time;
      const tb = typeof b.time === 'string' ? new Date(b.time).getTime() : b.time;
      return ta - tb;
    });
    set({
      data: merged,
      oldestTime: merged[0]?.time ?? null,
      historyLoading: false,
      lastPrependCount: unique.length, // Sprint 8: viewport offset preservation
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
