// ═══════════════════════════════════════════════════════════════════
// charEdge — Indicator Slice (Zustand)
// Manages indicator state: add/remove/update/toggle/template/reorder.
// Sprint 4: All operations use stable IDs (not array indices).
// Batch 14: Extended with outputStyles, visibility, precision,
// showOnScale, showInStatusLine, source for full settings support.
// ═══════════════════════════════════════════════════════════════════

import { INDICATORS as INDICATOR_REGISTRY } from '../../charting_library/studies/indicators/registry.js';

// ─── Helpers ────────────────────────────────────────────────────

let _idCounter = 0;
/** Generate a stable unique ID for each indicator instance */
function genId() {
  return `ind_${Date.now().toString(36)}_${(++_idCounter).toString(36)}`;
}

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
    id: ind.id || genId(),
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
  indicators: [],

  addIndicator: (ind) => {
    set((s) => ({ indicators: [...s.indicators, normalizeIndicator(ind)] }));
  },

  // Sprint 4: All ops now accept an `id` string instead of array index
  removeIndicator: (id) => set((s) => ({ indicators: s.indicators.filter((ind) => ind.id !== id) })),

  updateIndicator: (id, updates) =>
    set((s) => ({
      indicators: s.indicators.map((ind) => (ind.id === id ? { ...ind, ...updates } : ind)),
    })),

  toggleIndicatorVisibility: (id) =>
    set((s) => ({
      indicators: s.indicators.map((ind) => (ind.id === id ? { ...ind, visible: !ind.visible } : ind)),
    })),

  setIndicators: (indicators) => set({ indicators: (indicators || []).map(normalizeIndicator) }),

  // ─── Output Styles (Batch 14) ─────────────────────────────────

  updateIndicatorOutputStyle: (id, outputKey, updates) =>
    set((s) => ({
      indicators: s.indicators.map((ind) => {
        if (ind.id !== id) return ind;
        const outputStyles = { ...(ind.outputStyles || initOutputStyles(ind.indicatorId)) };
        outputStyles[outputKey] = { ...(outputStyles[outputKey] || {}), ...updates };
        return { ...ind, outputStyles };
      }),
    })),

  // ─── Visibility per Timeframe (Batch 14) ──────────────────────

  setIndicatorVisibility: (id, visibility) =>
    set((s) => ({
      indicators: s.indicators.map((ind) =>
        ind.id === id ? { ...ind, visibility: { ...(ind.visibility || { timeframes: [], showAll: true }), ...visibility } } : ind
      ),
    })),

  // ─── Precision (Batch 14) ─────────────────────────────────────

  setIndicatorPrecision: (id, precision) =>
    set((s) => ({
      indicators: s.indicators.map((ind) =>
        ind.id === id ? { ...ind, precision } : ind
      ),
    })),

  // ─── Source (Batch 14) ────────────────────────────────────────

  setIndicatorSource: (id, source) =>
    set((s) => ({
      indicators: s.indicators.map((ind) =>
        ind.id === id ? { ...ind, source } : ind
      ),
    })),

  // ─── Show on Scale / Status Line (Batch 14) ──────────────────

  setIndicatorShowOnScale: (id, showOnScale) =>
    set((s) => ({
      indicators: s.indicators.map((ind) =>
        ind.id === id ? { ...ind, showOnScale } : ind
      ),
    })),

  setIndicatorShowInStatusLine: (id, showInStatusLine) =>
    set((s) => ({
      indicators: s.indicators.map((ind) =>
        ind.id === id ? { ...ind, showInStatusLine } : ind
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
  moveIndicatorToPane: (id, targetPane) =>
    set((s) => ({
      indicators: s.indicators.map((ind) =>
        ind.id === id ? { ...ind, pane: targetPane } : ind
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
  updateIndicatorBands: (id, bandIdx, updates) =>
    set((s) => ({
      indicators: s.indicators.map((ind) => {
        if (ind.id !== id) return ind;
        const bands = [...(ind.bandOverrides || [])];
        bands[bandIdx] = { ...(bands[bandIdx] || {}), ...updates };
        return { ...ind, bandOverrides: bands };
      }),
    })),

  // ─── Strategy Item #11: Overrides API ─────────────────────────
  // Apply a single override via dot-notation path (e.g. 'params.period', 'outputStyles.line.color')
  applyOverride: (id, path, value) =>
    set((s) => ({
      indicators: s.indicators.map((ind) => {
        if (ind.id !== id) return ind;
        return _deepSet({ ...ind }, path, value);
      }),
    })),

  // Batch overrides: { 'params.period': 20, 'outputStyles.line.color': '#FF0' }
  applyOverrides: (id, overrides) =>
    set((s) => ({
      indicators: s.indicators.map((ind) => {
        if (ind.id !== id) return ind;
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
// eslint-disable-next-line @typescript-eslint/naming-convention
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
