// ═══════════════════════════════════════════════════════════════
// charEdge — MACD (Moving Average Convergence Divergence)
// ═══════════════════════════════════════════════════════════════

import { ema } from './movingAverages.ts';

/**
 * MACD.
 * @param src    - Source values (typically closes)
 * @param fast   - Fast EMA period (default 12)
 * @param slow   - Slow EMA period (default 26)
 * @param signal - Signal EMA period (default 9)
 */
export function macd(
  src: number[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9,
): { macd: number[]; signal: number[]; histogram: number[] } {
  const fastEma = ema(src, fast);
  const slowEma = ema(src, slow);

  const macdLine = fastEma.map((f, i) => (isNaN(f) || isNaN(slowEma[i]) ? NaN : f - slowEma[i]));

  const cleanMacd = macdLine.map((v) => (isNaN(v) ? 0 : v));
  const signalLine = ema(cleanMacd, signal);

  const firstValid = macdLine.findIndex((v) => !isNaN(v));
  const signalOut = signalLine.map((v, i) => (i < firstValid + signal - 1 ? NaN : v));

  const histogram = macdLine.map((m, i) => (isNaN(m) || isNaN(signalOut[i]) ? NaN : m - signalOut[i]));

  return { macd: macdLine, signal: signalOut, histogram };
}
