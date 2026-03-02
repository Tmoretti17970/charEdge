// charEdge — Webull Parser
import { _uid, _parseNum, _parseDate } from '../helpers.js';

export function parseWebull(rows) {
  return rows
    .map((r) => {
      const status = (r['Status'] || '').toLowerCase();
      if (status && status !== 'filled') return null;

      const symbol = r['Symbol'] || r['Underlying Symbol'] || '';
      if (!symbol) return null;

      const side = (r['Side'] || '').toUpperCase();
      const isBuy = side === 'BUY';
      const isOption = !!(r['Expiration Date'] || r['Strike Price'] || r['Option Type']);

      return {
        id: _uid(),
        date: _parseDate(r['Filled Time'] || r['Created Time']),
        symbol: symbol.trim(),
        side: isBuy ? 'long' : 'short',
        entry: _parseNum(r['Avg Price'] || r['Price']),
        exit: null,
        quantity: _parseNum(r['Filled Qty'] || r['Qty'] || r['Total Qty']) || 1,
        pnl: null,
        fees: null,
        assetClass: isOption ? 'options' : 'stock',
        optionType: r['Option Type'] || null,
        strikePrice: _parseNum(r['Strike Price']),
        expirationDate: _parseDate(r['Expiration Date']),
        notes: `Imported from Webull`,
      };
    })
    .filter(Boolean)
    .filter((t) => t.date && t.symbol);
}
