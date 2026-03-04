// ═══════════════════════════════════════════════════════════════════
// charEdge — Charts Page (Phase 0.1 Orchestrator — ~200 lines)
// All logic extracted into sub-modules:
//   - useChartLocalState (store selectors, local state, refs)
//   - useChartDataLoader (data fetching, WS, TickerPlant)
//   - useChartKeyboardHandler (keyboard shortcuts)
//   - useChartDrawingHandler (drawing tools, AI copilot, exports)
//   - useChartMouseHandlers (mouse move, context menu, double-click)
//   - ChartOverlays (chart-area overlays)
//   - ChartPanelManager (side panels, modals, mobile sheets)
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { C, F } from '../constants.js';
import DataSourceBadge from '../app/components/ui/DataSourceBadge.jsx';
import NoDataState from '../app/components/ui/NoDataState.jsx';

// Core (always needed)
import ChartCanvas from '../app/components/chart/core/ChartCanvas.jsx';
import UnifiedChartToolbar from '../app/components/chart/UnifiedChartToolbar.jsx';
import ChartSkeleton from '../app/components/chart/ui/ChartSkeleton.jsx';
const DrawingSidebar = React.lazy(() => import('../app/components/chart/tools/DrawingSidebar.jsx'));
const LiveTicker = React.lazy(() => import('../app/misc/components/LiveTicker.jsx'));
const DataQualityIndicator = React.lazy(() => import('../app/components/chart/ui/DataQualityIndicator.jsx').then(m => ({ default: m.DataQualityIndicator })));
import { fetchSymbolSearch } from '../data/FetchService.js';
import Coachmark from '../app/components/ui/Coachmark.jsx';

// Extracted sub-modules
import useChartLocalState from './charts/useChartLocalState.js';
import useChartDataLoader from './charts/useChartDataLoader.js';
import useChartKeyboardHandler from './charts/useChartKeyboardHandler.js';
import useChartDrawingHandler from './charts/useChartDrawingHandler.js';
import useChartMouseHandlers from './charts/useChartMouseHandlers.js';
import ChartOverlays from './charts/ChartOverlays.jsx';
import ChartPanelManager from './charts/ChartPanelManager.jsx';

// Lazy-loaded (opened on demand)
const ReplayBar = React.lazy(() => import('../app/components/chart/panels/ReplayBar.jsx'));
const QuadChart = React.lazy(() => import('../app/components/widgets/QuadChart.jsx'));
const WorkspaceLayout = React.lazy(() => import('../app/layouts/WorkspaceLoader.jsx'));
const FocusMode = React.lazy(() => import('../app/components/chart/overlays/FocusMode.jsx'));
const AICopilotBar = React.lazy(() => import('../app/components/chart/AICopilotBar.jsx'));
const TradeEntryBar = React.lazy(() => import('../app/components/chart/chart_ui/TradeEntryBar.jsx'));
const WatchlistQuickBar = React.lazy(() => import('../app/components/chart/ui/WatchlistQuickBar.jsx'));
const SwipeChartNav = React.lazy(() => import('../app/components/mobile/SwipeChartNav.jsx'));
const GuidedTour = React.lazy(() => import('../app/components/ui/GuidedTour.jsx'));

export default function ChartsPage() {
  const [ready, setReady] = useState(false);
  const [skeletonPhase, setSkeletonPhase] = useState(1); // Sprint 6: phased skeleton
  const mountTimeRef = useRef(performance.now());         // Sprint 6: TTI measurement

  useEffect(() => {
    // Phase 1 (0ms): Toolbar skeleton only
    // Phase 2 (100ms): Candle skeletons appear
    const t2 = setTimeout(() => setSkeletonPhase(2), 100);
    // Phase 3 (300ms): Full skeleton with indicators
    const t3 = setTimeout(() => setSkeletonPhase(3), 300);
    const t = requestAnimationFrame(() => setReady(true));
    return () => { cancelAnimationFrame(t); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  if (!ready) {
    return (
      <div style={{ position: 'relative', height: '100%' }}>
        <ChartSkeleton phase={skeletonPhase} />
      </div>
    );
  }

  return <ChartsPageInner mountTime={mountTimeRef.current} />;
}

function ChartsPageInner({ mountTime }) {
  // All state consolidated into one hook
  const state = useChartLocalState();
  const {
    symbol, tf, chartType, indicators, setSymbol, setTf,
    data, dataSource, dataLoading,
    replayMode, replayIdx, activeGhost,
    layoutMode, setLayoutMode, multiMode,
    activeTool, drawings, drawingsVisible, showVolumeProfile,
    comparisonSymbol, comparisonData, intelligence, pendingDrawing,
    tradeMode, tradeStep, contextMenu, closeContextMenu,
    showQuickJournal, toggleQuickJournal,
    openPanel, isMobile,
    setSymbolInput, showIndicators, setShowIndicators,
    showObjectTree, setShowObjectTree, showTrades, setShowTrades,
    showScriptManager, setShowScriptManager,
    showShareModal, setShowShareModal,
    showSnapshotPublisher, setShowSnapshotPublisher,
    showMobileSettings, setShowMobileSettings,
    showMobileShare, setShowMobileShare,
    isLandscapeFullscreen, setIsLandscapeFullscreen,
    showCopilot, setShowCopilot, showShortcuts, setShowShortcuts,
    snapshotModalOpen, setSnapshotModalOpen,
    drawSidebarOpen, setDrawSidebarOpen,
    focusMode, setFocusMode,
    hoverInfo, setHoverInfo, radialMenu, setRadialMenu,
    chartAnalysisOpen, setChartAnalysisOpen,
    paperTradeOpen, setPaperTradeOpen,
    walkForwardOpen, setWalkForwardOpen,
    futuresOpen, setFuturesOpen,
    workspaceMode,
    chartRef, editorRef,
    analysis, isWatched, toggleWatchlist, matchingTrades,
  } = state;

  // ─── Extracted hooks ──────────────────────────────────────────
  const {
    tick, wsStatus, isLive, wsSupported, dataWarning, setDataWarning,
    confidence, sourceCount, priceSpread, priceSources, watchlistSymbols,
  } = useChartDataLoader();

  useChartKeyboardHandler({
    setShowSnapshotPublisher, setShowCopilot, setShowShortcuts,
    setShowInsights: state.setShowInsights, setShowIndicators, setDrawSidebarOpen, setFocusMode, setTf,
  });

  const {
    handleDrawingClick, handleAICopilotCommand, handleContextMenu,
    contextMenuHandlers, copyFeedback, scriptOutputs, setEditorOutputs,
  } = useChartDrawingHandler(chartRef);

  const { onMouseMove, onMouseLeave, onDoubleClick, onChartContextMenu } = useChartMouseHandlers({
    chartRef, data, isMobile, multiMode, tradeMode,
    setHoverInfo, setRadialMenu, setFocusMode, handleContextMenu,
  });

  // ─── Chart canvas props ────────────────────────────────────────
  const chartCanvasProps = {
    ref: chartRef, data, chartType, indicators,
    trades: matchingTrades,
    replayIdx: replayMode ? replayIdx : -1,
    activeGhost: replayMode ? activeGhost : null,
    drawings, drawingsVisible, showVolumeProfile, activeTool, pendingDrawing,
    onDrawingClick: handleDrawingClick, scriptOutputs,
    comparisonData, comparisonSymbol,
    srLevels: intelligence.enabled && intelligence.showSR ? analysis?.levels : null,
    patternMarkers: intelligence.enabled && intelligence.showPatterns ? analysis?.patterns : null,
    divergences: intelligence.enabled && intelligence.showDivergences ? analysis?.divergences : null,
  };

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div role="main" aria-label="Charts" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Unified Toolbar */}
      {!focusMode && (
        <UnifiedChartToolbar
          symbol={symbol} setSymbolInput={setSymbolInput}
          onSearchSelect={(sym) => { setSymbol(sym); setSymbolInput(sym); }}
          isWatched={isWatched} toggleWatchlist={toggleWatchlist}
          showIndicators={showIndicators} setShowIndicators={setShowIndicators}
          showObjectTree={showObjectTree} setShowObjectTree={setShowObjectTree}
          showTrades={showTrades} setShowTrades={setShowTrades}
          matchingTradesCount={matchingTrades.length}
          fetchSymbolSearch={fetchSymbolSearch}
          onOpenPanel={(view) => openPanel(view)}
          onOpenCopilot={() => setShowCopilot(true)}
          isLive={isLive} wsSupported={wsSupported} wsStatus={wsStatus}
          dataSource={dataSource} dataLoading={dataLoading}
          layoutMode={layoutMode} setLayoutMode={setLayoutMode}
          onToggleAnalysis={() => setChartAnalysisOpen(v => !v)}
          drawSidebarOpen={drawSidebarOpen}
          onToggleDrawSidebar={() => setDrawSidebarOpen(v => !v)}
        />
      )}

      {/* Coachmarks */}
      <Coachmark tipId="charts_search_symbol" targetSel=".tf-chart-toolbar-search input, .tf-chart-toolbar-search" title="🔍 Search any symbol" message="Type a ticker (BTC, AAPL, ES) to load live charts with indicators and drawing tools." position="bottom" delay={1500} />
      {data?.length > 0 && (
        <Coachmark tipId="charts_try_indicator" targetSel="[aria-label='Indicators'], .tf-chart-toolbar-btn-indicators" title="📊 Add an indicator" message="Try adding SMA, RSI, or MACD to enhance your analysis. Press Ctrl+I anytime." position="bottom" delay={3000} />
      )}

      {/* AI Co-Pilot */}
      {showCopilot && (
        <Suspense fallback={null}>
          <AICopilotBar onCommand={handleAICopilotCommand} onClose={() => setShowCopilot(false)} />
        </Suspense>
      )}

      {/* Data Warning Toast */}
      {!workspaceMode && dataWarning && (
        <div className="tf-data-warning" role="alert" aria-live="polite">
          <span style={{ fontSize: 13, opacity: 0.9 }}>⚠</span>
          <span style={{ opacity: 0.95 }}>{dataWarning}</span>
          <button onClick={() => setDataWarning(null)} className="tf-chart-toolbar-btn" style={{ marginLeft: 'auto', color: 'inherit', fontSize: 14, padding: '2px 6px', borderRadius: 6, minHeight: 'auto' }}>×</button>
        </div>
      )}

      {/* Watchlist Quick Bar */}
      {!workspaceMode && !multiMode && (
        <Suspense fallback={null}>
          <WatchlistQuickBar currentSymbol={symbol} onSymbolChange={(sym) => { setSymbol(sym); setSymbolInput(sym); }} />
        </Suspense>
      )}

      {/* Live Ticker + Data Source Badge */}
      {!workspaceMode && (
        <div style={{ borderBottom: '1px solid var(--tf-bd)', background: 'var(--tf-bg)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {wsSupported && (
            <Suspense fallback={null}>
              <LiveTicker tick={tick} status={wsStatus} symbol={symbol} />
            </Suspense>
          )}
          <DataSourceBadge source={dataSource} />
          {wsSupported && (
            <Suspense fallback={null}>
              <DataQualityIndicator confidence={confidence} sourceCount={sourceCount} spread={priceSpread} sources={priceSources} />
            </Suspense>
          )}
        </div>
      )}

      {/* Trade Entry / Replay / Tour */}
      {!workspaceMode && tradeMode && <Suspense fallback={null}><TradeEntryBar /></Suspense>}
      {!workspaceMode && replayMode && <Suspense fallback={null}><ReplayBar /></Suspense>}
      <Suspense fallback={null}><GuidedTour /></Suspense>

      {/* Main Content */}
      {workspaceMode ? (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Suspense fallback={<div style={{ padding: 24, color: C.t3 }}>Loading workspace...</div>}>
            <WorkspaceLayout />
          </Suspense>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
          {!isMobile && !multiMode && !focusMode && <Suspense fallback={null}><DrawingSidebar isOpen={drawSidebarOpen} onClose={() => setDrawSidebarOpen(false)} /></Suspense>}
          {!isMobile && (
            <Suspense fallback={null}>
              <FocusMode isActive={focusMode} onExit={() => setFocusMode(false)} symbol={symbol} timeframe={tf} lastPrice={data?.[data.length - 1]?.close} />
            </Suspense>
          )}
          <div
            className="tf-chart-area"
            style={{
              flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden',
              opacity: (dataLoading && (!data || data.length === 0)) ? 0.5 : 1,
              marginLeft: (drawSidebarOpen && !focusMode && !isMobile && !multiMode) ? 44 : 0,
              transition: 'opacity 0.25s ease, margin-left 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            onDoubleClick={onDoubleClick} onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave} onContextMenu={onChartContextMenu}
          >
            {multiMode ? (
              <Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.t3 }}>Loading...</div>}>
                <QuadChart layoutMode={layoutMode} />
              </Suspense>
            ) : isMobile ? (
              <Suspense fallback={null}>
                <SwipeChartNav watchlist={watchlistSymbols} currentSymbol={symbol} onSymbolChange={(sym) => { setSymbol(sym); setSymbolInput(sym); }}>
                  <ChartCanvas {...chartCanvasProps} />
                </SwipeChartNav>
              </Suspense>
            ) : (
              <ChartCanvas {...chartCanvasProps} />
            )}
            {dataLoading && (!data || data.length === 0) && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 15,
                transition: 'opacity 0.25s ease-out',
                opacity: 1,
              }}>
                <ChartSkeleton phase={3} />
              </div>
            )}
            {!dataLoading && dataSource === 'no_data' && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'var(--tf-bg)', display: 'flex' }}>
                <NoDataState symbol={symbol} onSettingsClick={() => import('../app/components/ui/Toast.jsx').then(({ default: toast }) => toast.info('Navigate to Settings → API Keys to add your Polygon.io key.')).catch(() => {})} /> {/* intentional: Toast import is best-effort UI */}
              </div>
            )}
            <ChartOverlays
              symbol={symbol} tf={tf} data={data} isMobile={isMobile} multiMode={multiMode}
              hoverInfo={hoverInfo} showTrades={showTrades} matchingTrades={matchingTrades}
              contextMenu={contextMenu} closeContextMenu={closeContextMenu} contextMenuHandlers={contextMenuHandlers}
              tradeMode={tradeMode} tradeStep={tradeStep}
              showQuickJournal={showQuickJournal} toggleQuickJournal={toggleQuickJournal}
              radialMenu={radialMenu} setRadialMenu={setRadialMenu}
              setDrawSidebarOpen={setDrawSidebarOpen} setShowIndicators={setShowIndicators}
              setShowSnapshotPublisher={setShowSnapshotPublisher}
              chartAnalysisOpen={chartAnalysisOpen} setChartAnalysisOpen={setChartAnalysisOpen}
              paperTradeOpen={paperTradeOpen} setPaperTradeOpen={setPaperTradeOpen}
              walkForwardOpen={walkForwardOpen} setWalkForwardOpen={setWalkForwardOpen}
              futuresOpen={futuresOpen} setFuturesOpen={setFuturesOpen}
              isLandscapeFullscreen={isLandscapeFullscreen} setIsLandscapeFullscreen={setIsLandscapeFullscreen}
              setShowMobileSettings={setShowMobileSettings} setShowMobileShare={setShowMobileShare}
            />
          </div>
        </div>
      )}

      <ChartPanelManager
        symbol={symbol} tf={tf} chartType={chartType} indicators={indicators}
        data={data} isMobile={isMobile} workspaceMode={workspaceMode}
        showIndicators={showIndicators} setShowIndicators={setShowIndicators}
        showObjectTree={showObjectTree} setShowObjectTree={setShowObjectTree}
        showScriptManager={showScriptManager} setShowScriptManager={setShowScriptManager}
        showShareModal={showShareModal} setShowShareModal={setShowShareModal}
        showSnapshotPublisher={showSnapshotPublisher} setShowSnapshotPublisher={setShowSnapshotPublisher}
        snapshotModalOpen={snapshotModalOpen} setSnapshotModalOpen={setSnapshotModalOpen}
        showShortcuts={showShortcuts} setShowShortcuts={setShowShortcuts}
        showMobileSettings={showMobileSettings} setShowMobileSettings={setShowMobileSettings}
        showMobileShare={showMobileShare} setShowMobileShare={setShowMobileShare}
        isLandscapeFullscreen={isLandscapeFullscreen} setIsLandscapeFullscreen={setIsLandscapeFullscreen}
        chartRef={chartRef} editorRef={editorRef}
        setEditorOutputs={setEditorOutputs} drawings={drawings}
      />
    </div>
  );
}
