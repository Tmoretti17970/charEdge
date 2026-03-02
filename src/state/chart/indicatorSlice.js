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
});
