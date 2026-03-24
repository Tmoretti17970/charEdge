// ═══════════════════════════════════════════════════════════════════
// charEdge — Toolbar More Menu (≡)
// Extracted from UnifiedChartToolbar for progressive disclosure.
// Contains all categorized menu sections: Trading, Strategy & AI,
// Tools, Overlays, Panels, Layout, Settings.
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react';
import { useBacktestStore } from '../../../../state/useBacktestStore.js';
import { useStrategyBuilderStore } from '../../../../state/useStrategyBuilderStore';
import AIOrb from '../../design/AIOrb.jsx';
import { useChartToolsStore } from '../../../../state/chart/useChartToolsStore';
import { useChartFeaturesStore } from '../../../../state/chart/useChartFeaturesStore';
import s from './ToolbarMoreMenu.module.css';

function MenuItem({ children, onClick }) {
  return <button className="tf-chart-dropdown-item" onClick={onClick}>{children}</button>;
}

export default function ToolbarMoreMenu({
  isMobile, showTrades, setShowTrades, showObjectTree, setShowObjectTree,
  onOpenPanel, onOpenCopilot, onToggleAnalysis, onSnapshot, layoutMode, setLayoutMode,
}) {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);

  const toggleReplay = useChartFeaturesStore((st) => st.toggleReplay);
  const replayMode = useChartFeaturesStore((st) => st.replayMode);
  const showHeatmap = useChartFeaturesStore((st) => st.showHeatmap);
  const toggleHeatmap = useChartFeaturesStore((st) => st.toggleHeatmap);
  const showSessions = useChartFeaturesStore((st) => st.showSessions);
  const toggleSessions = useChartFeaturesStore((st) => st.toggleSessions);
  const showDOM = useChartFeaturesStore((st) => st.showDOM);
  const toggleDOM = useChartFeaturesStore((st) => st.toggleDOM);
  const showMinimap = useChartFeaturesStore((st) => st.showMinimap);
  const toggleMinimap = useChartFeaturesStore((st) => st.toggleMinimap);
  const showDataWindow = useChartFeaturesStore((st) => st.showDataWindow);
  const toggleDataWindow = useChartFeaturesStore((st) => st.toggleDataWindow);
  const showCrosshairTooltip = useChartFeaturesStore((st) => st.showCrosshairTooltip);
  const toggleCrosshairTooltip = useChartFeaturesStore((st) => st.toggleCrosshairTooltip);
  const showStatusBar = useChartFeaturesStore((st) => st.showStatusBar);
  const toggleStatusBar = useChartFeaturesStore((st) => st.toggleStatusBar);
  const showDepthChart = useChartFeaturesStore((st) => st.showDepthChart);
  const toggleDepthChart = useChartFeaturesStore((st) => st.toggleDepthChart);
  const showExtendedHours = useChartFeaturesStore((st) => st.showExtendedHours);
  const toggleExtendedHours = useChartFeaturesStore((st) => st.toggleExtendedHours);
  const showComparisonOverlay = useChartFeaturesStore((st) => st.showComparisonOverlay);
  const toggleComparisonOverlay = useChartFeaturesStore((st) => st.toggleComparisonOverlay);
  const showPatternOverlays = useChartFeaturesStore((st) => st.showPatternOverlays);
  const togglePatternOverlays = useChartFeaturesStore((st) => st.togglePatternOverlays);

  const backtestPanelOpen = useBacktestStore((st) => st.panelOpen);
  const strategyBuilderOpen = useStrategyBuilderStore((st) => st.panelOpen);

  useEffect(() => {
    function handleClickOutside(e) { if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) setMoreMenuOpen(false); }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={moreMenuRef} className={s.wrap}>
      <button className="tf-chart-toolbar-btn" data-active={moreMenuOpen || undefined} onClick={() => setMoreMenuOpen(!moreMenuOpen)} title="More Tools & Settings">≡</button>

      {moreMenuOpen && (
        <div className={`tf-chart-dropdown ${s.dropdown}`}>
          <div className="tf-chart-dropdown-label">TRADING</div>
          <MenuItem onClick={() => { onOpenPanel('positionSizer'); setMoreMenuOpen(false); }}>⚖️ Position Sizer</MenuItem>
          <MenuItem onClick={() => { onOpenPanel('quickJournal'); setMoreMenuOpen(false); }}>📝 Quick Journal</MenuItem>

          <div className="tf-chart-dropdown-sep" />
          <div className="tf-chart-dropdown-label">STRATEGY & AI</div>
          <MenuItem onClick={() => { useBacktestStore.getState().togglePanel(); setMoreMenuOpen(false); }}>🧪 Strategy Tester {backtestPanelOpen && '✓'}</MenuItem>
          <MenuItem onClick={() => { useStrategyBuilderStore.getState().togglePanel(); setMoreMenuOpen(false); }}>📐 Strategy Builder {strategyBuilderOpen && '✓'}</MenuItem>
          <MenuItem onClick={() => { onToggleAnalysis && onToggleAnalysis(); setMoreMenuOpen(false); }}><AIOrb size={14} style={{ marginRight: 4 }} /> AI Chart Analysis</MenuItem>
          <MenuItem onClick={() => { onOpenCopilot && onOpenCopilot(); setMoreMenuOpen(false); }}><AIOrb size={14} style={{ marginRight: 4 }} /> AI Copilot</MenuItem>

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
          <MenuItem onClick={() => { toggleComparisonOverlay(); setMoreMenuOpen(false); }}>{showComparisonOverlay ? '⚖ Hide Compare' : '⚖ Compare Symbols'}</MenuItem>
          <MenuItem onClick={() => { toggleHeatmap(); setMoreMenuOpen(false); }}>{showHeatmap ? '🔥 Hide Liquidity Heatmap' : '🔥 Liquidity Heatmap'}</MenuItem>
          <MenuItem onClick={() => { toggleSessions(); setMoreMenuOpen(false); }}>{showSessions ? '🕐 Hide Sessions' : '🕐 Show Sessions'}</MenuItem>
          <MenuItem onClick={() => { toggleExtendedHours(); setMoreMenuOpen(false); }}>{showExtendedHours ? '🌙 Hide Extended Hours' : '🌙 Extended Hours'}</MenuItem>
          <MenuItem onClick={() => { togglePatternOverlays(); setMoreMenuOpen(false); }}>{showPatternOverlays ? '🔍 Hide Pattern Detection' : '🔍 Pattern Detection'}</MenuItem>
          {!isMobile && <MenuItem onClick={() => { setShowTrades(!showTrades); setMoreMenuOpen(false); }}>{showTrades ? '👁 Hide Trades' : '👁 Show Trades'}</MenuItem>}
          <MenuItem onClick={() => { useChartToolsStore.getState().addIndicator({ indicatorId: 'volumeDelta', params: {} }); setMoreMenuOpen(false); }}>📊 Volume Delta</MenuItem>
          <MenuItem onClick={() => { useChartToolsStore.getState().addIndicator({ indicatorId: 'vwap', params: { anchorTime: Date.now() } }); setMoreMenuOpen(false); }}>📌 Anchored VWAP</MenuItem>
          <MenuItem onClick={() => { useChartFeaturesStore.getState().toggleVolumeSpikes(); setMoreMenuOpen(false); }}>{useChartFeaturesStore.getState().showVolumeSpikes ? '📡 Hide Volume Spikes' : '📡 Volume Spikes'}</MenuItem>
          <MenuItem onClick={() => { useChartFeaturesStore.getState().toggleDeltaOverlay(); setMoreMenuOpen(false); }}>{useChartFeaturesStore.getState().showDeltaOverlay ? '📊 Hide Delta Histogram' : '📊 Delta Histogram'}</MenuItem>
          <MenuItem onClick={() => { useChartFeaturesStore.getState().toggleVPOverlay(); setMoreMenuOpen(false); }}>{useChartFeaturesStore.getState().showVPOverlay ? '📈 Hide Volume Profile' : '📈 Volume Profile'}</MenuItem>
          <MenuItem onClick={() => { useChartFeaturesStore.getState().toggleLargeTradesOverlay(); setMoreMenuOpen(false); }}>{useChartFeaturesStore.getState().showLargeTradesOverlay ? '🐋 Hide Whale Trades' : '🐋 Whale Trades'}</MenuItem>
          <MenuItem onClick={() => { useChartFeaturesStore.getState().toggleOIOverlay(); setMoreMenuOpen(false); }}>{useChartFeaturesStore.getState().showOIOverlay ? '📉 Hide OI Overlay' : '📉 OI Overlay'}</MenuItem>
          <MenuItem onClick={() => { useChartFeaturesStore.getState().toggleArbitrageSpread(); setMoreMenuOpen(false); }}>{useChartFeaturesStore.getState().showArbitrageSpread ? '⚖️ Hide Arb Spread' : '⚖️ Arb Spread'}</MenuItem>

          <div className="tf-chart-dropdown-sep" />
          <div className="tf-chart-dropdown-label">PANELS</div>
          <MenuItem onClick={() => { toggleDOM(); setMoreMenuOpen(false); }}>{showDOM ? '📋 Hide DOM Ladder' : '📋 DOM Ladder'}</MenuItem>
          <MenuItem onClick={() => { toggleDepthChart(); setMoreMenuOpen(false); }}>{showDepthChart ? '📉 Hide Depth Chart' : '📉 Depth Chart'}</MenuItem>
          <MenuItem onClick={() => { toggleMinimap(); setMoreMenuOpen(false); }}>{showMinimap ? '🗺 Hide Minimap' : '🗺 Minimap'}</MenuItem>
          <MenuItem onClick={() => { toggleStatusBar(); setMoreMenuOpen(false); }}>{showStatusBar ? '📊 Hide Status Bar' : '📊 Status Bar'}</MenuItem>
          <MenuItem onClick={() => { toggleDataWindow(); setMoreMenuOpen(false); }}>{showDataWindow ? '📋 Hide Data Window' : '📋 Data Window'}</MenuItem>
          <MenuItem onClick={() => { toggleCrosshairTooltip(); setMoreMenuOpen(false); }}>{showCrosshairTooltip ? '💬 Hide Crosshair Tooltip' : '💬 Crosshair Tooltip'}</MenuItem>
          <MenuItem onClick={() => { onOpenPanel('orderflow'); setMoreMenuOpen(false); }}>⚡ Order Flow</MenuItem>
          <MenuItem onClick={() => { onOpenPanel('derivatives'); setMoreMenuOpen(false); }}>📊 Derivatives</MenuItem>
          <MenuItem onClick={() => { onOpenPanel('depth'); setMoreMenuOpen(false); }}>📖 Order Book</MenuItem>
          <MenuItem onClick={() => { onOpenPanel('institutional'); setMoreMenuOpen(false); }}>🏛 Institutional</MenuItem>
          <MenuItem onClick={() => { onOpenPanel('options'); setMoreMenuOpen(false); }}>📊 Options Intel</MenuItem>
          <MenuItem onClick={() => { onOpenPanel('community'); setMoreMenuOpen(false); }}>📡 Community Signals</MenuItem>

          <div className="tf-chart-dropdown-sep" />
          <div className="tf-chart-dropdown-label">LAYOUT</div>

          <div className={s.layoutGrid}>
            {[
              { id: '1x1', label: 'Single', grid: [[1]] },
              { id: '2x1', label: '2 Col', grid: [[1, 1]] },
              { id: '1x2', label: '2 Row', grid: [[1], [1]] },
              { id: '3x1', label: '3 Col', grid: [[1, 1, 1]] },
              { id: '1x3', label: '3 Row', grid: [[1], [1], [1]] },
              { id: '2x2', label: 'Quad', grid: [[1, 1], [1, 1]] },
            ].map(lo => (
              <button key={lo.id} onClick={() => { setLayoutMode(lo.id); setMoreMenuOpen(false); }} title={lo.label}
                className={s.layoutBtn} data-active={layoutMode === lo.id || undefined}>
                {lo.grid.map((row, ri) => (
                  <div key={ri} className={s.layoutRow}>
                    {row.map((_, ci) => <div key={ci} className={s.layoutCell} data-active={layoutMode === lo.id || undefined} />)}
                  </div>
                ))}
              </button>
            ))}
          </div>

          <div className="tf-chart-dropdown-sep" />
          <div className="tf-chart-dropdown-label">SETTINGS</div>
          <MenuItem onClick={() => { onOpenPanel('settings'); setMoreMenuOpen(false); }}>⚙️ Chart Settings</MenuItem>
          <MenuItem onClick={() => { onOpenPanel('hotkeys'); setMoreMenuOpen(false); }}>⌨️ Keyboard Shortcuts</MenuItem>
        </div>
      )}
    </div>
  );
}
