// ═══════════════════════════════════════════════════════════════════
// charEdge — Panel Slice
// Extracted from usePanelStore for useLayoutStore consolidation.
// ═══════════════════════════════════════════════════════════════════

const PANEL_REGISTRY = {
  watchlist: { title: 'Watchlist', defaultWidth: 340, minWidth: 280 },
  alerts: { title: 'Notifications', defaultWidth: 340, minWidth: 280 },
  scripts: { title: 'Script Editor', defaultWidth: 600, minWidth: 400 },
  insights: { title: 'AI Insights', defaultWidth: 340, minWidth: 280 },
  settings: { title: 'Chart Settings', defaultWidth: 340, minWidth: 280 },
  hotkeys: { title: 'Keyboard Shortcuts', defaultWidth: 400, minWidth: 320 },
  annotations: { title: 'Chart Annotations', defaultWidth: 340, minWidth: 280 },
  orderflow: { title: 'Order Flow', defaultWidth: 380, minWidth: 300 },
  derivatives: { title: 'Derivatives', defaultWidth: 420, minWidth: 340 },
  depth: { title: 'Order Book', defaultWidth: 340, minWidth: 280 },
  institutional: { title: 'Institutional Data', defaultWidth: 380, minWidth: 300 },
  options: { title: 'Options Intel', defaultWidth: 400, minWidth: 320 },
  community: { title: 'Community Signals', defaultWidth: 360, minWidth: 300 },
  positionSizer: { title: 'Position Sizer', defaultWidth: 300, minWidth: 260 },
  quickJournal: { title: 'Quick Journal', defaultWidth: 300, minWidth: 260 },
  indicators: { title: 'Indicators', defaultWidth: 360, minWidth: 300 },
  objectTree: { title: 'Object Tree', defaultWidth: 300, minWidth: 240 },
  alertHistory: { title: 'Alert History', defaultWidth: 380, minWidth: 300 },
  alertAnalytics: { title: 'Alert Analytics', defaultWidth: 400, minWidth: 320 },
  copilot: { title: 'AI Copilot', defaultWidth: 380, minWidth: 300 },
  stockInfo: { title: 'Stock Info', defaultWidth: 360, minWidth: 280 },
  technicalScanner: { title: 'Technical Scanner', defaultWidth: 420, minWidth: 340 },
  confluenceView: { title: 'Confluence View', defaultWidth: 400, minWidth: 320 },
};

export const createPanelSlice = (set, get) => ({
  // ─── Panel State ──────────────────────────────────────────────
  activePanel: null,
  panelWidths: {},
  history: [],

  // ─── Panel Actions ────────────────────────────────────────────
  openPanel: (panelId) => {
    const current = get().activePanel;
    set({
      activePanel: panelId,
      history: current ? [...get().history.slice(-9), current] : get().history,
    });
  },

  closePanel: () => set({ activePanel: null }),

  togglePanel: (panelId) => {
    const current = get().activePanel;
    if (current === panelId) {
      set({ activePanel: null });
    } else {
      get().openPanel(panelId);
    }
  },

  panelBack: () => {
    const history = get().history;
    if (history.length > 0) {
      const prev = history[history.length - 1];
      set({ activePanel: prev, history: history.slice(0, -1) });
    } else {
      set({ activePanel: null });
    }
  },

  setPanelWidth: (panelId, width) =>
    set((s) => ({
      panelWidths: { ...s.panelWidths, [panelId]: width },
    })),

  getPanelInfo: (panelId) => PANEL_REGISTRY[panelId] || { title: panelId, defaultWidth: 340, minWidth: 280 },

  getPanelWidth: (panelId) => {
    const custom = get().panelWidths[panelId];
    const info = PANEL_REGISTRY[panelId];
    return custom || info?.defaultWidth || 340;
  },

  isPanelOpen: (panelId) => get().activePanel === panelId,
});

export { PANEL_REGISTRY };
