// ═══════════════════════════════════════════════════════════════
// charEdge — Trend Indicators
// supertrend, parabolicSAR, vortex
// ═══════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';
import { atr } from './atr.ts';

/** Supertrend — ATR-based trend-following indicator. */
export function supertrend(
  bars: Bar[], period: number = 10, multiplier: number = 3,
): { supertrend: number[]; direction: number[] } {
  const len = bars.length;
  const st = new Array(len).fill(NaN);
  const dir = new Array(len).fill(1);
  const atrVals = atr(bars, period);

  let prevUpper = 0, prevLower = 0;

  for (let i = period; i < len; i++) {
    const hl2 = (bars[i].high + bars[i].low) / 2;
    const atrVal = atrVals[i];
    if (isNaN(atrVal)) continue;

    let curUpper = hl2 + multiplier * atrVal;
    let curLower = hl2 - multiplier * atrVal;

    if (i > period) {
      curUpper = curUpper < prevUpper || bars[i - 1].close > prevUpper ? curUpper : prevUpper;
      curLower = curLower > prevLower || bars[i - 1].close < prevLower ? curLower : prevLower;
    }

    if (i === period) {
      dir[i] = bars[i].close > curUpper ? 1 : -1;
    } else {
      if (dir[i - 1] === 1) {
        dir[i] = bars[i].close < curLower ? -1 : 1;
      } else {
        dir[i] = bars[i].close > curUpper ? 1 : -1;
      }
    }

    st[i] = dir[i] === 1 ? curLower : curUpper;
    prevUpper = curUpper;
    prevLower = curLower;
  }
  return { supertrend: st, direction: dir };
}

/** Parabolic SAR — acceleration factor system. */
export function parabolicSAR(
  bars: Bar[], step: number = 0.02, max: number = 0.2,
): { sar: number[]; isUpTrend: boolean[] } {
  const len = bars.length;
  const sar = new Array(len).fill(NaN);
  const isUp = new Array(len).fill(true);
  if (len < 2) return { sar, isUpTrend: isUp };

  let af = step;
  let upTrend = bars[1].close > bars[0].close;
  let ep = upTrend ? bars[0].high : bars[0].low;
  sar[0] = upTrend ? bars[0].low : bars[0].high;

  for (let i = 1; i < len; i++) {
    let newSar = sar[i - 1] + af * (ep - sar[i - 1]);

    if (upTrend) {
      newSar = Math.min(newSar, bars[i - 1].low, i > 1 ? bars[i - 2].low : bars[i - 1].low);
      if (bars[i].low < newSar) {
        upTrend = false;
        newSar = ep;
        ep = bars[i].low;
        af = step;
      } else {
        if (bars[i].high > ep) {
          ep = bars[i].high;
          af = Math.min(af + step, max);
        }
      }
    } else {
      newSar = Math.max(newSar, bars[i - 1].high, i > 1 ? bars[i - 2].high : bars[i - 1].high);
      if (bars[i].high > newSar) {
        upTrend = true;
        newSar = ep;
        ep = bars[i].high;
        af = step;
      } else {
        if (bars[i].low < ep) {
          ep = bars[i].low;
          af = Math.min(af + step, max);
        }
      }
    }

    sar[i] = newSar;
    isUp[i] = upTrend;
  }
  return { sar, isUpTrend: isUp };
}

/** Vortex Indicator — +VI and -VI based on true range. */
export function vortex(
  bars: Bar[], period: number = 14,
): { plusVI: number[]; minusVI: number[] } {
  const len = bars.length;
  const plusVI = new Array(len).fill(NaN);
  const minusVI = new Array(len).fill(NaN);

  for (let i = period; i < len; i++) {
    let sumPlusVM = 0, sumMinusVM = 0, sumTR = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumPlusVM += Math.abs(bars[j].high - bars[j - 1].low);
      sumMinusVM += Math.abs(bars[j].low - bars[j - 1].high);
      const tr = Math.max(
        bars[j].high - bars[j].low,
        Math.abs(bars[j].high - bars[j - 1].close),
        Math.abs(bars[j].low - bars[j - 1].close)
      );
      sumTR += tr;
    }
    plusVI[i] = sumTR === 0 ? 0 : sumPlusVM / sumTR;
    minusVI[i] = sumTR === 0 ? 0 : sumMinusVM / sumTR;
  }
  return { plusVI, minusVI };
}
