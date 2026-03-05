export const createCoreSlice = (set, get) => ({
  symbol: 'BTC',
  tf: '1h',
  chartType: 'candlestick',
  scaleMode: 'linear',
  logScale: false,

  setSymbol: (symbol) => set({ symbol: symbol.toUpperCase() }),
  setTf: (tf) => set({ tf }),
  setChartType: (chartType) => set({ chartType }),
  setScaleMode: (mode) => set({ scaleMode: mode, logScale: mode === 'log' }),

  setCandleMode: (mode) => {
    const map = { standard: 'candlestick', hollow: 'hollow', heikinashi: 'heikinashi', footprint: 'footprint' };
    set({ chartType: map[mode] || 'candlestick' });
  },
  toggleLogScale: () => {
    const newLog = !get().logScale;
    set({ logScale: newLog, scaleMode: newLog ? 'log' : 'linear' });
  },

  // Sprint 14: Smart timeframe — auto-detect from usage data
  // Note: returns tf synchronously from the in-memory telemetry store
  getSmartTimeframe: () => {
    try {
      // Access telemetry store if it's been loaded (global reference)
      const telemetryState = window.__charEdge_telemetry_state__;
      if (!telemetryState) return get().tf;
      const featureUsage = telemetryState.featureUsage || {};
      const tfKeys = Object.keys(featureUsage).filter((k) => k.startsWith('tf_'));
      if (tfKeys.length === 0) return get().tf;
      tfKeys.sort((a, b) => (featureUsage[b] || 0) - (featureUsage[a] || 0));
      return tfKeys[0].replace('tf_', '') || get().tf;
    } catch (_) {
      return get().tf;
    }
  },
});
