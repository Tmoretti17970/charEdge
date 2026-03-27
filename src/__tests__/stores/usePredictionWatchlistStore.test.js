import { describe, it, expect, beforeEach } from 'vitest';
import usePredictionWatchlistStore from '../../state/usePredictionWatchlistStore.js';

describe('usePredictionWatchlistStore', () => {
  beforeEach(() => {
    usePredictionWatchlistStore.setState({
      watchlists: { default: { name: 'Bookmarks', marketIds: [] } },
      activeWatchlistId: 'default',
    });
  });

  describe('toggleBookmark', () => {
    it('adds a market to the active watchlist', () => {
      usePredictionWatchlistStore.getState().toggleBookmark('m1');
      const ids = usePredictionWatchlistStore.getState().watchlists.default.marketIds;
      expect(ids).toContain('m1');
    });

    it('removes a market when toggled again', () => {
      usePredictionWatchlistStore.getState().toggleBookmark('m1');
      usePredictionWatchlistStore.getState().toggleBookmark('m1');
      const ids = usePredictionWatchlistStore.getState().watchlists.default.marketIds;
      expect(ids).not.toContain('m1');
    });
  });

  describe('isBookmarked', () => {
    it('returns true for bookmarked markets', () => {
      usePredictionWatchlistStore.getState().toggleBookmark('m1');
      expect(usePredictionWatchlistStore.getState().isBookmarked('m1')).toBe(true);
    });

    it('returns false for unbookmarked markets', () => {
      expect(usePredictionWatchlistStore.getState().isBookmarked('m999')).toBe(false);
    });
  });

  describe('createWatchlist', () => {
    it('creates a new watchlist and sets it as active', () => {
      const id = usePredictionWatchlistStore.getState().createWatchlist('My List');
      expect(id).toBeDefined();
      const state = usePredictionWatchlistStore.getState();
      expect(state.watchlists[id]).toBeDefined();
      expect(state.watchlists[id].name).toBe('My List');
      expect(state.activeWatchlistId).toBe(id);
    });
  });

  describe('deleteWatchlist', () => {
    it('deletes a watchlist', () => {
      const id = usePredictionWatchlistStore.getState().createWatchlist('To Delete');
      usePredictionWatchlistStore.getState().deleteWatchlist(id);
      expect(usePredictionWatchlistStore.getState().watchlists[id]).toBeUndefined();
    });

    it('cannot delete the default watchlist', () => {
      usePredictionWatchlistStore.getState().deleteWatchlist('default');
      expect(usePredictionWatchlistStore.getState().watchlists.default).toBeDefined();
    });

    it('reverts to default when deleting active watchlist', () => {
      const id = usePredictionWatchlistStore.getState().createWatchlist('Active');
      usePredictionWatchlistStore.getState().deleteWatchlist(id);
      expect(usePredictionWatchlistStore.getState().activeWatchlistId).toBe('default');
    });
  });

  describe('renameWatchlist', () => {
    it('renames a watchlist', () => {
      usePredictionWatchlistStore.getState().renameWatchlist('default', 'My Favorites');
      expect(usePredictionWatchlistStore.getState().watchlists.default.name).toBe('My Favorites');
    });

    it('ignores nonexistent watchlist', () => {
      usePredictionWatchlistStore.getState().renameWatchlist('nonexistent', 'Name');
      // Should not throw
    });
  });

  describe('getActiveMarketIds', () => {
    it('returns market IDs from the active watchlist', () => {
      usePredictionWatchlistStore.getState().toggleBookmark('m1');
      usePredictionWatchlistStore.getState().toggleBookmark('m2');
      const ids = usePredictionWatchlistStore.getState().getActiveMarketIds();
      expect(ids).toEqual(['m1', 'm2']);
    });
  });

  describe('getTotalBookmarkCount', () => {
    it('counts unique bookmarks across all watchlists', () => {
      usePredictionWatchlistStore.getState().toggleBookmark('m1');
      usePredictionWatchlistStore.getState().createWatchlist('Other');
      usePredictionWatchlistStore.getState().toggleBookmark('m2');

      expect(usePredictionWatchlistStore.getState().getTotalBookmarkCount()).toBe(2);
    });

    it('deduplicates across watchlists', () => {
      usePredictionWatchlistStore.getState().toggleBookmark('m1');
      // Create new list and add same market
      const id = usePredictionWatchlistStore.getState().createWatchlist('Other');
      usePredictionWatchlistStore.getState().toggleBookmark('m1');

      // m1 is in both lists, but count should be 1
      expect(usePredictionWatchlistStore.getState().getTotalBookmarkCount()).toBe(1);
    });
  });

  describe('setActiveWatchlist', () => {
    it('changes the active watchlist', () => {
      const id = usePredictionWatchlistStore.getState().createWatchlist('New');
      usePredictionWatchlistStore.getState().setActiveWatchlist('default');
      expect(usePredictionWatchlistStore.getState().activeWatchlistId).toBe('default');
    });
  });
});
