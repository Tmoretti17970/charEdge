// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — WorkspaceLayout
//
// Dockable multi-pane layout powered by flexlayout-react.
// Supports: drag-and-drop tabs, resizable splitters, layout presets,
// localStorage persistence, and per-pane chart independence.
//
// Decomposed: mini-panels in workspace/MiniPanels.jsx,
// presets in workspace/layoutPresets.js,
// theme in workspace/themeOverrides.js.
// ═══════════════════════════════════════════════════════════════════

// eslint-disable-next-line import/order
import React from 'react';
import { logger } from '@/observability/logger';
import { Layout, Model, Actions, DockLocation } from 'flexlayout-react';
import { useRef, useCallback, useEffect, useState } from 'react';
import 'flexlayout-react/style/dark.css';
import { C, F, M } from '../../constants.js';
import ChartPane from '../components/chart/core/ChartPane.jsx';
import { useNotificationLog } from '../../state/useNotificationLog.js';
import IndicatorPanel from '../components/panels/IndicatorPanel.jsx';
// eslint-disable-next-line import/order
import WatchlistPanel from '../components/panels/WatchlistPanel.jsx';

// Decomposed sub-modules
import { LAYOUT_PRESETS, loadLayout, saveLayout, STORAGE_KEY, chartTab } from './workspace/layoutPresets.js';
import { JournalMini, AnalyticsMini, InsightsPanelWrapper, ComparePanelWrapper } from './workspace/MiniPanels.jsx';
import THEME_OVERRIDES from './workspace/themeOverrides.js';

// Re-export presets for external consumers
export { LAYOUT_PRESETS };

// ─── Main Component ─────────────────────────────────────────────

function WorkspaceLayout({ preset = null }) {
  const layoutRef = useRef(null);
  const [showPresets, setShowPresets] = useState(false);

  // Initialize model once via useState initializer (guaranteed single-call)
  const [model] = useState(() => {
    const json = preset ? LAYOUT_PRESETS[preset]?.json || LAYOUT_PRESETS.default.json : loadLayout();
    return Model.fromJson(json);
  });

  // Save layout on every change
  const handleModelChange = useCallback((m) => {
    saveLayout(m);
  }, []);

  // Factory: render the right component for each tab type
  const factory = useCallback((node) => {
    const component = node.getComponent();
    const config = node.getConfig() || {};

    switch (component) {
      case 'chart':
        return (
          <ChartPane
            node={node}
            symbol={config.symbol || 'BTC'}
            tf={config.tf || '3m'}
            chartType={config.chartType || 'candles'}
          />
        );
      case 'watchlist':
        return <WatchlistPanel compact />;
      case 'alerts': {
        // Option B: workspace alerts slot opens the unified Notification Center (Alerts tab)
        const openAlerts = () => {
          const store = useNotificationLog.getState();
          if (!store.panelOpen) store.togglePanel();
        };
        return (
          <div
            style={{ padding: 16, textAlign: 'center', color: C.t3, fontFamily: F, cursor: 'pointer' }}
            onClick={openAlerts}
          >
            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.6 }}>🔔</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, marginBottom: 4 }}>Price Alerts</div>
            <div style={{ fontSize: 11, lineHeight: 1.5 }}>Click to open the Notification Center</div>
            <button
              className="tf-btn"
              onClick={(e) => { e.stopPropagation(); openAlerts(); }}
              style={{
                marginTop: 10, padding: '6px 16px', borderRadius: 6,
                background: C.b, color: '#fff', border: 'none',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >Open Alerts</button>
          </div>
        );
      }
      case 'indicators':
        return <IndicatorPanel />;
      case 'insights':
        return <InsightsPanelWrapper />;
      case 'compare':
        return <ComparePanelWrapper />;
      case 'journal-mini':
        return <JournalMini />;
      case 'analytics-mini':
        return <AnalyticsMini />;
      default:
        return <div style={{ padding: 16, color: C.t3, fontFamily: M }}>Unknown panel: {component}</div>;
    }
  }, []);

  // Add a new chart tab to the first available tabset
  const addChartTab = useCallback(
    (symbol = 'SPY', tf = '3m') => {
      const tabsets = [];
      model.visitNodes((n) => {
        if (n.getType() === 'tabset') tabsets.push(n);
      });
      if (tabsets.length > 0) {
        model.doAction(Actions.addNode(chartTab(symbol, tf), tabsets[0].getId(), DockLocation.CENTER, -1));
      }
    },
    [model],
  );

  // Apply a layout preset
  const applyPreset = useCallback((presetKey) => {
    const presetDef = LAYOUT_PRESETS[presetKey];
    if (!presetDef) return;
    try {
      const newModel = Model.fromJson(presetDef.json);
      saveLayout(newModel);
      window.location.reload(); // Simplest approach — layout presets are infrequent
    } catch (e) {
      logger.ui.warn('[WorkspaceLayout] Failed to apply preset:', e);
    }
  }, []);

  // Reset layout
  const resetLayout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) { /* storage may be blocked */ }
  }, []);

  // Close preset dropdown on outside click
  const presetDropdownRef = useRef(null);
  useEffect(() => {
    if (!showPresets) return;
    const handler = (e) => {
      if (presetDropdownRef.current && !presetDropdownRef.current.contains(e.target)) {
        setShowPresets(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPresets]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {/* Theme overrides */}
      <style>{THEME_OVERRIDES}</style>

      {/* ─── Workspace Toolbar ──────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          background: C.bg2,
          borderBottom: `1px solid ${C.bd}`,
          flexShrink: 0,
          minHeight: 30,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: C.t1, fontFamily: F }}>Workspace</span>

        {/* Layout Presets */}
        <div ref={presetDropdownRef} style={{ position: 'relative' }}>
          <button
            className="tf-btn"
            onClick={() => setShowPresets((v) => !v)}
            style={{
              background: 'transparent',
              color: C.t2,
              border: `1px solid ${C.bd}`,
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              fontFamily: M,
              cursor: 'pointer',
            }}
          >
            Layout ▾
          </button>
          {showPresets && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                zIndex: 9999,
                background: C.sf,
                border: `1px solid ${C.bd}`,
                borderRadius: 6,
                marginTop: 3,
                overflow: 'hidden',
                boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
                minWidth: 160,
              }}
              onMouseLeave={() => setShowPresets(false)}
            >
              {Object.entries(LAYOUT_PRESETS).map(([key, p]) => (
                <div
                  key={key}
                  onMouseDown={() => {
                    setShowPresets(false);
                    applyPreset(key);
                  }}
                  style={{
                    padding: '7px 12px',
                    cursor: 'pointer',
                    fontSize: 12,
                    color: C.t2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                  onMouseEnter={(e) => (e.target.style.background = C.sf2)}
                  onMouseLeave={(e) => (e.target.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{p.icon}</span>
                  <span>{p.label}</span>
                </div>
              ))}
              <div style={{ borderTop: `1px solid ${C.bd}`, marginTop: 2 }}>
                <div
                  onMouseDown={() => {
                    setShowPresets(false);
                    resetLayout();
                  }}
                  style={{
                    padding: '7px 12px',
                    cursor: 'pointer',
                    fontSize: 11,
                    color: C.r,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                  onMouseEnter={(e) => (e.target.style.background = C.sf2)}
                  onMouseLeave={(e) => (e.target.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>↺</span>
                  <span>Reset Layout</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Add Chart Button */}
        <button
          className="tf-btn"
          onClick={() => addChartTab()}
          style={{
            background: C.b + '15',
            color: C.b,
            border: `1px solid ${C.b}30`,
            borderRadius: 4,
            padding: '2px 10px',
            fontSize: 11,
            fontFamily: M,
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          + Chart
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 10, color: C.t3 }}>Drag tabs to rearrange · Drag edges to resize</span>
      </div>

      {/* ─── FlexLayout Container ──────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <Layout
          ref={layoutRef}
          model={model}
          factory={factory}
          onModelChange={handleModelChange}
          font={{ size: '12px', family: "'Outfit', sans-serif" }}
        />
      </div>
    </div>
  );
}

export default React.memo(WorkspaceLayout);
