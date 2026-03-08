// ═══════════════════════════════════════════════════════════════════
// charEdge — Indicator Slice (Zustand)
// Manages indicator state: add/remove/update/toggle/template/reorder.
// Batch 14: Extended with outputStyles, visibility, precision,
// showOnScale, showInStatusLine, source for full settings support.
// ═══════════════════════════════════════════════════════════════════

import { INDICATORS as INDICATOR_REGISTRY } from '../../charting_library/studies/indicators/registry.js';

// ─── Helpers ────────────────────────────────────────────────────

/** Initialize outputStyles from registry defaults if missing */
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

/** Normalize indicator ensuring all new fields are present */
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

// ─── Slice ──────────────────────────────────────────────────────

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

  // ─── Output Styles (Batch 14) ─────────────────────────────────

  updateIndicatorOutputStyle: (idx, outputKey, updates) =>
    set((s) => ({
      indicators: s.indicators.map((ind, i) => {
        if (i !== idx) return ind;
        const outputStyles = { ...(ind.outputStyles || initOutputStyles(ind.indicatorId)) };
        outputStyles[outputKey] = { ...(outputStyles[outputKey] || {}), ...updates };
        return { ...ind, outputStyles };
      }),
    })),

  // ─── Visibility per Timeframe (Batch 14) ──────────────────────

  setIndicatorVisibility: (idx, visibility) =>
    set((s) => ({
      indicators: s.indicators.map((ind, i) =>
        i === idx ? { ...ind, visibility: { ...(ind.visibility || { timeframes: [], showAll: true }), ...visibility } } : ind
      ),
    })),

  // ─── Precision (Batch 14) ─────────────────────────────────────

  setIndicatorPrecision: (idx, precision) =>
    set((s) => ({
      indicators: s.indicators.map((ind, i) =>
        i === idx ? { ...ind, precision } : ind
      ),
    })),

  // ─── Source (Batch 14) ────────────────────────────────────────

  setIndicatorSource: (idx, source) =>
    set((s) => ({
      indicators: s.indicators.map((ind, i) =>
        i === idx ? { ...ind, source } : ind
      ),
    })),

  // ─── Show on Scale / Status Line (Batch 14) ──────────────────

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

  // ─── Template persistence via localStorage ────────────────────

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

  // Strategy Item #13: Update pane band values/colors (editable RSI 70/30, MACD zero-line, etc.)
  updateIndicatorBands: (idx, bandIdx, updates) =>
    set((s) => ({
      indicators: s.indicators.map((ind, i) => {
        if (i !== idx) return ind;
        const bands = [...(ind.bandOverrides || [])];
        bands[bandIdx] = { ...(bands[bandIdx] || {}), ...updates };
        return { ...ind, bandOverrides: bands };
      }),
    })),

  // ─── Strategy Item #11: Overrides API ─────────────────────────
  // Apply a single override via dot-notation path (e.g. 'params.period', 'outputStyles.line.color')
  applyOverride: (idx, path, value) =>
    set((s) => ({
      indicators: s.indicators.map((ind, i) => {
        if (i !== idx) return ind;
        return _deepSet({ ...ind }, path, value);
      }),
    })),

  // Batch overrides: { 'params.period': 20, 'outputStyles.line.color': '#FF0' }
  applyOverrides: (idx, overrides) =>
    set((s) => ({
      indicators: s.indicators.map((ind, i) => {
        if (i !== idx) return ind;
        let updated = { ...ind };
        for (const [path, value] of Object.entries(overrides)) {
          updated = _deepSet(updated, path, value);
        }
        return updated;
      }),
    })),

  // Delete a saved indicator template
  deleteIndicatorTemplate: (indicatorId, name) => {
    const key = `indTemplate:${indicatorId}`;
    const existing = JSON.parse(localStorage.getItem(key) || '{}');
    delete existing[name];
    localStorage.setItem(key, JSON.stringify(existing));
  },
});

// ─── Deep Set Helper ────────────────────────────────────────────
// Immutably sets a value at a dot-notation path.
// e.g. _deepSet(obj, 'a.b.c', 42) → { ...obj, a: { ...obj.a, b: { ...obj.a.b, c: 42 } } }
function _deepSet(obj, path, value) {
  const parts = path.split('.');
  if (parts.length === 1) {
    return { ...obj, [parts[0]]: value };
  }
  const [head, ...rest] = parts;
  return {
    ...obj,
    [head]: _deepSet(obj[head] || {}, rest.join('.'), value),
  };
}
