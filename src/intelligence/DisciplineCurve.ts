// ═══════════════════════════════════════════════════════════════════
// charEdge — Discipline Curve (Task 4.3.3)
//
// "Actual vs If I Followed Rules" equity comparison.
// Computes the hypothetical equity curve if rule-breaking trades
// were skipped, and surfaces the cost of indiscipline.
//
// Input:  Trades with `ruleBreak` field + starting equity
// Output: DisciplineCurveData
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export interface DisciplinePoint {
    index: number;
    tradeId: string;
    date: string;
    actualEquity: number;
    disciplinedEquity: number;
    gap: number;           // disciplined - actual
    wasRuleBreak: boolean;
}

export interface DisciplineCurveData {
    /** Equity curve points — one per trade */
    points: DisciplinePoint[];
    /** Starting equity */
    startingEquity: number;
    /** Final actual equity */
    finalActualEquity: number;
    /** Final disciplined equity */
    finalDisciplinedEquity: number;
    /** Total P&L cost of rule-breaking trades */
    costOfIndiscipline: number;
    /** Number of rule-breaking trades */
    ruleBreakCount: number;
    /** Total trades */
    totalTrades: number;
    /** Discipline rate (non-rule-breaking / total) */
    disciplineRate: number;
}

// ─── Trade Shape ────────────────────────────────────────────────

export interface TradeLike {
    id: string;
    date: string;
    pnl: number;
    ruleBreak?: boolean;
    tags?: string[];
}

// ─── Engine ─────────────────────────────────────────────────────

export function computeDisciplineCurve(
    trades: TradeLike[],
    startingEquity: number = 10000
): DisciplineCurveData {
    if (trades.length === 0) {
        return {
            points: [],
            startingEquity,
            finalActualEquity: startingEquity,
            finalDisciplinedEquity: startingEquity,
            costOfIndiscipline: 0,
            ruleBreakCount: 0,
            totalTrades: 0,
            disciplineRate: 1,
        };
    }

    const sorted = [...trades].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const points: DisciplinePoint[] = [];
    let actualEquity = startingEquity;
    let disciplinedEquity = startingEquity;
    let ruleBreakCount = 0;

    for (let i = 0; i < sorted.length; i++) {
        const trade = sorted[i];
        const isRuleBreak = trade.ruleBreak === true;

        // Actual equity always includes the trade
        actualEquity += trade.pnl;

        // Disciplined equity skips rule-breaking trades
        if (!isRuleBreak) {
            disciplinedEquity += trade.pnl;
        } else {
            ruleBreakCount++;
        }

        points.push({
            index: i,
            tradeId: trade.id,
            date: trade.date,
            actualEquity,
            disciplinedEquity,
            gap: disciplinedEquity - actualEquity,
            wasRuleBreak: isRuleBreak,
        });
    }

    const costOfIndiscipline = disciplinedEquity - actualEquity;

    return {
        points,
        startingEquity,
        finalActualEquity: actualEquity,
        finalDisciplinedEquity: disciplinedEquity,
        costOfIndiscipline,
        ruleBreakCount,
        totalTrades: sorted.length,
        disciplineRate: sorted.length > 0
            ? (sorted.length - ruleBreakCount) / sorted.length
            : 1,
    };
}

export default computeDisciplineCurve;
