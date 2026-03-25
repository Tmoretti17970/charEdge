// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — ChartPane
//
// Independent chart panel for the workspace layout system.
// Each pane manages its OWN:
//   - symbol, timeframe, chart type
//   - data (fetched via FetchService)
//   - indicators (local state, not global store)
//   - drawings (local state)
//
// Unlike ChartsPage which uses global useChartFeaturesStore, ChartPane is
// self-contained so multiple instances can coexist in a dockable layout.
//
// Props:
//   node  — flexlayout-react TabNode (provides resize events + tab name)
//   symbol — initial symbol
//   tf     — initial timeframe
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { fetchOHLC, warmCache } from '../../../../data/FetchService';
import { checkSymbolAlerts } from '../../../../state/useAlertStore';
import { useChartLinkStore, LINK_GROUP_COLORS, LINK_GROUPS } from '../../../../state/useChartLinkStore';
import { useJournalStore } from '../../../../state/useJournalStore';
import TemplateSelector from '../../../layouts/TemplateSelector.jsx';
import SymbolSearch from '../../ui/SymbolSearch.jsx';
import ChartCanvas from './ChartCanvas.jsx';
import s from './ChartPane.module.css';
import crosshairBus from '@/charting_library/utils/CrosshairBus';
import { TFS, CHART_TYPES } from '@/constants.js';
import { logger } from '@/observability/logger';
import { safeClone } from '@/shared/safeJSON';

const DEFAULT_INDICATORS = [];

/**
 * Independent chart pane for the workspace layout.
 *
 * @param {Object} props
 * @param {Object} [props.node] — flexlayout-react TabNode (optional, for tab name updates)
 * @param {string} [props.symbol='BTC'] — initial symbol
 * @param {string} [props.tf='3m'] — initial timeframe
 * @param {string} [props.chartType='candles'] — initial chart type
 */
export default function ChartPane({
  node,
  symbol: initSymbol = 'BTC',
  tf: initTf = '3m',
  chartType: initChartType = 'candles',
}) {
  // ─── Local State (per-pane, NOT global store) ──────────────
  const [symbol, setSymbol] = useState(initSymbol);
  const [tf, setTf] = useState(initTf);
  const [chartType, setChartType] = useState(initChartType);
  const [data, setData] = useState(null);
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataWarning, setDataWarning] = useState(null);
  const [indicators, setIndicators] = useState(DEFAULT_INDICATORS);
  const [drawings, setDrawings] = useState([]);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const chartRef = useRef(null);

  // C5.1: Crosshair sync — unique pane ID
  const paneIdRef = useRef(`pane-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  const [syncedTimestamp, setSyncedTimestamp] = useState(null);
  const [showLinkMenu, setShowLinkMenu] = useState(false);

  // Link group state
  const linkGroup = useChartLinkStore((s) => s.getLinkGroup(paneIdRef.current));
  const setLinkGroup = useChartLinkStore((s) => s.setLinkGroup);
  const broadcastSymbol = useChartLinkStore((s) => s.broadcastSymbol);
  const subscribeSymbol = useChartLinkStore((s) => s.subscribeSymbol);
  const removePaneLink = useChartLinkStore((s) => s.removePaneLink);

  // Subscribe to crosshair bus
  useEffect(() => {
    const paneId = paneIdRef.current;
    const unsub = crosshairBus.subscribe(paneId, (payload) => {
      setSyncedTimestamp(payload ? payload.timestamp : null);
    });
    return unsub;
  }, []);

  // Subscribe to symbol sync from linked charts
  useEffect(() => {
    const paneId = paneIdRef.current;
    const unsub = subscribeSymbol(paneId, (sym) => {
      setSymbol(sym.toUpperCase());
    });
    return () => {
      unsub();
      removePaneLink(paneId);
    };
  }, []); // eslint-disable-line

  // Emit crosshair position to bus
  const handleCrosshairMove = useCallback(({ timestamp, price }) => {
    crosshairBus.emit(paneIdRef.current, { timestamp, price });
  }, []);

  // Trade overlay — shared across panes (read-only from global store)
  const trades = useJournalStore((s) => s.trades);
  const matchingTrades = useMemo(() => {
    if (!trades?.length || !symbol) return [];
    const s = symbol.toUpperCase();
    return trades.filter((t) => (t.symbol || '').toUpperCase() === s);
  }, [trades, symbol]);

  // ─── Update Tab Name ──────────────────────────────────────
  useEffect(() => {
    if (!node) return;
    try {
      const model = node.getModel();
      if (model && model.doAction) {
        // Use flexlayout-react's Actions API for safe tab renaming
        // Import dynamically to avoid hard dependency at module level
        import('flexlayout-react')
          .then(({ Actions }) => {
            model.doAction(Actions.renameTab(node.getId(), `${symbol} · ${tf.toUpperCase()}`));
          })
          .catch(() => {
            // Fallback: set name attribute directly (older flexlayout versions)
            try {
              const tabNode = model.getNodeById(node.getId());
              if (tabNode && tabNode._setName) tabNode._setName(`${symbol} · ${tf.toUpperCase()}`);
            } catch {
              /* silently fail */
            }
          });
      }
    } catch {
      /* flexlayout may throw if node is being removed during layout change */
    }
  }, [symbol, tf, node]);

  // ─── Fetch Data ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDataWarning(null);

    fetchOHLC(symbol, tf)
      .then((result) => {
        if (cancelled) return;
        setData(result.data);
        setSource(result.source);
        setLoading(false);
        if (result.source === 'simulated') {
          setDataWarning(`Using simulated data for ${symbol}`);
        }
        // Check price alerts against latest candle close (deferred to avoid store update during render)
        if (result.data?.length > 0) {
          const lastClose = result.data[result.data.length - 1].close;
          if (lastClose != null) queueMicrotask(() => checkSymbolAlerts(symbol, lastClose));
        }
      })
      .catch((err) => {
        if (cancelled) return;
        logger.engine.warn('[ChartPane] fetchOHLC failed:', err?.message);
        setLoading(false);
        setDataWarning(`Failed to load data for ${symbol}`);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, tf]);

  // Warm adjacent timeframe caches when symbol changes
  useEffect(() => {
    warmCache(symbol, tf);
  }, [symbol]); // eslint-disable-line

  // ─── Handlers ─────────────────────────────────────────────
  const handleSymbolSelect = useCallback(
    (sym) => {
      const upper = sym.toUpperCase();
      setSymbol(upper);
      // Broadcast to linked charts
      const group = useChartLinkStore.getState().getLinkGroup(paneIdRef.current);
      if (group && group !== 'none') {
        broadcastSymbol(group, upper, paneIdRef.current);
      }
    },
    [broadcastSymbol],
  );

  const _handleAddIndicator = useCallback((preset) => {
    setIndicators((prev) => [...prev, { ...preset }]);
  }, []);

  const _handleRemoveIndicator = useCallback((idx) => {
    setIndicators((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const _handleUpdateIndicator = useCallback((idx, updates) => {
    setIndicators((prev) => prev.map((ind, i) => (i === idx ? { ...ind, ...updates } : ind)));
  }, []);

  const handleApplyTemplate = useCallback((tpl) => {
    setIndicators(safeClone(tpl.indicators || [], []));
    if (tpl.chartType) setChartType(tpl.chartType);
  }, []);

  const handleDrawingClick = useCallback((drawingData) => {
    setDrawings((prev) => [
      ...prev,
      {
        ...drawingData,
        id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        visible: true,
      },
    ]);
  }, []);

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className={s.root}>
      {/* ─── Mini Toolbar ─────────────────────────────────── */}
      <div className={s.toolbar}>
        {/* Link Group Dot */}
        <div className={s.linkWrap}>
          <button
            className={`tf-btn ${s.linkDotBtn}`}
            onClick={() => setShowLinkMenu((v) => !v)}
            title={`Link group: ${linkGroup}`}
            data-linked={linkGroup !== 'none' ? 'true' : undefined}
            style={linkGroup !== 'none' ? { '--link-color': LINK_GROUP_COLORS[linkGroup] } : undefined}
          >
            <span
              className={s.linkDotInner}
              style={linkGroup !== 'none' ? { '--link-dot-bg': LINK_GROUP_COLORS[linkGroup] } : undefined}
            />
          </button>
          {showLinkMenu && (
            <div className={s.linkMenu} onMouseLeave={() => setShowLinkMenu(false)}>
              {LINK_GROUPS.map((g) => (
                <button
                  key={g}
                  className={`tf-btn ${s.linkSwatch}`}
                  onClick={() => {
                    setLinkGroup(paneIdRef.current, g);
                    setShowLinkMenu(false);
                  }}
                  title={g === 'none' ? 'Independent' : `Link: ${g}`}
                  data-active={linkGroup === g ? 'true' : undefined}
                  style={{ '--swatch-bg': g === 'none' ? undefined : LINK_GROUP_COLORS[g] }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Symbol Search */}
        <SymbolSearch onSelect={handleSymbolSelect} currentSymbol={symbol} width={140} />

        {/* Timeframe buttons */}
        <div className={s.tfRow}>
          {TFS.map((t) => (
            <button
              className={`tf-btn ${s.tfBtn}`}
              key={t.id}
              onClick={() => setTf(t.id)}
              data-active={tf === t.id ? 'true' : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Chart Type Dropdown */}
        <div className={s.typeWrap}>
          <button className={`tf-btn ${s.typeBtn}`} onClick={() => setShowTypeMenu((v) => !v)}>
            {CHART_TYPES.find((ct) => ct.id === chartType)?.label || 'Candles'} ▾
          </button>
          {showTypeMenu && (
            <div className={s.typeMenu}>
              {CHART_TYPES.map((ct) => (
                <div
                  key={ct.id}
                  onMouseDown={() => {
                    setChartType(ct.id);
                    setShowTypeMenu(false);
                  }}
                  className={s.typeMenuItem}
                  data-active={chartType === ct.id ? 'true' : undefined}
                >
                  {ct.label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Source badge */}
        <div className={s.badgeRow}>
          {/* Template selector */}
          <TemplateSelector indicators={indicators} chartType={chartType} onApply={handleApplyTemplate} />
          {dataWarning && <span className={s.warningBadge}>⚠ {dataWarning}</span>}
          {source && !loading && (
            <span className={s.sourceBadge} data-simulated={source === 'simulated' ? 'true' : undefined}>
              {source}
            </span>
          )}
          {/* Indicator count badge */}
          {indicators.length > 0 && <span className={s.indBadge}>{indicators.length} ind</span>}
        </div>
      </div>

      {/* ─── Chart Area ───────────────────────────────────── */}
      <div className={s.chartArea}>
        {loading ? (
          <div className={s.loader}>
            <span className={s.spinner} />
            Loading {symbol}...
          </div>
        ) : data?.length > 0 ? (
          <ChartCanvas
            ref={chartRef}
            data={data}
            chartType={chartType}
            indicators={indicators}
            trades={matchingTrades}
            drawings={drawings}
            drawingsVisible={true}
            onDrawingClick={handleDrawingClick}
            syncedTimestamp={syncedTimestamp}
            onCrosshairMove={handleCrosshairMove}
          />
        ) : (
          <div className={s.noData}>No data available for {symbol}</div>
        )}
      </div>
    </div>
  );
}
