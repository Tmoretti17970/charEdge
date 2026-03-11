// ═══════════════════════════════════════════════════════════════════
// charEdge — Failure Hedge Filter (Phase 3)
// Disqualify signals in failure-prone market conditions
// ═══════════════════════════════════════════════════════════════════

import type { SignalMark } from './signalMarks.ts';
import type { Regime } from './regimeSwitcher.ts';

export interface FailureContext {
    regime: Regime[];    // Per-bar regime classification
    rvol: number[];      // Relative volume values
    atr: number[];       // ATR values (for volatility extremes)
}

/**
 * Filter out signals that appear in failure-prone conditions:
 * - Trend-following signals in ranging markets
 * - Mean-reversion signals in strong trends
 * - Any signals during extremely low volume
 * - Signals at volatility extremes (ATR spikes)
 *
 * @param signals    - Input signal marks
 * @param context    - Market context data
 * @param currentIdx - Current bar index
 */
export function filterFailures(
    signals: SignalMark[],
    context: FailureContext,
    _currentIdx: number,
): SignalMark[] {
    return signals.filter(signal => {
        const idx = signal.idx;
        if (idx < 0 || idx >= context.regime.length) return true;

        const regime = context.regime[idx];
        const rvol = context.rvol[idx];
        const atrVal = context.atr[idx];

        // Rule 1: Filter low-volume signals (RVOL < 0.3 = "dead" volume)
        if (!isNaN(rvol!) && rvol! < 0.3) return false;

        // Rule 2: In ranging markets, filter momentum/trend signals
        if (regime === 'ranging') {
            const trendSignals = ['macd_bull_cross', 'macd_bear_cross'];
            if (trendSignals.includes(signal.type)) return false;
        }

        // Rule 3: In strong trends, be cautious about counter-trend signals
        if (regime === 'trending') {
            // Compute recent ATR percentile for "exhaustion" detection
            const lookback = Math.min(50, idx);
            let atrSum = 0, atrCount = 0;
            for (let j = idx - lookback; j < idx; j++) {
                if (j >= 0 && !isNaN(context.atr[j]!)) {
                    atrSum += context.atr[j]!;
                    atrCount++;
                }
            }
            const avgATR = atrCount > 0 ? atrSum / atrCount : 0;

            // ATR spike > 2x average = volatility exhaustion, filter counter-trend
            if (!isNaN(atrVal!) && avgATR > 0 && atrVal! > avgATR * 2) {
                // Only filter counter-trend signals during exhaustion
                const counterTrend = signal.type.includes('cross_30') || signal.type.includes('bull_cross');
                if (counterTrend) return false;
            }
        }

        return true;
    });
}
