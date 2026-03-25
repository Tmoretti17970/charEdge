// ═══════════════════════════════════════════════════════════════════
// charEdge — useChartBars Hook
//
// Sprint 3: Provides bar data to React components by reading from
// DatafeedService (the canonical source) instead of Zustand state.
// Re-evaluates whenever barCount changes in the store.
//
// IMPORTANT: DatafeedService caches bars under resolved symbols
// (e.g., 'BTCUSDT_1h'), so this hook must apply the same resolveSymbol
// transform that ChartEngineWidget uses when subscribing.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState, useRef } from 'react';
import { resolveSymbol } from '../../app/components/chart/core/ChartEngineWidget.jsx';
import { datafeedService } from '../../charting_library/datafeed/DatafeedService.js';
import { resolveAdapterTimeframe } from '../../constants/TimeframeMap';
import { useChartCoreStore } from '../../state/chart/useChartCoreStore';

/**
 * Returns the bars array for the current symbol+tf from DatafeedService.
 * Reactive: re-evaluates when barCount changes in the store (on historical
 * load or bar-close). Uses resolved symbol/tf to match the DatafeedService
 * cache key used by ChartEngineWidget.
 */
export function useChartBars() {
  const symbol = useChartCoreStore((s) => s.symbol);
  const tf = useChartCoreStore((s) => s.tf);
  const barCount = useChartCoreStore((s) => s.barCount);

  const [bars, setBars] = useState(() => {
    const resolvedSym = resolveSymbol(symbol);
    const resolvedTf = resolveAdapterTimeframe(tf, 'binance');
    return datafeedService.getBars(resolvedSym, resolvedTf) || [];
  });
  const retryRef = useRef(null);

  useEffect(() => {
    const resolvedSym = resolveSymbol(symbol);
    const resolvedTf = resolveAdapterTimeframe(tf, 'binance');
    const data = datafeedService.getBars(resolvedSym, resolvedTf) || [];
    setBars(data);

    // If data is empty but barCount > 0, DatafeedService may not be ready yet.
    // Retry after a short delay to catch late initialization.
    if (data.length === 0 && barCount > 0) {
      retryRef.current = setTimeout(() => {
        const retryData = datafeedService.getBars(resolvedSym, resolvedTf) || [];
        if (retryData.length > 0) setBars(retryData);
      }, 500);
    }

    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [symbol, tf, barCount]);

  return bars;
}
