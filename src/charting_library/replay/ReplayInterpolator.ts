// ═══════════════════════════════════════════════════════════════════
// charEdge — Replay Interpolator (D3.1)
//
// Generates O→H→L→C (or O→L→H→C for bearish) intra-candle
// partial bars for smooth replay animation.
//
// Usage:
//   const interp = new ReplayInterpolator(bar);
//   const partial = interp.getPartialBar(0.5); // halfway through
// ═══════════════════════════════════════════════════════════════════

export interface PartialBar {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    progress: number;
}

export interface OHLCBar {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

// ─── Phase boundaries ───────────────────────────────────────────
// Bullish (close >= open): O → H → L → C
// Bearish (close < open):  O → L → H → C
// We split the [0,1] progress into 3 phases: [0, 0.33], [0.33, 0.66], [0.66, 1.0]

const PHASE_1_END = 1 / 3;
const PHASE_2_END = 2 / 3;

/**
 * Interpolates intra-candle OHLC values for smooth replay animation.
 */
export class ReplayInterpolator {
    private readonly bar: OHLCBar;
    private readonly isBullish: boolean;

    constructor(bar: OHLCBar) {
        this.bar = bar;
        this.isBullish = bar.close >= bar.open;
    }

    /**
     * Get a partial bar at the given progress (0 to 1).
     * @param progress 0 = start of bar, 1 = full bar revealed
     */
    getPartialBar(progress: number): PartialBar {
        const p = Math.max(0, Math.min(1, progress));
        const { open, high, low, close, time, volume } = this.bar;

        if (p === 0) {
            return { time, open, high: open, low: open, close: open, volume: 0, progress: 0 };
        }
        if (p >= 1) {
            return { time, open, high, low, close, volume, progress: 1 };
        }

        // Determine current price based on phase
        let currentPrice: number;
        let currentHigh: number;
        let currentLow: number;

        if (this.isBullish) {
            // Bullish path: O → H → L → C
            if (p <= PHASE_1_END) {
                const t = p / PHASE_1_END;
                currentPrice = lerp(open, high, t);
                currentHigh = currentPrice;
                currentLow = open;
            } else if (p <= PHASE_2_END) {
                const t = (p - PHASE_1_END) / (PHASE_2_END - PHASE_1_END);
                currentPrice = lerp(high, low, t);
                currentHigh = high;
                currentLow = Math.min(open, currentPrice);
            } else {
                const t = (p - PHASE_2_END) / (1 - PHASE_2_END);
                currentPrice = lerp(low, close, t);
                currentHigh = high;
                currentLow = low;
            }
        } else {
            // Bearish path: O → L → H → C
            if (p <= PHASE_1_END) {
                const t = p / PHASE_1_END;
                currentPrice = lerp(open, low, t);
                currentHigh = open;
                currentLow = currentPrice;
            } else if (p <= PHASE_2_END) {
                const t = (p - PHASE_1_END) / (PHASE_2_END - PHASE_1_END);
                currentPrice = lerp(low, high, t);
                currentHigh = Math.max(open, currentPrice);
                currentLow = low;
            } else {
                const t = (p - PHASE_2_END) / (1 - PHASE_2_END);
                currentPrice = lerp(high, close, t);
                currentHigh = high;
                currentLow = low;
            }
        }

        return {
            time,
            open,
            high: currentHigh,
            low: currentLow,
            close: currentPrice,
            volume: volume * p,
            progress: p,
        };
    }
}

/** Linear interpolation */
function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}
