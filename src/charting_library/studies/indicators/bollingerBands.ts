// ═══════════════════════════════════════════════════════════════
// charEdge — Bollinger Bands
// ═══════════════════════════════════════════════════════════════

import { sma } from './movingAverages.ts';

/**
 * Bollinger Bands.
 * @param src    - Source values (typically closes)
 * @param period - SMA period (default 20)
 * @param stdDev - Standard deviation multiplier (default 2)
 */
export function bollingerBands(
  src: number[],
  period: number = 20,
  stdDev: number = 2,
): { middle: number[]; upper: number[]; lower: number[] } {
  const middle = sma(src, period);
  const upper = new Array(src.length).fill(NaN);
  const lower = new Array(src.length).fill(NaN);

  for (let i = period - 1; i < src.length; i++) {
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = src[j] - middle[i];
      sumSq += diff * diff;
    }
    const sd = Math.sqrt(sumSq / period);
    upper[i] = middle[i] + stdDev * sd;
    lower[i] = middle[i] - stdDev * sd;
  }

  return { middle, upper, lower };
}
