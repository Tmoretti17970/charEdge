// ═══════════════════════════════════════════════════════════════════
// charEdge — Discover Slice
// Extracted from useDiscoverStore for useDataStore consolidation.
// ═══════════════════════════════════════════════════════════════════

export const createDiscoverSlice = (set, get) => ({
  // ─── Discover State ───────────────────────────────────────────
  activeFilters: [],
  activeTab: 'all',
  discoverModalOpen: false,
  discoverModalData: null,
  registeredWidgets: {},

  // ─── Chip / Filter Navigation (CommunityPage) ────────────────
  activeChip: 'all',
  setActiveChip: (chip) => set({ activeChip: chip }),
  filter: 'all',
  setFilter: (f) => set({ filter: f }),

  // ─── Zen Mode & Filter Visibility ────────────────────────────
  zenMode: false,
  toggleZenMode: () => set((s) => ({ zenMode: !s.zenMode })),
  showFilters: false,
  toggleFilters: () => set((s) => ({ showFilters: !s.showFilters })),

  // ─── More Tab Feature ─────────────────────────────────────────
  moreActiveFeature: null,
  setMoreActiveFeature: (f) => set({ moreActiveFeature: f }),

  // ─── Compose / Create Modals ──────────────────────────────────
  composeOpen: false,
  openCompose: () => set({ composeOpen: true }),
  closeCompose: () => set({ composeOpen: false }),
  createPollOpen: false,
  openCreatePoll: () => set({ createPollOpen: true }),
  closeCreatePoll: () => set({ createPollOpen: false }),

  // ─── Copy Trade Modal ─────────────────────────────────────────
  copyTradeModalOpen: false,
  copyTradeTarget: null,
  openCopyTrade: (trader) => set({ copyTradeModalOpen: true, copyTradeTarget: trader }),
  closeCopyTrade: () => set({ copyTradeModalOpen: false, copyTradeTarget: null }),

  // ─── Filter Actions ───────────────────────────────────────────
  toggleFilter: (filterId) =>
    set((s) => ({
      activeFilters: s.activeFilters.includes(filterId)
        ? s.activeFilters.filter((f) => f !== filterId)
        : [...s.activeFilters, filterId],
    })),

  setFilters: (filters) => set({ activeFilters: filters }),
  resetFilters: () => set({ activeFilters: [] }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  // ─── Modal ────────────────────────────────────────────────────
  openDiscoverModal: (data) => set({ discoverModalOpen: true, discoverModalData: data }),
  closeDiscoverModal: () => set({ discoverModalOpen: false, discoverModalData: null }),

  // ─── Widget Registration ──────────────────────────────────────
  registerWidget: (id, meta) =>
    set((s) => ({
      registeredWidgets: { ...s.registeredWidgets, [id]: meta },
    })),

  unregisterWidget: (id) =>
    set((s) => {
      const next = { ...s.registeredWidgets };
      delete next[id];
      return { registeredWidgets: next };
    }),

  getRegisteredWidgets: () => get().registeredWidgets,
});
