// ═══════════════════════════════════════════════════════════════════
// charEdge — Toolbar More Menu (≡)
// Phase 2: Restructured for progressive disclosure.
// 12 core items + expandable Overlays/Panels/Layout submenus.
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react';
import { useChartFeaturesStore } from '../../../../state/chart/useChartFeaturesStore';
import { useChartToolsStore } from '../../../../state/chart/useChartToolsStore';
import { useBacktestStore } from '../../../../state/useBacktestStore.js';
import AIOrb from '../../design/AIOrb.jsx';
import s from './ToolbarMoreMenu.module.css';

function MenuItem({ children, onClick, active }) {
  return (
    <button className="tf-chart-dropdown-item" data-active={active || undefined} onClick={onClick}>
      {children}
    </button>
  );
}

function SubmenuToggle({ label, icon, open, onClick, count }) {
  return (
    <button className="tf-chart-dropdown-item" onClick={onClick} style={{ justifyContent: 'space-between' }}>
      <span>
        {icon} {label}
      </span>
      <span style={{ fontSize: 10, opacity: 0.5 }}>
        {count} {open ? '▾' : '▸'}
      </span>
    </button>
  );
}

export default function ToolbarMoreMenu({
  isMobile,
  showTrades,
  setShowTrades,
  showObjectTree,
  setShowObjectTree,
  onOpenPanel,
  onOpenCopilot,
  _onToggleAnalysis,
  onSnapshot,
  layoutMode,
  setLayoutMode,
}) {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [expandedSub, setExpandedSub] = useState(null); // 'overlays' | 'panels' | 'layout' | null
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

  useEffect(() => {
    function handleClickOutside(e) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) setMoreMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleSub = (name) => setExpandedSub(expandedSub === name ? null : name);
  const close = () => setMoreMenuOpen(false);

  return (
    <div ref={moreMenuRef} className={s.wrap}>
      <button
        className="tf-chart-toolbar-btn"
        data-active={moreMenuOpen || undefined}
        onClick={() => {
          setMoreMenuOpen(!moreMenuOpen);
          setExpandedSub(null);
        }}
        title="More Tools & Settings"
      >
        ≡
      </button>

      {moreMenuOpen && (
        <div className={`tf-chart-dropdown ${s.dropdown}`}>
          {/* ─── TRADING ─────────────────────────────── */}
          <div className="tf-chart-dropdown-label">TRADING</div>
          <MenuItem
            onClick={() => {
              onOpenPanel('positionSizer');
              close();
            }}
          >
            ⚖️ Position Sizer
          </MenuItem>
          <MenuItem
            onClick={() => {
              onOpenPanel('quickJournal');
              close();
            }}
          >
            📝 Quick Journal
          </MenuItem>

          {/* ─── AI & STRATEGY ────────────────────────── */}
          <div className="tf-chart-dropdown-sep" />
          <div className="tf-chart-dropdown-label">AI & STRATEGY</div>
          <MenuItem
            onClick={() => {
              onOpenCopilot && onOpenCopilot();
              close();
            }}
          >
            <AIOrb size={14} style={{ marginRight: 4 }} /> AI Copilot
          </MenuItem>
          <MenuItem
            onClick={() => {
              useBacktestStore.getState().togglePanel();
              close();
            }}
          >
            🧪 Strategy Tester {backtestPanelOpen && '✓'}
          </MenuItem>

          {/* ─── TOOLS ────────────────────────────────── */}
          <div className="tf-chart-dropdown-sep" />
          <div className="tf-chart-dropdown-label">TOOLS</div>
          <MenuItem
            onClick={() => {
              setShowObjectTree(!showObjectTree);
              close();
            }}
          >
            🌳 Object Tree
          </MenuItem>
          <MenuItem
            onClick={() => {
              toggleReplay();
              close();
            }}
          >
            {replayMode ? '⏹ Exit Replay' : '⏪ Bar Replay'}
          </MenuItem>
          <MenuItem
            onClick={() => {
              onOpenPanel('annotations');
              close();
            }}
          >
            📝 Annotations
          </MenuItem>
          <MenuItem
            onClick={() => {
              onSnapshot && onSnapshot();
              close();
            }}
          >
            📸 Share Snapshot
          </MenuItem>

          {/* ─── EXPANDABLE SUBMENUS ──────────────────── */}
          <div className="tf-chart-dropdown-sep" />

          {/* Overlays submenu */}
          <SubmenuToggle
            label="Overlays"
            icon="🔲"
            open={expandedSub === 'overlays'}
            onClick={() => toggleSub('overlays')}
            count={14}
          />
          {expandedSub === 'overlays' && (
            <div style={{ paddingLeft: 12 }}>
              <MenuItem
                onClick={() => {
                  toggleComparisonOverlay();
                  close();
                }}
              >
                {showComparisonOverlay ? '⚖ Hide Compare' : '⚖ Compare Symbols'}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  toggleHeatmap();
                  close();
                }}
              >
                {showHeatmap ? '🔥 Hide Heatmap' : '🔥 Liquidity Heatmap'}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  toggleSessions();
                  close();
                }}
              >
                {showSessions ? '🕐 Hide Sessions' : '🕐 Sessions'}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  toggleExtendedHours();
                  close();
                }}
              >
                {showExtendedHours ? '🌙 Hide Extended' : '🌙 Extended Hours'}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  togglePatternOverlays();
                  close();
                }}
              >
                {showPatternOverlays ? '🔍 Hide Patterns' : '🔍 Pattern Detection'}
              </MenuItem>
              {!isMobile && (
                <MenuItem
                  onClick={() => {
                    setShowTrades(!showTrades);
                    close();
                  }}
                >
                  {showTrades ? '👁 Hide Trades' : '👁 Show Trades'}
                </MenuItem>
              )}
              <MenuItem
                onClick={() => {
                  useChartToolsStore.getState().addIndicator({ indicatorId: 'volumeDelta', params: {} });
                  close();
                }}
              >
                📊 Volume Delta
              </MenuItem>
              <MenuItem
                onClick={() => {
                  useChartToolsStore
                    .getState()
                    .addIndicator({ indicatorId: 'vwap', params: { anchorTime: Date.now() } });
                  close();
                }}
              >
                📌 Anchored VWAP
              </MenuItem>
              <MenuItem
                onClick={() => {
                  useChartFeaturesStore.getState().toggleVolumeSpikes();
                  close();
                }}
              >
                {useChartFeaturesStore.getState().showVolumeSpikes ? '📡 Hide Spikes' : '📡 Volume Spikes'}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  useChartFeaturesStore.getState().toggleDeltaOverlay();
                  close();
                }}
              >
                {useChartFeaturesStore.getState().showDeltaOverlay ? '📊 Hide Delta' : '📊 Delta Histogram'}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  useChartFeaturesStore.getState().toggleVPOverlay();
                  close();
                }}
              >
                {useChartFeaturesStore.getState().showVPOverlay ? '📈 Hide VP' : '📈 Volume Profile'}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  useChartFeaturesStore.getState().toggleLargeTradesOverlay();
                  close();
                }}
              >
                {useChartFeaturesStore.getState().showLargeTradesOverlay ? '🐋 Hide Whales' : '🐋 Whale Trades'}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  useChartFeaturesStore.getState().toggleOIOverlay();
                  close();
                }}
              >
                {useChartFeaturesStore.getState().showOIOverlay ? '📉 Hide OI' : '📉 OI Overlay'}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  useChartFeaturesStore.getState().toggleArbitrageSpread();
                  close();
                }}
              >
                {useChartFeaturesStore.getState().showArbitrageSpread ? '⚖️ Hide Arb' : '⚖️ Arb Spread'}
              </MenuItem>
            </div>
          )}

          {/* Panels submenu */}
          <SubmenuToggle
            label="Panels"
            icon="📋"
            open={expandedSub === 'panels'}
            onClick={() => toggleSub('panels')}
            count={12}
          />
          {expandedSub === 'panels' && (
            <div style={{ paddingLeft: 12 }}>
              <MenuItem
                onClick={() => {
                  toggleDOM();
                  close();
                }}
              >
                {showDOM ? '📋 Hide DOM' : '📋 DOM Ladder'}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  toggleDepthChart();
                  close();
                }}
              >
                {showDepthChart ? '📉 Hide Depth' : '📉 Depth Chart'}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  toggleMinimap();
                  close();
                }}
              >
                {showMinimap ? '🗺 Hide Minimap' : '🗺 Minimap'}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  toggleStatusBar();
                  close();
                }}
              >
                {showStatusBar ? '📊 Hide Status' : '📊 Status Bar'}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  toggleDataWindow();
                  close();
                }}
              >
                {showDataWindow ? '📋 Hide Data' : '📋 Data Window'}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  toggleCrosshairTooltip();
                  close();
                }}
              >
                {showCrosshairTooltip ? '💬 Hide Crosshair' : '💬 Crosshair Tooltip'}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  onOpenPanel('orderflow');
                  close();
                }}
              >
                ⚡ Order Flow
              </MenuItem>
              <MenuItem
                onClick={() => {
                  onOpenPanel('derivatives');
                  close();
                }}
              >
                📊 Derivatives
              </MenuItem>
              <MenuItem
                onClick={() => {
                  onOpenPanel('depth');
                  close();
                }}
              >
                📖 Order Book
              </MenuItem>
              <MenuItem
                onClick={() => {
                  onOpenPanel('institutional');
                  close();
                }}
              >
                🏛 Institutional
              </MenuItem>
              <MenuItem
                onClick={() => {
                  onOpenPanel('options');
                  close();
                }}
              >
                📊 Options Intel
              </MenuItem>
              <MenuItem
                onClick={() => {
                  onOpenPanel('community');
                  close();
                }}
              >
                📡 Community Signals
              </MenuItem>
            </div>
          )}

          {/* Layout submenu */}
          <SubmenuToggle
            label="Layout"
            icon="⊞"
            open={expandedSub === 'layout'}
            onClick={() => toggleSub('layout')}
            count={6}
          />
          {expandedSub === 'layout' && (
            <div className={s.layoutGrid}>
              {[
                { id: '1x1', label: 'Single', grid: [[1]] },
                { id: '2x1', label: '2 Col', grid: [[1, 1]] },
                { id: '1x2', label: '2 Row', grid: [[1], [1]] },
                { id: '3x1', label: '3 Col', grid: [[1, 1, 1]] },
                { id: '1x3', label: '3 Row', grid: [[1], [1], [1]] },
                {
                  id: '2x2',
                  label: 'Quad',
                  grid: [
                    [1, 1],
                    [1, 1],
                  ],
                },
              ].map((lo) => (
                <button
                  key={lo.id}
                  onClick={() => {
                    setLayoutMode(lo.id);
                    close();
                  }}
                  title={lo.label}
                  className={s.layoutBtn}
                  data-active={layoutMode === lo.id || undefined}
                >
                  {lo.grid.map((row, ri) => (
                    <div key={ri} className={s.layoutRow}>
                      {row.map((_, ci) => (
                        <div key={ci} className={s.layoutCell} data-active={layoutMode === lo.id || undefined} />
                      ))}
                    </div>
                  ))}
                </button>
              ))}
            </div>
          )}

          {/* ─── SETTINGS ─────────────────────────────── */}
          <div className="tf-chart-dropdown-sep" />
          <div className="tf-chart-dropdown-label">SETTINGS</div>
          <MenuItem
            onClick={() => {
              onOpenPanel('settings');
              close();
            }}
          >
            ⚙️ Chart Settings
          </MenuItem>
          <MenuItem
            onClick={() => {
              onOpenPanel('hotkeys');
              close();
            }}
          >
            ⌨️ Keyboard Shortcuts
          </MenuItem>
        </div>
      )}
    </div>
  );
}
