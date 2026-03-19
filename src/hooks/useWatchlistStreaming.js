// ═══════════════════════════════════════════════════════════════════
// charEdge — useWatchlistStreaming (Sprints 4, 54, 55)
//
// Custom hook that manages WebSocket subscriptions for live price
// updates across all watchlist symbols.
//
// Sprint 54: Batch subscribe + adaptive streaming (visible vs offscreen)
// Sprint 55: IndexedDB cache integration for instant load
//
// Uses WebSocketService.subscribeKlineOnly() for lightweight background
// streaming — no trade feed, just 1m candle updates (~1 msg/s per sym).
//
// Returns: Map<symbol, { price, change, changePercent, volume, lastUpdate }>
//
// For non-crypto symbols: falls back to 30s polling via fetch24hTicker.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Subscribe to real-time prices for a list of symbols.
 *
 * @param {string[]} symbols - Array of symbols to stream
 * @param {boolean} enabled - Whether streaming is active
 * @param {string[]} [visibleSymbols] - Sprint 54: Only these symbols get full-rate streaming
 * @returns {{ prices: Object, wsStatus: string }}
 */
export default function useWatchlistStreaming(symbols, enabled = true, visibleSymbols = null) {
  const [prices, setPrices] = useState({});
  const [wsStatus, setWsStatus] = useState('disconnected');
  const subIdsRef = useRef([]);
  const pollTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const cacheLoadedRef = useRef(false);

  // Separate crypto vs non-crypto symbols
  const cryptoSymbols = symbols.filter(s =>
    ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK', 'UNI', 'LTC'].includes(s.toUpperCase()),
  );
  const otherSymbols = symbols.filter(s => !cryptoSymbols.includes(s));

  // ─── Sprint 55: Load cached prices on mount (instant load) ────
  useEffect(() => {
    if (!enabled || symbols.length === 0 || cacheLoadedRef.current) return;

    import('../services/WatchlistCache').then(async ({ getCached }) => {
      if (!mountedRef.current) return;

      const cachedPrices = await getCached('prices', symbols);
      if (!mountedRef.current || Object.keys(cachedPrices).length === 0) return;

      setPrices(prev => {
        const merged = { ...prev };
        for (const [sym, data] of Object.entries(cachedPrices)) {
          // Only use cache if we don't already have live data
          if (!merged[sym] || !merged[sym].source || merged[sym].source === 'cache') {
            merged[sym] = { ...data, source: 'cache' };
          }
        }
        return merged;
      });
      cacheLoadedRef.current = true;
    }).catch(() => { /* cache is best-effort */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, symbols.join(',')]);

  // ─── Sprint 55: Persist prices to IndexedDB cache ─────────────
  const persistToCache = useCallback((sym, priceData) => {
    import('../services/WatchlistCache').then(({ setCached }) => {
      setCached('prices', { [sym]: priceData });
    }).catch(() => { /* best-effort */ });
  }, []);

  // ─── Crypto: WebSocket streaming via Binance kline ────────────
  useEffect(() => {
    if (!enabled || cryptoSymbols.length === 0) return;
    mountedRef.current = true;
    let wsServiceInstance = null;

    import('../data/WebSocketService').then(({ wsService }) => {
      if (!mountedRef.current) return;
      wsServiceInstance = wsService;

      // Sprint 54: Batch subscribe — subscribe all at once.
      // The underlying WebSocketService debounces via _scheduleStreamUpdate (50ms),
      // so all subscriptions within this tick get batched into a single WS message.
      const ids = cryptoSymbols.map(sym => {
        // Sprint 54: Adaptive streaming — visible symbols get 1m, offscreen get 5m
        const isVisible = !visibleSymbols || visibleSymbols.includes(sym);
        const tf = isVisible ? '1m' : '5m';

        return wsService.subscribeKlineOnly(sym, tf, {
          onBar: (bar) => {
            if (!mountedRef.current) return;
            const priceData = {
              price: bar.close,
              high: bar.high,
              low: bar.low,
              volume: bar.volume,
              lastUpdate: Date.now(),
              source: 'ws',
            };
            setPrices(prev => ({
              ...prev,
              [sym]: priceData,
            }));
            // Sprint 55: Persist to cache
            persistToCache(sym, priceData);
          },
          onStatus: (status) => {
            if (mountedRef.current) setWsStatus(status);
          },
        });
      });

      subIdsRef.current = ids;
    });

    return () => {
      mountedRef.current = false;
      // Cleanup subscriptions
      if (wsServiceInstance && subIdsRef.current.length > 0) {
        for (const id of subIdsRef.current) {
          wsServiceInstance.unsubscribe(id);
        }
        subIdsRef.current = [];
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, cryptoSymbols.join(',')]);

  // ─── Non-crypto: 30s polling via fetch24hTicker ───────────────
  useEffect(() => {
    if (!enabled || otherSymbols.length === 0) return;
    mountedRef.current = true;

    const fetchPrices = async () => {
      try {
        const { fetch24hTicker } = await import('../data/FetchService');
        const results = await fetch24hTicker(otherSymbols);
        if (!mountedRef.current) return;

        setPrices(prev => {
          const updated = { ...prev };
          for (const t of results) {
            if (t?.symbol) {
              const sym = t.symbol.replace('USDT', '').replace('USD', '');
              const priceData = {
                price: parseFloat(t.lastPrice),
                change: parseFloat(t.priceChange),
                changePercent: parseFloat(t.priceChangePercent),
                volume: parseFloat(t.volume),
                lastUpdate: Date.now(),
                source: 'poll',
              };
              updated[sym] = priceData;
              updated[t.symbol] = priceData;
              // Sprint 55: Persist
              persistToCache(sym, priceData);
            }
          }
          return updated;
        });
      } catch {
        // Silently fail — polling is best-effort
      }
    };

    // Initial fetch
    fetchPrices();

    // Poll every 30s
    pollTimerRef.current = setInterval(fetchPrices, 30_000);

    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, otherSymbols.join(',')]);

  return { prices, wsStatus };
}
