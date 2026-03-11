// ═══════════════════════════════════════════════════════════════════
// charEdge — useTradeNavigation Hook (Sprint 6)
//
// Extracts trade navigation logic from ChartEngineWidget. Handles
// "View on Chart" clicks from the journal — scrolls the chart
// to the trade's timestamp and shows a trade details overlay.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useCallback, useState } from 'react';
import { tradeNav, findBarByTimestamp } from '@/trading/navigateToTrade';

/**
 * Subscribe to trade navigation events from the Journal.
 * @param {React.MutableRefObject} engineRef - Ref to ChartEngine
 * @param {React.MutableRefObject} barsRef - Ref to current bars array
 * @returns {{ highlightedTrade, dismissTradeOverlay }}
 */
export function useTradeNavigation(engineRef, barsRef) {
  const [highlightedTrade, setHighlightedTrade] = useState(null);

  useEffect(() => {
    const unsub = tradeNav.on('navigate', (payload) => {
      const bars = barsRef.current;
      if (!bars?.length || !payload?.timestamp) return;

      const barIdx = findBarByTimestamp(bars, payload.timestamp);
      if (barIdx < 0) return;

      // Scroll the chart engine to center the bar
      const engine = engineRef.current;
      if (engine) {
        const visibleBars = engine.state.visibleBars || 80;
        const halfVisible = Math.floor(visibleBars / 2);
        const idealOffset = bars.length - barIdx - halfVisible;
        engine.state.scrollOffset = Math.max(0, Math.min(idealOffset, bars.length - visibleBars));
        engine.markDirty();
      }

      // Show the trade details overlay
      setHighlightedTrade({
        tradeId: payload.tradeId,
        symbol: payload.symbol,
        side: payload.side,
        entry: payload.entry,
        exit: payload.exit,
        pnl: payload.pnl,
        date: new Date(payload.timestamp).toISOString(),
      });
    });
    return unsub;
  }, [engineRef, barsRef]);

  const dismissTradeOverlay = useCallback(() => setHighlightedTrade(null), []);

  return { highlightedTrade, dismissTradeOverlay };
}
