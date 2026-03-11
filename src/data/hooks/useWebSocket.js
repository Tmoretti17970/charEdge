// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — useWebSocket Hook
//
// Bridges the WebSocketService singleton into React.
// Manages subscription lifecycle, live candle updates, and ticker state.
//
// When a kline message arrives:
//   - If NOT closed: update the last bar in chartStore.data in-place
//   - If closed: append the finalized bar, start new current bar
//
// Usage:
//   const { tick, wsStatus, isLive } = useWebSocket(symbol, tf);
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState, useRef, useCallback } from 'react';
import { useChartStore } from '../../state/useChartStore';
import { wsService, WS_STATUS, WebSocketService } from '../WebSocketService';

/**
 * @param {string} symbol - charEdge symbol (e.g., 'BTC')
 * @param {string} tf - charEdge timeframe ID (e.g., '1d')
 * @returns {{ tick: Object|null, wsStatus: string, isLive: boolean }}
 */
export default function useWebSocket(symbol, tf) {
  const [tick, setTick] = useState(null);
  const [wsStatus, setWsStatus] = useState(WS_STATUS.DISCONNECTED);

  // Track whether we've received the first kline to avoid updating stale data
  const liveBarRef = useRef(null); // current open bar's start time (ISO)

  const onCandle = useCallback((candle) => {
    const store = useChartStore.getState();
    const currentData = store.data;
    if (!currentData?.length) return;

    // Reusable bar shape — avoids allocating a new object on every tick
    const barFields = { time: candle.time, open: candle.open, high: candle.high, low: candle.low, close: candle.close, volume: candle.volume };

    if (candle.isClosed) {
      // ─── Candle closed: finalize and append ─────────────────
      const lastBar = currentData[currentData.length - 1];

      if (lastBar?.time === candle.time) {
        // Update last bar in-place, then create new array reference for Zustand
        Object.assign(lastBar, barFields);
        store.setData([...currentData], 'binance:live');
      } else {
        // Candle for a new time slot — append
        store.setData(currentData.concat(barFields), 'binance:live');
      }
      liveBarRef.current = null; // reset — next update starts a new bar
    } else {
      // ─── Candle still open: update last bar in-place ────────
      const lastBar = currentData[currentData.length - 1];

      if (lastBar?.time === candle.time) {
        // Same bar — mutate fields in-place, new array ref for Zustand
        Object.assign(lastBar, barFields);
        store.setData([...currentData], 'binance:live');
      } else if (liveBarRef.current !== candle.time) {
        // New bar opened — append
        liveBarRef.current = candle.time;
        store.setData(currentData.concat(barFields), 'binance:live');
      }
    }
  }, []);

  const onTick = useCallback((tickData) => {
    setTick(tickData);
  }, []);

  const onStatus = useCallback((status) => {
    setWsStatus(status);
  }, []);

  useEffect(() => {
    // Only subscribe for supported crypto symbols
    if (!WebSocketService.isSupported(symbol)) {
      setWsStatus(WS_STATUS.DISCONNECTED);
      setTick(null);
      return;
    }

    const subId = wsService.subscribe(symbol, tf, {
      onCandle,
      onTick,
      onStatus,
    });

    return () => {
      wsService.unsubscribe(subId);
      liveBarRef.current = null;
    };
  }, [symbol, tf, onCandle, onTick, onStatus]);

  return {
    tick,
    wsStatus,
    isLive: wsStatus === WS_STATUS.CONNECTED,
  };
}
