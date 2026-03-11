// ═══════════════════════════════════════════════════════════════════
// J2.3: Time-in-Trade Duration Analysis + J2.5: Rolling Windows
// ═══════════════════════════════════════════════════════════════════

/**
 * J2.3: Time-in-Trade Duration Analysis
 * Bins trades by hold duration and computes P&L correlation.
 *
 * @param {number[]} durations - hold durations in minutes
 * @param {number[]} pnls - paired P&L values
 * @returns {Object}
 */
export function computeDurationStats(durations, pnls) {
    if (!durations.length) return { avgMinutes: 0, medianMinutes: 0, buckets: [], correlation: 0, count: 0 };

    const n = durations.length;

    // Average and median
    const sorted = [...durations].sort((a, b) => a - b);
    const sum = durations.reduce((s, d) => s + d, 0);
    const avg = sum / n;
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

    // Duration buckets
    const BINS = [
        { label: '< 5m', min: 0, max: 5 },
        { label: '5–15m', min: 5, max: 15 },
        { label: '15–30m', min: 15, max: 30 },
        { label: '30–60m', min: 30, max: 60 },
        { label: '1–4h', min: 60, max: 240 },
        { label: '4h–1d', min: 240, max: 1440 },
        { label: '1d+', min: 1440, max: Infinity },
    ];

    const buckets = BINS.map((b) => ({ label: b.label, pnl: 0, count: 0, wins: 0, avgPnl: 0 }));

    for (let i = 0; i < n; i++) {
        const d = durations[i];
        const p = pnls[i];
        for (let j = 0; j < BINS.length; j++) {
            if (d >= BINS[j].min && d < BINS[j].max) {
                buckets[j].pnl += p;
                buckets[j].count++;
                if (p > 0) buckets[j].wins++;
                break;
            }
        }
    }

    for (const b of buckets) {
        b.avgPnl = b.count > 0 ? b.pnl / b.count : 0;
        b.winRate = b.count > 0 ? (b.wins / b.count) * 100 : 0;
    }

    // Pearson correlation between duration and P&L
    let correlation = 0;
    if (n >= 5) {
        const meanD = sum / n;
        const meanP = pnls.reduce((s, p) => s + p, 0) / n;
        let cov = 0,
            varD = 0,
            varP = 0;
        for (let i = 0; i < n; i++) {
            const dd = durations[i] - meanD;
            const dp = pnls[i] - meanP;
            cov += dd * dp;
            varD += dd * dd;
            varP += dp * dp;
        }
        const denom = Math.sqrt(varD * varP);
        correlation = denom > 0 ? cov / denom : 0;
    }

    return { avgMinutes: avg, medianMinutes: median, buckets, correlation, count: n };
}

/**
 * J2.5: Rolling Performance Windows
 * Compute 7-day, 30-day, 90-day rolling metrics from daily P&L data.
 * Returns { '7d': {...}, '30d': {...}, '90d': {...} }
 *
 * @param {Array} dailyEntries - sorted [date, cents] pairs
 * @param {number[]} dailyPnls - daily P&L in dollars (same order)
 * @returns {Object}
 */
export function computeRollingWindows(dailyEntries, dailyPnls) {
    const windows = {};
    const PERIODS = { '7d': 7, '30d': 30, '90d': 90 };

    for (const [label, days] of Object.entries(PERIODS)) {
        if (dailyPnls.length < 2) {
            windows[label] = { pnl: 0, winRate: 0, expectancy: 0, sharpe: 0, trades: 0, days: 0 };
            continue;
        }

        // Take the last N days
        const slice = dailyPnls.slice(-days);
        const n = slice.length;
        if (n === 0) {
            windows[label] = { pnl: 0, winRate: 0, expectancy: 0, sharpe: 0, trades: 0, days: 0 };
            continue;
        }

        let sum = 0,
            wins = 0;
        for (let i = 0; i < n; i++) {
            sum += slice[i];
            if (slice[i] > 0) wins++;
        }

        const mean = sum / n;
        let variance = 0;
        for (let i = 0; i < n; i++) variance += (slice[i] - mean) ** 2;
        const std = n > 1 ? Math.sqrt(variance / (n - 1)) : 0;

        const winRate = (wins / n) * 100;
        const sharpe = std > 0 ? (mean / std) * Math.sqrt(Math.min(252, n)) : 0;

        // Expectancy: average win * win% - average loss * loss%
        let winSum = 0,
            lossSum = 0,
            lossCount = 0;
        for (let i = 0; i < n; i++) {
            if (slice[i] > 0) winSum += slice[i];
            else if (slice[i] < 0) {
                lossSum += Math.abs(slice[i]);
                lossCount++;
            }
        }
        const avgWin = wins > 0 ? winSum / wins : 0;
        const avgLoss = lossCount > 0 ? lossSum / lossCount : 0;
        const expectancy = (wins / n) * avgWin - (lossCount / n) * avgLoss;

        windows[label] = {
            pnl: sum,
            winRate,
            expectancy,
            sharpe,
            days: n,
        };
    }

    return windows;
}
