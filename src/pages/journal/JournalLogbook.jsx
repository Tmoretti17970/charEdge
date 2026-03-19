// ═══════════════════════════════════════════════════════════════════
// JournalLogbook — Bottom pane: toolbar, filters, trade table
// Extracted from JournalPage (Phase 0.1 decomposition)
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { JournalEmptyState } from '../../app/components/ui/EmptyState.jsx';
import { Card } from '../../app/components/ui/UIKit.jsx';
import { BulkActionBar } from '../../app/features/journal/journal_ui/BulkOperations.jsx';
import ContextPerformanceTab from '../../app/features/journal/journal_ui/ContextPerformanceTab.jsx';
import {
  AdvancedFilters,
} from '../../app/features/journal/journal_ui/JournalEvolution.jsx';
import JournalFilterBar from '../../app/features/journal/journal_ui/JournalFilterBar.jsx';
import JournalTradeRow, { GRID_COLS, GRID_COLS_NO_CHECK } from '../../app/features/journal/journal_ui/JournalTradeRow.jsx';
import { C, F, M } from '../../constants.js';
import VirtualList from '@/shared/VirtualList.jsx';

const COLUMNS = [
  { id: 'date', label: 'Date', width: '100px', sortable: true },
  { id: 'symbol', label: 'Symbol', width: '80px', sortable: true },
  { id: 'side', label: 'Side', width: '55px', sortable: true },
  { id: 'playbook', label: 'Strategy', width: '1fr', sortable: true },
  { id: 'emotion', label: 'Emotion', width: '80px', sortable: true },
  { id: 'pnl', label: 'P&L', width: '100px', sortable: true, align: 'right' },
];

export default function JournalLogbook({
  trades,
  filteredTrades,
  filters,
  bulk,
  bulkMode,
  setBulkMode,
  expandedId,
  setExpandedId,
  deleteConfirm,
  isTablet,
  // Handlers
  handleSort,
  handleEdit,
  handleDelete,
  setDeleteConfirm,
  handleViewOnChart,
  handleReplay,
  handleShare,
  _handleExportCSV,
  handleBulkDelete,
  handleBulkTag,
  handleBulkEdit,
  handleBulkExport,
  openAddTrade,
  setCsvModalOpen,
  // Bulk toggle
  showAIGrades,
  setShowAIGrades,
}) {
  const {
    filter, setFilter,
    sideFilter, setSideFilter,
    dateRange, setDateRange,
    customDateFrom, setCustomDateFrom,
    customDateTo, setCustomDateTo,
    assetClassFilter, setAssetClassFilter,
    advancedFilters, setAdvancedFilters,
    advFiltersOpen, setAdvFiltersOpen,
    summary, isFiltered, activeAdvCount,
    sortCol, sortDir, clearAllFilters,
  } = filters;

  // ─── Container height for virtualization ──────────────────
  const containerRef = useRef(null);
  const [containerH, setContainerH] = useState(600);
  const [showContextPerf, setShowContextPerf] = useState(false);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const available = window.innerHeight - rect.top - 24;
        // Cap to content height so we don't leave huge empty space
        const rowH = isTablet ? 54 : 44;
        const headerH = isTablet ? 0 : 40;
        const contentH = headerH + filteredTrades.length * rowH + 8;
        setContainerH(Math.max(200, Math.min(available, contentH)));
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [filteredTrades.length, isTablet]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: 16 }}>
      {/* Tools & Alerts Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: F, color: C.t1, margin: 0 }}>Logbook</h2>
          <span style={{ fontSize: 12, color: C.t3, fontFamily: M }}>
            {trades.length} trade{trades.length !== 1 ? 's' : ''} logged
          </span>
        </div>

        {/* Sprint 10: Streamlined action icons */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setShowContextPerf(true)}
            title="Context Performance"
            className="tf-icon-btn"
            style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', color: C.t3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, transition: 'color 0.15s, background 0.15s' }}
            onMouseEnter={(e) => { e.target.style.background = C.sf2; e.target.style.color = C.t1; }}
            onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.color = C.t3; }}
          >🧠</button>
          <button
            onClick={() => setShowAIGrades(!showAIGrades)}
            title="AI Grades"
            className="tf-icon-btn"
            style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: showAIGrades ? C.b + '15' : 'transparent', color: showAIGrades ? C.b : C.t3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, transition: 'color 0.15s, background 0.15s' }}
          >✨</button>
          <button
            onClick={() => { setBulkMode(!bulkMode); if (bulkMode) bulk.selectNone(); }}
            title={bulkMode ? 'Exit Bulk Mode' : 'Bulk Select'}
            className="tf-icon-btn"
            style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: bulkMode ? C.b + '15' : 'transparent', color: bulkMode ? C.b : C.t3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, transition: 'color 0.15s, background 0.15s' }}
          >{bulkMode ? '✓' : '☐'}</button>
        </div>
      </div>

      {/* Filter Bar */}
      <JournalFilterBar
        filter={filter}
        setFilter={setFilter}
        sideFilter={sideFilter}
        setSideFilter={setSideFilter}
        dateRange={dateRange}
        setDateRange={setDateRange}
        customDateFrom={customDateFrom}
        setCustomDateFrom={setCustomDateFrom}
        customDateTo={customDateTo}
        setCustomDateTo={setCustomDateTo}
        assetClassFilter={assetClassFilter}
        setAssetClassFilter={setAssetClassFilter}
        summary={summary}
        advFiltersOpen={advFiltersOpen}
        setAdvFiltersOpen={setAdvFiltersOpen}
        activeAdvCount={activeAdvCount}
      />

      {/* Advanced Filters (Sprint 9) */}
      <AdvancedFilters filters={advancedFilters} onFiltersChange={setAdvancedFilters} trades={trades} isOpen={advFiltersOpen} />

      {/* Bulk Action Bar (Sprint 9) */}
      {bulkMode && (
        <BulkActionBar
          count={bulk.count}
          allSelected={bulk.allSelected}
          onSelectAll={bulk.selectAll}
          onSelectNone={bulk.selectNone}
          onInvert={bulk.invertSelection}
          onBulkDelete={() => handleBulkDelete(bulk)}
          onBulkTag={(tag) => handleBulkTag(bulk, tag)}
          onBulkEdit={(field, value) => handleBulkEdit(bulk, field, value)}
          onBulkExport={() => handleBulkExport(bulk)}
        />
      )}

      {/* Trade Table */}
      {filteredTrades.length > 0 ? (
        <Card ref={containerRef} style={{ padding: 0, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Filter summary bar */}
          {isFiltered && (
            <div
              style={{
                padding: '6px 16px',
                background: C.b + '08',
                borderBottom: `1px solid ${C.bd}40`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 11, color: C.t2, fontFamily: M, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ opacity: 0.6 }}>▼</span>
                Showing <strong style={{ color: C.b }}>{filteredTrades.length}</strong> of {trades.length} trades
              </span>
              <button
                onClick={clearAllFilters}
                className="tf-btn tf-link"
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: C.b,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '2px 8px',
                  borderRadius: 4,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.b + '12'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                Clear all
              </button>
            </div>
          )}

          <div style={{ flex: 1, minHeight: 0 }}>
            <VirtualList
              items={filteredTrades}
              rowHeight={isTablet ? 54 : 44}
              expandedId={expandedId}
              expandedHeight={520}
              containerHeight={containerH}
              overscan={8}
              header={
                !isTablet ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: bulkMode ? GRID_COLS : GRID_COLS_NO_CHECK,
                      padding: '8px 16px 8px 19px',
                      background: C.bg2,
                      borderBottom: `1px solid ${C.bd}60`,
                      position: 'sticky',
                      top: 0,
                      zIndex: 10,
                    }}
                  >
                    {bulkMode && (
                      <div
                        onClick={() => (bulk.allSelected ? bulk.selectNone() : bulk.selectAll())}
                        role="checkbox"
                        aria-checked={bulk.allSelected}
                        aria-label="Select all trades"
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          border: `2px solid ${bulk.allSelected ? C.b : C.bd}`,
                          background: bulk.allSelected ? C.b : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          alignSelf: 'center',
                        }}
                      >
                        {bulk.allSelected && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>✓</span>}
                      </div>
                    )}
                    {COLUMNS.map((col) => (
                      <div
                        key={col.id}
                        onClick={() => col.sortable && handleSort(col.id)}
                        role={col.sortable ? 'button' : undefined}
                        aria-label={col.sortable ? `Sort by ${col.label}` : undefined}
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: sortCol === col.id ? C.b : C.t3,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          fontFamily: M,
                          cursor: col.sortable ? 'pointer' : 'default',
                          userSelect: 'none',
                          textAlign: col.align || 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start',
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={(e) => { if (col.sortable && sortCol !== col.id) e.currentTarget.style.color = C.t1; }}
                        onMouseLeave={(e) => { if (col.sortable && sortCol !== col.id) e.currentTarget.style.color = C.t3; }}
                      >
                        {col.label}
                        {sortCol === col.id && <span style={{ fontSize: 8, marginLeft: 2 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                      </div>
                    ))}
                  </div>
                ) : null
              }
              renderRow={(t, index, isExpanded) => (
                <JournalTradeRow
                  trade={t}
                  isExpanded={isExpanded}
                  isTablet={isTablet}
                  deleteConfirm={deleteConfirm}
                  onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onDeleteConfirm={setDeleteConfirm}
                  onCancelDelete={() => setDeleteConfirm(null)}
                  onViewChart={handleViewOnChart}
                  onReplay={handleReplay}
                  onShare={handleShare}
                  bulkMode={bulkMode}
                  isSelected={bulk.isSelected(t.id)}
                  onToggleSelect={bulk.toggle}
                  showAIGrades={showAIGrades}
                />
              )}
            />
          </div>

          {/* Phase 3 Task #53: Running filtered total footer */}
          {isFiltered && filteredTrades.length > 0 && (() => {
            const totalPnl = filteredTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
            const wins = filteredTrades.filter(t => (t.pnl || 0) > 0).length;
            const wr = filteredTrades.length > 0 ? Math.round((wins / filteredTrades.length) * 100) : 0;
            const avgPnl = totalPnl / filteredTrades.length;
            const pnlColor = totalPnl >= 0 ? C.g : C.r;
            return (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 16px',
                  background: C.bg2,
                  borderTop: `1px solid ${C.bd}60`,
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 11, color: C.t2, fontFamily: M }}>
                  {filteredTrades.length} trade{filteredTrades.length !== 1 ? 's' : ''}
                  {' · '}
                  <span style={{ color: wr >= 50 ? C.g : C.r, fontWeight: 700 }}>{wr}%</span> win rate
                </span>
                <span style={{ fontSize: 11, fontFamily: M, fontWeight: 700, color: pnlColor, fontVariantNumeric: 'tabular-nums' }}>
                  Σ {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)} · avg {avgPnl >= 0 ? '+' : ''}{avgPnl.toFixed(2)}
                </span>
              </div>
            );
          })()}
        </Card>
      ) : trades.length === 0 ? (
        <JournalEmptyState onAddTrade={openAddTrade} onImportCSV={() => setCsvModalOpen(true)} />
      ) : (
        <Card style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>🔍</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.t1, marginBottom: 6 }}>No trades match your filters</div>
            <div style={{ fontSize: 12, color: C.t3, marginBottom: 16, maxWidth: 260, margin: '0 auto 16px' }}>
              Try adjusting your search, date range, or side filters to find what you're looking for.
            </div>
            <button
              onClick={clearAllFilters}
              className="tf-btn tf-link"
              style={{
                border: `1px solid ${C.bd}`,
                background: 'transparent',
                color: C.b,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                padding: '8px 20px',
                borderRadius: 8,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = C.b + '10';
                e.currentTarget.style.borderColor = C.b;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = C.bd;
              }}
            >
              Clear all filters
            </button>
          </div>
        </Card>
      )}

      {/* Context Performance Slide-out (Sprint 9) */}
      <ContextPerformanceTab trades={trades} isOpen={showContextPerf} onClose={() => setShowContextPerf(false)} />
    </div>
  );
}
