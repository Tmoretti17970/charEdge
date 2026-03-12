// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Local State Hook
// Extracted from ChartsPage (Phase 0.1): manages all local UI state
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { analyzeAll } from '../../charting_library/studies/PriceActionEngine.js';
import { useChartCoreStore } from '../../state/chart/useChartCoreStore';
import { useChartToolsStore } from '../../state/chart/useChartToolsStore';
import { useChartFeaturesStore } from '../../state/chart/useChartFeaturesStore';
import { useJournalStore } from '../../state/useJournalStore';
import { useLayoutStore } from '../../state/useLayoutStore';
import { useScriptStore } from '../../state/useScriptStore.js';
import { useWatchlistStore } from '../../state/useWatchlistStore.js';
import { useBreakpoints } from '@/hooks/useMediaQuery';

export default function useChartLocalState() {
  // ─── Store selectors ──────────────────────────────────────────
  const symbol = useChartCoreStore((s) => s.symbol);
  const tf = useChartCoreStore((s) => s.tf);
  const chartType = useChartCoreStore((s) => s.chartType);
  const indicators = useChartToolsStore((s) => s.indicators);
  const setSymbol = useChartCoreStore((s) => s.setSymbol);
  const setTf = useChartCoreStore((s) => s.setTf);
  const data = useChartCoreStore((s) => s.data);
  const dataSource = useChartCoreStore((s) => s.source);
  const dataLoading = useChartCoreStore((s) => s.loading);
  const replayMode = useChartFeaturesStore((s) => s.replayMode);
  const replayIdx = useChartFeaturesStore((s) => s.replayIdx);
  const activeGhost = useChartFeaturesStore((s) => s.activeGhost);
  const layoutMode = useChartFeaturesStore((s) => s.layoutMode);
  const setLayoutMode = useChartFeaturesStore((s) => s.setLayoutMode);
  const multiMode = layoutMode !== '1x1';
  const activeTool = useChartToolsStore((s) => s.activeTool);
  const drawings = useChartToolsStore((s) => s.drawings);
  const drawingsVisible = useChartToolsStore((s) => s.drawingsVisible);
  const showVolumeProfile = useChartFeaturesStore((s) => s.showVolumeProfile);
  const comparisonSymbol = useChartFeaturesStore((s) => s.comparisonSymbol);
  const comparisonData = useChartFeaturesStore((s) => s.comparisonData);
  const intelligence = useChartFeaturesStore((s) => s.intelligence);
  const pendingDrawing = useChartToolsStore((s) => s.pendingDrawing);

  const tradeMode = useChartFeaturesStore((s) => s.tradeMode);
  const tradeStep = useChartFeaturesStore((s) => s.tradeStep);
  const contextMenu = useChartFeaturesStore((s) => s.contextMenu);
  const closeContextMenu = useChartFeaturesStore((s) => s.closeContextMenu);
  const showQuickJournal = useChartFeaturesStore((s) => s.showQuickJournal);
  const toggleQuickJournal = useChartFeaturesStore((s) => s.toggleQuickJournal);

  const openPanel = useLayoutStore((s) => s.openPanel);
  const { isMobile } = useBreakpoints();
  const enabledScriptCount = useScriptStore((s) => s.scripts.filter((sc) => sc.enabled).length);

  // ─── Local UI state ──────────────────────────────────────────
  const [_symbolInput, setSymbolInput] = useState(symbol);
  const [showIndicators, setShowIndicators] = useState(false);
  const [showObjectTree, setShowObjectTree] = useState(false);
  const [showTrades, setShowTrades] = useState(true);
  const [showScriptManager, setShowScriptManager] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSnapshotPublisher, setShowSnapshotPublisher] = useState(false);
  const [showMobileSettings, setShowMobileSettings] = useState(false);
  const [showMobileShare, setShowMobileShare] = useState(false);
  const [isLandscapeFullscreen, setIsLandscapeFullscreen] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
  const [drawSidebarOpen, setDrawSidebarOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [hoverInfo, setHoverInfo] = useState({ barIdx: -1, mouseY: 0 });
  const [radialMenu, setRadialMenu] = useState(null);
  const [showInsights, setShowInsights] = useState(false);
  const [chartAnalysisOpen, setChartAnalysisOpen] = useState(false);
  const [paperTradeOpen, setPaperTradeOpen] = useState(false);
  const [walkForwardOpen, setWalkForwardOpen] = useState(false);
  const [futuresOpen, setFuturesOpen] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState(() => {
    // eslint-disable-next-line unused-imports/no-unused-vars
    try { return localStorage.getItem('charEdge-workspace-mode') === 'true'; } catch (_) { return false; }
  });

  const chartRef = useRef(null);
  const editorRef = useRef(null);

  // Auto-open sidebar when a drawing tool is activated
  useEffect(() => {
    if (activeTool && !drawSidebarOpen) setDrawSidebarOpen(true);
  }, [activeTool]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Derived data ─────────────────────────────────────────────
  const analysis = useMemo(() => {
    if (!intelligence.enabled || !data?.length) return null;
    return analyzeAll(data);
  }, [data, intelligence.enabled]);

  const isWatched = useWatchlistStore((s) => s.has(symbol));
  const toggleWatchlist = useCallback(() => {
    if (isWatched) useWatchlistStore.getState().remove(symbol);
    else useWatchlistStore.getState().add({ symbol });
  }, [symbol, isWatched]);

  const allTrades = useJournalStore((s) => s.trades);
  const matchingTrades = useMemo(
    () => (showTrades ? allTrades.filter((t) => (t.symbol || '').toUpperCase() === symbol.toUpperCase()) : []),
    [allTrades, symbol, showTrades],
  );

  return {
    // Store values
    symbol, tf, chartType, indicators, setSymbol, setTf,
    data, dataSource, dataLoading,
    replayMode, replayIdx, activeGhost,
    layoutMode, setLayoutMode, multiMode,
    activeTool, drawings, drawingsVisible, showVolumeProfile,
    comparisonSymbol, comparisonData, intelligence, pendingDrawing,
    tradeMode, tradeStep, contextMenu, closeContextMenu,
    showQuickJournal, toggleQuickJournal,
    openPanel, isMobile, enabledScriptCount,

    // Local state
    _symbolInput, setSymbolInput,
    showIndicators, setShowIndicators,
    showObjectTree, setShowObjectTree,
    showTrades, setShowTrades,
    showScriptManager, setShowScriptManager,
    showShareModal, setShowShareModal,
    showSnapshotPublisher, setShowSnapshotPublisher,
    showMobileSettings, setShowMobileSettings,
    showMobileShare, setShowMobileShare,
    isLandscapeFullscreen, setIsLandscapeFullscreen,
    showCopilot, setShowCopilot,
    showShortcuts, setShowShortcuts,
    snapshotModalOpen, setSnapshotModalOpen,
    drawSidebarOpen, setDrawSidebarOpen,
    focusMode, setFocusMode,
    hoverInfo, setHoverInfo,
    radialMenu, setRadialMenu,
    showInsights, setShowInsights,
    chartAnalysisOpen, setChartAnalysisOpen,
    paperTradeOpen, setPaperTradeOpen,
    walkForwardOpen, setWalkForwardOpen,
    futuresOpen, setFuturesOpen,
    workspaceMode, setWorkspaceMode,

    // Refs
    chartRef, editorRef,

    // Derived
    analysis, isWatched, toggleWatchlist, matchingTrades,
  };
}
