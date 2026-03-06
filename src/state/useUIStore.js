// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — UI Store (Zustand)
// Manages: page navigation, modals, zen mode, command palette
// Transient — not persisted to IndexedDB
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

// ─── URL → page key mapping ─────────────────────────────────────
// Allows direct URL access (e.g. /speedtest, /charts) to resolve
// to the correct internal page key on initial load.
function getInitialPage() {
  if (typeof window === 'undefined') return 'dashboard';
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  const ROUTE_MAP = {
    speedtest: 'speedtest',
    charts: 'charts',
    settings: 'settings',
    journal: 'journal',
    telemetry: 'telemetry',
    changelog: 'changelog',
    privacy: 'privacy',
    terms: 'terms',
    landing: 'landing',
    charolette: 'charolette',
  };
  return ROUTE_MAP[path] || 'dashboard';
}

const useUIStore = create((set) => ({
  page: getInitialPage(),
  modal: null,
  confirmDialog: null,
  zenMode: false,
  cmdPaletteOpen: false,
  shortcutsOpen: false,
  quickTradeOpen: false,
  settingsOpen: false,
  recentSymbols: [],   // Phase B Sprint 7: last 5 symbols viewed

  setPage: (page) => set({ page }),
  addRecentSymbol: (sym) => set((s) => {
    const upper = sym.toUpperCase();
    const filtered = s.recentSymbols.filter((r) => r !== upper);
    return { recentSymbols: [upper, ...filtered].slice(0, 5) };
  }),
  openModal: (data) => set({ modal: data }),
  closeModal: () => set({ modal: null }),
  openConfirm: (data) => set({ confirmDialog: data }),
  closeConfirm: () => set({ confirmDialog: null }),
  toggleZen: () => set((s) => ({ zenMode: !s.zenMode })),
  toggleCmdPalette: () => set((s) => ({ cmdPaletteOpen: !s.cmdPaletteOpen })),
  closeCmdPalette: () => set({ cmdPaletteOpen: false }),
  toggleShortcuts: () => set((s) => ({ shortcutsOpen: !s.shortcutsOpen })),
  closeShortcuts: () => set({ shortcutsOpen: false }),
  openQuickTrade: () => set({ quickTradeOpen: true }),
  closeQuickTrade: () => set({ quickTradeOpen: false }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  closeAll: () =>
    set({
      modal: null,
      confirmDialog: null,
      cmdPaletteOpen: false,
      shortcutsOpen: false,
      quickTradeOpen: false,
      settingsOpen: false,
    }),
}));

export { useUIStore };
export default useUIStore;
