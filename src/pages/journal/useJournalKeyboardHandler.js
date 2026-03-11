// ═══════════════════════════════════════════════════════════════════
// useJournalKeyboardHandler — Keyboard shortcuts + undo/redo
// Extracted from JournalPage (Phase 0.1 decomposition)
// ═══════════════════════════════════════════════════════════════════

import { useRef } from 'react';
import toast from '../../app/components/ui/Toast.jsx';
import { useHotkeys } from '@/hooks/useHotkeys';
import { undoStack, executeUndo, executeRedo } from '@/shared/UndoStack';

/**
 * @param {object} opts
 * @param {Array}  opts.filteredTrades
 * @param {object} opts.storeActions  — { addTrade, addTrades, deleteTrade, updateTrade }
 * @param {string|null} opts.expandedId
 * @param {Function} opts.setExpandedId
 * @param {number}  opts.focusedIdx
 * @param {Function} opts.setFocusedIdx
 * @param {boolean} opts.bulkMode
 * @param {Function} opts.setBulkMode
 * @param {object}   opts.bulk        — useBulkSelection return value
 * @param {Array}    opts.trades      — raw trades array
 * @param {Function} opts.openAddTrade
 * @param {Function} opts.handleExportCSV
 * @param {boolean}  opts.modalsOpen  — true when any modal is open (disables page shortcuts)
 */
export function useJournalKeyboardHandler({
  filteredTrades,
  storeActions,
  expandedId,
  setExpandedId,
  focusedIdx,
  setFocusedIdx,
  bulkMode,
  setBulkMode,
  bulk,
  trades,
  openAddTrade,
  handleExportCSV,
  modalsOpen,
}) {
  // Keep store actions in a ref so undo/redo always uses latest
  const storeActionsRef = useRef(storeActions);
  storeActionsRef.current = storeActions;

  // ─── Page-level shortcuts ──────────────────────────────────
  useHotkeys(
    [
      {
        key: 'j',
        description: 'Focus next trade',
        handler: () =>
          setFocusedIdx((i) => {
            const next = Math.min(filteredTrades.length - 1, i + 1);
            if (filteredTrades[next]) setExpandedId(filteredTrades[next].id);
            return next;
          }),
      },
      {
        key: 'k',
        description: 'Focus previous trade',
        handler: () =>
          setFocusedIdx((i) => {
            const prev = Math.max(0, i - 1);
            if (filteredTrades[prev]) setExpandedId(filteredTrades[prev].id);
            return prev;
          }),
      },
      {
        key: 'e',
        description: 'Edit focused trade',
        handler: () => {
          if (expandedId) {
            const trade = trades.find((t) => t.id === expandedId);
            if (trade) {
              // Emit event so orchestrator can open the form
              window.dispatchEvent(new CustomEvent('charEdge:edit-trade', { detail: trade }));
            }
          }
        },
      },
      {
        key: 'd',
        description: 'Delete focused trade',
        handler: () => {
          if (expandedId) {
            window.dispatchEvent(new CustomEvent('charEdge:delete-confirm', { detail: expandedId }));
          }
        },
      },
      {
        key: 'Escape',
        description: 'Clear selection / collapse',
        allowInInput: true,
        handler: () => {
          if (bulkMode && bulk.hasSelection) {
            bulk.selectNone();
          } else if (bulkMode) {
            setBulkMode(false);
          } else if (expandedId) {
            setExpandedId(null);
          } else {
            setFocusedIdx(-1);
          }
        },
      },
      {
        key: 'Enter',
        description: 'Toggle expand focused trade',
        handler: () => {
          if (focusedIdx >= 0 && focusedIdx < filteredTrades.length) {
            const trade = filteredTrades[focusedIdx];
            setExpandedId((prev) => (prev === trade.id ? null : trade.id));
          }
        },
      },
      {
        key: 'b',
        description: 'Toggle bulk mode',
        handler: () => {
          setBulkMode(!bulkMode);
          if (bulkMode) bulk.selectNone();
        },
      },
      {
        key: 'n',
        description: 'New trade',
        handler: () => openAddTrade(),
      },
      {
        key: 'ctrl+f',
        description: 'Focus search',
        allowInInput: true,
        handler: () => {
          const searchInput = document.querySelector('input[aria-label="Filter trades"]');
          if (searchInput) searchInput.focus();
        },
      },
      {
        key: 'ctrl+e',
        description: 'Export CSV',
        allowInInput: true,
        handler: () => handleExportCSV(),
      },
    ],
    { scope: 'page:journal', enabled: !modalsOpen },
  );

  // ─── Global undo/redo ────────────────────────────────────────
  useHotkeys(
    [
      {
        key: 'ctrl+z',
        description: 'Undo last action',
        allowInInput: true,
        handler: () => {
          const entry = undoStack.undo();
          if (entry) {
            toast.success(executeUndo(entry, storeActionsRef.current) || 'Undone');
          } else {
            toast.info('Nothing to undo');
          }
        },
      },
      {
        key: 'ctrl+shift+z',
        description: 'Redo last undone action',
        allowInInput: true,
        handler: () => {
          const entry = undoStack.redo();
          if (entry) {
            toast.success(executeRedo(entry, storeActionsRef.current) || 'Redone');
          } else {
            toast.info('Nothing to redo');
          }
        },
      },
    ],
    { scope: 'global', enabled: true },
  );
}
