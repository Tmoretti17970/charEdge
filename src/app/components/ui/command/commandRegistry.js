// ═══════════════════════════════════════════════════════════════════
// charEdge — Command Registry
// Extracted from CommandPalette (Phase 0.1): all command definitions.
// ═══════════════════════════════════════════════════════════════════

import { useBacktestStore } from '../../../../state/useBacktestStore.js';
import { useLayoutStore } from '../../../../state/useLayoutStore';
import { useFocusStore } from '../../../../state/useFocusStore.js';
import { useStrategyBuilderStore } from '../../../../state/useStrategyBuilderStore';
import { useUIStore } from '../../../../state/useUIStore';
import { useUserStore } from '../../../../state/useUserStore';
import { useChartFeaturesStore } from '../../../../state/chart/useChartFeaturesStore';
import { useChartCoreStore } from '../../../../state/chart/useChartCoreStore';
import { useChartToolsStore } from '../../../../state/chart/useChartToolsStore';

// ─── Popular Symbols (for typeahead) ────────────────────────────

export const POPULAR_SYMBOLS = [
  { sym: 'BTC', name: 'Bitcoin', icon: '₿' },
  { sym: 'ETH', name: 'Ethereum', icon: 'Ξ' },
  { sym: 'SOL', name: 'Solana', icon: '◎' },
  { sym: 'AAPL', name: 'Apple', icon: '🍎' },
  { sym: 'TSLA', name: 'Tesla', icon: '⚡' },
  { sym: 'SPY', name: 'S&P 500', icon: '📊' },
  { sym: 'QQQ', name: 'Nasdaq 100', icon: '📈' },
  { sym: 'NQ', name: 'Nasdaq Fut.', icon: '📉' },
  { sym: 'ES', name: 'S&P Fut.', icon: '📉' },
  { sym: 'NVDA', name: 'NVIDIA', icon: '🟢' },
  { sym: 'AMZN', name: 'Amazon', icon: '📦' },
  { sym: 'MSFT', name: 'Microsoft', icon: '🪟' },
  { sym: 'GOOGL', name: 'Alphabet', icon: '🔍' },
  { sym: 'META', name: 'Meta', icon: '👤' },
  { sym: 'AMD', name: 'AMD', icon: '🔴' },
];

// ─── Command Registry ───────────────────────────────────────────

export function getCommands(actions) {
  const theme = useUserStore.getState().theme;
  const cs = useChartCoreStore.getState();
  const fs = useChartFeaturesStore.getState();

  return [
    // ─── NAVIGATION ──────────────────────────────────────────
    { id: 'nav-home', label: 'Go to Home', group: 'Navigate', shortcut: '1', icon: '🏠', action: () => actions.setPage('dashboard') },
    { id: 'nav-charts', label: 'Go to Charts', group: 'Navigate', shortcut: '2', icon: '📈', action: () => actions.setPage('charts') },
    { id: 'nav-settings', label: 'Open Settings', group: 'Navigate', shortcut: '3', icon: '⚙️', action: () => { useUIStore.getState().openSettings(); actions.close(); } },

    // ─── ACTIONS ─────────────────────────────────────────────
    { id: 'add-trade', label: 'Add New Trade', group: 'Actions', shortcut: 'Ctrl+N', icon: '➕', action: actions.addTrade },
    { id: 'import-csv', label: 'Import CSV', group: 'Actions', icon: '📥', action: actions.importCSV },
    { id: 'export-csv', label: 'Export Trades as CSV', group: 'Actions', icon: '📤', action: actions.exportCSV },
    { id: 'share-snapshot', label: 'Share Chart Snapshot', group: 'Actions', shortcut: 'Ctrl+S', icon: '📸', action: () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true })); actions.close(); } },

    // ─── APPEARANCE ──────────────────────────────────────────
    { id: 'toggle-theme', label: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode', group: 'Appearance', icon: theme === 'dark' ? '☀️' : '🌙', action: actions.toggleTheme },
    { id: 'toggle-zen', label: 'Toggle Zen Mode', group: 'Appearance', icon: '🧘', action: actions.toggleZen },
    { id: 'toggle-focus', label: 'Toggle Focus Mode', group: 'Appearance', shortcut: 'Ctrl+Shift+F', icon: '🎯', action: () => { useFocusStore.getState().toggleFocus(); actions.close(); } },

    // ─── CHART TYPES ─────────────────────────────────────────
    { id: 'chart-candles', label: 'Candle Chart', group: 'Chart Type', icon: '🕯️', action: () => actions.setChartType?.('candles') },
    { id: 'chart-line', label: 'Line Chart', group: 'Chart Type', icon: '📉', action: () => actions.setChartType?.('line') },
    { id: 'chart-area', label: 'Area Chart', group: 'Chart Type', icon: '📊', action: () => actions.setChartType?.('area') },
    { id: 'chart-ha', label: 'Heikin-Ashi', group: 'Chart Type', icon: '🔶', action: () => actions.setChartType?.('heikinashi') },
    { id: 'chart-hollow', label: 'Hollow Candles', group: 'Chart Type', icon: '◻️', action: () => actions.setChartType?.('hollow') },
    { id: 'chart-ohlc', label: 'OHLC Bars', group: 'Chart Type', icon: '📶', action: () => actions.setChartType?.('ohlc') },
    { id: 'chart-footprint', label: 'Footprint Chart', group: 'Chart Type', icon: '🦶', action: () => actions.setChartType?.('footprint') },
    { id: 'chart-renko', label: 'Renko', group: 'Chart Type', icon: '🧱', action: () => actions.setChartType?.('renko') },
    { id: 'chart-baseline', label: 'Baseline', group: 'Chart Type', icon: '📏', action: () => actions.setChartType?.('baseline') },

    // ─── DRAWING TOOLS ───────────────────────────────────────
    { id: 'draw-trendline', label: 'Trend Line', group: 'Drawing Tools', shortcut: 'T', icon: '📐', action: () => actions.setDrawingTool('trendline') },
    { id: 'draw-hline', label: 'Horizontal Line', group: 'Drawing Tools', shortcut: 'H', icon: '➖', action: () => actions.setDrawingTool('hline') },
    { id: 'draw-vline', label: 'Vertical Line', group: 'Drawing Tools', icon: '│', action: () => actions.setDrawingTool('vline') },
    { id: 'draw-ray', label: 'Ray', group: 'Drawing Tools', icon: '↗', action: () => actions.setDrawingTool('ray') },
    { id: 'draw-channel', label: 'Parallel Channel', group: 'Drawing Tools', icon: '═', action: () => actions.setDrawingTool('channel') },
    { id: 'draw-fib', label: 'Fibonacci Retracement', group: 'Drawing Tools', shortcut: 'F', icon: '🌀', action: () => actions.setDrawingTool('fib') },
    { id: 'draw-fibext', label: 'Fibonacci Extension', group: 'Drawing Tools', icon: '📏', action: () => actions.setDrawingTool('fibext') },
    { id: 'draw-gann', label: 'Gann Fan', group: 'Drawing Tools', shortcut: 'G', icon: '📐', action: () => actions.setDrawingTool('gann') },
    { id: 'draw-pitchfork', label: 'Pitchfork', group: 'Drawing Tools', shortcut: 'P', icon: '🔱', action: () => actions.setDrawingTool('pitchfork') },
    { id: 'draw-rect', label: 'Rectangle', group: 'Drawing Tools', icon: '⬜', action: () => actions.setDrawingTool('rect') },
    { id: 'draw-circle', label: 'Circle', group: 'Drawing Tools', icon: '⭕', action: () => actions.setDrawingTool('circle') },
    { id: 'draw-text', label: 'Text Note', group: 'Drawing Tools', icon: '💬', action: () => actions.setDrawingTool('text') },
    { id: 'draw-measure', label: 'Price/Range Measure', group: 'Drawing Tools', icon: '📏', action: () => actions.setDrawingTool('measure') },
    { id: 'draw-position', label: 'Long/Short Position', group: 'Drawing Tools', icon: '📊', action: () => actions.setDrawingTool('position') },
    { id: 'draw-magnet', label: cs.magnetMode ? 'Disable Magnet Mode' : 'Enable Magnet Mode', group: 'Drawing Tools', shortcut: 'N', icon: '🧲', action: () => { cs.toggleMagnetMode(); actions.close(); } },
    { id: 'draw-undo', label: 'Undo Drawing', group: 'Drawing Tools', shortcut: 'Ctrl+Z', icon: '↶', action: () => { cs.undoDrawing(); actions.close(); } },
    { id: 'draw-redo', label: 'Redo Drawing', group: 'Drawing Tools', shortcut: 'Ctrl+Y', icon: '↷', action: () => { cs.redoDrawing(); actions.close(); } },
    { id: 'draw-clear', label: 'Clear All Drawings', group: 'Drawing Tools', icon: '🗑️', action: () => { if (cs.drawings?.length > 0) { useChartToolsStore.setState({ drawingHistory: [...(cs.drawingHistory || []).slice(-49), cs.drawings], drawingFuture: [] }); cs.setDrawings?.([]); } actions.close(); } },

    // ─── OVERLAYS ────────────────────────────────────────────
    { id: 'ov-compare', label: fs.showComparisonOverlay ? 'Hide Symbol Comparison' : 'Compare Symbols', group: 'Overlays', icon: '⚖️', action: () => { fs.toggleComparisonOverlay(); actions.close(); } },
    { id: 'ov-heatmap', label: fs.showHeatmap ? 'Hide Liquidity Heatmap' : 'Show Liquidity Heatmap', group: 'Overlays', icon: '🔥', action: () => { fs.toggleHeatmap(); actions.close(); } },
    { id: 'ov-sessions', label: fs.showSessions ? 'Hide Sessions' : 'Show Sessions', group: 'Overlays', icon: '🕐', action: () => { fs.toggleSessions(); actions.close(); } },
    { id: 'ov-extended', label: fs.showExtendedHours ? 'Hide Extended Hours' : 'Show Extended Hours', group: 'Overlays', icon: '🌙', action: () => { fs.toggleExtendedHours(); actions.close(); } },
    { id: 'ov-patterns', label: fs.showPatternOverlays ? 'Hide Pattern Detection' : 'Show Pattern Detection', group: 'Overlays', icon: '🔍', action: () => { fs.togglePatternOverlays(); actions.close(); } },
    { id: 'ov-trades', label: cs.showTrades !== false ? 'Hide Trades on Chart' : 'Show Trades on Chart', group: 'Overlays', icon: '👁️', action: () => { window.dispatchEvent(new CustomEvent('tf:toggle-chart-trades')); actions.close(); } },
    { id: 'ov-voldelta', label: 'Add Volume Delta', group: 'Overlays', icon: '📊', action: () => { cs.addIndicator?.({ indicatorId: 'volumeDelta', params: {} }); actions.close(); } },
    { id: 'ov-vwap', label: 'Add Anchored VWAP', group: 'Overlays', icon: '📌', action: () => { cs.addIndicator?.({ indicatorId: 'vwap', params: { anchorTime: Date.now() } }); actions.close(); } },
    { id: 'ov-volspikes', label: 'Toggle Volume Spikes', group: 'Overlays', icon: '📡', action: () => { fs.toggleVolumeSpikes?.(); actions.close(); } },
    { id: 'ov-delta', label: 'Toggle Delta Histogram', group: 'Overlays', icon: '📊', action: () => { fs.toggleDeltaOverlay?.(); actions.close(); } },
    { id: 'ov-vp', label: 'Toggle Volume Profile', group: 'Overlays', icon: '📈', action: () => { fs.toggleVPOverlay?.(); actions.close(); } },
    { id: 'ov-whale', label: 'Toggle Whale Trades', group: 'Overlays', icon: '🐋', action: () => { fs.toggleLargeTradesOverlay?.(); actions.close(); } },
    { id: 'ov-oi', label: 'Toggle Open Interest Overlay', group: 'Overlays', icon: '📉', action: () => { fs.toggleOIOverlay?.(); actions.close(); } },
    { id: 'ov-arb', label: 'Toggle Arb Spread', group: 'Overlays', icon: '⚖️', action: () => { fs.toggleArbitrageSpread?.(); actions.close(); } },

    // ─── PANELS ──────────────────────────────────────────────
    { id: 'panel-indicators', label: 'Open Indicators', group: 'Panels', shortcut: 'I', icon: 'ƒx', action: () => { window.dispatchEvent(new CustomEvent('tf:toggle-indicators')); actions.close(); } },
    { id: 'panel-watchlist', label: 'Open Watchlist', group: 'Panels', icon: '★', action: () => { window.dispatchEvent(new CustomEvent('tf:open-panel', { detail: 'watchlist' })); actions.close(); } },
    { id: 'panel-alerts', label: 'Open Alerts', group: 'Panels', icon: '🔔', action: () => { window.dispatchEvent(new CustomEvent('tf:open-panel', { detail: 'alerts' })); actions.close(); } },
    { id: 'panel-objtree', label: 'Toggle Object Tree', group: 'Panels', icon: '🌳', action: () => { window.dispatchEvent(new CustomEvent('tf:toggle-object-tree')); actions.close(); } },
    { id: 'panel-replay', label: fs.replayMode ? 'Exit Bar Replay' : 'Start Bar Replay', group: 'Panels', icon: '⏪', action: () => { fs.toggleReplay(); actions.close(); } },
    { id: 'panel-scripts', label: 'Open Script Editor', group: 'Panels', icon: '⌨️', action: () => { window.dispatchEvent(new CustomEvent('tf:open-panel', { detail: 'scripts' })); actions.close(); } },
    { id: 'panel-annotations', label: 'Open Annotations', group: 'Panels', icon: '📝', action: () => { window.dispatchEvent(new CustomEvent('tf:open-panel', { detail: 'annotations' })); actions.close(); } },
    { id: 'panel-dom', label: fs.showDOM ? 'Hide DOM Ladder' : 'Show DOM Ladder', group: 'Panels', icon: '📋', action: () => { fs.toggleDOM(); actions.close(); } },
    { id: 'panel-depth', label: fs.showDepthChart ? 'Hide Depth Chart' : 'Show Depth Chart', group: 'Panels', icon: '📉', action: () => { fs.toggleDepthChart(); actions.close(); } },
    { id: 'panel-minimap', label: fs.showMinimap ? 'Hide Minimap' : 'Show Minimap', group: 'Panels', icon: '🗺️', action: () => { fs.toggleMinimap(); actions.close(); } },
    { id: 'panel-statusbar', label: fs.showStatusBar ? 'Hide Status Bar' : 'Show Status Bar', group: 'Panels', icon: '📊', action: () => { fs.toggleStatusBar(); actions.close(); } },
    { id: 'panel-orderflow', label: 'Open Order Flow', group: 'Panels', icon: '⚡', action: () => { window.dispatchEvent(new CustomEvent('tf:open-panel', { detail: 'orderflow' })); actions.close(); } },
    { id: 'panel-derivatives', label: 'Open Derivatives', group: 'Panels', icon: '📊', action: () => { window.dispatchEvent(new CustomEvent('tf:open-panel', { detail: 'derivatives' })); actions.close(); } },
    { id: 'panel-orderbook', label: 'Open Order Book', group: 'Panels', icon: '📖', action: () => { window.dispatchEvent(new CustomEvent('tf:open-panel', { detail: 'depth' })); actions.close(); } },
    { id: 'panel-institutional', label: 'Open Institutional Data', group: 'Panels', icon: '🏛️', action: () => { window.dispatchEvent(new CustomEvent('tf:open-panel', { detail: 'institutional' })); actions.close(); } },
    { id: 'panel-options', label: 'Open Options Intel', group: 'Panels', icon: '🎰', action: () => { window.dispatchEvent(new CustomEvent('tf:open-panel', { detail: 'options' })); actions.close(); } },
    { id: 'panel-community', label: 'Open Community Signals', group: 'Panels', icon: '📡', action: () => { window.dispatchEvent(new CustomEvent('tf:open-panel', { detail: 'community' })); actions.close(); } },

    // ─── STRATEGY & AI ───────────────────────────────────────
    { id: 'strat-backtest', label: 'Strategy Tester', group: 'Strategy & AI', icon: '🧪', action: () => { useBacktestStore.getState().togglePanel(); actions.close(); } },
    { id: 'strat-builder', label: 'Strategy Builder', group: 'Strategy & AI', icon: '📐', action: () => { useStrategyBuilderStore.getState().togglePanel(); actions.close(); } },
    { id: 'strat-analysis', label: 'AI Chart Analysis', group: 'Strategy & AI', icon: '🔍', action: () => { window.dispatchEvent(new CustomEvent('tf:toggle-analysis')); actions.close(); } },
    { id: 'strat-copilot', label: 'AI Copilot', group: 'Strategy & AI', icon: '✨', action: () => { window.dispatchEvent(new CustomEvent('tf:open-copilot')); actions.close(); } },
    { id: 'strat-insights', label: 'AI Insights', group: 'Strategy & AI', icon: '🧠', action: () => { window.dispatchEvent(new CustomEvent('tf:open-panel', { detail: 'insights' })); actions.close(); } },

    // ─── TRADING ─────────────────────────────────────────────
    { id: 'trade-positionsizer', label: 'Position Sizer', group: 'Trading', icon: '⚖️', action: () => { useLayoutStore.getState().togglePanel('positionSizer'); actions.close(); } },
    { id: 'trade-quickjournal', label: 'Quick Journal Entry', group: 'Trading', icon: '📝', action: () => { useChartFeaturesStore.getState().toggleQuickJournal(); actions.close(); } },

    // ─── LAYOUT ──────────────────────────────────────────────
    { id: 'layout-single', label: 'Single Chart Layout', group: 'Layout', icon: '⬜', action: () => { window.dispatchEvent(new CustomEvent('tf:set-layout', { detail: '1x1' })); actions.close(); } },
    { id: 'layout-2col', label: '2-Column Layout', group: 'Layout', icon: '▫▫', action: () => { window.dispatchEvent(new CustomEvent('tf:set-layout', { detail: '2x1' })); actions.close(); } },
    { id: 'layout-2row', label: '2-Row Layout', group: 'Layout', icon: '🔲', action: () => { window.dispatchEvent(new CustomEvent('tf:set-layout', { detail: '1x2' })); actions.close(); } },
    { id: 'layout-quad', label: 'Quad Layout', group: 'Layout', icon: '⊞', action: () => { window.dispatchEvent(new CustomEvent('tf:set-layout', { detail: '2x2' })); actions.close(); } },

    // ─── ANALYTICS VIEWS ────────────────────────────────────
    { id: 'view-strategies', label: 'Strategies Analysis', group: 'Analytics Views', icon: '🎯', action: () => { actions.setPage('dashboard'); setTimeout(() => window.dispatchEvent(new CustomEvent('charEdge:journal-tab', { detail: 'strategies' })), 100); } },
    { id: 'view-psychology', label: 'Psychology Analysis', group: 'Analytics Views', icon: '🧠', action: () => { actions.setPage('dashboard'); setTimeout(() => window.dispatchEvent(new CustomEvent('charEdge:journal-tab', { detail: 'psychology' })), 100); } },
    { id: 'view-timing', label: 'Timing Analysis', group: 'Analytics Views', icon: '⏱️', action: () => { actions.setPage('dashboard'); setTimeout(() => window.dispatchEvent(new CustomEvent('charEdge:journal-tab', { detail: 'timing' })), 100); } },
    { id: 'view-risk', label: 'Risk Analysis', group: 'Analytics Views', icon: '🛡️', action: () => { actions.setPage('dashboard'); setTimeout(() => window.dispatchEvent(new CustomEvent('charEdge:journal-tab', { detail: 'risk' })), 100); } },
    { id: 'view-playbooks', label: 'Playbooks', group: 'Analytics Views', icon: '📚', action: () => { actions.setPage('dashboard'); setTimeout(() => window.dispatchEvent(new CustomEvent('charEdge:journal-tab', { detail: 'playbooks' })), 100); } },
    { id: 'view-notes', label: 'Notes', group: 'Analytics Views', icon: '📓', action: () => { actions.setPage('dashboard'); setTimeout(() => window.dispatchEvent(new CustomEvent('charEdge:journal-tab', { detail: 'notes' })), 100); } },

    // ─── CHART SETTINGS ──────────────────────────────────────
    { id: 'settings-chart', label: 'Chart Settings', group: 'Settings', icon: '⚙️', action: () => { window.dispatchEvent(new CustomEvent('tf:open-panel', { detail: 'settings' })); actions.close(); } },
    { id: 'settings-shortcuts', label: 'Keyboard Shortcuts', group: 'Settings', shortcut: '?', icon: '⌨️', action: () => { useUIStore.getState().toggleShortcuts(); actions.close(); } },
  ];
}
