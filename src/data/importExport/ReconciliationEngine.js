// ═══════════════════════════════════════════════════════════════════
// charEdge — Reconciliation Engine (Phase 8 Sprint 8.8)
//
// Cross-source trade matching with fuzzy matching on date, symbol,
// quantity, and price. Identifies duplicates across API imports,
// CSV uploads, and manual entries.
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} ReconciliationMatch
 * @property {Object} tradeA - First trade
 * @property {Object} tradeB - Second trade (potential duplicate)
 * @property {number} confidence - Match confidence 0–100
 * @property {string} reason - Why they matched
 * @property {'exact'|'fuzzy'|'possible'} matchType
 */

const DEFAULT_OPTIONS = {
  dateWindowMs: 5 * 60 * 1000,  // 5 minutes
  priceTolerancePct: 0.01,       // 1% price tolerance
  quantityTolerance: 0.001,      // Absolute qty tolerance
  minConfidence: 60,             // Minimum match confidence
};

// ─── Core Matching ──────────────────────────────────────────────

function _normalizeSymbol(sym) {
  return (sym || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function _parseDate(d) {
  if (!d) return 0;
  return new Date(d).getTime() || 0;
}

function _matchScore(tradeA, tradeB, options) {
  let score = 0;
  const reasons = [];

  // Symbol match (required — 0 confidence if different)
  const symA = _normalizeSymbol(tradeA.symbol);
  const symB = _normalizeSymbol(tradeB.symbol);
  if (symA !== symB) return { score: 0, reasons: ['Symbol mismatch'] };
  score += 30;
  reasons.push('Symbol match');

  // Side match
  const sideA = (tradeA.side || '').toUpperCase();
  const sideB = (tradeB.side || '').toUpperCase();
  if (sideA === sideB) {
    score += 15;
    reasons.push('Side match');
  } else {
    return { score: 0, reasons: ['Side mismatch'] };
  }

  // Date proximity
  const dateA = _parseDate(tradeA.date);
  const dateB = _parseDate(tradeB.date);
  const dateDiff = Math.abs(dateA - dateB);

  if (dateDiff === 0) {
    score += 25;
    reasons.push('Exact date match');
  } else if (dateDiff <= options.dateWindowMs) {
    score += 20;
    reasons.push(`Date within ${Math.round(dateDiff / 1000)}s`);
  } else if (dateDiff <= 86_400_000) {
    score += 10;
    reasons.push('Same day');
  } else {
    score -= 10;
  }

  // Quantity match
  const qtyA = parseFloat(tradeA.quantity || 0);
  const qtyB = parseFloat(tradeB.quantity || 0);
  const qtyDiff = Math.abs(qtyA - qtyB);

  if (qtyDiff <= options.quantityTolerance) {
    score += 20;
    reasons.push('Quantity match');
  } else if (qtyA > 0 && qtyDiff / qtyA <= 0.05) {
    score += 10;
    reasons.push('Quantity ~match');
  }

  // Price match
  const priceA = parseFloat(tradeA.price || tradeA.entry || 0);
  const priceB = parseFloat(tradeB.price || tradeB.entry || 0);

  if (priceA > 0 && priceB > 0) {
    const priceDiff = Math.abs(priceA - priceB) / priceA;
    if (priceDiff <= 0.001) {
      score += 15;
      reasons.push('Price match');
    } else if (priceDiff <= options.priceTolerancePct) {
      score += 8;
      reasons.push('Price ~match');
    }
  }

  // Source differentiation bonus — higher confidence if from different sources
  if (tradeA._source && tradeB._source && tradeA._source !== tradeB._source) {
    score += 5;
    reasons.push('Cross-source');
  }

  return { score: Math.min(100, score), reasons };
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Find duplicate trades across two lists.
 *
 * @param {Object[]} tradesA - Primary trade list (e.g., existing journal)
 * @param {Object[]} tradesB - Secondary trade list (e.g., new import)
 * @param {Object} [options] - Matching options
 * @returns {ReconciliationMatch[]} Matched pairs sorted by confidence
 */
export function findDuplicates(tradesA, tradesB, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const matches = [];
  const usedB = new Set();

  for (const a of tradesA) {
    let bestMatch = null;
    let bestScore = 0;
    let bestReasons = [];
    let bestIdx = -1;

    for (let i = 0; i < tradesB.length; i++) {
      if (usedB.has(i)) continue;

      const { score, reasons } = _matchScore(a, tradesB[i], opts);
      if (score > bestScore && score >= opts.minConfidence) {
        bestScore = score;
        bestMatch = tradesB[i];
        bestReasons = reasons;
        bestIdx = i;
      }
    }

    if (bestMatch && bestIdx >= 0) {
      usedB.add(bestIdx);
      matches.push({
        tradeA: a,
        tradeB: bestMatch,
        confidence: bestScore,
        reason: bestReasons.join(', '),
        matchType: bestScore >= 90 ? 'exact' : bestScore >= 70 ? 'fuzzy' : 'possible',
      });
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Deduplicate a trade list against existing trades.
 * Returns only unique trades from the new list.
 *
 * @param {Object[]} existingTrades - Current journal trades
 * @param {Object[]} newTrades - Newly imported trades
 * @param {Object} [options] - Matching options
 * @returns {{ unique: Object[], duplicates: ReconciliationMatch[] }}
 */
export function deduplicateImport(existingTrades, newTrades, options = {}) {
  const matches = findDuplicates(existingTrades, newTrades, options);
  const duplicateIndices = new Set(matches.map((m) => newTrades.indexOf(m.tradeB)));

  return {
    unique: newTrades.filter((_, i) => !duplicateIndices.has(i)),
    duplicates: matches,
  };
}

/**
 * Resolve conflicts between matched trades.
 * Preference order: API source > CSV > manual, newer > older.
 *
 * @param {ReconciliationMatch} match
 * @returns {Object} The preferred trade with merged metadata
 */
export function resolveConflict(match) {
  const { tradeA, tradeB } = match;
  const sourceRank = { api: 3, snaptrade: 3, plaid: 3, csv: 2, manual: 1 };

  const rankA = sourceRank[tradeA._source] || 1;
  const rankB = sourceRank[tradeB._source] || 1;

  const preferred = rankA >= rankB ? tradeA : tradeB;
  const other = rankA >= rankB ? tradeB : tradeA;

  // Merge: keep preferred fields, fill gaps from other
  return {
    ...other,
    ...preferred,
    _reconciledFrom: [tradeA._source, tradeB._source].filter(Boolean),
    _reconcileConfidence: match.confidence,
  };
}

export default { findDuplicates, deduplicateImport, resolveConflict };
