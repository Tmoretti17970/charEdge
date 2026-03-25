// ═══════════════════════════════════════════════════════════════════
// charEdge — Import Confidence Scorer (Phase 8 Sprint 8.9)
//
// Per-import quality scoring. Warns on suspicious data:
// missing prices, future dates, negative quantities, etc.
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} ImportScore
 * @property {number} score - 0–100 confidence score
 * @property {'high'|'medium'|'low'} grade
 * @property {string[]} warnings
 * @property {string[]} errors
 * @property {Object} stats
 */

/**
 * Score the quality of imported trades.
 *
 * @param {Object[]} trades - Parsed trades to evaluate
 * @returns {ImportScore} Import quality assessment
 */
export function scoreImport(trades) {
  if (!trades || trades.length === 0) {
    return { score: 0, grade: 'low', warnings: ['No trades to import'], errors: [], stats: {} };
  }

  let score = 100;
  const warnings = [];
  const errors = [];
  const now = Date.now();

  let missingDates = 0;
  let missingSymbols = 0;
  let _missingPrices = 0;
  let futureDates = 0;
  let negativeQty = 0;
  let zeroPrices = 0;
  let duplicateCount = 0;

  // Check for duplicates within the import
  const hashes = new Set();

  for (const trade of trades) {
    // Missing date
    if (!trade.date) {
      missingDates++;
    } else {
      const d = new Date(trade.date);
      if (isNaN(d.getTime())) {
        missingDates++;
      } else if (d.getTime() > now + 86_400_000) {
        futureDates++;
      }
    }

    // Missing symbol
    if (!trade.symbol || trade.symbol.trim() === '') {
      missingSymbols++;
    }

    // Missing or zero price
    const price = parseFloat(trade.price || trade.entry || 0);
    if (isNaN(price) || price === 0) {
      zeroPrices++;
    } else if (price < 0) {
      _missingPrices++;
    }

    // Negative quantity
    const qty = parseFloat(trade.quantity || 0);
    if (qty < 0) negativeQty++;

    // Duplicate check
    const hash = `${trade.date}|${trade.symbol}|${trade.side}|${trade.quantity}|${trade.price}`;
    if (hashes.has(hash)) {
      duplicateCount++;
    }
    hashes.add(hash);
  }

  // Score deductions
  const total = trades.length;

  if (missingDates > 0) {
    const pct = (missingDates / total) * 100;
    score -= Math.min(30, pct);
    if (pct > 50) errors.push(`${missingDates} trades have missing/invalid dates (${pct.toFixed(0)}%)`);
    else warnings.push(`${missingDates} trade(s) have missing/invalid dates`);
  }

  if (missingSymbols > 0) {
    const pct = (missingSymbols / total) * 100;
    score -= Math.min(25, pct);
    if (pct > 30) errors.push(`${missingSymbols} trades have no symbol`);
    else warnings.push(`${missingSymbols} trade(s) have no symbol`);
  }

  if (zeroPrices > 0) {
    score -= Math.min(15, (zeroPrices / total) * 50);
    warnings.push(`${zeroPrices} trade(s) have zero or missing price`);
  }

  if (futureDates > 0) {
    score -= Math.min(20, futureDates * 5);
    warnings.push(`${futureDates} trade(s) have future dates — check timezone settings`);
  }

  if (negativeQty > 0) {
    score -= Math.min(10, negativeQty * 3);
    warnings.push(`${negativeQty} trade(s) have negative quantities`);
  }

  if (duplicateCount > 0) {
    score -= Math.min(15, (duplicateCount / total) * 30);
    warnings.push(`${duplicateCount} potential duplicate(s) within this import`);
  }

  // Bonus: all required fields present
  if (missingDates === 0 && missingSymbols === 0 && zeroPrices === 0) {
    score = Math.min(100, score + 5);
  }

  score = Math.max(0, Math.round(score));

  const grade = score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low';

  return {
    score,
    grade,
    warnings,
    errors,
    stats: {
      totalTrades: total,
      missingDates,
      missingSymbols,
      zeroPrices,
      futureDates,
      negativeQty,
      duplicateCount,
    },
  };
}

export default { scoreImport };
