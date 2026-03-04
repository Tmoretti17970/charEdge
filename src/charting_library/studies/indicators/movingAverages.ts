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

  let sum = 0;
  for (let i = 0; i < period; i++) sum += src[i];
  out[period - 1] = sum / period;

  for (let i = period; i < src.length; i++) {
    sum += src[i] - src[i - period];
    out[i] = sum / period;
  }
  return out;
}

/**
 * Exponential Moving Average.
 */
export function ema(src: number[], period: number): number[] {
  const out = new Array(src.length).fill(NaN);
  if (period > src.length) return out;

  const k = 2 / (period + 1);

  // Seed with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) sum += src[i];
  out[period - 1] = sum / period;

  for (let i = period; i < src.length; i++) {
    out[i] = src[i] * k + out[i - 1] * (1 - k);
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

/** Double EMA (DEMA). */
export function dema(src: number[], period: number): number[] {
  const e1 = ema(src, period);
  const e2 = ema(
    e1.map((v) => (isNaN(v) ? 0 : v)),
    period,
  );
  return e1.map((v, i) => (isNaN(v) || isNaN(e2[i]) ? NaN : 2 * v - e2[i]));
}

/** Triple EMA (TEMA). */
export function tema(src: number[], period: number): number[] {
  const e1 = ema(src, period);
  const clean1 = e1.map((v) => (isNaN(v) ? 0 : v));
  const e2 = ema(clean1, period);
  const clean2 = e2.map((v) => (isNaN(v) ? 0 : v));
  const e3 = ema(clean2, period);
  return e1.map((v, i) => {
    if (isNaN(v) || isNaN(e2[i]) || isNaN(e3[i])) return NaN;
    return 3 * v - 3 * e2[i] + e3[i];
  });
}

/** Hull Moving Average (HMA). Reduced lag: WMA(2*WMA(n/2) - WMA(n), sqrt(n)) */
export function hma(src: number[], period: number = 9): number[] {
  const half = Math.max(1, Math.floor(period / 2));
  const sqrtP = Math.max(1, Math.floor(Math.sqrt(period)));
  const wmaHalf = wma(src, half);
  const wmaFull = wma(src, period);
  const diff = wmaHalf.map((v, i) => isNaN(v) || isNaN(wmaFull[i]) ? NaN : 2 * v - wmaFull[i]);
  return wma(diff.map(v => isNaN(v) ? 0 : v), sqrtP);
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
