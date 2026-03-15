// ═══════════════════════════════════════════════════════════════════
// charEdge v11 — ChartEngineWidget (Bridge Component)
//
// Wraps the decoupled ChartEngine class and connects it to charEdge's
// existing Zustand stores. Drop-in replacement for the old ChartCanvas.
// ═══════════════════════════════════════════════════════════════════

// eslint-disable-next-line import/order
import { useUserStore } from '../../../../state/useUserStore';
// eslint-disable-next-line import/order
import { logger } from '@/observability/logger';
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getChartAriaProps, ChartAnnouncer } from '../../../../charting_library/core/ChartAccessibility';
import { ChartEngine } from '../../../../charting_library/core/ChartEngine.js';
import { getResponsiveChartConfig } from '../../../../charting_library/core/MobileChartExperience.js';
import { tickChannel } from '../../../../charting_library/core/TickChannel.js';
import { datafeedService } from '../../../../charting_library/datafeed/DatafeedService.js';
// eslint-disable-next-line import/order
import { createIndicatorInstance, INDICATORS } from '../../../../charting_library/studies/indicators/registry.js';
 
// eslint-disable-next-line import/order
import { useLongPressCrosshair } from '../../../../hooks/useLongPressCrosshair';
const GestureGuide = React.lazy(() => import('../../ui/GestureGuide.jsx'));
const MobileDrawingSheet = React.lazy(() => import('../../mobile/MobileDrawingSheet.jsx'));

// ─── Constants ─────────────────────────────────────────────────────────
// eslint-disable-next-line import/order
import { resolveAdapterTimeframe } from '../../../../constants/TimeframeMap';

// Symbol shorthand map — exported so other modules can reuse
export const SYMBOL_MAP = {
  BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', BNB: 'BNBUSDT',
  XRP: 'XRPUSDT', DOGE: 'DOGEUSDT', ADA: 'ADAUSDT', AVAX: 'AVAXUSDT',
  DOT: 'DOTUSDT', MATIC: 'MATICUSDT', LINK: 'LINKUSDT', UNI: 'UNIUSDT',
};

import { isCrypto } from '../../../../constants.js';
import { indicatorBridge } from '../../../../data/engine/indicators/IndicatorWorkerBridge.js';
import { useOrderFlowConnection } from '../../../../data/engine/orderflow/useOrderFlowConnection.js';
import { useAlertStore } from '../../../../state/useAlertStore';
import { useJournalStore } from '../../../../state/useJournalStore';
import { useUIStore } from '../../../../state/useUIStore';
import ChartKeyboardNav from '../ChartKeyboardNav.jsx';
import ChartLoadingNarrative from '../overlays/ChartLoadingNarrative.jsx';
import TradeMarkerOverlay from '../overlays/TradeMarkerOverlay.jsx';
import TradeLevelOverlay from '../overlays/TradeLevelOverlay.jsx';
import PositionLineOverlay from '../overlays/PositionLineOverlay.jsx';
import AlertLinesOverlay from '../overlays/AlertLinesOverlay.jsx';
import ZoomLoupe from '../overlays/ZoomLoupe.jsx';
import ChartAnalysisPanel from '../panels/ChartAnalysisPanel.jsx';
import IndicatorSettingsDialog from '../panels/IndicatorSettingsDialog.jsx';
import ReplayToolbar from '../ReplayToolbar.jsx';
import DrawingContextMenu from '../tools/DrawingContextMenu.jsx';
import DrawingEditPopup from '../tools/DrawingEditPopup.jsx';
import FloatingDrawingBar from '../tools/FloatingDrawingBar.jsx';
import InlineTextEditor from '../tools/InlineTextEditor.jsx';
import ChartDataTable from '../ui/ChartDataTable.jsx';
import DataFallbackBanner from '../ui/DataFallbackBanner.jsx';
import DataStalenessIndicator from '../ui/DataStalenessIndicator.jsx';
import { useCrosshairSync } from './hooks/useCrosshairSync';
import { useScrollSync } from './hooks/useScrollSync';
import { useTradeNavigation } from './hooks/useTradeNavigation';
import crosshairBus from '@/charting_library/utils/CrosshairBus';
import { ReplayPaperTrade } from '@/trading/ReplayPaperTrade.js';
import { startAutoSave } from '@/charting_library/core/SessionRecovery';
import { useChartCoreStore } from '../../../../state/chart/useChartCoreStore';
import { useChartToolsStore } from '../../../../state/chart/useChartToolsStore';
import { useChartFeaturesStore } from '../../../../state/chart/useChartFeaturesStore';

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
  // Sprint 6: Split into 3 targeted selectors — changes in one domain don't trigger re-eval in others

  // Core (changes rarely — symbol switch, TF switch)
  // Now safe to read from useChartCoreStore since ALL consumers write to focused stores.
  const {
    symbol: storeSymbol, tf: storeTf, chartType,
    setData: setStoreData, _setSymbol,
    historyLoading, activeTimezone, setActiveTimezone,
  } = useChartCoreStore(useShallow((s) => ({
    symbol: s.symbol, tf: s.tf, chartType: s.chartType,
    setData: s.setData, setSymbol: s.setSymbol,
    historyLoading: s.historyLoading,
    activeTimezone: s.activeTimezone,
    setActiveTimezone: s.setActiveTimezone,
  })));

  // linkGroup is ad-hoc state on the combined store (set externally)
  const linkGroup = useChartFeaturesStore((s) => s.linkGroup);

  // Features (changes on user toggle — not on tick)
  const {
    showHeatmap, heatmapIntensity, showSessions, paneHeights,
    showDeltaOverlay, showVPOverlay, showOIOverlay, showLargeTradesOverlay,
    showVolumeSpikes, showPatternOverlays, showExtendedHours, showArbitrageSpread,
    intelligence, replayMode, replayIdx, replayPlaying,
    toggleReplay, setReplayIdx, setReplayPlaying,
    chartColors: storeChartColors, showCrosshairTooltip,
  } = useChartFeaturesStore(useShallow((s) => ({
    showHeatmap: s.showHeatmap, heatmapIntensity: s.heatmapIntensity,
    showSessions: s.showSessions, paneHeights: s.paneHeights,
    showDeltaOverlay: s.showDeltaOverlay, showVPOverlay: s.showVPOverlay,
    showOIOverlay: s.showOIOverlay, showLargeTradesOverlay: s.showLargeTradesOverlay,
    showVolumeSpikes: s.showVolumeSpikes, showPatternOverlays: s.showPatternOverlays,
    showExtendedHours: s.showExtendedHours, showArbitrageSpread: s.showArbitrageSpread,
    intelligence: s.intelligence,
    replayMode: s.replayMode, replayIdx: s.replayIdx, replayPlaying: s.replayPlaying,
    toggleReplay: s.toggleReplay, setReplayIdx: s.setReplayIdx, setReplayPlaying: s.setReplayPlaying,
    chartColors: s.chartColors, showCrosshairTooltip: s.showCrosshairTooltip,
  })));

  // Tools (changes on draw/indicator edit — isolated from tick path)
  const {
    indicators: storeIndicators, activeTool: storeActiveTool,
    drawingColor: storeDrawingColor, magnetMode, stickyMode: storeStickyMode,
  } = useChartToolsStore(useShallow((s) => ({
    indicators: s.indicators, activeTool: s.activeTool,
    drawingColor: s.drawingColor, magnetMode: s.magnetMode,
    stickyMode: s.stickyMode,
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
        const current = useChartCoreStore.getState().symbol;
        if (current !== newSymbol) {
          // Set symbol directly without broadcasting again (avoid infinite loop)
          useChartCoreStore.setState({ symbol: newSymbol });
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
  const paneIdRef = useRef(`widget-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);

  // P2: Staggered entrance — fires once on first data load
  const hasEnteredRef = useRef(false);
  const [_showEntrance, setShowEntrance] = useState(false);

  // Sprint 3 (A11y): Announcer for screen readers
  const announcerRef = useRef(null);
  // Sprint 3 (A11y): Data table toggle (initially hidden, sr-only)
  const [showDataTable, _setShowDataTable] = useState(false);

  // Sprint 11 B5/B6: Detect coarse pointer (touch device) for mobile features
  const [isCoarse, setIsCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    setIsCoarse(mq.matches);
    const onChange = (e) => setIsCoarse(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  // Sprint 11 B5: Long-press crosshair hook
  const { _isCrosshairActive, position: _crosshairPos, containerRef: _crosshairRef } = useLongPressCrosshair({ enabled: isCoarse });

  // P2: TF cross-dissolve
  const prevTfRef = useRef(tf);
  const [dissolving, setDissolving] = useState(false);

  // Sprint 11 B3: Track container width for responsive chart config
  const [containerWidth, setContainerWidth] = useState(1024);
  useEffect(() => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w && w > 0) setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sprint 11 B3: Compute responsive config from container width
  const responsiveConfig = useMemo(() => getResponsiveChartConfig(containerWidth), [containerWidth]);

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

  // Sprint 6: Extracted sub-effects into custom hooks
  const { highlightedTrade, dismissTradeOverlay } = useTradeNavigation(engineRef, barsRef);
  useCrosshairSync(engineRef, paneIdRef.current);
  useScrollSync(engineRef, paneIdRef.current, barCount);

  const handleViewJournal = useCallback(() => {
    dismissTradeOverlay();
    setPage('journal');
  }, [setPage, dismissTradeOverlay]);


  // Initialize Engine once
  useEffect(() => {
    if (!containerRef.current) return;
    const callbacks = {
      onBarClick: (price, time, bar) => {
        // Trade mode: check store directly (avoids stale closure on tradeMode)
        const ts = useChartCoreStore.getState();
        if (ts.tradeMode && ts.tradeStep) {
          switch (ts.tradeStep) {
            case 'entry':
              ts.setEntry(price, bar?.index ?? 0);
              break;
            case 'sl':
              ts.setSL(price, bar?.index ?? 0);
              break;
            case 'tp':
              ts.setTP(price, bar?.index ?? 0);
              break;
            default:
              break;
          }
          return; // Consume click — don't pass to drawing handler
        }
        onBarClick?.(price, time, bar);
      },
      onCrosshairMove: (e) => {
        // Emit to CrosshairBus for synced crosshair
        if (e?.bar?.time) {
          crosshairBus.emit(paneIdRef.current, { timestamp: e.bar.time, price: e.price });
        }
        onCrosshairMove?.(e);
      },
      onDrawingsChange: (drawings) => {
        useChartToolsStore.getState().setSelectedDrawing(engineRef.current?.drawingEngine?.selectedDrawing?.id || null);
        useChartToolsStore.getState().setDrawings(drawings);
      },
      onDrawingStateChange: (state) => {
        if (state === 'idle') useChartToolsStore.getState().setActiveTool(null);
      },
      // Sprint 11: Pane resize callback — updates Zustand store
      onPaneResize: (paneIdx, fraction) => {
        useChartFeaturesStore.getState().setPaneHeight(paneIdx, fraction);
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
      showVolumeSpikes, showPatternOverlays, showExtendedHours, showArbitrageSpread,
      activeTimezone,
      aggregatorKey: `${binanceSymbol}_${binanceTf}`
    };

    engineRef.current = new ChartEngine(containerRef.current, { callbacks, props, getMagnetMode: () => useChartToolsStore.getState().magnetMode });

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
        useChartToolsStore.getState().setActiveTool(tool);
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
        useChartToolsStore.getState().setDrawings(de.drawings);
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

    // Timezone selector event — wires DOM overlay to store
    const onSetTimezone = (e) => {
      const tz = e.detail?.timezone;
      if (tz) setActiveTimezone(tz);
    };
    window.addEventListener('charEdge:set-timezone', onSetTimezone);

    // Auto-fit button event — reset autoScale from DOM overlay
    const onAutoFit = () => {
      const eng = engineRef.current;
      if (!eng) return;
      eng.state.autoScale = true;
      eng.state.priceScale = 1;
      eng.state.priceScroll = 0;
      eng.state.mainDirty = true;
      eng.state.topDirty = true;
      eng._scheduleDraw();
    };
    window.addEventListener('charEdge:autoFit', onAutoFit);

    // Task 2.3.23: Start session recovery auto-save (every 30s)
    const stopRecovery = startAutoSave(
      () => engineRef.current,
      () => ({
        uiStore: useUIStore,
        workspaceStore: { getState: () => ({}) },
      }),
    );

    if (onEngineReady) onEngineReady(engineRef.current);

    // Sprint 3: Mount ChartAnnouncer for screen reader price updates
    const announcer = new ChartAnnouncer();
    announcer.mount();
    announcerRef.current = announcer;

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
      window.removeEventListener('charEdge:set-timezone', onSetTimezone);
      window.removeEventListener('charEdge:autoFit', onAutoFit);
      if (containerRef.current) {
        containerRef.current.removeEventListener('contextmenu', handleContextMenu);
        // eslint-disable-next-line react-hooks/exhaustive-deps
        containerRef.current.removeEventListener('dblclick', handleDblClick);
      }

      // Sprint 3: Unmount announcer
      if (announcerRef.current) {
        announcerRef.current.unmount();
        announcerRef.current = null;
      }

      engineRef.current?.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sprint 6: Debounced setProps — coalesces rapid changes within a single rAF frame
  useEffect(() => {
    if (!engineRef.current) return;
    const id = requestAnimationFrame(() => {
      engineRef.current?.setProps({
        theme, symbol, tf, chartType, showVolume, compact, trades, srLevels,
        patternMarkers, divergences, storeChartColors, magnetMode,
        showHeatmap, heatmapIntensity, showSessions, paneHeights,
        showDeltaOverlay, showVPOverlay, showOIOverlay, showLargeTradesOverlay,
        showVolumeSpikes, showPatternOverlays, showExtendedHours, showArbitrageSpread,
        activeTimezone,
        aggregatorKey: `${binanceSymbol}_${binanceTf}`,
        // Sprint 11 B3: Responsive chart config
        barSpacing: responsiveConfig.barSpacing,
        priceAxisWidth: responsiveConfig.priceAxisWidth,
        timeAxisHeight: responsiveConfig.timeAxisHeight,
        compactMode: responsiveConfig.compactMode,
        autoHideToolbar: responsiveConfig.autoHideToolbar,
      });
    });
    return () => cancelAnimationFrame(id);
  }, [theme, symbol, tf, chartType, showVolume, compact, trades, srLevels, patternMarkers, divergences, storeChartColors, magnetMode, showHeatmap, heatmapIntensity, showSessions, paneHeights, showDeltaOverlay, showVPOverlay, showOIOverlay, showLargeTradesOverlay, showVolumeSpikes, showPatternOverlays, showExtendedHours, showArbitrageSpread, binanceSymbol, binanceTf, responsiveConfig, activeTimezone]);

  // REST depth polling fallback for heatmap (when WS depth stream is unavailable)
  useEffect(() => {
    const key = `${binanceSymbol}_${binanceTf}`;
    if (showHeatmap) {
      datafeedService.startDepthPolling(binanceSymbol, key);
    } else {
      datafeedService.stopDepthPolling(key);
    }
    return () => datafeedService.stopDepthPolling(key);
  }, [showHeatmap, binanceSymbol, binanceTf]);

  // Sprint 1: Sync historyLoading state to engine for shimmer bar rendering
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.state.historyLoading = historyLoading;
    if (historyLoading) engineRef.current.markDirty();
  }, [historyLoading]);

  // Sync crosshair tooltip visibility to engine for UIStage
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current._showCrosshairTooltip = showCrosshairTooltip;
    engineRef.current.markDirty();
  }, [showCrosshairTooltip]);

  // Sprint 8: Preserve viewport when older bars are prepended
  // Uses queueMicrotask to ensure offset applies before next rAF frame (prevents white flash)
  // FIX: Moved setState reset into queueMicrotask to avoid synchronous setState-during-render.
  const lastPrependCount = useChartCoreStore((s) => s.lastPrependCount);
  useEffect(() => {
    if (!engineRef.current || !lastPrependCount) return;
    // Apply offset synchronously and force immediate redraw to avoid blank frame
    queueMicrotask(() => {
      if (!engineRef.current) return;
      engineRef.current.state.scrollOffset += lastPrependCount;
      engineRef.current.markDirty();
      // Reset after consuming — inside microtask to break synchronous setState cycle
      useChartCoreStore.setState({ lastPrependCount: 0 });
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
        // Sprint 3 (A11y): Announce new data to screen readers
        if (announcerRef.current && bars.length > 0) {
          const last = bars[bars.length - 1];
          announcerRef.current.announce(`${symbol} loaded. ${bars.length} bars. Latest close: ${last.close?.toFixed(2)}`);
        }
        // TickChannel delivers to engine directly; this is for React state only
      },
      onTick: (bars, _latestBar) => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Only compute visible indicators — respect the `visible` flag from store
    const visibleIndicators = (indicators || []).filter(ind => ind.visible !== false);
    if (!bars.length || !visibleIndicators.length) {
      indicatorInstancesRef.current = [];
      engineRef.current?.setIndicators([]);
      return;
    }

    // Check if configuration changed (indicators added/removed/params changed)
    const configChanged = indicatorInstancesRef.current.length !== visibleIndicators.length ||
      visibleIndicators.some((ind, i) => {
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
      const instances = visibleIndicators.map((ind) => {
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

  // Sprint 3 (A11y): Compute ARIA props for the chart container
  const lastBar = barsRef.current?.[barsRef.current.length - 1];
  const prevBar = barsRef.current?.[barsRef.current.length - 2];
  const priceChange = (lastBar && prevBar && prevBar.close)
    ? ((lastBar.close - prevBar.close) / prevBar.close * 100)
    : 0;
  const ariaProps = lastBar
    ? getChartAriaProps(symbol, tf, lastBar.close, priceChange)
    : { role: 'img', 'aria-label': `${symbol} chart loading`, tabIndex: 0 };

  return (
    <div
      data-container="chart"
      className={dissolving ? 'tf-chart-dissolve' : undefined}
      style={{ position: 'relative', width, height, overflow: 'hidden' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      {...ariaProps}
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





      {highlightedTrade && (
        <TradeMarkerOverlay
          trade={highlightedTrade}
          onDismiss={dismissTradeOverlay}
          onViewJournal={handleViewJournal}
        />
      )}

      {/* Trade level dotted lines (entry, SL, TP) */}
      <TradeLevelOverlay engineRef={engineRef} />

      {/* Position entry lines — anchored via engine p2y() */}
      <PositionLineOverlay symbol={symbol} engineRef={engineRef} />

      {/* Price alert lines — anchored via engine p2y() */}
      <AlertLinesOverlay symbol={symbol} engineRef={engineRef} />

      {ctxMenu && (
        <DrawingContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          drawing={ctxMenu.drawing}
          engine={engineRef.current?.drawingEngine}
          onClose={closeContextMenu}
        />
      )}

      {/* Floating quick-action bar for selected drawing */}
      {(() => {
        const de = engineRef.current?.drawingEngine;
        const sel = de?.selectedDrawing;
        if (!sel || ctxMenu) return null;
        return (
          <FloatingDrawingBar
            engine={de}
            drawing={sel}
            canvasRect={containerRef.current?.getBoundingClientRect()}
            onOpenSettings={(d) => setEditPopup(d)}
          />
        );
      })()}

      {/* Inline text editor overlay */}
      <InlineTextEditor canvasRect={containerRef.current?.getBoundingClientRect()} />

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
            onClose={() => useChartFeaturesStore.getState().toggleIntelligenceMaster()}
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

      {/* Sprint 3 (A11y): Keyboard navigation for chart */}
      <ChartKeyboardNav
        chartRef={containerRef}
        bars={barsRef.current}
        drawings={engineRef.current?.drawingEngine?.drawings || []}
        onCrosshairMove={(barIdx) => {
          if (engineRef.current) {
            engineRef.current.state.hoverIdx = barIdx;
            engineRef.current.markDirty();
          }
        }}
        onSelectDrawing={(id) => {
          engineRef.current?.drawingEngine?.selectDrawing(id);
        }}
        onDeselect={() => {
          engineRef.current?.drawingEngine?.deselectAll();
        }}
      />

      {/* Sprint 3 (A11y): Screen-reader-accessible data table (hidden by default) */}
      <ChartDataTable
        bars={barsRef.current}
        visible={showDataTable}
        symbol={symbol}
      />

      {/* Sprint 11 #89: Mobile Drawing Sheet — bottom sheet on touch devices */}
      {isCoarse && (
        <React.Suspense fallback={null}>
          <MobileDrawingSheet />
        </React.Suspense>
      )}

      {/* Sprint 11 #88: Gesture Guide — shown once on touch devices */}
      {isCoarse && (
        <React.Suspense fallback={null}>
          <GestureGuide />
        </React.Suspense>
      )}

    </div>
  );
}
