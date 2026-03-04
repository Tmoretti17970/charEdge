// ═══════════════════════════════════════════════════════════════
// charEdge — RSI (Relative Strength Index)
// rsi, volumeWeightedRSI
// ═══════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';

/**
 * RSI using Wilder's smoothing method.
 */
export function rsi(src: number[], period: number = 14): number[] {
  const out = new Array(src.length).fill(NaN);
  if (src.length < period + 1) return out;

  let avgGain = 0,
    avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = src[i] - src[i - 1];
    if (change >= 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;

  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < src.length; i++) {
    const change = src[i] - src[i - 1];
    const gain = change >= 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return out;
}

/**
 * Volume-Weighted RSI — RSI that weights price changes by volume.
 */
export function volumeWeightedRSI(bars: Bar[], period: number = 14): number[] {
  const len = bars.length;
  const out = new Array(len).fill(NaN);
  if (len < 2) return out;

  const gains = new Array(len).fill(0);
  const losses = new Array(len).fill(0);

  for (let i = 1; i < len; i++) {
    const diff = bars[i].close - bars[i - 1].close;
    const vol = bars[i].volume || 1;
    if (diff > 0) gains[i] = diff * vol;
    else losses[i] = Math.abs(diff) * vol;
  }

  let avgGain = 0, avgLoss = 0;
  for (let j = 1; j <= period && j < len; j++) {
    avgGain += gains[j];
    avgLoss += losses[j];
  }
  avgGain /= period;
  avgLoss /= period;

  if (period < len) {
    out[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }

  for (let i = period + 1; i < len; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }
  return out;
}
