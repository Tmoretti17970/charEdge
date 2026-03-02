// charEdge — Bybit Parser
// Supports: Bybit trade records CSV exports (Spot + Derivatives)
// Headers: Order Id, Symbol, Side, Fill Price, Quantity, Order Price, Fee, Exec Time, ...
import { _uid, _parseNum, _parseDate } from '../helpers.js';

export function parseBybit(rows) {
  return rows
    .map((r) => {
      const symbol = (
        r['Symbol'] || r['Contracts'] || r['Contract'] || r['Pair'] || ''
      ).trim().toUpperCase();
      if (!symbol) return null;

      const rawSide = (r['Side'] || r['Direction'] || '').toUpperCase().trim();
      if (!rawSide) return null;
      const isBuy = rawSide === 'BUY' || rawSide === 'LONG' || rawSide === 'OPEN_LONG';

      const price = _parseNum(
        r['Fill Price'] || r['Avg. Fill Price'] || r['Order Price'] || r['Exec Price'] || r['Price']
      );
      const qty = _parseNum(
        r['Filled'] || r['Qty'] || r['Quantity'] || r['Exec Qty'] || r['Order Qty']
      ) || 0;
      const fee = _parseNum(r['Fee'] || r['Trading Fee'] || r['Exec Fee'] || r['Commission']);
      const pnl = _parseNum(r['Closed PnL'] || r['Realized PnL'] || r['PnL']);

      // Derivative-specific fields
      const leverage = _parseNum(r['Leverage']);
      const closeDate = _parseDate(r['Close Time'] || r['Exec Time']);

      return {
        id: _uid(),
        date: _parseDate(
          r['Exec Time'] || r['Create Time'] || r['Time'] || r['Order Time'] || r['Date']
        ),
        symbol: _normalizeBybitSymbol(symbol),
        side: isBuy ? 'long' : 'short',
        entry: price,
        exit: null,
        quantity: Math.abs(qty),
        pnl: pnl,
        fees: fee,
        assetClass: 'crypto',
        leverage: leverage || null,
        closeDate: closeDate || null,
        notes: `Imported from Bybit${r['Order Id'] ? ` | Order: ${r['Order Id']}` : ''}`,
      };
    })
    .filter(Boolean)
    .filter((t) => t.date && t.symbol);
}

/**
 * Normalize Bybit symbols: "BTCUSDT" stays, "BTCUSD" stays,
 * strip inverse perpetual suffixes if present.
 */
function _normalizeBybitSymbol(sym) {
  // Remove trailing numbers for quarterly futures: "BTCUSD0927" → "BTCUSD"
  return sym.replace(/\d{4}$/, '');
}
