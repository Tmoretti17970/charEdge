// ═══════════════════════════════════════════════════════════════
// charEdge — ADX (Average Directional Index)
// ═══════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';
import { trueRange } from './atr.ts';

/**
 * ADX with +DI and -DI.
 */
export function adx(
  bars: Bar[],
  period: number = 14,
): { adx: number[]; plusDI: number[]; minusDI: number[] } {
  const len = bars.length;
  const plusDI = new Array(len).fill(NaN);
  const minusDI = new Array(len).fill(NaN);
  const adxOut = new Array(len).fill(NaN);

  const tr = trueRange(bars);

  const plusDM = new Array(len).fill(0);
  const minusDM = new Array(len).fill(0);

  for (let i = 1; i < len; i++) {
    const upMove = bars[i].high - bars[i - 1].high;
    const downMove = bars[i - 1].low - bars[i].low;
    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
  }

  let sTR = 0, sPDM = 0, sMDM = 0;
  for (let i = 0; i < period; i++) {
    sTR += tr[i];
    sPDM += plusDM[i];
    sMDM += minusDM[i];
  }

  for (let i = period; i < len; i++) {
    sTR = sTR - sTR / period + tr[i];
    sPDM = sPDM - sPDM / period + plusDM[i];
    sMDM = sMDM - sMDM / period + minusDM[i];

    plusDI[i] = sTR > 0 ? (sPDM / sTR) * 100 : 0;
    minusDI[i] = sTR > 0 ? (sMDM / sTR) * 100 : 0;
  }

  const dx = new Array(len).fill(NaN);
  for (let i = period; i < len; i++) {
    const sum = plusDI[i] + minusDI[i];
    dx[i] = sum > 0 ? (Math.abs(plusDI[i] - minusDI[i]) / sum) * 100 : 0;
  }

  let adxSum = 0;
  const adxStart = period * 2;
  for (let i = period; i < adxStart && i < len; i++) adxSum += isNaN(dx[i]) ? 0 : dx[i];
  if (adxStart < len) adxOut[adxStart - 1] = adxSum / period;

  for (let i = adxStart; i < len; i++) {
    adxOut[i] = (adxOut[i - 1] * (period - 1) + (isNaN(dx[i]) ? 0 : dx[i])) / period;
  }

  return { adx: adxOut, plusDI, minusDI };
}
