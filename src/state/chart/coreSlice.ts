import { useAnalyticsStore } from '../useAnalyticsStore';

export const createCoreSlice = (set, get) => ({
  symbol: 'BTC',
  tf: '1h',
  chartType: 'candlestick',
  scaleMode: 'linear',
  logScale: false,
  activeTimezone: 'UTC',

  setSymbol: (symbol) => set({ symbol: symbol.toUpperCase() }),
  setTf: (tf) => set({ tf }),
  setChartType: (chartType) => set({ chartType }),
  setScaleMode: (mode) => set({ scaleMode: mode, logScale: mode === 'log' }),
  setActiveTimezone: (tz) => set({ activeTimezone: tz }),

  setCandleMode: (mode) => {
    const map = { standard: 'candlestick', hollow: 'hollow', heikinashi: 'heikinashi', footprint: 'footprint' };
    set({ chartType: map[mode] || 'candlestick' });
  },
  toggleLogScale: () => {
    const newLog = !get().logScale;
    set({ logScale: newLog, scaleMode: newLog ? 'log' : 'linear' });
  },

  // Sprint 14: Smart timeframe — auto-detect from usage data
  // Reads feature usage from the analytics store (replaces window.__charEdge_telemetry_state__)
  getSmartTimeframe: () => {
    try {
      const analyticsState = useAnalyticsStore.getState();
      const featureUsage = analyticsState.featureUsage || {};
      const tfKeys = Object.keys(featureUsage).filter((k) => k.startsWith('tf_'));
      if (tfKeys.length === 0) return get().tf;
      tfKeys.sort((a, b) => (featureUsage[b] || 0) - (featureUsage[a] || 0));
      return tfKeys[0].replace('tf_', '') || get().tf;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      return get().tf;
    }
  },
});

