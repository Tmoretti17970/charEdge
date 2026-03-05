// ═══════════════════════════════════════════════════════════════════
// Trade Slice — trades, playbooks, notes, trade plans
// Previously: useTradeStore.js
// ═══════════════════════════════════════════════════════════════════

import { trackFirstAction, trackWorkflow } from '../../utils/telemetry.js';

export const createTradeSlice = (set) => ({
  trades: [],
  playbooks: [],
  notes: [],
  tradePlans: [],
  loaded: false,

  // ─── Trade Actions ──────────────────────────────────────────
  addTrade: (trade) => {
    trackFirstAction('trade_logged');
    trackWorkflow('trade_logged');
    set((s) => ({ trades: [trade, ...s.trades] }));
  },

  addTrades: (newTrades) => {
    trackFirstAction('trades_imported');
    trackWorkflow('csv_imported');
    set((s) => ({ trades: [...newTrades, ...s.trades] }));
  },

  deleteTrade: (id) => set((s) => ({ trades: s.trades.filter((t) => t.id !== id) })),

  updateTrade: (id, updates) =>
    set((s) => ({
      trades: s.trades.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  // ─── Playbook Actions ───────────────────────────────────────
  addPlaybook: (pb) => set((s) => ({ playbooks: [...s.playbooks, pb] })),

  deletePlaybook: (id) => set((s) => ({ playbooks: s.playbooks.filter((p) => p.id !== id) })),

  // ─── Note Actions ───────────────────────────────────────────
  addNote: (note) => set((s) => ({ notes: [note, ...s.notes] })),

  deleteNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

  updateNote: (id, updates) =>
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),

  // ─── Trade Plan Actions ─────────────────────────────────────
  addTradePlan: (plan) => set((s) => ({ tradePlans: [...s.tradePlans, plan] })),

  deleteTradePlan: (id) => set((s) => ({ tradePlans: s.tradePlans.filter((p) => p.id !== id) })),

  updateTradePlan: (id, u) =>
    set((s) => ({
      tradePlans: s.tradePlans.map((p) => (p.id === id ? { ...p, ...u } : p)),
    })),

  // ─── Hydration (called by AppBoot) ──────────────────────────
  hydrate: (data = {}) =>
    set({
      trades: data.trades || [],
      playbooks: data.playbooks || [],
      notes: data.notes || [],
      tradePlans: data.tradePlans || [],
      loaded: true,
    }),

  // ─── Reset to demo data ─────────────────────────────────────
  reset: (demoTrades = [], demoPb = []) =>
    set({
      trades: demoTrades,
      playbooks: demoPb,
      notes: [],
      tradePlans: [],
    }),
});
