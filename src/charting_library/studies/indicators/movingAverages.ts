// ═══════════════════════════════════════════════════════════════
// charEdge — Moving Average Computations
// SMA, EMA, WMA, DEMA, TEMA, HMA, VWMA, nextEma
// ═══════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';

/**
 * Simple Moving Average.
 * @param src  - Source values
 * @param period - Lookback period
 */
export function sma(src: number[], period: number): number[] {
  const out = new Array(src.length).fill(NaN);
  if (period > src.length) return out;

  // P1: Kahan compensated summation to prevent floating-point drift
  // over long series (50K+ bars). Tracks a compensation term `c`
  // that corrects for truncation error in the running sum.
  let sum = 0;
  let c = 0; // Kahan compensation
  for (let i = 0; i < period; i++) {
    const y = src[i] - c;
    const t = sum + y;
    c = (t - sum) - y;
    sum = t;
  }
  out[period - 1] = sum / period;

  for (let i = period; i < src.length; i++) {
    const drop = src[i - period];
    const add = src[i];
    // Compensated add
    const yAdd = add - c;
    const tAdd = sum + yAdd;
    c = (tAdd - sum) - yAdd;
    sum = tAdd;
    // Compensated subtract
    const ySub = -drop - c;
    const tSub = sum + ySub;
    c = (tSub - sum) - ySub;
    sum = tSub;
    out[i] = sum / period;
  }
  return out;
}

/**
 * NaN-safe Simple Moving Average.
 * Computes SMA over only valid (non-NaN) values within the window.
 * Returns NaN if fewer than half the window values are valid.
 * Use this instead of `sma(arr.map(v => isNaN(v) ? 0 : v), period)`
 * which corrupts values during warm-up.
 */
export function nanSafeSma(src: number[], period: number): number[] {
  const out = new Array(src.length).fill(NaN);
  if (period > src.length) return out;

  for (let i = period - 1; i < src.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (!isNaN(src[j])) {
        sum += src[j];
        count++;
      }
    }
    // Only output if at least half the window has valid values
    out[i] = count >= period / 2 ? sum / count : NaN;
  }
  return out;
}

/**
 * Exponential Moving Average.
 * P1: NaN-tolerant — finds first window of `period` non-NaN values for SMA seed.
 * This enables correct chaining in DEMA/TEMA/MACD without zero-filling.
 */
export function ema(src: number[], period: number): number[] {
  const out = new Array(src.length).fill(NaN);
  if (period > src.length) return out;

  const k = 2 / (period + 1);

  // Find first valid SMA window (skip leading NaN from chained indicators)
  let seedStart = -1;
  for (let s = 0; s <= src.length - period; s++) {
    let valid = true;
    for (let j = s; j < s + period; j++) {
      if (isNaN(src[j])) { valid = false; break; }
    }
    if (valid) { seedStart = s; break; }
  }
  if (seedStart < 0) return out; // No valid window found

  // Seed with SMA over the first valid window
  let sum = 0;
  for (let i = seedStart; i < seedStart + period; i++) sum += src[i];
  const seedIdx = seedStart + period - 1;
  out[seedIdx] = sum / period;

  for (let i = seedIdx + 1; i < src.length; i++) {
    if (isNaN(src[i])) { out[i] = NaN; continue; }
    const prev = out[i - 1];
    out[i] = isNaN(prev) ? src[i] : src[i] * k + prev * (1 - k);
  }
  return out;
}

/** Incremental EMA */
export function nextEma(prevEma: number, nextSrc: number, period: number): number {
  if (isNaN(prevEma)) return NaN;
  const k = 2 / (period + 1);
  return nextSrc * k + prevEma * (1 - k);
}

/** Weighted Moving Average. */
export function wma(src: number[], period: number): number[] {
  const out = new Array(src.length).fill(NaN);
  const denom = (period * (period + 1)) / 2;

  for (let i = period - 1; i < src.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += src[i - period + 1 + j] * (j + 1);
    }
    out[i] = sum / denom;
  }
  return out;
}

/** Double EMA (DEMA). P1 Fix (M2): propagate NaN instead of zero-filling. */
export function dema(src: number[], period: number): number[] {
  const e1 = ema(src, period);
  const e2 = ema(e1, period);
  return e1.map((v, i) => (isNaN(v) || isNaN(e2[i]) ? NaN : 2 * v - e2[i]));
}

/** Triple EMA (TEMA). P1 Fix (M2): propagate NaN instead of zero-filling. */
export function tema(src: number[], period: number): number[] {
  const e1 = ema(src, period);
  const e2 = ema(e1, period);
  const e3 = ema(e2, period);
  return e1.map((v, i) => {
    if (isNaN(v) || isNaN(e2[i]) || isNaN(e3[i])) return NaN;
    return 3 * v - 3 * e2[i] + e3[i];
  });
}

/** Hull Moving Average (HMA). Reduced lag: WMA(2*WMA(n/2) - WMA(n), sqrt(n))
 * P1 Fix (M2): propagate NaN instead of zero-filling. */
export function hma(src: number[], period: number = 9): number[] {
  const half = Math.max(1, Math.floor(period / 2));
  const sqrtP = Math.max(1, Math.floor(Math.sqrt(period)));
  const wmaHalf = wma(src, half);
  const wmaFull = wma(src, period);
  const diff = wmaHalf.map((v, i) => isNaN(v) || isNaN(wmaFull[i]) ? NaN : 2 * v - wmaFull[i]);
  return wma(diff, sqrtP);
}

/** Volume Weighted Moving Average (VWMA). */
export function vwma(bars: Bar[], period: number = 20): number[] {
  const out = new Array(bars.length).fill(NaN);
  for (let i = period - 1; i < bars.length; i++) {
    let sumPV = 0, sumV = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumPV += bars[j].close * (bars[j].volume || 0);
      sumV += bars[j].volume || 0;
    }
    out[i] = sumV === 0 ? bars[i].close : sumPV / sumV;
  }
  return out;
}
