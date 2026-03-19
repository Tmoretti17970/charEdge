// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Journal Filter Bar
// Sprint 12: Collapsed by default — search + Filters toggle + summary
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState } from 'react';
import { C, F, M } from '@/constants.js';
import { fmtD } from '../../../../utils.js';

function JournalFilterBar({
  filter,
  setFilter,
  sideFilter,
  setSideFilter,
  dateRange,
  setDateRange,
  customDateFrom,
  setCustomDateFrom,
  customDateTo,
  setCustomDateTo,
  assetClassFilter,
  setAssetClassFilter,
  summary,
  advFiltersOpen,
  setAdvFiltersOpen,
  activeAdvCount = 0,
}) {
  // Sprint 12: filter bar collapse state
  const [showFilters, setShowFilters] = useState(false);

  // Count active filters for badge
  const activeFilterCount =
    (sideFilter !== 'all' ? 1 : 0) +
    (dateRange !== 'all' ? 1 : 0) +
    (assetClassFilter !== 'all' ? 1 : 0) +
    activeAdvCount;

  return (
    <>
      {/* Row 1: Search + Filters toggle + Summary (always visible) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        {/* Search */}
        <input
          aria-label="Filter trades"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search symbol, strategy, tags..."
          style={{
            flex: 1,
            minWidth: 160,
            padding: '8px 12px',
            borderRadius: 6,
            border: `1px solid ${C.bd}`,
            background: C.sf,
            color: C.t1,
            fontSize: 12,
            fontFamily: F,
            outline: 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
          onFocus={(e) => { e.target.style.borderColor = C.b; e.target.style.boxShadow = `0 0 0 2px ${C.b}20`; }}
          onBlur={(e) => { e.target.style.borderColor = C.bd; e.target.style.boxShadow = 'none'; }}
        />

        {/* Filters Toggle (Sprint 12) */}
        <button
          className="tf-btn"
          onClick={() => setShowFilters(!showFilters)}
          style={{
            padding: '7px 12px',
            borderRadius: 6,
            border: `1px solid ${showFilters || activeFilterCount > 0 ? C.b : C.bd}`,
            background: showFilters ? C.b + '15' : 'transparent',
            color: showFilters || activeFilterCount > 0 ? C.b : C.t3,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: F,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            whiteSpace: 'nowrap',
          }}
        >
          {showFilters ? '▼' : '▶'} Filters
          {activeFilterCount > 0 && (
            <span
              style={{
                padding: '1px 6px',
                borderRadius: 10,
                background: C.b + '25',
                color: C.b,
                fontSize: 9,
                fontWeight: 700,
                fontFamily: M,
              }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Summary (always visible) */}
        <div style={{ fontSize: 11, fontFamily: M, color: C.t3, whiteSpace: 'nowrap', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ color: summary.pnl >= 0 ? C.g : C.r, fontWeight: 700 }}>{fmtD(summary.pnl)}</span>
          {' · '}
          <span style={{ color: C.g }}>{summary.wins}W</span> <span style={{ color: C.r }}>{summary.losses}L</span>
        </div>
      </div>

      {/* Sprint 12: Collapsible filter controls */}
      {showFilters && (
        <div style={{
          display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap',
          padding: '10px 12px', background: C.bg2, borderRadius: 8, border: `1px solid ${C.bd}`,
          animation: 'tfSubTabsIn 0.2s ease forwards',
        }}>
          {/* Side Filter */}
          {['all', 'long', 'short'].map((s) => (
            <button
              className="tf-btn"
              key={s}
              onClick={() => setSideFilter(s)}
              style={{
                padding: '6px 10px',
                borderRadius: 4,
                border: `1px solid ${sideFilter === s ? C.b : C.bd}`,
                background: sideFilter === s ? C.b + '20' : 'transparent',
                color: sideFilter === s ? C.b : C.t3,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.15s',
              }}
            >
              {s}
            </button>
          ))}

          <div style={{ width: 1, height: 20, background: C.bd }} />

          {/* Date Range Filter */}
          <select
            aria-label="Filter by date"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 4,
              border: `1px solid ${dateRange !== 'all' ? C.b : C.bd}`,
              background: dateRange !== 'all' ? C.b + '20' : C.sf,
              color: dateRange !== 'all' ? C.b : C.t3,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: F,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
            <option value="custom">Custom Range</option>
          </select>

          {/* Asset Class Filter */}
          <select
            value={assetClassFilter}
            onChange={(e) => setAssetClassFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 4,
              border: `1px solid ${assetClassFilter !== 'all' ? C.p : C.bd}`,
              background: assetClassFilter !== 'all' ? '#a855f720' : C.sf,
              color: assetClassFilter !== 'all' ? C.p : C.t3,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: F,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="all">All Assets</option>
            <option value="crypto">Crypto</option>
            <option value="equities">Equities</option>
            <option value="futures">Futures</option>
            <option value="options">Options</option>
            <option value="forex">Forex</option>
          </select>

          {/* Advanced Filters Toggle */}
          <button
            className="tf-btn"
            onClick={() => setAdvFiltersOpen(!advFiltersOpen)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 11,
              fontWeight: 600,
              color: C.b,
              cursor: 'pointer',
              fontFamily: M,
              padding: '4px 8px',
              marginLeft: 'auto',
            }}
          >
            {advFiltersOpen ? '▼' : '▶'} Advanced
            {activeAdvCount > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  padding: '2px 6px',
                  borderRadius: 10,
                  background: C.b + '20',
                  color: C.b,
                  fontSize: 9,
                }}
              >
                {activeAdvCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Custom date range inputs */}
      {showFilters && dateRange === 'custom' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: C.t3 }}>From</span>
          <input
            type="date"
            value={customDateFrom}
            onChange={(e) => setCustomDateFrom(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 4,
              border: `1px solid ${C.bd}`,
              background: C.sf,
              color: C.t1,
              fontSize: 11,
              fontFamily: M,
              outline: 'none',
            }}
          />
          <span style={{ fontSize: 11, color: C.t3 }}>To</span>
          <input
            type="date"
            value={customDateTo}
            onChange={(e) => setCustomDateTo(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 4,
              border: `1px solid ${C.bd}`,
              background: C.sf,
              color: C.t1,
              fontSize: 11,
              fontFamily: M,
              outline: 'none',
            }}
          />
          {(customDateFrom || customDateTo) && (
            <button
              className="tf-btn"
              onClick={() => {
                setCustomDateFrom('');
                setCustomDateTo('');
              }}
              style={{
                padding: '4px 8px',
                borderRadius: 3,
                border: 'none',
                background: C.r + '20',
                color: C.r,
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </>
  );
}

export default React.memo(JournalFilterBar);
