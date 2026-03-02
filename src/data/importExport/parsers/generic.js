// charEdge — Generic CSV Parser
import { _uid, _parseNum, _parseDate } from '../helpers.js';

export function parseGenericCSV(rows) {
  return rows
    .map((r) => {
      const symbol = r['Symbol'] || r['symbol'] || r['Ticker'] || r['ticker'] || r['Instrument'] || '';
      const date = _parseDate(
        r['Date'] || r['date'] || r['Time'] || r['Timestamp'] || r['Entry Date'] || r['datetime'],
      );
      const pnl = _parseNum(r['P&L'] || r['PnL'] || r['pnl'] || r['Profit'] || r['profit'] || r['Net P&L'] || r['P/L']);
      const side = (r['Side'] || r['side'] || r['Direction'] || r['Type'] || r['B/S'] || '').toLowerCase();

      return {
        id: _uid(),
        date,
        symbol,
        side:
          side.includes('buy') || side.includes('long')
            ? 'long'
            : side.includes('sell') || side.includes('short')
              ? 'short'
              : 'long',
        entry: _parseNum(r['Entry'] || r['entry'] || r['Entry Price'] || r['Open Price'] || r['Price']),
        exit: _parseNum(r['Exit'] || r['exit'] || r['Exit Price'] || r['Close Price']),
        quantity: _parseNum(r['Quantity'] || r['Qty'] || r['quantity'] || r['Shares'] || r['Size']) || 1,
        pnl,
        fees: _parseNum(r['Fees'] || r['fees'] || r['Commission'] || r['commission']),
        notes: r['Notes'] || r['notes'] || r['Comment'] || '',
      };
    })
    .filter((t) => t.date && t.symbol);
}
