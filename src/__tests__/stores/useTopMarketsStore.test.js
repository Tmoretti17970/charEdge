import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('../../data/adapters/TopMarketsAdapter.js', () => ({
  fetchTopMarkets: vi.fn().mockResolvedValue({
    markets: [],
    sources: { crypto: { count: 0 }, equities: { count: 0 } },
  }),
  clearTopMarketsCache: vi.fn(),
}));
import useTopMarketsStore from '../../state/useTopMarketsStore.js';

describe('useTopMarketsStore', () => {
  beforeEach(() => {
    useTopMarketsStore.setState({
      markets: [],
      loading: false,
      error: null,
      lastFetch: null,
      sortBy: 'rank',
      sortDir: 'asc',
      assetClassFilter: 'all',
      topicFilter: null,
      searchQuery: '',
      page: 1,
      pageSize: 50,
      _refreshTimer: null,
      sources: { crypto: { count: 0 }, equities: { count: 0 } },
    });
  });

  // ─── Filter actions ─────────────────────────────────────────
  describe('filter actions', () => {
    it('setAssetClassFilter resets page', () => {
      useTopMarketsStore.setState({ page: 3 });
      useTopMarketsStore.getState().setAssetClassFilter('crypto');
      expect(useTopMarketsStore.getState().assetClassFilter).toBe('crypto');
      expect(useTopMarketsStore.getState().page).toBe(1);
    });

    it('setTopicFilter resets page', () => {
      useTopMarketsStore.setState({ page: 3 });
      useTopMarketsStore.getState().setTopicFilter('ai');
      expect(useTopMarketsStore.getState().topicFilter).toBe('ai');
      expect(useTopMarketsStore.getState().page).toBe(1);
    });

    it('setSearchQuery resets page', () => {
      useTopMarketsStore.setState({ page: 3 });
      useTopMarketsStore.getState().setSearchQuery('bitcoin');
      expect(useTopMarketsStore.getState().searchQuery).toBe('bitcoin');
      expect(useTopMarketsStore.getState().page).toBe(1);
    });

    it('clearFilters resets all filters', () => {
      useTopMarketsStore.getState().setAssetClassFilter('crypto');
      useTopMarketsStore.getState().setTopicFilter('ai');
      useTopMarketsStore.getState().setSearchQuery('test');
      useTopMarketsStore.getState().clearFilters();

      const state = useTopMarketsStore.getState();
      expect(state.assetClassFilter).toBe('all');
      expect(state.topicFilter).toBeNull();
      expect(state.searchQuery).toBe('');
    });
  });

  // ─── Sort actions ───────────────────────────────────────────
  describe('sort actions', () => {
    it('setSortBy toggles direction when same key', () => {
      useTopMarketsStore.getState().setSortBy('rank');
      expect(useTopMarketsStore.getState().sortDir).toBe('desc'); // toggled from asc

      useTopMarketsStore.getState().setSortBy('rank');
      expect(useTopMarketsStore.getState().sortDir).toBe('asc');
    });

    it('setSortBy defaults to desc for non-rank columns', () => {
      useTopMarketsStore.getState().setSortBy('price');
      expect(useTopMarketsStore.getState().sortBy).toBe('price');
      expect(useTopMarketsStore.getState().sortDir).toBe('desc');
    });

    it('setSortBy defaults to asc for rank column', () => {
      useTopMarketsStore.getState().setSortBy('price');
      useTopMarketsStore.getState().setSortBy('rank');
      expect(useTopMarketsStore.getState().sortDir).toBe('asc');
    });
  });

  // ─── Pagination ─────────────────────────────────────────────
  describe('pagination', () => {
    it('setPage updates page', () => {
      useTopMarketsStore.getState().setPage(5);
      expect(useTopMarketsStore.getState().page).toBe(5);
    });

    it('nextPage increments page', () => {
      useTopMarketsStore.getState().nextPage();
      expect(useTopMarketsStore.getState().page).toBe(2);
    });

    it('prevPage decrements page', () => {
      useTopMarketsStore.setState({ page: 3 });
      useTopMarketsStore.getState().prevPage();
      expect(useTopMarketsStore.getState().page).toBe(2);
    });

    it('prevPage does not go below 1', () => {
      useTopMarketsStore.getState().prevPage();
      expect(useTopMarketsStore.getState().page).toBe(1);
    });
  });

  // ─── getFilteredMarkets ─────────────────────────────────────
  describe('getFilteredMarkets', () => {
    const testMarkets = [
      { name: 'Bitcoin', symbol: 'BTC', assetClass: 'crypto', rank: 1, price: 60000 },
      { name: 'Ethereum', symbol: 'ETH', assetClass: 'crypto', rank: 2, price: 3000 },
      { name: 'Apple', symbol: 'AAPL', assetClass: 'stock', rank: 3, price: 180 },
    ];

    beforeEach(() => {
      useTopMarketsStore.setState({ markets: testMarkets });
    });

    it('returns all markets with default filters', () => {
      expect(useTopMarketsStore.getState().getFilteredMarkets()).toHaveLength(3);
    });

    it('filters by asset class', () => {
      useTopMarketsStore.setState({ assetClassFilter: 'crypto' });
      const filtered = useTopMarketsStore.getState().getFilteredMarkets();
      expect(filtered).toHaveLength(2);
    });

    it('filters by search query', () => {
      useTopMarketsStore.setState({ searchQuery: 'bitcoin' });
      const filtered = useTopMarketsStore.getState().getFilteredMarkets();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].symbol).toBe('BTC');
    });

    it('sorts by the active sort key', () => {
      useTopMarketsStore.setState({ sortBy: 'price', sortDir: 'desc' });
      const filtered = useTopMarketsStore.getState().getFilteredMarkets();
      expect(filtered[0].price).toBe(60000);
    });
  });

  // ─── getPaginatedMarkets ────────────────────────────────────
  describe('getPaginatedMarkets', () => {
    it('paginates filtered results', () => {
      const manyMarkets = Array.from({ length: 120 }, (_, i) => ({
        name: `Market ${i}`,
        symbol: `M${i}`,
        assetClass: 'crypto',
        rank: i,
        price: i,
      }));
      useTopMarketsStore.setState({ markets: manyMarkets, pageSize: 50, page: 1 });

      const result = useTopMarketsStore.getState().getPaginatedMarkets();
      expect(result.items).toHaveLength(50);
      expect(result.total).toBe(120);
      expect(result.totalPages).toBe(3);
      expect(result.page).toBe(1);
    });
  });
});
