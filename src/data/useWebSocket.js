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
import { wsService, WS_STATUS, WebSocketService } from './WebSocketService';

/**
 * @param {string} symbol - charEdge symbol (e.g., 'BTC')
 * @param {string} tf - charEdge timeframe ID (e.g., '1d')
 * @returns {{ tick: Object|null, wsStatus: string, isLive: boolean }}
 */
export default function useWebSocket(symbol, tf) {
  const [tick, setTick] = useState(null);
  const [wsStatus, setWsStatus] = useState(WS_STATUS.DISCONNECTED);

  const liveBarRef = useRef(null);

  // ADR-001 Phase B: bar authority is DatafeedService/ChartEngineWidget.
  // Keep onCandle callback only to satisfy wsService subscription contract.
  const onCandle = useCallback((candle) => {
    // No-op: canonical bar updates flow through DatafeedService + TickChannel.
    if (candle?.isClosed) liveBarRef.current = null;
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
