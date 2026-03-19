// ═══════════════════════════════════════════════════════════════════
// charEdge — Import History Store (Phase 6 Sprint 6.1)
//
// Tracks every import batch with metadata for rollback support.
// Persisted via IndexedDB (UnifiedDB).
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

const STORE_KEY = 'charEdge_import_history';

function generateBatchId() {
  return `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const useImportHistoryStore = create((set, get) => ({
  batches: [],
  loaded: false,

  // ─── Load from localStorage ───────────────────────────────────
  load: () => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      set({ batches: raw ? JSON.parse(raw) : [], loaded: true });
    } catch {
      set({ batches: [], loaded: true });
    }
  },

  // ─── Persist to localStorage ─────────────────────────────────
  _persist: () => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(get().batches));
    } catch (e) {
      console.warn('[ImportHistory] persist failed:', e);
    }
  },

  // ─── Add a new import batch ──────────────────────────────────
  addBatch: (metadata) => {
    const batch = {
      id: generateBatchId(),
      timestamp: Date.now(),
      broker: metadata.broker || 'unknown',
      brokerLabel: metadata.brokerLabel || metadata.broker || 'Unknown',
      fileName: metadata.fileName || 'unknown',
      format: metadata.format || 'csv',
      tradeCount: metadata.tradeCount || 0,
      duplicatesSkipped: metadata.duplicatesSkipped || 0,
      errors: metadata.errors || 0,
      totalPnl: metadata.totalPnl || 0,
      status: 'active',
    };

    set((s) => ({ batches: [batch, ...s.batches] }));
    get()._persist();
    return batch.id;
  },

  // ─── Mark a batch as rolled back ─────────────────────────────
  rollbackBatch: (batchId) => {
    set((s) => ({
      batches: s.batches.map((b) =>
        b.id === batchId ? { ...b, status: 'rolled_back', rolledBackAt: Date.now() } : b
      ),
    }));
    get()._persist();
  },

  // ─── Get active batches ──────────────────────────────────────
  getActiveBatches: () => get().batches.filter((b) => b.status === 'active'),

  // ─── Get stats ───────────────────────────────────────────────
  getStats: () => {
    const active = get().batches.filter((b) => b.status === 'active');
    return {
      totalImports: active.length,
      totalTrades: active.reduce((sum, b) => sum + (b.tradeCount || 0), 0),
      lastImport: active.length > 0 ? active[0].timestamp : null,
      brokers: [...new Set(active.map((b) => b.brokerLabel).filter(Boolean))],
    };
  },

  // ─── Clear all history ───────────────────────────────────────
  clearHistory: () => {
    set({ batches: [] });
    get()._persist();
  },
}));

export { useImportHistoryStore, generateBatchId };
export default useImportHistoryStore;
