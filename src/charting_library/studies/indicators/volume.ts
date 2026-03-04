// ═══════════════════════════════════════════════════════════════
// charEdge — Volume Indicators
// obv, mfi, cmf, calculateVRVP, adLine
// ═══════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';

/** On Balance Volume. */
export function obv(bars: Bar[]): number[] {
  const out = new Array(bars.length);
  out[0] = bars[0]?.volume || 0;

  for (let i = 1; i < bars.length; i++) {
    if (bars[i].close > bars[i - 1].close) out[i] = out[i - 1] + (bars[i].volume || 0);
    else if (bars[i].close < bars[i - 1].close) out[i] = out[i - 1] - (bars[i].volume || 0);
    else out[i] = out[i - 1];
  }
  return out;
}

/** Money Flow Index. */
export function mfi(bars: Bar[], period: number = 14): number[] {
  const out = new Array(bars.length).fill(NaN);
  const tp = bars.map((b) => (b.high + b.low + b.close) / 3);

  for (let i = period; i < bars.length; i++) {
    let posMF = 0, negMF = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const mf = tp[j] * (bars[j].volume || 0);
      if (tp[j] > tp[j - 1]) posMF += mf;
      else if (tp[j] < tp[j - 1]) negMF += mf;
    }
    out[i] = negMF === 0 ? 100 : 100 - 100 / (1 + posMF / negMF);
  }
  return out;
}

/** Chaikin Money Flow (CMF). */
export function cmf(bars: Bar[], period: number = 20): number[] {
  const out = new Array(bars.length).fill(NaN);
  for (let i = period - 1; i < bars.length; i++) {
    let mfvSum = 0, volSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const hl = bars[j].high - bars[j].low;
      const mfm = hl === 0 ? 0 : ((bars[j].close - bars[j].low) - (bars[j].high - bars[j].close)) / hl;
      mfvSum += mfm * (bars[j].volume || 0);
      volSum += bars[j].volume || 0;
    }
    out[i] = volSum === 0 ? 0 : mfvSum / volSum;
  }
  return out;
}

/** Accumulation/Distribution Line. */
export function adLine(bars: Bar[]): number[] {
  const out = new Array(bars.length).fill(0);
  for (let i = 0; i < bars.length; i++) {
    const hl = bars[i].high - bars[i].low;
    const mfm = hl === 0 ? 0 : ((bars[i].close - bars[i].low) - (bars[i].high - bars[i].close)) / hl;
    out[i] = (i > 0 ? out[i - 1] : 0) + mfm * (bars[i].volume || 0);
  }
  return out;
}

/**
 * Visible Range Volume Profile (VRVP).
 * Returns an array of price bins (NOT aligned 1:1 with bars).
 */
export function calculateVRVP(
  bars: Bar[],
  rowCount: number = 24,
): Array<{ priceStart: number; priceEnd: number; priceCenter: number; totalVol: number; upVol: number; downVol: number }> {
  if (!bars || !bars.length) return [];

  let minP = Infinity, maxP = -Infinity;
  for (const b of bars) {
    if (b.low < minP) minP = b.low;
    if (b.high > maxP) maxP = b.high;
  }

  if (minP === Infinity || minP === maxP) return [];

  const step = (maxP - minP) / rowCount;
  const bins = new Array(rowCount).fill(null).map((_, i) => ({
    priceStart: minP + i * step,
    priceEnd: minP + (i + 1) * step,
    priceCenter: minP + (i + 0.5) * step,
    totalVol: 0,
    upVol: 0,
    downVol: 0,
  }));

  for (const b of bars) {
    if (!b.volume) continue;
    const isUp = b.close >= b.open;
    const typical = (b.high + b.low + b.close) / 3;
    let binIdx = Math.floor((typical - minP) / step);
    if (binIdx < 0) binIdx = 0;
    if (binIdx >= rowCount) binIdx = rowCount - 1;

    bins[binIdx].totalVol += b.volume;
    if (isUp) bins[binIdx].upVol += b.volume;
    else bins[binIdx].downVol += b.volume;
  }

  return bins;
}
