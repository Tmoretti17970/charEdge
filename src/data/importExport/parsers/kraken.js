// charEdge — Kraken Parser
// Supports: Kraken trades / ledger CSV exports
// Headers (trades): txid, ordertxid, pair, time, type, ordertype, price, cost, fee, vol, margin, misc, ledgers
// Headers (ledger): refid, time, type, subtype, aclass, asset, amount, fee, balance
import { _uid, _parseNum, _parseDate } from '../helpers.js';

const TRADE_TYPES = new Set(['BUY', 'SELL']);

export function parseKraken(rows) {
  return rows
    .map((r) => {
      // Kraken trades export
      const type = (r['type'] || r['Type'] || '').toUpperCase().trim();
      if (!TRADE_TYPES.has(type)) return null;

      const pair = (r['pair'] || r['Pair'] || r['asset'] || r['Asset'] || '').trim().toUpperCase();
      if (!pair) return null;

      // Normalize Kraken pairs: "XXBTZUSD" → "BTCUSD", "XETHZUSD" → "ETHUSD"
      const symbol = _normalizeKrakenPair(pair);

      const isBuy = type === 'BUY';
      const price = _parseNum(r['price'] || r['Price']);
      const vol = _parseNum(r['vol'] || r['Vol'] || r['Volume'] || r['amount'] || r['Amount']) || 0;
      const cost = _parseNum(r['cost'] || r['Cost']);
      const fee = _parseNum(r['fee'] || r['Fee']);

      return {
        id: _uid(),
        date: _parseDate(r['time'] || r['Time'] || r['Date']),
        symbol,
        side: isBuy ? 'long' : 'short',
        entry: price,
        exit: null,
        quantity: Math.abs(vol),
        pnl: null,
        fees: fee,
        amount: cost,
        assetClass: 'crypto',
        orderType: (r['ordertype'] || r['Order Type'] || '').toLowerCase() || null,
        notes: `Imported from Kraken${r['txid'] ? ` | txid: ${r['txid']}` : ''}`,
      };
    })
    .filter(Boolean)
    .filter((t) => t.date && t.symbol);
}

/**
 * Normalize Kraken's unusual pair naming convention.
 * "XXBTZUSD" → "BTCUSD", "XETHZUSD" → "ETHUSD", "XXRPZUSD" → "XRPUSD"
 */
function _normalizeKrakenPair(pair) {
  // Strip leading X and Z separators used by Kraken
  const s = pair
    .replace(/^X([A-Z]{3,4})Z([A-Z]{3,4})$/, '$1$2')
    .replace(/^XX/, 'X') // XXBT → XBT
    .replace(/^XBT/, 'BTC'); // XBT → BTC (Kraken's name for Bitcoin)
  return s;
}
