// ═══════════════════════════════════════════════════════════════════
// charEdge — Spotlight Logbook v2.0 (⌘K Trade Modal)
//
// Full-featured, modal-driven trade logbook with:
//   - Liquid Glass material (Apple 2026 aesthetic)
//   - Search-first interface (symbol, strategy, date)
//   - Sortable column headers
//   - Side / Date Range / Asset Class filter pills
//   - Expandable trade detail rows with full action set
//   - Bulk selection mode (select, tag, edit, delete, export)
//   - AI Grades toggle
//   - Context Performance slide-out
//   - Sparkline tooltips on row hover
//   - CSV export with ⌘E
//   - Stateful memory (60s scroll position recall)
// ═══════════════════════════════════════════════════════════════════

import { useVirtualizer } from '@tanstack/react-virtual';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { fmtD } from '../../../utils.js';
import { useBulkSelection, BulkActionBar } from '../../features/journal/journal_ui/BulkOperations.jsx';
import ContextPerformanceTab from '../../features/journal/journal_ui/ContextPerformanceTab.jsx';
import Sparkline from './Sparkline.jsx';
import css from './SpotlightLogbook.module.css';
import { sanitizeStrategy, getAssetIcon } from '@/trading/tradeSanitizer.js';

// ─── Scroll memory (60s retention) ───────────────────────────────
let _savedScrollTop = 0;
let _savedScrollTime = 0;
const MEMORY_TTL = 60_000;

// ─── AI Grade helper ─────────────────────────────────────────────
function gradeTrade(t) {
  let score = 2;
  if (t.playbook) score += 1;
  if (t.notes && t.notes.length > 10) score += 0.5;
  if (t.emotion) score += 0.5;
  if ((t.pnl || 0) > 0) score += 0.5;
  score = Math.min(5, Math.max(1, Math.round(score)));
  const grades = ['F', 'D', 'C', 'B', 'A'];
  return { score, grade: grades[score - 1] };
}

// ─── Sparkline data builder ──────────────────────────────────────
function buildSparklineData(trade, allTrades) {
  const symbolTrades = allTrades
    .filter((t) => t.symbol === trade.symbol && t.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (symbolTrades.length < 2) return null;
  let cum = 0;
  return symbolTrades.map((t) => {
    cum += t.pnl || 0;
    return cum;
  });
}

// ─── Column definitions ─────────────────────────────────────────
const COLUMNS = [
  { id: 'date', label: 'Date', sortable: true },
  { id: 'icon', label: '', sortable: false },
  { id: 'symbol', label: 'Symbol', sortable: true },
  { id: 'side', label: 'Side', sortable: true },
  { id: 'playbook', label: 'Strategy', sortable: true },
  { id: 'emotion', label: '', sortable: true },
  { id: 'pnl', label: 'P&L', sortable: true, align: 'right' },
];

// ─── Date Range Presets ──────────────────────────────────────────
const DATE_RANGES = [
  { id: 'all', label: 'All' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
];

function getDateCutoff(rangeId) {
  const now = new Date();
  switch (rangeId) {
    case '7d':
      return new Date(now - 7 * 86400000);
    case '30d':
      return new Date(now - 30 * 86400000);
    case '90d':
      return new Date(now - 90 * 86400000);
    default:
      return null;
  }
}

// ─── Emotion color-dot encoding ──────────────────────────────────
const EMOTION_COLORS = {
  Calm: '#31D158',
  Confident: '#22d3ee',
  Focused: '#c084fc',
  Neutral: '#4e5266',
  Uncertain: '#f0b64e',
  Anxious: '#e8642c',
  Frustrated: '#FF453A',
  Tired: '#8b8fa2',
};

// ─── Behavioral leak-tag pill colors ─────────────────────────────
const LEAK_TAG_COLORS = {
  REVENGE_TRADE: { bg: '#FF453A20', color: '#FF453A', label: 'REVENGE' },
  FOMO_ENTRY: { bg: '#e8642c20', color: '#e8642c', label: 'FOMO' },
  OVERSIZED: { bg: '#f0b64e20', color: '#f0b64e', label: 'OVERSIZE' },
  EARLY_EXIT_FEAR: { bg: '#f0b64e20', color: '#f0b64e', label: 'EARLY EXIT' },
  HOPE_TRADING: { bg: '#FF453A20', color: '#FF453A', label: 'HOPE' },
  PERFECT_EXECUTION: { bg: '#31D15820', color: '#31D158', label: 'PERFECT' },
};

// ═══════════════════════════════════════════════════════════════════
// EXPANDED ROW DETAIL
// ═══════════════════════════════════════════════════════════════════

function fmtDuration(mins) {
  if (mins == null || mins <= 0) return '—';
  const h = Math.floor(mins / 60),
    m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function TradeDetail({ trade: t, onClose }) {
  const detailStyle = { fontSize: 11, color: C.t2, fontFamily: M };
  const labelStyle = {
    fontSize: 9,
    fontWeight: 700,
    color: C.t3,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 2,
  };

  const handleEdit = () => window.dispatchEvent(new CustomEvent('charEdge:edit-trade', { detail: t }));
  const handleDelete = () => window.dispatchEvent(new CustomEvent('charEdge:delete-confirm', { detail: t.id }));
  const handleViewOnChart = () => {
    window.dispatchEvent(new CustomEvent('charEdge:view-trade-on-chart', { detail: t }));
    onClose();
  };
  const handleReplay = () => {
    window.dispatchEvent(new CustomEvent('charEdge:replay-trade', { detail: t }));
    onClose();
  };

  return (
    <div className={css.detailPanel} style={{ borderTop: `1px solid ${C.bd}30` }}>
      {/* Detail Grid */}
      <div className={css.detailGrid}>
        <div>
          <div style={labelStyle}>Entry</div>
          <div style={detailStyle}>{t.entry || '—'}</div>
        </div>
        <div>
          <div style={labelStyle}>Exit</div>
          <div style={detailStyle}>{t.exit || '—'}</div>
        </div>
        <div>
          <div style={labelStyle}>Stop Loss</div>
          <div style={detailStyle}>{t.stopLoss || '—'}</div>
        </div>
        <div>
          <div style={labelStyle}>Size</div>
          <div style={detailStyle}>{t.size || t.qty || '—'}</div>
        </div>
        <div>
          <div style={labelStyle}>R-Multiple</div>
          <div style={{ ...detailStyle, color: t.rMultiple > 0 ? C.g : t.rMultiple < 0 ? C.r : C.t2 }}>
            {t.rMultiple != null ? `${t.rMultiple >= 0 ? '+' : ''}${t.rMultiple}R` : '—'}
          </div>
        </div>
        <div>
          <div style={labelStyle}>Duration</div>
          <div style={detailStyle}>{fmtDuration(t.duration)}</div>
        </div>
        <div>
          <div style={labelStyle}>Emotion</div>
          <div style={detailStyle}>{t.emotion || '—'}</div>
        </div>
        <div>
          <div style={labelStyle}>Fees</div>
          <div style={detailStyle}>{t.fees ? `$${t.fees.toFixed(2)}` : '—'}</div>
        </div>
      </div>

      {/* Notes */}
      {t.notes && (
        <div
          style={{
            marginTop: 8,
            padding: '8px 12px',
            background: C.sf,
            borderRadius: 8,
            fontSize: 11,
            color: C.t2,
            lineHeight: 1.5,
          }}
        >
          {t.notes}
        </div>
      )}

      {/* Chart Screenshots */}
      {t.screenshots?.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: C.t3,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 6,
              fontFamily: M,
            }}
          >
            📸 Chart Snapshot ({t.screenshots.length})
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {t.screenshots.map((shot, i) => (
              <a
                key={i}
                href={shot.data}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  width: 140,
                  height: 90,
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: `1px solid ${C.bd}`,
                  cursor: 'zoom-in',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.03)';
                  e.currentTarget.style.boxShadow = `0 4px 16px rgba(0,0,0,0.3)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <img
                  src={shot.data}
                  alt={shot.name || `Chart snapshot ${i + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className={css.detailActions}>
        <button className={css.detailBtn} onClick={handleEdit} style={{ color: C.b }}>
          ✏️ Edit
        </button>
        <button className={css.detailBtn} onClick={handleViewOnChart} style={{ color: C.t2 }}>
          📊 View on Chart
        </button>
        <button className={css.detailBtn} onClick={handleReplay} style={{ color: C.t2 }}>
          ▶ Replay
        </button>
        <div style={{ flex: 1 }} />
        <button className={css.detailBtn} onClick={handleDelete} style={{ color: C.r }}>
          🗑 Delete
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VIRTUALIZED TRADE LIST
// ═══════════════════════════════════════════════════════════════════

function VirtualTradeList({
  trades,
  sortedTrades,
  scrollRef,
  density,
  expandedId,
  setExpandedId,
  hoveredId,
  setHoveredId,
  bulkMode,
  bulk,
  showAIGrades,
  handleClose,
}) {
  const virtualizer = useVirtualizer({
    count: trades.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => (density === 'compact' ? 32 : 40),
    overscan: 8,
  });

  return (
    <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
      {virtualizer.getVirtualItems().map((vi) => {
        const t = trades[vi.index];
        return (
          <div
            key={t.id}
            ref={virtualizer.measureElement}
            data-index={vi.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${vi.start}px)`,
            }}
          >
            <div
              className={`${css.tradeRow} ${expandedId === t.id ? css.tradeRowExpanded : ''}`}
              data-density={density}
              onMouseEnter={() => setHoveredId(t.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
              style={{
                borderLeft: expandedId === t.id ? `3px solid ${C.b}` : '3px solid transparent',
                background: bulk.isSelected(t.id) ? C.b + '08' : expandedId === t.id ? C.sf : undefined,
              }}
            >
              {/* Bulk Checkbox */}
              {bulkMode && (
                <div
                  className={css.checkCol}
                  onClick={(e) => {
                    e.stopPropagation();
                    bulk.toggle(t.id);
                  }}
                >
                  <div
                    className={css.checkbox}
                    style={{
                      border: `2px solid ${bulk.isSelected(t.id) ? C.b : C.bd}`,
                      background: bulk.isSelected(t.id) ? C.b : 'transparent',
                    }}
                  >
                    {bulk.isSelected(t.id) && <span style={{ color: '#fff', fontSize: 9, fontWeight: 800 }}>✓</span>}
                  </div>
                </div>
              )}

              {/* Date + Session Tag */}
              <span className={css.tradeDate} style={{ fontFamily: M, color: C.t3 }}>
                {fmtDate(t.date)}
                {t.sessionTag && <span style={{ fontSize: 8, opacity: 0.5, marginLeft: 4 }}>{t.sessionTag}</span>}
              </span>

              {/* Asset icon */}
              <span className={css.tradeIcon}>{getAssetIcon(t.symbol)}</span>

              {/* Symbol + AI Grade */}
              <div className={css.tradeSymbol} style={{ color: C.t1 }}>
                {t.symbol || '—'}
                {showAIGrades &&
                  (() => {
                    const g = gradeTrade(t);
                    return (
                      <span
                        className={css.aiBadge}
                        style={{
                          background:
                            g.score >= 4
                              ? C.g + '15'
                              : g.score >= 3
                                ? C.b + '15'
                                : g.score >= 2
                                  ? C.y + '15'
                                  : C.r + '15',
                          color: g.score >= 4 ? C.g : g.score >= 3 ? C.b : g.score >= 2 ? C.y : C.r,
                        }}
                      >
                        {g.grade}
                      </span>
                    );
                  })()}
              </div>

              {/* Side */}
              <span
                className={css.tradeSide}
                style={{
                  color: t.side === 'long' ? C.g : C.r,
                  background: (t.side === 'long' ? C.g : C.r) + '15',
                }}
              >
                {t.side || '—'}
              </span>

              {/* Strategy + Leak Pills */}
              <span
                className={css.tradeStrategy}
                style={{ fontFamily: F, color: C.t2, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                {sanitizeStrategy(t.playbook || t.strategy)}
                {t.tags
                  ?.filter((tag) => LEAK_TAG_COLORS[tag])
                  .map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        fontFamily: M,
                        padding: '1px 5px',
                        borderRadius: 3,
                        background: LEAK_TAG_COLORS[tag].bg,
                        color: LEAK_TAG_COLORS[tag].color,
                        letterSpacing: '0.02em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {LEAK_TAG_COLORS[tag].label}
                    </span>
                  ))}
              </span>

              {/* Emotion — compressed to color dot */}
              <span
                className={css.emotionDot}
                style={{ background: EMOTION_COLORS[t.emotion] || C.t3 + '30' }}
                title={t.emotion || 'None'}
              />

              {/* P&L */}
              <span className={css.tradePnl} style={{ fontFamily: M, color: (t.pnl || 0) >= 0 ? C.g : C.r }}>
                {fmtD(t.pnl)}
              </span>

              {/* Sparkline tooltip on hover */}
              {hoveredId === t.id &&
                expandedId !== t.id &&
                (() => {
                  const sparkData = buildSparklineData(t, sortedTrades);
                  if (!sparkData) return null;
                  return (
                    <div className={css.sparklineTooltip}>
                      <div className={css.sparklineLabel} style={{ fontFamily: M, color: C.t3 }}>
                        {t.symbol} Equity
                      </div>
                      <Sparkline data={sparkData} width={100} height={32} />
                    </div>
                  );
                })()}
            </div>

            {/* Expanded Detail */}
            {expandedId === t.id && <TradeDetail trade={t} onClose={handleClose} />}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

function SpotlightLogbook({ isOpen, onClose, filterDate = null }) {
  const [query, setQuery] = useState('');
  const [hoveredId, setHoveredId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [density, setDensity] = useState('comfortable');
  const [sideFilter, setSideFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [showAIGrades, setShowAIGrades] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [showContextPerf, setShowContextPerf] = useState(false);
  const [_showFilters, _setShowFilters] = useState(false);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const trades = useJournalStore((s) => s.trades);

  // ─── Sorted trades ──────────────────────────────────────────
  const sortedTrades = useMemo(() => {
    if (!trades?.length) return [];
    const sorted = [...trades];
    sorted.sort((a, b) => {
      let va, vb;
      switch (sortCol) {
        case 'date':
          va = new Date(a.date || 0);
          vb = new Date(b.date || 0);
          break;
        case 'symbol':
          va = (a.symbol || '').toLowerCase();
          vb = (b.symbol || '').toLowerCase();
          break;
        case 'side':
          va = (a.side || '').toLowerCase();
          vb = (b.side || '').toLowerCase();
          break;
        case 'playbook':
          va = (a.playbook || '').toLowerCase();
          vb = (b.playbook || '').toLowerCase();
          break;
        case 'emotion':
          va = (a.emotion || '').toLowerCase();
          vb = (b.emotion || '').toLowerCase();
          break;
        case 'pnl':
          va = a.pnl || 0;
          vb = b.pnl || 0;
          break;
        default:
          va = new Date(a.date || 0);
          vb = new Date(b.date || 0);
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [trades, sortCol, sortDir]);

  // ─── Filtered trades ──────────────────────────────────────────
  const filteredTrades = useMemo(() => {
    let result = sortedTrades;

    // Date filter (from heatmap click)
    if (filterDate) {
      result = result.filter((t) => t.date && t.date.startsWith(filterDate));
    }

    // Date range filter
    const cutoff = getDateCutoff(dateRange);
    if (cutoff) {
      result = result.filter((t) => t.date && new Date(t.date) >= cutoff);
    }

    // Side filter
    if (sideFilter !== 'all') {
      result = result.filter((t) => (t.side || '').toLowerCase() === sideFilter);
    }

    // Search query
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      result = result.filter((t) => {
        const symbol = (t.symbol || '').toLowerCase();
        const strategy = (t.playbook || t.strategy || '').toLowerCase();
        const date = (t.date || '').toLowerCase();
        const side = (t.side || '').toLowerCase();
        const emotion = (t.emotion || '').toLowerCase();
        return (
          symbol.includes(q) || strategy.includes(q) || date.includes(q) || side.includes(q) || emotion.includes(q)
        );
      });
    }

    return result;
  }, [sortedTrades, query, filterDate, sideFilter, dateRange]);

  const isFiltered = filteredTrades.length !== (trades?.length || 0);

  // ─── Bulk selection ──────────────────────────────────────────
  const bulk = useBulkSelection(filteredTrades);

  // ─── Sort handler ────────────────────────────────────────────
  const handleSort = useCallback(
    (colId) => {
      if (sortCol === colId) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortCol(colId);
        setSortDir(colId === 'pnl' ? 'desc' : 'asc');
      }
    },
    [sortCol],
  );

  // ─── Focus input on open ───────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setExpandedId(null);
      setBulkMode(false);
      bulk.selectNone();
      setTimeout(() => inputRef.current?.focus(), 60);
      if (Date.now() - _savedScrollTime < MEMORY_TTL && scrollRef.current) {
        setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = _savedScrollTop;
        }, 80);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ─── Save scroll on close ──────────────────────────────────
  const handleClose = useCallback(() => {
    if (scrollRef.current) {
      _savedScrollTop = scrollRef.current.scrollTop;
      _savedScrollTime = Date.now();
    }
    onClose();
  }, [onClose]);

  // ─── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        handleExport();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, handleClose]);

  // ─── Export handler ────────────────────────────────────────
  const handleExport = useCallback(() => {
    const toExport = bulkMode && bulk.count > 0 ? bulk.selectedTrades : filteredTrades;
    if (!toExport.length) return;
    const headers = ['Date', 'Symbol', 'Side', 'Strategy', 'Emotion', 'P&L'].join(',');
    const rows = toExport.map((t) =>
      [
        t.date || '',
        t.symbol || '',
        t.side || '',
        sanitizeStrategy(t.playbook || t.strategy),
        t.emotion || '',
        t.pnl || 0,
      ].join(','),
    );
    const blob = new Blob([headers + '\n' + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `charEdge-logbook-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredTrades, bulkMode, bulk]);

  // ─── Bulk action handlers ──────────────────────────────────
  const handleBulkDelete = useCallback(() => {
    const ids = [...bulk.selectedIds];
    const store = useJournalStore.getState();
    ids.forEach((id) => store.deleteTrade(id));
    bulk.selectNone();
  }, [bulk]);

  const handleBulkTag = useCallback(
    (tag) => {
      const store = useJournalStore.getState();
      for (const id of bulk.selectedIds) {
        const trade = store.trades.find((t) => t.id === id);
        if (trade) {
          const existing = trade.context?.tags || [];
          if (!existing.includes(tag)) {
            store.updateTrade(id, { context: { ...trade.context, tags: [...existing, tag] } });
          }
        }
      }
    },
    [bulk],
  );

  const handleBulkEdit = useCallback(
    (field, value) => {
      const store = useJournalStore.getState();
      for (const id of bulk.selectedIds) {
        store.updateTrade(id, { [field]: value });
      }
    },
    [bulk],
  );

  const handleBulkExport = useCallback(() => {
    handleExport();
  }, [handleExport]);

  // ─── Clear all filters ────────────────────────────────────
  const clearAllFilters = useCallback(() => {
    setQuery('');
    setSideFilter('all');
    setDateRange('all');
  }, []);

  if (!isOpen) return null;

  return (
    <div className={css.overlay} role="dialog" aria-label="Spotlight Logbook" aria-modal="true">
      {/* Backdrop */}
      <div className={css.backdrop} onClick={handleClose} />

      {/* Panel */}
      <div className={css.panel} style={{ background: C.sf + 'e6', color: C.t1 }}>
        {/* ─── Search Bar ──────────────────────────────────── */}
        <div className={css.searchBar} style={{ borderBottomColor: C.bd + '40' }}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={C.b}
            strokeWidth="2"
            strokeLinecap="round"
            style={{ opacity: 0.7, flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search symbols, strategies, or dates..."
            className={css.searchInput}
            style={{ color: C.t1, fontFamily: F, background: C.sf, colorScheme: 'dark' }}
          />
          {query && (
            <button className={css.clearBtn} onClick={() => setQuery('')} style={{ color: C.t3 }}>
              ✕
            </button>
          )}
          {filterDate && (
            <span
              style={{
                fontSize: 10,
                fontFamily: M,
                color: C.b,
                padding: '3px 8px',
                background: C.b + '15',
                borderRadius: 6,
                flexShrink: 0,
              }}
            >
              📅 {filterDate}
            </span>
          )}
        </div>

        {/* ─── Toolbar ─────────────────────────────────────── */}
        <div className={css.toolbar} style={{ background: C.bg2 + '60' }}>
          {/* Filter Pills */}
          <div className={css.toolbarLeft}>
            {/* Side Filter */}
            {['all', 'long', 'short'].map((s) => (
              <button
                key={s}
                className={css.filterPill}
                data-active={sideFilter === s || undefined}
                onClick={() => setSideFilter(s)}
                style={{
                  background:
                    sideFilter === s
                      ? s === 'long'
                        ? C.g + '18'
                        : s === 'short'
                          ? C.r + '18'
                          : C.b + '15'
                      : 'transparent',
                  color: sideFilter === s ? (s === 'long' ? C.g : s === 'short' ? C.r : C.b) : C.t3,
                  border: `1px solid ${sideFilter === s ? 'transparent' : C.bd + '40'}`,
                }}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}

            <div className={css.toolbarDivider} style={{ background: C.bd }} />

            {/* Date Range */}
            {DATE_RANGES.map((dr) => (
              <button
                key={dr.id}
                className={css.filterPill}
                data-active={dateRange === dr.id || undefined}
                onClick={() => setDateRange(dr.id)}
                style={{
                  background: dateRange === dr.id ? C.b + '15' : 'transparent',
                  color: dateRange === dr.id ? C.b : C.t3,
                  border: `1px solid ${dateRange === dr.id ? 'transparent' : C.bd + '40'}`,
                }}
              >
                {dr.label}
              </button>
            ))}
          </div>

          {/* Toolbar Actions */}
          <div className={css.toolbarRight}>
            {/* Context Performance */}
            <button
              className={css.toolbarBtn}
              onClick={() => setShowContextPerf(true)}
              title="Context Performance"
              style={{ color: C.t3 }}
            >
              🧠
            </button>

            {/* Density Toggle */}
            <button
              className={css.toolbarBtn}
              onClick={() => setDensity((d) => (d === 'compact' ? 'comfortable' : 'compact'))}
              title={density === 'compact' ? 'Comfortable view' : 'Compact view'}
              style={{
                color: density === 'compact' ? C.b : C.t3,
                background: density === 'compact' ? C.b + '15' : 'transparent',
              }}
            >
              {density === 'compact' ? '▤' : '▥'}
            </button>

            {/* AI Grades */}
            <button
              className={css.toolbarBtn}
              onClick={() => setShowAIGrades(!showAIGrades)}
              title="AI Grades"
              style={{
                color: showAIGrades ? C.b : C.t3,
                background: showAIGrades ? C.b + '15' : 'transparent',
              }}
            >
              ✨
            </button>

            {/* Bulk Mode */}
            <button
              className={css.toolbarBtn}
              onClick={() => {
                setBulkMode(!bulkMode);
                if (bulkMode) bulk.selectNone();
              }}
              title={bulkMode ? 'Exit Bulk Mode' : 'Bulk Select'}
              style={{
                color: bulkMode ? C.b : C.t3,
                background: bulkMode ? C.b + '15' : 'transparent',
              }}
            >
              {bulkMode ? '✓' : '☐'}
            </button>

            {/* Trade Count */}
            <span className={css.tradeCount} style={{ color: C.t3, fontFamily: M }}>
              {filteredTrades.length} trade{filteredTrades.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* ─── Bulk Action Bar ─────────────────────────────── */}
        {bulkMode && bulk.count > 0 && (
          <div style={{ padding: '0 16px' }}>
            <BulkActionBar
              count={bulk.count}
              allSelected={bulk.allSelected}
              onSelectAll={bulk.selectAll}
              onSelectNone={bulk.selectNone}
              onInvert={bulk.invertSelection}
              onBulkDelete={handleBulkDelete}
              onBulkTag={handleBulkTag}
              onBulkEdit={handleBulkEdit}
              onBulkExport={handleBulkExport}
            />
          </div>
        )}

        {/* ─── Filter Summary ─────────────────────────────── */}
        {isFiltered && (
          <div className={css.filterSummary} style={{ background: C.b + '08', borderBottom: `1px solid ${C.bd}40` }}>
            <span style={{ fontSize: 11, color: C.t2, fontFamily: M }}>
              <span style={{ opacity: 0.6 }}>▼</span> Showing{' '}
              <strong style={{ color: C.b }}>{filteredTrades.length}</strong> of {trades?.length || 0} trades
            </span>
            <button className={css.clearAllBtn} onClick={clearAllFilters} style={{ color: C.b }}>
              Clear all
            </button>
          </div>
        )}

        {/* ─── Table Header ────────────────────────────────── */}
        <div className={css.tableHeader} style={{ fontFamily: M, color: C.t3, background: C.bg2 + '80' }}>
          {bulkMode && <span className={css.checkCol} />}
          {COLUMNS.map((col) => (
            <span
              key={col.id}
              className={css.colHeader}
              data-sortable={col.sortable || undefined}
              data-active={sortCol === col.id || undefined}
              onClick={() => col.sortable && handleSort(col.id)}
              style={{
                textAlign: col.align || 'left',
                justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start',
                color: sortCol === col.id ? C.b : undefined,
                cursor: col.sortable ? 'pointer' : 'default',
              }}
            >
              {col.label}
              {sortCol === col.id && <span className={css.sortArrow}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
            </span>
          ))}
        </div>

        {/* ─── Table Body (Virtualized) ──────────────────── */}
        <div ref={scrollRef} className={css.tableBody}>
          {filteredTrades.length > 0 ? (
            <VirtualTradeList
              trades={filteredTrades}
              sortedTrades={sortedTrades}
              scrollRef={scrollRef}
              density={density}
              expandedId={expandedId}
              setExpandedId={setExpandedId}
              hoveredId={hoveredId}
              setHoveredId={setHoveredId}
              bulkMode={bulkMode}
              bulk={bulk}
              showAIGrades={showAIGrades}
              handleClose={handleClose}
            />
          ) : (
            <div className={css.emptyState}>
              <div className={css.emptyIcon}>🔍</div>
              <div className={css.emptyTitle} style={{ color: C.t1, fontFamily: F }}>
                {query ? `No trades matching "${query}"` : 'No trades logged yet'}
              </div>
              <div className={css.emptyDesc} style={{ color: C.t3 }}>
                {query ? 'Try a different search term' : 'Add your first trade to see it here'}
              </div>
            </div>
          )}
        </div>

        {/* ─── Action Bar ──────────────────────────────────── */}
        <div className={css.actionBar} style={{ fontFamily: M, color: C.t3, background: C.bg2 + '60' }}>
          <div className={css.actionHint}>
            <kbd className={css.kbd} style={{ background: C.sf2, border: `1px solid ${C.bd}` }}>
              ↵
            </kbd>
            <span>Expand</span>
          </div>
          <div className={css.actionHint}>
            <kbd className={css.kbd} style={{ background: C.sf2, border: `1px solid ${C.bd}` }}>
              ⌘E
            </kbd>
            <span>Export</span>
          </div>
          <div className={css.actionHint} style={{ marginLeft: 'auto' }}>
            <kbd className={css.kbd} style={{ background: C.sf2, border: `1px solid ${C.bd}` }}>
              ESC
            </kbd>
            <span>Close</span>
          </div>
        </div>
      </div>

      {/* ─── Context Performance Slide-out ────────────────── */}
      <ContextPerformanceTab trades={trades || []} isOpen={showContextPerf} onClose={() => setShowContextPerf(false)} />
    </div>
  );
}

export default React.memo(SpotlightLogbook);
