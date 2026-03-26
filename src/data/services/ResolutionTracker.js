// ═══════════════════════════════════════════════════════════════════
// charEdge — Resolution Tracker
//
// Tracks which prediction markets have resolved and their outcomes.
// Computes accuracy metrics: Brier score, calibration, win rate.
// Stores in memory (upgradeable to IndexedDB).
// ═══════════════════════════════════════════════════════════════════

const resolvedMarkets = new Map(); // marketId → resolution data

/**
 * Record a market resolution.
 * @param {Object} market - The market that resolved
 * @param {string} winningOutcome - Label of the winning outcome
 */
export function recordResolution(market, winningOutcome) {
  resolvedMarkets.set(market.id, {
    marketId: market.id,
    question: market.question,
    source: market.source,
    category: market.category,
    resolvedAt: Date.now(),
    winningOutcome,
    finalProbabilities: (market.outcomes || []).map((o) => ({
      label: o.label,
      probability: o.probability,
    })),
    wasLeadingCorrect: market.outcomes?.[0]?.label === winningOutcome,
  });
}

/**
 * Check markets for resolutions (compare against API data).
 * @param {Array} currentMarkets - Current market data from adapters
 * @param {Array} previousMarkets - Previous market data (to detect transitions)
 */
export function checkResolutions(currentMarkets, _previousMarkets = []) {
  const newResolutions = [];

  for (const market of currentMarkets) {
    if (market.status === 'resolved' && market.resolvedOutcome) {
      if (!resolvedMarkets.has(market.id)) {
        recordResolution(market, market.resolvedOutcome);
        newResolutions.push(resolvedMarkets.get(market.id));
      }
    }
  }

  return newResolutions;
}

/**
 * Get all resolved markets.
 */
export function getResolvedMarkets() {
  return [...resolvedMarkets.values()];
}

/**
 * Get resolution count.
 */
export function getResolutionCount() {
  return resolvedMarkets.size;
}

/**
 * Compute accuracy metrics across all resolved markets.
 */
export function computeAccuracyMetrics() {
  const resolved = getResolvedMarkets();
  if (resolved.length === 0) {
    return { count: 0, leadingAccuracy: 0, brierScore: null, byCategory: {} };
  }

  let correctCount = 0;
  let brierSum = 0;
  const byCategory = {};

  for (const r of resolved) {
    if (r.wasLeadingCorrect) correctCount++;

    // Brier score: measure calibration
    const leadProb = (r.finalProbabilities[0]?.probability || 50) / 100;
    const actual = r.wasLeadingCorrect ? 1 : 0;
    brierSum += Math.pow(leadProb - actual, 2);

    // By category
    const cat = r.category || 'other';
    if (!byCategory[cat]) byCategory[cat] = { total: 0, correct: 0 };
    byCategory[cat].total++;
    if (r.wasLeadingCorrect) byCategory[cat].correct++;
  }

  return {
    count: resolved.length,
    leadingAccuracy: Math.round((correctCount / resolved.length) * 100),
    brierScore: brierSum / resolved.length,
    byCategory: Object.fromEntries(
      Object.entries(byCategory).map(([cat, data]) => [
        cat,
        { ...data, accuracy: Math.round((data.correct / data.total) * 100) },
      ]),
    ),
  };
}

/**
 * Get resolution rate (% of closed markets that actually resolved vs voided).
 */
export function getResolutionRate() {
  const resolved = getResolvedMarkets();
  const voided = resolved.filter((r) => r.winningOutcome === 'voided');
  const actual = resolved.length - voided.length;
  return resolved.length > 0 ? Math.round((actual / resolved.length) * 100) : 100;
}
