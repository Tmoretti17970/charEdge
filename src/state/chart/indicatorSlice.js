// ═══════════════════════════════════════════════════════════════════
// charEdge — Indicator Slice (Zustand) — JS Mirror
// Kept in sync with indicatorSlice.ts for legacy consumers.
// ═══════════════════════════════════════════════════════════════════

import { INDICATORS as INDICATOR_REGISTRY } from '../../charting_library/studies/indicators/registry.js';

function initOutputStyles(indicatorId) {
  const def = INDICATOR_REGISTRY?.[indicatorId];
  if (!def?.outputs) return {};
  const styles = {};
  for (const out of def.outputs) {
    styles[out.key] = {
      color: out.color || '#2962FF',
      width: out.width ?? 2,
      dash: out.dash || [],
      visible: true,
    };
  }
  return styles;
}

function normalizeIndicator(ind) {
  return {
    indicatorId: ind.indicatorId || ind.type,
    params: ind.params || {},
    color: ind.color,
    visible: ind.visible !== false,
    pane: ind.pane ?? undefined,
    outputStyles: ind.outputStyles || initOutputStyles(ind.indicatorId || ind.type),
    visibility: ind.visibility || { timeframes: [], showAll: true },
    precision: ind.precision ?? 'auto',
    showOnScale: ind.showOnScale !== false,
    showInStatusLine: ind.showInStatusLine !== false,
    source: ind.source || 'close',
  };
}

export const createIndicatorSlice = (set) => ({
  indicators: [
    { indicatorId: 'sma', params: { period: 20 }, color: '#f59e0b', visible: true },
    { indicatorId: 'ema', params: { period: 50 }, color: '#a855f7', visible: true },
  ],

  addIndicator: (ind) => {
    set((s) => ({ indicators: [...s.indicators, normalizeIndicator(ind)] }));
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

  updateIndicatorOutputStyle: (idx, outputKey, updates) =>
    set((s) => ({
      indicators: s.indicators.map((ind, i) => {
        if (i !== idx) return ind;
        const outputStyles = { ...(ind.outputStyles || initOutputStyles(ind.indicatorId)) };
        outputStyles[outputKey] = { ...(outputStyles[outputKey] || {}), ...updates };
        return { ...ind, outputStyles };
      }),
    })),

  setIndicatorVisibility: (idx, visibility) =>
    set((s) => ({
      indicators: s.indicators.map((ind, i) =>
        i === idx ? { ...ind, visibility: { ...(ind.visibility || { timeframes: [], showAll: true }), ...visibility } } : ind
      ),
    })),

  setIndicatorPrecision: (idx, precision) =>
    set((s) => ({
      indicators: s.indicators.map((ind, i) =>
        i === idx ? { ...ind, precision } : ind
      ),
    })),

  setIndicatorSource: (idx, source) =>
    set((s) => ({
      indicators: s.indicators.map((ind, i) =>
        i === idx ? { ...ind, source } : ind
      ),
    })),

  setIndicatorShowOnScale: (idx, showOnScale) =>
    set((s) => ({
      indicators: s.indicators.map((ind, i) =>
        i === idx ? { ...ind, showOnScale } : ind
      ),
    })),

  setIndicatorShowInStatusLine: (idx, showInStatusLine) =>
    set((s) => ({
      indicators: s.indicators.map((ind, i) =>
        i === idx ? { ...ind, showInStatusLine } : ind
      ),
    })),

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

  moveIndicatorToPane: (idx, targetPane) =>
    set((s) => ({
      indicators: s.indicators.map((ind, i) =>
        i === idx ? { ...ind, pane: targetPane } : ind
      ),
    })),

  reorderIndicators: (fromIdx, toIdx) =>
    set((s) => {
      const list = [...s.indicators];
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      return { indicators: list };
    }),
});
