// ═══════════════════════════════════════════════════════════════════
// P1.6: Monte Carlo Prop Firm Pass/Fail Prediction
// ═══════════════════════════════════════════════════════════════════

/**
 * Given current evaluation state + historical trade P&Ls,
 * simulate remaining trading days to estimate probability
 * of passing or failing the prop firm evaluation.
 *
 * @param {number[]} pnls - Historical daily P&L values
 * @param {Object} evalState - From computeEvaluation()
 * @param {Object} profile - Active prop firm profile
 * @param {number} [runs=5000] - Number of simulations
 * @returns {Object} Prediction results
 */
export function mcPropFirmPredict(pnls, evalState, profile, runs = 5000) {
    if (!pnls?.length || pnls.length < 3 || !evalState || !profile) {
        return {
            passRate: 0,
            failRate: 0,
            activeRate: 0,
            runs: 0,
            confidence: 'low',
            avgDaysToPass: 0,
            medianFinalPnl: 0,
            pnlDistribution: [],
            insufficient: true,
        };
    }

    const currentPnl = evalState.cumPnl || 0;
    const _currentDD = evalState.trailingDD || 0;
    const currentEquity = evalState.currentEquity || profile.accountSize;
    const equityHigh = evalState.equityHigh || profile.accountSize;
    const daysTraded = evalState.daysTraded || 0;
    const calendarDays = evalState.calendarDays || 0;

    // Resolve limits to absolutes
    const dailyLimitAbs =
        profile.dailyLossType === 'pct' ? profile.accountSize * (profile.dailyLossLimit / 100) : profile.dailyLossLimit;
    const maxDDAbs =
        profile.maxDrawdownType === 'pct' ? profile.accountSize * (profile.maxDrawdown / 100) : profile.maxDrawdown;
    const targetAbs =
        profile.profitTargetType === 'pct' ? profile.accountSize * (profile.profitTarget / 100) : profile.profitTarget;

    // Remaining days to simulate
    const maxRemaining = profile.evaluationDays > 0 ? Math.max(1, profile.evaluationDays - calendarDays) : 60;
    const _minDaysNeeded = Math.max(0, (profile.minTradingDays || 0) - daysTraded);

    // Filter non-zero P&Ls for sampling
    const nonZeroPnls = pnls.filter((p) => p !== 0);
    if (nonZeroPnls.length < 2) {
        return {
            passRate: 0,
            failRate: 0,
            activeRate: 0,
            runs: 0,
            confidence: 'low',
            avgDaysToPass: 0,
            medianFinalPnl: 0,
            pnlDistribution: [],
            insufficient: true,
        };
    }

    let passCount = 0;
    let failCount = 0;
    let activeCount = 0;
    let totalDaysToPass = 0;
    const finalPnls = [];

    for (let r = 0; r < runs; r++) {
        let simPnl = currentPnl;
        let simEquity = currentEquity;
        let simHigh = equityHigh;
        let simDaysTraded = daysTraded;
        let passed = false;
        let failed = false;
        let daysToPass = 0;

        for (let day = 0; day < maxRemaining; day++) {
            // ~70% chance of trading on any given day (weekdays, etc.)
            if (Math.random() < 0.3) continue;

            // Sample a random daily P&L from history
            const dayPnl = nonZeroPnls[Math.floor(Math.random() * nonZeroPnls.length)];

            simPnl += dayPnl;
            simEquity += dayPnl;
            simDaysTraded++;

            // Update equity high (trailing DD)
            if (simEquity > simHigh) simHigh = simEquity;

            // Check daily loss breach
            if (dailyLimitAbs > 0 && dayPnl < 0 && Math.abs(dayPnl) >= dailyLimitAbs) {
                failed = true;
                break;
            }

            // Check drawdown breach
            const dd = profile.trailingDD ? simHigh - simEquity : profile.accountSize - simEquity;
            if (maxDDAbs > 0 && dd >= maxDDAbs) {
                failed = true;
                break;
            }

            // Check target reached
            if (targetAbs > 0 && simPnl >= targetAbs && simDaysTraded >= (profile.minTradingDays || 0)) {
                passed = true;
                daysToPass = day + 1;
                break;
            }
        }

        if (passed) {
            passCount++;
            totalDaysToPass += daysToPass;
        } else if (failed) {
            failCount++;
        } else {
            activeCount++; // Didn't pass or fail within remaining days
        }
        finalPnls.push(simPnl);
    }

    // Build P&L distribution (10 buckets)
    finalPnls.sort((a, b) => a - b);
    const buckets = 10;
    const pnlDistribution = [];
    for (let i = 0; i < buckets; i++) {
        const idx = Math.floor((i / buckets) * finalPnls.length);
        pnlDistribution.push(finalPnls[idx]);
    }

    const passRate = (passCount / runs) * 100;
    const failRate = (failCount / runs) * 100;
    const activeRate = (activeCount / runs) * 100;
    const avgDaysToPass = passCount > 0 ? Math.round(totalDaysToPass / passCount) : 0;
    const medianFinalPnl = finalPnls[Math.floor(finalPnls.length / 2)];

    // Confidence level based on sample size
    const confidence = nonZeroPnls.length >= 30 ? 'high' : nonZeroPnls.length >= 15 ? 'medium' : 'low';

    return {
        passRate: Math.round(passRate * 10) / 10,
        failRate: Math.round(failRate * 10) / 10,
        activeRate: Math.round(activeRate * 10) / 10,
        runs,
        confidence,
        avgDaysToPass,
        medianFinalPnl: Math.round(medianFinalPnl),
        pnlDistribution,
        insufficient: false,
        p10: finalPnls[Math.floor(finalPnls.length * 0.1)],
        p25: finalPnls[Math.floor(finalPnls.length * 0.25)],
        p50: medianFinalPnl,
        p75: finalPnls[Math.floor(finalPnls.length * 0.75)],
        p90: finalPnls[Math.floor(finalPnls.length * 0.9)],
    };
}
