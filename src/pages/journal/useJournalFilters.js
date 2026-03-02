// ═══════════════════════════════════════════════════════════════════
// useJournalFilters — Filter, sort, date-range, and summary stats
// Extracted from JournalPage (Phase 0.1 decomposition)
// ═══════════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback } from 'react';
import { applyAdvancedFilters, countActiveFilters } from '../../app/features/journal/journal_ui/JournalEvolution.jsx';

export function useJournalFilters(trades) {
  // ─── Filter / Sort state ─────────────────────────────────────
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [filter, setFilter] = useState('');
  const [sideFilter, setSideFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [assetClassFilter, setAssetClassFilter] = useState('all');
  const [advancedFilters, setAdvancedFilters] = useState({});
  const [advFiltersOpen, setAdvFiltersOpen] = useState(false);

  // ─── Filtered + sorted list ──────────────────────────────────
  const filteredTrades = useMemo(() => {
    let list = [...trades];

    if (filter.trim()) {
      const q = filter.toLowerCase();
      list = list.filter(
        (t) =>
          (t.symbol || '').toLowerCase().includes(q) ||
          (t.playbook || '').toLowerCase().includes(q) ||
          (t.emotion || '').toLowerCase().includes(q) ||
          (t.tags || []).some((tag) => tag.toLowerCase().includes(q)) ||
          (t.notes || '').toLowerCase().includes(q),
      );
    }

    if (sideFilter !== 'all') {
      list = list.filter((t) => t.side === sideFilter);
    }

    if (dateRange !== 'all') {
      const now = new Date();
      let fromDate = null,
        toDate = null;

      switch (dateRange) {
        case 'today':
          fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week': {
          const dayOfWeek = now.getDay();
          fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
          break;
        }
        case 'month':
          fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          fromDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
          break;
        case 'year':
          fromDate = new Date(now.getFullYear(), 0, 1);
          break;
        case 'custom':
          if (customDateFrom) fromDate = new Date(customDateFrom);
          if (customDateTo) toDate = new Date(customDateTo + 'T23:59:59');
          break;
        default:
          break;
      }

      if (fromDate) list = list.filter((t) => t.date && new Date(t.date) >= fromDate);
      if (toDate) list = list.filter((t) => t.date && new Date(t.date) <= toDate);
    }

    if (assetClassFilter !== 'all') {
      list = list.filter((t) => (t.assetClass || '').toLowerCase() === assetClassFilter.toLowerCase());
    }

    // Apply advanced filters (Sprint 9)
    list = applyAdvancedFilters(list, advancedFilters);

    list.sort((a, b) => {
      let va = a[sortCol];
      let vb = b[sortCol];
      if (sortCol === 'date') {
        va = new Date(va || 0).getTime();
        vb = new Date(vb || 0).getTime();
      } else if (sortCol === 'pnl') {
        va = va || 0;
        vb = vb || 0;
      } else {
        va = String(va || '').toLowerCase();
        vb = String(vb || '').toLowerCase();
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [
    trades,
    filter,
    sideFilter,
    dateRange,
    customDateFrom,
    customDateTo,
    assetClassFilter,
    sortCol,
    sortDir,
    advancedFilters,
  ]);

  // ─── Summary stats ─────────────────────────────────────────
  const summary = useMemo(() => {
    const pnl = filteredTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const wins = filteredTrades.filter((t) => (t.pnl || 0) > 0).length;
    return { pnl, wins, losses: filteredTrades.length - wins };
  }, [filteredTrades]);

  // ─── Today's session stats ──────────────────────────────────
  const session = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTrades = trades.filter((t) => t.date?.slice(0, 10) === todayStr);
    const pnl = todayTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const wins = todayTrades.filter((t) => (t.pnl || 0) > 0).length;
    const winRate = todayTrades.length > 0 ? Math.round((wins / todayTrades.length) * 100) : 0;
    return { count: todayTrades.length, pnl, wins, losses: todayTrades.length - wins, winRate };
  }, [trades]);

  // ─── Handlers ──────────────────────────────────────────────
  const handleSort = useCallback(
    (colId) => {
      if (sortCol === colId) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortCol(colId);
        setSortDir(colId === 'date' ? 'desc' : 'asc');
      }
    },
    [sortCol],
  );

  const clearAllFilters = useCallback(() => {
    setFilter('');
    setSideFilter('all');
    setDateRange('all');
    setAssetClassFilter('all');
    setAdvancedFilters({});
  }, []);

  const isFiltered = filter || sideFilter !== 'all' || dateRange !== 'all' || assetClassFilter !== 'all';
  const activeAdvCount = countActiveFilters(advancedFilters);

  return {
    // State + setters
    sortCol, sortDir, filter, setFilter,
    sideFilter, setSideFilter,
    dateRange, setDateRange,
    customDateFrom, setCustomDateFrom,
    customDateTo, setCustomDateTo,
    assetClassFilter, setAssetClassFilter,
    advancedFilters, setAdvancedFilters,
    advFiltersOpen, setAdvFiltersOpen,
    // Computed
    filteredTrades, summary, session,
    isFiltered, activeAdvCount,
    // Handlers
    handleSort, clearAllFilters,
  };
}
