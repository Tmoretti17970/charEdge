// ═══════════════════════════════════════════════════════════════════
// charEdge — Prediction Market Store V2
//
// Aggregates prediction market data from all sources via
// PredictionAggregator. Supports pagination, filtering, stats,
// topic tags, and per-source status tracking.
//
// Backward-compatible: getFilteredMarkets() still works for
// the Intel page mini-widget.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { fetchAllMarkets } from '../data/services/PredictionAggregator.js';
import { filterByTimeframe, countByTimeframe } from '../data/services/TimeClassifier.js';
import { filterByTags, generateSubcategories } from '../data/services/TopicTagGenerator.js';

const REFRESH_INTERVAL = 60_000; // 60 seconds

const usePredictionStore = create((set, get) => ({
  // ─── Core State ───────────────────────────────────────────────
  markets: [],               // All fetched + deduped markets
  totalCount: 0,             // Total market count
  loading: false,
  error: null,
  lastFetch: null,
  refreshTimer: null,

  // ─── Filter State ─────────────────────────────────────────────
  activeCategory: 'all',     // Category tab
  activeSubcategory: null,   // Subcategory pill within category
  activeTimeFilter: 'all',   // Time bucket filter
  activeTags: [],            // Selected topic tags
  searchQuery: '',           // Search text
  sortBy: 'volume',          // 'volume' | 'trending' | 'newest' | 'closingSoon' | 'probability'
  sortOrder: 'desc',         // 'asc' | 'desc'
  platformFilters: [],       // Empty = all, or ['kalshi', 'polymarket']
  viewMode: 'grid',          // 'grid' | 'list'

  // ─── Derived Data ─────────────────────────────────────────────
  stats: null,               // Aggregate stats from PredictionStatsService
  topicTags: [],             // Auto-generated topic tags with counts
  sourceStatus: {},          // Per-source health { kalshi: { count, error, latency } }
  timeframeCounts: {},       // Count per time bucket { daily: 45, weekly: 12 }
  subcategories: [],         // Subcategory pills for active category

  // ─── Actions ──────────────────────────────────────────────────

  setCategory: (category) => {
    set({ activeCategory: category, activeSubcategory: null });
    // Regenerate subcategories
    const { markets } = get();
    const filtered = category === 'all' ? markets : markets.filter(m => m.category === category);
    set({ subcategories: generateSubcategories(filtered, category) });
  },

  setSubcategory: (sub) => set({ activeSubcategory: sub }),
  setTimeFilter: (tf) => set({ activeTimeFilter: tf }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSortBy: (sort) => set({ sortBy: sort }),
  setSortOrder: (order) => set({ sortOrder: order }),

  toggleTag: (tag) => {
    const { activeTags } = get();
    if (activeTags.includes(tag)) {
      set({ activeTags: activeTags.filter(t => t !== tag) });
    } else {
      set({ activeTags: [...activeTags, tag] });
    }
  },

  clearTags: () => set({ activeTags: [] }),

  setPlatformFilters: (platforms) => set({ platformFilters: platforms }),
  setViewMode: (mode) => set({ viewMode: mode }),

  clearAllFilters: () => set({
    activeCategory: 'all',
    activeSubcategory: null,
    activeTimeFilter: 'all',
    activeTags: [],
    searchQuery: '',
    sortBy: 'volume',
    sortOrder: 'desc',
    platformFilters: [],
  }),

  /**
   * Fetch from all sources via PredictionAggregator.
   */
  fetchAll: async () => {
    const state = get();
    if (state.loading) return;

    set({ loading: true, error: null });

    try {
      const result = await fetchAllMarkets({ limit: 100, useEvents: true });

      const timeframeCounts = countByTimeframe(result.markets);
      const { activeCategory } = get();
      const catMarkets = activeCategory === 'all'
        ? result.markets
        : result.markets.filter(m => m.category === activeCategory);
      const subcategories = generateSubcategories(catMarkets, activeCategory);

      set({
        markets: result.markets,
        totalCount: result.totalCount,
        stats: result.stats,
        topicTags: result.topicTags,
        sourceStatus: result.sourceStatus,
        timeframeCounts,
        subcategories,
        loading: false,
        lastFetch: Date.now(),
      });
    } catch (err) {
      set({ loading: false, error: err.message });
    }
  },

  /**
   * Start auto-refresh interval.
   */
  startAutoRefresh: () => {
    const state = get();
    if (state.refreshTimer) return;

    get().fetchAll();

    const timer = setInterval(() => {
      get().fetchAll();
    }, REFRESH_INTERVAL);

    set({ refreshTimer: timer });
  },

  /**
   * Stop auto-refresh.
   */
  stopAutoRefresh: () => {
    const state = get();
    if (state.refreshTimer) {
      clearInterval(state.refreshTimer);
      set({ refreshTimer: null });
    }
  },

  // ─── Derived / Filtered ───────────────────────────────────────

  /**
   * Get markets filtered by all active filters.
   * Full pipeline: category → subcategory → timeframe → tags → search → platform → sort.
   */
  getFilteredMarkets: () => {
    const {
      markets, activeCategory, activeSubcategory, activeTimeFilter,
      activeTags, searchQuery, sortBy, sortOrder, platformFilters,
    } = get();

    let filtered = markets;

    // Category
    if (activeCategory !== 'all') {
      filtered = filtered.filter(m => m.category === activeCategory);
    }

    // Subcategory
    if (activeSubcategory) {
      filtered = filtered.filter(m => m.subcategory === activeSubcategory);
    }

    // Timeframe
    filtered = filterByTimeframe(filtered, activeTimeFilter);

    // Topic tags
    if (activeTags.length > 0) {
      filtered = filterByTags(filtered, activeTags);
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.question?.toLowerCase().includes(q) ||
        m.tags?.some(t => t.toLowerCase().includes(q))
      );
    }

    // Platform
    if (platformFilters.length > 0) {
      filtered = filtered.filter(m => platformFilters.includes(m.source));
    }

    // Sort
    filtered = sortMarkets(filtered, sortBy, sortOrder);

    return filtered;
  },

  /**
   * Get active filter count (for "N filters active" badge).
   */
  getActiveFilterCount: () => {
    const { activeCategory, activeSubcategory, activeTimeFilter, activeTags, searchQuery, platformFilters } = get();
    let count = 0;
    if (activeCategory !== 'all') count++;
    if (activeSubcategory) count++;
    if (activeTimeFilter !== 'all') count++;
    count += activeTags.length;
    if (searchQuery) count++;
    if (platformFilters.length > 0) count++;
    return count;
  },
}));

// ─── Sort helper ───────────────────────────────────────────────────

function sortMarkets(markets, sortBy, sortOrder) {
  const sorted = [...markets];
  const dir = sortOrder === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    switch (sortBy) {
      case 'volume':
        return ((b.volume24h || 0) - (a.volume24h || 0)) * dir;
      case 'trending':
        return (Math.abs(b.change24h || 0) - Math.abs(a.change24h || 0)) * dir;
      case 'newest':
        return ((new Date(b.createdDate || 0)).getTime() - (new Date(a.createdDate || 0)).getTime()) * dir;
      case 'closingSoon': {
        const aClose = a.closeDate ? new Date(a.closeDate).getTime() : Infinity;
        const bClose = b.closeDate ? new Date(b.closeDate).getTime() : Infinity;
        return (aClose - bClose) * dir;
      }
      case 'probability': {
        const aProb = a.outcomes?.[0]?.probability || 0;
        const bProb = b.outcomes?.[0]?.probability || 0;
        return (bProb - aProb) * dir;
      }
      default:
        return ((b.volume24h || 0) - (a.volume24h || 0)) * dir;
    }
  });

  return sorted;
}

export default usePredictionStore;
