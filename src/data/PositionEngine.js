// ═══════════════════════════════════════════════════════════════════
// charEdge — Position Engine (Phase 8 Sprint 8.11)
//
// Computes live position state from trade journal entries.
// Groups trades by symbol, tracks average entry, current size,
// and unrealized P&L with real-time price feed integration.
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} Position
 * @property {string} symbol
 * @property {'long'|'short'|'flat'} direction
 * @property {number} size - Current position size (0 = flat)
 * @property {number} avgEntry - Average entry price
 * @property {number} costBasis - Total cost basis
 * @property {number} realizedPnl - Realized P&L from closed portions
 * @property {number} unrealizedPnl - Unrealized P&L at current price
 * @property {number} currentPrice - Latest market price
 * @property {Date} openedAt - When position was opened
 * @property {Object[]} fills - Individual fills that compose this position
 */

// ─── Position Calculator ────────────────────────────────────────

/**
 * Compute open positions from a list of trades.
 * Uses FIFO matching for partial closes.
 *
 * @param {Object[]} trades - All journal trades, ordered by date
 * @returns {Map<string, Position>} Open positions by symbol
 */
export function computePositions(trades) {
  const positions = new Map();

  // Sort trades by date
  const sorted = [...trades].sort((a, b) => {
    const da = new Date(a.date || 0).getTime();
    const db = new Date(b.date || 0).getTime();
    return da - db;
  });

  for (const trade of sorted) {
    const symbol = (trade.symbol || '').toUpperCase();
    if (!symbol) continue;

    const qty = Math.abs(parseFloat(trade.quantity || 0));
    const price = parseFloat(trade.price || trade.entry || 0);
    if (qty === 0 || price === 0) continue;

    const side = (trade.side || '').toLowerCase();
    const isBuy = side === 'buy' || side === 'long' || side === 'bto';
    const signedQty = isBuy ? qty : -qty;

    if (!positions.has(symbol)) {
      positions.set(symbol, {
        symbol,
        direction: 'flat',
        size: 0,
        avgEntry: 0,
        costBasis: 0,
        realizedPnl: 0,
        unrealizedPnl: 0,
        currentPrice: 0,
        openedAt: trade.date,
        fills: [],
      });
    }

    const pos = positions.get(symbol);
    const prevSize = pos.size;
    const newSize = prevSize + signedQty;

    // Adding to position (same direction)
    if ((prevSize >= 0 && signedQty > 0) || (prevSize <= 0 && signedQty < 0)) {
      // Weighted average entry
      const totalCost = Math.abs(prevSize) * pos.avgEntry + qty * price;
      pos.avgEntry = totalCost / (Math.abs(prevSize) + qty);
      pos.costBasis = totalCost;
      pos.size = newSize;
    }
    // Reducing or closing position (opposite direction)
    else {
      const closedQty = Math.min(Math.abs(signedQty), Math.abs(prevSize));
      const pnlPerUnit = isBuy
        ? pos.avgEntry - price  // Closing a short = buy to cover
        : price - pos.avgEntry; // Closing a long = sell

      pos.realizedPnl += pnlPerUnit * closedQty;
      pos.size = newSize;

      // If flipped direction, recalculate
      if (Math.abs(newSize) > 0 && Math.sign(newSize) !== Math.sign(prevSize)) {
        pos.avgEntry = price;
        pos.costBasis = Math.abs(newSize) * price;
        pos.openedAt = trade.date;
      }
    }

    // Direction
    pos.direction = pos.size > 0 ? 'long' : pos.size < 0 ? 'short' : 'flat';

    pos.fills.push({
      date: trade.date,
      side,
      quantity: qty,
      price,
      _tradeId: trade.id,
    });
  }

  return positions;
}

/**
 * Get only open (non-flat) positions.
 *
 * @param {Object[]} trades
 * @returns {Position[]}
 */
export function getOpenPositions(trades) {
  const positions = computePositions(trades);
  return Array.from(positions.values()).filter((p) => p.size !== 0);
}

/**
 * Update positions with current market prices.
 *
 * @param {Position[]} positions
 * @param {Record<string, number>} prices - symbol → current price
 * @returns {Position[]} Updated positions with unrealized P&L
 */
export function updateWithPrices(positions, prices) {
  return positions.map((pos) => {
    const currentPrice = prices[pos.symbol] || pos.currentPrice || 0;
    const unrealizedPnl = pos.size !== 0 && currentPrice > 0
      ? (currentPrice - pos.avgEntry) * pos.size
      : 0;

    return {
      ...pos,
      currentPrice,
      unrealizedPnl,
    };
  });
}

/**
 * Compute total portfolio exposure.
 *
 * @param {Position[]} positions
 * @returns {{ longExposure: number, shortExposure: number, netExposure: number, grossExposure: number }}
 */
export function computeExposure(positions) {
  let longExposure = 0;
  let shortExposure = 0;

  for (const pos of positions) {
    const notional = Math.abs(pos.size) * (pos.currentPrice || pos.avgEntry);
    if (pos.direction === 'long') longExposure += notional;
    else if (pos.direction === 'short') shortExposure += notional;
  }

  return {
    longExposure,
    shortExposure,
    netExposure: longExposure - shortExposure,
    grossExposure: longExposure + shortExposure,
  };
}

export default { computePositions, getOpenPositions, updateWithPrices, computeExposure };
