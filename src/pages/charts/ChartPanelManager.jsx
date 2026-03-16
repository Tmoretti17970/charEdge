// ═══════════════════════════════════════════════════════════════════
// charEdge — ChartPanelManager
// All side panels, modals, mobile sheets, and bottom-area UI
// extracted from ChartsPage for maintainability.
// ═══════════════════════════════════════════════════════════════════

import React, { Suspense, useEffect } from 'react';
import SlidePanel from '../../app/components/panels/SlidePanel.jsx';
import { C } from '../../constants.js';
import { useChartFeaturesStore } from '../../state/chart/useChartFeaturesStore';
import { useChartToolsStore } from '../../state/chart/useChartToolsStore';
import { useAlertStore } from '../../state/useAlertStore';
import { useLayoutStore } from '../../state/useLayoutStore';
const IndicatorPanel = React.lazy(() => import('../../app/components/panels/IndicatorPanel.jsx'));

// Lazy-loaded panels & modals
const ObjectTreePanel = React.lazy(() => import('../../app/components/panels/ObjectTreePanel.jsx'));
const WatchlistPanel = React.lazy(() => import('../../app/components/panels/WatchlistPanel.jsx'));
const AlertPanel = React.lazy(() => import('../../app/components/panels/AlertPanel.jsx'));
const AlertHistoryPanel = React.lazy(() => import('../../app/components/panels/AlertHistoryPanel.jsx'));
const AlertAnalytics = React.lazy(() => import('../../app/components/panels/AlertAnalytics.jsx'));
const ChartInsightsPanel = React.lazy(() => import('../../app/components/panels/ChartInsightsPanel.jsx'));
// const ScriptEditor = React.lazy(() => import('../../charting_library/scripting/ScriptEditor.jsx'));
// const ScriptManager = React.lazy(() => import('../../charting_library/scripting/ScriptManager.jsx'));
// const ShareSnapshotModal = React.lazy(() => import('../../app/features/sharing/ShareSnapshotModal.jsx'));
// const SnapshotPublisher = React.lazy(() => import('../../app/features/sharing/SnapshotPublisher.jsx'));
const ChartSnapshotModal = React.lazy(() => import('../../app/components/chart/panels/ChartSnapshotModal.jsx'));
const ChartSettingsPanel = React.lazy(() => import('../../app/components/chart/panels/ChartSettingsPanel.jsx'));
const HotkeyCustomizationPanel = React.lazy(
  () => import('../../app/components/chart/panels/HotkeyCustomizationPanel.jsx'),
);
const ChartAnnotationsPanel = React.lazy(() => import('../../app/components/chart/panels/ChartAnnotationsPanel.jsx'));

const DOMLadder = React.lazy(() => import('../../app/components/chart/DOMLadder.jsx'));
// DepthChart rendering moved to ChartsPage for proper flex layout
const KeyboardShortcutsOverlay = React.lazy(
  () => import('../../app/components/chart/overlays/KeyboardShortcutsOverlay.jsx'),
);
const MobileChartSheet = React.lazy(() => import('../../app/components/mobile/MobileChartSheet.jsx'));
const MobileShareSheet = React.lazy(() => import('../../app/components/mobile/MobileShareSheet.jsx'));
const GestureGuide = React.lazy(() => import('../../app/components/ui/GestureGuide.jsx'));

// Data panels
const OrderFlowPanel = React.lazy(() => import('../../app/components/data/OrderFlowPanel.jsx'));
const DerivativesDashboard = React.lazy(() => import('../../app/components/data/DerivativesDashboard.jsx'));
const DepthPanel = React.lazy(() => import('../../app/components/data/DepthPanel.jsx'));
const InstitutionalPanel = React.lazy(() => import('../../app/components/data/InstitutionalPanel.jsx'));
const CommunitySignals = React.lazy(() => import('../../app/components/data/CommunitySignals.jsx'));
const PositionSizer = React.lazy(() => import('../../app/components/chart/chart_ui/PositionSizer.jsx'));
const QuickJournalPanel = React.lazy(() => import('../../app/components/chart/chart_ui/QuickJournalPanel.jsx'));

/**
 * Manages all side panels, modals, bottom panels, and mobile sheets.
 */
export default function ChartPanelManager({
  symbol,
  tf,
  chartType,
  _indicators,
  data,
  isMobile,
  workspaceMode,
  // Panel toggles
  showIndicators,
  setShowIndicators,
  showObjectTree,
  setShowObjectTree,
  _showScriptManager,
  _setShowScriptManager,
  _showShareModal,
  _setShowShareModal,
  _showSnapshotPublisher,
  _setShowSnapshotPublisher,
  snapshotModalOpen,
  setSnapshotModalOpen,
  showShortcuts,
  setShowShortcuts,
  // Mobile
  showMobileSettings,
  setShowMobileSettings,
  showMobileShare,
  setShowMobileShare,
  _isLandscapeFullscreen,
  setIsLandscapeFullscreen,
  // Refs
  chartRef,
  _editorRef,
  // Script
  _setEditorOutputs,
  // Drawings
  drawings,
}) {
  const activePanel = useLayoutStore((s) => s.activePanel);
  const panelInfo = useLayoutStore.getState().getPanelInfo(activePanel);
  const panelWidth = useLayoutStore.getState().getPanelWidth(activePanel);
  const closePanel = useLayoutStore((s) => s.closePanel);

  const showDOM = useChartFeaturesStore((s) => s.showDOM);

  // Item 40: Sync showIndicators toggle → SlidePanel via useLayoutStore
  useEffect(() => {
    if (showIndicators && activePanel !== 'indicators') {
      useLayoutStore.getState().openPanel('indicators');
    }
  }, [showIndicators, activePanel]);

  // When SlidePanel closes with indicators open, sync back the toggle
  useEffect(() => {
    if (!activePanel && showIndicators) {
      setShowIndicators(false);
    }
  }, [activePanel, showIndicators, setShowIndicators]);

  return (
    <>
      {/* ─── Indicator Panel — routed through SlidePanel (#40) ─── */}
      {/* Indicators now rendered inside the SlidePanel below via activePanel === 'indicators' */}

      {/* Object Tree Panel */}
      {showObjectTree && (
        <Suspense fallback={null}>
          <ObjectTreePanel
            isOpen={showObjectTree}
            onClose={() => setShowObjectTree(false)}
            drawings={drawings}
            onToggleVisibility={(id) =>
              window.dispatchEvent(new CustomEvent('charEdge:toggle-visibility', { detail: id }))
            }
            onToggleLock={(id) => window.dispatchEvent(new CustomEvent('charEdge:toggle-lock', { detail: id }))}
            onDelete={(id) => window.dispatchEvent(new CustomEvent('charEdge:delete-specific', { detail: id }))}
          />
        </Suspense>
      )}

      {/* ─── DOM Ladder Overlay ─── */}
      {!workspaceMode && showDOM && (
        <Suspense fallback={null}>
          <DOMLadder
            currentPrice={data?.length ? data[data.length - 1].close : 0}
            symbol={symbol}
            onClose={() => useChartFeaturesStore.getState().toggleDOM()}
          />
        </Suspense>
      )}

      {/* ─── Depth Chart ─── now rendered in ChartsPage inside the chart flex-column */}

      {/* ─── Snapshot Modal ─── */}
      <Suspense fallback={null}>
        <ChartSnapshotModal
          open={snapshotModalOpen}
          onClose={() => setSnapshotModalOpen(false)}
          canvas={chartRef.current?.getCanvas?.()}
          symbol={symbol}
          timeframe={tf}
          onPost={() => {
            import('../../app/components/ui/Toast.jsx')
              .then(({ default: toast }) => toast.success('Chart posted to Social Hub! 🚀'))
              .catch(() => {}); // intentional: Toast import is best-effort UI
          }}
        />
      </Suspense>

      {/* ─── Shared Slide Panel for Secondary Tools ─── */}
      {!isMobile && (
        <SlidePanel
          isOpen={!!activePanel}
          onClose={closePanel}
          title={panelInfo?.title || ''}
          width={panelWidth}
          minWidth={panelInfo?.minWidth || 280}
          onWidthChange={(w) => activePanel && useLayoutStore.getState().setPanelWidth(activePanel, w)}
        >
          <div style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Suspense fallback={<div style={{ padding: 16, color: C.t3 }}>Loading component...</div>}>
              {activePanel === 'indicators' && <IndicatorPanel isOpen={true} onClose={closePanel} />}
              {activePanel === 'watchlist' && <WatchlistPanel compact />}
              {activePanel === 'alerts' && <AlertPanel currentSymbol={symbol} />}
              {activePanel === 'insights' && (
                <ChartInsightsPanel
                  data={data}
                  isOpen={true}
                  onClose={closePanel}
                  symbol={symbol}
                  tf={tf}
                  onApplyAutoFib={(fib) => {
                    useChartToolsStore.getState().addDrawing(fib);
                    useChartFeaturesStore.getState().setIntelligence('showAutoFib', true);
                  }}
                  onCreateAlert={(level) => {
                    const { addAlert } = useAlertStore.getState();
                    addAlert({
                      symbol,
                      condition: level.price > data[data.length - 1]?.close ? 'above' : 'below',
                      price: level.price,
                      note: `[Smart] ${level.type} level with ${level.touches} touches`,
                    });
                  }}
                />
              )}
              {/* Wave 0: Quarantined — script editor frozen
              {activePanel === 'scripts' && (
                <ScriptEditor ref={editorRef} bars={data} onResults={setEditorOutputs} />
              )}
              */}
              {activePanel === 'settings' && <ChartSettingsPanel onClose={closePanel} />}
              {activePanel === 'hotkeys' && <HotkeyCustomizationPanel onClose={closePanel} />}
              {activePanel === 'annotations' && <ChartAnnotationsPanel onClose={closePanel} />}
              {activePanel === 'orderflow' && <OrderFlowPanel symbol={symbol} />}
              {activePanel === 'derivatives' && (
                <DerivativesDashboard
                  symbol={symbol.toUpperCase().endsWith('USDT') ? symbol.toUpperCase() : symbol.toUpperCase() + 'USDT'}
                />
              )}
              {activePanel === 'depth' && (
                <DepthPanel
                  symbol={symbol.toUpperCase().endsWith('USDT') ? symbol.toUpperCase() : symbol.toUpperCase() + 'USDT'}
                />
              )}
              {activePanel === 'institutional' && <InstitutionalPanel symbol={symbol} />}
              {activePanel === 'community' && <CommunitySignals />}
              {activePanel === 'positionSizer' && <PositionSizer />}
              {activePanel === 'alertHistory' && <AlertHistoryPanel />}
              {activePanel === 'alertAnalytics' && <AlertAnalytics />}
              {activePanel === 'quickJournal' && <QuickJournalPanel onClose={closePanel} />}
            </Suspense>
          </div>
        </SlidePanel>
      )}

      {/* Wave 0: Quarantined — script editor frozen
      {!isMobile && activePanel !== 'scripts' && (
        <div style={{ display: 'none' }}>
          <Suspense fallback={null}>
            <ScriptEditor ref={editorRef} bars={data} onResults={setEditorOutputs} />
          </Suspense>
        </div>
      )}
      */}

      {/* Wave 0: Quarantined — script manager frozen
      <Suspense fallback={null}>
        <ScriptManager
          open={showScriptManager}
          onClose={() => setShowScriptManager(false)}
          onEditScript={(id) => {
            setShowScriptManager(false);
            if (editorRef.current?.openScript) {
              editorRef.current.openScript(id);
            }
          }}
        />
      </Suspense>
      */}

      {/* Wave 0: ShareSnapshotModal quarantined — social sharing removed from v1.0
      <Suspense fallback={null}>
        <ShareSnapshotModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          chartConfig={{ symbol, tf, chartType, indicators }}
        />
      </Suspense>
      */}

      {/* Wave 0: SnapshotPublisher quarantined — social sharing removed from v1.0
      <Suspense fallback={null}>
        <SnapshotPublisher
          isOpen={showSnapshotPublisher}
          onClose={() => setShowSnapshotPublisher(false)}
          canvas={chartRef.current?.getCanvas()}
          chartInfo={{ symbol, tf, chartType }}
        />
      </Suspense>
      */}

      {/* ─── Mobile Chart Settings Sheet ─── */}
      {isMobile && (
        <Suspense fallback={null}>
          <MobileChartSheet
            isOpen={showMobileSettings}
            onClose={() => setShowMobileSettings(false)}
            onScreenshot={() => {
              setShowMobileSettings(false);
              setShowMobileShare(true);
            }}
            onFullscreen={() => {
              document.documentElement.requestFullscreen?.();
              setIsLandscapeFullscreen(true);
            }}
          />
        </Suspense>
      )}

      {/* ─── Mobile Share Sheet ─── */}
      {isMobile && (
        <Suspense fallback={null}>
          <MobileShareSheet
            isOpen={showMobileShare}
            onClose={() => setShowMobileShare(false)}
            canvas={chartRef.current?.getCanvas()}
            chartInfo={{ symbol, tf, chartType }}
          />
        </Suspense>
      )}

      {/* ─── Gesture Guide (first-time mobile) ─── */}
      {isMobile && (
        <Suspense fallback={null}>
          <GestureGuide />
        </Suspense>
      )}

      {/* Keyboard Shortcuts Overlay */}
      {showShortcuts && (
        <Suspense fallback={null}>
          <KeyboardShortcutsOverlay onClose={() => setShowShortcuts(false)} />
        </Suspense>
      )}
    </>
  );
}
