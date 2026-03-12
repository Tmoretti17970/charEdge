// ═══════════════════════════════════════════════════════════════════
// useJournalTradeActions — Trade CRUD, bulk ops, export, navigation
// Extracted from JournalPage (Phase 0.1 decomposition)
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import toast from '../../app/components/ui/Toast.jsx';
import { launchTradeReplay } from '../../app/features/journal/journal_ui/TradeReplay.js';
import { exportCSV } from '../../charting_library/datafeed/csv.js';
import { useJournalStore } from '../../state/useJournalStore';
import { useUIStore } from '../../state/useUIStore';
import { undoStack, executeUndo } from '@/shared/UndoStack';
import { navigateToTrade } from '@/trading/navigateToTrade';
import { useChartCoreStore } from '../../state/chart/useChartCoreStore';

export function useJournalTradeActions(trades) {
  const deleteTrade = useJournalStore((s) => s.deleteTrade);
  const addTrade = useJournalStore((s) => s.addTrade);
  const addTrades = useJournalStore((s) => s.addTrades);
  const updateTrade = useJournalStore((s) => s.updateTrade);
  const setPage = useUIStore((s) => s.setPage);
  const setChartSymbol = useChartCoreStore((s) => s.setSymbol);
  const setChartTf = useChartCoreStore((s) => s.setTf);

  // ─── Modal state ─────────────────────────────────────────────
  const [tradeFormOpen, setTradeFormOpen] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [editTrade, setEditTrade] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [publishTradeOpen, setPublishTradeOpen] = useState(false);
  const [publishTrade, setPublishTrade] = useState(null);

  // ─── Store actions (for undo/redo) ──────────────────────────
  const storeActions = { addTrade, addTrades, deleteTrade, updateTrade };

  // ─── Handlers ───────────────────────────────────────────────
  const openAddTrade = useCallback(() => {
    setEditTrade(null);
    setTradeFormOpen(true);
  }, []);

  const handleEdit = useCallback((trade) => {
    setEditTrade(trade);
    setTradeFormOpen(true);
  }, []);

  const handleDelete = useCallback((id) => {
    const trade = trades.find((t) => t.id === id);
    if (!trade) return;
    undoStack.push({
      type: 'delete',
      payload: { id, symbol: trade.symbol },
      inverse: { trade: { ...trade } },
      label: `Delete ${trade.symbol || 'trade'}`,
    });
    deleteTrade(id);
    setDeleteConfirm(null);

    const sa = { addTrade, addTrades, deleteTrade, updateTrade };
    toast.action(
      `${trade.symbol || 'Trade'} deleted`,
      'Undo',
      () => {
        const e = undoStack.undo();
        if (e) toast.success(executeUndo(e, sa) || 'Undone');
      },
      { type: 'success', duration: 5000 },
    );
  }, [trades, deleteTrade, addTrade, addTrades, updateTrade]);

  const handleViewOnChart = useCallback(
    (trade) => {
      navigateToTrade(trade, { setPage, setSymbol: setChartSymbol, setTf: setChartTf });
    },
    [setPage, setChartSymbol, setChartTf],
  );

  const handleReplay = useCallback((trade) => {
    launchTradeReplay(trade, { replayMode: true, highlightTrade: true });
  }, []);

  const handleExportCSV = useCallback((tradesToExport) => {
    const list = tradesToExport || trades;
    if (!list.length) return;
    const csv = exportCSV(list);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `charEdge-trades-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${list.length} trades`);
  }, [trades]);

  const handleShare = useCallback((trade) => {
    setPublishTrade(trade);
    setPublishTradeOpen(true);
  }, []);

  // ─── Bulk handlers (Sprint 9) ──────────────────────────────
  const handleBulkDelete = useCallback((bulk) => {
    if (!bulk.hasSelection) return;
    const count = bulk.count;
    const selected = bulk.selectedTrades;

    for (const t of selected) {
      undoStack.push({
        type: 'delete',
        payload: { id: t.id, symbol: t.symbol },
        inverse: { trade: { ...t } },
        label: `Bulk delete ${t.symbol}`,
      });
      deleteTrade(t.id);
    }

    bulk.selectNone();
    toast.success(`Deleted ${count} trades`);
  }, [deleteTrade]);

  const handleBulkTag = useCallback((bulk, tag) => {
    for (const t of bulk.selectedTrades) {
      const existing = t.tags || [];
      if (!existing.includes(tag)) {
        updateTrade(t.id, { tags: [...existing, tag] });
      }
    }
    toast.success(`Tagged ${bulk.count} trades with "${tag}"`);
  }, [updateTrade]);

  const handleBulkEdit = useCallback((bulk, field, value) => {
    for (const t of bulk.selectedTrades) {
      updateTrade(t.id, { [field]: value });
    }
    toast.success(`Updated ${field} on ${bulk.count} trades`);
  }, [updateTrade]);

  const handleBulkExport = useCallback((bulk) => {
    handleExportCSV(bulk.selectedTrades);
  }, [handleExportCSV]);

  const closeTradeForm = useCallback(() => {
    setTradeFormOpen(false);
    setEditTrade(null);
  }, []);

  const closePublishModal = useCallback(() => {
    setPublishTradeOpen(false);
    setPublishTrade(null);
  }, []);

  return {
    // Modal state
    tradeFormOpen, csvModalOpen, setCsvModalOpen,
    editTrade, deleteConfirm, setDeleteConfirm,
    publishTradeOpen, publishTrade,
    // Store actions (for keyboard handler)
    storeActions,
    // Handlers
    openAddTrade, handleEdit, handleDelete,
    handleViewOnChart, handleReplay, handleExportCSV, handleShare,
    handleBulkDelete, handleBulkTag, handleBulkEdit, handleBulkExport,
    closeTradeForm, closePublishModal,
  };
}
