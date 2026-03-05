// ═══════════════════════════════════════════════════════════════════
// charEdge — WatchlistPrefetcher
//
// Background service that prefetches OHLC data for watchlist symbols.
// Uses requestIdleCallback to avoid blocking the main thread.
//
// How it works:
//   1. Subscribe to useWatchlistStore changes
//   2. Diff watchlist against already-prefetched set
//   3. Fetch OHLC data for new symbols during idle frames
//   4. Store via DataCache.putCandles() for instant chart loading
//
// Usage:
//   import { watchlistPrefetcher } from './WatchlistPrefetcher.ts';
//   watchlistPrefetcher.start();   // on app mount
//   watchlistPrefetcher.stop();    // on app unmount
// ═══════════════════════════════════════════════════════════════════

import { useWatchlistStore } from '../../../state/useWatchlistStore.js';
import { isCrypto } from '../../../constants.js';
import { logger } from '../../../utils/logger';

// ─── Configuration ─────────────────────────────────────────────

/** Max symbols to prefetch concurrently. */
const MAX_PREFETCH = 5;

/** Default timeframe for prefetch. */
const DEFAULT_TF = '1h';

/** Debounce delay for watchlist changes (ms). */
const DEBOUNCE_MS = 2000;

/** Minimum interval between prefetch cycles (ms). */
const MIN_CYCLE_INTERVAL_MS = 30000;

// ─── Types ─────────────────────────────────────────────────────

interface PrefetchEntry {
    symbol: string;
    tf: string;
    fetchedAt: number;
    barCount: number;
}

// ─── WatchlistPrefetcher ───────────────────────────────────────

class WatchlistPrefetcher {
    /** Symbols already prefetched with timestamps. */
    private _cache: Map<string, PrefetchEntry> = new Map();

    /** Zustand unsubscribe function. */
    private _unsub: (() => void) | null = null;

    /** Debounce timer for watchlist changes. */
    private _debounceTimer: ReturnType<typeof setTimeout> | null = null;

    /** requestIdleCallback handle. */
    private _idleHandle: number | null = null;

    /** Whether the prefetcher is actively running. */
    private _running = false;

    /** Timestamp of last prefetch cycle start. */
    private _lastCycleAt = 0;

    /** Pending fetch abort controllers. */
    private _abortControllers: Set<AbortController> = new Set();

    /** Timeframe to prefetch. */
    tf = DEFAULT_TF;

    /** Max symbols to prefetch. */
    maxPrefetch = MAX_PREFETCH;

    // ─── Lifecycle ──────────────────────────────────────────────

    /**
     * Start monitoring watchlist and prefetching data.
     * Safe to call multiple times — only starts once.
     */
    start(): void {
        if (this._running) return;
        this._running = true;

        // Subscribe to watchlist changes
        this._unsub = useWatchlistStore.subscribe(() => {
            this._schedulePrefetch();
        });

        // Trigger initial prefetch
        this._schedulePrefetch();
    }

    /**
     * Stop prefetching and clean up.
     */
    stop(): void {
        this._running = false;

        if (this._unsub) {
            this._unsub();
            this._unsub = null;
        }

        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = null;
        }

        if (this._idleHandle !== null) {
            if (typeof cancelIdleCallback !== 'undefined') {
                cancelIdleCallback(this._idleHandle);
            }
            this._idleHandle = null;
        }

        // Abort any in-flight fetches
        for (const ac of this._abortControllers) {
            ac.abort();
        }
        this._abortControllers.clear();
    }

    // ─── Query ──────────────────────────────────────────────────

    /**
     * Check if a symbol+tf pair is prefetched and fresh.
     */
    isPrefetched(symbol: string, tf: string = this.tf): boolean {
        const key = `${symbol}_${tf}`;
        const entry = this._cache.get(key);
        if (!entry) return false;
        // Consider stale after 5 minutes
        return (Date.now() - entry.fetchedAt) < 300_000;
    }

    /**
     * Get prefetch stats for debugging.
     */
    getStats(): { cached: number; symbols: string[] } {
        return {
            cached: this._cache.size,
            symbols: Array.from(this._cache.keys()),
        };
    }

    // ─── Internal ───────────────────────────────────────────────

    /** Schedule a prefetch cycle with debounce. */
    private _schedulePrefetch(): void {
        if (!this._running) return;

        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }

        this._debounceTimer = setTimeout(() => {
            this._debounceTimer = null;
            this._runPrefetchCycle();
        }, DEBOUNCE_MS);
    }

    /** Run prefetch cycle during idle time. */
    private _runPrefetchCycle(): void {
        if (!this._running) return;

        // Throttle cycles
        const now = Date.now();
        if (now - this._lastCycleAt < MIN_CYCLE_INTERVAL_MS) return;
        this._lastCycleAt = now;

        // Use requestIdleCallback if available, otherwise setTimeout
        if (typeof requestIdleCallback !== 'undefined') {
            this._idleHandle = requestIdleCallback((deadline) => {
                this._idleHandle = null;
                this._executePrefetch(deadline);
            }, { timeout: 5000 });
        } else {
            setTimeout(() => this._executePrefetch(null), 100);
        }
    }

    /** Execute the actual prefetch work. */
    private async _executePrefetch(
        deadline: IdleDeadline | null,
    ): Promise<void> {
        if (!this._running) return;

        const items = useWatchlistStore.getState().items;
        const symbolsToFetch: string[] = [];

        // Find symbols that need prefetching
        for (let i = 0; i < Math.min(items.length, this.maxPrefetch); i++) {
            const sym = items[i].symbol;
            if (!this.isPrefetched(sym, this.tf)) {
                symbolsToFetch.push(sym);
            }
        }

        if (symbolsToFetch.length === 0) return;

        // Fetch sequentially to avoid overwhelming the server
        for (const sym of symbolsToFetch) {
            if (!this._running) break;

            // Check if we still have idle time
            if (deadline && deadline.timeRemaining() < 5) {
                // Reschedule remaining work
                this._schedulePrefetch();
                break;
            }

            await this._prefetchSymbol(sym, this.tf);
        }
    }

    /**
     * Fetch and cache OHLC data for a single symbol.
     */
    private async _prefetchSymbol(symbol: string, tf: string): Promise<void> {
        const key = `${symbol}_${tf}`;
        const ac = new AbortController();
        this._abortControllers.add(ac);

        try {
            const baseSym = symbol.toUpperCase().replace(/USDT$|BUSD$|USD$/, '');

            let bars: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>;

            if (isCrypto(baseSym)) {
                // Binance REST API
                const base = typeof window === 'undefined'
                    ? `http://localhost:${(globalThis as any).__TF_PORT || 3000}`
                    : '';
                const url = `${base}/api/binance/v3/klines?symbol=${symbol}&interval=${tf}&limit=500`;
                const res = await fetch(url, { signal: ac.signal });

                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();

                bars = data.map((k: any[]) => ({
                    time: k[0],
                    open: +k[1],
                    high: +k[2],
                    low: +k[3],
                    close: +k[4],
                    volume: +k[5],
                }));
            } else {
                // Non-crypto: use FetchService
                const { fetchOHLC } = await import('../../../data/FetchService.ts');
                const TF_MAP: Record<string, string> = {
                    '1m': '1d', '3m': '1d', '5m': '1d', '15m': '5d', '30m': '5d',
                    '1h': '1m', '2h': '1m', '4h': '3m', '6h': '3m', '8h': '3m',
                    '12h': '6m', '1d': '6m', '3d': '1y', '1w': '1y', '1M': '1y',
                };
                const fetchTfId = TF_MAP[tf] || '3m';
                const result = await (fetchOHLC as any)(baseSym, fetchTfId);

                if (!result?.data?.length) return;

                bars = result.data.map((c: any) => ({
                    time: typeof c.time === 'string' ? new Date(c.time).getTime() : c.time,
                    open: c.open, high: c.high, low: c.low, close: c.close,
                    volume: c.volume || 0,
                }));
            }

            if (!this._running) return;

            // Store in DataCache for instant access on chart switch
            try {
                const { dataCache } = await import('../../../data/DataCache.ts');
                await (dataCache as any).putCandles(symbol, tf, bars);
            } catch (_) {
                // DataCache not available — data still in DatafeedService cache
            }

            // Track prefetch state
            this._cache.set(key, {
                symbol, tf,
                fetchedAt: Date.now(),
                barCount: bars.length,
            });

        } catch (err: any) {
            if (err?.name !== 'AbortError') {
                logger.data.warn(`[WatchlistPrefetcher] Failed to prefetch ${key}:`, err?.message);
            }
        } finally {
            this._abortControllers.delete(ac);
        }
    }
}

// ─── Singleton ─────────────────────────────────────────────────

export const watchlistPrefetcher = new WatchlistPrefetcher();
export { WatchlistPrefetcher };
