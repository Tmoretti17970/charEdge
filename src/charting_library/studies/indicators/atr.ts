// ═══════════════════════════════════════════════════════════════
// charEdge — ATR (Average True Range)
// trueRange, atr
// ═══════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';

/** True Range. */
export function trueRange(bars: Bar[]): number[] {
  return bars.map((b, i) => {
    if (i === 0) return b.high - b.low;
    const prev = bars[i - 1].close;
    return Math.max(b.high - b.low, Math.abs(b.high - prev), Math.abs(b.low - prev));
  });
}

/**
 * ATR using Wilder's smoothing.
 */
export function atr(bars: Bar[], period: number = 14): number[] {
  const tr = trueRange(bars);
  const out = new Array(bars.length).fill(NaN);

  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i];
  out[period - 1] = sum / period;

  for (let i = period; i < bars.length; i++) {
    out[i] = (out[i - 1] * (period - 1) + tr[i]) / period;
  }
  return out;
}
