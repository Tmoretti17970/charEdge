// Default chart colors (TradingView dark theme)
const DEFAULT_CHART_COLORS = {
  candleUp: '#26A69A',
  candleDown: '#EF5350',
  wickUp: '#26A69A',
  wickDown: '#EF5350',
  background: '#131722',
  gridColor: 'rgba(54, 58, 69, 0.3)',
  crosshair: 'rgba(149, 152, 161, 0.5)',
  volumeUp: 'rgba(38, 166, 154, 0.3)',
  volumeDown: 'rgba(239, 83, 80, 0.3)',
  priceLine: '#26A69A',
};

// Load persisted overridden colors from localStorage (if any)
let _savedColors = null;
try {
  const raw = localStorage.getItem('charEdge-chart-colors');
  if (raw) _savedColors = JSON.parse(raw);
} catch {}

export const createUISlice = (set) => ({
  layoutMode: '1x1',
  quadSymbols: ['BTC', 'ETH', 'SOL', 'BNB'],
  syncSymbol: false,
  syncTf: false,

  orderFlow: false,
  multiTfOverlay: null,
  activeGhost: null,

  showVolume: true,
  showVolumeProfile: false,

  chartColors: _savedColors,

  setLayoutMode: (mode) => set({ layoutMode: mode }),
  toggleQuadMode: () => set((s) => ({ layoutMode: s.layoutMode === '1x1' ? '2x2' : '1x1' })),
  setQuadSymbols: (syms) => set({ quadSymbols: syms }),
  toggleSyncSymbol: () => set((s) => ({ syncSymbol: !s.syncSymbol })),
  toggleSyncTf: () => set((s) => ({ syncTf: !s.syncTf })),
  toggleOrderFlow: () => set((s) => ({ orderFlow: !s.orderFlow })),

  toggleVolume: () => set((s) => ({ showVolume: !s.showVolume })),
  toggleVolumeProfile: () => set((s) => ({ showVolumeProfile: !s.showVolumeProfile })),

  setChartColors: (colors) =>
    set((s) => {
      const merged = s.chartColors ? { ...s.chartColors, ...colors } : { ...colors };
      try {
        localStorage.setItem('charEdge-chart-colors', JSON.stringify(merged));
      } catch {}
      return { chartColors: merged };
    }),
  resetChartColors: () => {
    try {
      localStorage.removeItem('charEdge-chart-colors');
    } catch {}
    set({ chartColors: null });
  },
});
