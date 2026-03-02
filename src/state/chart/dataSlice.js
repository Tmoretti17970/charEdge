export const createDataSlice = (set) => ({
  data: null,
  source: null,
  loading: false,
  wsStatus: 'disconnected',

  // Aggregated price data from TickerPlant
  aggregatedPrice: null,     // Latest aggregated price
  confidence: null,          // 'high' | 'medium' | 'low' | 'stale' | null
  sourceCount: 0,            // Number of active sources contributing
  priceSpread: 0,            // Price spread across sources
  priceSources: [],          // Source IDs used for current price

  setData: (data, source) => set({ data, source, loading: false }),
  setLoading: (loading) => set({ loading }),
  setWsStatus: (wsStatus) => set({ wsStatus }),

  setAggregatedData: (aggData) => set({
    aggregatedPrice: aggData?.price ?? null,
    confidence: aggData?.confidence ?? null,
    sourceCount: aggData?.sourceCount ?? 0,
    priceSpread: aggData?.spread ?? 0,
    priceSources: aggData?.sourcesUsed ?? [],
  }),
});
