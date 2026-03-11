// ═══════════════════════════════════════════════════════════════════
// charEdge — Behavioral Bias Detector (Task 4.3.10)
//
// Detects cognitive biases from trade history:
//   - Overconfidence: position size increase after wins
//   - Recency bias: strategy switching after recent losses
//   - Anchoring: holding losers relative to entry, ignoring new levels
//   - Disposition effect: cutting winners early, letting losers run
//
// Input:  Array of trades with standard TradeSchema fields
// Output: BiasReport
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export type BiasType =
    | 'OVERCONFIDENCE'
    | 'RECENCY'
    | 'ANCHORING'
    | 'DISPOSITION_EFFECT'
    | 'LOSS_AVERSION';

export interface BiasInstance {
    type: BiasType;
    severity: 'high' | 'medium' | 'low';
    message: string;
    evidence: string[];
    recommendation: string;
    affectedTradeIds: string[];
}

export interface BiasReport {
    biases: BiasInstance[];
    dominantBias: BiasType | null;
    overallSeverity: 'high' | 'medium' | 'low' | 'none';
    score: number; // 0-100 (100 = bias-free)
    analyzedTrades: number;
}

// ─── Trade Shape ────────────────────────────────────────────────

export interface TradeLike {
    id: string;
    date: string;
    pnl: number;
    qty?: number;
    entry?: number;
    exit?: number;
    side?: string;
    stopLoss?: number | null;
    takeProfit?: number | null;
    playbook?: string;
    tags?: string[];
    ruleBreak?: boolean;
}

// ─── Detector ───────────────────────────────────────────────────

export function detectBiases(trades: TradeLike[]): BiasReport {
    if (trades.length < 3) {
        return {
            biases: [],
            dominantBias: null,
            overallSeverity: 'none',
            score: 100,
            analyzedTrades: trades.length,
        };
    }

    const sorted = [...trades].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const biases: BiasInstance[] = [
        ...detectOverconfidence(sorted),
        ...detectRecencyBias(sorted),
        ...detectAnchoring(sorted),
        ...detectDispositionEffect(sorted),
        ...detectLossAversion(sorted),
    ];

    // Find dominant bias (most instances)
    const biasCounts = new Map<BiasType, number>();
    for (const b of biases) {
        biasCounts.set(b.type, (biasCounts.get(b.type) || 0) + 1);
    }

    let dominantBias: BiasType | null = null;
    let maxCount = 0;
    for (const [type, count] of biasCounts) {
        if (count > maxCount) {
            maxCount = count;
            dominantBias = type;
        }
    }

    // Overall severity
    const highCount = biases.filter(b => b.severity === 'high').length;
    const medCount = biases.filter(b => b.severity === 'medium').length;
    const overallSeverity: BiasReport['overallSeverity'] =
        highCount >= 2 ? 'high' :
            highCount >= 1 || medCount >= 3 ? 'medium' :
                biases.length > 0 ? 'low' : 'none';

    // Score: penalize based on bias count and severity
    const penalty = highCount * 15 + medCount * 8 + (biases.length - highCount - medCount) * 3;
    const score = Math.max(0, Math.min(100, 100 - penalty));

    return {
        biases,
        dominantBias,
        overallSeverity,
        score,
        analyzedTrades: trades.length,
    };
}

// ─── Overconfidence Detection ───────────────────────────────────

function detectOverconfidence(trades: TradeLike[]): BiasInstance[] {
    const results: BiasInstance[] = [];

    // Look for position size increase after consecutive wins
    for (let i = 2; i < trades.length; i++) {
        const prev1 = trades[i - 2];
        const prev2 = trades[i - 1];
        const curr = trades[i];

        if (prev1.pnl > 0 && prev2.pnl > 0 && curr.qty && prev2.qty) {
            if (curr.qty > prev2.qty * 1.5) {
                const severity = curr.pnl < 0 ? 'high' : 'medium';
                results.push({
                    type: 'OVERCONFIDENCE',
                    severity,
                    message: `Position size increased ${Math.round((curr.qty / prev2.qty - 1) * 100)}% after ${prev1.pnl > 0 && prev2.pnl > 0 ? '2' : '1'} consecutive wins.`,
                    evidence: [
                        `Trade ${prev1.id}: +${prev1.pnl} (qty: ${prev1.qty ?? '?'})`,
                        `Trade ${prev2.id}: +${prev2.pnl} (qty: ${prev2.qty ?? '?'})`,
                        `Trade ${curr.id}: ${curr.pnl > 0 ? '+' : ''}${curr.pnl} (qty: ${curr.qty})`,
                    ],
                    recommendation: 'Keep position sizes consistent regardless of recent wins. Size should follow your risk rules, not your emotions.',
                    affectedTradeIds: [prev1.id, prev2.id, curr.id],
                });
            }
        }
    }

    return results;
}

// ─── Recency Bias Detection ─────────────────────────────────────

function detectRecencyBias(trades: TradeLike[]): BiasInstance[] {
    const results: BiasInstance[] = [];

    // Look for strategy switching after 2-3 losses
    for (let i = 2; i < trades.length; i++) {
        const prev1 = trades[i - 2];
        const prev2 = trades[i - 1];
        const curr = trades[i];

        if (prev1.pnl < 0 && prev2.pnl < 0 && curr.playbook && prev2.playbook) {
            if (curr.playbook !== prev2.playbook && prev1.playbook === prev2.playbook) {
                results.push({
                    type: 'RECENCY',
                    severity: curr.pnl < 0 ? 'high' : 'medium',
                    message: `Strategy switched from "${prev2.playbook}" to "${curr.playbook}" after 2 consecutive losses.`,
                    evidence: [
                        `Trade ${prev1.id}: ${prev1.pnl} (${prev1.playbook || 'no playbook'})`,
                        `Trade ${prev2.id}: ${prev2.pnl} (${prev2.playbook || 'no playbook'})`,
                        `Trade ${curr.id}: ${curr.pnl > 0 ? '+' : ''}${curr.pnl} (${curr.playbook}) — switched strategy`,
                    ],
                    recommendation: 'Two losses don\'t invalidate a strategy. Evaluate over 20+ trades to judge strategy performance.',
                    affectedTradeIds: [prev1.id, prev2.id, curr.id],
                });
            }
        }
    }

    return results;
}

// ─── Anchoring Detection ────────────────────────────────────────

function detectAnchoring(trades: TradeLike[]): BiasInstance[] {
    const results: BiasInstance[] = [];

    for (const trade of trades) {
        if (trade.pnl >= 0) continue; // Only inspect losing trades
        if (!trade.entry || !trade.exit || !trade.stopLoss) continue;

        // Anchoring: held past stop loss — exit is worse than the stop
        const isLong = trade.side !== 'short';
        const heldPastStop = isLong
            ? trade.exit < trade.stopLoss
            : trade.exit > trade.stopLoss;

        if (heldPastStop) {
            const slippage = Math.abs(trade.exit - trade.stopLoss);
            const entryDist = Math.abs(trade.entry - trade.stopLoss);
            const slippagePercent = entryDist > 0 ? (slippage / entryDist) * 100 : 0;

            results.push({
                type: 'ANCHORING',
                severity: slippagePercent > 50 ? 'high' : 'medium',
                message: `Held ${Math.round(slippagePercent)}% past stop loss — anchored to entry price instead of honoring risk level.`,
                evidence: [
                    `Entry: ${trade.entry}, Stop: ${trade.stopLoss}, Exit: ${trade.exit}`,
                    `Excess loss: ${slippage.toFixed(2)} beyond stop`,
                ],
                recommendation: 'Use hard stops. Once price hits your stop level, exit immediately — your entry price is irrelevant.',
                affectedTradeIds: [trade.id],
            });
        }
    }

    return results;
}

// ─── Disposition Effect ─────────────────────────────────────────

function detectDispositionEffect(trades: TradeLike[]): BiasInstance[] {
    const results: BiasInstance[] = [];

    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl < 0);

    if (wins.length < 2 || losses.length < 2) return results;

    // Compare average hold duration via timestamps (if we have entry + close dates)
    // Alternatively, compare R-multiples or profit ratios
    const avgWinPnl = wins.reduce((s, t) => s + t.pnl, 0) / wins.length;
    const avgLossPnl = Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length);

    // If average loss is significantly larger than average win → disposition effect
    if (avgLossPnl > avgWinPnl * 1.75 && losses.length >= 3) {
        results.push({
            type: 'DISPOSITION_EFFECT',
            severity: avgLossPnl > avgWinPnl * 2.5 ? 'high' : 'medium',
            message: `Average loss ($${avgLossPnl.toFixed(0)}) is ${(avgLossPnl / avgWinPnl).toFixed(1)}x larger than average win ($${avgWinPnl.toFixed(0)}). Cutting winners early, letting losers run.`,
            evidence: [
                `Avg win: $${avgWinPnl.toFixed(2)} (${wins.length} trades)`,
                `Avg loss: -$${avgLossPnl.toFixed(2)} (${losses.length} trades)`,
                `Ratio: ${(avgLossPnl / avgWinPnl).toFixed(2)}:1 (ideal: <1.5:1)`,
            ],
            recommendation: 'Set mechanical take-profit and stop-loss levels. Let winners run to target — don\'t close early from fear of giving back gains.',
            affectedTradeIds: losses.map(t => t.id),
        });
    }

    return results;
}

// ─── Loss Aversion ──────────────────────────────────────────────

function detectLossAversion(trades: TradeLike[]): BiasInstance[] {
    const results: BiasInstance[] = [];

    // After a large loss, does the trader stop trading for an extended period?
    // Or trade much smaller? Both can indicate loss aversion.
    for (let i = 1; i < trades.length; i++) {
        const prev = trades[i - 1];
        const curr = trades[i];

        if (prev.pnl >= 0) continue; // Only after losses
        if (!curr.qty || !prev.qty) continue;

        // Dramatic size reduction after loss (>60% smaller)
        if (curr.qty < prev.qty * 0.4) {
            results.push({
                type: 'LOSS_AVERSION',
                severity: 'low',
                message: `Position size dropped ${Math.round((1 - curr.qty / prev.qty) * 100)}% after a $${Math.abs(prev.pnl).toFixed(0)} loss.`,
                evidence: [
                    `Trade ${prev.id}: ${prev.pnl} (qty: ${prev.qty})`,
                    `Trade ${curr.id}: qty dropped to ${curr.qty}`,
                ],
                recommendation: 'Consistent sizing builds discipline. If your risk rules said the previous size was correct, the next trade should be the same size.',
                affectedTradeIds: [prev.id, curr.id],
            });
        }
    }

    return results;
}

export default detectBiases;
