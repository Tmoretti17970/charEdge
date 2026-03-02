// charEdge — NinjaTrader Parser
import { _uid, _parseNum, _parseDate } from '../helpers.js';

export function parseNinjaTrader(rows) {
  return rows
    .map((r) => {
      const side = (r['Market pos.'] || r['Type'] || '').toLowerCase().includes('long') ? 'long' : 'short';
      return {
        id: _uid(),
        date: _parseDate(r['Entry time'] || r['Entry Time']),
        closeDate: _parseDate(r['Exit time'] || r['Exit Time']),
        symbol: r['Instrument'] || '',
        side,
        entry: _parseNum(r['Entry price'] || r['Entry Price']),
        exit: _parseNum(r['Exit price'] || r['Exit Price']),
        quantity: _parseNum(r['Quantity'] || r['Qty']) || 1,
        pnl: _parseNum(r['Profit'] || r['P&L'] || r['Net profit']),
        fees: _parseNum(r['Commission'] || r['Comm.']),
        assetClass: 'futures',
        notes: `Imported from NinjaTrader`,
      };
    })
    .filter((t) => t.date && t.symbol);
}
