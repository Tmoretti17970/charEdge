// ═══════════════════════════════════════════════════════════════════
// charEdge — Strategy Advisor AI (Sprint 8)
//
// Analyzes strategy backtest results and configuration,
// generates parameter optimizations and improvement suggestions.
//
// Usage:
//   import { strategyAdvisor } from './StrategyAdvisor.js';
//   const advice = strategyAdvisor.analyze(strategyConfig, backtestResults);
// ═══════════════════════════════════════════════════════════════════

// ─── Suggestion types ───────────────────────────────────────────

/**
 * @typedef {'parameter'|'condition'|'exit'|'regime'|'general'} SuggestionType
 *
 * @typedef {Object} AISuggestion
 * @property {SuggestionType} type
 * @property {string} title
 * @property {string} description
 * @property {'high'|'medium'|'low'} impact
 * @property {string} icon
 * @property {Object|null} action — payload for one-tap apply
 */

// ─── Strategy Advisor ───────────────────────────────────────────

class _StrategyAdvisor {
    /**
     * Full strategy analysis with suggestions.
     *
     * @param {Object} config — strategy definition from useStrategyBuilderStore
     * @param {Object} results — backtest results (equity curve, trades, metrics)
     * @returns {{ suggestions: Array, overallGrade: string, strengths: Array, weaknesses: Array }}
     */
    analyze(config, results) {
        if (!config || !results || !results.trades || results.trades.length < 5) {
            return {
                suggestions: [],
                overallGrade: '—',
                strengths: [],
                weaknesses: [],
                summary: 'Not enough data for analysis. Run a backtest with at least 5 trades.',
            };
        }

        const suggestions = [];

        suggestions.push(...this._analyzeParameters(config, results));
        suggestions.push(...this._analyzeConditionGaps(config, results));
        suggestions.push(...this._analyzeExitRules(config, results));
        suggestions.push(...this._analyzeRegimeFit(results));
        suggestions.push(...this._analyzeGeneral(results));

        // Grade
        const overallGrade = this._computeGrade(results);
        const { strengths, weaknesses } = this._computeStrengthsWeaknesses(results);

        // Sort by impact
        const impactOrder = { high: 0, medium: 1, low: 2 };
        suggestions.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);

        const summary = this._buildSummary(overallGrade, suggestions, strengths);

        return { suggestions, overallGrade, strengths, weaknesses, summary };
    }

    // ─── Parameter Sensitivity ──────────────────────────────────

    _analyzeParameters(config, results) {
        const suggestions = [];
        const winRate = this._winRate(results.trades);
        const avgWin = this._avgWin(results.trades);
        const avgLoss = this._avgLoss(results.trades);
        const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;

        // Low win rate — suggest shorter periods for faster signals
        if (winRate < 40) {
            suggestions.push({
                type: 'parameter',
                title: 'Reduce Indicator Periods',
                description: `Win rate is ${winRate.toFixed(0)}%. Try shorter indicator periods (e.g., SMA 10 instead of 20) for faster entries.`,
                impact: 'high',
                icon: '⚡',
                action: { adjustPeriods: -0.2 }, // -20% hint
            });
        }

        // Profit factor below 1.5 — tight stops may be cutting winners
        if (profitFactor > 0 && profitFactor < 1.2) {
            suggestions.push({
                type: 'parameter',
                title: 'Widen Stop Loss',
                description: `Profit factor is ${profitFactor.toFixed(2)}. Your stops may be too tight — try 1.5× ATR instead of 1× for more room.`,
                impact: 'high',
                icon: '🎯',
                action: { adjustStopATR: 1.5 },
            });
        }

        // High win rate but low avg win — targets too tight
        if (winRate > 60 && avgWin < Math.abs(avgLoss) * 0.8) {
            suggestions.push({
                type: 'parameter',
                title: 'Extend Take Profit',
                description: `${winRate.toFixed(0)}% win rate but avg win ($${avgWin.toFixed(2)}) is smaller than avg loss ($${Math.abs(avgLoss).toFixed(2)}). Extend targets for better R:R.`,
                impact: 'medium',
                icon: '📈',
                action: { adjustTargetATR: 0.5 },
            });
        }

        return suggestions;
    }

    // ─── Condition Gaps ─────────────────────────────────────────

    _analyzeConditionGaps(config, results) {
        const suggestions = [];
        const conditions = config.entryLong || [];
        const hasVolume = conditions.some(c => c.left?.source === 'volume' || c.right?.source === 'volume');
        const hasRSI = conditions.some(c => c.left?.source === 'rsi' || c.right?.source === 'rsi');
        const hasMACD = conditions.some(c => (c.left?.source || '').startsWith('macd') || (c.right?.source || '').startsWith('macd'));

        if (!hasVolume && results.trades.length > 10) {
            suggestions.push({
                type: 'condition',
                title: 'Add Volume Confirmation',
                description: 'Your strategy has no volume filter. Adding "Volume > 1.5× average" can reduce false signals by ~30%.',
                impact: 'high',
                icon: '📊',
                action: { addCondition: { source: 'volume', comparison: 'greater_than', threshold: 1.5 } },
            });
        }

        if (!hasRSI && !hasMACD && conditions.length <= 2) {
            suggestions.push({
                type: 'condition',
                title: 'Add Momentum Filter',
                description: 'No momentum indicator detected. Consider adding RSI > 50 for longs to filter counter-trend entries.',
                impact: 'medium',
                icon: '🔄',
                action: { addCondition: { source: 'rsi', comparison: 'greater_than', threshold: 50 } },
            });
        }

        if (conditions.length === 1) {
            suggestions.push({
                type: 'condition',
                title: 'Add Confluence',
                description: 'Single-condition strategies are noisy. Add a second confirming condition for higher-quality signals.',
                impact: 'medium',
                icon: '🎚️',
                action: null,
            });
        }

        return suggestions;
    }

    // ─── Exit Analysis ──────────────────────────────────────────

    _analyzeExitRules(config, results) {
        const suggestions = [];
        const exitRules = config.exitRules || [];
        const hasTrailing = exitRules.some(r => r.type === 'trailing_stop');
        const hasBarsHeld = exitRules.some(r => r.type === 'bars_held');

        // Calculate max adverse excursion (MAE)
        const trades = results.trades || [];
        const tradesWithRuns = trades.filter(t => t.barsHeld > 20);

        if (!hasTrailing && this._winRate(trades) > 50) {
            suggestions.push({
                type: 'exit',
                title: 'Add Trailing Stop',
                description: 'With a positive win rate, a trailing stop can protect profits during extended moves. Try 2× ATR trailing.',
                impact: 'medium',
                icon: '🎯',
                action: { addExit: { type: 'trailing_stop', atrMult: 2 } },
            });
        }

        if (!hasBarsHeld && tradesWithRuns.length > trades.length * 0.3) {
            suggestions.push({
                type: 'exit',
                title: 'Add Time Exit',
                description: `${Math.round((tradesWithRuns.length / trades.length) * 100)}% of trades lasted 20+ bars. A time exit at 15 bars can reduce drawdown exposure.`,
                impact: 'low',
                icon: '⏰',
                action: { addExit: { type: 'bars_held', bars: 15 } },
            });
        }

        return suggestions;
    }

    // ─── Regime Fit Analysis ────────────────────────────────────

    _analyzeRegimeFit(results) {
        const suggestions = [];
        const trades = results.trades || [];
        if (trades.length < 10) return suggestions;

        // Split trades into winning/losing streaks to detect regime sensitivity
        let maxConsecLoss = 0;
        let currentLoss = 0;
        for (const t of trades) {
            if ((t.pnl || 0) < 0) { currentLoss++; maxConsecLoss = Math.max(maxConsecLoss, currentLoss); }
            else { currentLoss = 0; }
        }

        if (maxConsecLoss >= 5) {
            suggestions.push({
                type: 'regime',
                title: 'Regime-Sensitive Strategy',
                description: `${maxConsecLoss} consecutive losses detected — this strategy may underperform during certain market regimes. Consider a regime filter.`,
                impact: 'high',
                icon: '🌊',
                action: null,
            });
        }

        // Perfect run days (all wins) — may be curve-fitted
        const dailyPnl = {};
        for (const t of trades) {
            const day = t.date?.slice(0, 10) || 'unknown';
            if (!dailyPnl[day]) dailyPnl[day] = [];
            dailyPnl[day].push(t.pnl || 0);
        }
        const allWinDays = Object.values(dailyPnl).filter(d => d.every(p => p > 0)).length;
        const totalDays = Object.keys(dailyPnl).length;
        if (allWinDays > totalDays * 0.7 && totalDays > 5) {
            suggestions.push({
                type: 'regime',
                title: 'Possible Overfitting',
                description: `${Math.round((allWinDays / totalDays) * 100)}% of days were all-win days. Strategy may be overfit to this period — test on different date ranges.`,
                impact: 'medium',
                icon: '⚠️',
                action: null,
            });
        }

        return suggestions;
    }

    // ─── General Suggestions ────────────────────────────────────

    _analyzeGeneral(results) {
        const suggestions = [];
        const trades = results.trades || [];
        const totalReturn = results.totalReturn || 0;
        const maxDrawdown = results.maxDrawdown || 0;

        // Sharpe-like ratio
        if (totalReturn > 0 && maxDrawdown > 0) {
            const returnToDD = totalReturn / maxDrawdown;
            if (returnToDD < 1) {
                suggestions.push({
                    type: 'general',
                    title: 'Improve Return/Drawdown Ratio',
                    description: `Return-to-drawdown ratio is ${returnToDD.toFixed(2)}. Target 2.0+ for a robust strategy.`,
                    impact: 'medium',
                    icon: '📉',
                    action: null,
                });
            }
        }

        // Too few trades — may not be statistically significant
        if (trades.length < 30) {
            suggestions.push({
                type: 'general',
                title: 'Insufficient Sample Size',
                description: `Only ${trades.length} trades — results may not be statistically significant. Aim for 50+ trades.`,
                impact: 'low',
                icon: '📊',
                action: null,
            });
        }

        return suggestions;
    }

    // ─── Grading ────────────────────────────────────────────────

    _computeGrade(results) {
        const trades = results.trades || [];
        const wr = this._winRate(trades);
        const pf = this._profitFactor(trades);
        const totalReturn = results.totalReturn || 0;
        const maxDD = results.maxDrawdown || 1;
        const returnDD = totalReturn / maxDD;

        let score = 0;
        if (wr >= 50) score += 25;
        else if (wr >= 40) score += 15;
        if (pf >= 2.0) score += 25;
        else if (pf >= 1.5) score += 20;
        else if (pf >= 1.0) score += 10;
        if (returnDD >= 3) score += 25;
        else if (returnDD >= 2) score += 20;
        else if (returnDD >= 1) score += 10;
        if (trades.length >= 50) score += 25;
        else if (trades.length >= 30) score += 15;
        else if (trades.length >= 10) score += 5;

        if (score >= 80) return 'A';
        if (score >= 60) return 'B';
        if (score >= 40) return 'C';
        if (score >= 20) return 'D';
        return 'F';
    }

    _computeStrengthsWeaknesses(results) {
        const trades = results.trades || [];
        const wr = this._winRate(trades);
        const pf = this._profitFactor(trades);
        const strengths = [];
        const weaknesses = [];

        if (wr >= 55) strengths.push(`High win rate (${wr.toFixed(0)}%)`);
        else if (wr < 40) weaknesses.push(`Low win rate (${wr.toFixed(0)}%)`);

        if (pf >= 2.0) strengths.push(`Strong profit factor (${pf.toFixed(2)})`);
        else if (pf < 1.0) weaknesses.push(`Negative expectancy (PF: ${pf.toFixed(2)})`);

        if (trades.length >= 50) strengths.push(`Good sample size (${trades.length} trades)`);
        else weaknesses.push(`Small sample (${trades.length} trades)`);

        const maxDD = results.maxDrawdown || 0;
        if (maxDD > 0 && (results.totalReturn || 0) / maxDD < 1) {
            weaknesses.push(`High drawdown relative to returns`);
        }

        return { strengths, weaknesses };
    }

    // ─── Helpers ────────────────────────────────────────────────

    _winRate(trades) {
        if (!trades.length) return 0;
        return (trades.filter(t => (t.pnl || 0) > 0).length / trades.length) * 100;
    }

    _avgWin(trades) {
        const wins = trades.filter(t => (t.pnl || 0) > 0);
        return wins.length > 0 ? wins.reduce((s, t) => s + (t.pnl || 0), 0) / wins.length : 0;
    }

    _avgLoss(trades) {
        const losses = trades.filter(t => (t.pnl || 0) < 0);
        return losses.length > 0 ? losses.reduce((s, t) => s + (t.pnl || 0), 0) / losses.length : 0;
    }

    _profitFactor(trades) {
        const grossWin = trades.filter(t => (t.pnl || 0) > 0).reduce((s, t) => s + (t.pnl || 0), 0);
        const grossLoss = Math.abs(trades.filter(t => (t.pnl || 0) < 0).reduce((s, t) => s + (t.pnl || 0), 0));
        return grossLoss > 0 ? grossWin / grossLoss : 0;
    }

    _buildSummary(grade, suggestions, strengths) {
        const highImpact = suggestions.filter(s => s.impact === 'high').length;
        const gradeEmoji = { A: '🟢', B: '🟡', C: '🟠', D: '🔴', F: '⛔' }[grade] || '—';
        const parts = [`${gradeEmoji} Strategy Grade: ${grade}`];
        if (strengths.length > 0) parts.push(`Strengths: ${strengths.join(', ')}`);
        if (highImpact > 0) parts.push(`${highImpact} high-impact suggestion${highImpact > 1 ? 's' : ''} found`);
        return parts.join(' • ');
    }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const strategyAdvisor = new _StrategyAdvisor();
export { _StrategyAdvisor as StrategyAdvisor };
export default strategyAdvisor;
