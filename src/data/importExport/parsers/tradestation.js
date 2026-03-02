// charEdge — TradeStation Parser
import { _uid, _parseNum, _parseDate } from '../helpers.js';

export function parseTradeStation(rows) {
  return rows
    .map((r) => {
      const side = (r['Type'] || r['Side'] || '').toLowerCase().includes('buy') ? 'long' : 'short';
      return {
        id: _uid(),
        date: _parseDate(r['Entry Date'] || r['Date']),
        closeDate: _parseDate(r['Exit Date'] || r['Close Date']),
        symbol: r['Symbol'] || '',
        side,
        entry: _parseNum(r['Entry Price']),
        exit: _parseNum(r['Close Price'] || r['Exit Price']),
        quantity: _parseNum(r['Quantity'] || r['Shares']) || 1,
        pnl: _parseNum(r['Profit'] || r['P&L'] || r['Net Profit']),
        fees: _parseNum(r['Commission'] || r['Comm']),
        assetClass: 'equities',
        notes: `Imported from TradeStation`,
      };
    })
    .filter((t) => t.date && t.symbol);
}
