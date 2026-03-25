// ═══════════════════════════════════════════════════════════════════
// charEdge — useOpenPositions Hook (Phase 5: Merged)
//
// Returns open (unrealized) positions. If symbol provided, filters
// to that symbol. If no symbol, returns ALL open positions.
// A trade is "open" when: pnl === 0, no exit price, and source
// is 'chart-quick-trade' or 'radial-menu'.
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useJournalStore } from '../state/useJournalStore';

/**
 * @param {string} [symbol] — Optional. If provided, filter to this symbol.
 * @returns {Array<{ id: string, side: string, entry: number, symbol: string, date: string, source: string }>}
 */
export function useOpenPositions(symbol) {
  const trades = useJournalStore((s) => s.trades);

  return useMemo(() => {
    if (!trades?.length) return [];

    const validSources = ['chart-quick-trade', 'radial-menu'];
    const symUpper = symbol?.toUpperCase();

    return trades.filter((t) => {
      if (!validSources.includes(t.source)) return false;
      if (t.pnl !== 0) return false;
      if (t.exit || t.exitPrice || t.closePrice) return false;
      if (typeof t.entry !== 'number') return false;

      // If no symbol filter, return all open positions
      if (!symUpper) return true;

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
