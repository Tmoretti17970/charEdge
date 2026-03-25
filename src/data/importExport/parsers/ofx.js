// ═══════════════════════════════════════════════════════════════════
// charEdge — OFX Parser (Phase 6 Sprint 6.6)
//
// Parses OFX (Open Financial Exchange) and QFX files.
// These are XML-based formats used by banks and brokerages.
// ═══════════════════════════════════════════════════════════════════

/**
 * Parse OFX/QFX file content into trade-like objects.
 * OFX is SGML-based (not strict XML), so we use regex parsing.
 *
 * @param {string} text - Raw OFX/QFX file content
 * @returns {{ trades: Object[], errors: string[] }}
 */
export function parseOFX(text) {
  const trades = [];
  const errors = [];

  try {
    // Extract investment transactions (INVSTMTTRNRS → INVTRANLIST → BUYSTOCK/SELLSTOCK)
    const buyMatches = text.match(/<BUYSTOCK[\s\S]*?<\/BUYSTOCK>/gi) || [];
    const sellMatches = text.match(/<SELLSTOCK[\s\S]*?<\/SELLSTOCK>/gi) || [];
    const buyOpt = text.match(/<BUYOPT[\s\S]*?<\/BUYOPT>/gi) || [];
    const sellOpt = text.match(/<SELLOPT[\s\S]*?<\/SELLOPT>/gi) || [];
    // Also look for generic INVBANKTRAN for simpler brokerages
    const bankTrans = text.match(/<INVBANKTRAN[\s\S]*?<\/INVBANKTRAN>/gi) || [];

    const allTrans = [
      ...buyMatches.map((m) => ({ raw: m, side: 'BUY' })),
      ...sellMatches.map((m) => ({ raw: m, side: 'SELL' })),
      ...buyOpt.map((m) => ({ raw: m, side: 'BUY' })),
      ...sellOpt.map((m) => ({ raw: m, side: 'SELL' })),
      ...bankTrans.map((m) => ({ raw: m, side: 'UNKNOWN' })),
    ];

    for (const { raw, side } of allTrans) {
      const trade = {};

      // Extract common fields using OFX tags
      const dateMatch = raw.match(/<DTTRADE>([\d]+)/);
      const symbolMatch = raw.match(/<TICKER>(.*?)(?:<|$)/m) || raw.match(/<SECID>[\s\S]*?<UNIQUEID>(.*?)(?:<|$)/m);
      const qtyMatch = raw.match(/<UNITS>([\d.-]+)/);
      const priceMatch = raw.match(/<UNITPRICE>([\d.-]+)/);
      const totalMatch = raw.match(/<TOTAL>([\d.-]+)/);
      const commMatch = raw.match(/<COMMISSION>([\d.-]+)/) || raw.match(/<FEES>([\d.-]+)/);
      const memoMatch = raw.match(/<MEMO>(.*?)(?:<|$)/m);

      if (dateMatch) {
        const d = dateMatch[1];
        trade.date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
      }
      trade.symbol = symbolMatch ? symbolMatch[1].trim() : '';
      trade.side = side;
      trade.quantity = qtyMatch ? Math.abs(parseFloat(qtyMatch[1])) : 0;
      trade.price = priceMatch ? parseFloat(priceMatch[1]) : 0;
      trade.pnl = totalMatch ? parseFloat(totalMatch[1]) : 0;
      trade.commission = commMatch ? Math.abs(parseFloat(commMatch[1])) : 0;
      trade.notes = memoMatch ? memoMatch[1].trim() : '';

      if (trade.date && trade.symbol) {
        trades.push(trade);
      } else {
        errors.push(`Skipped transaction: missing date or symbol`);
      }
    }

    // Fallback: try parsing bank statement transactions (STMTTRN)
    if (trades.length === 0) {
      const stmtTrans = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
      for (const raw of stmtTrans) {
        const dateMatch = raw.match(/<DTPOSTED>([\d]+)/);
        const amountMatch = raw.match(/<TRNAMT>([\d.-]+)/);
        const nameMatch = raw.match(/<NAME>(.*?)(?:<|$)/m);
        const memoMatch = raw.match(/<MEMO>(.*?)(?:<|$)/m);

        if (dateMatch && amountMatch) {
          const d = dateMatch[1];
          const amount = parseFloat(amountMatch[1]);
          trades.push({
            date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
            symbol: (nameMatch?.[1] || 'UNKNOWN').trim(),
            side: amount >= 0 ? 'BUY' : 'SELL',
            quantity: 1,
            price: Math.abs(amount),
            pnl: amount,
            notes: memoMatch?.[1]?.trim() || '',
          });
        }
      }
    }
  } catch (e) {
    errors.push(`OFX parse error: ${e.message}`);
  }

  return { trades, errors };
}

/**
 * Parse QIF (Quicken Interchange Format) file content.
 * QIF uses line-based records separated by ^ characters.
 *
 * @param {string} text - Raw QIF content
 * @returns {{ trades: Object[], errors: string[] }}
 */
export function parseQIF(text) {
  const trades = [];
  const errors = [];

  try {
    const records = text.split('^').filter((r) => r.trim());

    for (const record of records) {
      const lines = record.trim().split('\n');
      const trade = {};

      for (const line of lines) {
        const code = line.charAt(0);
        const value = line.slice(1).trim();

        switch (code) {
          case 'D': // Date
            trade.date = value.replace(/\//g, '-');
            break;
          case 'T': // Amount
          case 'U': // Amount (alternative)
            trade.pnl = parseFloat(value.replace(/,/g, ''));
            break;
          case 'N': // Action/Check number (used as side for investment QIF)
            trade.side = value.toUpperCase().includes('SELL') ? 'SELL' : 'BUY';
            trade.symbol = trade.symbol || value;
            break;
          case 'Y': // Security name
            trade.symbol = value;
            break;
          case 'I': // Price
            trade.price = parseFloat(value.replace(/,/g, ''));
            break;
          case 'Q': // Quantity
            trade.quantity = Math.abs(parseFloat(value.replace(/,/g, '')));
            break;
          case 'M': // Memo
          case 'P': // Payee
            trade.notes = (trade.notes ? trade.notes + ' ' : '') + value;
            break;
          case 'O': // Commission
            trade.commission = Math.abs(parseFloat(value.replace(/,/g, '')));
            break;
        }
      }

      if (trade.date && (trade.symbol || trade.pnl !== undefined)) {
        // Normalize date to ISO format if needed
        if (trade.date && !trade.date.match(/^\d{4}/)) {
          // Try to parse MM-DD-YYYY or MM/DD/YYYY
          const parts = trade.date.split(/[-/]/);
          if (parts.length === 3) {
            const [m, d, y] = parts;
            trade.date = `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          }
        }
        trades.push(trade);
      }
    }
  } catch (e) {
    errors.push(`QIF parse error: ${e.message}`);
  }

  return { trades, errors };
}

export default { parseOFX, parseQIF };
