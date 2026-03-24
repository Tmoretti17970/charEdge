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
// C, F, M constants removed — using CSS module tokens (Sprint 24)
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
    <div className={css.detailPanel}>
      {/* Detail Grid */}
      <div className={css.detailGrid}>
        <div>
          <div className={css.detailLabel}>Entry</div>
          <div className={css.detailValue}>{t.entry || '—'}</div>
        </div>
        <div>
          <div className={css.detailLabel}>Exit</div>
          <div className={css.detailValue}>{t.exit || '—'}</div>
        </div>
        <div>
          <div className={css.detailLabel}>Stop Loss</div>
          <div className={css.detailValue}>{t.stopLoss || '—'}</div>
        </div>
        <div>
          <div className={css.detailLabel}>Size</div>
          <div className={css.detailValue}>{t.size || t.qty || '—'}</div>
        </div>
        <div>
          <div className={css.detailLabel}>R-Multiple</div>
            <div className={css.detailValue} style={{ color: t.rMultiple > 0 ? 'var(--tf-g)' : t.rMultiple < 0 ? 'var(--tf-r)' : 'var(--tf-t2)' }}>
            {t.rMultiple != null ? `${t.rMultiple >= 0 ? '+' : ''}${t.rMultiple}R` : '—'}
          </div>
        </div>
        <div>
          <div className={css.detailLabel}>Duration</div>
          <div className={css.detailValue}>{fmtDuration(t.duration)}</div>
        </div>
        <div>
          <div className={css.detailLabel}>Emotion</div>
          <div className={css.detailValue}>{t.emotion || '—'}</div>
        </div>
        <div>
          <div className={css.detailLabel}>Fees</div>
          <div className={css.detailValue}>{t.fees ? `$${t.fees.toFixed(2)}` : '—'}</div>
        </div>
      </div>

      {/* Notes */}
      {t.notes && (
        <div className={css.notesBlock}>{t.notes}</div>
      )}

      {/* Chart Screenshots */}
      {t.screenshots?.length > 0 && (
        <div className={css.screenshotSection}>
          <div className={css.screenshotLabel}>
            📸 Chart Snapshot ({t.screenshots.length})
          </div>
          <div className={css.screenshotGrid}>
            {t.screenshots.map((shot, i) => (
              <a
                key={i}
                href={shot.data}
                target="_blank"
                rel="noopener noreferrer"
                className={css.screenshotThumb}
              >
                <img
                  src={shot.data}
                  alt={shot.name || `Chart snapshot ${i + 1}`}
                  className={css.screenshotImg}
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className={css.detailActions}>
        <button className={`${css.detailBtn} ${css.detailBtnEdit}`} onClick={handleEdit}>
          ✏️ Edit
        </button>
        <button className={`${css.detailBtn} ${css.detailBtnDefault}`} onClick={handleViewOnChart}>
          📊 View on Chart
        </button>
        <button className={`${css.detailBtn} ${css.detailBtnDefault}`} onClick={handleReplay}>
          ▶ Replay
        </button>
        <div className={css.flexSpacer} />
        <button className={`${css.detailBtn} ${css.detailBtnDelete}`} onClick={handleDelete}>
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
                borderLeft: expandedId === t.id ? '3px solid var(--tf-brand)' : '3px solid transparent',
                background: bulk.isSelected(t.id) ? 'var(--tf-brand-08, rgba(59,130,246,0.05))' : expandedId === t.id ? 'var(--tf-sf)' : undefined,
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
                      border: `2px solid ${bulk.isSelected(t.id) ? 'var(--tf-brand)' : 'var(--tf-bd)'}`,
                      background: bulk.isSelected(t.id) ? 'var(--tf-brand)' : 'transparent',
                    }}
                  >
                    {bulk.isSelected(t.id) && <span className={css.checkMark}>✓</span>}
                  </div>
                </div>
              )}

              {/* Date + Session Tag */}
              <span className={css.tradeDate}>
                {fmtDate(t.date)}
                {t.sessionTag && <span className={css.sessionTag}>{t.sessionTag}</span>}
              </span>

              {/* Asset icon */}
              <span className={css.tradeIcon}>{getAssetIcon(t.symbol)}</span>

              {/* Symbol + AI Grade */}
              <div className={css.tradeSymbol}>
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
                              ? 'rgba(49,209,88,0.08)'
                              : g.score >= 3
                                ? 'rgba(59,130,246,0.08)'
                                : g.score >= 2
                                  ? 'rgba(240,182,78,0.08)'
                                  : 'rgba(255,69,58,0.08)',
                          color: g.score >= 4 ? 'var(--tf-g)' : g.score >= 3 ? 'var(--tf-brand)' : g.score >= 2 ? 'var(--tf-y)' : 'var(--tf-r)',
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
                  color: t.side === 'long' ? 'var(--tf-g)' : 'var(--tf-r)',
                  background: t.side === 'long' ? 'rgba(49,209,88,0.08)' : 'rgba(255,69,58,0.08)',
                }}
              >
                {t.side || '—'}
              </span>

              {/* Strategy + Leak Pills */}
              <span
                className={css.tradeStrategy}
              >
                {sanitizeStrategy(t.playbook || t.strategy)}
                {t.tags
                  ?.filter((tag) => LEAK_TAG_COLORS[tag])
                  .map((tag) => (
                    <span
                      key={tag}
                      className={css.leakPill}
                      style={{
                        background: LEAK_TAG_COLORS[tag].bg,
                        color: LEAK_TAG_COLORS[tag].color,
                      }}
                    >
                      {LEAK_TAG_COLORS[tag].label}
                    </span>
                  ))}
              </span>

              {/* Emotion — compressed to color dot */}
              <span
                className={css.emotionDot}
                style={{ background: EMOTION_COLORS[t.emotion] || 'rgba(78,82,102,0.19)' }}
                title={t.emotion || 'None'}
              />

              {/* P&L */}
              <span className={css.tradePnl} style={{ color: (t.pnl || 0) >= 0 ? 'var(--tf-g)' : 'var(--tf-r)' }}>
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
                      <div className={css.sparklineLabel}>
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

  // ─── Focus trap (accessibility — WCAG 2.1 §4.1.2) ────────
  const overlayRef = useRef(null);
  useEffect(() => {
    if (!isOpen || !overlayRef.current) return;
    const trap = (e) => {
      if (e.key !== 'Tab') return;
      const focusable = overlayRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [isOpen]);

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
    <div ref={overlayRef} className={css.overlay} role="dialog" aria-label="Spotlight Logbook" aria-modal="true">
      {/* Backdrop */}
      <div className={css.backdrop} onClick={handleClose} />

      {/* Panel */}
      <div className={css.panel}>
        {/* ─── Search Bar ──────────────────────────────────── */}
        <div className={css.searchBar}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--tf-brand)"
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

          />
          {query && (
            <button className={css.clearBtn} onClick={() => setQuery('')}>
              ✕
            </button>
          )}
          {filterDate && (
            <span className={css.filterDateBadge}>
              📅 {filterDate}
            </span>
          )}
        </div>

        {/* ─── Toolbar ─────────────────────────────────────── */}
        <div className={css.toolbar}>
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
                        ? 'rgba(49,209,88,0.09)'
                        : s === 'short'
                          ? 'rgba(255,69,58,0.09)'
                          : 'var(--tf-brand-15, rgba(59,130,246,0.09))'
                      : 'transparent',
                  color: sideFilter === s ? (s === 'long' ? 'var(--tf-g)' : s === 'short' ? 'var(--tf-r)' : 'var(--tf-brand)') : 'var(--tf-t3)',
                  border: `1px solid ${sideFilter === s ? 'transparent' : 'var(--tf-bd-40, rgba(128,128,128,0.25))'}`,
                }}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}

            <div className={css.toolbarDivider} />

            {/* Date Range */}
            {DATE_RANGES.map((dr) => (
              <button
                key={dr.id}
                className={css.filterPill}
                data-active={dateRange === dr.id || undefined}
                onClick={() => setDateRange(dr.id)}
                style={{
                  background: dateRange === dr.id ? 'var(--tf-brand-15, rgba(59,130,246,0.09))' : 'transparent',
                  color: dateRange === dr.id ? 'var(--tf-brand)' : 'var(--tf-t3)',
                  border: `1px solid ${dateRange === dr.id ? 'transparent' : 'var(--tf-bd-40, rgba(128,128,128,0.25))'}`,
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
            >
              🧠
            </button>

            {/* Density Toggle */}
            <button
              className={css.toolbarBtn}
              onClick={() => setDensity((d) => (d === 'compact' ? 'comfortable' : 'compact'))}
              title={density === 'compact' ? 'Comfortable view' : 'Compact view'}
              data-active={density === 'compact' || undefined}
            >
              {density === 'compact' ? '▤' : '▥'}
            </button>

            {/* AI Grades */}
            <button
              className={css.toolbarBtn}
              onClick={() => setShowAIGrades(!showAIGrades)}
              title="AI Grades"
              data-active={showAIGrades || undefined}
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
              data-active={bulkMode || undefined}
            >
              {bulkMode ? '✓' : '☐'}
            </button>

            {/* Trade Count */}
            <span className={css.tradeCount}>
              {filteredTrades.length} trade{filteredTrades.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* ─── Bulk Action Bar ─────────────────────────────── */}
        {bulkMode && bulk.count > 0 && (
          <div className={css.bulkBarWrap}>
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
          <div className={css.filterSummary}>
            <span className={css.filterSummaryText}>
              <span className={css.filterSummaryArrow}>▼</span> Showing{' '}
              <strong className={css.filterSummaryCount}>{filteredTrades.length}</strong> of {trades?.length || 0} trades
            </span>
            <button className={css.clearAllBtn} onClick={clearAllFilters}>
              Clear all
            </button>
          </div>
        )}

        {/* ─── Table Header ────────────────────────────────── */}
        <div className={css.tableHeader}>
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
              <div className={css.emptyTitle}>
                {query ? `No trades matching "${query}"` : 'No trades logged yet'}
              </div>
              <div className={css.emptyDesc}>
                {query ? 'Try a different search term' : 'Add your first trade to see it here'}
              </div>
            </div>
          )}
        </div>

        {/* ─── Action Bar ──────────────────────────────────── */}
        <div className={css.actionBar}>
          <div className={css.actionHint}>
            <kbd className={css.kbd}>↵</kbd>
            <span>Expand</span>
          </div>
          <div className={css.actionHint}>
            <kbd className={css.kbd}>⌘E</kbd>
            <span>Export</span>
          </div>
          <div className={`${css.actionHint} ${css.actionHintRight}`}>
            <kbd className={css.kbd}>ESC</kbd>
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
