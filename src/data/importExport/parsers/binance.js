// charEdge — Binance Parser
// Supports: Binance Spot trade history CSV exports
// Headers: Date(UTC), Pair, Side, Price, Executed, Amount, Fee, Fee Coin
import { _uid, _parseNum, _parseDate } from '../helpers.js';

export function parseBinance(rows) {
  return rows
    .map((r) => {
      // Try multiple header variants Binance has used
      const pair = (r['Pair'] || r['Market'] || r['Symbol'] || '').trim().toUpperCase();
      if (!pair) return null;

      const rawSide = (r['Side'] || r['Type'] || '').toUpperCase().trim();
      if (!rawSide) return null;
      const isBuy = rawSide === 'BUY';

      const price = _parseNum(r['Price'] || r['Avg Trading Price'] || r['Order Price']);
      const qty = _parseNum(r['Executed'] || r['Filled'] || r['Amount'] || r['Quantity']) || 0;
      const total = _parseNum(r['Amount'] || r['Total'] || r['Order Amount']);
      const fee = _parseNum(r['Fee'] || r['Trading Fee'] || r['Commission']);
      const feeCoin = (r['Fee Coin'] || r['Fee Currency'] || '').trim();

      return {
        id: _uid(),
        date: _parseDate(r['Date(UTC)'] || r['Date'] || r['Time'] || r['Create Time']),
        symbol: pair,
        side: isBuy ? 'long' : 'short',
        entry: price,
        exit: null,
        quantity: Math.abs(qty),
        pnl: null,
        fees: fee,
        amount: total,
        assetClass: 'crypto',
        notes: `Imported from Binance${feeCoin ? ` | Fee: ${fee} ${feeCoin}` : ''}`,
      };
    })
    .filter(Boolean)
    .filter((t) => t.date && t.symbol);
}
