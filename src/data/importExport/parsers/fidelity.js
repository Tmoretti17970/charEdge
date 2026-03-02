// charEdge — Fidelity Parser
// Supports: Fidelity account activity / history CSV exports
// Headers: Run Date, Account, Action, Symbol, Description, Type, Quantity, Price ($), Commission ($), Fees ($), Accrued Interest ($), Amount ($), Settlement Date
import { _uid, _parseNum, _parseDate } from '../helpers.js';

const TRADE_ACTIONS = new Set([
  'YOU BOUGHT', 'YOU SOLD', 'BOUGHT', 'SOLD',
  'REINVESTMENT', 'IN LIEU OF', // dividend reinvestment
]);

export function parseFidelity(rows) {
  return rows
    .map((r) => {
      const action = (r['Action'] || r['Transaction Type'] || r['Type'] || '').toUpperCase().trim();

      // Match trade actions (Fidelity uses verbose action strings)
      const isTrade = [...TRADE_ACTIONS].some((a) => action.includes(a));
      if (!isTrade) return null;

      const symbol = (r['Symbol'] || r['Security'] || '').trim().toUpperCase();
      if (!symbol || symbol === 'PENDING ACTIVITY' || symbol === 'NO DESCRIPTION') return null;

      const isBuy = action.includes('BOUGHT') || action.includes('REINVESTMENT');

      const price = _parseNum(r['Price ($)'] || r['Price'] || r['Unit Price']);
      const qty = _parseNum(r['Quantity'] || r['Shares'] || r['Amount']) || 0;
      const commission = _parseNum(r['Commission ($)'] || r['Commission']);
      const fees = _parseNum(r['Fees ($)'] || r['Fees']);
      const totalFees = ((commission || 0) + (fees || 0)) || null;
      const amount = _parseNum(r['Amount ($)'] || r['Amount'] || r['Total']);
      const desc = (r['Description'] || r['Security Description'] || '').trim();

      return {
        id: _uid(),
        date: _parseDate(r['Run Date'] || r['Trade Date'] || r['Date']),
        symbol,
        side: isBuy ? 'long' : 'short',
        entry: price,
        exit: null,
        quantity: Math.abs(qty),
        pnl: null,
        fees: totalFees,
        amount: amount,
        assetClass: 'stock',
        notes: `Imported from Fidelity${desc ? ` | ${desc}` : ''}`,
      };
    })
    .filter(Boolean)
    .filter((t) => t.date && t.symbol);
}
