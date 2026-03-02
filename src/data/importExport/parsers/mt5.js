// charEdge — MetaTrader 5 Parser
import { _uid, _parseNum } from '../helpers.js';
import { parseGenericCSV } from './generic.js';

function _parseMT5Date(val) {
  if (!val) return null;
  const s = String(val).trim().replace(/\./g, '-').replace(' ', 'T');
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function _cleanMT5Symbol(raw) {
  let sym = (raw || '').replace(/\.(pro|raw|ecn|std|stp)$/i, '').toUpperCase();
  if (/^[A-Z]{6}m$/i.test(sym)) sym = sym.slice(0, -1);
  return sym;
}

function _guessMT5AssetClass(sym) {
  const s = sym.toUpperCase();
  if (/^(XAUUSD|XAGUSD|XBRUSD|XTIUSD|XPTUSD|US30|US500|US100|USTEC|UK100|DE30|JP225)/.test(s)) return 'futures';
  if (/^[A-Z]{6}$/.test(s)) return 'forex';
  return 'stock';
}

export function parseMT5(rows) {
  const firstRow = rows[0] || {};
  const hasCloseTime = 'Close Time' in firstRow || 'close time' in firstRow;
  const hasDirection = 'Direction' in firstRow || 'direction' in firstRow;

  if (hasCloseTime) {
    return rows
      .map((r) => {
        const type = (r['Type'] || '').toLowerCase();
        if (type !== 'buy' && type !== 'sell') return null;

        const symbol = _cleanMT5Symbol(r['Symbol']);
        if (!symbol) return null;

        return {
          id: _uid(),
          date: _parseMT5Date(r['Time'] || r['Open Time']),
          closeDate: _parseMT5Date(r['Close Time']),
          symbol,
          side: type === 'buy' ? 'long' : 'short',
          entry: _parseNum(r['Price'] || r['Open Price']),
          exit: _parseNum(r['Close Price']),
          quantity: _parseNum(r['Volume'] || r['Lots']) || 1,
          pnl: _parseNum(r['Profit']),
          fees: (_parseNum(r['Commission']) || 0) + (_parseNum(r['Fee']) || 0) + (_parseNum(r['Swap']) || 0),
          assetClass: _guessMT5AssetClass(symbol),
          notes: `Imported from MetaTrader 5`,
        };
      })
      .filter(Boolean)
      .filter((t) => t.date && t.symbol);
  }

  if (hasDirection) {
    const outDeals = rows.filter((r) => {
      const dir = (r['Direction'] || '').toLowerCase();
      return dir === 'out' || dir === 'in-out' || dir === 'in/out';
    });

    return (outDeals.length > 0 ? outDeals : rows)
      .map((r) => {
        const symbol = _cleanMT5Symbol(r['Symbol']);
        if (!symbol) return null;

        return {
          id: _uid(),
          date: _parseMT5Date(r['Time']),
          symbol,
          side: (r['Type'] || '').toLowerCase() === 'buy' ? 'short' : 'long',
          entry: null,
          exit: _parseNum(r['Price']),
          quantity: _parseNum(r['Volume']) || 1,
          pnl: _parseNum(r['Profit']),
          fees: (_parseNum(r['Commission']) || 0) + (_parseNum(r['Fee']) || 0) + (_parseNum(r['Swap']) || 0),
          assetClass: _guessMT5AssetClass(symbol),
          notes: `Imported from MetaTrader 5`,
        };
      })
      .filter(Boolean)
      .filter((t) => t.date && t.symbol);
  }

  return parseGenericCSV(rows);
}
