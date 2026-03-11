// ═══════════════════════════════════════════════════════════════════
// charEdge — Expectancy Calculator (Task 4.3.4)
//
// Computes per-setup expectancy: (winRate × avgWin) − (lossRate × avgLoss)
// Groups trades by setup/playbook tag for comparative analysis.
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export interface Trade {
    pnl: number;
    setup?: string;
    tags?: string[];
    playbook?: string;
    rMultiple?: number;
}

export interface SetupExpectancy {
    setup: string;
    tradeCount: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    expectancy: number;
    expectancyPerR: number;
    totalPnl: number;
    profitFactor: number;
    bestTrade: number;
    worstTrade: number;
}

export interface ExpectancySummary {
    overall: SetupExpectancy;
    bySetup: SetupExpectancy[];
    recommendation: string;
}

// ─── Calculator ─────────────────────────────────────────────────

function computeSetupExpectancy(trades: Trade[], setup: string): SetupExpectancy {
    if (trades.length === 0) {
        return {
            setup, tradeCount: 0, winRate: 0, avgWin: 0, avgLoss: 0,
            expectancy: 0, expectancyPerR: 0, totalPnl: 0, profitFactor: 0,
            bestTrade: 0, worstTrade: 0,
        };
    }

    const wins = trades.filter((t) => t.pnl > 0);
    const losses = trades.filter((t) => t.pnl < 0); // Breakeven (pnl===0) excluded from losses

    const totalWin = wins.reduce((s, t) => s + t.pnl, 0);
    const totalLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const avgWin = wins.length > 0 ? totalWin / wins.length : 0;
    const avgLoss = losses.length > 0 ? totalLoss / losses.length : 0;
    const winRate = wins.length / trades.length;
    const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);

    // R-multiple expectancy (if available)
    const rTrades = trades.filter((t) => t.rMultiple != null);
    const expectancyPerR = rTrades.length > 0
        ? rTrades.reduce((s, t) => s + (t.rMultiple ?? 0), 0) / rTrades.length
        : 0;

    return {
        setup,
        tradeCount: trades.length,
        winRate,
        avgWin,
        avgLoss,
        expectancy,
        expectancyPerR,
        totalPnl: trades.reduce((s, t) => s + t.pnl, 0),
        profitFactor: totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0,
        // Use loops instead of Math.max/min(...array) to avoid stack overflow on >65K trades
        bestTrade: trades.reduce((best, t) => t.pnl > best ? t.pnl : best, -Infinity),
        worstTrade: trades.reduce((worst, t) => t.pnl < worst ? t.pnl : worst, Infinity),
    };
}

export function computeExpectancy(trades: Trade[]): ExpectancySummary {
    const overall = computeSetupExpectancy(trades, 'ALL');

    // Group by setup/playbook
    const setupMap = new Map<string, Trade[]>();
    for (const trade of trades) {
        const key = trade.setup || trade.playbook || 'Untagged';
        if (!setupMap.has(key)) setupMap.set(key, []);
        setupMap.get(key)!.push(trade);
    }

    const bySetup = Array.from(setupMap.entries())
        .map(([setup, group]) => computeSetupExpectancy(group, setup))
        .sort((a, b) => b.expectancy - a.expectancy);

    // Generate recommendation
    let recommendation = '';
    if (bySetup.length > 1) {
        const best = bySetup[0];
        const worst = bySetup[bySetup.length - 1];
        if (best && worst && worst.expectancy < 0) {
            recommendation = `Consider reducing or eliminating "${worst.setup}" (negative expectancy: $${worst.expectancy.toFixed(2)}). Focus on "${best.setup}" ($${best.expectancy.toFixed(2)}/trade).`;
        } else if (best) {
            recommendation = `Your best setup is "${best.setup}" with $${best.expectancy.toFixed(2)}/trade expectancy.`;
        }
    } else if (overall.expectancy > 0) {
        recommendation = `Positive expectancy of $${overall.expectancy.toFixed(2)}/trade. Keep journaling to identify specific setups.`;
    } else {
        recommendation = `Negative expectancy. Review your entries and exits — are you cutting winners short or holding losers too long?`;
    }

    return { overall, bySetup, recommendation };
}

export default { computeExpectancy };
