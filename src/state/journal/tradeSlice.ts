// ═══════════════════════════════════════════════════════════════════
// Trade Slice — trades, playbooks, notes, trade plans
// Previously: useTradeStore.js
// ═══════════════════════════════════════════════════════════════════

import { trackFirstAction, trackWorkflow } from '../../observability/telemetry';
import { captureTradeContext } from '../../hooks/useSnapshotCapture.js';
import { applyLeakTags } from '@/psychology/LeakDetectorService.js';
import { getSessionTag } from '../../app/components/dialogs/trade-form/sessionTagger.js';

export const createTradeSlice = (set, get) => ({
  trades: [],
  playbooks: [],
  notes: [],
  tradePlans: [],
  loaded: false,

  // ─── Trade Actions ──────────────────────────────────────────
  addTrade: (trade) => {
    trackFirstAction('trade_logged');
    trackWorkflow('trade_logged');

    // Auto-tag with market session
    let enriched = { ...trade };
    if (!enriched.sessionTag) {
      enriched.sessionTag = getSessionTag(enriched.date);
    }

    // 5.6.2: Auto-capture market state snapshot at trade execution time.
    if (!enriched.context?.snapshot) {
      try {
        enriched = {
          ...enriched,
          context: captureTradeContext({
            stopLoss: enriched.stopLoss,
            takeProfit: enriched.takeProfit,
          }),
        };
      } catch {
        // Snapshot capture failed — store trade without context
      }
    }

    // Save immediately (optimistic UI)
    set((s) => ({ trades: [enriched, ...s.trades] }));

    // 6.5.1: Async leak detection — runs after render, never blocks save
    queueMicrotask(() => {
      try {
        const recentTrades = (get().trades || []).slice(1, 11);
        const tagged = applyLeakTags(enriched, recentTrades);
        if (tagged !== enriched) {
          set((s) => ({
            trades: s.trades.map((t) => (t.id === tagged.id ? tagged : t)),
          }));
        }
      } catch {
        // Leak detection failed — trade is already saved
      }
    });
  },

  addTrades: (newTrades) => {
    trackFirstAction('trades_imported');
    trackWorkflow('csv_imported');
    set((s) => ({ trades: [...newTrades, ...s.trades] }));
  },

  deleteTrade: (id) => set((s) => ({ trades: s.trades.filter((t) => t.id !== id) })),

  // Sprint 6.2: Remove all trades from a specific import batch (for rollback)
  deleteBatch: (batchId) => {
    const before = get().trades.length;
    set((s) => ({ trades: s.trades.filter((t) => t._batchId !== batchId) }));
    const removed = before - get().trades.length;
    console.info(`[Journal] Rolled back batch ${batchId}: removed ${removed} trades`);
    return removed;
  },

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
