// ═══════════════════════════════════════════════════════════════
// charEdge — Oscillator Indicators
// cci, williamsR, roc, aroon, ppo, dpo, trix, kst, coppock,
// momentum, tsi, chandeMomentumOscillator, awesomeOscillator,
// acceleratorOscillator
// ═══════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';
import { sma, nanSafeSma, ema, wma } from './movingAverages.ts';

/** CCI (Commodity Channel Index). */
export function cci(bars: Bar[], period: number = 20): number[] {
  const tp = bars.map((b) => (b.high + b.low + b.close) / 3);
  const tpSma = sma(tp, period);
  const out = new Array(bars.length).fill(NaN);

  for (let i = period - 1; i < bars.length; i++) {
    let meanDev = 0;
    for (let j = i - period + 1; j <= i; j++) {
      meanDev += Math.abs(tp[j] - tpSma[i]);
    }
    meanDev /= period;
    out[i] = meanDev === 0 ? 0 : (tp[i] - tpSma[i]) / (0.015 * meanDev);
  }
  return out;
}

/** Williams %R. */
export function williamsR(bars: Bar[], period: number = 14): number[] {
  const out = new Array(bars.length).fill(NaN);

  for (let i = period - 1; i < bars.length; i++) {
    let high = -Infinity, low = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (bars[j].high > high) high = bars[j].high;
      if (bars[j].low < low) low = bars[j].low;
    }
    const range = high - low;
    out[i] = range === 0 ? -50 : ((high - bars[i].close) / range) * -100;
  }
  return out;
}

/** ROC (Rate of Change) — percentage. */
export function roc(src: number[], period: number = 12): number[] {
  const out = new Array(src.length).fill(NaN);
  for (let i = period; i < src.length; i++) {
    out[i] = src[i - period] === 0 ? 0 : ((src[i] - src[i - period]) / src[i - period]) * 100;
  }
  return out;
}

/** Aroon Oscillator. */
export function aroon(bars: Bar[], period: number = 25): { up: number[]; down: number[]; osc: number[] } {
  const up = new Array(bars.length).fill(NaN);
  const down = new Array(bars.length).fill(NaN);
  const osc = new Array(bars.length).fill(NaN);

  for (let i = period; i < bars.length; i++) {
    let highIdx = i, lowIdx = i;
    for (let j = i - period; j < i; j++) {
      if (bars[j].high >= bars[highIdx].high) highIdx = j;
      if (bars[j].low <= bars[lowIdx].low) lowIdx = j;
    }
    up[i] = ((period - (i - highIdx)) / period) * 100;
    down[i] = ((period - (i - lowIdx)) / period) * 100;
    osc[i] = up[i] - down[i];
  }
  return { up, down, osc };
}

/** Percentage Price Oscillator (PPO).
 * #17 Fix: Pass raw ppoLine to ema() — ema() is NaN-tolerant and finds
 * the first valid SMA seed window. No zero-filling needed. */
export function ppo(
  src: number[], fastP: number = 12, slowP: number = 26, signalP: number = 9,
): { ppo: number[]; signal: number[]; histogram: number[] } {
  const fastEma = ema(src, fastP);
  const slowEma = ema(src, slowP);
  const ppoLine = fastEma.map((v, i) => {
    if (isNaN(v) || isNaN(slowEma[i]) || slowEma[i] === 0) return NaN;
    return ((v - slowEma[i]) / slowEma[i]) * 100;
  });
  const signalLine = ema(ppoLine, signalP);
  const hist = ppoLine.map((v, i) => isNaN(v) || isNaN(signalLine[i]) ? NaN : v - signalLine[i]);
  return { ppo: ppoLine, signal: signalLine, histogram: hist };
}

/** Detrended Price Oscillator (DPO). */
export function dpo(src: number[], period: number = 20): number[] {
  const movAvg = sma(src, period);
  const shift = Math.floor(period / 2) + 1;
  const out = new Array(src.length).fill(NaN);
  for (let i = shift; i < src.length; i++) {
    if (!isNaN(movAvg[i - shift])) {
      out[i] = src[i] - movAvg[i - shift];
    }
  }
  return out;
}

/** TRIX — Triple EMA rate of change (momentum oscillator).
 * #17 Fix: ema() is NaN-tolerant — chains directly without zero-filling. */
export function trix(src: number[], period: number = 15): number[] {
  const e1 = ema(src, period);
  const e2 = ema(e1, period);
  const e3 = ema(e2, period);
  const out = new Array(src.length).fill(NaN);
  for (let i = 1; i < src.length; i++) {
    if (!isNaN(e3[i]) && !isNaN(e3[i - 1]) && e3[i - 1] !== 0) {
      out[i] = ((e3[i] - e3[i - 1]) / e3[i - 1]) * 10000;
    }
  }
  return out;
}

/** KST (Know Sure Thing) — momentum oscillator.
 * #17 Fix: Use nanSafeSma instead of sma(arr.map(v => isNaN(v) ? 0 : v), p)
 * to avoid corrupting values during warm-up. */
export function kst(src: number[]): { kst: number[]; signal: number[] } {
  const r1 = roc(src, 10);
  const r2 = roc(src, 15);
  const r3 = roc(src, 20);
  const r4 = roc(src, 30);
  const s1 = nanSafeSma(r1, 10);
  const s2 = nanSafeSma(r2, 10);
  const s3 = nanSafeSma(r3, 10);
  const s4 = nanSafeSma(r4, 15);
  const kstLine = s1.map((v, i) => {
    if (isNaN(v) || isNaN(s2[i]) || isNaN(s3[i]) || isNaN(s4[i])) return NaN;
    return v * 1 + s2[i] * 2 + s3[i] * 3 + s4[i] * 4;
  });
  const signalLine = nanSafeSma(kstLine, 9);
  return { kst: kstLine, signal: signalLine };
}

/** Coppock Curve.
 * #17 Fix: Use wma() directly — WMA naturally produces NaN when window
 * contains NaN values, which is correct behavior for warm-up. */
export function coppock(src: number[], longP: number = 14, shortP: number = 11, wmaP: number = 10): number[] {
  const longROC = roc(src, longP);
  const shortROC = roc(src, shortP);
  const sum = longROC.map((v, i) => isNaN(v) || isNaN(shortROC[i]) ? NaN : v + shortROC[i]);
  return wma(sum, wmaP);
}

/** Momentum — simple price difference over N periods. */
export function momentum(src: number[], period: number = 10): number[] {
  const out = new Array(src.length).fill(NaN);
  for (let i = period; i < src.length; i++) {
    out[i] = src[i] - src[i - period];
  }
  return out;
}

/** True Strength Index (TSI).
 * #17 Fix: ema() is NaN-tolerant — chains directly without zero-filling. */
export function tsi(
  src: number[], longP: number = 25, shortP: number = 13, signalP: number = 13,
): { tsi: number[]; signal: number[] } {
  const len = src.length;
  const pc = new Array(len).fill(0);
  const absPC = new Array(len).fill(0);
  for (let i = 1; i < len; i++) {
    pc[i] = src[i] - src[i - 1];
    absPC[i] = Math.abs(pc[i]);
  }

  const pcEma1 = ema(pc, longP);
  const pcEma2 = ema(pcEma1, shortP);
  const absPcEma1 = ema(absPC, longP);
  const absPcEma2 = ema(absPcEma1, shortP);

  const tsiLine = new Array(len).fill(NaN);
  for (let i = 0; i < len; i++) {
    if (!isNaN(pcEma2[i]) && !isNaN(absPcEma2[i]) && absPcEma2[i] !== 0) {
      tsiLine[i] = (pcEma2[i] / absPcEma2[i]) * 100;
    }
  }

  const signalLine = ema(tsiLine, signalP);
  return { tsi: tsiLine, signal: signalLine };
}

/** Chande Momentum Oscillator (CMO). */
export function chandeMomentumOscillator(src: number[], period: number = 9): number[] {
  const out = new Array(src.length).fill(NaN);
  for (let i = period; i < src.length; i++) {
    let sumUp = 0, sumDown = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = src[j] - src[j - 1];
      if (diff > 0) sumUp += diff;
      else sumDown += Math.abs(diff);
    }
    const total = sumUp + sumDown;
    out[i] = total === 0 ? 0 : ((sumUp - sumDown) / total) * 100;
  }
  return out;
}

/** Awesome Oscillator — SMA(5 of median) − SMA(34 of median). */
export function awesomeOscillator(bars: Bar[]): number[] {
  const median = bars.map(b => (b.high + b.low) / 2);
  const fast = sma(median, 5);
  const slow = sma(median, 34);
  return fast.map((v, i) => isNaN(v) || isNaN(slow[i]) ? NaN : v - slow[i]);
}

/** Accelerator Oscillator — AO minus SMA(5 of AO).
 * #17 Fix: Use nanSafeSma for AO input which has NaN during warm-up. */
export function acceleratorOscillator(bars: Bar[]): number[] {
  const ao = awesomeOscillator(bars);
  const aoSma = nanSafeSma(ao, 5);
  return ao.map((v, i) => isNaN(v) || isNaN(aoSma[i]) ? NaN : v - aoSma[i]);
}

/** Chaikin Oscillator — MACD of Accumulation/Distribution Line. */
export function chaikinOscillator(bars: Bar[], fastP: number = 3, slowP: number = 10): number[] {
  const ad = new Array(bars.length).fill(0);
  for (let i = 0; i < bars.length; i++) {
    const hl = bars[i].high - bars[i].low;
    const mfm = hl === 0 ? 0 : ((bars[i].close - bars[i].low) - (bars[i].high - bars[i].close)) / hl;
    ad[i] = (i > 0 ? ad[i - 1] : 0) + mfm * (bars[i].volume || 0);
  }
  const fastEma = ema(ad, fastP);
  const slowEma = ema(ad, slowP);
  return fastEma.map((v, i) => isNaN(v) || isNaN(slowEma[i]) ? NaN : v - slowEma[i]);
}

/** Mass Index.
 * #17 Fix: ema() is NaN-tolerant for double EMA chain.
 * Sum loop skips NaN ratio values instead of zero-filling. */
export function massIndex(bars: Bar[], emaPeriod: number = 9, sumPeriod: number = 25): number[] {
  const hl = bars.map(b => b.high - b.low);
  const singleEma = ema(hl, emaPeriod);
  const doubleEma = ema(singleEma, emaPeriod);
  const ratio = singleEma.map((v, i) => {
    if (isNaN(v) || isNaN(doubleEma[i]) || doubleEma[i] === 0) return NaN;
    return v / doubleEma[i];
  });
  const out = new Array(bars.length).fill(NaN);
  for (let i = sumPeriod - 1; i < bars.length; i++) {
    let sum = 0;
    let validCount = 0;
    for (let j = i - sumPeriod + 1; j <= i; j++) {
      if (!isNaN(ratio[j])) {
        sum += ratio[j];
        validCount++;
      }
    }
    // Only output if we have enough valid values
    out[i] = validCount >= sumPeriod / 2 ? sum : NaN;
  }
  return out;
}

