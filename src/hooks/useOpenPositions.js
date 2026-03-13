// ═══════════════════════════════════════════════════════════════════
// charEdge — useOpenPositions Hook
//
// Returns open (unrealized) positions for a given symbol.
// A trade is "open" when: pnl === 0, no exit price, and source
// is 'chart-quick-trade' (from one-click BUY/SELL).
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useJournalStore } from '../state/useJournalStore';

/**
 * @param {string} symbol — Current chart symbol (e.g. 'BTC', 'BTCUSDT')
 * @returns {Array<{ id: string, side: string, entry: number, symbol: string, date: string, source: string }>}
 */
export function useOpenPositions(symbol) {
  const trades = useJournalStore((s) => s.trades);

  return useMemo(() => {
    if (!trades?.length || !symbol) return [];
    const symUpper = symbol.toUpperCase();

    return trades.filter((t) => {
      // Must be a chart quick trade with no realized P&L
      if (t.source !== 'chart-quick-trade') return false;
      if (t.pnl !== 0) return false;
      if (t.exit || t.exitPrice || t.closePrice) return false;
      if (typeof t.entry !== 'number') return false;

      // Match symbol (handles BTC vs BTCUSDT)
      const ts = (t.symbol || '').toUpperCase();
      return (
        ts === symUpper ||
        ts === symUpper + 'USDT' ||
        symUpper === ts + 'USDT' ||
        ts.includes(symUpper) ||
        symUpper.includes(ts)
      );
    });
  }, [trades, symbol]);
}

export default useOpenPositions;
