// ═══════════════════════════════════════════════════════════════════
// charEdge v17 — useOrderFlowConnection Hook
//
// Auto-connects OrderFlowBridge + DepthEngine + StreamingIndicators
// when the chart views a crypto symbol. Disconnects when switching
// away or unmounting. Also binds the OrderFlowAggregator and
// activates streaming indicator bridge for the symbol.
//
// v17: Warm-starts OrderFlowEngine from persisted ticks before
// connecting live WS — instant CVD, delta, volume profile.
//
// Usage:
//   useOrderFlowConnection(binanceSymbol);
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { orderFlowBridge } from '../../data/engine/orderflow/OrderFlowBridge.js';
import { orderFlowEngine } from '../../data/engine/orderflow/OrderFlowEngine.js';
import { depthEngine } from '../../data/engine/orderflow/DepthEngine.js';
import { getAggregator } from '../../data/OrderFlowAggregator.js';
import { streamingIndicatorBridge } from '../../data/engine/indicators/StreamingIndicatorBridge.js';
import { cacheManager } from '../../data/engine/infra/CacheManager.js';
import { isCrypto } from '../../constants.js';

// isCryptoSymbol removed — use isCrypto() from constants.js

/**
 * Hook that auto-manages OrderFlowBridge + DepthEngine + StreamingIndicator connections.
 *
 * When `binanceSymbol` is a crypto pair:
 *   - Warm-starts OrderFlowEngine from persisted IDB ticks (instant CVD/VP)
 *   - Connects OrderFlowBridge (Binance @trade WS → 6-engine fan-out)
 *   - Subscribes DepthEngine (Binance @depth20 WS)
 *   - Activates StreamingIndicatorBridge (running EMA/RSI/MACD/OBV/VWAP)
 *   - Schedules periodic storage eviction
 *
 * Disconnects on symbol change or unmount.
 *
 * @param {string} binanceSymbol - Resolved Binance symbol, e.g. 'BTCUSDT'
 * @param {string} tf - Timeframe, e.g. '1h'
 */
export function useOrderFlowConnection(binanceSymbol, tf = '1h') {
  const prevSymbolRef = useRef(null);
  const depthUnsubRef = useRef(null);
  const evictionTimerRef = useRef(null);

  useEffect(() => {
    const upper = (binanceSymbol || '').toUpperCase();
    const prevSymbol = prevSymbolRef.current;

    // Disconnect previous symbol if switching
    if (prevSymbol && prevSymbol !== upper) {
      orderFlowBridge.disconnect(prevSymbol);
      streamingIndicatorBridge.deactivate(prevSymbol);
      if (depthUnsubRef.current) {
        depthUnsubRef.current();
        depthUnsubRef.current = null;
      }
    }

    prevSymbolRef.current = upper;

    if (!upper || !isCrypto(upper)) return;

    // Async IIFE: warm-start → then connect live
    let cancelled = false;
    (async () => {
      // 1. Warm-start from persisted ticks (instant CVD, VP, delta, footprint)
      try {
        await orderFlowEngine.warmStart(upper, 10 * 60 * 1000); // Last 10 minutes
      } catch {
        // Non-fatal: proceed to live connection regardless
      }

      if (cancelled) return;

      // 2. Connect OrderFlowBridge (starts Binance @trade WS → 6-engine fan-out)
      if (!orderFlowBridge.isConnected(upper)) {
        orderFlowBridge.connect(upper);
      }

      // 3. Bind the OrderFlowAggregator to this symbol for engine bridge
      const aggregatorKey = `${upper}_${tf}`;
      const aggregator = getAggregator(aggregatorKey);
      aggregator.bindSymbol(upper);

      // 4. Subscribe DepthEngine (Binance @depth20 WS)
      depthUnsubRef.current = depthEngine.subscribe(upper, () => {
        // No-op callback — just keeps the WS alive. Panels use getDepth().
      }, { levels: 20, updateMs: 1000 });

      // 5. Activate streaming indicators (running EMA/RSI/MACD/OBV/VWAP)
      streamingIndicatorBridge.activate(upper, ['ema', 'rsi', 'macd', 'obv', 'vwap']);

      // 6. Schedule periodic storage eviction (every 5 minutes)
      if (!evictionTimerRef.current) {
        evictionTimerRef.current = setInterval(() => {
          cacheManager.evictAll().catch(() => {}); // intentional: periodic eviction is best-effort
        }, 5 * 60 * 1000);
      }
    })();

    // Cleanup on unmount
    return () => {
      cancelled = true;
      orderFlowBridge.disconnect(upper);
      streamingIndicatorBridge.deactivate(upper);
      if (depthUnsubRef.current) {
        depthUnsubRef.current();
        depthUnsubRef.current = null;
      }
      if (evictionTimerRef.current) {
        clearInterval(evictionTimerRef.current);
        evictionTimerRef.current = null;
      }
    };
  }, [binanceSymbol, tf]);
}

export default useOrderFlowConnection;

