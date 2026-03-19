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
const TradePLPill = React.lazy(() => import('../../app/components/chart/overlays/TradePLPill.jsx'));

const RiskGuardOverlay = React.lazy(() => import('../../app/components/chart/overlays/RiskGuardOverlay.jsx'));
const MobileDrawingSheet = React.lazy(() => import('../../app/components/mobile/MobileDrawingSheet.jsx'));
const QuickJournalPanel = React.lazy(() => import('../../app/components/chart/chart_ui/QuickJournalPanel.jsx'));
const RadialMenu = React.lazy(() => import('../../app/components/chart/RadialMenu.jsx'));
// DrawingPropertyEditor removed — consolidated into DrawingEditPopup
const ComparisonOverlay = React.lazy(() => import('../../app/components/chart/overlays/ComparisonOverlay.jsx'));
const BacktestPanel = React.lazy(() => import('../../app/components/chart/panels/BacktestPanel.jsx'));
const BacktestResults = React.lazy(() => import('../../app/components/chart/panels/BacktestResults.jsx'));
const StrategyBuilder = React.lazy(() => import('../../app/components/chart/panels/StrategyBuilder.jsx'));
// AIAnalysisPanel removed — copilot consolidated into watchlist side panel
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
  setShowIndicators,
  setShowSnapshotPublisher,
  setShowComparisonOverlay: _setShowComparisonOverlay,
  // Analysis panels (AI Analysis removed — consolidated into watchlist side panel)
  _chartAnalysisOpen,
  _setChartAnalysisOpen,
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



      {/* Live P/L Pill — shows only when user has open positions */}
      {!multiMode && !isMobile && (
        <Suspense fallback={null}>
          <TradePLPill showAutoFit={showAutoFit} onAutoFit={onAutoFit} />
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

      {/* QuickStylePalette removed — consolidated into DrawingEditPopup */}

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
                    if (subItemId === 'long' || subItemId === 'short') {
                      const side = subItemId === 'long' ? 'long' : 'short';
                      // Immediately place a market order at the LIVE price (like toolbar buttons)
                      import('../../state/usePaperTradeStore').then(({ usePaperTradeStore }) => {
                        import('../../state/chart/useChartCoreStore').then(({ useChartCoreStore }) => {
                          const coreState = useChartCoreStore.getState();
                          const sym = coreState.symbol || 'UNKNOWN';
                          // Use real-time aggregated price, fall back to last candle close, then crosshair price
                          const lastCandle = data?.[data.length - 1];
                          const livePrice = coreState.aggregatedPrice || lastCandle?.close || actionPrice;
                          const result = usePaperTradeStore.getState().placeOrder(
                            {
                              symbol: sym,
                              side,
                              type: 'market',
                              quantity: 1,
                              exactFill: true,
                            },
                            livePrice,
                          );

                          // Show toast
                          import('../../app/components/ui/Toast.jsx').then(({ default: toast }) => {
                            const label = side === 'long' ? 'BUY' : 'SELL';
                            toast.success(`${label} ${sym} @ $${livePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                          }).catch(() => {});

                          // Screenshot + journal entry after chart settles
                          if (result?.filled && result.position) {
                            setTimeout(() => {
                              try {
                                import('../../hooks/useAutoScreenshot.js').then(({ captureChartScreenshot }) => {
                                  const shot = captureChartScreenshot(sym, '');
                                  const screenshotData = shot?.data || null;

                                  import('../../state/useJournalStore').then(({ useJournalStore }) => {
                                    const store = useJournalStore.getState();
                                    if (store.addTrade) {
                                      const screenshotArr = screenshotData
                                        ? [{ data: screenshotData, name: `${sym}_entry_${Date.now()}.png` }]
                                        : [];
                                      store.addTrade({
                                        id: `rm_${Date.now()}`,
                                        date: new Date().toISOString(),
                                        symbol: sym,
                                        side,
                                        entry: livePrice,
                                        exit: null,
                                        qty: 1,
                                        stopLoss: null,
                                        takeProfit: null,
                                        pnl: 0,
                                        fees: result.position.commission || 0,
                                        rMultiple: null,
                                        notes: `${side === 'long' ? '📈 BUY' : '📉 SELL'} ${sym} @ $${livePrice.toFixed(2)} — placed via radial menu`,
                                        tags: [sym, side, 'radial-menu', 'entry'],
                                        chartScreenshot: screenshotData,
                                        screenshots: screenshotArr.length > 0 ? screenshotArr : undefined,
                                        source: 'radial-menu',
                                      });
                                    }
                                  }).catch(() => {});
                                }).catch(() => {});
                              } catch { /* non-fatal */ }
                            }, 500);
                          }
                        });
                      });
                      return;
                    }
                    if (subItemId === 'close') {
                      /* future: close position */ return;
                    }
                    return;
                  }
                  // ── Alert submenu ──
                  if (segId === 'alert') {
                    const condMap = { price: 'cross_above', above: 'above', below: 'below' };
                    contextMenuHandlers.onAddAlert?.(actionPrice, condMap[subItemId] || 'cross_above');
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

      {/* DrawingPropertyEditor removed — consolidated into DrawingEditPopup */}

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

      {/* AI Analysis Palette — REMOVED: consolidated into watchlist side panel copilot tab */}

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
