// ═══════════════════════════════════════════════════════════════════
// charEdge — Command Center Menu (Apple-Tier Refactor)
//
// Tabbed glassmorphism modal replacing the flat ToolbarMoreMenu.
// Groups 30+ items into 5 categories with progressive disclosure.
// Uses existing tf-depth-overlay glass tokens for consistent styling.
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from 'react';
import { useBacktestStore } from '../../../../state/useBacktestStore.js';
import { useStrategyBuilderStore } from '../../../../state/useStrategyBuilderStore';
import ChartTradeToolbar from '../chart_ui/ChartTradeToolbar.jsx';
import { useChartToolsStore } from '../../../../state/chart/useChartToolsStore';
import { useChartFeaturesStore } from '../../../../state/chart/useChartFeaturesStore';

// ─── Tab Definitions ──────────────────────────────────────────────
const TABS = [
    { id: 'trading', label: 'Trading', icon: '◎' },
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
    onSnapshot,
    layoutMode, setLayoutMode,
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('trading');
    const menuRef = useRef(null);

    // Features Store — must use useChartFeaturesStore (not useChartStore)
    // to match ChartEngineWidget which reads from the focused store
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
    const toggleReplay = useChartFeaturesStore((s) => s.toggleReplay);
    const replayMode = useChartFeaturesStore((s) => s.replayMode);

    // Order-flow overlay reactive selectors
    const showVolumeSpikes = useChartFeaturesStore((s) => s.showVolumeSpikes);
    const toggleVolumeSpikes = useChartFeaturesStore((s) => s.toggleVolumeSpikes);
    const showDeltaOverlay = useChartFeaturesStore((s) => s.showDeltaOverlay);
    const toggleDeltaOverlay = useChartFeaturesStore((s) => s.toggleDeltaOverlay);
    const showVPOverlay = useChartFeaturesStore((s) => s.showVPOverlay);
    const toggleVPOverlay = useChartFeaturesStore((s) => s.toggleVPOverlay);
    const showLargeTradesOverlay = useChartFeaturesStore((s) => s.showLargeTradesOverlay);
    const toggleLargeTradesOverlay = useChartFeaturesStore((s) => s.toggleLargeTradesOverlay);
    const showOIOverlay = useChartFeaturesStore((s) => s.showOIOverlay);
    const toggleOIOverlay = useChartFeaturesStore((s) => s.toggleOIOverlay);
    const showArbitrageSpread = useChartFeaturesStore((s) => s.showArbitrageSpread);
    const toggleArbitrageSpread = useChartFeaturesStore((s) => s.toggleArbitrageSpread);

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
            {!isMobile && (
                <ToggleItem label="Show Trades" active={showTrades} onClick={() => setShowTrades(!showTrades)} />
            )}
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
        </>
    );



    const renderTools = () => (
        <>
            <ActionItem label="Watchlist" onClick={() => { onOpenPanel('watchlist'); close(); }} />
            <ActionItem label="Alerts" onClick={() => { onOpenPanel('alerts'); close(); }} />
            <ToggleItem label="Object Tree" active={showObjectTree} onClick={() => { setShowObjectTree(!showObjectTree); close(); }} />
            <ActionItem label={replayMode ? 'Exit Replay' : 'Bar Replay'} onClick={() => { toggleReplay(); close(); }} />
            <ActionItem label="Script Editor" onClick={() => { onOpenPanel('scripts'); close(); }} />
            <ActionItem label="Annotations" onClick={() => { onOpenPanel('annotations'); close(); }} />
            <ActionItem label="Share Snapshot" onClick={() => { onSnapshot && onSnapshot(); close(); }} />
        </>
    );

    const renderOverlays = () => (
        <>
            <ToggleItem label="Compare Symbols" active={showComparisonOverlay} onClick={() => { toggleComparisonOverlay(); close(); }} />
            <ToggleItem label="Liquidity Heatmap" active={showHeatmap} onClick={toggleHeatmap} />
            <ToggleItem label="Sessions" active={showSessions} onClick={toggleSessions} />
            <ToggleItem label="Extended Hours" active={showExtendedHours} onClick={toggleExtendedHours} />
            <ToggleItem label="Pattern Detection" active={showPatternOverlays} onClick={togglePatternOverlays} />

            <ActionItem label="Volume Delta" onClick={() => { useChartToolsStore.getState().addIndicator({ indicatorId: 'volumeDelta', params: {} }); close(); }} />
            <ActionItem label="Anchored VWAP" onClick={() => { useChartToolsStore.getState().addIndicator({ indicatorId: 'vwap', params: { anchorTime: Date.now() } }); close(); }} />
            <ToggleItem label="Volume Spikes" active={showVolumeSpikes} onClick={toggleVolumeSpikes} />
            <ToggleItem label="Delta Histogram" active={showDeltaOverlay} onClick={toggleDeltaOverlay} />
            <ToggleItem label="Volume Profile" active={showVPOverlay} onClick={toggleVPOverlay} />
            <ToggleItem label="Whale Trades" active={showLargeTradesOverlay} onClick={toggleLargeTradesOverlay} />
            <ToggleItem label="OI Overlay" active={showOIOverlay} onClick={toggleOIOverlay} />
            <ToggleItem label="Arb Spread" active={showArbitrageSpread} onClick={toggleArbitrageSpread} />
        </>
    );

    const renderPanels = () => (
        <>

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
