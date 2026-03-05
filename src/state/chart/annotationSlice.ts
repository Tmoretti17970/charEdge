// ═══════════════════════════════════════════════════════════════════
// charEdge — Annotation Slice (Chart Store)
//
// Per-symbol note-taking tied to specific price/time on the chart.
// Persisted to localStorage.
//
// Migrated from standalone useAnnotationStore → useChartStore slice.
// ═══════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'charEdge-annotations';

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function saveToStorage(annotations) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(annotations));
  } catch (_) {
    /* quota exceeded — silent fail */
  }
}

export const createAnnotationSlice = (set, get) => ({
  // Shape: { [symbol]: [ { id, timestamp, price, text, emoji, createdAt } ] }
  annotations: loadFromStorage(),

  /**
   * Add an annotation for a symbol
   */
  addAnnotation: (symbol, { timestamp, price, text, emoji = '📌' }) => {
    const id = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const entry = { id, timestamp, price, text, emoji, createdAt: Date.now() };
    set((s) => {
      const updated = {
        ...s.annotations,
        [symbol]: [...(s.annotations[symbol] || []), entry],
      };
      saveToStorage(updated);
      return { annotations: updated };
    });
    return id;
  },

  /**
   * Remove an annotation by id for a symbol
   */
  removeAnnotation: (symbol, id) => {
    set((s) => {
      const list = (s.annotations[symbol] || []).filter((a) => a.id !== id);
      const updated = { ...s.annotations, [symbol]: list };
      saveToStorage(updated);
      return { annotations: updated };
    });
  },

  /**
   * Edit an annotation's text/emoji
   */
  editAnnotation: (symbol, id, changes) => {
    set((s) => {
      const list = (s.annotations[symbol] || []).map((a) =>
        a.id === id ? { ...a, ...changes } : a
      );
      const updated = { ...s.annotations, [symbol]: list };
      saveToStorage(updated);
      return { annotations: updated };
    });
  },

  /**
   * Get annotations for a symbol
   */
  getForSymbol: (symbol) => {
    return get().annotations[symbol] || [];
  },

  /**
   * Clear all annotations for a symbol
   */
  clearSymbol: (symbol) => {
    set((s) => {
      const updated = { ...s.annotations };
      delete updated[symbol];
      saveToStorage(updated);
      return { annotations: updated };
    });
  },
});
