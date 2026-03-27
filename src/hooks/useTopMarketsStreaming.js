// ═══════════════════════════════════════════════════════════════════
// charEdge — Top Markets Streaming Hook
//
// Real-time WebSocket streaming for the Tops discovery tab.
// Streams top N visible crypto via Binance WS, polls equities.
// Adapted from useWatchlistStreaming for TopMarketsStore.
//
// Features:
//   - Binance WS for visible crypto symbols
//   - Smart visibility: only stream what's on-screen
//   - Background tab detection (pauses when hidden)
//   - Price direction tracking for flash animations
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef, useCallback, useState } from 'react';
import useTopMarketsStore from '../state/useTopMarketsStore.js';

const MAX_WS_SYMBOLS = 20; // Max concurrent WebSocket streams
const POLL_INTERVAL = 30_000; // 30s polling for non-crypto

/**
 * Hook that streams real-time prices for top markets.
 *
 * @param {Array} visibleMarkets - Array of market objects currently visible
 * @param {boolean} enabled - Whether streaming is active
 * @returns {{ priceUpdates: Object, wsStatus: string }}
 */
export default function useTopMarketsStreaming(visibleMarkets, enabled = true) {
  const [priceUpdates, setPriceUpdates] = useState({});
  const [wsStatus, setWsStatus] = useState('disconnected');

  const pollTimerRef = useRef(null);
  const isHiddenRef = useRef(false);
  const prevPricesRef = useRef({});

  // Track previous prices for direction detection
  const trackDirection = useCallback((symbol, newPrice) => {
    const prev = prevPricesRef.current[symbol];
    prevPricesRef.current[symbol] = newPrice;
    if (prev == null) return null;
    if (newPrice > prev) return 'up';
    if (newPrice < prev) return 'down';
    return null;
  }, []);

  // Background tab detection
  useEffect(() => {
    const handleVisChange = () => {
      isHiddenRef.current = document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisChange);
    return () => document.removeEventListener('visibilitychange', handleVisChange);
  }, []);

  // WebSocket streaming for crypto
  useEffect(() => {
    if (!enabled || !visibleMarkets?.length) return;
    if (isHiddenRef.current) return;

    const cryptoSymbols = visibleMarkets
      .filter((m) => m.assetClass === 'crypto' && m.symbol)
      .slice(0, MAX_WS_SYMBOLS)
      .map((m) => {
        // Convert symbol back to Binance pair format
        const sym = m.symbol.toUpperCase();
        return sym.endsWith('USDT') ? sym : sym + 'USDT';
      });

    if (cryptoSymbols.length === 0) return;

    let ws;
    let reconnectTimer;

    const connect = () => {
      try {
        // Binance combined stream
        const streams = cryptoSymbols.map((s) => `${s.toLowerCase()}@trade`).join('/');
        ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

        ws.onopen = () => setWsStatus('connected');

        ws.onmessage = (event) => {
          if (isHiddenRef.current) return; // Skip updates when tab hidden

          try {
            const msg = JSON.parse(event.data);
            const data = msg.data;
            if (!data?.s || !data?.p) return;

            const symbol = data.s.replace(/USDT$/, '');
            const price = parseFloat(data.p);
            const direction = trackDirection(symbol, price);

            setPriceUpdates((prev) => ({
              ...prev,
              [symbol]: { price, direction, ts: Date.now() },
            }));

            // Update the store directly
            const store = useTopMarketsStore.getState();
            const markets = store.markets;
            const idx = markets.findIndex((m) => m.symbol === symbol || m.symbol === data.s);
            if (idx >= 0) {
              const updated = [...markets];
              updated[idx] = { ...updated[idx], price };
              useTopMarketsStore.setState({ markets: updated });
            }
          } catch {
            // Malformed message, skip
          }
        };

        ws.onclose = () => {
          setWsStatus('disconnected');
          // Reconnect after 5s
          reconnectTimer = setTimeout(connect, 5000);
        };

        ws.onerror = () => {
          setWsStatus('error');
          ws?.close();
        };
      } catch {
        setWsStatus('error');
      }
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      setWsStatus('disconnected');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on length to avoid WS churn
  }, [enabled, visibleMarkets?.length, trackDirection]);

  // Polling for non-crypto (equities)
  useEffect(() => {
    if (!enabled || !visibleMarkets?.length) return;

    const equitySymbols = visibleMarkets
      .filter((m) => m.assetClass !== 'crypto' && m.symbol)
      .slice(0, 20)
      .map((m) => m.symbol);

    if (equitySymbols.length === 0) return;

    const poll = async () => {
      if (isHiddenRef.current) return;
      try {
        const { batchGetQuotes } = await import('../data/QuoteService.js');
        const quotes = await batchGetQuotes(equitySymbols);

        const store = useTopMarketsStore.getState();
        const markets = [...store.markets];
        let changed = false;

        for (const sym of equitySymbols) {
          const q = quotes?.[sym];
          if (!q) continue;
          const newPrice = q.price || q.lastPrice;
          if (!newPrice) continue;

          const idx = markets.findIndex((m) => m.symbol === sym || m.symbol === sym.replace(/=F$|=X$/, ''));
          if (idx >= 0 && markets[idx].price !== newPrice) {
            const direction = trackDirection(markets[idx].symbol, newPrice);
            setPriceUpdates((prev) => ({
              ...prev,
              [markets[idx].symbol]: { price: newPrice, direction, ts: Date.now() },
            }));
            markets[idx] = {
              ...markets[idx],
              price: newPrice,
              change24h: q.changePct ?? q.priceChangePercent ?? markets[idx].change24h,
            };
            changed = true;
          }
        }

        if (changed) {
          useTopMarketsStore.setState({ markets });
        }
      } catch {
        // Silent failure
      }
    };

    poll();
    pollTimerRef.current = setInterval(poll, POLL_INTERVAL);

    return () => clearInterval(pollTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on length to avoid poll churn
  }, [enabled, visibleMarkets?.length, trackDirection]);

  return { priceUpdates, wsStatus };
}
