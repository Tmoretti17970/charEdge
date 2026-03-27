import { describe, it, expect, beforeEach, vi } from 'vitest';
// Mock the external dependencies
vi.mock('../../data/services/PredictionAggregator.js', () => ({
  fetchAllMarkets: vi.fn(),
}));
vi.mock('../../data/services/TimeClassifier.js', () => ({
  filterByTimeframe: vi.fn((markets, tf) => (tf === 'all' ? markets : markets.filter((m) => m.timeframe === tf))),
  countByTimeframe: vi.fn((markets) => ({ all: markets.length })),
}));
vi.mock('../../data/services/TopicTagGenerator.js', () => ({
  filterByTags: vi.fn((markets) => markets),
  generateSubcategories: vi.fn(() => []),
}));
import usePredictionStore from '../../state/usePredictionStore.js';

describe('usePredictionStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    usePredictionStore.setState({
      markets: [],
      totalCount: 0,
      loading: false,
      error: null,
      lastFetch: null,
      refreshTimer: null,
      activeCategory: 'all',
      activeSubcategory: null,
      activeTimeFilter: 'all',
      activeTags: [],
      searchQuery: '',
      sortBy: 'volume',
      sortOrder: 'desc',
      platformFilters: [],
      viewMode: 'grid',
      stats: null,
      topicTags: [],
      sourceStatus: {},
      timeframeCounts: {},
      subcategories: [],
    });
  });

  // ─── Filter actions ─────────────────────────────────────────
  describe('filter actions', () => {
    it('setCategory updates category and resets subcategory', () => {
      usePredictionStore.getState().setCategory('crypto');
      const state = usePredictionStore.getState();
      expect(state.activeCategory).toBe('crypto');
      expect(state.activeSubcategory).toBeNull();
    });

    it('setSubcategory updates subcategory', () => {
      usePredictionStore.getState().setSubcategory('DeFi');
      expect(usePredictionStore.getState().activeSubcategory).toBe('DeFi');
    });

    it('setTimeFilter updates time filter', () => {
      usePredictionStore.getState().setTimeFilter('daily');
      expect(usePredictionStore.getState().activeTimeFilter).toBe('daily');
    });

    it('setSearchQuery updates search', () => {
      usePredictionStore.getState().setSearchQuery('bitcoin');
      expect(usePredictionStore.getState().searchQuery).toBe('bitcoin');
    });

    it('setSortBy updates sort', () => {
      usePredictionStore.getState().setSortBy('trending');
      expect(usePredictionStore.getState().sortBy).toBe('trending');
    });

    it('setSortOrder updates order', () => {
      usePredictionStore.getState().setSortOrder('asc');
      expect(usePredictionStore.getState().sortOrder).toBe('asc');
    });

    it('setViewMode updates view mode', () => {
      usePredictionStore.getState().setViewMode('list');
      expect(usePredictionStore.getState().viewMode).toBe('list');
    });
  });

  // ─── Tag toggling ───────────────────────────────────────────
  describe('tag actions', () => {
    it('toggleTag adds a tag', () => {
      usePredictionStore.getState().toggleTag('Bitcoin');
      expect(usePredictionStore.getState().activeTags).toContain('Bitcoin');
    });

    it('toggleTag removes an existing tag', () => {
      usePredictionStore.getState().toggleTag('Bitcoin');
      usePredictionStore.getState().toggleTag('Bitcoin');
      expect(usePredictionStore.getState().activeTags).not.toContain('Bitcoin');
    });

    it('clearTags removes all tags', () => {
      usePredictionStore.getState().toggleTag('Bitcoin');
      usePredictionStore.getState().toggleTag('Ethereum');
      usePredictionStore.getState().clearTags();
      expect(usePredictionStore.getState().activeTags).toHaveLength(0);
    });
  });

  // ─── clearAllFilters ────────────────────────────────────────
  describe('clearAllFilters', () => {
    it('resets all filters to defaults', () => {
      usePredictionStore.getState().setCategory('crypto');
      usePredictionStore.getState().setSearchQuery('test');
      usePredictionStore.getState().toggleTag('Bitcoin');
      usePredictionStore.getState().setSortBy('trending');

      usePredictionStore.getState().clearAllFilters();

      const state = usePredictionStore.getState();
      expect(state.activeCategory).toBe('all');
      expect(state.searchQuery).toBe('');
      expect(state.activeTags).toHaveLength(0);
      expect(state.sortBy).toBe('volume');
    });
  });

  // ─── getFilteredMarkets ─────────────────────────────────────
  describe('getFilteredMarkets', () => {
    beforeEach(() => {
      usePredictionStore.setState({
        markets: [
          {
            id: 1,
            question: 'Will Bitcoin hit 100k?',
            category: 'crypto',
            source: 'kalshi',
            volume24h: 1000,
            tags: ['bitcoin'],
          },
          {
            id: 2,
            question: 'Will gold reach $3000?',
            category: 'finance',
            source: 'polymarket',
            volume24h: 500,
            tags: ['gold'],
          },
          {
            id: 3,
            question: 'Will Trump win?',
            category: 'politics',
            source: 'kalshi',
            volume24h: 2000,
            tags: ['politics'],
          },
        ],
      });
    });

    it('returns all markets with default filters', () => {
      expect(usePredictionStore.getState().getFilteredMarkets()).toHaveLength(3);
    });

    it('filters by category', () => {
      usePredictionStore.setState({ activeCategory: 'crypto' });
      const filtered = usePredictionStore.getState().getFilteredMarkets();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(1);
    });

    it('filters by search query', () => {
      usePredictionStore.setState({ searchQuery: 'bitcoin' });
      const filtered = usePredictionStore.getState().getFilteredMarkets();
      expect(filtered).toHaveLength(1);
    });

    it('filters by platform', () => {
      usePredictionStore.setState({ platformFilters: ['kalshi'] });
      const filtered = usePredictionStore.getState().getFilteredMarkets();
      expect(filtered).toHaveLength(2);
    });

    it('sorts by volume using the sort function', () => {
      const filtered = usePredictionStore.getState().getFilteredMarkets();
      // Verify that sort is applied — all 3 markets are present
      expect(filtered).toHaveLength(3);
      const volumes = filtered.map((m) => m.volume24h);
      // Should be sorted (either asc or desc)
      const isAsc = volumes.every((v, i) => i === 0 || v >= volumes[i - 1]);
      const isDesc = volumes.every((v, i) => i === 0 || v <= volumes[i - 1]);
      expect(isAsc || isDesc).toBe(true);
    });

    it('filters by subcategory', () => {
      usePredictionStore.setState({
        markets: [
          { id: 1, question: 'Q1', category: 'crypto', subcategory: 'DeFi', volume24h: 100, tags: [] },
          { id: 2, question: 'Q2', category: 'crypto', subcategory: 'Layer2', volume24h: 200, tags: [] },
        ],
        activeCategory: 'crypto',
        activeSubcategory: 'DeFi',
      });
      const filtered = usePredictionStore.getState().getFilteredMarkets();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(1);
    });
  });

  // ─── getActiveFilterCount ───────────────────────────────────
  describe('getActiveFilterCount', () => {
    it('returns 0 for default state', () => {
      expect(usePredictionStore.getState().getActiveFilterCount()).toBe(0);
    });

    it('counts active filters', () => {
      usePredictionStore.getState().setCategory('crypto');
      usePredictionStore.getState().setSearchQuery('test');
      usePredictionStore.getState().toggleTag('Bitcoin');

      expect(usePredictionStore.getState().getActiveFilterCount()).toBe(3);
    });
  });

  // ─── setPlatformFilters ─────────────────────────────────────
  describe('setPlatformFilters', () => {
    it('sets platform filters', () => {
      usePredictionStore.getState().setPlatformFilters(['kalshi', 'polymarket']);
      expect(usePredictionStore.getState().platformFilters).toEqual(['kalshi', 'polymarket']);
    });
  });
});
