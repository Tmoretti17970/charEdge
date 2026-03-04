// ═══════════════════════════════════════════════════════════════
// charEdge — Volatility & Sentiment Indicators
// stdDev, historicalVolatility, squeezeMomentum, chaikinVolatility,
// ultimateOscillator, klinger, fearGreedIndex
// ═══════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';
import { closes } from './helpers.ts';
import { sma, ema } from './movingAverages.ts';
import { bollingerBands } from './bollingerBands.ts';
import { keltnerChannel } from './channels.ts';
import { rsi } from './rsi.ts';
import { atr } from './atr.ts';

/** Standard Deviation of close prices over a period. */
export function stdDev(src: number[], period: number = 20): number[] {
  const out = new Array(src.length).fill(NaN);
  for (let i = period - 1; i < src.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += src[j];
    const mean = sum / period;
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) sumSq += (src[j] - mean) ** 2;
    out[i] = Math.sqrt(sumSq / period);
  }
  return out;
}

/** Historical Volatility — annualized standard deviation of log returns. */
export function historicalVolatility(src: number[], period: number = 20, annualize: number = 252): number[] {
  const out = new Array(src.length).fill(NaN);
  const logRet = new Array(src.length).fill(0);
  for (let i = 1; i < src.length; i++) {
    logRet[i] = src[i - 1] > 0 ? Math.log(src[i] / src[i - 1]) : 0;
  }

  for (let i = period; i < src.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += logRet[j];
    const mean = sum / period;
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) sumSq += (logRet[j] - mean) ** 2;
    out[i] = Math.sqrt(sumSq / (period - 1)) * Math.sqrt(annualize) * 100;
  }
  return out;
}

/** Squeeze Momentum (TTM Squeeze). */
export function squeezeMomentum(
  bars: Bar[], bbPeriod: number = 20, bbMult: number = 2, kcPeriod: number = 20, kcMult: number = 1.5,
): { squeezeOn: boolean[]; momentum: number[] } {
  const cls = closes(bars);
  const bb = bollingerBands(cls, bbPeriod, bbMult);
  const kc = keltnerChannel(bars, kcPeriod, kcPeriod, kcMult);

  const squeezeOn = new Array(bars.length).fill(false);
  const mom = new Array(bars.length).fill(NaN);

  for (let i = 0; i < bars.length; i++) {
    if (!isNaN(bb.lower[i]) && !isNaN(kc.lower[i])) {
      squeezeOn[i] = bb.lower[i] > kc.lower[i] && bb.upper[i] < kc.upper[i];
    }
    if (!isNaN(kc.middle[i]) && !isNaN(bb.middle[i])) {
      mom[i] = cls[i] - (kc.middle[i] + bb.middle[i]) / 2;
    }
  }
  return { squeezeOn, momentum: mom };
}

/** Chaikin Volatility — EMA of (High - Low) rate of change. */
export function chaikinVolatility(bars: Bar[], emaPeriod: number = 10, rocPeriod: number = 10): number[] {
  const hl = bars.map(b => b.high - b.low);
  const hlEma = ema(hl, emaPeriod);
  const out = new Array(bars.length).fill(NaN);

  for (let i = rocPeriod; i < bars.length; i++) {
    if (!isNaN(hlEma[i]) && !isNaN(hlEma[i - rocPeriod]) && hlEma[i - rocPeriod] !== 0) {
      out[i] = ((hlEma[i] - hlEma[i - rocPeriod]) / hlEma[i - rocPeriod]) * 100;
    }
  }
  return out;
}

/** Ultimate Oscillator — weighted multi-period buying pressure. */
export function ultimateOscillator(bars: Bar[], p1: number = 7, p2: number = 14, p3: number = 28): number[] {
  const len = bars.length;
  const out = new Array(len).fill(NaN);

  for (let i = p3; i < len; i++) {
    let bp1 = 0, tr1 = 0, bp2 = 0, tr2 = 0, bp3 = 0, tr3 = 0;
    for (let j = i - p3 + 1; j <= i; j++) {
      const prevClose = bars[j - 1].close;
      const trueLow = Math.min(bars[j].low, prevClose);
      const bp = bars[j].close - trueLow;
      const tr = Math.max(bars[j].high - bars[j].low, Math.abs(bars[j].high - prevClose), Math.abs(bars[j].low - prevClose));
      if (j > i - p1) { bp1 += bp; tr1 += tr; }
      if (j > i - p2) { bp2 += bp; tr2 += tr; }
      bp3 += bp; tr3 += tr;
    }
    const avg1 = tr1 === 0 ? 0 : bp1 / tr1;
    const avg2 = tr2 === 0 ? 0 : bp2 / tr2;
    const avg3 = tr3 === 0 ? 0 : bp3 / tr3;
    out[i] = ((4 * avg1 + 2 * avg2 + avg3) / 7) * 100;
  }
  return out;
}

/** Klinger Volume Oscillator — EMA of force (volume × trend). */
export function klinger(
  bars: Bar[], fastP: number = 34, slowP: number = 55, signalP: number = 13,
): { kvo: number[]; signal: number[] } {
  const len = bars.length;
  const force = new Array(len).fill(0);

  for (let i = 1; i < len; i++) {
    const hlc = bars[i].high + bars[i].low + bars[i].close;
    const prevHLC = bars[i - 1].high + bars[i - 1].low + bars[i - 1].close;
    const trend = hlc > prevHLC ? 1 : -1;
    const dm = bars[i].high - bars[i].low;
    force[i] = (bars[i].volume || 0) * trend * Math.abs(2 * (dm / (bars[i].high + bars[i].low || 1)) - 1);
  }

  const fastEma = ema(force, fastP);
  const slowEma = ema(force, slowP);
  const kvoLine = fastEma.map((v, i) => isNaN(v) || isNaN(slowEma[i]) ? NaN : v - slowEma[i]);
  const signalLine = ema(kvoLine.map(v => isNaN(v) ? 0 : v), signalP);
  return { kvo: kvoLine, signal: signalLine };
}

/** Fear & Greed Index — composite sentiment indicator (0-100). */
export function fearGreedIndex(
  bars: Bar[], period: number = 14,
): { index: number[]; label: string[] } {
  const len = bars.length;
  const index = new Array(len).fill(NaN);
  const label = new Array(len).fill('');

  const cls = closes(bars);
  const rsiVals = rsi(cls, period);
  const atrVals = atr(bars, period);
  const avgVol = sma(bars.map(b => b.volume || 0), period);

  for (let i = period; i < len; i++) {
    if (isNaN(rsiVals[i]) || isNaN(atrVals[i])) continue;

    const rsiScore = rsiVals[i];
    const atrPct = (atrVals[i] / bars[i].close) * 100;
    const volScore = Math.max(0, Math.min(100, 100 - atrPct * 20));
    const volRatio = avgVol[i] > 0 ? (bars[i].volume || 0) / avgVol[i] : 1;
    const isUp = bars[i].close >= bars[i].open;
    const surgeScore = isUp
      ? Math.min(100, 50 + volRatio * 15)
      : Math.max(0, 50 - volRatio * 15);

    const composite = rsiScore * 0.4 + volScore * 0.3 + surgeScore * 0.3;
    index[i] = Math.round(Math.max(0, Math.min(100, composite)));

    if (index[i] <= 20) label[i] = 'Extreme Fear';
    else if (index[i] <= 40) label[i] = 'Fear';
    else if (index[i] <= 60) label[i] = 'Neutral';
    else if (index[i] <= 80) label[i] = 'Greed';
    else label[i] = 'Extreme Greed';
  }
  return { index, label };
}
