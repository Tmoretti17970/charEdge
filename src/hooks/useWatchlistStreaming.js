// ═══════════════════════════════════════════════════════════════════
// charEdge — useWatchlistStreaming
//
// Custom hook that manages WebSocket subscriptions for live price
// updates across all watchlist symbols.
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
 * @returns {{ prices: Object, wsStatus: string }}
 */
export default function useWatchlistStreaming(symbols, enabled = true) {
  const [prices, setPrices] = useState({});
  const [wsStatus, setWsStatus] = useState('disconnected');
  const subIdsRef = useRef([]);
  const pollTimerRef = useRef(null);
  const mountedRef = useRef(true);

  // Separate crypto vs non-crypto symbols
  const cryptoSymbols = symbols.filter(s =>
    ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK', 'UNI', 'LTC'].includes(s.toUpperCase()),
  );
  const otherSymbols = symbols.filter(s => !cryptoSymbols.includes(s));

  // ─── Crypto: WebSocket streaming via Binance kline ────────────
  useEffect(() => {
    if (!enabled || cryptoSymbols.length === 0) return;
    mountedRef.current = true;
    let wsServiceInstance = null;

    import('../data/WebSocketService').then(({ wsService }) => {
      if (!mountedRef.current) return;
      wsServiceInstance = wsService;

      // Subscribe to 1m kline for each crypto symbol
      const ids = cryptoSymbols.map(sym => {
        return wsService.subscribeKlineOnly(sym, '1m', {
          onBar: (bar) => {
            if (!mountedRef.current) return;
            setPrices(prev => ({
              ...prev,
              [sym]: {
                price: bar.close,
                high: bar.high,
                low: bar.low,
                volume: bar.volume,
                lastUpdate: Date.now(),
                source: 'ws',
              },
            }));
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
              updated[sym] = {
                price: parseFloat(t.lastPrice),
                change: parseFloat(t.priceChange),
                changePercent: parseFloat(t.priceChangePercent),
                volume: parseFloat(t.volume),
                lastUpdate: Date.now(),
                source: 'poll',
              };
              // Also store with original key
              updated[t.symbol] = updated[sym];
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
