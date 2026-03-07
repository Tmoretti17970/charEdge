// ═══════════════════════════════════════════════════════════════════
// charEdge — Toolbar More Menu (≡)
// Extracted from UnifiedChartToolbar for progressive disclosure.
// Contains all categorized menu sections: Trading, Strategy & AI,
// Tools, Overlays, Panels, Layout, Settings.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect } from 'react';
import { C } from '../../../../constants.js';
import { useChartStore } from '../../../../state/useChartStore.js';
import { useBacktestStore } from '../../../../state/useBacktestStore.js';
import { useStrategyBuilderStore } from '../../../../state/useStrategyBuilderStore.js';

import ChartTradeToolbar from '../chart_ui/ChartTradeToolbar.jsx';

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

  // Chart Store State
  const toggleReplay = useChartStore((s) => s.toggleReplay);
  const replayMode = useChartStore((s) => s.replayMode);
  const showHeatmap = useChartStore((s) => s.showHeatmap);
  const toggleHeatmap = useChartStore((s) => s.toggleHeatmap);
  const showSessions = useChartStore((s) => s.showSessions);
  const toggleSessions = useChartStore((s) => s.toggleSessions);
  const showMTF = useChartStore((s) => s.showMTF);
  const toggleMTF = useChartStore((s) => s.toggleMTF);
  const showDOM = useChartStore((s) => s.showDOM);
  const toggleDOM = useChartStore((s) => s.toggleDOM);
  const showMinimap = useChartStore((s) => s.showMinimap);
  const toggleMinimap = useChartStore((s) => s.toggleMinimap);
  const showDataWindow = useChartStore((s) => s.showDataWindow);
  const toggleDataWindow = useChartStore((s) => s.toggleDataWindow);
  const showStatusBar = useChartStore((s) => s.showStatusBar);
  const toggleStatusBar = useChartStore((s) => s.toggleStatusBar);
  const showDepthChart = useChartStore((s) => s.showDepthChart);
  const toggleDepthChart = useChartStore((s) => s.toggleDepthChart);
  const showExtendedHours = useChartStore((s) => s.showExtendedHours);
  const toggleExtendedHours = useChartStore((s) => s.toggleExtendedHours);
  const showComparisonOverlay = useChartStore((s) => s.showComparisonOverlay);
  const toggleComparisonOverlay = useChartStore((s) => s.toggleComparisonOverlay);
  const showPatternOverlays = useChartStore((s) => s.showPatternOverlays);
  const togglePatternOverlays = useChartStore((s) => s.togglePatternOverlays);

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

          {!isMobile && (
            <div style={{ padding: '4px 8px' }}>
              <ChartTradeToolbar />
            </div>
          )}
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
            🔍 AI Chart Analysis
          </MenuItem>
          <MenuItem onClick={() => { onOpenCopilot && onOpenCopilot(); setMoreMenuOpen(false); }}>
            ✨ AI Copilot
          </MenuItem>

          <div className="tf-chart-dropdown-sep" />
          <div className="tf-chart-dropdown-label">TOOLS</div>

          <MenuItem onClick={() => { onOpenPanel('watchlist'); setMoreMenuOpen(false); }}>★ Watchlist</MenuItem>
          <MenuItem onClick={() => { onOpenPanel('alerts'); setMoreMenuOpen(false); }}>🔔 Alerts</MenuItem>
          <MenuItem onClick={() => { setShowObjectTree(!showObjectTree); setMoreMenuOpen(false); }}>🌳 Object Tree</MenuItem>
          <MenuItem onClick={() => { toggleReplay(); setMoreMenuOpen(false); }}>{replayMode ? '⏹ Exit Replay' : '⏪ Bar Replay'}</MenuItem>
          <MenuItem onClick={() => { onOpenPanel('scripts'); setMoreMenuOpen(false); }}>⌨️ Script Editor</MenuItem>
          <MenuItem onClick={() => { onOpenPanel('insights'); setMoreMenuOpen(false); }}>🧠 AI Insights</MenuItem>
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
            useChartStore.getState().addIndicator({ indicatorId: 'volumeDelta', params: {} });
            setMoreMenuOpen(false);
          }}>
            📊 Volume Delta
          </MenuItem>
          <MenuItem onClick={() => {
            useChartStore.getState().addIndicator({ indicatorId: 'vwap', params: { anchorTime: Date.now() } });
            setMoreMenuOpen(false);
          }}>
            📌 Anchored VWAP
          </MenuItem>
          <MenuItem onClick={() => { useChartStore.getState().toggleVolumeSpikes(); setMoreMenuOpen(false); }}>
            {useChartStore.getState().showVolumeSpikes ? '📡 Hide Volume Spikes' : '📡 Volume Spikes'}
          </MenuItem>
          <MenuItem onClick={() => { useChartStore.getState().toggleDeltaOverlay(); setMoreMenuOpen(false); }}>
            {useChartStore.getState().showDeltaOverlay ? '📊 Hide Delta Histogram' : '📊 Delta Histogram'}
          </MenuItem>
          <MenuItem onClick={() => { useChartStore.getState().toggleVPOverlay(); setMoreMenuOpen(false); }}>
            {useChartStore.getState().showVPOverlay ? '📈 Hide Volume Profile' : '📈 Volume Profile'}
          </MenuItem>
          <MenuItem onClick={() => { useChartStore.getState().toggleLargeTradesOverlay(); setMoreMenuOpen(false); }}>
            {useChartStore.getState().showLargeTradesOverlay ? '🐋 Hide Whale Trades' : '🐋 Whale Trades'}
          </MenuItem>
          <MenuItem onClick={() => { useChartStore.getState().toggleOIOverlay(); setMoreMenuOpen(false); }}>
            {useChartStore.getState().showOIOverlay ? '📉 Hide OI Overlay' : '📉 OI Overlay'}
          </MenuItem>
          <MenuItem onClick={() => { useChartStore.getState().toggleArbitrageSpread(); setMoreMenuOpen(false); }}>
            {useChartStore.getState().showArbitrageSpread ? '⚖️ Hide Arb Spread' : '⚖️ Arb Spread'}
          </MenuItem>

          <div className="tf-chart-dropdown-sep" />
          <div className="tf-chart-dropdown-label">PANELS</div>

          <MenuItem onClick={() => { toggleMTF(); setMoreMenuOpen(false); }}>
            {showMTF ? '📊 Hide MTF Panel' : '📊 Multi-Timeframe'}
          </MenuItem>
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
