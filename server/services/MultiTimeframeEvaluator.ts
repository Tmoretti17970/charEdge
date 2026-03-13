// ═══════════════════════════════════════════════════════════════════
// charEdge — Multi-Timeframe Evaluator (Phase D2)
//
// Aggregates 1m bars into higher timeframes (5m, 15m, 1h, 4h, 1d)
// and evaluates indicator conditions across multiple timeframes
// simultaneously. E.g., "RSI < 30 on 5m AND price > $200 on 1h".
//
// Lightweight RSI/MACD computed internally — no TA-Lib dependency.
// ═══════════════════════════════════════════════════════════════════

import { MiniEmitter } from './MiniEmitter';

// ─── Types ──────────────────────────────────────────────────────

export interface Bar {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    time: number;     // Unix ms
}

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export type MTFIndicator = 'price' | 'RSI' | 'MACD' | 'VOLUME';

export type MTFConditionOp = 'above' | 'below' | 'cross_above' | 'cross_below';

export interface MTFCondition {
    timeframe: Timeframe;
    indicator: MTFIndicator;
    condition: MTFConditionOp;
    threshold: number;
}

export interface MTFAlert {
    id: string;
    symbol: string;
    logic: 'AND' | 'OR';
    conditions: MTFCondition[];
}

// ─── Constants ──────────────────────────────────────────────────

const TF_MINUTES: Record<Timeframe, number> = {
    '1m': 1,
    '5m': 5,
    '15m': 15,
    '1h': 60,
    '4h': 240,
    '1d': 1440,
};

const MAX_BARS_PER_TF = 200; // Keep at most this many aggregated bars
const RSI_PERIOD = 14;

// ─── Indicator Math ─────────────────────────────────────────────

function computeRSI(closes: number[], period = RSI_PERIOD): number {
    if (closes.length < period + 1) return 50; // Default neutral

    let avgGain = 0;
    let avgLoss = 0;

    // Initial average
    for (let i = 1; i <= period; i++) {
        const diff = closes[i]! - closes[i - 1]!;
        if (diff > 0) avgGain += diff;
        else avgLoss += Math.abs(diff);
    }
    avgGain /= period;
    avgLoss /= period;

    // Smoothed (Wilder's method)
    for (let i = period + 1; i < closes.length; i++) {
        const diff = closes[i]! - closes[i - 1]!;
        avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
        avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function computeMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
    if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 };

    const ema12 = computeEMA(closes, 12);
    const ema26 = computeEMA(closes, 26);
    const macdLine = ema12 - ema26;

    // Simple approximation of MACD signal (9-period EMA of MACD line)
    // For a proper signal we'd need the full MACD history — use current value as approximation
    return { macd: macdLine, signal: 0, histogram: macdLine };
}

function computeEMA(data: number[], period: number): number {
    if (data.length === 0) return 0;
    const k = 2 / (period + 1);
    let ema = data[0]!;
    for (let i = 1; i < data.length; i++) {
        ema = data[i]! * k + ema * (1 - k);
    }
    return ema;
}

// ─── Bar Aggregation ────────────────────────────────────────────

function aggregateBars(bars1m: Bar[], tfMinutes: number): Bar[] {
    if (bars1m.length === 0) return [];

    const aggregated: Bar[] = [];
    let current: Bar | null = null;
    let bucketStart = 0;

    for (const bar of bars1m) {
        const bucket = Math.floor(bar.time / (tfMinutes * 60 * 1000));

        if (bucket !== bucketStart || !current) {
            if (current) aggregated.push(current);
            current = { ...bar };
            bucketStart = bucket;
        } else {
            current.high = Math.max(current.high, bar.high);
            current.low = Math.min(current.low, bar.low);
            current.close = bar.close;
            current.volume += bar.volume;
        }
    }
    if (current) aggregated.push(current);

    return aggregated.slice(-MAX_BARS_PER_TF);
}

// ─── Evaluator Class ────────────────────────────────────────────

export class MultiTimeframeEvaluator extends MiniEmitter {
    // symbol → 1m bar buffer
    private barBuffers: Map<string, Bar[]> = new Map();
    // symbol:tf → last indicator value (for cross detection)
    private lastValues: Map<string, number> = new Map();

    /**
     * Push a 1-minute bar for a symbol. Higher TFs are built on-the-fly.
     */
    pushBar(symbol: string, bar: Bar): void {
        const sym = symbol.toUpperCase();
        let buffer = this.barBuffers.get(sym);
        if (!buffer) {
            buffer = [];
            this.barBuffers.set(sym, buffer);
        }
        buffer.push(bar);
        // Keep 1440 bars max (1 day of 1m data)
        if (buffer.length > 1440) buffer.shift();
    }

    /**
     * Get aggregated bars for a symbol + timeframe.
     */
    getBars(symbol: string, timeframe: Timeframe): Bar[] {
        const sym = symbol.toUpperCase();
        const buffer = this.barBuffers.get(sym) || [];
        if (timeframe === '1m') return buffer.slice(-MAX_BARS_PER_TF);
        return aggregateBars(buffer, TF_MINUTES[timeframe]);
    }

    /**
     * Compute an indicator value for a symbol + timeframe.
     */
    getIndicatorValue(symbol: string, timeframe: Timeframe, indicator: MTFIndicator): number {
        const bars = this.getBars(symbol, timeframe);
        if (bars.length === 0) return 0;

        const closes = bars.map((b) => b.close);

        switch (indicator) {
            case 'price':
                return closes[closes.length - 1] || 0;
            case 'RSI':
                return computeRSI(closes);
            case 'MACD':
                return computeMACD(closes).histogram;
            case 'VOLUME':
                return bars[bars.length - 1]?.volume || 0;
            default:
                return 0;
        }
    }

    /**
     * Evaluate a multi-timeframe alert. Returns true if triggered.
     */
    evaluate(alert: MTFAlert): boolean {
        const results = alert.conditions.map((cond) => {
            const currentValue = this.getIndicatorValue(alert.symbol, cond.timeframe, cond.indicator);
            const lastKey = `${alert.symbol}:${cond.timeframe}:${cond.indicator}`;
            const lastValue = this.lastValues.get(lastKey) ?? null;

            let met = false;
            switch (cond.condition) {
                case 'above':
                    met = currentValue >= cond.threshold;
                    break;
                case 'below':
                    met = currentValue <= cond.threshold;
                    break;
                case 'cross_above':
                    met = lastValue != null && lastValue < cond.threshold && currentValue >= cond.threshold;
                    break;
                case 'cross_below':
                    met = lastValue != null && lastValue > cond.threshold && currentValue <= cond.threshold;
                    break;
            }

            this.lastValues.set(lastKey, currentValue);
            return met;
        });

        const triggered = alert.logic === 'AND'
            ? results.every(Boolean)
            : results.some(Boolean);

        if (triggered) {
            this.emit('mtf:triggered', {
                alertId: alert.id,
                symbol: alert.symbol,
                conditions: alert.conditions,
            });
        }

        return triggered;
    }

    /**
     * Check if we have enough data for meaningful indicator computation.
     */
    hasData(symbol: string): boolean {
        const buffer = this.barBuffers.get(symbol.toUpperCase());
        return !!buffer && buffer.length >= 30;
    }

    reset(): void {
        this.barBuffers.clear();
        this.lastValues.clear();
    }
}

export default MultiTimeframeEvaluator;
