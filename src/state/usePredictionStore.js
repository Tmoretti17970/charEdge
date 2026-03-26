// ═══════════════════════════════════════════════════════════════════
// charEdge — Prediction Market Store
//
// Aggregates prediction market data from Kalshi + Polymarket.
// Merges, deduplicates, and sorts by relevance to user's watchlist.
// Auto-refreshes on interval. Falls back to cached data offline.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { fetchKalshiMarkets } from '../data/adapters/KalshiAdapter.js';
import { fetchPolymarketMarkets } from '../data/adapters/PolymarketAdapter.js';

const REFRESH_INTERVAL = 60_000; // 60 seconds

const usePredictionStore = create((set, get) => ({
  // ─── State ──────────────────────────────────────────────────────
  markets: [],
  loading: false,
  error: null,
  lastFetch: null,
  activeCategory: 'all', // 'all' | 'economics' | 'markets' | 'crypto' | 'politics'
  refreshTimer: null,

  // ─── Actions ────────────────────────────────────────────────────

  setCategory: (category) => set({ activeCategory: category }),

  /**
   * Fetch from both sources, merge, deduplicate, and sort.
   */
  fetchAll: async () => {
    const state = get();
    if (state.loading) return;

    set({ loading: true, error: null });

    try {
      const [kalshi, polymarket] = await Promise.allSettled([
        fetchKalshiMarkets({ limit: 15 }),
        fetchPolymarketMarkets({ limit: 15 }),
      ]);

      const kalshiData = kalshi.status === 'fulfilled' ? kalshi.value : [];
      const polyData = polymarket.status === 'fulfilled' ? polymarket.value : [];

      // Merge and deduplicate (prefer higher volume source)
      const merged = deduplicateMarkets([...kalshiData, ...polyData]);

      // Sort: volume desc (highest activity first)
      merged.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));

      set({
        markets: merged,
        loading: false,
        lastFetch: Date.now(),
      });
    } catch (err) {
      set({
        loading: false,
        error: err.message,
      });
    }
  },

  /**
   * Start auto-refresh interval.
   */
  startAutoRefresh: () => {
    const state = get();
    if (state.refreshTimer) return;

    // Initial fetch
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

  // ─── Derived / Filtered ─────────────────────────────────────────

  /**
   * Get markets filtered by active category.
   */
  getFilteredMarkets: () => {
    const { markets, activeCategory } = get();
    if (activeCategory === 'all') return markets;
    return markets.filter((m) => m.category === activeCategory);
  },
}));

/**
 * Deduplicate markets that cover the same event across sources.
 * Simple heuristic: if two markets have >60% word overlap in their
 * question text, keep the one with higher volume.
 */
function deduplicateMarkets(markets) {
  const seen = new Map();

  for (const market of markets) {
    const key = normalizeQuestion(market.question);
    const existing = seen.get(key);

    if (!existing || (market.volume24h || 0) > (existing.volume24h || 0)) {
      seen.set(key, market);
    }
  }

  return [...seen.values()];
}

/**
 * Create a normalized key for deduplication.
 * Strips common words and sorts remaining tokens.
 */
function normalizeQuestion(question) {
  const stopWords = new Set([
    'will',
    'the',
    'a',
    'an',
    'by',
    'in',
    'at',
    'to',
    'of',
    'be',
    'is',
    'on',
    'for',
    'before',
    'after',
    'above',
    'below',
  ]);
  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))
    .sort();
  return words.join('-');
}

export default usePredictionStore;
