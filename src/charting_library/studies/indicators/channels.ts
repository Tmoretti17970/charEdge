// ═══════════════════════════════════════════════════════════════
// charEdge — Channel Indicators
// donchianChannel, keltnerChannel, linearRegressionChannel
// ═══════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';
import { closes } from './helpers.ts';
import { ema } from './movingAverages.ts';
import { atr } from './atr.ts';

/** Full Donchian Channel (upper, lower, basis). */
export function donchianChannel(
  bars: Bar[], period: number = 20,
): { upper: number[]; lower: number[]; basis: number[] } {
  const upper = new Array(bars.length).fill(NaN);
  const lower = new Array(bars.length).fill(NaN);
  const basis = new Array(bars.length).fill(NaN);
  for (let i = period - 1; i < bars.length; i++) {
    let h = -Infinity, l = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (bars[j].high > h) h = bars[j].high;
      if (bars[j].low < l) l = bars[j].low;
    }
    upper[i] = h;
    lower[i] = l;
    basis[i] = (h + l) / 2;
  }
  return { upper, lower, basis };
}

/** Keltner Channel — EMA ± ATR multiplier. */
export function keltnerChannel(
  bars: Bar[], emaPeriod: number = 20, atrPeriod: number = 10, multiplier: number = 1.5,
): { middle: number[]; upper: number[]; lower: number[] } {
  const cls = closes(bars);
  const middle = ema(cls, emaPeriod);
  const atrVals = atr(bars, atrPeriod);
  const upper = new Array(bars.length).fill(NaN);
  const lower = new Array(bars.length).fill(NaN);

  for (let i = 0; i < bars.length; i++) {
    if (!isNaN(middle[i]) && !isNaN(atrVals[i])) {
      upper[i] = middle[i] + multiplier * atrVals[i];
      lower[i] = middle[i] - multiplier * atrVals[i];
    }
  }
  return { middle, upper, lower };
}

/** Linear Regression Channel. */
export function linearRegressionChannel(
  src: number[], period: number = 20, stdDevMult: number = 2,
): { mid: number[]; upper: number[]; lower: number[] } {
  const mid = new Array(src.length).fill(NaN);
  const upper = new Array(src.length).fill(NaN);
  const lower = new Array(src.length).fill(NaN);

  for (let i = period - 1; i < src.length; i++) {
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let j = 0; j < period; j++) {
      sumX += j;
      sumY += src[i - period + 1 + j];
      sumXY += j * src[i - period + 1 + j];
      sumX2 += j * j;
    }
    const slope = (period * sumXY - sumX * sumY) / (period * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / period;
    const predicted = intercept + slope * (period - 1);
    mid[i] = predicted;

    let sumSq = 0;
    for (let j = 0; j < period; j++) {
      const pred = intercept + slope * j;
      sumSq += (src[i - period + 1 + j] - pred) ** 2;
    }
    const sd = Math.sqrt(sumSq / period);
    upper[i] = predicted + stdDevMult * sd;
    lower[i] = predicted - stdDevMult * sd;
  }
  return { mid, upper, lower };
}
