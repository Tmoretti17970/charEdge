// ═══════════════════════════════════════════════════════════════════
// charEdge — Tax Lot Engine (Phase 8 Sprint 8.13)
//
// Tax lot calculation with FIFO, LIFO, and average cost methods.
// Wash sale detection (30-day window), short-term vs long-term
// capital gains classification, and per-lot tracking.
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} TaxLot
 * @property {string} symbol
 * @property {Date} acquiredDate
 * @property {Date} soldDate
 * @property {number} quantity
 * @property {number} costBasis
 * @property {number} proceeds
 * @property {number} gainLoss
 * @property {'short-term'|'long-term'} holdingPeriod
 * @property {boolean} washSale
 * @property {number} washSaleDisallowed
 */

const ONE_YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;
const WASH_SALE_WINDOW = 30 * 24 * 60 * 60 * 1000; // 30 days

// ─── Lot Calculation ────────────────────────────────────────────

/**
 * Calculate tax lots from trades.
 *
 * @param {Object[]} trades - All journal trades
 * @param {'fifo'|'lifo'|'avgcost'} [method='fifo'] - Cost basis method
 * @returns {TaxLot[]} Calculated tax lots for closed positions
 */
export function calculateTaxLots(trades, method = 'fifo') {
  const sorted = [...trades]
    .filter((t) => t.date && t.symbol)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Group by symbol
  const bySymbol = {};
  for (const t of sorted) {
    const sym = (t.symbol || '').toUpperCase();
    if (!bySymbol[sym]) bySymbol[sym] = [];
    bySymbol[sym].push(t);
  }

  const taxLots = [];

  for (const [symbol, symbolTrades] of Object.entries(bySymbol)) {
    if (method === 'avgcost') {
      taxLots.push(..._avgCostLots(symbol, symbolTrades));
    } else {
      taxLots.push(..._fifoLifoLots(symbol, symbolTrades, method));
    }
  }

  // Detect wash sales
  _detectWashSales(taxLots);

  return taxLots.sort((a, b) => new Date(a.soldDate).getTime() - new Date(b.soldDate).getTime());
}

function _fifoLifoLots(symbol, trades, method) {
  const openLots = []; // Queue of open buy lots
  const closedLots = [];

  for (const trade of trades) {
    const side = (trade.side || '').toLowerCase();
    const isBuy = side === 'buy' || side === 'long' || side === 'bto';
    const qty = Math.abs(parseFloat(trade.quantity || 0));
    const price = parseFloat(trade.price || trade.entry || 0);
    const date = new Date(trade.date);

    if (isBuy) {
      openLots.push({ date, quantity: qty, price, remaining: qty });
    } else {
      // Close lots
      let toClose = qty;

      while (toClose > 0 && openLots.length > 0) {
        // FIFO = take from front, LIFO = take from back
        const lotIdx = method === 'lifo' ? openLots.length - 1 : 0;
        const lot = openLots[lotIdx];
        const closeQty = Math.min(toClose, lot.remaining);

        closedLots.push({
          symbol,
          acquiredDate: lot.date,
          soldDate: date,
          quantity: closeQty,
          costBasis: closeQty * lot.price,
          proceeds: closeQty * price,
          gainLoss: closeQty * (price - lot.price),
          holdingPeriod: (date.getTime() - lot.date.getTime()) > ONE_YEAR_MS ? 'long-term' : 'short-term',
          washSale: false,
          washSaleDisallowed: 0,
        });

        lot.remaining -= closeQty;
        toClose -= closeQty;

        if (lot.remaining <= 0) {
          openLots.splice(lotIdx, 1);
        }
      }
    }
  }

  return closedLots;
}

function _avgCostLots(symbol, trades) {
  let totalQty = 0;
  let totalCost = 0;
  const closedLots = [];

  for (const trade of trades) {
    const side = (trade.side || '').toLowerCase();
    const isBuy = side === 'buy' || side === 'long' || side === 'bto';
    const qty = Math.abs(parseFloat(trade.quantity || 0));
    const price = parseFloat(trade.price || trade.entry || 0);
    const date = new Date(trade.date);

    if (isBuy) {
      totalCost += qty * price;
      totalQty += qty;
    } else {
      const avgCost = totalQty > 0 ? totalCost / totalQty : 0;
      const closeQty = Math.min(qty, totalQty);

      if (closeQty > 0) {
        closedLots.push({
          symbol,
          acquiredDate: new Date(0), // Avg cost doesn't track specific lot dates
          soldDate: date,
          quantity: closeQty,
          costBasis: closeQty * avgCost,
          proceeds: closeQty * price,
          gainLoss: closeQty * (price - avgCost),
          holdingPeriod: 'short-term', // Conservative default for avg cost
          washSale: false,
          washSaleDisallowed: 0,
        });

        totalCost -= closeQty * avgCost;
        totalQty -= closeQty;
      }
    }
  }

  return closedLots;
}

// ─── Wash Sale Detection ────────────────────────────────────────

function _detectWashSales(lots) {
  // Sort by sold date
  lots.sort((a, b) => new Date(a.soldDate).getTime() - new Date(b.soldDate).getTime());

  for (let i = 0; i < lots.length; i++) {
    const lot = lots[i];
    if (lot.gainLoss >= 0) continue; // Only losses can be wash sales

    const soldTime = new Date(lot.soldDate).getTime();

    // Look for repurchase of same symbol within 30 days before or after
    for (let j = 0; j < lots.length; j++) {
      if (i === j) continue;
      if (lots[j].symbol !== lot.symbol) continue;

      const acquiredTime = new Date(lots[j].acquiredDate).getTime();
      const timeDiff = acquiredTime - soldTime;

      // Within ±30 day window
      if (Math.abs(timeDiff) <= WASH_SALE_WINDOW) {
        lot.washSale = true;
        lot.washSaleDisallowed = Math.abs(lot.gainLoss);
        break;
      }
    }
  }
}

// ─── Summary Report ─────────────────────────────────────────────

/**
 * Generate tax summary from lots.
 *
 * @param {TaxLot[]} lots
 * @param {number} [year] - Tax year to filter (optional)
 * @returns {Object} Tax summary
 */
export function generateTaxSummary(lots, year) {
  const filtered = year
    ? lots.filter((l) => new Date(l.soldDate).getFullYear() === year)
    : lots;

  const shortTerm = filtered.filter((l) => l.holdingPeriod === 'short-term');
  const longTerm = filtered.filter((l) => l.holdingPeriod === 'long-term');
  const washSales = filtered.filter((l) => l.washSale);

  const sumGainLoss = (arr) => arr.reduce((s, l) => s + l.gainLoss, 0);
  const sumProceeds = (arr) => arr.reduce((s, l) => s + l.proceeds, 0);
  const sumCostBasis = (arr) => arr.reduce((s, l) => s + l.costBasis, 0);

  return {
    year: year || 'all',
    totalLots: filtered.length,

    shortTerm: {
      count: shortTerm.length,
      proceeds: sumProceeds(shortTerm),
      costBasis: sumCostBasis(shortTerm),
      gainLoss: sumGainLoss(shortTerm),
    },

    longTerm: {
      count: longTerm.length,
      proceeds: sumProceeds(longTerm),
      costBasis: sumCostBasis(longTerm),
      gainLoss: sumGainLoss(longTerm),
    },

    total: {
      proceeds: sumProceeds(filtered),
      costBasis: sumCostBasis(filtered),
      gainLoss: sumGainLoss(filtered),
    },

    washSales: {
      count: washSales.length,
      disallowed: washSales.reduce((s, l) => s + l.washSaleDisallowed, 0),
    },

    netGainLoss: sumGainLoss(filtered) + washSales.reduce((s, l) => s + l.washSaleDisallowed, 0),
  };
}

export default { calculateTaxLots, generateTaxSummary };
