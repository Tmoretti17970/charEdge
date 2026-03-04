// ═══════════════════════════════════════════════════════════════
// charEdge — Stochastic Oscillator
// ═══════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';
import { sma } from './movingAverages.ts';

/**
 * Stochastic %K and %D.
 */
export function stochastic(
  bars: Bar[],
  kPeriod: number = 14,
  dPeriod: number = 3,
): { k: number[]; d: number[] } {
  const k = new Array(bars.length).fill(NaN);

  for (let i = kPeriod - 1; i < bars.length; i++) {
    let high = -Infinity,
      low = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (bars[j].high > high) high = bars[j].high;
      if (bars[j].low < low) low = bars[j].low;
    }
    const range = high - low;
    k[i] = range === 0 ? 50 : ((bars[i].close - low) / range) * 100;
  }

  const d = sma(
    k.map((v) => (isNaN(v) ? 0 : v)),
    dPeriod,
  );
  const firstK = k.findIndex((v) => !isNaN(v));
  for (let i = 0; i < firstK + dPeriod - 1; i++) d[i] = NaN;

  return { k, d };
}
