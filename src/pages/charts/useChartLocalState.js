// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Local State Hook
// Extracted from ChartsPage (Phase 0.1): manages all local UI state
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useChartStore } from '../../state/useChartStore.js';
import { useJournalStore } from '../../state/useJournalStore.js';
import { useWatchlistStore } from '../../state/useWatchlistStore.js';
import { useScriptStore } from '../../state/useScriptStore.js';
import { usePanelStore } from '../../state/usePanelStore.js';
import { useBreakpoints } from '../../utils/useMediaQuery.js';
import { analyzeAll } from '../../charting_library/studies/PriceActionEngine.js';

export default function useChartLocalState() {
  // ─── Store selectors ──────────────────────────────────────────
  const symbol = useChartStore((s) => s.symbol);
  const tf = useChartStore((s) => s.tf);
  const chartType = useChartStore((s) => s.chartType);
  const indicators = useChartStore((s) => s.indicators);
  const setSymbol = useChartStore((s) => s.setSymbol);
  const setTf = useChartStore((s) => s.setTf);
  const data = useChartStore((s) => s.data);
  const dataSource = useChartStore((s) => s.source);
  const dataLoading = useChartStore((s) => s.loading);
  const replayMode = useChartStore((s) => s.replayMode);
  const replayIdx = useChartStore((s) => s.replayIdx);
  const activeGhost = useChartStore((s) => s.activeGhost);
  const layoutMode = useChartStore((s) => s.layoutMode);
  const setLayoutMode = useChartStore((s) => s.setLayoutMode);
  const multiMode = layoutMode !== '1x1';
  const activeTool = useChartStore((s) => s.activeTool);
  const drawings = useChartStore((s) => s.drawings);
  const drawingsVisible = useChartStore((s) => s.drawingsVisible);
  const showVolumeProfile = useChartStore((s) => s.showVolumeProfile);
  const comparisonSymbol = useChartStore((s) => s.comparisonSymbol);
  const comparisonData = useChartStore((s) => s.comparisonData);
  const intelligence = useChartStore((s) => s.intelligence);
  const pendingDrawing = useChartStore((s) => s.pendingDrawing);

  const tradeMode = useChartStore((s) => s.tradeMode);
  const tradeStep = useChartStore((s) => s.tradeStep);
  const contextMenu = useChartStore((s) => s.contextMenu);
  const closeContextMenu = useChartStore((s) => s.closeContextMenu);
  const showQuickJournal = useChartStore((s) => s.showQuickJournal);
  const toggleQuickJournal = useChartStore((s) => s.toggleQuickJournal);

  const openPanel = usePanelStore((s) => s.open);
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
    try { return localStorage.getItem('charEdge-workspace-mode') === 'true'; } catch { return false; }
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
