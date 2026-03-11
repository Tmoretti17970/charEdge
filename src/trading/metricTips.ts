// ═══════════════════════════════════════════════════════════════════
// charEdge — Metric Explanations (TypeScript)
//
// Plain-English tooltips for dashboard performance metrics.
// Phase 2: Converted to TypeScript.
// ═══════════════════════════════════════════════════════════════════

/**
 * Plain-English metric explanations for dashboard tooltips
 */
export const METRIC_TIPS: Record<string, string> = {
    'Profit Factor': 'Gross profits ÷ gross losses. Above 1.5 is strong, above 2.0 is excellent.',
    Sharpe: 'Risk-adjusted return. Above 1.0 is good, above 2.0 is very strong.',
    'Max DD': 'Maximum drawdown — the largest peak-to-trough decline in your equity.',
    Expectancy: 'Average amount you expect to win (or lose) per trade.',
    'Kelly Criterion': 'Optimal position size based on your win rate and risk/reward.',
    'Risk of Ruin': 'Probability of losing your entire account with current strategy.',
    Sortino: 'Like Sharpe but only penalizes downside volatility. Higher is better.',
    'Win Rate': 'Percentage of trades that are profitable.',
    'Win/Loss Ratio': 'Average win size ÷ average loss size. Above 1.5 means wins are larger than losses.',
    Trades: 'Total number of trades in this period.',
};
