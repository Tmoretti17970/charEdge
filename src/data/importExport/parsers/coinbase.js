// charEdge — Coinbase Parser
// Supports: Coinbase transaction history / fills CSV
// Headers: Timestamp, Transaction Type, Asset, Quantity Transacted, Price Currency, Price at Transaction, Subtotal, Total, Fees and/or Notes
import { _uid, _parseNum, _parseDate } from '../helpers.js';

const TRADE_TYPES = new Set(['BUY', 'SELL', 'ADVANCED_TRADE_FILL']);

export function parseCoinbase(rows) {
  return rows
    .map((r) => {
      const txType = (r['Transaction Type'] || r['Type'] || r['trade type'] || '').toUpperCase().trim();
      if (!TRADE_TYPES.has(txType) && txType !== 'SELL' && txType !== 'BUY') return null;

      const symbol = (r['Asset'] || r['Size Unit'] || r['Product'] || '').trim().toUpperCase();
      if (!symbol) return null;

      const isBuy = txType === 'BUY' || txType === 'ADVANCED_TRADE_FILL';
      const price = _parseNum(
        r['Spot Price at Transaction'] || r['Price at Transaction'] || r['Price / Fee / Total'] || r['Price']
      );
      const qty = _parseNum(r['Quantity Transacted'] || r['Size'] || r['Quantity']) || 0;
      const fees = _parseNum(r['Fees and/or Spread'] || r['Fees'] || r['Fee']);
      const total = _parseNum(r['Total (inclusive of fees and/or spread)'] || r['Total'] || r['Subtotal']);
      const currency = (r['Price Currency'] || r['Price/Fee/Total Unit'] || 'USD').trim();

      return {
        id: _uid(),
        date: _parseDate(r['Timestamp'] || r['Created at'] || r['Date']),
        symbol,
        side: isBuy ? 'long' : 'short',
        entry: price,
        exit: null,
        quantity: Math.abs(qty),
        pnl: null,
        fees,
        amount: total,
        assetClass: 'crypto',
        notes: `Imported from Coinbase | ${currency}${r['Notes'] ? ` | ${r['Notes']}` : ''}`,
      };
    })
    .filter(Boolean)
    .filter((t) => t.date && t.symbol);
}
