// ═══════════════════════════════════════════════════════════════════
// charEdge v10.6 — Chart Trade Handler Hook
// Sprint 10 C10.8: Connects chart canvas clicks to trade entry
// workflow. Handles entry/SL/TP placement and context menu.
//
// Sprint 11 fix: Use getState() for action functions to avoid
// subscribing to entire store (prevents infinite re-render loops).
// ═══════════════════════════════════════════════════════════════════

import { useCallback } from 'react';
import { useChartCoreStore } from '../../../../state/chart/useChartCoreStore';
import { useChartFeaturesStore } from '../../../../state/chart/useChartFeaturesStore';
import { useChartTradeStore } from '../../../../state/chart/useChartTradeStore';
import { useAlertStore } from '../../../../state/useAlertStore';
import toast from '../../ui/Toast.jsx';

/**
 * Hook providing chart click handlers for trade mode.
 * @returns {Object} handlers for chart events
 */
export function useChartTradeHandler() {
  // Only subscribe to the values we read during render
  const tradeMode = useChartFeaturesStore((s) => s.tradeMode);
  const tradeStep = useChartFeaturesStore((s) => s.tradeStep);
  const addAlert = useAlertStore((s) => s.addAlert);
  const symbol = useChartCoreStore((s) => s.symbol);

  /**
   * Handle left-click on chart canvas.
   * In trade mode: set entry → SL → TP sequentially.
   */
  const handleChartClick = useCallback(
    (price, barIdx) => {
      if (!tradeMode) return false;

      const actions = useChartCoreStore.getState();
      switch (tradeStep) {
        case 'entry':
          actions.setEntry(price, barIdx);
          toast.info(`Entry set @ $${price.toFixed(2)}`);
          return true;
        case 'sl':
          actions.setSL(price, barIdx);
          toast.info(`Stop Loss set @ $${price.toFixed(2)}`);
          return true;
        case 'tp':
          actions.setTP(price, barIdx);
          toast.info(`Target set @ $${price.toFixed(2)}`);
          return true;
        default:
          return false;
      }
    },
    [tradeMode, tradeStep],
  );

  /**
   * Handle right-click on chart canvas → open context menu.
   */
  const handleContextMenu = useCallback((e, price, barIdx, date) => {
    e.preventDefault();
    useChartCoreStore.getState().setContextMenu({
      x: e.clientX,
      y: e.clientY,
      price,
      barIdx,
      date,
    });
  }, []);

  /**
   * Context menu action handlers.
   */
  const contextMenuHandlers = {
    onSetEntry: (price, barIdx) => {
      const a = useChartCoreStore.getState();
      if (!a.tradeMode) a.enterTradeMode('long');
      a.setEntry(price, barIdx);
      toast.info(`Entry set @ $${price.toFixed(2)}`);
    },
    onSetSL: (price, barIdx) => {
      useChartTradeStore.getState().setSL(price, barIdx);
      toast.info(`Stop Loss set @ $${price.toFixed(2)}`);
    },
    onSetTP: (price, barIdx) => {
      useChartTradeStore.getState().setTP(price, barIdx);
      toast.info(`Target set @ $${price.toFixed(2)}`);
    },
    onLongEntry: (price, barIdx) => {
      const a = useChartCoreStore.getState();
      a.enterTradeMode('long');
      a.setEntry(price, barIdx);
      toast.info(`Long entry set @ $${price.toFixed(2)} — click to set SL`);
    },
    onShortEntry: (price, barIdx) => {
      const a = useChartCoreStore.getState();
      a.enterTradeMode('short');
      a.setEntry(price, barIdx);
      toast.info(`Short entry set @ $${price.toFixed(2)} — click to set SL`);
    },
    onAddAlert: (price, condition) => {
      if (addAlert) {
        const cond = condition || 'cross_above';
        const labels = {
          above: '↑ Above',
          below: '↓ Below',
          cross_above: '↗ Cross Above',
          cross_below: '↘ Cross Below',
        };
        addAlert({ symbol, condition: cond, price });
        toast.success(`Alert ${labels[cond] || cond} @ $${price.toFixed(2)}`);
      }
    },
    onQuickJournal: () => {
      useChartFeaturesStore.getState().toggleQuickJournal();
    },
    onCopyPrice: (price) => {
      navigator.clipboard?.writeText(price.toFixed(2));
      toast.info(`$${price.toFixed(2)} copied`);
    },
    onExitTradeMode: () => {
      useChartFeaturesStore.getState().exitTradeMode();
      toast.info('Trade mode cancelled');
    },
  };

  return {
    handleChartClick,
    handleContextMenu,
    contextMenuHandlers,
  };
}
