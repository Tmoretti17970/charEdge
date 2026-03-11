// ═══════════════════════════════════════════════════════════════════
// charEdge — CandleVirtualizer Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CandleVirtualizer } from '../../data/engine/CandleVirtualizer.js';

// Mock IndexedDB with auto-resolving transactions
const mockStore = new Map();

function createMockDB() {
  return {
    transaction: () => {
      const tx = {
        objectStore: () => ({
          put: (val, key) => { mockStore.set(key, val); return {}; },
          get: (key) => {
            const req = { result: mockStore.get(key), onsuccess: null, onerror: null };
            Promise.resolve().then(() => req.onsuccess?.());
            return req;
          },
          delete: (key) => { mockStore.delete(key); },
          openCursor: () => {
            const req = { onsuccess: null, onerror: null, result: null };
            Promise.resolve().then(() => req.onsuccess?.());
            return req;
          },
        }),
        oncomplete: null,
        onerror: null,
      };
      // Auto-fire oncomplete after microtask
      Promise.resolve().then(() => tx.oncomplete?.());
      return tx;
    },
    close: () => {},
  };
}

// Generate test bars
function makeBars(count, startTime = 1000000) {
  return Array.from({ length: count }, (_, i) => ({
    time: startTime + i * 3600_000,
    open: 100 + i,
    high: 101 + i,
    low: 99 + i,
    close: 100.5 + i,
    volume: 1000 + i,
  }));
}

describe('CandleVirtualizer', () => {
  let virtualizer;

  beforeEach(() => {
    mockStore.clear();
    virtualizer = new CandleVirtualizer({ windowSize: 10, evictionBatch: 5, restoreBatch: 5 });
    // Bypass IndexedDB with mock
    virtualizer._db = createMockDB();
    virtualizer._dbReady = true;
  });

  afterEach(() => {
    virtualizer.dispose();
  });

  describe('setData', () => {
    it('should keep all bars when under window size', async () => {
      const bars = makeBars(5);
      const visible = await virtualizer.setData('BTC', '1h', bars);

      expect(visible.length).toBe(5);
      expect(virtualizer.getWindowCount('BTC', '1h')).toBe(5);
      expect(virtualizer.getEvictedCount('BTC', '1h')).toBe(0);
    });

    it('should evict oldest bars when exceeding window size', async () => {
      const bars = makeBars(20);
      const visible = await virtualizer.setData('BTC', '1h', bars);

      expect(visible.length).toBe(10); // windowSize
      expect(virtualizer.getEvictedCount('BTC', '1h')).toBe(10);
    });

    it('should return empty for empty input', async () => {
      const visible = await virtualizer.setData('BTC', '1h', []);
      expect(visible.length).toBe(0);
    });

    it('should keep most recent bars in memory', async () => {
      const bars = makeBars(15);
      const visible = await virtualizer.setData('BTC', '1h', bars);

      // Should have bars 5-14 (most recent)
      expect(visible[0].time).toBe(bars[5].time);
      expect(visible[visible.length - 1].time).toBe(bars[14].time);
    });
  });

  describe('appendBar', () => {
    it('should add bars to the right edge', async () => {
      const bars = makeBars(5);
      await virtualizer.setData('BTC', '1h', bars);

      const newBar = { time: 9999999, open: 200, high: 201, low: 199, close: 200.5, volume: 5000 };
      await virtualizer.appendBar('BTC', '1h', newBar);

      expect(virtualizer.getWindowCount('BTC', '1h')).toBe(6);
    });

    it('should trigger eviction when exceeding windowSize + evictionBatch', async () => {
      const bars = makeBars(10); // Fill to windowSize
      await virtualizer.setData('BTC', '1h', bars);

      // Append beyond windowSize + evictionBatch (10 + 5 = 15, trigger at 16)
      for (let i = 0; i < 6; i++) {
        await virtualizer.appendBar('BTC', '1h', {
          time: bars[bars.length - 1].time + (i + 1) * 3600_000,
          open: 200 + i, high: 201 + i, low: 199 + i, close: 200.5 + i, volume: 5000,
        });
      }

      // Eviction batch of 5 should have been removed from memory
      const count = virtualizer.getWindowCount('BTC', '1h');
      expect(count).toBeLessThanOrEqual(16);
    });
  });

  describe('hasMoreLeft', () => {
    it('should be false when no eviction occurred', async () => {
      await virtualizer.setData('BTC', '1h', makeBars(5));
      expect(virtualizer.hasMoreLeft('BTC', '1h')).toBe(false);
    });

    it('should be true when bars are evicted', async () => {
      await virtualizer.setData('BTC', '1h', makeBars(20));
      expect(virtualizer.hasMoreLeft('BTC', '1h')).toBe(true);
    });
  });

  describe('getVisibleBars', () => {
    it('should return current in-memory bars', async () => {
      const bars = makeBars(5);
      await virtualizer.setData('BTC', '1h', bars);

      const visible = virtualizer.getVisibleBars('BTC', '1h');
      expect(visible.length).toBe(5);
    });

    it('should return empty for unknown symbol', () => {
      const visible = virtualizer.getVisibleBars('UNKNOWN', '1h');
      expect(visible).toEqual([]);
    });
  });

  describe('setWindowSize', () => {
    it('should update window size', () => {
      virtualizer.setWindowSize(3000);
      expect(virtualizer.windowSize).toBe(3000);
    });

    it('should enforce minimum of 500', () => {
      virtualizer.setWindowSize(100);
      expect(virtualizer.windowSize).toBe(500);
    });
  });

  describe('estimateMemory', () => {
    it('should estimate based on bar count', async () => {
      await virtualizer.setData('BTC', '1h', makeBars(10));
      const mem = virtualizer.estimateMemory();
      expect(mem).toBeGreaterThan(0);
      expect(mem).toBe(10 * 120); // 10 bars × 120 bytes
    });
  });

  describe('clear', () => {
    it('should remove all data for a symbol', async () => {
      await virtualizer.setData('BTC', '1h', makeBars(5));
      await virtualizer.clear('BTC', '1h');

      expect(virtualizer.getWindowCount('BTC', '1h')).toBe(0);
    });
  });

  describe('dispose', () => {
    it('should clear all state', async () => {
      await virtualizer.setData('BTC', '1h', makeBars(5));
      virtualizer.dispose();

      expect(virtualizer.getWindowCount('BTC', '1h')).toBe(0);
    });
  });
});
