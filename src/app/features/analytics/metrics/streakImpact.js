// ═══════════════════════════════════════════════════════════════════
// H2.2: Streak Impact Analysis
// ═══════════════════════════════════════════════════════════════════

/**
 * Analyze P&L during consecutive win/loss streaks vs baseline.
 * @param {Object[]} trades
 * @param {number[]} sortedIdxs - Pre-sorted trade indices by date
 * @returns {{ avgPnlDuringWinStreak: number, avgPnlDuringLossStreak: number, avgPnlBaseline: number, streakSensitivity: number }}
 */
export function computeStreakImpact(trades, sortedIdxs) {
    const n = trades.length;
    if (n < 3) {
        return { avgPnlDuringWinStreak: 0, avgPnlDuringLossStreak: 0, avgPnlBaseline: 0, streakSensitivity: 0 };
    }

    // Tag each trade: is it part of a streak of 2+ consecutive same-direction trades?
    const sorted = sortedIdxs.map((i) => trades[i]);
    const pnls = sorted.map((t) => t.pnl);
    const signs = pnls.map((p) => (p > 0 ? 1 : p < 0 ? -1 : 0));

    // Build streak lengths using forward/backward pass
    const streakLen = new Array(n).fill(1);
    for (let i = 1; i < n; i++) {
        if (signs[i] !== 0 && signs[i] === signs[i - 1]) {
            streakLen[i] = streakLen[i - 1] + 1;
        }
    }
    // Backfill: all members of a streak get the full streak length
    for (let i = n - 2; i >= 0; i--) {
        if (signs[i] !== 0 && signs[i] === signs[i + 1]) {
            streakLen[i] = Math.max(streakLen[i], streakLen[i + 1]);
        }
    }

    let winStreakSum = 0,
        winStreakCount = 0;
    let lossStreakSum = 0,
        lossStreakCount = 0;
    let totalSum = 0;

    for (let i = 0; i < n; i++) {
        totalSum += pnls[i];
        if (streakLen[i] >= 2) {
            if (signs[i] > 0) {
                winStreakSum += pnls[i];
                winStreakCount++;
            } else if (signs[i] < 0) {
                lossStreakSum += pnls[i];
                lossStreakCount++;
            }
        }
    }

    const avgPnlBaseline = n > 0 ? totalSum / n : 0;
    const avgPnlDuringWinStreak = winStreakCount > 0 ? winStreakSum / winStreakCount : 0;
    const avgPnlDuringLossStreak = lossStreakCount > 0 ? lossStreakSum / lossStreakCount : 0;

    // Streak sensitivity: how much worse/better are streak trades vs baseline
    const streakSensitivity =
        avgPnlBaseline !== 0 ? (avgPnlDuringWinStreak - avgPnlDuringLossStreak) / Math.abs(avgPnlBaseline) : 0;

    return { avgPnlDuringWinStreak, avgPnlDuringLossStreak, avgPnlBaseline, streakSensitivity };
}
