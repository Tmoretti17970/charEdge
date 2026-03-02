// charEdge — Tradovate Parser
import { _uid, _parseNum, _parseDate } from '../helpers.js';

export function parseTradovate(rows) {
  return rows
    .map((r) => {
      const side = (r['B/S'] || r['Buy/Sell'] || '').toLowerCase().includes('buy') ? 'long' : 'short';
      return {
        id: _uid(),
        date: _parseDate(r['Date'] || r['Time'] || r['Fill Time']),
        symbol: r['Instrument'] || r['Contract'] || '',
        side,
        entry: _parseNum(r['Price'] || r['Fill Price'] || r['Avg Price']),
        exit: _parseNum(r['Exit Price'] || r['Close Price']),
        quantity: _parseNum(r['Qty'] || r['Quantity'] || r['Filled Qty']) || 1,
        pnl: _parseNum(r['P&L'] || r['PnL'] || r['Profit/Loss'] || r['Net P&L']),
        fees: _parseNum(r['Commission'] || r['Fees'] || r['Total Fees']),
        assetClass: 'futures',
        notes: `Imported from Tradovate`,
      };
    })
    .filter((t) => t.date && t.symbol);
}
