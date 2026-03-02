// charEdge — Robinhood Parser
import { _uid, _parseNum, _parseDate } from '../helpers.js';

export function parseRobinhood(rows) {
  return rows
    .map((r) => {
      const code = (r['Trans Code'] || '').toUpperCase().trim();
      if (!['BUY', 'SELL', 'BTO', 'STC', 'STO', 'BTC'].includes(code)) return null;

      const symbol = (r['Instrument'] || '').trim();
      if (!symbol) return null;

      const isBuy = code === 'BUY' || code === 'BTO' || code === 'BTC';
      const isOption = ['BTO', 'STC', 'STO', 'BTC'].includes(code);

      const rawPrice = r['Price'] || '';
      const price = _parseNum(String(rawPrice).replace(/^\$/, ''));

      const rawAmount = r['Amount'] || '';
      const amtStr = String(rawAmount).trim();
      const isNeg = amtStr.startsWith('(') && amtStr.endsWith(')');
      const amount = _parseNum(isNeg ? amtStr.slice(1, -1) : amtStr);
      const signedAmount = isNeg ? -(amount || 0) : amount;

      return {
        id: _uid(),
        date: _parseDate(r['Activity Date']),
        symbol,
        side: isBuy ? 'long' : 'short',
        entry: price,
        exit: null,
        quantity: Math.abs(_parseNum(r['Quantity']) || 0),
        pnl: null,
        fees: null,
        amount: signedAmount,
        assetClass: isOption ? 'options' : 'stock',
        positionEffect: code === 'BTO' || code === 'STO' ? 'open' : code === 'STC' || code === 'BTC' ? 'close' : null,
        notes: `Imported from Robinhood | ${r['Description'] || ''}`.trim(),
      };
    })
    .filter(Boolean)
    .filter((t) => t.date && t.symbol);
}
