// ═══════════════════════════════════════════════════════════════════
// charEdge — barBisect + ChartAPI + TimeSeriesStore Tests
//
// Tests for Wave 5 engine hardening utilities.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import { barBisect, barNearest, barRange } from '../../engine/barBisect.js';

// ─── Helper ─────────────────────────────────────────────────────

function makeBars(n, startT = 1000000) {
    return Array.from({ length: n }, (_, i) => ({
        t: startT + i * 60000, // 1-minute bars
        o: 100 + i,
        h: 105 + i,
        l: 95 + i,
        c: 102 + i,
        v: 1000,
    }));
}

// ═══════════════════════════════════════════════════════════════════
// barBisect
// ═══════════════════════════════════════════════════════════════════

describe('barBisect', () => {
    const bars = makeBars(100);

    it('finds exact match', () => {
        const idx = barBisect(bars, bars[50].t);
        expect(idx).toBe(50);
    });

    it('finds first bar', () => {
        expect(barBisect(bars, bars[0].t)).toBe(0);
    });

    it('finds last bar', () => {
        expect(barBisect(bars, bars[99].t)).toBe(99);
    });

    it('returns negative for missing timestamp (insertion point)', () => {
        const missingT = bars[0].t + 30000; // between bar 0 and bar 1
        const idx = barBisect(bars, missingT);
        expect(idx).toBeLessThan(0);
        expect(~idx).toBe(1); // would insert at index 1
    });

    it('returns ~ 0 for timestamp before all bars', () => {
        const idx = barBisect(bars, 0);
        expect(idx).toBeLessThan(0);
        expect(~idx).toBe(0);
    });

    it('returns ~length for timestamp after all bars', () => {
        const idx = barBisect(bars, bars[99].t + 999999);
        expect(idx).toBeLessThan(0);
        expect(~idx).toBe(100);
    });

    it('handles empty array', () => {
        const idx = barBisect([], 1000);
        expect(~idx).toBe(0);
    });

    it('handles single element', () => {
        const singleBar = [{ t: 5000 }];
        expect(barBisect(singleBar, 5000)).toBe(0);
        expect(barBisect(singleBar, 4000)).toBeLessThan(0);
    });
});

// ═══════════════════════════════════════════════════════════════════
// barNearest
// ═══════════════════════════════════════════════════════════════════

describe('barNearest', () => {
    const bars = makeBars(100);

    it('returns exact match index', () => {
        expect(barNearest(bars, bars[25].t)).toBe(25);
    });

    it('returns nearest when between two bars', () => {
        const t = bars[10].t + 20000; // closer to bar[10] than bar[11]
        expect(barNearest(bars, t)).toBe(10);
    });

    it('returns 0 for timestamp before all bars', () => {
        expect(barNearest(bars, 0)).toBe(0);
    });

    it('returns last index for timestamp after all bars', () => {
        expect(barNearest(bars, Infinity)).toBe(99);
    });

    it('returns -1 for empty array', () => {
        expect(barNearest([], 5000)).toBe(-1);
    });
});

// ═══════════════════════════════════════════════════════════════════
// barRange
// ═══════════════════════════════════════════════════════════════════

describe('barRange', () => {
    const bars = makeBars(100);

    it('returns correct range for subset', () => {
        const { startIdx, endIdx, count } = barRange(bars, bars[10].t, bars[20].t);
        expect(startIdx).toBe(10);
        expect(endIdx).toBe(20);
        expect(count).toBe(11);
    });

    it('returns full range when encompassing all bars', () => {
        const { startIdx, endIdx, count } = barRange(bars, 0, Infinity);
        expect(startIdx).toBe(0);
        expect(endIdx).toBe(99);
        expect(count).toBe(100);
    });

    it('returns zero count for range with no bars', () => {
        const { count } = barRange(bars, 0, 999);
        expect(count).toBe(0);
    });

    it('handles empty array', () => {
        const { count } = barRange([], 0, Infinity);
        expect(count).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════
// TimeSeriesStore (in-memory only, no IDB in Node)
// ═══════════════════════════════════════════════════════════════════

describe('TimeSeriesStore', () => {
    it('can be imported', async () => {
        const { TimeSeriesStore } = await import('../../data/engine/TimeSeriesStore.js');
        expect(TimeSeriesStore).toBeDefined();
    });

    it('initializes without IndexedDB', async () => {
        const { TimeSeriesStore } = await import('../../data/engine/TimeSeriesStore.js');
        const store = new TimeSeriesStore();
        await store.init();
        expect(store._initialized).toBe(true);
    });

    it('writes and reads bars from memory cache', async () => {
        const { TimeSeriesStore } = await import('../../data/engine/TimeSeriesStore.js');
        const store = new TimeSeriesStore();
        await store.init();

        const bars = makeBars(50);
        await store.write('BTC', '1m', bars);

        const result = await store.read('BTC', '1m', bars[0].t, bars[49].t);
        expect(result.length).toBe(50);
        expect(result[0].t).toBe(bars[0].t);
        expect(result[49].t).toBe(bars[49].t);
    });

    it('reads subset of bars by time range', async () => {
        const { TimeSeriesStore } = await import('../../data/engine/TimeSeriesStore.js');
        const store = new TimeSeriesStore();
        await store.init();

        const bars = makeBars(100);
        await store.write('ETH', '5m', bars);

        const result = await store.read('ETH', '5m', bars[20].t, bars[30].t);
        expect(result.length).toBe(11);
    });

    it('returns empty array for non-existent data', async () => {
        const { TimeSeriesStore } = await import('../../data/engine/TimeSeriesStore.js');
        const store = new TimeSeriesStore();
        await store.init();

        const result = await store.read('MISSING', '1h', 0, Infinity);
        expect(result).toEqual([]);
    });

    it('LRU cache evicts oldest blocks', async () => {
        const { LRUCache } = await import('../../data/engine/TimeSeriesStore.js');
        const cache = new LRUCache(3);

        cache.set('a', 1);
        cache.set('b', 2);
        cache.set('c', 3);
        cache.set('d', 4); // should evict 'a'

        expect(cache.has('a')).toBe(false);
        expect(cache.has('d')).toBe(true);
        expect(cache.size).toBe(3);
    });

    it('LRU cache promotes on access', async () => {
        const { LRUCache } = await import('../../data/engine/TimeSeriesStore.js');
        const cache = new LRUCache(3);

        cache.set('a', 1);
        cache.set('b', 2);
        cache.set('c', 3);

        cache.get('a'); // promote 'a'

        cache.set('d', 4); // should evict 'b' (oldest after promotion)

        expect(cache.has('a')).toBe(true);
        expect(cache.has('b')).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════
// ChartAPI
// ═══════════════════════════════════════════════════════════════════

describe('ChartAPI', () => {
    it('can be imported', async () => {
        const { ChartAPI } = await import('../../engine/ChartAPI.js');
        expect(ChartAPI).toBeDefined();
        expect(typeof ChartAPI.create).toBe('function');
    });

    it('creates API from chart store', async () => {
        const { ChartAPI } = await import('../../engine/ChartAPI.js');
        const { useChartStore } = await import('../../state/useChartStore.ts');
        const api = ChartAPI.create(useChartStore);

        expect(typeof api.setSymbol).toBe('function');
        expect(typeof api.getSymbol).toBe('function');
        expect(typeof api.setInterval).toBe('function');
        expect(typeof api.getIndicators).toBe('function');
        expect(typeof api.subscribe).toBe('function');
        expect(typeof api.destroy).toBe('function');
    });

    it('setSymbol validates input', async () => {
        const { ChartAPI } = await import('../../engine/ChartAPI.js');
        const { useChartStore } = await import('../../state/useChartStore.ts');
        const api = ChartAPI.create(useChartStore);

        expect(() => api.setSymbol('')).toThrow(TypeError);
        expect(() => api.setSymbol(null)).toThrow(TypeError);
    });

    it('setSymbol updates store', async () => {
        const { ChartAPI } = await import('../../engine/ChartAPI.js');
        const { useChartStore } = await import('../../state/useChartStore.ts');
        const api = ChartAPI.create(useChartStore);

        const original = api.getSymbol();
        api.setSymbol('SOL');
        expect(api.getSymbol()).toBe('SOL');
        api.setSymbol(original); // restore
    });

    it('setInterval rejects invalid intervals', async () => {
        const { ChartAPI } = await import('../../engine/ChartAPI.js');
        const { useChartStore } = await import('../../state/useChartStore.ts');
        const api = ChartAPI.create(useChartStore);

        expect(() => api.setInterval('2m')).toThrow(RangeError);
        expect(() => api.setInterval('invalid')).toThrow(RangeError);
    });
});
