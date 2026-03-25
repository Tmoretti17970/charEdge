// ═══════════════════════════════════════════════════════════════════
// charEdge — Markets Preferences Store (Sprint 6 + Sprint 9)
//
// Persisted Zustand store for Markets page column customization,
// sort preferences, filter state, group-by settings, and detail
// panel selection.
//
// Default columns: symbol, sparkline, price, change24h, volume, pnl
// Optional columns: marketCap, tradeCount, lastTraded, assetClass
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Column Definitions ────────────────────────────────────────

export const ALL_COLUMNS = [
  { id: 'symbol', label: 'Asset', fixed: true },
  { id: 'sparkline', label: 'Chart', fixed: false },
  { id: 'price', label: 'Price', fixed: false },
  { id: 'change', label: '24h %', fixed: false },
  { id: 'volume', label: 'Volume', fixed: false },
  { id: 'marketCap', label: 'Market Cap', fixed: false },
  { id: 'supply', label: 'Supply', fixed: false },
  { id: 'ath', label: 'ATH', fixed: false },
  { id: 'weekRange', label: '52w Range', fixed: false },
  { id: 'volProfile', label: 'Vol Profile', fixed: false },
  { id: 'pnl', label: 'Your P&L', fixed: false },
  { id: 'tradeCount', label: 'Trades', fixed: false },
  { id: 'lastTraded', label: 'Last Traded', fixed: false },
  { id: 'assetClass', label: 'Asset Class', fixed: false },
];

export const DEFAULT_COLUMNS = ['symbol', 'price', 'change', 'volume'];

// ─── Asset class filter options ────────────────────────────────

export const ASSET_CLASSES = ['crypto', 'stocks', 'futures', 'etf', 'forex', 'options'];

// ─── Store ─────────────────────────────────────────────────────

const useMarketsPrefsStore = create(
  persist(
    (set, get) => ({
      // ─── Column preferences ─────────────────────────────
      visibleColumns: [...DEFAULT_COLUMNS],

      toggleColumn: (colId) => {
        const col = ALL_COLUMNS.find((c) => c.id === colId);
        if (col?.fixed) return; // Can't hide the symbol column

        set((s) => {
          const visible = [...s.visibleColumns];
          const idx = visible.indexOf(colId);
          if (idx >= 0) {
            visible.splice(idx, 1);
          } else {
            // Insert at the position defined in ALL_COLUMNS order
            const insertIdx = ALL_COLUMNS.findIndex((c) => c.id === colId);
            let targetIdx = visible.length;
            for (let i = 0; i < visible.length; i++) {
              const visIdx = ALL_COLUMNS.findIndex((c) => c.id === visible[i]);
              if (visIdx > insertIdx) {
                targetIdx = i;
                break;
              }
            }
            visible.splice(targetIdx, 0, colId);
          }
          return { visibleColumns: visible };
        });
      },

      reorderColumns: (fromIdx, toIdx) => {
        set((s) => {
          const cols = [...s.visibleColumns];
          const [moved] = cols.splice(fromIdx, 1);
          cols.splice(toIdx, 0, moved);
          return { visibleColumns: cols };
        });
      },

      resetColumns: () => set({ visibleColumns: [...DEFAULT_COLUMNS] }),

      // ─── Sort preferences ───────────────────────────────
      sortKey: null,
      sortDir: 'desc',

      setSort: (key) => {
        const s = get();
        if (s.sortKey === key) {
          set({ sortDir: s.sortDir === 'asc' ? 'desc' : 'asc' });
        } else {
          set({ sortKey: key, sortDir: 'desc' });
        }
      },

      clearSort: () => set({ sortKey: null, sortDir: 'desc' }),

      // ─── Filter preferences ─────────────────────────────
      assetClassFilters: [], // empty = show all

      toggleAssetFilter: (cls) => {
        set((s) => {
          const filters = [...s.assetClassFilters];
          const idx = filters.indexOf(cls);
          if (idx >= 0) {
            filters.splice(idx, 1);
          } else {
            filters.push(cls);
          }
          return { assetClassFilters: filters };
        });
      },

      clearFilters: () => set({ assetClassFilters: [] }),

      // ─── Group preferences ──────────────────────────────
      groupBy: null, // null | 'assetClass' | 'folder'

      setGroupBy: (group) => set({ groupBy: group }),
      clearGroupBy: () => set({ groupBy: null }),

      // ─── Detail panel (Sprint 9) ────────────────────────
      selectedSymbol: null, // symbol string or null

      setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
      closeDetail: () => set({ selectedSymbol: null }),

      // ─── View mode (Sprint 17 + 18) ────────────────────
      viewMode: 'list', // 'list' | 'cards' | 'compact' | 'heatmap'
      setViewMode: (mode) => set({ viewMode: mode }),

      // ─── Heat map preferences (Sprint 18) ──────────────
      heatmapSizeBy: 'volume', // 'volume' | 'marketCap'
      setHeatmapSizeBy: (sizeBy) => set({ heatmapSizeBy: sizeBy }),

      // ─── Multi-watchlist tabs (Sprint 19) ──────────────
      activeWatchlistId: null, // null = "All", or folder ID
      setActiveWatchlistId: (id) => set({ activeWatchlistId: id }),

      // ─── Comparison mode (Sprint 20) ───────────────────
      compareSymbols: [], // max 4 symbols
      compareTimeRange: '1M', // '1D' | '1W' | '1M' | '3M' | '1Y'
      addCompareSymbol: (sym) =>
        set((s) => {
          if (s.compareSymbols.length >= 4 || s.compareSymbols.includes(sym)) return s;
          return { compareSymbols: [...s.compareSymbols, sym] };
        }),
      removeCompareSymbol: (sym) =>
        set((s) => ({
          compareSymbols: s.compareSymbols.filter((c) => c !== sym),
        })),
      clearCompare: () => set({ compareSymbols: [] }),
      setCompareTimeRange: (range) => set({ compareTimeRange: range }),

      // ─── Alert Picker (Sprint 22) ───────────────────────
      alertPickerOpen: false,
      setAlertPickerOpen: (open) => set({ alertPickerOpen: open }),

      // ─── Copilot Panel (Sprint 23) ──────────────────────
      copilotPanelOpen: false,
      setCopilotPanelOpen: (open) => set({ copilotPanelOpen: open }),
      copilotHistory: [],
      pushCopilotAction: (action) =>
        set((s) => ({
          copilotHistory: [...(s.copilotHistory || []).slice(-9), action],
        })),

      // ─── Prop Firm Advisor (Sprint 26) ────────────────────
      propFirmAdvisorOpen: false,
      setPropFirmAdvisorOpen: (open) => set({ propFirmAdvisorOpen: open }),

      // ─── Smart Folders (Sprint 28) ────────────────────────
      smartFolderOpen: false,
      setSmartFolderOpen: (open) => set({ smartFolderOpen: open }),

      // ─── Screener (Sprint 29) ─────────────────────────────
      screenerPanelOpen: false,
      setScreenerPanelOpen: (open) => set({ screenerPanelOpen: open }),

      // ─── Watchlist Alerts (Sprint 30) ──────────────────────
      watchlistAlertOpen: false,
      setWatchlistAlertOpen: (open) => set({ watchlistAlertOpen: open }),

      // ─── Performance Analytics (Sprint 31) ─────────────────
      performancePanelOpen: false,
      setPerformancePanelOpen: (open) => set({ performancePanelOpen: open }),
    }),
    {
      name: 'charEdge-markets-prefs',
      version: 3,
      partialize: (state) => ({
        visibleColumns: state.visibleColumns,
        sortKey: state.sortKey,
        sortDir: state.sortDir,
        assetClassFilters: state.assetClassFilters,
        groupBy: state.groupBy,
        viewMode: state.viewMode,
        heatmapSizeBy: state.heatmapSizeBy,
        // selectedSymbol intentionally excluded — don't persist open panel
      }),
    },
  ),
);

export { useMarketsPrefsStore };
export default useMarketsPrefsStore;
