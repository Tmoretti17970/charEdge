// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Briefing Store (Zustand)
//
// Manages the Morning Briefing state:
//   - Stores generated briefing data
//   - Tracks which sections the user has collapsed
//   - Controls dismissal and refresh
//   - Persists section preferences across sessions
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

const useBriefingStore = create((set, get) => ({
  // ─── Briefing Data ────────────────────────────────────────────
  briefing: null,
  loading: false,
  error: null,
  lastFetchedAt: null,

  // ─── UI State ─────────────────────────────────────────────────
  dismissed: false,
  expandedSections: {
    watchlist: true,
    movers: true,
    events: true,
    sentiment: true,
    edge: true,
  },

  // ─── Actions ──────────────────────────────────────────────────

  setBriefing: (data) =>
    set({
      briefing: data,
      loading: false,
      error: null,
      lastFetchedAt: Date.now(),
      dismissed: false,
    }),

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),

  dismiss: () => set({ dismissed: true }),
  undismiss: () => set({ dismissed: false }),

  toggleSection: (sectionId) =>
    set((s) => ({
      expandedSections: {
        ...s.expandedSections,
        [sectionId]: !s.expandedSections[sectionId],
      },
    })),

  // ─── Staleness Check ──────────────────────────────────────────
  isStale: () => {
    const { lastFetchedAt } = get();
    if (!lastFetchedAt) return true;
    // Consider stale after 30 minutes
    return Date.now() - lastFetchedAt > 30 * 60 * 1000;
  },

  // ─── Hydrate / Persist ────────────────────────────────────────
  hydrate: (saved = {}) => {
    if (saved.expandedSections) {
      set({ expandedSections: { ...get().expandedSections, ...saved.expandedSections } });
    }
  },

  toJSON: () => {
    const { expandedSections } = get();
    return { expandedSections };
  },

  reset: () =>
    set({
      briefing: null,
      loading: false,
      error: null,
      lastFetchedAt: null,
      dismissed: false,
      expandedSections: {
        watchlist: true,
        movers: true,
        events: true,
        sentiment: true,
        edge: true,
      },
    }),
}));

export { useBriefingStore };
export default useBriefingStore;
