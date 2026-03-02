// charEdge — ThinkorSwim Parser
import { _uid, _parseNum, _parseDate } from '../helpers.js';

export function parseThinkorSwim(rows) {
  return rows
    .map((r) => {
      const posEffect = (r['Pos Effect'] || r['Side'] || '').toUpperCase();
      const side = posEffect.includes('TO OPEN')
        ? (r['Side'] || '').includes('BUY')
          ? 'long'
          : 'short'
        : (r['Side'] || '').includes('SELL')
          ? 'long'
          : 'short';
      return {
        id: _uid(),
        date: _parseDate(r['Exec Time'] || r['Date']),
        symbol: (r['Symbol'] || r['Underlying'] || '').replace(/\s+/g, ''),
        side,
        entry: _parseNum(r['Price'] || r['Avg Price']),
        exit: null,
        quantity: _parseNum(r['Qty'] || r['Quantity']) || 1,
        pnl: _parseNum(r['P/L'] || r['P&L'] || r['Net Liq']),
        fees: _parseNum(r['Commission'] || r['Comm'] || r['Reg Fees']),
        assetClass: (r['Spread'] || r['Type'] || '').toLowerCase().includes('option') ? 'options' : 'equities',
        notes: `Imported from ThinkorSwim. ${r['Spread'] || ''}`.trim(),
      };
    })
    .filter((t) => t.date && t.symbol);
}
