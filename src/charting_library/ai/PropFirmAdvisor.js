// ═══════════════════════════════════════════════════════════════════
// charEdge — Prop Firm AI Advisor (Sprint 9)
//
// Daily projections, risk monitors, morning prep from evaluation data.
// Fuses mcPropFirmPredict() + PsychologyEngine for behavior-aware advice.
//
// Usage:
//   import { propFirmAdvisor } from './PropFirmAdvisor.js';
//   const advice = propFirmAdvisor.morningPrep(evalState, profile, trades);
// ═══════════════════════════════════════════════════════════════════

// ─── Advisor ────────────────────────────────────────────────────

class _PropFirmAdvisor {
    /**
     * Morning prep briefing for prop firm traders.
     *
     * @param {Object} evalState — from computeEvaluation()
     * @param {Object} profile — active prop firm profile
     * @param {Array} trades — recent trade history
     * @returns {Object} Morning prep advice
     */
    morningPrep(evalState, profile, trades = []) {
        if (!evalState || !profile) {
            return { cards: [], riskLevel: 'unknown', summary: 'No evaluation data available.' };
        }

        const cards = [];

        // ── 1. Daily Loss Budget ────────────────────────────────
        const dailyLimit = this._resolveDailyLimit(profile);
        const todayPnl = this._todayPnl(trades);
        const remainingBudget = dailyLimit - Math.abs(Math.min(todayPnl, 0));

        cards.push({
            id: 'daily_budget',
            icon: '💰',
            title: 'Daily Loss Budget',
            value: `$${remainingBudget.toFixed(2)}`,
            detail: `You can lose max $${dailyLimit.toFixed(2)} today. ${todayPnl < 0 ? `Already down $${Math.abs(todayPnl).toFixed(2)}.` : 'Clean slate so far.'}`,
            severity: remainingBudget < dailyLimit * 0.2 ? 'high' : remainingBudget < dailyLimit * 0.5 ? 'mid' : 'low',
        });

        // ── 2. Target Progress ──────────────────────────────────
        const targetAbs = this._resolveTarget(profile);
        const currentPnl = evalState.cumPnl || 0;
        const remaining = Math.max(0, targetAbs - currentPnl);
        const progress = targetAbs > 0 ? Math.min(100, (currentPnl / targetAbs) * 100) : 0;

        cards.push({
            id: 'target_progress',
            icon: '🎯',
            title: 'Target Progress',
            value: `${progress.toFixed(1)}%`,
            detail: `Need $${remaining.toFixed(2)} more to pass. Current P&L: $${currentPnl.toFixed(2)} / $${targetAbs.toFixed(2)}.`,
            severity: progress >= 80 ? 'low' : progress >= 50 ? 'mid' : 'high',
        });

        // ── 3. Pacing Advisor ───────────────────────────────────
        const daysTraded = evalState.daysTraded || 0;
        const maxDays = profile.evaluationDays || 30;
        const remainingDays = Math.max(1, maxDays - (evalState.calendarDays || 0));
        const dailyTarget = remaining / remainingDays;
        const avgDailyPnl = daysTraded > 0 ? currentPnl / daysTraded : 0;

        let pacingMessage;
        if (avgDailyPnl >= dailyTarget && dailyTarget > 0) {
            pacingMessage = `You're ahead of schedule — averaging $${avgDailyPnl.toFixed(2)}/day vs $${dailyTarget.toFixed(2)} needed.`;
        } else if (dailyTarget > 0) {
            pacingMessage = `Need $${dailyTarget.toFixed(2)}/day for ${remainingDays} remaining days. Current pace: $${avgDailyPnl.toFixed(2)}/day.`;
        } else {
            pacingMessage = 'Target already reached — protect your gains!';
        }

        cards.push({
            id: 'pacing',
            icon: '📈',
            title: 'Pacing',
            value: `$${dailyTarget.toFixed(2)}/day`,
            detail: pacingMessage,
            severity: avgDailyPnl >= dailyTarget ? 'low' : 'mid',
        });

        // ── 4. Risk Proximity ───────────────────────────────────
        const maxDDAbs = this._resolveMaxDD(profile);
        const currentDD = evalState.trailingDD || 0;
        const ddProximity = maxDDAbs > 0 ? (currentDD / maxDDAbs) * 100 : 0;

        cards.push({
            id: 'risk_proximity',
            icon: '⚠️',
            title: 'Drawdown Proximity',
            value: `${ddProximity.toFixed(1)}%`,
            detail: `Current drawdown: $${currentDD.toFixed(2)} of $${maxDDAbs.toFixed(2)} max. ${ddProximity > 80 ? '🔴 DANGER ZONE' : ddProximity > 50 ? '🟡 Caution' : '🟢 Safe'}`,
            severity: ddProximity > 80 ? 'high' : ddProximity > 50 ? 'mid' : 'low',
        });

        // ── 5. Streak Analysis ──────────────────────────────────
        const streak = this._currentStreak(trades);
        if (Math.abs(streak.count) >= 3) {
            cards.push({
                id: 'streak',
                icon: streak.count > 0 ? '🔥' : '❄️',
                title: streak.count > 0 ? 'Winning Streak' : 'Losing Streak',
                value: `${Math.abs(streak.count)} in a row`,
                detail: streak.count > 0
                    ? `${streak.count} consecutive wins ($${streak.totalPnl.toFixed(2)}). Stay disciplined — don't over-leverage.`
                    : `${Math.abs(streak.count)} consecutive losses ($${streak.totalPnl.toFixed(2)}). Consider reducing size or taking a break.`,
                severity: streak.count < -4 ? 'high' : streak.count < 0 ? 'mid' : 'low',
            });
        }

        // ── 6. Min Trading Days ─────────────────────────────────
        const minDays = profile.minTradingDays || 0;
        if (minDays > 0 && daysTraded < minDays) {
            cards.push({
                id: 'min_days',
                icon: '📅',
                title: 'Minimum Days',
                value: `${daysTraded}/${minDays}`,
                detail: `${minDays - daysTraded} more trading day${minDays - daysTraded !== 1 ? 's' : ''} required to pass.`,
                severity: 'low',
            });
        }

        // Overall risk level
        const highCards = cards.filter(c => c.severity === 'high').length;
        const riskLevel = highCards >= 2 ? 'high' : highCards >= 1 ? 'mid' : 'low';

        const summary = this._buildSummary(cards, riskLevel, progress);

        return { cards, riskLevel, summary };
    }

    /**
     * Real-time risk check — call on each trade update.
     * @param {Object} evalState
     * @param {Object} profile
     * @returns {{ level: string, message: string }}
     */
    riskCheck(evalState, profile) {
        if (!evalState || !profile) return { level: 'unknown', message: '' };

        const maxDD = this._resolveMaxDD(profile);
        const currentDD = evalState.trailingDD || 0;
        const proximity = maxDD > 0 ? (currentDD / maxDD) * 100 : 0;

        if (proximity > 95) return { level: 'critical', message: '🔴 STOP TRADING — 95%+ of max drawdown reached' };
        if (proximity > 80) return { level: 'high', message: '🟠 Danger zone — reduce size dramatically or stop' };
        if (proximity > 60) return { level: 'mid', message: '🟡 Approaching limits — trade with caution' };
        return { level: 'low', message: '🟢 Risk levels healthy' };
    }

    // ─── Helpers ─────────────────────────────────────────────────

    _resolveDailyLimit(profile) {
        return profile.dailyLossType === 'pct'
            ? profile.accountSize * (profile.dailyLossLimit / 100)
            : profile.dailyLossLimit || 0;
    }

    _resolveTarget(profile) {
        return profile.profitTargetType === 'pct'
            ? profile.accountSize * (profile.profitTarget / 100)
            : profile.profitTarget || 0;
    }

    _resolveMaxDD(profile) {
        return profile.maxDrawdownType === 'pct'
            ? profile.accountSize * (profile.maxDrawdown / 100)
            : profile.maxDrawdown || 0;
    }

    _todayPnl(trades) {
        const todayStr = new Date().toISOString().slice(0, 10);
        return trades
            .filter(t => t.date && t.date.startsWith(todayStr))
            .reduce((s, t) => s + (t.pnl || 0), 0);
    }

    _currentStreak(trades) {
        if (!trades.length) return { count: 0, totalPnl: 0 };
        const sorted = [...trades].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        const direction = (sorted[0].pnl || 0) >= 0 ? 1 : -1;
        let count = 0;
        let totalPnl = 0;
        for (const t of sorted) {
            const tDir = (t.pnl || 0) >= 0 ? 1 : -1;
            if (tDir !== direction) break;
            count++;
            totalPnl += t.pnl || 0;
        }
        return { count: count * direction, totalPnl };
    }

    _buildSummary(cards, riskLevel, progress) {
        const emoji = riskLevel === 'high' ? '🔴' : riskLevel === 'mid' ? '🟡' : '🟢';
        return `${emoji} Risk: ${riskLevel} • Progress: ${progress.toFixed(0)}% • ${cards.length} items reviewed`;
    }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const propFirmAdvisor = new _PropFirmAdvisor();
export { _PropFirmAdvisor as PropFirmAdvisor };
export default propFirmAdvisor;
