// ═══════════════════════════════════════════════════════════════════
// charEdge — useAllOpenPositions Hook
//
// Returns ALL open (unrealized) positions across every symbol.
// A trade is "open" when: pnl === 0, no exit price, and source
// is 'chart-quick-trade' (from one-click BUY/SELL).
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useJournalStore } from '../state/useJournalStore';

/**
 * @returns {Array<{ id: string, side: string, entry: number, symbol: string, date: string, source: string }>}
 */
export function useAllOpenPositions() {
  const trades = useJournalStore((s) => s.trades);

  return useMemo(() => {
    if (!trades?.length) return [];

    return trades.filter((t) => {
      if (t.source !== 'chart-quick-trade') return false;
      if (t.pnl !== 0) return false;
      if (t.exit || t.exitPrice || t.closePrice) return false;
      if (typeof t.entry !== 'number') return false;
      return true;
    });
  }, [trades]);
}

export default useAllOpenPositions;
