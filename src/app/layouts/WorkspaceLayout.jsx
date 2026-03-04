// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — WorkspaceLayout
//
// Dockable multi-pane layout powered by flexlayout-react.
// Supports: drag-and-drop tabs, resizable splitters, layout presets,
// localStorage persistence, and per-pane chart independence.
//
// Components rendered via factory:
//   'chart'          → ChartPane (independent symbol/tf/data)
//   'watchlist'      → WatchlistPanel (compact mode)
//   'journal-mini'   → JournalMini (recent trades list)
//   'analytics-mini' → AnalyticsMini (key stats)
//
// Usage:
//   <WorkspaceLayout />
//   <WorkspaceLayout preset="2x2" />
// ═══════════════════════════════════════════════════════════════════

import { useRef, useCallback, useEffect, useState } from 'react';
import { logger } from '../../utils/logger.ts';
import { Layout, Model, Actions, DockLocation } from 'flexlayout-react';
import 'flexlayout-react/style/dark.css';
import { C, F, M } from '../../constants.js';
import ChartPane from '../components/chart/core/ChartPane.jsx';
import WatchlistPanel from '../components/panels/WatchlistPanel.jsx';
import AlertPanel from '../components/panels/AlertPanel.jsx';
import IndicatorPanel from '../components/panels/IndicatorPanel.jsx';
import InsightsPanel from '../components/panels/InsightsPanel.jsx';
import ComparePanel from '../components/panels/ComparePanel.jsx';

// ─── Lightweight mini-panels for workspace sidebar ──────────────

function JournalMini() {
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    let unsub = null;
    let mounted = true;

    import('../../state/useJournalStore.js').then(({ useJournalStore: useTradeStore }) => {
      if (!mounted) return;
      // Initial load
      setTrades(useTradeStore.getState().trades?.slice(-20) || []);
      // Subscribe to changes
      unsub = useTradeStore.subscribe((state) => {
        if (mounted) setTrades(state.trades?.slice(-20) || []);
      });
    });

    return () => {
      mounted = false;
      if (unsub) unsub();
    };
  }, []);

  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        padding: 8,
        fontFamily: F,
        background: C.bg,
        color: C.t2,
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600, color: C.t1, marginBottom: 8, fontSize: 13 }}>Recent Trades</div>
      {trades.length === 0 ? (
        <div style={{ color: C.t3, fontStyle: 'italic' }}>No trades yet</div>
      ) : (
        trades
          .slice()
          .reverse()
          .map((t, i) => (
            <div
              key={t.id || i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '5px 6px',
                borderBottom: `1px solid ${C.bd}`,
                fontSize: 11,
              }}
            >
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontFamily: M, fontWeight: 600, color: C.t1 }}>{t.symbol}</span>
                <span style={{ color: t.side === 'long' ? C.g : C.r, fontSize: 10 }}>
                  {t.side === 'long' ? '▲' : '▼'} {t.side}
                </span>
              </div>
              <span
                style={{
                  fontFamily: M,
                  color: (t.pnl || 0) >= 0 ? C.g : C.r,
                  fontWeight: 500,
                }}
              >
                {(t.pnl || 0) >= 0 ? '+' : ''}
                {(t.pnl || 0).toFixed(2)}
              </span>
            </div>
          ))
      )}
    </div>
  );
}

function AnalyticsMini() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let unsub = null;
    let mounted = true;

    import('../../state/useAnalyticsStore.js').then(({ useAnalyticsStore }) => {
      if (!mounted) return;
      setStats(useAnalyticsStore.getState().result);
      unsub = useAnalyticsStore.subscribe((state) => {
        if (mounted) setStats(state.result);
      });
    });

    return () => {
      mounted = false;
      if (unsub) unsub();
    };
  }, []);

  const d = stats;
  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        padding: 10,
        fontFamily: F,
        background: C.bg,
        color: C.t2,
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600, color: C.t1, marginBottom: 10, fontSize: 13 }}>Key Stats</div>
      {!d ? (
        <div style={{ color: C.t3, fontStyle: 'italic' }}>Run analytics first</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            ['Total P&L', d.totalPnl, true],
            ['Win Rate', d.winRate ? `${(d.winRate * 100).toFixed(1)}%` : '—'],
            ['Trades', d.totalTrades],
            ['Profit Factor', d.profitFactor?.toFixed(2)],
            ['Avg Win', d.avgWin, true],
            ['Avg Loss', d.avgLoss, true],
            ['Best', d.bestTrade, true],
            ['Worst', d.worstTrade, true],
          ].map(([label, val, isPnl], i) => (
            <div
              key={i}
              style={{
                background: C.sf,
                borderRadius: 6,
                padding: '6px 8px',
              }}
            >
              <div style={{ fontSize: 10, color: C.t3, marginBottom: 2 }}>{label}</div>
              <div
                style={{
                  fontFamily: M,
                  fontWeight: 600,
                  fontSize: 13,
                  color: isPnl ? ((val || 0) >= 0 ? C.g : C.r) : C.t1,
                }}
              >
                {isPnl ? `$${(val || 0).toFixed(2)}` : (val ?? '—')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InsightsPanelWrapper() {
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    let unsub = null;
    let mounted = true;

    import('../../state/useJournalStore.js').then(({ useJournalStore: useTradeStore }) => {
      if (!mounted) return;
      setTrades(useTradeStore.getState().trades || []);
      unsub = useTradeStore.subscribe((state) => {
        if (mounted) setTrades(state.trades || []);
      });
    });

    return () => {
      mounted = false;
      if (unsub) unsub();
    };
  }, []);

  return <InsightsPanel trades={trades} />;
}

function ComparePanelWrapper() {
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    let unsub = null;
    let mounted = true;

    import('../../state/useJournalStore.js').then(({ useJournalStore: useTradeStore }) => {
      if (!mounted) return;
      setTrades(useTradeStore.getState().trades || []);
      unsub = useTradeStore.subscribe((state) => {
        if (mounted) setTrades(state.trades || []);
      });
    });

    return () => {
      mounted = false;
      if (unsub) unsub();
    };
  }, []);

  return <ComparePanel trades={trades} />;
}

// ─── Layout Presets ─────────────────────────────────────────────

const GLOBAL_CONFIG = {
  tabEnableFloat: false,
  tabSetEnableMaximize: true,
  tabSetEnableClose: false,
  splitterSize: 4,
  tabSetHeaderHeight: 30,
  tabSetTabStripHeight: 30,
  borderBarSize: 0,
};

function chartTab(symbol, tf) {
  return {
    type: 'tab',
    name: `${symbol} · ${tf.toUpperCase()}`,
    component: 'chart',
    config: { symbol, tf },
  };
}

export const LAYOUT_PRESETS = {
  default: {
    label: 'Chart + Sidebar',
    icon: '◧',
    json: {
      global: GLOBAL_CONFIG,
      layout: {
        type: 'row',
        weight: 100,
        children: [
          {
            type: 'tabset',
            weight: 70,
            children: [chartTab('BTC', '3m')],
          },
          {
            type: 'column',
            weight: 30,
            children: [
              { type: 'tabset', weight: 50, children: [{ type: 'tab', name: 'Watchlist', component: 'watchlist' }] },
              { type: 'tabset', weight: 50, children: [{ type: 'tab', name: 'Journal', component: 'journal-mini' }] },
            ],
          },
        ],
      },
    },
  },
  single: {
    label: 'Single Chart',
    icon: '□',
    json: {
      global: GLOBAL_CONFIG,
      layout: {
        type: 'row',
        children: [{ type: 'tabset', children: [chartTab('BTC', '3m')] }],
      },
    },
  },
  '2x1': {
    label: '2 Charts',
    icon: '▥',
    json: {
      global: GLOBAL_CONFIG,
      layout: {
        type: 'row',
        children: [
          { type: 'tabset', weight: 50, children: [chartTab('BTC', '3m')] },
          { type: 'tabset', weight: 50, children: [chartTab('ETH', '3m')] },
        ],
      },
    },
  },
  '2x2': {
    label: '4 Charts',
    icon: '⊞',
    json: {
      global: GLOBAL_CONFIG,
      layout: {
        type: 'row',
        children: [
          {
            type: 'column',
            weight: 50,
            children: [
              { type: 'tabset', weight: 50, children: [chartTab('ES', '1d')] },
              { type: 'tabset', weight: 50, children: [chartTab('NQ', '1d')] },
            ],
          },
          {
            type: 'column',
            weight: 50,
            children: [
              { type: 'tabset', weight: 50, children: [chartTab('BTC', '1d')] },
              { type: 'tabset', weight: 50, children: [chartTab('SPY', '1d')] },
            ],
          },
        ],
      },
    },
  },
  '3x1': {
    label: '3 Charts',
    icon: '▤',
    json: {
      global: GLOBAL_CONFIG,
      layout: {
        type: 'row',
        children: [
          { type: 'tabset', weight: 33, children: [chartTab('ES', '1d')] },
          { type: 'tabset', weight: 34, children: [chartTab('NQ', '1d')] },
          { type: 'tabset', weight: 33, children: [chartTab('BTC', '1d')] },
        ],
      },
    },
  },
  journal: {
    label: 'Journal Focus',
    icon: '◨',
    json: {
      global: GLOBAL_CONFIG,
      layout: {
        type: 'row',
        children: [
          { type: 'tabset', weight: 55, children: [chartTab('BTC', '3m')] },
          {
            type: 'column',
            weight: 45,
            children: [
              { type: 'tabset', weight: 40, children: [{ type: 'tab', name: 'Journal', component: 'journal-mini' }] },
              {
                type: 'tabset',
                weight: 60,
                children: [{ type: 'tab', name: 'Analytics', component: 'analytics-mini' }],
              },
            ],
          },
        ],
      },
    },
  },
  insights: {
    label: 'Insights Focus',
    icon: '🔍',
    json: {
      global: GLOBAL_CONFIG,
      layout: {
        type: 'row',
        children: [
          { type: 'tabset', weight: 55, children: [chartTab('SPY', '1d')] },
          {
            type: 'column',
            weight: 45,
            children: [
              { type: 'tabset', weight: 50, children: [{ type: 'tab', name: 'AI Insights', component: 'insights' }] },
              {
                type: 'tabset',
                weight: 50,
                children: [
                  { type: 'tab', name: 'Journal', component: 'journal-mini' },
                  { type: 'tab', name: 'Alerts', component: 'alerts' },
                ],
              },
            ],
          },
        ],
      },
    },
  },
};

// ─── Storage Key ────────────────────────────────────────────────
const STORAGE_KEY = 'charEdge-workspace-layout';

function loadLayout() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const json = JSON.parse(saved);
      // Always force our global config to override stale saved values
      // (spread order: saved first, then ours wins)
      json.global = { ...(json.global || {}), ...GLOBAL_CONFIG };
      // Validate minimum structure before using
      if (json.layout && json.layout.type) return json;
    }
  } catch {
    /* corrupt data, use default */
  }
  return LAYOUT_PRESETS.default.json;
}

function saveLayout(model) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(model.toJson()));
  } catch {
    /* quota exceeded or private mode */
  }
}

// ─── Custom Theme Override ──────────────────────────────────────
// flexlayout-react ships a dark.css, but we need to match charEdge's palette.

const THEME_OVERRIDES = `
  .flexlayout__layout {
    --color-text: ${C.t1};
    --color-background: ${C.bg};
    --color-base: ${C.bg};
    --color-1: ${C.bg2};
    --color-2: ${C.sf};
    --color-3: ${C.sf2};
    --color-4: ${C.bd};
    --color-5: ${C.bd2};
    --color-6: ${C.t3};
    --color-drag1: ${C.b}40;
    --color-drag2: ${C.b}20;
    --color-drag1-background: ${C.b}15;
    --color-drag2-background: ${C.b}08;
    --color-tabset-background: ${C.bg2};
    --color-tabset-header-background: ${C.bg};
    --color-tabset-background-selected: ${C.bg};
    --font-family: ${F};
    --font-size: 12px;
  }
  .flexlayout__tab_button--selected {
    color: ${C.t1} !important;
    background: ${C.bg} !important;
  }
  .flexlayout__tab_button {
    color: ${C.t3} !important;
    font-family: ${F} !important;
    font-size: 12px !important;
  }
  .flexlayout__tab_button:hover {
    color: ${C.t2} !important;
    background: ${C.sf} !important;
  }
  .flexlayout__splitter {
    background: ${C.bd} !important;
  }
  .flexlayout__splitter:hover {
    background: ${C.b}50 !important;
  }
  .flexlayout__tabset-selected {
    border-bottom: 2px solid ${C.b} !important;
  }
  .flexlayout__tab {
    background: ${C.bg} !important;
    overflow: hidden !important;
  }
  .flexlayout__tabset_header {
    background: ${C.bg2} !important;
    border-bottom: 1px solid ${C.bd} !important;
  }
  .flexlayout__tabset_tabbar_outer {
    background: ${C.bg2} !important;
    border-bottom: 1px solid ${C.bd} !important;
  }
  .flexlayout__border_button {
    color: ${C.t3} !important;
  }
`;

// ─── Main Component ─────────────────────────────────────────────

export default function WorkspaceLayout({ preset = null }) {
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
      case 'alerts':
        return <AlertPanel compact />;
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
      // FlexLayout doesn't support model swaps, so we save and force a full remount
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
    } catch {}
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
