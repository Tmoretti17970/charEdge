// ═══════════════════════════════════════════════════════════════════
// charEdge — ChartOverlays
// All lazy-loaded overlays rendered inside the chart area <div>.
// Extracted from ChartsPage for maintainability.
// ═══════════════════════════════════════════════════════════════════

import React, { Suspense } from 'react';
import { C } from '../../constants.js';
import { useChartStore } from '../../state/useChartStore.js';
import { useBacktestStore } from '../../state/useBacktestStore.js';
import { useStrategyBuilderStore } from '../../state/useStrategyBuilderStore.js';
import ChartContextMenu from '../../app/components/chart/chart_ui/ChartContextMenu.jsx';
import { isEnabled, FEATURES } from '../../utils/featureFlags.js';

// Lazy-loaded overlays
const IndicatorLegendHeader = React.lazy(() => import('../../app/components/chart/core/IndicatorLegendHeader.jsx'));
const ChartInfoWindow = React.lazy(() => import('../../app/components/chart/panels/ChartInfoWindow.jsx'));
const ChartHUD = React.lazy(() => import('../../app/components/chart/ui/ChartHUD.jsx'));
const AlertLinesOverlay = React.lazy(() => import('../../app/components/chart/overlays/AlertLinesOverlay.jsx'));
const TradePLPill = React.lazy(() => import('../../app/components/chart/overlays/TradePLPill.jsx'));
const RiskGuardOverlay = React.lazy(() => import('../../app/components/chart/overlays/RiskGuardOverlay.jsx'));
const MobileDrawingSheet = React.lazy(() => import('../../app/components/mobile/MobileDrawingSheet.jsx'));
const QuickStylePalette = React.lazy(() => import('../../app/components/chart/QuickStylePalette.jsx'));
const PositionSizer = React.lazy(() => import('../../app/components/chart/chart_ui/PositionSizer.jsx'));
const QuickJournalPanel = React.lazy(() => import('../../app/components/chart/chart_ui/QuickJournalPanel.jsx'));
const RadialMenu = React.lazy(() => import('../../app/components/chart/RadialMenu.jsx'));
const DrawingPropertyEditor = React.lazy(() => import('../../app/components/chart/tools/DrawingPropertyEditor.jsx'));
const ComparisonOverlay = React.lazy(() => import('../../app/components/chart/overlays/ComparisonOverlay.jsx'));
const BacktestPanel = React.lazy(() => import('../../app/components/chart/panels/BacktestPanel.jsx'));
const BacktestResults = React.lazy(() => import('../../app/components/chart/panels/BacktestResults.jsx'));
const StrategyBuilder = React.lazy(() => import('../../app/components/chart/panels/StrategyBuilder.jsx'));
const ChartAnalysisPanel = React.lazy(() => import('../../app/components/chart/panels/ChartAnalysisPanel.jsx'));
const WalkForwardPanel = React.lazy(() => import('../../app/components/chart/panels/WalkForwardPanel.jsx'));
const FuturesAnalytics = React.lazy(() => import('../../app/components/chart/panels/FuturesAnalytics.jsx'));
const PaperTradeWidget = React.lazy(() => import('../../app/components/chart/panels/PaperTradeWidget.jsx'));
// Wave 0: ContextualPoll quarantined — social features removed from v1.0 scope

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
  showTrades,
  matchingTrades,
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
}) {
  const selectedDrawingId = useChartStore((s) => s.selectedDrawingId);
  const showComparisonOverlay = useChartStore((s) => s.showComparisonOverlay);
  const backtestPanelOpen = useBacktestStore((s) => s.panelOpen);
  const backtestResultsOpen = useBacktestStore((s) => s.resultsOpen);
  const strategyBuilderOpen = useStrategyBuilderStore((s) => s.panelOpen);

  return (
    <>
      {/* Indicator Legend Header — persistent top-left overlay */}
      {!multiMode && !isMobile && (
        <Suspense fallback={null}>
          <IndicatorLegendHeader
            data={data}
            hoverIdx={hoverInfo.barIdx >= 0 ? hoverInfo.barIdx : null}
            onEditIndicator={() => setShowIndicators(true)}
          />
        </Suspense>
      )}

      {/* Chart Info Window — floating OHLCV data on hover */}
      {!multiMode && !isMobile && hoverInfo.barIdx >= 0 && (
        <Suspense fallback={null}>
          <ChartInfoWindow
            data={data}
            barIdx={hoverInfo.barIdx}
            mouseY={hoverInfo.mouseY}
          />
        </Suspense>
      )}

      {/* Chart HUD — auto-fading overlay */}
      {!multiMode && !isMobile && (
        <Suspense fallback={null}>
          <ChartHUD
            symbol={symbol}
            timeframe={tf}
            lastPrice={data?.[data.length - 1]?.close}
            data={data}
          />
        </Suspense>
      )}

      {/* Price Alert Lines Overlay */}
      {!multiMode && !isMobile && (
        <Suspense fallback={null}>
          <AlertLinesOverlay symbol={symbol} />
        </Suspense>
      )}

      {/* Trade P/L Summary Pill */}
      {!multiMode && !isMobile && showTrades && matchingTrades.length > 0 && (
        <Suspense fallback={null}>
          <TradePLPill trades={matchingTrades} />
        </Suspense>
      )}

      {/* Prop Firm Risk Guard Overlay */}
      {!multiMode && !isMobile && (
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

      {/* Quick Style Palette — floating when drawing tool is active */}
      {!isMobile && !multiMode && (
        <Suspense fallback={null}>
          <QuickStylePalette />
        </Suspense>
      )}

      {/* Chart Trade Overlays */}
      <Suspense fallback={null}>
        <PositionSizer />
      </Suspense>
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
      {radialMenu && (
        <Suspense fallback={null}>
          <RadialMenu
            x={radialMenu.x}
            y={radialMenu.y}
            price={radialMenu.price}
            onClose={() => setRadialMenu(null)}
            onAction={(segId, price) => {
              switch (segId) {
                case 'draw':
                  setDrawSidebarOpen(true);
                  break;
                case 'trade':
                  useChartStore.getState().startTradeMode('long');
                  break;
                case 'alert':
                  contextMenuHandlers.onAddAlert?.(price);
                  break;
                case 'indicator':
                  setShowIndicators(true);
                  break;
                case 'measure':
                  useChartStore.getState().setActiveTool('measure');
                  break;
                case 'screenshot':
                  setShowSnapshotPublisher(true);
                  break;
                default:
                  break;
              }
            }}
          />
        </Suspense>
      )}

      {/* Drawing Property Editor */}
      {selectedDrawingId && !multiMode && (
        <Suspense fallback={null}>
          <DrawingPropertyEditor />
        </Suspense>
      )}

      {/* Comparison Overlay Panel */}
      {showComparisonOverlay && !multiMode && !isMobile && (
        <Suspense fallback={null}>
          <ComparisonOverlay
            onClose={() => useChartStore.getState().toggleComparisonOverlay()}
          />
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
          <BacktestPanel
            bars={data}
            onClose={() => useBacktestStore.getState().closePanel()}
          />
        </Suspense>
      )}

      {/* Strategy Backtester Results (gated: backtesting) */}
      {isEnabled(FEATURES.BACKTESTING) && backtestResultsOpen && !multiMode && !isMobile && (
        <Suspense fallback={null}>
          <BacktestResults
            onClose={() => useBacktestStore.getState().closeResults()}
          />
        </Suspense>
      )}

      {/* Visual Strategy Builder (gated: backtesting) */}
      {isEnabled(FEATURES.BACKTESTING) && strategyBuilderOpen && !multiMode && !isMobile && (
        <Suspense fallback={null}>
          <StrategyBuilder
            bars={data}
            onClose={() => useStrategyBuilderStore.getState().togglePanel()}
          />
        </Suspense>
      )}

      {/* AI Chart Analysis */}
      {chartAnalysisOpen && !multiMode && !isMobile && (
        <Suspense fallback={null}>
          <ChartAnalysisPanel
            bars={data}
            symbol={symbol}
            timeframe={tf}
            onClose={() => setChartAnalysisOpen(false)}
          />
        </Suspense>
      )}

      {/* Walk-Forward & Monte Carlo Panel */}
      {walkForwardOpen && !multiMode && !isMobile && (
        <Suspense fallback={null}>
          <WalkForwardPanel
            bars={data}
            onClose={() => setWalkForwardOpen(false)}
          />
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
