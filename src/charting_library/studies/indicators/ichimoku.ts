// ═══════════════════════════════════════════════════════════════
// charEdge — Ichimoku Cloud
// ichimoku, donchian (helper)
// ═══════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';

/** Donchian Channel helper (highest high, lowest low over period). */
function donchian(bars: Bar[], period: number, i: number): { high: number; low: number; mid: number } {
  let h = -Infinity, l = Infinity;
  for (let j = i - period + 1; j <= i; j++) {
    if (bars[j].high > h) h = bars[j].high;
    if (bars[j].low < l) l = bars[j].low;
  }
  return { high: h, low: l, mid: (h + l) / 2 };
}

/**
 * Ichimoku Cloud.
 */
export function ichimoku(
  bars: Bar[],
  convP: number = 9,
  baseP: number = 26,
  spanP: number = 52,
  disp: number = 26,
): { conversion: number[]; base: number[]; spanA: number[]; spanB: number[]; lagging: number[] } {
  const len = bars.length;
  const conversion = new Array(len).fill(NaN);
  const baseLine = new Array(len).fill(NaN);
  const spanA = new Array(len).fill(NaN);
  const spanB = new Array(len).fill(NaN);
  const lagging = new Array(len).fill(NaN);

  for (let i = 0; i < len; i++) {
    if (i >= convP - 1) {
      conversion[i] = donchian(bars, convP, i).mid;
    }
    if (i >= baseP - 1) {
      baseLine[i] = donchian(bars, baseP, i).mid;
    }
    if (i >= baseP - 1 && !isNaN(conversion[i]) && !isNaN(baseLine[i])) {
      if (i + disp - 1 < len) {
        spanA[i + disp - 1] = (conversion[i] + baseLine[i]) / 2;
      }
    }
    if (i >= spanP - 1) {
      if (i + disp - 1 < len) {
        spanB[i + disp - 1] = donchian(bars, spanP, i).mid;
      }
    }
    if (i >= disp - 1) {
      lagging[i - disp + 1] = bars[i].close;
    }
  }

  return { conversion, base: baseLine, spanA, spanB, lagging };
}
