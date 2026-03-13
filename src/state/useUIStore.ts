// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — UI Store (Zustand, TypeScript)
// Manages: page navigation, modals, zen mode, command palette
// Phase 2: Converted to TypeScript.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

// ─── Types ──────────────────────────────────────────────────────

export interface ConfirmDialogData {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export interface ModalData {
  type: string;
  [key: string]: unknown;
}

export interface UIState {
  page: string;
  modal: ModalData | null;
  confirmDialog: ConfirmDialogData | null;
  zenMode: boolean;
  cmdPaletteOpen: boolean;
  shortcutsOpen: boolean;
  quickTradeOpen: boolean;
  settingsOpen: boolean;
  recentSymbols: string[];
  chartSymbol: string | null;
}

export interface UIActions {
  setPage: (page: string) => void;
  addRecentSymbol: (sym: string) => void;
  openModal: (data: ModalData) => void;
  closeModal: () => void;
  openConfirm: (data: ConfirmDialogData) => void;
  closeConfirm: () => void;
  toggleZen: () => void;
  toggleCmdPalette: () => void;
  closeCmdPalette: () => void;
  toggleShortcuts: () => void;
  closeShortcuts: () => void;
  openQuickTrade: () => void;
  closeQuickTrade: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  toggleSettings: () => void;
  setChartSymbol: (sym: string) => void;
  closeAll: () => void;
}

// ─── Store ──────────────────────────────────────────────────────

const useUIStore = create<UIState & UIActions>((set) => ({
  page: 'dashboard',
  modal: null,
  confirmDialog: null,
  zenMode: false,
  cmdPaletteOpen: false,
  shortcutsOpen: false,
  quickTradeOpen: false,
  settingsOpen: false,
  recentSymbols: [],
  chartSymbol: null,

  setPage: (page: string) => set({ page }),
  setChartSymbol: (sym: string) => set({ chartSymbol: sym.toUpperCase() }),
  addRecentSymbol: (sym: string) =>
    set((s) => {
      const upper = sym.toUpperCase();
      const filtered = s.recentSymbols.filter((r) => r !== upper);
      return { recentSymbols: [upper, ...filtered].slice(0, 5) };
    }),
  openModal: (data: ModalData) => set({ modal: data }),
  closeModal: () => set({ modal: null }),
  openConfirm: (data: ConfirmDialogData) => set({ confirmDialog: data }),
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
