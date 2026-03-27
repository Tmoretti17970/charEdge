import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChartAPI } from '../../engine/ChartAPI.js';

describe('ChartAPI', () => {
  let mockStore;
  let api;

  beforeEach(() => {
    const state = {
      symbol: 'BTC',
      interval: '1h',
      indicators: [],
      bars: [{ t: 1000, o: 100, h: 110, l: 90, c: 105, v: 1000 }],
      setSymbol: vi.fn(),
      setInterval: vi.fn(),
      addIndicator: vi.fn().mockReturnValue('ind_123'),
      removeIndicator: vi.fn(),
    };

    mockStore = {
      getState: () => state,
      setState: vi.fn((partial) => Object.assign(state, partial)),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    api = createChartAPI(mockStore);
  });

  // ─── setSymbol ──────────────────────────────────────────────
  describe('setSymbol', () => {
    it('calls store setSymbol', () => {
      api.setSymbol('ETH');
      expect(mockStore.getState().setSymbol).toHaveBeenCalledWith('ETH');
    });

    it('throws for invalid symbol', () => {
      expect(() => api.setSymbol('')).toThrow(TypeError);
      expect(() => api.setSymbol(null)).toThrow(TypeError);
    });
  });

  // ─── getSymbol ──────────────────────────────────────────────
  describe('getSymbol', () => {
    it('returns current symbol', () => {
      expect(api.getSymbol()).toBe('BTC');
    });
  });

  // ─── setInterval ────────────────────────────────────────────
  describe('setInterval', () => {
    it('calls store setInterval for valid intervals', () => {
      api.setInterval('5m');
      expect(mockStore.getState().setInterval).toHaveBeenCalledWith('5m');
    });

    it('throws for invalid interval', () => {
      expect(() => api.setInterval('invalid')).toThrow(RangeError);
      expect(() => api.setInterval('2h')).toThrow(RangeError);
    });

    it('accepts all valid intervals', () => {
      const valid = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'];
      for (const interval of valid) {
        expect(() => api.setInterval(interval)).not.toThrow();
      }
    });
  });

  // ─── getInterval ────────────────────────────────────────────
  describe('getInterval', () => {
    it('returns current interval', () => {
      expect(api.getInterval()).toBe('1h');
    });
  });

  // ─── addIndicator ───────────────────────────────────────────
  describe('addIndicator', () => {
    it('adds indicator via store action', () => {
      const id = api.addIndicator({ type: 'sma', params: { period: 20 } });
      expect(id).toBe('ind_123');
      expect(mockStore.getState().addIndicator).toHaveBeenCalled();
    });

    it('throws for missing type', () => {
      expect(() => api.addIndicator({})).toThrow(TypeError);
      expect(() => api.addIndicator(null)).toThrow(TypeError);
    });

    it('falls back to manual addition when store lacks addIndicator', () => {
      const state = mockStore.getState();
      delete state.addIndicator;
      const id = api.addIndicator({ type: 'ema', params: { period: 10 } });
      expect(typeof id).toBe('string');
      expect(id).toMatch(/^ind_/);
    });
  });

  // ─── removeIndicator ───────────────────────────────────────
  describe('removeIndicator', () => {
    it('calls store removeIndicator', () => {
      api.removeIndicator('ind_123');
      expect(mockStore.getState().removeIndicator).toHaveBeenCalledWith('ind_123');
    });

    it('throws for missing id', () => {
      expect(() => api.removeIndicator('')).toThrow(TypeError);
      expect(() => api.removeIndicator(null)).toThrow(TypeError);
    });

    it('falls back to manual filter when store lacks removeIndicator', () => {
      const state = mockStore.getState();
      state.indicators = [{ id: 'a' }, { id: 'b' }];
      delete state.removeIndicator;
      api.removeIndicator('a');
      expect(mockStore.setState).toHaveBeenCalled();
    });
  });

  // ─── getIndicators ──────────────────────────────────────────
  describe('getIndicators', () => {
    it('returns indicators array', () => {
      expect(api.getIndicators()).toEqual([]);
    });
  });

  // ─── getVisibleBars ─────────────────────────────────────────
  describe('getVisibleBars', () => {
    it('returns bars from store', () => {
      const bars = api.getVisibleBars();
      expect(bars).toHaveLength(1);
      expect(bars[0]).toHaveProperty('t', 1000);
    });
  });

  // ─── subscribe ──────────────────────────────────────────────
  describe('subscribe', () => {
    it('returns an unsubscribe function', () => {
      const unsub = api.subscribe('symbol', vi.fn());
      expect(typeof unsub).toBe('function');
      unsub();
    });

    it('subscribes to store changes', () => {
      api.subscribe('symbol', vi.fn());
      expect(mockStore.subscribe).toHaveBeenCalled();
    });
  });

  // ─── destroy ────────────────────────────────────────────────
  describe('destroy', () => {
    it('cleans up listeners', () => {
      api.subscribe('symbol', vi.fn());
      api.destroy();
      // Should not throw
    });
  });
});
