// ═══════════════════════════════════════════════════════════════════
// charEdge — Gap Analysis (P1-C #20)
// "The Gap" — Compare what the trader PLANNED (journal intent)
// vs what they ACTUALLY DID (trade execution).
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} GapResult
 * @property {string} tradeId
 * @property {number} entryGap - Deviation in entry price (planned vs actual, %)
 * @property {number} exitGap  - Deviation in exit price (planned vs actual, %)
 * @property {number} sizeGap  - Deviation in position size (planned vs actual, %)
 * @property {number} rGap     - Deviation in R-target vs realized R
 * @property {number} disciplineScore - 0–100 score (100 = perfect adherence)
 * @property {string} narrative  - Human-readable summary
 */

/**
 * Analyze the gap between a trade plan (from journal) and actual execution.
 *
 * @param {Object} trade - Executed trade { entryPrice, exitPrice, size, rMultiple }
 * @param {Object} plan  - Planned trade from journal { entryPrice, exitPrice, size, rTarget }
 * @returns {GapResult}
 */
export function analyzeGap(trade, plan) {
  if (!trade || !plan) {
    return {
      tradeId: trade?.id ?? '',
      entryGap: 0,
      exitGap: 0,
      sizeGap: 0,
      rGap: 0,
      disciplineScore: 0,
      narrative: 'Missing trade or plan data.',
    };
  }

  // ─── Entry Price Gap ────────────────────────────────────────
  const entryGap = plan.entryPrice && trade.entryPrice
    ? ((trade.entryPrice - plan.entryPrice) / plan.entryPrice) * 100
    : 0;

  // ─── Exit Price Gap ─────────────────────────────────────────
  const exitGap = plan.exitPrice && trade.exitPrice
    ? ((trade.exitPrice - plan.exitPrice) / plan.exitPrice) * 100
    : 0;

  // ─── Position Size Gap ──────────────────────────────────────
  const sizeGap = plan.size && trade.size
    ? ((trade.size - plan.size) / plan.size) * 100
    : 0;

  // ─── R-Multiple Gap ─────────────────────────────────────────
  const rGap = plan.rTarget && trade.rMultiple != null
    ? trade.rMultiple - plan.rTarget
    : 0;

  // ─── Discipline Score ───────────────────────────────────────
  // Each metric contributes 25 points. Penalty = abs(gap), capped at 25.
  const entryPenalty = Math.min(25, Math.abs(entryGap) * 5);
  const exitPenalty = Math.min(25, Math.abs(exitGap) * 5);
  const sizePenalty = Math.min(25, Math.abs(sizeGap) * 2.5);
  const rPenalty = Math.min(25, Math.abs(rGap) * 12.5);
  const disciplineScore = Math.max(0, 100 - entryPenalty - exitPenalty - sizePenalty - rPenalty);

  // ─── Narrative ──────────────────────────────────────────────
  const issues = [];
  if (Math.abs(entryGap) > 0.5)  issues.push(`Entry ${entryGap > 0 ? 'higher' : 'lower'} than planned by ${Math.abs(entryGap).toFixed(2)}%`);
  if (Math.abs(exitGap) > 0.5)   issues.push(`Exit ${exitGap > 0 ? 'higher' : 'lower'} than planned by ${Math.abs(exitGap).toFixed(2)}%`);
  if (Math.abs(sizeGap) > 10)    issues.push(`Size ${sizeGap > 0 ? 'larger' : 'smaller'} than planned by ${Math.abs(sizeGap).toFixed(0)}%`);
  if (Math.abs(rGap) > 0.5)      issues.push(`R outcome ${rGap > 0 ? 'better' : 'worse'} than target by ${Math.abs(rGap).toFixed(2)}R`);

  const narrative = issues.length === 0
    ? 'Execution matched the plan. Excellent discipline!'
    : issues.join('. ') + '.';

  return {
    tradeId: trade.id ?? '',
    entryGap: Math.round(entryGap * 100) / 100,
    exitGap: Math.round(exitGap * 100) / 100,
    sizeGap: Math.round(sizeGap * 100) / 100,
    rGap: Math.round(rGap * 100) / 100,
    disciplineScore: Math.round(disciplineScore),
    narrative,
  };
}

/**
 * Batch-analyze gaps for multiple trades with their corresponding plans.
 *
 * @param {Object[]} trades - Array of executed trades
 * @param {Object[]} plans  - Array of trade plans (matched by tradeId or date)
 * @returns {{ gaps: GapResult[], avgDiscipline: number, totalTrades: number }}
 */
export function analyzeGapBatch(trades, plans) {
  if (!trades?.length || !plans?.length) {
    return { gaps: [], avgDiscipline: 0, totalTrades: 0 };
  }

  // Match plans to trades by id or date
  const planMap = new Map();
  for (const p of plans) {
    if (p.tradeId) planMap.set(p.tradeId, p);
    else if (p.date) planMap.set(p.date, p);
  }

  const gaps = [];
  for (const trade of trades) {
    const plan = planMap.get(trade.id) || planMap.get(trade.date);
    if (plan) {
      gaps.push(analyzeGap(trade, plan));
    }
  }

  const avgDiscipline = gaps.length > 0
    ? gaps.reduce((s, g) => s + g.disciplineScore, 0) / gaps.length
    : 0;

  return {
    gaps,
    avgDiscipline: Math.round(avgDiscipline),
    totalTrades: gaps.length,
  };
}
