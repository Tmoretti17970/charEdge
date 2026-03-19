// ═══════════════════════════════════════════════════════════════════
// charEdge — Toolbar More Menu (≡)
// Extracted from UnifiedChartToolbar for progressive disclosure.
// Contains all categorized menu sections: Trading, Strategy & AI,
// Tools, Overlays, Panels, Layout, Settings.
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react';
import { C } from '@/constants.js';
import { useBacktestStore } from '../../../../state/useBacktestStore.js';
import { useStrategyBuilderStore } from '../../../../state/useStrategyBuilderStore';
import AIOrb from '../../design/AIOrb.jsx';

import { useChartToolsStore } from '../../../../state/chart/useChartToolsStore';

function MenuItem({ children, onClick }) {
  return (
    <button className="tf-chart-dropdown-item" onClick={onClick}>
      {children}
    </button>
  );
}

export default function ToolbarMoreMenu({
  isMobile,
  showTrades, setShowTrades,
  showObjectTree, setShowObjectTree,
  onOpenPanel,
  onOpenCopilot,
  onToggleAnalysis,
  onSnapshot,
  layoutMode, setLayoutMode,
}) {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);

  // Features Store — match useChartFeaturesStore with ChartEngineWidget
  const toggleReplay = useChartFeaturesStore((s) => s.toggleReplay);
  const replayMode = useChartFeaturesStore((s) => s.replayMode);
  const showHeatmap = useChartFeaturesStore((s) => s.showHeatmap);
  const toggleHeatmap = useChartFeaturesStore((s) => s.toggleHeatmap);
  const showSessions = useChartFeaturesStore((s) => s.showSessions);
  const toggleSessions = useChartFeaturesStore((s) => s.toggleSessions);

  const showDOM = useChartFeaturesStore((s) => s.showDOM);
  const toggleDOM = useChartFeaturesStore((s) => s.toggleDOM);
  const showMinimap = useChartFeaturesStore((s) => s.showMinimap);
  const toggleMinimap = useChartFeaturesStore((s) => s.toggleMinimap);
  const showDataWindow = useChartFeaturesStore((s) => s.showDataWindow);
  const toggleDataWindow = useChartFeaturesStore((s) => s.toggleDataWindow);
  const showCrosshairTooltip = useChartFeaturesStore((s) => s.showCrosshairTooltip);
  const toggleCrosshairTooltip = useChartFeaturesStore((s) => s.toggleCrosshairTooltip);
  const showStatusBar = useChartFeaturesStore((s) => s.showStatusBar);
  const toggleStatusBar = useChartFeaturesStore((s) => s.toggleStatusBar);
  const showDepthChart = useChartFeaturesStore((s) => s.showDepthChart);
  const toggleDepthChart = useChartFeaturesStore((s) => s.toggleDepthChart);
  const showExtendedHours = useChartFeaturesStore((s) => s.showExtendedHours);
  const toggleExtendedHours = useChartFeaturesStore((s) => s.toggleExtendedHours);
  const showComparisonOverlay = useChartFeaturesStore((s) => s.showComparisonOverlay);
  const toggleComparisonOverlay = useChartFeaturesStore((s) => s.toggleComparisonOverlay);
  const showPatternOverlays = useChartFeaturesStore((s) => s.showPatternOverlays);
  const togglePatternOverlays = useChartFeaturesStore((s) => s.togglePatternOverlays);

  const backtestPanelOpen = useBacktestStore((s) => s.panelOpen);
  const strategyBuilderOpen = useStrategyBuilderStore((s) => s.panelOpen);

  useEffect(() => {
    function handleClickOutside(e) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) setMoreMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={moreMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        className="tf-chart-toolbar-btn"
        data-active={moreMenuOpen || undefined}
        onClick={() => setMoreMenuOpen(!moreMenuOpen)}
        title="More Tools & Settings"
      >
        ≡
      </button>

      {moreMenuOpen && (
        <div
          className="tf-chart-dropdown"
          style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, minWidth: 240, maxHeight: '75vh', overflowY: 'auto' }}
        >

          <div className="tf-chart-dropdown-label">TRADING</div>

          <MenuItem onClick={() => { onOpenPanel('positionSizer'); setMoreMenuOpen(false); }}>⚖️ Position Sizer</MenuItem>
          <MenuItem onClick={() => { onOpenPanel('quickJournal'); setMoreMenuOpen(false); }}>📝 Quick Journal</MenuItem>

          <div className="tf-chart-dropdown-sep" />
          <div className="tf-chart-dropdown-label">STRATEGY & AI</div>

          <MenuItem onClick={() => { useBacktestStore.getState().togglePanel(); setMoreMenuOpen(false); }}>
            🧪 Strategy Tester {backtestPanelOpen && '✓'}
          </MenuItem>
          <MenuItem onClick={() => { useStrategyBuilderStore.getState().togglePanel(); setMoreMenuOpen(false); }}>
            📐 Strategy Builder {strategyBuilderOpen && '✓'}
          </MenuItem>
          <MenuItem onClick={() => { onToggleAnalysis && onToggleAnalysis(); setMoreMenuOpen(false); }}>
            <AIOrb size={14} style={{ marginRight: 4 }} /> AI Chart Analysis
          </MenuItem>
          <MenuItem onClick={() => { onOpenCopilot && onOpenCopilot(); setMoreMenuOpen(false); }}>
            <AIOrb size={14} style={{ marginRight: 4 }} /> AI Copilot
          </MenuItem>

          <div className="tf-chart-dropdown-sep" />
          <div className="tf-chart-dropdown-label">TOOLS</div>

          <MenuItem onClick={() => { setShowObjectTree(!showObjectTree); setMoreMenuOpen(false); }}>🌳 Object Tree</MenuItem>
          <MenuItem onClick={() => { toggleReplay(); setMoreMenuOpen(false); }}>{replayMode ? '⏹ Exit Replay' : '⏪ Bar Replay'}</MenuItem>
          <MenuItem onClick={() => { onOpenPanel('scripts'); setMoreMenuOpen(false); }}>⌨️ Script Editor</MenuItem>
          <MenuItem onClick={() => { onOpenPanel('insights'); setMoreMenuOpen(false); }}><AIOrb size={14} style={{ marginRight: 4 }} /> AI Insights</MenuItem>
          <MenuItem onClick={() => { onOpenPanel('annotations'); setMoreMenuOpen(false); }}>📝 Annotations</MenuItem>
          <MenuItem onClick={() => { onSnapshot && onSnapshot(); setMoreMenuOpen(false); }}>📸 Share Snapshot</MenuItem>

          <div className="tf-chart-dropdown-sep" />
          <div className="tf-chart-dropdown-label">OVERLAYS</div>

          <MenuItem onClick={() => { toggleComparisonOverlay(); setMoreMenuOpen(false); }}>
            {showComparisonOverlay ? '⚖ Hide Compare' : '⚖ Compare Symbols'}
          </MenuItem>
          <MenuItem onClick={() => { toggleHeatmap(); setMoreMenuOpen(false); }}>
            {showHeatmap ? '🔥 Hide Liquidity Heatmap' : '🔥 Liquidity Heatmap'}
          </MenuItem>
          <MenuItem onClick={() => { toggleSessions(); setMoreMenuOpen(false); }}>
            {showSessions ? '🕐 Hide Sessions' : '🕐 Show Sessions'}
          </MenuItem>
          <MenuItem onClick={() => { toggleExtendedHours(); setMoreMenuOpen(false); }}>
            {showExtendedHours ? '🌙 Hide Extended Hours' : '🌙 Extended Hours'}
          </MenuItem>
          <MenuItem onClick={() => { togglePatternOverlays(); setMoreMenuOpen(false); }}>
            {showPatternOverlays ? '🔍 Hide Pattern Detection' : '🔍 Pattern Detection'}
          </MenuItem>
          {!isMobile && (
            <MenuItem onClick={() => { setShowTrades(!showTrades); setMoreMenuOpen(false); }}>
              {showTrades ? '👁 Hide Trades' : '👁 Show Trades'}
            </MenuItem>
          )}
          <MenuItem onClick={() => {
            useChartToolsStore.getState().addIndicator({ indicatorId: 'volumeDelta', params: {} });
            setMoreMenuOpen(false);
          }}>
            📊 Volume Delta
          </MenuItem>
          <MenuItem onClick={() => {
            useChartToolsStore.getState().addIndicator({ indicatorId: 'vwap', params: { anchorTime: Date.now() } });
            setMoreMenuOpen(false);
          }}>
            📌 Anchored VWAP
          </MenuItem>
          <MenuItem onClick={() => { useChartFeaturesStore.getState().toggleVolumeSpikes(); setMoreMenuOpen(false); }}>
            {useChartFeaturesStore.getState().showVolumeSpikes ? '📡 Hide Volume Spikes' : '📡 Volume Spikes'}
          </MenuItem>
          <MenuItem onClick={() => { useChartFeaturesStore.getState().toggleDeltaOverlay(); setMoreMenuOpen(false); }}>
            {useChartFeaturesStore.getState().showDeltaOverlay ? '📊 Hide Delta Histogram' : '📊 Delta Histogram'}
          </MenuItem>
          <MenuItem onClick={() => { useChartFeaturesStore.getState().toggleVPOverlay(); setMoreMenuOpen(false); }}>
            {useChartFeaturesStore.getState().showVPOverlay ? '📈 Hide Volume Profile' : '📈 Volume Profile'}
          </MenuItem>
          <MenuItem onClick={() => { useChartFeaturesStore.getState().toggleLargeTradesOverlay(); setMoreMenuOpen(false); }}>
            {useChartFeaturesStore.getState().showLargeTradesOverlay ? '🐋 Hide Whale Trades' : '🐋 Whale Trades'}
          </MenuItem>
          <MenuItem onClick={() => { useChartFeaturesStore.getState().toggleOIOverlay(); setMoreMenuOpen(false); }}>
            {useChartFeaturesStore.getState().showOIOverlay ? '📉 Hide OI Overlay' : '📉 OI Overlay'}
          </MenuItem>
          <MenuItem onClick={() => { useChartFeaturesStore.getState().toggleArbitrageSpread(); setMoreMenuOpen(false); }}>
            {useChartFeaturesStore.getState().showArbitrageSpread ? '⚖️ Hide Arb Spread' : '⚖️ Arb Spread'}
          </MenuItem>

          <div className="tf-chart-dropdown-sep" />
          <div className="tf-chart-dropdown-label">PANELS</div>


          <MenuItem onClick={() => { toggleDOM(); setMoreMenuOpen(false); }}>
            {showDOM ? '📋 Hide DOM Ladder' : '📋 DOM Ladder'}
          </MenuItem>
          <MenuItem onClick={() => { toggleDepthChart(); setMoreMenuOpen(false); }}>
            {showDepthChart ? '📉 Hide Depth Chart' : '📉 Depth Chart'}
          </MenuItem>
          <MenuItem onClick={() => { toggleMinimap(); setMoreMenuOpen(false); }}>
            {showMinimap ? '🗺 Hide Minimap' : '🗺 Minimap'}
          </MenuItem>
          <MenuItem onClick={() => { toggleStatusBar(); setMoreMenuOpen(false); }}>
            {showStatusBar ? '📊 Hide Status Bar' : '📊 Status Bar'}
          </MenuItem>
          <MenuItem onClick={() => { toggleDataWindow(); setMoreMenuOpen(false); }}>
            {showDataWindow ? '📋 Hide Data Window' : '📋 Data Window'}
          </MenuItem>
          <MenuItem onClick={() => { toggleCrosshairTooltip(); setMoreMenuOpen(false); }}>
            {showCrosshairTooltip ? '💬 Hide Crosshair Tooltip' : '💬 Crosshair Tooltip'}
          </MenuItem>
          <MenuItem onClick={() => { onOpenPanel('orderflow'); setMoreMenuOpen(false); }}>⚡ Order Flow</MenuItem>
          <MenuItem onClick={() => { onOpenPanel('derivatives'); setMoreMenuOpen(false); }}>📊 Derivatives</MenuItem>
          <MenuItem onClick={() => { onOpenPanel('depth'); setMoreMenuOpen(false); }}>📖 Order Book</MenuItem>
          <MenuItem onClick={() => { onOpenPanel('institutional'); setMoreMenuOpen(false); }}>🏛 Institutional</MenuItem>
          <MenuItem onClick={() => { onOpenPanel('options'); setMoreMenuOpen(false); }}>📊 Options Intel</MenuItem>
          <MenuItem onClick={() => { onOpenPanel('community'); setMoreMenuOpen(false); }}>📡 Community Signals</MenuItem>

          <div className="tf-chart-dropdown-sep" />
          <div className="tf-chart-dropdown-label">LAYOUT</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, padding: '4px 8px 8px' }}>
            {[
              { id: '1x1', label: 'Single', grid: [[1]] },
              { id: '2x1', label: '2 Col', grid: [[1, 1]] },
              { id: '1x2', label: '2 Row', grid: [[1], [1]] },
              { id: '3x1', label: '3 Col', grid: [[1, 1, 1]] },
              { id: '1x3', label: '3 Row', grid: [[1], [1], [1]] },
              { id: '2x2', label: 'Quad', grid: [[1, 1], [1, 1]] },
            ].map(lo => {
              const isActive = layoutMode === lo.id;
              return (
                <button
                  key={lo.id}
                  onClick={() => { setLayoutMode(lo.id); setMoreMenuOpen(false); }}
                  title={lo.label}
                  style={{
                    width: 48, height: 38, padding: 5,
                    background: isActive ? `${C.b}18` : 'transparent',
                    border: `1.5px solid ${isActive ? C.b : C.bd}`,
                    borderRadius: 8, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: 2,
                    alignItems: 'stretch', justifyContent: 'center',
                    transition: 'all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.borderColor = C.t3; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.borderColor = C.bd; }}
                >
                  {lo.grid.map((row, ri) => (
                    <div key={ri} style={{ display: 'flex', gap: 2, flex: 1 }}>
                      {row.map((_, ci) => (
                        <div key={ci} style={{
                          flex: 1, borderRadius: 3,
                          background: isActive ? `${C.b}45` : `${C.t3}25`,
                          transition: 'background 0.15s ease',
                        }} />
                      ))}
                    </div>
                  ))}
                </button>
              );
            })}
          </div>

          <div className="tf-chart-dropdown-sep" />
          <div className="tf-chart-dropdown-label">SETTINGS</div>

          <MenuItem onClick={() => { onOpenPanel('settings'); setMoreMenuOpen(false); }}>
            ⚙️ Chart Settings
          </MenuItem>
          <MenuItem onClick={() => { onOpenPanel('hotkeys'); setMoreMenuOpen(false); }}>
            ⌨️ Keyboard Shortcuts
          </MenuItem>
        </div>
      )}
    </div>
  );
}
