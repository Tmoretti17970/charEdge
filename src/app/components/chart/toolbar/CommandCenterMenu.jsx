// ═══════════════════════════════════════════════════════════════════
// charEdge — Command Center Menu (Apple-Tier Refactor)
//
// Tabbed glassmorphism modal replacing the flat ToolbarMoreMenu.
// Groups 30+ items into 5 categories with progressive disclosure.
// Uses existing tf-depth-overlay glass tokens for consistent styling.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { C, F } from '../../../../constants.js';
import { useChartStore } from '../../../../state/useChartStore.js';
import { useBacktestStore } from '../../../../state/useBacktestStore.js';
import { useStrategyBuilderStore } from '../../../../state/useStrategyBuilderStore.js';

import ChartTradeToolbar from '../chart_ui/ChartTradeToolbar.jsx';

// ─── Tab Definitions ──────────────────────────────────────────────
const TABS = [
    { id: 'trading', label: 'Trading', icon: '◎' },
    { id: 'strategy', label: 'Strategy & AI', icon: '✦' },
    { id: 'tools', label: 'Tools', icon: '⬡' },
    { id: 'overlays', label: 'Overlays', icon: '◇' },
    { id: 'panels', label: 'Panels', icon: '▤' },
];

// ─── Toggle Item ──────────────────────────────────────────────────
function ToggleItem({ label, active, onClick }) {
    return (
        <button
            className="tf-command-item"
            data-active={active || undefined}
            onClick={onClick}
        >
            <span className="tf-command-item-label">{label}</span>
            <span className="tf-command-toggle" data-on={active || undefined}>
                <span className="tf-command-toggle-dot" />
            </span>
        </button>
    );
}

// ─── Action Item ──────────────────────────────────────────────────
function ActionItem({ label, onClick, accent }) {
    return (
        <button
            className="tf-command-item"
            data-accent={accent || undefined}
            onClick={onClick}
        >
            <span className="tf-command-item-label">{label}</span>
            <span className="tf-command-item-arrow">→</span>
        </button>
    );
}

// ─── Layout Picker (Subtle Redesign) ──────────────────────────────
function LayoutPicker({ layoutMode, setLayoutMode, onClose }) {
    const layouts = [
        { id: '1x1', label: 'Single', grid: [[1]] },
        { id: '2x1', label: '2 Col', grid: [[1, 1]] },
        { id: '1x2', label: '2 Row', grid: [[1], [1]] },
        { id: '3x1', label: '3 Col', grid: [[1, 1, 1]] },
        { id: '1x3', label: '3 Row', grid: [[1], [1], [1]] },
        { id: '2x2', label: 'Quad', grid: [[1, 1], [1, 1]] },
    ];

    return (
        <div className="tf-command-layout-grid">
            {layouts.map(lo => {
                const isActive = layoutMode === lo.id;
                return (
                    <button
                        key={lo.id}
                        className="tf-command-layout-btn"
                        data-active={isActive || undefined}
                        onClick={() => { setLayoutMode(lo.id); onClose(); }}
                        title={lo.label}
                    >
                        {lo.grid.map((row, ri) => (
                            <div key={ri} className="tf-command-layout-row">
                                {row.map((_, ci) => (
                                    <div
                                        key={ci}
                                        className="tf-command-layout-cell"
                                        data-active={isActive || undefined}
                                    />
                                ))}
                            </div>
                        ))}
                    </button>
                );
            })}
        </div>
    );
}

// ─── Command Center Menu ──────────────────────────────────────────

export default function CommandCenterMenu({
    isMobile,
    showTrades, setShowTrades,
    showObjectTree, setShowObjectTree,
    onOpenPanel,
    onOpenCopilot,
    onToggleAnalysis,
    onSnapshot,
    layoutMode, setLayoutMode,
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('trading');
    const menuRef = useRef(null);

    // Chart Store State
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
    const toggleReplay = useChartStore((s) => s.toggleReplay);
    const replayMode = useChartStore((s) => s.replayMode);

    const backtestPanelOpen = useBacktestStore((s) => s.panelOpen);
    const strategyBuilderOpen = useStrategyBuilderStore((s) => s.panelOpen);

    // Click-outside
    useEffect(() => {
        if (!menuOpen) return;
        function handleClickOutside(e) {
            if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [menuOpen]);

    // Escape to close
    useEffect(() => {
        if (!menuOpen) return;
        function handleEscape(e) {
            if (e.key === 'Escape') { e.preventDefault(); setMenuOpen(false); }
        }
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [menuOpen]);

    const close = useCallback(() => setMenuOpen(false), []);

    // ─── Tab Content Renderers ────────────────────────────────────

    const renderTrading = () => (
        <>
            {!isMobile && (
                <div style={{ padding: '4px 4px 8px' }}>
                    <ChartTradeToolbar />
                </div>
            )}
            <ActionItem label="Position Sizer" onClick={() => { onOpenPanel('positionSizer'); close(); }} />
            <ActionItem label="Quick Journal" onClick={() => { onOpenPanel('quickJournal'); close(); }} />
        </>
    );

    const renderStrategy = () => (
        <>
            <ToggleItem
                label="Strategy Tester"
                active={backtestPanelOpen}
                onClick={() => { useBacktestStore.getState().togglePanel(); close(); }}
            />
            <ToggleItem
                label="Strategy Builder"
                active={strategyBuilderOpen}
                onClick={() => { useStrategyBuilderStore.getState().togglePanel(); close(); }}
            />
            <ActionItem label="AI Chart Analysis" onClick={() => { onToggleAnalysis && onToggleAnalysis(); close(); }} accent />
            <ActionItem label="AI Copilot" onClick={() => { onOpenCopilot && onOpenCopilot(); close(); }} accent />
        </>
    );

    const renderTools = () => (
        <>
            <ActionItem label="Watchlist" onClick={() => { onOpenPanel('watchlist'); close(); }} />
            <ActionItem label="Alerts" onClick={() => { onOpenPanel('alerts'); close(); }} />
            <ToggleItem label="Object Tree" active={showObjectTree} onClick={() => { setShowObjectTree(!showObjectTree); close(); }} />
            <ActionItem label={replayMode ? 'Exit Replay' : 'Bar Replay'} onClick={() => { toggleReplay(); close(); }} />
            <ActionItem label="Script Editor" onClick={() => { onOpenPanel('scripts'); close(); }} />
            <ActionItem label="AI Insights" onClick={() => { onOpenPanel('insights'); close(); }} />
            <ActionItem label="Annotations" onClick={() => { onOpenPanel('annotations'); close(); }} />
            <ActionItem label="Share Snapshot" onClick={() => { onSnapshot && onSnapshot(); close(); }} />
        </>
    );

    const renderOverlays = () => (
        <>
            <ToggleItem label="Compare Symbols" active={showComparisonOverlay} onClick={toggleComparisonOverlay} />
            <ToggleItem label="Liquidity Heatmap" active={showHeatmap} onClick={toggleHeatmap} />
            <ToggleItem label="Sessions" active={showSessions} onClick={toggleSessions} />
            <ToggleItem label="Extended Hours" active={showExtendedHours} onClick={toggleExtendedHours} />
            <ToggleItem label="Pattern Detection" active={showPatternOverlays} onClick={togglePatternOverlays} />
            {!isMobile && (
                <ToggleItem label="Show Trades" active={showTrades} onClick={() => setShowTrades(!showTrades)} />
            )}
            <ActionItem label="Volume Delta" onClick={() => { useChartStore.getState().addIndicator({ indicatorId: 'volumeDelta', params: {} }); close(); }} />
            <ActionItem label="Anchored VWAP" onClick={() => { useChartStore.getState().addIndicator({ indicatorId: 'vwap', params: { anchorTime: Date.now() } }); close(); }} />
            <ToggleItem label="Volume Spikes" active={useChartStore.getState().showVolumeSpikes} onClick={() => useChartStore.getState().toggleVolumeSpikes()} />
            <ToggleItem label="Delta Histogram" active={useChartStore.getState().showDeltaOverlay} onClick={() => useChartStore.getState().toggleDeltaOverlay()} />
            <ToggleItem label="Volume Profile" active={useChartStore.getState().showVPOverlay} onClick={() => useChartStore.getState().toggleVPOverlay()} />
            <ToggleItem label="Whale Trades" active={useChartStore.getState().showLargeTradesOverlay} onClick={() => useChartStore.getState().toggleLargeTradesOverlay()} />
            <ToggleItem label="OI Overlay" active={useChartStore.getState().showOIOverlay} onClick={() => useChartStore.getState().toggleOIOverlay()} />
            <ToggleItem label="Arb Spread" active={useChartStore.getState().showArbitrageSpread} onClick={() => useChartStore.getState().toggleArbitrageSpread()} />
        </>
    );

    const renderPanels = () => (
        <>
            <ToggleItem label="Multi-Timeframe" active={showMTF} onClick={toggleMTF} />
            <ToggleItem label="DOM Ladder" active={showDOM} onClick={toggleDOM} />
            <ToggleItem label="Depth Chart" active={showDepthChart} onClick={toggleDepthChart} />
            <ToggleItem label="Minimap" active={showMinimap} onClick={toggleMinimap} />
            <ToggleItem label="Status Bar" active={showStatusBar} onClick={toggleStatusBar} />
            <ToggleItem label="Data Window" active={showDataWindow} onClick={toggleDataWindow} />
            <ActionItem label="Order Flow" onClick={() => { onOpenPanel('orderflow'); close(); }} />
            <ActionItem label="Derivatives" onClick={() => { onOpenPanel('derivatives'); close(); }} />
            <ActionItem label="Order Book" onClick={() => { onOpenPanel('depth'); close(); }} />
            <ActionItem label="Institutional" onClick={() => { onOpenPanel('institutional'); close(); }} />
            <ActionItem label="Options Intel" onClick={() => { onOpenPanel('options'); close(); }} />
            <ActionItem label="Community Signals" onClick={() => { onOpenPanel('community'); close(); }} />
        </>
    );

    const TAB_RENDERERS = {
        trading: renderTrading,
        strategy: renderStrategy,
        tools: renderTools,
        overlays: renderOverlays,
        panels: renderPanels,
    };

    return (
        <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
                className="tf-chart-toolbar-btn"
                data-active={menuOpen || undefined}
                onClick={() => setMenuOpen(!menuOpen)}
                title="Command Center"
                aria-label="Command Center"
            >
                ≡
            </button>

            {menuOpen && (
                <div className="tf-command-center" role="dialog" aria-label="Command Center">
                    {/* ─── Tab Bar ──────────────────────────────── */}
                    <div className="tf-command-tabs">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                className="tf-command-tab"
                                data-active={activeTab === tab.id || undefined}
                                onClick={() => setActiveTab(tab.id)}
                                aria-label={tab.label}
                            >
                                <span className="tf-command-tab-icon">{tab.icon}</span>
                                <span className="tf-command-tab-label">{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* ─── Tab Content ──────────────────────────── */}
                    <div className="tf-command-content">
                        {TAB_RENDERERS[activeTab]?.()}
                    </div>

                    {/* ─── Footer: Layout + Settings ────────────── */}
                    <div className="tf-command-footer">
                        <div className="tf-command-footer-label">LAYOUT</div>
                        <LayoutPicker layoutMode={layoutMode} setLayoutMode={setLayoutMode} onClose={close} />

                        <div className="tf-command-footer-sep" />

                        <ActionItem label="Chart Settings" onClick={() => { onOpenPanel('settings'); close(); }} />
                        <ActionItem label="Keyboard Shortcuts" onClick={() => { onOpenPanel('hotkeys'); close(); }} />
                    </div>
                </div>
            )}
        </div>
    );
}
