// charEdge — Interactive Brokers (Flex Query) Parser
import { _uid, _parseNum, _parseDate } from '../helpers.js';

export function parseIBKR(rows) {
  const tradeRows = rows.filter(
    (r) =>
      (r['DataDiscriminator'] || '').toLowerCase().includes('trade') ||
      (r['Header'] || '').toLowerCase().includes('trade') ||
      r['TradeID'],
  );

  return (tradeRows.length > 0 ? tradeRows : rows)
    .map((r) => {
      const side = (r['Buy/Sell'] || r['Side'] || r['Code'] || '').toUpperCase();
      return {
        id: _uid(),
        date: _parseDate(r['TradeDate'] || r['DateTime'] || r['Date/Time'] || r['Date']),
        symbol: r['Symbol'] || r['UnderlyingSymbol'] || '',
        side: side.includes('BUY') || side.includes('BOT') ? 'long' : 'short',
        entry: _parseNum(r['TradePrice'] || r['Price'] || r['T. Price']),
        exit: null,
        quantity: Math.abs(_parseNum(r['Quantity'] || r['Shares']) || 1),
        pnl: _parseNum(r['FifoPnlRealized'] || r['RealizedP/L'] || r['MTM P/L'] || r['NetCash']),
        fees: _parseNum(r['IBCommission'] || r['Commission'] || r['Comm/Fee']),
        assetClass:
          (r['AssetClass'] || r['SecType'] || 'STK').toUpperCase() === 'STK'
            ? 'equities'
            : (r['AssetClass'] || '').toUpperCase() === 'OPT'
              ? 'options'
              : (r['AssetClass'] || '').toUpperCase() === 'FUT'
                ? 'futures'
                : 'equities',
        notes: `Imported from IBKR. ${r['Description'] || ''}`.trim(),
      };
    })
    .filter((t) => t.date && t.symbol);
}
