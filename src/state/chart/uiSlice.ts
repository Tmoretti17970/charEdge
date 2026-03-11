// Default chart colors (TradingView dark theme)
const _DEFAULT_CHART_COLORS = {
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
} catch (_) { /* ignored */ }

// Sprint 15: Load persisted chart type config
let _savedChartTypeConfig = null;
try {
  const raw = localStorage.getItem('charEdge-chart-type-config');
  if (raw) _savedChartTypeConfig = JSON.parse(raw);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
} catch (_) { /* ignored */ }

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

  // ── Context Menu ────────────────────────────────────────────────
  contextMenu: null as { x: number; y: number; price: number; barIdx: number; date?: number } | null,
  openContextMenu: (menu: { x: number; y: number; price: number; barIdx: number; date?: number }) =>
    set({ contextMenu: menu }),
  closeContextMenu: () => set({ contextMenu: null }),

  // ── Quick Journal ───────────────────────────────────────────────
  showQuickJournal: false,
  toggleQuickJournal: () => set((s) => ({ showQuickJournal: !s.showQuickJournal })),

  // ── Trade Mode ──────────────────────────────────────────────────
  tradeMode: false,
  tradeStep: 'idle' as 'idle' | 'entry' | 'sl' | 'tp' | 'ready',
  startTradeMode: (side: 'long' | 'short' = 'long') =>
    set({ tradeMode: true, tradeSide: side, showTradePanel: true, tradeStep: 'entry' }),
  exitTradeMode: () =>
    set({ tradeMode: false, tradeStep: 'idle', showTradePanel: false }),
  setTradeStep: (step: 'idle' | 'entry' | 'sl' | 'tp' | 'ready') =>
    set({ tradeStep: step }),

  chartColors: _savedColors,

  // Sprint 15: per-chart-type user configuration (e.g., renko.boxSizeMode)
  chartTypeConfig: _savedChartTypeConfig || {},

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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_) { /* ignored */ }
      return { chartColors: merged };
    }),
  resetChartColors: () => {
    try {
      localStorage.removeItem('charEdge-chart-colors');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) { /* ignored */ }
    set({ chartColors: null });
  },

  // Sprint 15: Update config for a specific chart type
  setChartTypeConfig: (typeId, key, value) =>
    set((s) => {
      const prev = s.chartTypeConfig || {};
      const typeConf = { ...(prev[typeId] || {}), [key]: value };
      const next = { ...prev, [typeId]: typeConf };
      try {
        localStorage.setItem('charEdge-chart-type-config', JSON.stringify(next));
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_) { /* ignored */ }
      return { chartTypeConfig: next };
    }),
  resetChartTypeConfig: (typeId) =>
    set((s) => {
      const prev = { ...(s.chartTypeConfig || {}) };
      delete prev[typeId];
      try {
        localStorage.setItem('charEdge-chart-type-config', JSON.stringify(prev));
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_) { /* ignored */ }
      return { chartTypeConfig: prev };
    }),
});
