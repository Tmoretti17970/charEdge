// ═══════════════════════════════════════════════════════════════════
// charEdge — Anomaly Detector (6.1.5)
//
// Z-score based statistical anomaly detection on price and volume.
// Flags candles with extreme deviations for alerting and analysis.
//
// Usage:
//   import { anomalyDetector } from './AnomalyDetector.ts';
//   const anomalies = anomalyDetector.detect(candles);
//   // [{ index: 42, type: 'price_spike', zScore: 3.2, ... }]
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export interface CandleInput {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface Anomaly {
    index: number;              // Candle index in array
    time: number;               // Candle timestamp
    type: AnomalyType;
    zScore: number;             // How many σ from mean
    severity: 'low' | 'medium' | 'high';
    value: number;              // The anomalous value
    mean: number;               // Rolling mean at that point
    description: string;        // Human-readable description
}

export type AnomalyType =
    | 'price_spike'       // Abnormal price move
    | 'price_gap'         // Gap up/down at open
    | 'volume_spike'      // Abnormal volume
    | 'range_expansion'   // Unusually wide high-low range
    | 'doji_cluster';     // Cluster of indecisive candles

// ─── Constants ──────────────────────────────────────────────────

const DEFAULT_WINDOW = 20;     // Rolling window for stats
const DEFAULT_THRESHOLD = 2.5; // Z-score threshold for anomaly
const HIGH_THRESHOLD = 3.5;    // High severity
const GAP_THRESHOLD = 0.02;    // 2% gap → anomaly

// ─── Anomaly Detector ───────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/naming-convention
class _AnomalyDetector {

    /**
     * Detect all anomalies in a candle array.
     *
     * @param candles - OHLCV array (oldest first)
     * @param opts - Detection options
     * @returns Array of detected anomalies, sorted by severity
     */
    detect(
        candles: CandleInput[],
        opts: { window?: number; threshold?: number } = {},
    ): Anomaly[] {
        const window = opts.window || DEFAULT_WINDOW;
        const threshold = opts.threshold || DEFAULT_THRESHOLD;

        if (candles.length < window + 1) return [];

        const anomalies: Anomaly[] = [];

        anomalies.push(...this._detectPriceSpikes(candles, window, threshold));
        anomalies.push(...this._detectPriceGaps(candles, window));
        anomalies.push(...this._detectVolumeSpikes(candles, window, threshold));
        anomalies.push(...this._detectRangeExpansion(candles, window, threshold));

        // Sort by severity (high first), then by z-score
        const severityOrder = { high: 0, medium: 1, low: 2 };
        anomalies.sort((a, b) =>
            severityOrder[a.severity] - severityOrder[b.severity] || b.zScore - a.zScore,
        );

        return anomalies;
    }

    /**
     * Detect anomalies in the most recent N candles only (for streaming).
     */
    detectRecent(candles: CandleInput[], lookback = 5): Anomaly[] {
        const start = Math.max(0, candles.length - DEFAULT_WINDOW - lookback);
        const window = candles.slice(start);
        const all = this.detect(window);

        // Only return anomalies in the most recent `lookback` candles
        const cutoff = candles.length - lookback;
        return all.filter(a => a.index + start >= cutoff).map(a => ({
            ...a,
            index: a.index + start, // Remap to original array index
        }));
    }

    /**
     * Compute a Z-score for a single value against a rolling window.
     */
    zScore(value: number, values: number[]): number {
        if (values.length < 2) return 0;
        const mean = values.reduce((s, v) => s + v, 0) / values.length;
        const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
        const sd = Math.sqrt(variance);
        return sd > 0 ? (value - mean) / sd : 0;
    }

    // ─── Detection Methods ──────────────────────────────────────

    /** @private — Detect abnormal close-to-close moves */
    _detectPriceSpikes(candles: CandleInput[], window: number, threshold: number): Anomaly[] {
        const results: Anomaly[] = [];
        const returns: number[] = [];

        for (let i = 1; i < candles.length; i++) {
            const ret = (candles[i].close - candles[i - 1].close) / (candles[i - 1].close || 1);
            returns.push(ret);

            if (returns.length >= window) {
                const windowReturns = returns.slice(-window);
                const z = this.zScore(ret, windowReturns);

                if (Math.abs(z) >= threshold) {
                    results.push({
                        index: i,
                        time: candles[i].time,
                        type: 'price_spike',
                        zScore: Math.round(Math.abs(z) * 100) / 100,
                        severity: Math.abs(z) >= HIGH_THRESHOLD ? 'high' : Math.abs(z) >= threshold ? 'medium' : 'low',
                        value: candles[i].close,
                        mean: candles.slice(Math.max(0, i - window), i).reduce((s, c) => s + c.close, 0) / window,
                        description: `${ret > 0 ? 'Bullish' : 'Bearish'} price spike: ${(ret * 100).toFixed(2)}% move (${Math.abs(z).toFixed(1)}σ)`,
                    });
                }
            }
        }

        return results;
    }

    /** @private — Detect gap opens */
    _detectPriceGaps(candles: CandleInput[], _window: number): Anomaly[] {
        const results: Anomaly[] = [];

        for (let i = 1; i < candles.length; i++) {
            const prevClose = candles[i - 1].close;
            const currentOpen = candles[i].open;
            const gapPct = (currentOpen - prevClose) / (prevClose || 1);

            if (Math.abs(gapPct) >= GAP_THRESHOLD) {
                results.push({
                    index: i,
                    time: candles[i].time,
                    type: 'price_gap',
                    zScore: Math.abs(gapPct) / GAP_THRESHOLD, // Pseudo z-score
                    severity: Math.abs(gapPct) >= 0.05 ? 'high' : 'medium',
                    value: currentOpen,
                    mean: prevClose,
                    description: `Gap ${gapPct > 0 ? 'up' : 'down'}: ${(gapPct * 100).toFixed(2)}% from previous close`,
                });
            }
        }

        return results;
    }

    /** @private — Detect volume spikes */
    _detectVolumeSpikes(candles: CandleInput[], window: number, threshold: number): Anomaly[] {
        const results: Anomaly[] = [];
        const volumes: number[] = [];

        for (let i = 0; i < candles.length; i++) {
            volumes.push(candles[i].volume);

            if (volumes.length >= window) {
                const windowVols = volumes.slice(-window);
                const z = this.zScore(candles[i].volume, windowVols);

                if (z >= threshold) { // Only positive spikes for volume
                    const avgVol = windowVols.reduce((s, v) => s + v, 0) / window;
                    results.push({
                        index: i,
                        time: candles[i].time,
                        type: 'volume_spike',
                        zScore: Math.round(z * 100) / 100,
                        severity: z >= HIGH_THRESHOLD ? 'high' : 'medium',
                        value: candles[i].volume,
                        mean: avgVol,
                        description: `Volume spike: ${(candles[i].volume / avgVol).toFixed(1)}x average (${z.toFixed(1)}σ)`,
                    });
                }
            }
        }

        return results;
    }

    /** @private — Detect unusually wide ranges */
    _detectRangeExpansion(candles: CandleInput[], window: number, threshold: number): Anomaly[] {
        const results: Anomaly[] = [];
        const ranges: number[] = [];

        for (let i = 0; i < candles.length; i++) {
            const range = (candles[i].high - candles[i].low) / (candles[i].close || 1);
            ranges.push(range);

            if (ranges.length >= window) {
                const windowRanges = ranges.slice(-window);
                const z = this.zScore(range, windowRanges);

                if (z >= threshold) {
                    results.push({
                        index: i,
                        time: candles[i].time,
                        type: 'range_expansion',
                        zScore: Math.round(z * 100) / 100,
                        severity: z >= HIGH_THRESHOLD ? 'high' : 'medium',
                        value: candles[i].high - candles[i].low,
                        mean: windowRanges.reduce((s, v) => s + v, 0) / window * (candles[i].close || 1),
                        description: `Range expansion: ${(range * 100).toFixed(2)}% range (${z.toFixed(1)}σ above average)`,
                    });
                }
            }
        }

        return results;
    }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const anomalyDetector = new _AnomalyDetector();
export { _AnomalyDetector as AnomalyDetector };
export default anomalyDetector;
