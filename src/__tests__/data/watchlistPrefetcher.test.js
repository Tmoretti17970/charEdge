// ═══════════════════════════════════════════════════════════════════
// charEdge — WatchlistPrefetcher Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock useWatchlistStore before import
const mockStoreState = {
    items: [
        { symbol: 'BTC', name: 'Bitcoin', assetClass: 'crypto' },
        { symbol: 'ETH', name: 'Ethereum', assetClass: 'crypto' },
        { symbol: 'AAPL', name: 'Apple', assetClass: 'stocks' },
    ],
};
let subscribeCallback = null;
const mockUnsubscribe = vi.fn();

vi.mock('../../state/useWatchlistStore.ts', () => ({
    useWatchlistStore: {
        getState: () => mockStoreState,
        subscribe: (cb) => {
            subscribeCallback = cb;
            return mockUnsubscribe;
        },
    },
}));

vi.mock('../../constants.js', () => ({
    isCrypto: (sym) => ['BTC', 'ETH', 'SOL'].includes(sym),
}));

// Dynamic import to ensure mocks are applied
let WatchlistPrefetcher;
let prefetcher;

describe('WatchlistPrefetcher', () => {
    beforeEach(async () => {
        vi.useFakeTimers();
        // Dynamic import — path from src/__tests__/data/ to src/data/engine/streaming/
        const mod = await import('../../data/engine/streaming/WatchlistPrefetcher.ts');
        WatchlistPrefetcher = mod.WatchlistPrefetcher;
        prefetcher = new WatchlistPrefetcher();
        subscribeCallback = null;
        mockUnsubscribe.mockClear();
    });

    afterEach(() => {
        if (prefetcher) prefetcher.stop();
        vi.useRealTimers();
    });

    it('starts and subscribes to watchlist', () => {
        prefetcher.start();
        expect(subscribeCallback).not.toBeNull();
    });

    it('stops and unsubscribes', () => {
        prefetcher.start();
        prefetcher.stop();
        expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('does not double-start', () => {
        prefetcher.start();
        prefetcher.start();
        expect(mockUnsubscribe).not.toHaveBeenCalled();
    });

    it('isPrefetched returns false for uncached symbols', () => {
        expect(prefetcher.isPrefetched('BTC')).toBe(false);
        expect(prefetcher.isPrefetched('ETH')).toBe(false);
    });

    it('getStats returns initial empty state', () => {
        const stats = prefetcher.getStats();
        expect(stats.cached).toBe(0);
        expect(stats.symbols).toEqual([]);
    });

    it('defaults max prefetch to 5', () => {
        expect(prefetcher.maxPrefetch).toBe(5);
    });

    it('defaults timeframe to 1h', () => {
        expect(prefetcher.tf).toBe('1h');
    });

    it('stop cancels debounce timer without errors', () => {
        prefetcher.start();
        if (subscribeCallback) subscribeCallback();
        prefetcher.stop();
        // Advancing timers should not cause errors
        vi.advanceTimersByTime(3000);
    });
});
