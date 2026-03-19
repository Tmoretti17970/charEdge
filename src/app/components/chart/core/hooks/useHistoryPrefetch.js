// ═══════════════════════════════════════════════════════════════════
// charEdge — useHistoryPrefetch Hook (Phase 2: Infinite Scroll-Back)
//
// Listens for the 'charEdge:prefetch-history' custom event dispatched
// by InputManager._checkPrefetch() when the user scrolls within
// PREFETCH_THRESHOLD bars of the left edge.
//
// Calls fetchOHLCPage() from HistoryPaginator, feeds results into
// DatafeedService.prependBars() + Zustand prependData().
//
// Phase 5: Also wires ScrollPrefetcher for momentum-based multi-page
// prefetching during fast scrolling.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { useChartCoreStore } from '../../../../../state/chart/useChartCoreStore';
import { datafeedService } from '../../../../../charting_library/datafeed/DatafeedService.js';
import { logger } from '@/observability/logger';

/**
 * Hook that enables infinite scroll-back on charts.
 * Wires the chart engine's prefetch event to the HistoryPaginator.
 *
 * @param {string} symbol - Current chart symbol (e.g. 'BTCUSDT', 'AAPL')
 * @param {string} tf - Current chart timeframe (e.g. '1h', '1d')
 */
export function useHistoryPrefetch(symbol, tf) {
  const loadingRef = useRef(false);
  const exhaustedRef = useRef(false);

  // Reset exhaustion flag when symbol or timeframe changes
  useEffect(() => {
    exhaustedRef.current = false;
    loadingRef.current = false;
  }, [symbol, tf]);

  // Phase 5: Configure ScrollPrefetcher for momentum-based multi-page prefetch
  useEffect(() => {
    if (!symbol || !tf) return;

    let scrollPrefetcher;
    const setup = async () => {
      const mod = await import('../../../../../data/engine/ScrollPrefetcher.js');
      scrollPrefetcher = mod.scrollPrefetcher;
      scrollPrefetcher.setContext(symbol, tf);

      // Give ScrollPrefetcher its own fetch function that uses HistoryPaginator
      scrollPrefetcher.setFetchFn(async (sym, tfId, _offset, _pageSize) => {
        const { oldestTime } = useChartCoreStore.getState();
        if (!oldestTime) return null;

        const { fetchOHLCPage } = await import('../../../../../data/HistoryPaginator.js');
        const result = await fetchOHLCPage(sym, tfId, oldestTime);
        if (!result?.data?.length) return null;

        // Prepend to the chart
        datafeedService.prependBars(sym, tfId, result.data);
        const { barCount } = useChartCoreStore.getState();
        useChartCoreStore.getState().prependData(result.data, barCount);

        logger.data.info(
          `[ScrollPrefetcher] Momentum-prefetched ${result.data.length} bars for ${sym}@${tfId}`
        );
        return result.data;
      });
    };
    setup();

    return () => {
      if (scrollPrefetcher) scrollPrefetcher.reset();
    };
  }, [symbol, tf]);

  useEffect(() => {
    if (!symbol || !tf) return;

    const handlePrefetch = async (event) => {
      // Guard: don't re-enter while loading or if history is exhausted
      if (loadingRef.current || exhaustedRef.current) return;
      loadingRef.current = true;

      // Phase 5: Feed scroll position to ScrollPrefetcher for velocity tracking
      try {
        const mod = await import('../../../../../data/engine/ScrollPrefetcher.js');
        const { barCount } = useChartCoreStore.getState();
        const scrollOffset = event?.detail?.scrollOffset ?? 0;
        const visibleBars = event?.detail?.visibleBars ?? 100;
        mod.scrollPrefetcher.onScroll(scrollOffset, visibleBars, barCount);
      } catch { /* non-critical */ }

      try {
        // Get the oldest bar time from the Zustand store
        const { oldestTime, barCount } = useChartCoreStore.getState();
        if (!oldestTime) {
          loadingRef.current = false;
          return;
        }

        // Signal loading state for shimmer bars
        useChartCoreStore.getState().setHistoryLoading(true);

        // Dynamic import to avoid circular dependency
        const { fetchOHLCPage } = await import('../../../../../data/HistoryPaginator.js');

        const result = await fetchOHLCPage(symbol, tf, oldestTime);

        if (!result || !result.data || result.data.length === 0) {
          // No more history available
          exhaustedRef.current = true;
          useChartCoreStore.getState().setHistoryLoading(false);
          loadingRef.current = false;
          return;
        }

        // Push bars to DatafeedService (dedup + TickChannel to engine)
        datafeedService.prependBars(symbol, tf, result.data);

        // Update Zustand metadata (barCount, oldestTime, lastPrependCount)
        useChartCoreStore.getState().prependData(result.data, barCount);

        // Mark exhausted if provider says no more
        if (!result.hasMore) {
          exhaustedRef.current = true;
        }

        logger.data.info(
          `[useHistoryPrefetch] Loaded ${result.data.length} older bars for ${symbol}@${tf}. hasMore=${result.hasMore}`
        );
      } catch (err) {
        logger.data.warn('[useHistoryPrefetch] Failed to load history:', err);
        useChartCoreStore.getState().setHistoryLoading(false);
      } finally {
        loadingRef.current = false;
      }
    };

    window.addEventListener('charEdge:prefetch-history', handlePrefetch);
    return () => window.removeEventListener('charEdge:prefetch-history', handlePrefetch);
  }, [symbol, tf]);
}

