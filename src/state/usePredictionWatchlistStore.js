// ═══════════════════════════════════════════════════════════════════
// charEdge — Prediction Watchlist Store
//
// Manages user's bookmarked/watchlisted prediction markets.
// Persisted to localStorage.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const usePredictionWatchlistStore = create(
  persist(
    (set, get) => ({
      // ─── State ──────────────────────────────────────────────
      watchlists: {
        default: { name: 'Bookmarks', marketIds: [] },
      },
      activeWatchlistId: 'default',

      // ─── Actions ────────────────────────────────────────────

      /** Check if a market is bookmarked in any watchlist. */
      isBookmarked: (marketId) => {
        const { watchlists } = get();
        return Object.values(watchlists).some((wl) => wl.marketIds.includes(marketId));
      },

      /** Toggle bookmark for a market in the active watchlist. */
      toggleBookmark: (marketId) => {
        const { watchlists, activeWatchlistId } = get();
        const wl = watchlists[activeWatchlistId];
        if (!wl) return;

        const newIds = wl.marketIds.includes(marketId)
          ? wl.marketIds.filter((id) => id !== marketId)
          : [...wl.marketIds, marketId];

        set({
          watchlists: {
            ...watchlists,
            [activeWatchlistId]: { ...wl, marketIds: newIds },
          },
        });
      },

      /** Create a new watchlist. */
      createWatchlist: (name) => {
        const id = `wl-${Date.now()}`;
        const { watchlists } = get();
        set({
          watchlists: {
            ...watchlists,
            [id]: { name, marketIds: [] },
          },
          activeWatchlistId: id,
        });
        return id;
      },

      /** Delete a watchlist. */
      deleteWatchlist: (id) => {
        if (id === 'default') return; // Can't delete default
        const { watchlists, activeWatchlistId } = get();
        const { [id]: _, ...rest } = watchlists;
        set({
          watchlists: rest,
          activeWatchlistId: activeWatchlistId === id ? 'default' : activeWatchlistId,
        });
      },

      /** Rename a watchlist. */
      renameWatchlist: (id, name) => {
        const { watchlists } = get();
        if (!watchlists[id]) return;
        set({
          watchlists: {
            ...watchlists,
            [id]: { ...watchlists[id], name },
          },
        });
      },

      /** Set active watchlist. */
      setActiveWatchlist: (id) => set({ activeWatchlistId: id }),

      /** Get bookmarked market IDs from active watchlist. */
      getActiveMarketIds: () => {
        const { watchlists, activeWatchlistId } = get();
        return watchlists[activeWatchlistId]?.marketIds || [];
      },

      /** Get count of bookmarks across all watchlists. */
      getTotalBookmarkCount: () => {
        const { watchlists } = get();
        const allIds = new Set();
        Object.values(watchlists).forEach((wl) => wl.marketIds.forEach((id) => allIds.add(id)));
        return allIds.size;
      },
    }),
    {
      name: 'charEdge-prediction-watchlists',
      version: 1,
    },
  ),
);

export default usePredictionWatchlistStore;
