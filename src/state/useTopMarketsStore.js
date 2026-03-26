// ═══════════════════════════════════════════════════════════════════
// charEdge — Top Markets Store
//
// Zustand store for the Top discovery tab. Fetches ranked market
// data from CoinGecko (crypto) + SymbolRegistry/QuoteService
// (stocks/futures/ETFs). Manages pagination, sorting, and filtering.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { fetchTopMarkets, clearTopMarketsCache } from '../data/adapters/TopMarketsAdapter.js';

const REFRESH_INTERVAL = 120_000; // 2 min auto-refresh

const useTopMarketsStore = create((set, get) => ({
  // ─── Data ─────────────────────────────────────────────────
  markets: [],
  loading: false,
  error: null,
  lastFetch: null,
  sources: { crypto: { count: 0, error: null }, equities: { count: 0, error: null } },

  // ─── Filters & Sort ───────────────────────────────────────
  sortBy: 'rank', // 'rank' | 'price' | 'change24h' | 'change7d' | 'marketCap' | 'volume24h'
  sortDir: 'asc', // 'asc' | 'desc'
  assetClassFilter: 'all', // 'all' | 'crypto' | 'stock' | 'etf' | 'futures' | 'forex'
  topicFilter: null, // null | 'ai' | 'defi' | 'rwa' | 'memes' | 'layer2' | ...
  searchQuery: '',

  // ─── Pagination ───────────────────────────────────────────
  page: 1,
  pageSize: 50,

  // ─── Refresh ──────────────────────────────────────────────
  _refreshTimer: null,

  // ─── Actions ──────────────────────────────────────────────

  fetchAll: async (force = false) => {
    const state = get();
    if (state.loading) return;

    set({ loading: true, error: null });

    try {
      const result = await fetchTopMarkets({
        cryptoPages: 1,
        includeEquities: true,
        forceRefresh: force,
      });

      set({
        markets: result.markets,
        sources: result.sources,
        lastFetch: Date.now(),
        loading: false,
      });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  startAutoRefresh: () => {
    const state = get();
    if (state._refreshTimer) return;

    // Initial fetch
    get().fetchAll();

    const timer = setInterval(() => {
      get().fetchAll(true);
    }, REFRESH_INTERVAL);

    set({ _refreshTimer: timer });
  },

  stopAutoRefresh: () => {
    const state = get();
    if (state._refreshTimer) {
      clearInterval(state._refreshTimer);
      set({ _refreshTimer: null });
    }
  },

  // ─── Sort ─────────────────────────────────────────────────

  setSortBy: (key) => {
    const state = get();
    if (state.sortBy === key) {
      set({ sortDir: state.sortDir === 'asc' ? 'desc' : 'asc' });
    } else {
      set({ sortBy: key, sortDir: key === 'rank' ? 'asc' : 'desc' });
    }
    set({ page: 1 });
  },

  // ─── Filter ───────────────────────────────────────────────

  setAssetClassFilter: (cls) => set({ assetClassFilter: cls, page: 1 }),
  setTopicFilter: (topic) => set({ topicFilter: topic, page: 1 }),
  setSearchQuery: (q) => set({ searchQuery: q, page: 1 }),
  clearFilters: () => set({ assetClassFilter: 'all', topicFilter: null, searchQuery: '', page: 1 }),

  // ─── Pagination ───────────────────────────────────────────

  setPage: (p) => set({ page: p }),
  nextPage: () => set((s) => ({ page: s.page + 1 })),
  prevPage: () => set((s) => ({ page: Math.max(1, s.page - 1) })),

  // ─── Derived: filtered + sorted + paginated ───────────────

  getFilteredMarkets: () => {
    const state = get();
    let filtered = [...state.markets];

    // Asset class filter
    if (state.assetClassFilter !== 'all') {
      filtered = filtered.filter((m) => m.assetClass === state.assetClassFilter);
    }

    // Topic filter (crypto narratives + stock sectors)
    if (state.topicFilter) {
      const topicKeywords = TOPIC_KEYWORDS[state.topicFilter] || [];
      filtered = filtered.filter((m) =>
        topicKeywords.some(
          (kw) =>
            m.name?.toLowerCase().includes(kw) ||
            m.symbol?.toLowerCase().includes(kw),
        ) || (m.sector && m.sector.toLowerCase() === state.topicFilter),
      );
    }

    // Search
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      filtered = filtered.filter((m) => m.name?.toLowerCase().includes(q) || m.symbol?.toLowerCase().includes(q));
    }

    // Sort
    filtered.sort((a, b) => {
      const key = state.sortBy;
      const va = a[key] ?? (state.sortDir === 'asc' ? Infinity : -Infinity);
      const vb = b[key] ?? (state.sortDir === 'asc' ? Infinity : -Infinity);
      return state.sortDir === 'asc' ? va - vb : vb - va;
    });

    return filtered;
  },

  getPaginatedMarkets: () => {
    const state = get();
    const filtered = state.getFilteredMarkets();
    const start = (state.page - 1) * state.pageSize;
    return {
      items: filtered.slice(start, start + state.pageSize),
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / state.pageSize),
      page: state.page,
    };
  },

  // ─── Cache ────────────────────────────────────────────────

  clearCache: () => {
    clearTopMarketsCache();
    set({ markets: [], lastFetch: null });
  },
}));

// ─── Topic keyword mapping for narrative filters ────────────
const TOPIC_KEYWORDS = {
  // Crypto narratives
  ai: ['ai', 'artificial', 'gpt', 'neural', 'render', 'fetch', 'ocean', 'singularity', 'agi', 'bittensor', 'tau'],
  defi: ['swap', 'lend', 'aave', 'compound', 'uniswap', 'sushi', 'curve', 'maker', 'yearn', 'dex', 'defi'],
  rwa: ['real world', 'rwa', 'tokenized', 'ondo', 'centrifuge', 'maple', 'goldfinch'],
  memes: ['doge', 'shib', 'pepe', 'floki', 'bonk', 'wif', 'meme', 'cat', 'frog'],
  layer2: ['layer 2', 'l2', 'arbitrum', 'optimism', 'polygon', 'zksync', 'starknet', 'base', 'scroll', 'linea'],
  gaming: ['game', 'gaming', 'axie', 'sandbox', 'gala', 'imx', 'immutable', 'ronin', 'beam'],
  infrastructure: ['chain', 'network', 'protocol', 'cosmos', 'polkadot', 'avalanche', 'near', 'solana'],
  // Stock sector topics
  mag7: ['aapl', 'msft', 'googl', 'amzn', 'nvda', 'meta', 'tsla'],
  semis: ['nvda', 'amd', 'intc', 'qcom', 'txn', 'avgo', 'mrvl', 'mu', 'asml', 'tsm', 'lrcx', 'amat', 'klac', 'cdns', 'snps', 'smci', 'arm', 'soxl'],
  ev: ['tsla', 'rivn', 'lcid', 'nio', 'li', 'xpev'],
  banks: ['jpm', 'bac', 'gs', 'ms', 'c', 'wfc', 'usb', 'schw', 'blk', 'sofi'],
  biotech: ['lly', 'abbv', 'mrk', 'pfe', 'bmy', 'gild', 'vrtx', 'regn', 'amgn', 'isrg', 'dxcm'],
  defense: ['lmt', 'rtx', 'noc', 'gd', 'ba'],
  energy: ['xom', 'cvx', 'cop', 'slb', 'eog', 'psx', 'vlo', 'mpc', 'oxy'],
  saas: ['crm', 'now', 'shop', 'snow', 'ddog', 'zs', 'net', 'panw', 'crwd', 'okta', 'twlo', 'mdb', 'wday', 'team'],
  retail: ['wmt', 'cost', 'tgt', 'hd', 'low', 'rost', 'nke', 'lulu', 'sbux', 'mcd'],
  china: ['baba', 'jd', 'pdd', 'nio', 'li', 'xpev'],
};

export { useTopMarketsStore };
export default useTopMarketsStore;
