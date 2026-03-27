import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('../../data/adapters/KalshiAdapter.js', () => ({
  fetchKalshiMarketHistory: vi.fn().mockResolvedValue([]),
  fetchKalshiOrderBook: vi.fn().mockResolvedValue({ bids: [], asks: [], spread: 0 }),
}));
vi.mock('../../data/adapters/PolymarketAdapter.js', () => ({
  fetchPolymarketOrderBook: vi.fn().mockResolvedValue({ bids: [], asks: [], spread: 0 }),
}));
import usePredictionDetailStore from '../../state/usePredictionDetailStore.js';

describe('usePredictionDetailStore', () => {
  beforeEach(() => {
    usePredictionDetailStore.setState({
      isOpen: false,
      activeMarketId: null,
      marketData: null,
      history: [],
      orderBook: { bids: [], asks: [], spread: 0 },
      relatedMarkets: [],
      loading: false,
      activeTab: 'overview',
    });
  });

  describe('openMarket', () => {
    it('sets the market as open with data', () => {
      const market = { id: 'kalshi-test', source: 'kalshi', tags: ['bitcoin'], relatedTickers: ['BTC'] };
      usePredictionDetailStore.getState().openMarket(market);

      const state = usePredictionDetailStore.getState();
      expect(state.isOpen).toBe(true);
      expect(state.activeMarketId).toBe('kalshi-test');
      expect(state.marketData).toBeDefined();
      expect(state.activeTab).toBe('overview');
    });

    it('finds related markets by tag overlap', () => {
      const market = { id: 'm1', tags: ['bitcoin', 'crypto'], relatedTickers: ['BTC'] };
      const allMarkets = [
        market,
        { id: 'm2', tags: ['bitcoin'], relatedTickers: [] },
        { id: 'm3', tags: ['unrelated'], relatedTickers: [] },
      ];
      usePredictionDetailStore.getState().openMarket(market, allMarkets);

      const state = usePredictionDetailStore.getState();
      expect(state.relatedMarkets.length).toBeGreaterThanOrEqual(1);
      expect(state.relatedMarkets.some((m) => m.id === 'm2')).toBe(true);
      expect(state.relatedMarkets.some((m) => m.id === 'm3')).toBe(false);
    });

    it('finds related markets by ticker overlap', () => {
      const market = { id: 'm1', tags: [], relatedTickers: ['BTC', 'ETH'] };
      const allMarkets = [
        market,
        { id: 'm2', tags: [], relatedTickers: ['BTC'] },
        { id: 'm3', tags: [], relatedTickers: ['AAPL'] },
      ];
      usePredictionDetailStore.getState().openMarket(market, allMarkets);

      const state = usePredictionDetailStore.getState();
      expect(state.relatedMarkets.some((m) => m.id === 'm2')).toBe(true);
    });

    it('limits related markets to 5', () => {
      const market = { id: 'm1', tags: ['bitcoin'], relatedTickers: [] };
      const allMarkets = Array.from({ length: 20 }, (_, i) => ({
        id: `m${i + 2}`,
        tags: ['bitcoin'],
        relatedTickers: [],
      }));
      usePredictionDetailStore.getState().openMarket(market, [market, ...allMarkets]);

      expect(usePredictionDetailStore.getState().relatedMarkets.length).toBeLessThanOrEqual(5);
    });
  });

  describe('closeMarket', () => {
    it('resets all state', () => {
      usePredictionDetailStore.setState({
        isOpen: true,
        activeMarketId: 'test',
        marketData: { id: 'test' },
        history: [1, 2, 3],
        loading: true,
      });

      usePredictionDetailStore.getState().closeMarket();

      const state = usePredictionDetailStore.getState();
      expect(state.isOpen).toBe(false);
      expect(state.activeMarketId).toBeNull();
      expect(state.marketData).toBeNull();
      expect(state.history).toHaveLength(0);
      expect(state.loading).toBe(false);
    });
  });

  describe('setTab', () => {
    it('changes the active tab', () => {
      usePredictionDetailStore.getState().setTab('chart');
      expect(usePredictionDetailStore.getState().activeTab).toBe('chart');
    });
  });
});
