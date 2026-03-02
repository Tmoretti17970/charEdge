// ═══════════════════════════════════════════════════════════════════
// charEdge — useChartDataLoader
// Extracts all data-fetching & real-time subscription side effects
// from ChartsPage: OHLC fetch, WebSocket, TickerPlant, cache warming,
// share URL parsing, alert checks, and data warning events.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState, useMemo, useCallback } from 'react';
import { TFS } from '../../constants.js';
import { reportError } from '../../utils/globalErrorHandler.js';
import { useChartStore } from '../../state/useChartStore.js';
import { useWatchlistStore } from '../../state/useWatchlistStore.js';
import { useAlertStore, checkSymbolAlerts, requestNotificationPermission } from '../../state/useAlertStore.js';
import { useJournalStore } from '../../state/useJournalStore.js';
import useWebSocket from '../../data/useWebSocket.js';
import { WebSocketService } from '../../data/WebSocketService.js';
import { fetchOHLC, warmCache } from '../../data/FetchService.js';

import { tickerPlant } from '../../data/engine/streaming/TickerPlant.js';
import { dataPipeline } from '../../data/engine/DataPipeline.js';
import { parseShareURL } from '../../utils/chartExport.js';

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

  const [dataWarning, setDataWarning] = useState(null);

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

  // Pre-warm watchlist symbols on mount for faster switching
  useEffect(() => {
    if (!watchlistSymbols?.length) return;
    const t = setTimeout(() => {
      watchlistSymbols.forEach(sym => {
        if (sym !== symbol) warmCache(sym, tf);
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [watchlistSymbols, tf, symbol]);

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
        .catch(() => {}); // intentional: Toast import is best-effort UI
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
    const markId = `tf-chart-load-${symbol}-${tf}-${Date.now()}`;
    performance.mark(`${markId}-start`);
    const loadTimer = setTimeout(() => {
      if (!cancelled) useChartStore.getState().setLoading(true);
    }, 0);

    const fetchTimer = setTimeout(() => {
      if (cancelled) return;
      fetchOHLC(symbol, tf)
        .then(({ data: newData, source }) => {
          if (cancelled) return;
          performance.mark(`${markId}-end`);
          try { performance.measure(`tf-chart-load`, `${markId}-start`, `${markId}-end`); } catch {}
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
          if (cancelled) return;
          reportError(err, { source: 'ChartDataLoader.fetchOHLC' });
          // Phase 0.4: Show empty state instead of fake simulated data
          useChartStore.getState().setData([], 'none');
          setDataWarning(`Could not load data for ${symbol}. Check your connection or try a different symbol.`);
        });
    }, 10);

    return () => {
      cancelled = true;
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
  };
}
