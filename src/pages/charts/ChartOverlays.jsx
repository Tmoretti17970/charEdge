// ═══════════════════════════════════════════════════════════════════
// charEdge — ChartOverlays
// All lazy-loaded overlays rendered inside the chart area <div>.
// Extracted from ChartsPage for maintainability.
// ═══════════════════════════════════════════════════════════════════

import React, { Suspense } from 'react';
import ChartContextMenu from '../../app/components/chart/chart_ui/ChartContextMenu.jsx';
import { C } from '../../constants.js';
import { useChartCoreStore } from '../../state/chart/useChartCoreStore';
import { useChartFeaturesStore } from '../../state/chart/useChartFeaturesStore';
import { useChartToolsStore } from '../../state/chart/useChartToolsStore';
import { useBacktestStore } from '../../state/useBacktestStore.js';
import { useStrategyBuilderStore } from '../../state/useStrategyBuilderStore';
import { isEnabled, FEATURES } from '@/shared/featureFlags';

// Lazy-loaded overlays
const IndicatorLegendHeader = React.lazy(() => import('../../app/components/chart/core/IndicatorLegendHeader.jsx'));
const ChartInfoWindow = React.lazy(() => import('../../app/components/chart/panels/ChartInfoWindow.jsx'));
const ChartHUD = React.lazy(() => import('../../app/components/chart/ui/ChartHUD.jsx'));
const AlertLinesOverlay = React.lazy(() => import('../../app/components/chart/overlays/AlertLinesOverlay.jsx'));
const TradePLPill = React.lazy(() => import('../../app/components/chart/overlays/TradePLPill.jsx'));
const PositionLineOverlay = React.lazy(() => import('../../app/components/chart/overlays/PositionLineOverlay.jsx'));
const RiskGuardOverlay = React.lazy(() => import('../../app/components/chart/overlays/RiskGuardOverlay.jsx'));
const MobileDrawingSheet = React.lazy(() => import('../../app/components/mobile/MobileDrawingSheet.jsx'));
const QuickStylePalette = React.lazy(() => import('../../app/components/chart/QuickStylePalette.jsx'));
const QuickJournalPanel = React.lazy(() => import('../../app/components/chart/chart_ui/QuickJournalPanel.jsx'));
const RadialMenu = React.lazy(() => import('../../app/components/chart/RadialMenu.jsx'));
const DrawingPropertyEditor = React.lazy(() => import('../../app/components/chart/tools/DrawingPropertyEditor.jsx'));
const ComparisonOverlay = React.lazy(() => import('../../app/components/chart/overlays/ComparisonOverlay.jsx'));
const BacktestPanel = React.lazy(() => import('../../app/components/chart/panels/BacktestPanel.jsx'));
const BacktestResults = React.lazy(() => import('../../app/components/chart/panels/BacktestResults.jsx'));
const StrategyBuilder = React.lazy(() => import('../../app/components/chart/panels/StrategyBuilder.jsx'));
const AIAnalysisPanel = React.lazy(() => import('../../app/components/panels/AIAnalysisPanel.jsx'));
const WalkForwardPanel = React.lazy(() => import('../../app/components/chart/panels/WalkForwardPanel.jsx'));
const FuturesAnalytics = React.lazy(() => import('../../app/components/chart/panels/FuturesAnalytics.jsx'));
const PaperTradeWidget = React.lazy(() => import('../../app/components/chart/panels/PaperTradeWidget.jsx'));

/** Mobile floating action button */
function MobileFab({ icon, onClick, active }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: `1px solid ${active ? C.b : C.bd}`,
        background: active ? C.b + '20' : C.sf + 'DD',
        color: active ? C.b : C.t2,
        fontSize: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        touchAction: 'manipulation',
      }}
    >
      {icon}
    </button>
  );
}

/**
 * All chart-area overlays: HUD, info window, alert lines, trade P/L,
 * drawing editors, context menus, backtesting panels, mobile sheets, etc.
 */
export default function ChartOverlays({
  symbol,
  tf,
  data,
  isMobile,
  multiMode,
  hoverInfo,
  showTrades: _showTrades,
  matchingTrades: _matchingTrades,
  // Drawing state
  contextMenu,
  closeContextMenu,
  contextMenuHandlers,
  tradeMode,
  tradeStep,
  showQuickJournal,
  toggleQuickJournal,
  // Radial menu
  radialMenu,
  setRadialMenu,
  // Panel openers
  setDrawSidebarOpen,
  setShowIndicators,
  setShowSnapshotPublisher,
  setShowComparisonOverlay: _setShowComparisonOverlay,
  // Analysis panels
  chartAnalysisOpen,
  setChartAnalysisOpen,
  paperTradeOpen,
  setPaperTradeOpen,
  walkForwardOpen,
  setWalkForwardOpen,
  futuresOpen,
  setFuturesOpen,
  // Mobile
  isLandscapeFullscreen,
  setIsLandscapeFullscreen,
  setShowMobileSettings,
  setShowMobileShare,
  isLive: _isLive,
  setShowIndicators: _setShowIndicators2,
  // AI palette callbacks
  _setShowCopilot,
  _openPanel,
  // Auto-fit button
  showAutoFit,
  onAutoFit,
}) {
  const selectedDrawingId = useChartToolsStore((s) => s.selectedDrawingId);
  const showComparisonOverlay = useChartFeaturesStore((s) => s.showComparisonOverlay);
  const showDataWindow = useChartFeaturesStore((s) => s.showDataWindow);
  const backtestPanelOpen = useBacktestStore((s) => s.panelOpen);
  const backtestResultsOpen = useBacktestStore((s) => s.resultsOpen);
  const strategyBuilderOpen = useStrategyBuilderStore((s) => s.panelOpen);

  return (
    <>
      {/* Indicator Legend Header — positioned inline after OHLCV bar */}
      {!multiMode && !isMobile && (
        <Suspense fallback={null}>
          <IndicatorLegendHeader
            data={data}
            hoverIdx={hoverInfo.barIdx >= 0 ? hoverInfo.barIdx : null}
            onEditIndicator={() => setShowIndicators(true)}
          />
        </Suspense>
      )}

      {/* Chart Info Window — floating OHLCV data on hover (opt-in via ≡ menu) */}
      {showDataWindow && !multiMode && !isMobile && hoverInfo.barIdx >= 0 && (
        <Suspense fallback={null}>
          <ChartInfoWindow data={data} barIdx={hoverInfo.barIdx} mouseY={hoverInfo.mouseY} />
        </Suspense>
      )}

      {/* Chart HUD — auto-fading overlay */}
      {!multiMode && !isMobile && (
        <Suspense fallback={null}>
          <ChartHUD symbol={symbol} timeframe={tf} lastPrice={data?.[data.length - 1]?.close} data={data} />
        </Suspense>
      )}

      {/* Price Alert Lines Overlay */}
      {!multiMode && !isMobile && (
        <Suspense fallback={null}>
          <AlertLinesOverlay symbol={symbol} />
        </Suspense>
      )}

      {/* Live P/L Pill — shows only when user has open positions */}
      {!multiMode && !isMobile && (
        <Suspense fallback={null}>
          <TradePLPill showAutoFit={showAutoFit} onAutoFit={onAutoFit} />
        </Suspense>
      )}

      {/* Open Position Entry Lines + Price-Axis Tabs */}
      {!multiMode && !isMobile && (
        <Suspense fallback={null}>
          <PositionLineOverlay symbol={symbol} />
        </Suspense>
      )}

      {/* F3.3: Prop Firm Risk Guard Overlay — only mount when trade mode active */}
      {!multiMode && !isMobile && tradeMode && (
        <Suspense fallback={null}>
          <RiskGuardOverlay />
        </Suspense>
      )}

      {/* Mobile Drawing Sheet (bottom sheet) */}
      {isMobile && !multiMode && (
        <Suspense fallback={null}>
          <MobileDrawingSheet />
        </Suspense>
      )}

      {/* F3.2: Quick Style Palette — only mount when a drawing is selected */}
      {!isMobile && !multiMode && selectedDrawingId && (
        <Suspense fallback={null}>
          <QuickStylePalette />
        </Suspense>
      )}

      {/* F3.1: PositionSizer — now routed through SlidePanel via ChartPanelManager */}
      {showQuickJournal && (
        <Suspense fallback={null}>
          <QuickJournalPanel onClose={toggleQuickJournal} />
        </Suspense>
      )}
      <ChartContextMenu
        menu={contextMenu}
        onClose={closeContextMenu}
        handlers={contextMenuHandlers}
        tradeMode={tradeMode}
        tradeStep={tradeStep}
      />

      {/* Radial Context Menu */}
      {radialMenu &&
        (() => {
          // Compute price: if mouse handler provided 0, use aggregated price from TickerPlant
          let rmPrice = radialMenu.price || 0;
          if (!rmPrice) {
            const aggPrice = useChartCoreStore.getState().aggregatedPrice;
            if (aggPrice) rmPrice = aggPrice;
          }
          return (
            <Suspense fallback={null}>
              <RadialMenu
                x={radialMenu.x}
                y={radialMenu.y}
                price={rmPrice}
                onClose={() => setRadialMenu(null)}
                onAction={(segId, subItemId, actionPrice) => {
                  // Close radial menu immediately so it doesn't overlap with activated tools
                  setRadialMenu(null);
                  // ── Center hub: copy price ──
                  if (segId === 'center') {
                    contextMenuHandlers.onCopyPrice?.(actionPrice);
                    return;
                  }
                  // ── Trade submenu ──
                  if (segId === 'trade') {
                    if (subItemId === 'long') {
                      useChartFeaturesStore.getState().startTradeMode('long');
                      return;
                    }
                    if (subItemId === 'short') {
                      useChartFeaturesStore.getState().startTradeMode('short');
                      return;
                    }
                    if (subItemId === 'close') {
                      /* future: close position */ return;
                    }
                    return;
                  }
                  // ── Alert submenu ──
                  if (segId === 'alert') {
                    contextMenuHandlers.onAddAlert?.(actionPrice);
                    return;
                  }
                  // ── Journal submenu (NEW) ──
                  if (segId === 'journal') {
                    if (subItemId === 'quickNote') {
                      useChartFeaturesStore.getState().toggleQuickJournal();
                      return;
                    }
                    if (subItemId === 'tagLevel') {
                      window.dispatchEvent(new CustomEvent('charEdge:tag-level', { detail: { price: actionPrice } }));
                      return;
                    }
                    if (subItemId === 'screenshotNote') {
                      setShowSnapshotPublisher(true);
                      return;
                    }
                    return;
                  }
                  // ── Draw submenu ──
                  if (segId === 'draw') {
                    if (subItemId === 'more') {
                      setDrawSidebarOpen(true);
                      return;
                    }
                    useChartToolsStore.getState().setActiveTool(subItemId);
                    return;
                  }
                  // ── Indicator submenu ──
                  if (segId === 'indicator') {
                    if (subItemId === 'more') {
                      setShowIndicators(true);
                      return;
                    }
                    try {
                      useChartToolsStore.getState().addIndicator({ indicatorId: subItemId });
                    } catch {
                      /* noop */
                    }
                    return;
                  }
                }}
              />
            </Suspense>
          );
        })()}

      {/* Drawing Property Editor */}
      {selectedDrawingId && !multiMode && (
        <Suspense fallback={null}>
          <DrawingPropertyEditor />
        </Suspense>
      )}

      {/* Comparison Overlay Panel */}
      {showComparisonOverlay && !multiMode && !isMobile && (
        <Suspense fallback={null}>
          <ComparisonOverlay onClose={() => useChartFeaturesStore.getState().toggleComparisonOverlay()} />
        </Suspense>
      )}

      {/* Mobile floating action buttons */}
      {isMobile && !multiMode && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            gap: 6,
            zIndex: 400,
          }}
        >
          <MobileFab icon="⚙️" onClick={() => setShowMobileSettings(true)} />
          <MobileFab icon="📸" onClick={() => setShowMobileShare(true)} />
          <MobileFab
            icon={isLandscapeFullscreen ? '↙' : '⛶'}
            onClick={() => {
              if (isLandscapeFullscreen) {
                document.exitFullscreen?.();
                setIsLandscapeFullscreen(false);
              } else {
                const el = document.documentElement;
                el.requestFullscreen?.();
                setIsLandscapeFullscreen(true);
              }
            }}
          />
        </div>
      )}

      {/* Wave 0: ContextualPoll quarantined — social features removed from v1.0 scope */}

      {/* Strategy Backtester Panel (gated: backtesting) */}
      {isEnabled(FEATURES.BACKTESTING) && backtestPanelOpen && !multiMode && !isMobile && (
        <Suspense fallback={null}>
          <BacktestPanel bars={data} onClose={() => useBacktestStore.getState().closePanel()} />
        </Suspense>
      )}

      {/* Strategy Backtester Results (gated: backtesting) */}
      {isEnabled(FEATURES.BACKTESTING) && backtestResultsOpen && !multiMode && !isMobile && (
        <Suspense fallback={null}>
          <BacktestResults onClose={() => useBacktestStore.getState().closeResults()} />
        </Suspense>
      )}

      {/* Visual Strategy Builder (gated: backtesting) */}
      {isEnabled(FEATURES.BACKTESTING) && strategyBuilderOpen && !multiMode && !isMobile && (
        <Suspense fallback={null}>
          <StrategyBuilder bars={data} onClose={() => useStrategyBuilderStore.getState().togglePanel()} />
        </Suspense>
      )}

      {/* AI Analysis Palette — draggable floating panel */}
      {chartAnalysisOpen && !multiMode && !isMobile && (
        <Suspense fallback={null}>
          <AIAnalysisPanel isOpen={chartAnalysisOpen} onClose={() => setChartAnalysisOpen(false)} />
        </Suspense>
      )}

      {/* Walk-Forward & Monte Carlo Panel */}
      {walkForwardOpen && !multiMode && !isMobile && (
        <Suspense fallback={null}>
          <WalkForwardPanel bars={data} onClose={() => setWalkForwardOpen(false)} />
        </Suspense>
      )}

      {/* Futures Analytics Dashboard */}
      {futuresOpen && !multiMode && !isMobile && (
        <Suspense fallback={null}>
          <FuturesAnalytics onClose={() => setFuturesOpen(false)} />
        </Suspense>
      )}

      {/* Paper Trading Widget (gated: paper_trading) */}
      {isEnabled(FEATURES.PAPER_TRADING) && paperTradeOpen && !multiMode && (
        <Suspense fallback={null}>
          <PaperTradeWidget
            symbol={symbol}
            currentPrice={data?.[data.length - 1]?.close}
            onClose={() => setPaperTradeOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
}
