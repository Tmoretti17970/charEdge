// ═══════════════════════════════════════════════════════════════════
// charEdge v11 — ChartEngineWidget (Bridge Component)
//
// Wraps the decoupled ChartEngine class and connects it to charEdge's
// existing Zustand stores. Drop-in replacement for the old ChartCanvas.
// ═══════════════════════════════════════════════════════════════════

import { useUserStore } from '../../../../state/useUserStore.js';
import { logger } from '../../../../utils/logger.ts';
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useChartStore } from '../../../../state/useChartStore.js';
import { useShallow } from 'zustand/react/shallow';
import { useJournalStore } from '../../../../state/useJournalStore.js';
import { useAlertStore } from '../../../../state/useAlertStore.js';
import { useUIStore } from '../../../../state/useUIStore.js';
import { tradeNav, findBarByTimestamp } from '../../../../utils/navigateToTrade.js';
import TradeMarkerOverlay from '../overlays/TradeMarkerOverlay.jsx';

import { datafeedService } from '../../../../charting_library/datafeed/DatafeedService.js';
import { tickChannel } from '../../../../charting_library/core/TickChannel.js';
import { createIndicatorInstance, INDICATORS } from '../../../../charting_library/studies/indicators/registry.js';
import { indicatorBridge } from '../../../../data/engine/indicators/IndicatorWorkerBridge.js';
import { ChartEngine } from '../../../../charting_library/core/ChartEngine.js';
import crosshairBus from '../../../../utils/CrosshairBus.js';
import scrollSyncBus from '../../../../utils/ScrollSyncBus.js';
import { useOrderFlowConnection } from '../../../hooks/useOrderFlowConnection.js';
import DrawingContextMenu from '../tools/DrawingContextMenu.jsx';
import DrawingEditPopup from '../tools/DrawingEditPopup.jsx';
import DataStalenessIndicator from '../ui/DataStalenessIndicator.jsx';
import ChartLoadingNarrative from '../overlays/ChartLoadingNarrative.jsx';
import DataFallbackBanner from '../ui/DataFallbackBanner.jsx';
import IndicatorSettingsDialog from '../panels/IndicatorSettingsDialog.jsx';
import ChartAnalysisPanel from '../panels/ChartAnalysisPanel.jsx';
import ReplayToolbar from '../ReplayToolbar.jsx';
import { ReplayPaperTrade } from '../../../../intelligence/ReplayPaperTrade.js';
import { startAutoSave, stopAutoSave } from '../../../../charting_library/core/SessionRecovery.js';
import ZoomLoupe from '../overlays/ZoomLoupe.jsx';

// ─── Constants ─────────────────────────────────────────────────────────
import { resolveAdapterTimeframe } from '../../../../constants/TimeframeMap.ts';

// Symbol shorthand map — exported so other modules can reuse
export const SYMBOL_MAP = {
  BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', BNB: 'BNBUSDT',
  XRP: 'XRPUSDT', DOGE: 'DOGEUSDT', ADA: 'ADAUSDT', AVAX: 'AVAXUSDT',
  DOT: 'DOTUSDT', MATIC: 'MATICUSDT', LINK: 'LINKUSDT', UNI: 'UNIUSDT',
};

import { isCrypto } from '../../../../constants.js';

export function resolveSymbol(sym) {
  if (!sym) return 'BTCUSDT';
  const upper = sym.toUpperCase();
  // Non-crypto symbols pass through unchanged — DatafeedService
  // routes them through FetchService's equity/futures providers
  if (!isCrypto(upper)) return upper;
  if (SYMBOL_MAP[upper]) return SYMBOL_MAP[upper];
  if (upper.endsWith('USDT') || upper.endsWith('BUSD') || upper.endsWith('BTC')) return upper;
  return upper + 'USDT';
}

function resolveTf(tf) { return resolveAdapterTimeframe(tf, 'binance'); }

export default function ChartEngineWidget({
  height = '100%', width = '100%', onBarClick, onCrosshairMove, onEngineReady,
  overrideSymbol, overrideTf, overrideIndicators, _showToolbar = false,
  showVolume = true, compact = false, srLevels, patternMarkers, divergences, children,
}) {
  // Task 2.3.29: Consolidated Zustand selector — single subscription via useShallow
  const {
    symbol: storeSymbol, tf: storeTf, chartType, indicators: storeIndicators,
    activeTool: storeActiveTool, drawingColor: storeDrawingColor,
    chartColors: storeChartColors, setData: setStoreData, magnetMode,
    stickyMode: storeStickyMode, showHeatmap, heatmapIntensity, showSessions,
    paneHeights, historyLoading, showDeltaOverlay, showVPOverlay,
    showOIOverlay, showLargeTradesOverlay, linkGroup, setSymbol,
    intelligence,
    replayMode, replayIdx, replayPlaying,
    toggleReplay, setReplayIdx, setReplayPlaying,
  } = useChartStore(useShallow((s) => ({
    symbol: s.symbol, tf: s.tf, chartType: s.chartType,
    indicators: s.indicators, activeTool: s.activeTool,
    drawingColor: s.drawingColor, chartColors: s.chartColors,
    setData: s.setData, magnetMode: s.magnetMode,
    stickyMode: s.stickyMode, showHeatmap: s.showHeatmap,
    heatmapIntensity: s.heatmapIntensity, showSessions: s.showSessions,
    paneHeights: s.paneHeights, historyLoading: s.historyLoading,
    showDeltaOverlay: s.showDeltaOverlay, showVPOverlay: s.showVPOverlay,
    showOIOverlay: s.showOIOverlay, showLargeTradesOverlay: s.showLargeTradesOverlay,
    linkGroup: s.linkGroup, setSymbol: s.setSymbol,
    intelligence: s.intelligence,
    replayMode: s.replayMode, replayIdx: s.replayIdx, replayPlaying: s.replayPlaying,
    toggleReplay: s.toggleReplay, setReplayIdx: s.setReplayIdx, setReplayPlaying: s.setReplayPlaying,
  })));

  const theme = useUserStore((s) => s.theme);
  const trades = useJournalStore((s) => s.trades);
  const alerts = useAlertStore((s) => s.alerts);

  const symbol = overrideSymbol || storeSymbol;
  const tf = overrideTf || storeTf;
  const indicators = overrideIndicators || storeIndicators;

  const binanceSymbol = useMemo(() => resolveSymbol(symbol), [symbol]);
  const binanceTf = useMemo(() => resolveTf(tf), [tf]);

  // Task 1.4.6: Zoom Loupe state for mobile precision
  const [loupePos, setLoupePos] = useState({ x: 0, y: 0 });
  const [loupeActive, setLoupeActive] = useState(false);
  const loupeTouchTimer = useRef(null);

  // Auto-connect OrderFlowBridge + DepthEngine for crypto symbols
  useOrderFlowConnection(binanceSymbol, binanceTf);

  // Task 1.1.3: Listen for symbol-sync broadcasts from other charts
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('charEdge-symbol-link');
    const onMessage = (e) => {
      const { type, group, symbol: newSymbol } = e.data || {};
      if (type === 'symbol-sync' && group && group === linkGroup) {
        // Only update if symbol actually changed to avoid loops
        const current = useChartStore.getState().symbol;
        if (current !== newSymbol) {
          // Set symbol directly without broadcasting again (avoid infinite loop)
          useChartStore.setState({ symbol: newSymbol });
        }
      }
    };
    channel.addEventListener('message', onMessage);
    return () => {
      channel.removeEventListener('message', onMessage);
      channel.close();
    };
  }, [linkGroup]);

  const setPage = useUIStore((s) => s.setPage);

  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const barsRef = useRef([]);
  const [status, setStatus] = useState('idle');
  const [barCount, setBarCount] = useState(0);
  const [dataSource, setDataSource] = useState(null); // track source for fallback banner
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, drawing }
  const [editPopup, setEditPopup] = useState(null); // { drawing data from event }
  const [editingIndicatorIdx, setEditingIndicatorIdx] = useState(null); // Sprint 13: indicator settings dialog
  const [highlightedTrade, setHighlightedTrade] = useState(null);
  const paneIdRef = useRef(`widget-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);

  // P2: Staggered entrance — fires once on first data load
  const hasEnteredRef = useRef(false);
  const [showEntrance, setShowEntrance] = useState(false);

  // P2: TF cross-dissolve
  const prevTfRef = useRef(tf);
  const [dissolving, setDissolving] = useState(false);

  // Paper trade bridge for replay mode
  const paperTradeRef = useRef(null);
  useEffect(() => {
    if (replayMode && engineRef.current) {
      // Lazy-create the bridge when replay is activated
      if (!paperTradeRef.current) {
        paperTradeRef.current = new ReplayPaperTrade(engineRef.current);
        paperTradeRef.current.connect();
      }
    } else if (!replayMode && paperTradeRef.current) {
      paperTradeRef.current.disconnect();
      paperTradeRef.current = null;
    }
  }, [replayMode]);

  const closeContextMenu = useCallback(() => setCtxMenu(null), []);
  const closeEditPopup = useCallback(() => setEditPopup(null), []);
  const dismissTradeOverlay = useCallback(() => setHighlightedTrade(null), []);
  const handleViewJournal = useCallback(() => {
    setHighlightedTrade(null);
    setPage('journal');
  }, [setPage]);

  // ─── Trade Navigation: Journal → Chart ────────────────────────
  // Subscribe to tradeNav events so clicking "View on Chart" in the
  // journal scrolls the chart to the trade's timestamp.
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
  }, []);

  // CrosshairBus: subscribe for synced crosshair from other panes
  useEffect(() => {
    const paneId = paneIdRef.current;
    const unsub = crosshairBus.subscribe(paneId, (payload) => {
      if (engineRef.current) {
        engineRef.current.setSyncedCrosshair(payload ? { time: payload.timestamp, price: payload.price } : null);
      }
    });
    return unsub;
  }, []);

  // ScrollSyncBus: subscribe for scroll sync from other panes
  const scrollSyncMutedRef = useRef(false);
  useEffect(() => {
    const paneId = paneIdRef.current;
    const unsub = scrollSyncBus.subscribe(paneId, (payload) => {
      const engine = engineRef.current;
      if (!engine || !payload) return;
      const bars = engine.bars;
      if (!bars?.length) return;
      // Apply fractional scroll position from the source pane
      const maxScroll = Math.max(0, bars.length - engine.state.visibleBars);
      const newOffset = Math.round(payload.fraction * maxScroll);
      if (Math.abs(engine.state.scrollOffset - newOffset) > 0.5) {
        scrollSyncMutedRef.current = true; // Mute emission to prevent feedback loop
        engine.state.scrollOffset = newOffset;
        engine.markDirty();
        requestAnimationFrame(() => { scrollSyncMutedRef.current = false; });
      }
    });
    return unsub;
  }, []);

  // ScrollSyncBus: emit scroll position changes when scrollOffset changes.
  // Task 2.3.26: Replaced perpetual rAF loop with an efficient emission
  // triggered from the engine's render cycle via a markDirty hook.
  // FIX: Added [barCount] deps — previously had NO deps causing infinite re-render loop (Error #185).
  const lastEmittedOffset = useRef(-1);
  useEffect(() => {
    // On each tick (barCount changes), check if offset changed and emit
    const engine = engineRef.current;
    if (!engine || scrollSyncMutedRef.current) return;
    const bars = engine.bars;
    const offset = engine.state.scrollOffset;
    if (bars?.length && Math.abs(offset - lastEmittedOffset.current) > 0.5) {
      lastEmittedOffset.current = offset;
      const maxScroll = Math.max(1, bars.length - engine.state.visibleBars);
      scrollSyncBus.emit(paneIdRef.current, {
        fraction: offset / maxScroll,
        visibleBars: engine.state.visibleBars,
      });
    }
  }, [barCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize Engine once
  useEffect(() => {
    if (!containerRef.current) return;
    const callbacks = {
      onBarClick: (price, time, bar) => onBarClick?.(price, time, bar),
      onCrosshairMove: (e) => {
        // Emit to CrosshairBus for synced crosshair
        if (e?.bar?.time) {
          crosshairBus.emit(paneIdRef.current, { timestamp: e.bar.time, price: e.price });
        }
        onCrosshairMove?.(e);
      },
      onDrawingsChange: (drawings) => {
        useChartStore.getState().setSelectedDrawing(engineRef.current?.drawingEngine?.selectedDrawing?.id || null);
        useChartStore.getState().setDrawings(drawings);
      },
      onDrawingStateChange: (state) => {
        if (state === 'idle') useChartStore.getState().setActiveTool(null);
      },
      // Sprint 11: Pane resize callback — updates Zustand store
      onPaneResize: (paneIdx, fraction) => {
        useChartStore.getState().setPaneHeight(paneIdx, fraction);
      },
      // Sprint 11: Pane collapse toggle
      onPaneToggle: (paneIdx) => {
        const eng = engineRef.current;
        if (!eng) return;
        const collapsed = eng.state.collapsedPanes;
        if (collapsed.has(paneIdx)) {
          collapsed.delete(paneIdx);
        } else {
          collapsed.add(paneIdx);
        }
        eng.markDirty();
      },
    };

    const props = {
      theme, symbol, tf, chartType, showVolume, compact, trades, srLevels,
      patternMarkers, divergences, storeChartColors, magnetMode,
      showHeatmap, heatmapIntensity, showSessions, paneHeights,
      showDeltaOverlay, showVPOverlay, showOIOverlay, showLargeTradesOverlay,
      aggregatorKey: `${binanceSymbol}_${binanceTf}`
    };

    engineRef.current = new ChartEngine(containerRef.current, { callbacks, props, getMagnetMode: () => useChartStore.getState().magnetMode });

    // Bind global events
    const onClearDrawings = () => engineRef.current.drawingEngine?.clearAll();
    const onDeleteDrawing = () => engineRef.current.drawingEngine?.onKeyDown('Delete');
    const onToggleVisibility = (e) => engineRef.current.drawingEngine?.toggleVisibility(e.detail);
    const onToggleLock = (e) => engineRef.current.drawingEngine?.toggleLock(e.detail);
    const onDeleteSpecific = (e) => engineRef.current.drawingEngine?.removeDrawing(e.detail);
    const handleKeyDown = (e) => {
      // Pass all keys to drawing engine first (handles Escape, Delete, Backspace, Ctrl+C/V/D)
      if (engineRef.current.drawingEngine?.onKeyDown(e.key)) {
        e.preventDefault();
        return;
      }

      // Don't fire tool shortcuts when typing in inputs
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Single-key drawing tool shortcuts
      const TOOL_SHORTCUTS = {
        t: 'trendline',
        h: 'hline',
        f: 'fib',
        r: 'rect',
        a: 'arrow',
        m: 'measure',
        v: 'vline',
      };
      const tool = TOOL_SHORTCUTS[e.key.toLowerCase()];
      if (tool && !e.ctrlKey && !e.metaKey && !e.altKey) {
        useChartStore.getState().setActiveTool(tool);
        e.preventDefault();
      }
    };

    window.addEventListener('charEdge:clear-drawings', onClearDrawings);
    window.addEventListener('charEdge:delete-drawing', onDeleteDrawing);
    window.addEventListener('charEdge:toggle-visibility', onToggleVisibility);
    window.addEventListener('charEdge:toggle-lock', onToggleLock);
    window.addEventListener('charEdge:delete-specific', onDeleteSpecific);
    window.addEventListener('keydown', handleKeyDown);

    // Support drawing style updates from DrawingPropertyEditor
    const onUpdateDrawingStyle = (e) => {
      const { id, style } = e.detail;
      if (engineRef.current?.drawingEngine) {
        engineRef.current.drawingEngine.updateStyle(id, style);
      }
    };
    window.addEventListener('charEdge:update-drawing-style', onUpdateDrawingStyle);

    // Right-click context menu for drawings
    const handleContextMenu = (e) => {
      const de = engineRef.current?.drawingEngine;
      if (!de) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      // Check if click hits a drawing
      de.onMouseMove(mx, my); // update hover
      if (de.hoveredDrawingId) {
        e.preventDefault();
        const drawing = de.drawings.find((d) => d.id === de.hoveredDrawingId);
        if (drawing) {
          setCtxMenu({ x: e.clientX, y: e.clientY, drawing });
        }
      }
    };
    if (containerRef.current) containerRef.current.addEventListener('contextmenu', handleContextMenu);

    // Double-click for editing drawings or opening indicator settings
    const handleDblClick = (e) => {
      const eng = engineRef.current;
      if (!eng) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Sprint 13: Check legend double-click first
      const regions = eng.state._legendHitRegions || [];
      for (const r of regions) {
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h && r.type === 'indicator') {
          setEditingIndicatorIdx(r.idx);
          return; // consume — don't pass to drawing engine
        }
      }

      // Existing: drawing double-click
      const de = eng.drawingEngine;
      if (de) de.onDoubleClick(x, y);
    };
    if (containerRef.current) containerRef.current.addEventListener('dblclick', handleDblClick);

    // Listen for edit-drawing event from DrawingEngine
    const handleEditDrawing = (e) => {
      setCtxMenu(null); // Close context menu if open
      setEditPopup(e.detail);
    };
    window.addEventListener('charEdge:edit-drawing', handleEditDrawing);

    // Handle text edit completion
    const handleTextEdit = (e) => {
      const { id, text } = e.detail;
      const de = engineRef.current?.drawingEngine;
      if (!de) return;
      const d = de.drawings.find((d) => d.id === id);
      if (d) {
        if (!d.meta) d.meta = {};
        d.meta.text = text;
        // Trigger re-render
        useChartStore.getState().setDrawings(de.drawings);
      }
    };
    window.addEventListener('charEdge:submit-drawing-text', handleTextEdit);

    // Sprint 12: Toggle indicator visibility from legend eye icon
    const onToggleIndicator = (e) => {
      const eng = engineRef.current;
      if (!eng) return;
      const idx = e.detail;
      if (eng.state.hiddenIndicators.has(idx)) {
        eng.state.hiddenIndicators.delete(idx);
      } else {
        eng.state.hiddenIndicators.add(idx);
      }
      eng.markDirty();
    };
    window.addEventListener('charEdge:toggle-indicator', onToggleIndicator);

    // Sprint 13: Open indicator settings from event
    const onOpenIndicatorSettings = (e) => {
      setEditingIndicatorIdx(e.detail?.idx ?? e.detail);
    };
    window.addEventListener('charEdge:open-indicator-settings', onOpenIndicatorSettings);

    // Task 2.3.23: Start session recovery auto-save (every 30s)
    const stopRecovery = startAutoSave(
      () => engineRef.current,
      () => ({
        uiStore: useUIStore,
        workspaceStore: { getState: () => ({}) },
      }),
    );

    if (onEngineReady) onEngineReady(engineRef.current);

    return () => {
      // Task 2.3.23: Stop auto-save before destroy
      stopRecovery();

      window.removeEventListener('charEdge:clear-drawings', onClearDrawings);
      window.removeEventListener('charEdge:delete-drawing', onDeleteDrawing);
      window.removeEventListener('charEdge:toggle-visibility', onToggleVisibility);
      window.removeEventListener('charEdge:toggle-lock', onToggleLock);
      window.removeEventListener('charEdge:delete-specific', onDeleteSpecific);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('charEdge:update-drawing-style', onUpdateDrawingStyle);
      window.removeEventListener('charEdge:submit-drawing-text', handleTextEdit);
      window.removeEventListener('charEdge:edit-drawing', handleEditDrawing);
      window.removeEventListener('charEdge:toggle-indicator', onToggleIndicator);
      window.removeEventListener('charEdge:open-indicator-settings', onOpenIndicatorSettings);
      if (containerRef.current) {
        containerRef.current.removeEventListener('contextmenu', handleContextMenu);
        containerRef.current.removeEventListener('dblclick', handleDblClick);
      }

      engineRef.current?.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update properties
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setProps({
      theme, symbol, tf, chartType, showVolume, compact, trades, srLevels,
      patternMarkers, divergences, storeChartColors, magnetMode,
      showHeatmap, heatmapIntensity, showSessions, paneHeights,
      showDeltaOverlay, showVPOverlay, showOIOverlay, showLargeTradesOverlay,
      aggregatorKey: `${binanceSymbol}_${binanceTf}`
    });
  }, [theme, symbol, tf, chartType, showVolume, compact, trades, srLevels, patternMarkers, divergences, storeChartColors, magnetMode, showHeatmap, heatmapIntensity, showSessions, paneHeights, showDeltaOverlay, showVPOverlay, showOIOverlay, showLargeTradesOverlay, binanceSymbol, binanceTf]);

  // Sprint 1: Sync historyLoading state to engine for shimmer bar rendering
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.state.historyLoading = historyLoading;
    if (historyLoading) engineRef.current.markDirty();
  }, [historyLoading]);

  // Sprint 8: Preserve viewport when older bars are prepended
  // Uses queueMicrotask to ensure offset applies before next rAF frame (prevents white flash)
  // FIX: Moved setState reset into queueMicrotask to avoid synchronous setState-during-render.
  const lastPrependCount = useChartStore((s) => s.lastPrependCount);
  useEffect(() => {
    if (!engineRef.current || !lastPrependCount) return;
    // Apply offset synchronously and force immediate redraw to avoid blank frame
    queueMicrotask(() => {
      if (!engineRef.current) return;
      engineRef.current.state.scrollOffset += lastPrependCount;
      engineRef.current.markDirty();
      // Reset after consuming — inside microtask to break synchronous setState cycle
      useChartStore.setState({ lastPrependCount: 0 });
    });
  }, [lastPrependCount]);

  // Update tools
  useEffect(() => {
    if (!engineRef.current?.drawingEngine) return;
    if (storeActiveTool) {
      engineRef.current.drawingEngine.activateTool(storeActiveTool, { color: storeDrawingColor });
    } else {
      engineRef.current.drawingEngine.cancelTool();
    }
  }, [storeActiveTool, storeDrawingColor]);

  // Sync sticky mode from store to engine
  useEffect(() => {
    if (!engineRef.current?.drawingEngine) return;
    engineRef.current.drawingEngine.setStickyMode(storeStickyMode);
  }, [storeStickyMode]);

  // Update alerts
  useEffect(() => {
    if (engineRef.current) engineRef.current.setAlerts(alerts);
  }, [alerts]);

  // Handle datafeed
  useEffect(() => {
    if (!engineRef.current) return;
    setStatus('loading');
    barsRef.current = [];

    const unsubscribe = datafeedService.subscribe(binanceSymbol, binanceTf, {
      onHistorical: (bars) => {
        barsRef.current = bars;
        // Task 2.3.27: Only update React state when bar count changes
        setBarCount(prev => prev === bars.length ? prev : bars.length);
        setStatus('ready');
        setStoreData(bars, 'binance');
        setDataSource('binance');
        // P2: Trigger staggered entrance on first historical load
        if (!hasEnteredRef.current) {
          hasEnteredRef.current = true;
          setShowEntrance(true);
        }
        // TickChannel delivers to engine directly; this is for React state only
      },
      onTick: (bars, latestBar) => {
        barsRef.current = bars;
        // Task 2.3.27: Only update React state when bar count changes
        setBarCount(prev => prev === bars.length ? prev : bars.length);
        // Engine gets data directly from TickChannel (rAF-batched, bypasses React)
      },
      onError: (err) => {
        logger.engine.error('Datafeed error:', err);
        setStatus('error');
        setDataSource('no_data');
      },
    });

    // Subscribe engine to TickChannel for direct tick delivery (8.1.1 + 8.1.2)
    const tickKey = `${binanceSymbol}_${binanceTf}`;
    const unsubTick = engineRef.current
      ? tickChannel.subscribe(tickKey, engineRef.current)
      : null;

    return () => {
      unsubscribe();
      if (unsubTick) unsubTick();
    };
  }, [binanceSymbol, binanceTf, setStoreData]);

  // P2: TF cross-dissolve — trigger on timeframe change
  useEffect(() => {
    if (prevTfRef.current !== tf && hasEnteredRef.current) {
      setDissolving(true);
      const timer = setTimeout(() => setDissolving(false), 160);
      prevTfRef.current = tf;
      return () => clearTimeout(timer);
    }
    prevTfRef.current = tf;
  }, [tf]);

  const indicatorInstancesRef = useRef([]);

  // Compute indicators (offloaded to ComputeWorkerPool via IndicatorWorkerBridge)
  useEffect(() => {
    const bars = barsRef.current;
    if (!bars.length || !indicators?.length) {
      indicatorInstancesRef.current = [];
      engineRef.current?.setIndicators([]);
      return;
    }

    // Check if configuration changed (indicators added/removed/params changed)
    const configChanged = indicatorInstancesRef.current.length !== indicators.length ||
      indicators.some((ind, i) => {
        const inst = indicatorInstancesRef.current[i];
        if (!inst || inst.indicatorId !== (ind.indicatorId || ind.type)) return true;
        // Task 2.3.28: Stable comparison — avoid JSON.stringify reference instability
        const a = ind.params || {};
        const b = inst.params || {};
        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);
        if (aKeys.length !== bKeys.length) return true;
        return aKeys.some(k => a[k] !== b[k]);
      });

    if (configChanged) {
      // Full recompute — route through ComputeWorkerPool for off-thread processing
      const instances = indicators.map((ind) => {
        const id = ind.indicatorId || ind.type;
        if (!INDICATORS[id]) return null;
        const instance = createIndicatorInstance(id, ind.params || {});
        if (ind.color && instance.outputs[0]) instance.outputs[0].color = ind.color;
        // Strategy Item #13: Merge user band overrides onto registry default paneConfig
        if (ind.bandOverrides && instance.paneConfig?.bands) {
          instance.paneConfig = { ...instance.paneConfig };
          instance.paneConfig.bands = instance.paneConfig.bands.map((band, bi) => {
            const override = ind.bandOverrides[bi];
            return override ? { ...band, ...override } : band;
          });
        }
        return instance;
      }).filter(Boolean);

      // Build batch tasks for the worker pool
      const batchTasks = instances.map(inst => ({
        indicator: inst.indicatorId,
        params: inst.params,
      }));

      // Async worker computation with synchronous fallback
      indicatorBridge.computeBatch(batchTasks, bars).then(results => {
        // Apply worker-computed results to instances
        for (const inst of instances) {
          const workerResult = results[inst.indicatorId];
          if (workerResult && typeof workerResult === 'object' && !Array.isArray(workerResult)) {
            inst.computed = workerResult;
          } else {
            // Worker didn't return expected format — use registry compute as fallback
            inst.compute(bars);
          }
        }
        indicatorInstancesRef.current = instances;
        engineRef.current?.setIndicators(instances);
      }).catch(() => {
        // Full fallback — compute synchronously on main thread
        for (const inst of instances) inst.compute(bars);
        indicatorInstancesRef.current = instances;
        engineRef.current?.setIndicators(instances);
      });
    } else {
      // Tick update — incrementally update existing instances (O(1) per indicator, stays on main thread)
      indicatorInstancesRef.current.forEach((inst) => {
        inst.update(bars);
      });
      engineRef.current?.setIndicators(indicatorInstancesRef.current);
    }
  }, [indicators, barCount]);

  // Task 1.4.6: Touch-hold handlers for Zoom Loupe
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return; // Only single-finger
    const t = e.touches[0];
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = t.clientX - rect.left;
    const y = t.clientY - rect.top;
    setLoupePos({ x, y });

    // Activate loupe after 200ms hold
    if (loupeTouchTimer.current) clearTimeout(loupeTouchTimer.current);
    loupeTouchTimer.current = setTimeout(() => {
      setLoupeActive(true);
    }, 200);
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!e.touches.length) return;
    const t = e.touches[0];
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setLoupePos({ x: t.clientX - rect.left, y: t.clientY - rect.top });
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (loupeTouchTimer.current) {
      clearTimeout(loupeTouchTimer.current);
      loupeTouchTimer.current = null;
    }
    setLoupeActive(false);
  }, []);

  return (
    <div
      data-container="chart"
      className={dissolving ? 'tf-chart-dissolve' : undefined}
      style={{ position: 'relative', width, height, overflow: 'hidden' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {status === 'loading' && (
        <ChartLoadingNarrative status={status} symbol={symbol} barCount={barCount} />
      )}

      {status === 'error' && (
        <DataFallbackBanner
          symbol={symbol}
          tfId={tf}
          dataSource={dataSource}
          onRetry={() => {
            setStatus('loading');
            import('../../../../data/FetchService.ts').then(({ fetchOHLC }) => {
              fetchOHLC(symbol, tf).then(({ data: newData, source }) => {
                if (newData?.length) {
                  barsRef.current = newData;
                  setBarCount(prev => prev === newData.length ? prev : newData.length);
                  setStatus('ready');
                  setDataSource(source);
                  setStoreData(newData, source);
                  engineRef.current?.setData(newData);
                } else {
                  setStatus('error');
                  setDataSource('no_data');
                }
              }).catch((err) => { logger.engine.warn('[ChartEngine] Retry failed:', err?.message); setStatus('error'); setDataSource('no_data'); });
            });
          }}
        />
      )}

      {children}

      {/* Replay Toolbar — shown during replay mode */}
      {replayMode && (
        <ReplayToolbar
          replayState={replayPlaying ? 'playing' : 'paused'}
          currentIndex={replayIdx}
          totalBars={barCount}
          speed={1}
          onPlay={() => setReplayPlaying(true)}
          onPause={() => setReplayPlaying(false)}
          onStop={() => toggleReplay()}
          onStep={() => setReplayIdx(replayIdx + 1)}
          onSpeedChange={() => { }}
          onSeek={(idx) => setReplayIdx(idx)}
          paperTrade={paperTradeRef.current}
        />
      )}

      {/* Sprint 1/8: History Loading Indicator — left edge during scroll-left prefetch */}
      {historyLoading && (
        <div style={{
          position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
          display: 'flex', alignItems: 'center', gap: 6, zIndex: 12,
          background: 'rgba(19,23,34,0.88)', borderRadius: 16,
          padding: '6px 14px 6px 10px', border: '1px solid rgba(54,58,69,0.5)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            width: 14, height: 14, border: '2px solid #363A45',
            borderTopColor: '#2962FF', borderRadius: '50%',
            animation: 'spin .8s linear infinite',
          }} />
          <span style={{ color: '#787B86', fontSize: 11, fontFamily: 'Inter, Arial, sans-serif', whiteSpace: 'nowrap' }}>
            Loading history…
          </span>
        </div>
      )}

      {/* Data Staleness Indicator — top-right badge */}
      {status === 'ready' && (
        <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 15 }}>
          <DataStalenessIndicator
            symbol={binanceSymbol}
            tfId={tf}
            isLive={status === 'ready' && barCount > 0}
          />
        </div>
      )}

      {highlightedTrade && (
        <TradeMarkerOverlay
          trade={highlightedTrade}
          onDismiss={dismissTradeOverlay}
          onViewJournal={handleViewJournal}
        />
      )}

      {ctxMenu && (
        <DrawingContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          drawing={ctxMenu.drawing}
          engine={engineRef.current?.drawingEngine}
          onClose={closeContextMenu}
        />
      )}

      {editPopup && (
        <DrawingEditPopup
          drawing={editPopup}
          containerRect={containerRef.current?.getBoundingClientRect()}
          engine={engineRef.current?.drawingEngine}
          onClose={closeEditPopup}
        />
      )}

      {editingIndicatorIdx != null && (
        <IndicatorSettingsDialog
          indicatorIdx={editingIndicatorIdx}
          onClose={() => setEditingIndicatorIdx(null)}
        />
      )}

      {/* AI Analysis Panel — opt-in via Indicator Panel toggles */}
      {intelligence?.enabled && engineRef.current?.bars?.length > 50 && (
        <div style={{ position: 'absolute', top: 50, right: 8, zIndex: 20, maxHeight: 'calc(100% - 60px)', overflowY: 'auto' }}>
          <ChartAnalysisPanel
            bars={engineRef.current.bars}
            symbol={symbol}
            timeframe={tf}
            onClose={() => useChartStore.getState().toggleIntelligenceMaster()}
          />
        </div>
      )}

      {/* Task 1.4.6: Precision Zoom Loupe for mobile */}
      <ZoomLoupe
        canvasRef={containerRef}
        touchX={loupePos.x}
        touchY={loupePos.y}
        active={loupeActive}
        price={engineRef.current?.state?.crosshairPrice
          ? engineRef.current.state.crosshairPrice.toFixed(2)
          : undefined
        }
      />

    </div>
  );
}
