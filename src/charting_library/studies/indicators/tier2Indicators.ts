// ═══════════════════════════════════════════════════════════════════
// charEdge — Tier 2 Indicators (Phase 4)
// McGinley Dynamic, Connors RSI, Schaff Trend Cycle,
// Ehlers Fisher Transform, Relative Vigor Index
// ═══════════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';

// ─── 4.7 McGinley Dynamic MA ─────────────────────────────────────

/**
 * McGinley Dynamic — adaptive moving average that adjusts speed
 * based on price distance from the average.
 * MD[i] = MD[i-1] + (close - MD[i-1]) / (k × period × (close/MD[i-1])⁴)
 *
 * @param src    - Source values (typically closes)
 * @param period - Smoothing period (default 14)
 * @param k      - Adjustment constant (default 0.6)
 */
export function mcginleyDynamic(
    src: number[],
    period: number = 14,
    k: number = 0.6,
): { values: number[] } {
    const n = src.length;
    const values = new Array<number>(n).fill(NaN);
    if (n === 0) return { values };

    values[0] = src[0]!;

    for (let i = 1; i < n; i++) {
        const prev = values[i - 1]!;
        const close = src[i]!;
        if (isNaN(prev) || isNaN(close) || prev === 0) {
            values[i] = close;
            continue;
        }
        const ratio = close / prev;
        const denom = k * period * Math.pow(ratio, 4);
        values[i] = prev + (close - prev) / (denom || 1);
    }

    return { values };
}

// ─── 4.8 Connors RSI ─────────────────────────────────────────────

/**
 * Connors RSI — composite of 3 components:
 * 1. RSI(close, rsiPeriod)
 * 2. RSI(upDownStreak, streakPeriod)
 * 3. PercentRank(ROC, pctRankPeriod)
 * Final = average of all three
 */
export function connorsRsi(
    bars: Bar[],
    rsiPeriod: number = 3,
    streakPeriod: number = 2,
    pctRankPeriod: number = 100,
): { values: number[] } {
    const n = bars.length;
    const values = new Array<number>(n).fill(NaN);
    if (n < 2) return { values };

    const closes = bars.map(b => b.close);

    // Component 1: Standard RSI
    const rsi1 = _rsi(closes, rsiPeriod);

    // Component 2: Up/Down streak RSI
    const streaks = new Array<number>(n).fill(0);
    for (let i = 1; i < n; i++) {
        if (closes[i]! > closes[i - 1]!) {
            streaks[i] = streaks[i - 1]! > 0 ? streaks[i - 1]! + 1 : 1;
        } else if (closes[i]! < closes[i - 1]!) {
            streaks[i] = streaks[i - 1]! < 0 ? streaks[i - 1]! - 1 : -1;
        } else {
            streaks[i] = 0;
        }
    }
    const rsi2 = _rsi(streaks, streakPeriod);

    // Component 3: Percent rank of 1-bar ROC
    const roc = new Array<number>(n).fill(0);
    for (let i = 1; i < n; i++) {
        roc[i] = closes[i - 1]! !== 0 ? (closes[i]! - closes[i - 1]!) / closes[i - 1]! * 100 : 0;
    }
    const pctRank = new Array<number>(n).fill(NaN);
    for (let i = pctRankPeriod; i < n; i++) {
        let count = 0;
        for (let j = i - pctRankPeriod; j < i; j++) {
            if (roc[j]! < roc[i]!) count++;
        }
        pctRank[i] = (count / pctRankPeriod) * 100;
    }

    // Average all three
    const minStart = Math.max(rsiPeriod, streakPeriod, pctRankPeriod);
    for (let i = minStart; i < n; i++) {
        const r1 = rsi1[i]!;
        const r2 = rsi2[i]!;
        const r3 = pctRank[i]!;
        if (!isNaN(r1) && !isNaN(r2) && !isNaN(r3)) {
            values[i] = (r1 + r2 + r3) / 3;
        }
    }

    return { values };
}

// ─── 4.9 Schaff Trend Cycle ──────────────────────────────────────

/**
 * Schaff Trend Cycle — double-smoothed stochastic of MACD.
 * Faster cycle detection than standard MACD.
 */
export function schaffTrendCycle(
    src: number[],
    period: number = 10,
    fastPeriod: number = 23,
    slowPeriod: number = 50,
): { values: number[] } {
    const n = src.length;
    const values = new Array<number>(n).fill(NaN);
    if (n < slowPeriod + period) return { values };

    // Step 1: MACD line
    const fastEma = _ema(src, fastPeriod);
    const slowEma = _ema(src, slowPeriod);
    const macdLine = new Array<number>(n).fill(NaN);
    for (let i = 0; i < n; i++) {
        if (!isNaN(fastEma[i]!) && !isNaN(slowEma[i]!)) {
            macdLine[i] = fastEma[i]! - slowEma[i]!;
        }
    }

    // Step 2: First stochastic of MACD
    const stoch1 = new Array<number>(n).fill(NaN);
    const f1 = new Array<number>(n).fill(NaN);
    for (let i = period - 1; i < n; i++) {
        let hi = -Infinity, lo = Infinity;
        for (let j = i - period + 1; j <= i; j++) {
            if (isNaN(macdLine[j]!)) continue;
            hi = Math.max(hi, macdLine[j]!);
            lo = Math.min(lo, macdLine[j]!);
        }
        const range = hi - lo;
        stoch1[i] = range > 0 ? ((macdLine[i]! - lo) / range) * 100 : 50;
    }

    // EMA smooth stoch1
    const factor = 0.5; // Schaff smoothing factor
    f1[period - 1] = stoch1[period - 1]!;
    for (let i = period; i < n; i++) {
        if (isNaN(stoch1[i]!)) continue;
        f1[i] = isNaN(f1[i - 1]!) ? stoch1[i]! : f1[i - 1]! + factor * (stoch1[i]! - f1[i - 1]!);
    }

    // Step 3: Second stochastic of f1
    const f2 = new Array<number>(n).fill(NaN);
    for (let i = period * 2 - 2; i < n; i++) {
        let hi = -Infinity, lo = Infinity;
        for (let j = i - period + 1; j <= i; j++) {
            if (isNaN(f1[j]!)) continue;
            hi = Math.max(hi, f1[j]!);
            lo = Math.min(lo, f1[j]!);
        }
        const range = hi - lo;
        const stoch2 = range > 0 ? ((f1[i]! - lo) / range) * 100 : 50;
        f2[i] = isNaN(f2[i - 1]!) ? stoch2 : f2[i - 1]! + factor * (stoch2 - f2[i - 1]!);
    }

    // Clamp to 0-100
    for (let i = 0; i < n; i++) {
        if (!isNaN(f2[i]!)) {
            values[i] = Math.max(0, Math.min(100, f2[i]!));
        }
    }

    return { values };
}

// ─── 4.10 Ehlers Fisher Transform ───────────────────────────────

/**
 * Ehlers Fisher Transform — normalizes price then applies Fisher
 * transform to sharpen turning points.
 */
export function ehlersFisher(
    bars: Bar[],
    period: number = 10,
): { fisher: number[]; trigger: number[] } {
    const n = bars.length;
    const fisher = new Array<number>(n).fill(NaN);
    const trigger = new Array<number>(n).fill(NaN);
    if (n < period) return { fisher, trigger };

    let prevNorm = 0;
    let prevFish = 0;

    for (let i = period - 1; i < n; i++) {
        // Midprice
        let hi = -Infinity, lo = Infinity;
        for (let j = i - period + 1; j <= i; j++) {
            hi = Math.max(hi, bars[j]!.high);
            lo = Math.min(lo, bars[j]!.low);
        }
        const mid = (bars[i]!.high + bars[i]!.low) / 2;
        const range = hi - lo;

        // Normalize to -1..+1
        let norm = range > 0 ? 2 * ((mid - lo) / range - 0.5) : 0;
        // Smooth
        norm = 0.33 * norm + 0.67 * prevNorm;
        // Clamp to avoid atanh singularity
        norm = Math.max(-0.999, Math.min(0.999, norm));

        // Fisher transform: 0.5 * ln((1+x)/(1-x))
        const fish = 0.5 * Math.log((1 + norm) / (1 - norm));

        fisher[i] = fish;
        trigger[i] = prevFish;

        prevNorm = norm;
        prevFish = fish;
    }

    return { fisher, trigger };
}

// ─── 4.11 Relative Vigor Index ──────────────────────────────────

/**
 * RVI — measures the conviction of a price move by comparing
 * close-open to high-low, with symmetric 4-bar weighting.
 */
export function rvi(
    bars: Bar[],
    period: number = 10,
): { rvi: number[]; signal: number[] } {
    const n = bars.length;
    const rviVals = new Array<number>(n).fill(NaN);
    const signalVals = new Array<number>(n).fill(NaN);
    if (n < period + 3) return { rvi: rviVals, signal: signalVals };

    // Symmetric-weighted numerator and denominator
    const num = new Array<number>(n).fill(0);
    const den = new Array<number>(n).fill(0);

    for (let i = 3; i < n; i++) {
        num[i] = (
            (bars[i]!.close - bars[i]!.open) +
            2 * (bars[i - 1]!.close - bars[i - 1]!.open) +
            2 * (bars[i - 2]!.close - bars[i - 2]!.open) +
            (bars[i - 3]!.close - bars[i - 3]!.open)
        ) / 6;
        den[i] = (
            (bars[i]!.high - bars[i]!.low) +
            2 * (bars[i - 1]!.high - bars[i - 1]!.low) +
            2 * (bars[i - 2]!.high - bars[i - 2]!.low) +
            (bars[i - 3]!.high - bars[i - 3]!.low)
        ) / 6;
    }

    // SMA of num/den
    for (let i = period + 2; i < n; i++) {
        let sumNum = 0, sumDen = 0;
        for (let j = i - period + 1; j <= i; j++) {
            sumNum += num[j]!;
            sumDen += den[j]!;
        }
        rviVals[i] = sumDen !== 0 ? sumNum / sumDen : 0;
    }

    // Signal line: symmetric 4-bar weighted average of RVI
    for (let i = period + 5; i < n; i++) {
        if (isNaN(rviVals[i]!) || isNaN(rviVals[i - 3]!)) continue;
        signalVals[i] = (
            rviVals[i]! +
            2 * rviVals[i - 1]! +
            2 * rviVals[i - 2]! +
            rviVals[i - 3]!
        ) / 6;
    }

    return { rvi: rviVals, signal: signalVals };
}

// ─── Internal Helpers ────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/naming-convention
function _rsi(src: number[], period: number): number[] {
    const n = src.length;
    const out = new Array<number>(n).fill(NaN);
    if (n < period + 1) return out;

    let avgGain = 0, avgLoss = 0;
    for (let i = 1; i <= period; i++) {
        const diff = src[i]! - src[i - 1]!;
        if (diff > 0) avgGain += diff;
        else avgLoss -= diff;
    }
    avgGain /= period;
    avgLoss /= period;
    out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

    for (let i = period + 1; i < n; i++) {
        const diff = src[i]! - src[i - 1]!;
        avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
        avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
        out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
    return out;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function _ema(src: number[], period: number): number[] {
    const n = src.length;
    const out = new Array<number>(n).fill(NaN);
    if (n < period) return out;

    const k = 2 / (period + 1);
    let sum = 0;
    for (let i = 0; i < period; i++) sum += src[i]!;
    out[period - 1] = sum / period;

    for (let i = period; i < n; i++) {
        out[i] = src[i]! * k + out[i - 1]! * (1 - k);
    }
    return out;
}
