export const createIndicatorSlice = (set) => ({
  indicators: [
    { indicatorId: 'sma', params: { period: 20 }, color: '#f59e0b', visible: true },
    { indicatorId: 'ema', params: { period: 50 }, color: '#a855f7', visible: true },
  ],

  addIndicator: (ind) => {
    const normalized = {
      indicatorId: ind.indicatorId || ind.type,
      params: ind.params || {},
      color: ind.color,
      visible: ind.visible !== false,
      pane: ind.pane ?? undefined, // Task 1.4.19: Optional pane assignment
    };
    set((s) => ({ indicators: [...s.indicators, normalized] }));
  },

  removeIndicator: (idx) => set((s) => ({ indicators: s.indicators.filter((_, i) => i !== idx) })),

  updateIndicator: (idx, updates) =>
    set((s) => ({
      indicators: s.indicators.map((ind, i) => (i === idx ? { ...ind, ...updates } : ind)),
    })),

  toggleIndicatorVisibility: (idx) =>
    set((s) => ({
      indicators: s.indicators.map((ind, i) => (i === idx ? { ...ind, visible: !ind.visible } : ind)),
    })),

  setIndicators: (indicators) => set({ indicators: indicators || [] }),

  // Sprint 13: Template persistence via localStorage
  saveIndicatorTemplate: (indicatorId, name, config) => {
    const key = `indTemplate:${indicatorId}`;
    const existing = JSON.parse(localStorage.getItem(key) || '{}');
    existing[name] = config;
    localStorage.setItem(key, JSON.stringify(existing));
  },

  loadIndicatorTemplate: (indicatorId, name) => {
    const key = `indTemplate:${indicatorId}`;
    const existing = JSON.parse(localStorage.getItem(key) || '{}');
    return existing[name] || null;
  },

  listIndicatorTemplates: (indicatorId) => {
    const key = `indTemplate:${indicatorId}`;
    const existing = JSON.parse(localStorage.getItem(key) || '{}');
    return Object.keys(existing);
  },

  // Task 1.4.19: Move indicator to a different pane (drag-and-drop stacking)
  moveIndicatorToPane: (idx, targetPane) =>
    set((s) => ({
      indicators: s.indicators.map((ind, i) =>
        i === idx ? { ...ind, pane: targetPane } : ind
      ),
    })),

  // Task 1.4.19: Reorder indicators within the list (drag-and-drop reordering)
  reorderIndicators: (fromIdx, toIdx) =>
    set((s) => {
      const list = [...s.indicators];
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      return { indicators: list };
    }),
});

