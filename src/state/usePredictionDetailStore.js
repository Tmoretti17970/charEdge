// ═══════════════════════════════════════════════════════════════════
// charEdge — Prediction Detail Store
//
// Manages state for the single-market detail panel.
// Handles market data, history, order book, trades, and related markets.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { fetchKalshiMarketHistory, fetchKalshiOrderBook } from '../data/adapters/KalshiAdapter.js';
import { fetchPolymarketOrderBook } from '../data/adapters/PolymarketAdapter.js';

const usePredictionDetailStore = create((set, get) => ({
  // ─── State ────────────────────────────────────────────────────
  isOpen: false,
  activeMarketId: null,
  marketData: null,
  history: [],
  orderBook: { bids: [], asks: [], spread: 0 },
  relatedMarkets: [],
  loading: false,
  activeTab: 'overview', // 'overview' | 'chart' | 'book' | 'trades' | 'related'

  // ─── Actions ──────────────────────────────────────────────────

  /**
   * Open the detail panel for a specific market.
   */
  openMarket: (market, allMarkets = []) => {
    set({
      isOpen: true,
      activeMarketId: market.id,
      marketData: market,
      activeTab: 'overview',
      loading: true,
    });

    // Find related markets by shared tags/tickers
    const related = allMarkets
      .filter((m) => m.id !== market.id)
      .map((m) => {
        const tagOverlap = (market.tags || []).filter((t) => (m.tags || []).includes(t)).length;
        const tickerOverlap = (market.relatedTickers || []).filter((t) => (m.relatedTickers || []).includes(t)).length;
        return { market: m, score: tagOverlap * 2 + tickerOverlap * 3 };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((r) => r.market);

    set({ relatedMarkets: related });

    // Fetch history and order book in parallel
    get().fetchMarketDetail(market);
  },

  /**
   * Close the detail panel.
   */
  closeMarket: () => {
    set({
      isOpen: false,
      activeMarketId: null,
      marketData: null,
      history: [],
      orderBook: { bids: [], asks: [], spread: 0 },
      relatedMarkets: [],
      loading: false,
    });
  },

  /**
   * Switch the active tab.
   */
  setTab: (tab) => set({ activeTab: tab }),

  /**
   * Fetch detailed data for a market (history, order book).
   */
  fetchMarketDetail: async (market) => {
    try {
      const ticker = market.id.replace(/^(kalshi-|poly-)/, '');

      const [history, orderBook] = await Promise.allSettled([
        market.source === 'kalshi' ? fetchKalshiMarketHistory(ticker) : Promise.resolve([]),
        market.source === 'kalshi'
          ? fetchKalshiOrderBook(ticker)
          : market.source === 'polymarket'
            ? fetchPolymarketOrderBook(ticker)
            : Promise.resolve({ bids: [], asks: [], spread: 0 }),
      ]);

      set({
        history: history.status === 'fulfilled' ? history.value : [],
        orderBook: orderBook.status === 'fulfilled' ? orderBook.value : { bids: [], asks: [], spread: 0 },
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },
}));

export default usePredictionDetailStore;
