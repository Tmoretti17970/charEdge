// ═══════════════════════════════════════════════════════════════════
// charEdge — useChartDataLoader
// Extracts all data-fetching & real-time subscription side effects
// from ChartsPage: OHLC fetch, WebSocket, TickerPlant, cache warming,
// share URL parsing, alert checks, and data warning events.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { TFS } from '../../constants.js';
import { reportError } from '../../utils/globalErrorHandler.js';
import { useChartStore } from '../../state/useChartStore.js';
import { useWatchlistStore } from '../../state/useWatchlistStore.js';
import { useAlertStore, checkSymbolAlerts, requestNotificationPermission } from '../../state/useAlertStore.js';
import { useJournalStore } from '../../state/useJournalStore.js';
import useWebSocket from '../../data/useWebSocket.js';
import { WebSocketService } from '../../data/WebSocketService.ts';
import { fetchOHLC, fetchOHLCPage, warmCache } from '../../data/FetchService.ts';

import { tickerPlant } from '../../data/engine/streaming/TickerPlant.js';
import { dataPipeline } from '../../data/engine/DataPipeline.js';
import { parseShareURL } from '../../utils/chartExport.js';
import { logger } from '../../utils/logger';

/**
 * Hook that manages all chart data lifecycle:
 * - Fetching OHLC data on symbol/tf change
 * - WebSocket live candle streaming
 * - TickerPlant multi-source aggregation
 * - Cache warming for watchlist symbols
 * - Share URL parsing on mount
 * - Alert permission + trigger handling
 * - Data warning events from FetchService
 */
export default function useChartDataLoader() {
  const symbol = useChartStore((s) => s.symbol);
  const tf = useChartStore((s) => s.tf);
  const data = useChartStore((s) => s.data);
  const setSymbol = useChartStore((s) => s.setSymbol);
  const historyLoading = useChartStore((s) => s.historyLoading);
  const historyExhausted = useChartStore((s) => s.historyExhausted);
  const oldestTime = useChartStore((s) => s.oldestTime);

  const [dataWarning, setDataWarning] = useState(null);

  // Sprint 6: TTI (Time-to-Interactive) measurement
  const ttiMountRef = useRef(performance.now());
  const ttiReportedRef = useRef(false);
  useEffect(() => {
    if (data?.length > 0 && !ttiReportedRef.current) {
      ttiReportedRef.current = true;
      const tti = Math.round(performance.now() - ttiMountRef.current);
      if (import.meta.env?.DEV) {
        logger.ui.info(`[charEdge] TTI: ${tti}ms (${data.length} bars)`);
      }
      if (typeof window !== 'undefined') window.__charEdge_tti = tti;
    }
  }, [data]);

  const watchlistItems = useWatchlistStore((s) => s.items);
  const watchlistSymbols = useMemo(() => watchlistItems.map((i) => i.symbol), [watchlistItems]);

  // WebSocket: live candle + ticker for supported crypto symbols
  const { tick, wsStatus, isLive } = useWebSocket(symbol, tf);
  const wsSupported = WebSocketService.isSupported(symbol);

  // TickerPlant aggregated data selectors
  const confidence = useChartStore((s) => s.confidence);
  const sourceCount = useChartStore((s) => s.sourceCount);
  const priceSpread = useChartStore((s) => s.priceSpread);
  const priceSources = useChartStore((s) => s.priceSources);

  // Warm cache with adjacent timeframes when symbol changes
  useEffect(() => {
    warmCache(symbol, tf);
  }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  // 5A.2.1: Pre-warm watchlist symbols via WatchlistPrefetcher service
  // Replaces inline setTimeout approach with requestIdleCallback + DataCache
  useEffect(() => {
    let prefetcher;
    import('../../data/engine/streaming/WatchlistPrefetcher.ts')
      .then((mod) => {
        prefetcher = mod.watchlistPrefetcher;
        prefetcher.start();
      })
      .catch(() => { }); // WatchlistPrefetcher import is best-effort
    return () => {
      if (prefetcher) prefetcher.stop();
    };
  }, []);

  // Request notification permission for price alerts
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Listen for alert triggers and show toast
  const totalAlerts = useAlertStore((s) => s.alerts.filter((a) => a.active).length);
  useEffect(() => {
    const handler = (e) => {
      import('../../app/components/ui/Toast.jsx')
        .then(({ default: toast }) => {
          toast.info(`🔔 ${e.detail.message}`);
        })
        .catch(() => { }); // intentional: Toast import is best-effort UI
    };
    window.addEventListener('charEdge:alert-triggered', handler);
    return () => window.removeEventListener('charEdge:alert-triggered', handler);
  }, []);

  // Listen for data fallback warnings from FetchService
  useEffect(() => {
    const handler = (e) => {
      setDataWarning(e.detail.message);
      setTimeout(() => setDataWarning(null), 8000);
    };
    window.addEventListener('charEdge:data-warning', handler);
    return () => window.removeEventListener('charEdge:data-warning', handler);
  }, []);

  // Fetch real data when symbol or tf changes via FetchService pipeline
  useEffect(() => {
    let cancelled = false;
    // Sprint 8: AbortController for true HTTP cancellation on symbol switch
    const abortController = new AbortController();
    const markId = `tf-chart-load-${symbol}-${tf}-${Date.now()}`;
    performance.mark(`${markId}-start`);
    const loadTimer = setTimeout(() => {
      if (!cancelled) useChartStore.getState().setLoading(true);
    }, 0);

    const fetchTimer = setTimeout(() => {
      if (cancelled) return;
      fetchOHLC(symbol, tf, { signal: abortController.signal })
        .then(({ data: newData, source }) => {
          if (cancelled) return;
          performance.mark(`${markId}-end`);
          try { performance.measure(`tf-chart-load`, `${markId}-start`, `${markId}-end`); } catch (e) { logger.ui.warn('Operation failed', e); }
          useChartStore.getState().setData(newData, source);
          if (newData?.length > 0) {
            const last = newData[newData.length - 1].close;
            if (last != null) queueMicrotask(() => checkSymbolAlerts(symbol, last));
          }
          // Show subtle toast when serving from persistent cache
          if (source === 'cached') {
            setDataWarning('📦 Showing cached data — refreshing in background...');
            setTimeout(() => setDataWarning(null), 4000);
          }
        })
        .catch((err) => {
          if (cancelled || err?.name === 'AbortError') return;
          reportError(err, { source: 'ChartDataLoader.fetchOHLC' });
          // Phase 0.4: Show empty state instead of fake simulated data
          useChartStore.getState().setData([], 'none');
          setDataWarning(`Could not load data for ${symbol}. Check your connection or try a different symbol.`);
        });
    }, 10);

    return () => {
      cancelled = true;
      abortController.abort(); // Sprint 8: Cancel in-flight HTTP request
      clearTimeout(loadTimer);
      clearTimeout(fetchTimer);
    };
  }, [symbol, tf]);

  // TickerPlant + DataPipeline: Watch current symbol for multi-source aggregation + P2P relay
  useEffect(() => {
    // Start the full data pipeline (TickerPlant + PeerMesh + DataRelayNode)
    dataPipeline.start();

    // Watch symbol through pipeline (enables P2P relay + source tracking)
    const pipelineUnsub = dataPipeline.watchSymbol(symbol);

    // Subscribe to aggregated price updates
    const unsub = tickerPlant.subscribe(symbol, (aggData) => {
      useChartStore.getState().setAggregatedData(aggData);
    });

    // Listen for source-change events to update the badge
    const onSourceChange = (e) => {
      const { source } = e.detail || {};
      if (source) {
        useChartStore.getState().setPipelineSource?.(source);
      }
    };
    dataPipeline.addEventListener('source-change', onSourceChange);

    return () => {
      unsub();
      if (typeof pipelineUnsub === 'function') pipelineUnsub();
      dataPipeline.unwatchSymbol(symbol);
      dataPipeline.removeEventListener('source-change', onSourceChange);
    };
  }, [symbol]);

  // Fetch comparison symbol data when comparison is set
  const comparisonSymbol = useChartStore((s) => s.comparisonSymbol);
  useEffect(() => {
    if (!comparisonSymbol) return;
    let cancelled = false;

    fetchOHLC(comparisonSymbol, tf)
      .then(({ data: compData }) => {
        if (cancelled) return;
        setTimeout(() => useChartStore.getState().setComparison(comparisonSymbol, compData), 0);
      })
      .catch((err) => {
        if (cancelled) return;
        reportError(err, { source: 'ChartDataLoader.comparison' });
        // Phase 0.4: Show empty comparison instead of fake data
        setTimeout(() => useChartStore.getState().setComparison(comparisonSymbol, []), 0);
        setDataWarning(`Could not load comparison data for ${comparisonSymbol}.`);
      });

    return () => {
      cancelled = true;
    };
  }, [comparisonSymbol, tf]);

  // Parse shared chart URL on mount (one-time)
  useEffect(() => {
    const shared = parseShareURL();
    if (shared) {
      setSymbol(shared.symbol);
      if (shared.tf) useChartStore.getState().setTf(shared.tf);
      if (shared.chartType) useChartStore.getState().setChartType(shared.chartType);
      const url = new URL(window.location.href);
      url.searchParams.delete('chart');
      window.history.replaceState({}, '', url.toString());
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sprint 1: Scroll-left history prefetch ─────────────────────
  // When the chart engine detects the user is near the left edge,
  // it dispatches 'charEdge:prefetch-history'. We fetch older bars
  // and prepend them to the store.
  // Task 2.10.3.2: OPFS-first scroll-back — check TimeSeriesStore
  // before hitting the network for instant render.
  const prefetchFailCountRef = useRef(0);
  const MAX_PREFETCH_RETRIES = 3;

  const prefetchHistory = useCallback(() => {
    const state = useChartStore.getState();
    if (state.historyLoading || state.historyExhausted) return;
    const oldest = state.oldestTime;
    if (!oldest) return;

    state.setHistoryLoading(true);

    // Task 2.10.3.2: Try OPFS/IDB binary cache first (instant, no network)
    import('../../data/engine/TimeSeriesStore.ts')
      .then(async ({ timeSeriesStore }) => {
        await timeSeriesStore.init();

        // Look back 3× viewport duration (matches DataWindow lookahead=3)
        const viewportDuration = (state.data?.[state.data.length - 1]?.time ?? oldest) - (state.data?.[0]?.time ?? oldest);
        const lookbackMs = Math.max(viewportDuration * 3, 86_400_000); // at least 1 day
        const startT = oldest - lookbackMs;

        const cachedBars = await timeSeriesStore.read(symbol, tf, startT, oldest - 1);
        if (cachedBars?.length > 0) {
          // OPFS hit — instant render, no network needed
          logger.data.info(
            `[OPFS-first] Cache hit: ${cachedBars.length} bars for ${symbol}@${tf} scroll-back`
          );
          const formatted = cachedBars.map(b => ({
            time: new Date(b.t).toISOString(),
            open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v,
          }));
          // A2.2: Guard against stale prefetch from old symbol
          if (useChartStore.getState().symbol === symbol) {
            useChartStore.getState().prependData(formatted);
            prefetchFailCountRef.current = 0;
          }
          return;
        }

        // OPFS miss — fall back to network fetch
        const { data: olderBars, hasMore } = await fetchOHLCPage(symbol, tf, oldest);
        // A2.2: Guard against stale prefetch from old symbol
        if (useChartStore.getState().symbol === symbol) {
          useChartStore.getState().prependData(olderBars);
          prefetchFailCountRef.current = 0;
          if (!hasMore) {
            useChartStore.setState({ historyExhausted: true });
          }
        }
      })
      .catch((err) => {
        // TimeSeriesStore import failed or OPFS unavailable — direct network fetch
        if (err?.name === 'AbortError') return;
        fetchOHLCPage(symbol, tf, oldest)
          .then(({ data: olderBars, hasMore }) => {
            // A2.2: Guard against stale prefetch from old symbol
            if (useChartStore.getState().symbol !== symbol) return;
            useChartStore.getState().prependData(olderBars);
            prefetchFailCountRef.current = 0;
            if (!hasMore) {
              useChartStore.setState({ historyExhausted: true });
            }
          })
          .catch((fetchErr) => {
            reportError(fetchErr, { source: 'ChartDataLoader.prefetchHistory' });
            prefetchFailCountRef.current++;
            if (prefetchFailCountRef.current >= MAX_PREFETCH_RETRIES) {
              logger.data.warn('[ChartDataLoader] Max prefetch retries reached, stopping history load');
              useChartStore.setState({ historyExhausted: true });
            }
          });
      })
      // A2.1: Always reset historyLoading — prevents stuck state after OPFS hit or error
      .finally(() => {
        useChartStore.getState().setHistoryLoading(false);
      });
  }, [symbol, tf]);

  useEffect(() => {
    const handler = () => prefetchHistory();
    window.addEventListener('charEdge:prefetch-history', handler);
    return () => window.removeEventListener('charEdge:prefetch-history', handler);
  }, [prefetchHistory]);

  // ── Sprint 2: Background prefetch for adjacent timeframes ──────
  // After initial data loads, warm the cache for nearby TFs so switching is instant.
  const adjacentPrefetchedRef = useRef(new Set());
  // A2.3: Clear stale prefetch keys when symbol/tf changes
  useEffect(() => {
    adjacentPrefetchedRef.current.clear();
    prefetchFailCountRef.current = 0;
  }, [symbol, tf]);
  useEffect(() => {
    const state = useChartStore.getState();
    if (!state.data?.length || adjacentPrefetchedRef.current.has(`${symbol}:${tf}`)) return;

    const ADJACENT_TFS = {
      '1m': ['5m'], '5m': ['15m', '1m'], '15m': ['1h', '5m'],
      '1h': ['4h', '15m'], '4h': ['1D', '1h'], '1D': ['1w', '4h'], '1w': ['1D'],
    };

    const neighbors = ADJACENT_TFS[tf];
    if (!neighbors?.length) return;

    const scheduleId = typeof requestIdleCallback === 'function'
      ? requestIdleCallback(() => {
        adjacentPrefetchedRef.current.add(`${symbol}:${tf}`);
        for (const adjTf of neighbors) {
          fetchOHLC(symbol, adjTf).catch(() => { }); // fetchOHLC already writes to CacheManager
        }
      }, { timeout: 5000 })
      : setTimeout(() => {
        adjacentPrefetchedRef.current.add(`${symbol}:${tf}`);
        for (const adjTf of neighbors) {
          fetchOHLC(symbol, adjTf).catch(() => { });
        }
      }, 3000);

    return () => {
      if (typeof cancelIdleCallback === 'function') cancelIdleCallback(scheduleId);
      else clearTimeout(scheduleId);
    };
  }, [symbol, tf]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    tick,
    wsStatus,
    isLive,
    wsSupported,
    dataWarning,
    setDataWarning,
    confidence,
    sourceCount,
    priceSpread,
    priceSources,
    watchlistSymbols,
    historyLoading,
    historyExhausted,
    prefetchHistory,
  };
}
