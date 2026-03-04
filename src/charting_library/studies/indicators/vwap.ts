// ═══════════════════════════════════════════════════════════════
// charEdge — VWAP (Volume Weighted Average Price)
// vwap, vwapBands, sessionVWAP
// ═══════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';

/**
 * VWAP — resets at each new day boundary.
 */
export function vwap(bars: Bar[]): number[] {
  const out = new Array(bars.length).fill(NaN);
  let cumTPV = 0,
    cumVol = 0,
    lastDay = -1;

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const day = new Date(b.time).getUTCDate();

    if (day !== lastDay) {
      cumTPV = 0;
      cumVol = 0;
      lastDay = day;
    }

    const tp = (b.high + b.low + b.close) / 3;
    cumTPV += tp * (b.volume || 0);
    cumVol += b.volume || 0;

    out[i] = cumVol > 0 ? cumTPV / cumVol : NaN;
  }

  return out;
}

/**
 * VWAP with Standard Deviation Bands + Anchored Mode.
 */
export function vwapBands(bars: Bar[], anchorTime: number | null = null) {
  const len = bars.length;
  const out = {
    vwap: new Array(len).fill(NaN),
    upper1: new Array(len).fill(NaN),
    lower1: new Array(len).fill(NaN),
    upper2: new Array(len).fill(NaN),
    lower2: new Array(len).fill(NaN),
    upper3: new Array(len).fill(NaN),
    lower3: new Array(len).fill(NaN),
  };

  let cumTPV = 0, cumVol = 0, cumTP2V = 0;
  let lastDay = -1;
  let started = anchorTime == null;

  for (let i = 0; i < len; i++) {
    const b = bars[i];

    if (anchorTime != null && !started) {
      if (b.time >= anchorTime) {
        started = true;
        cumTPV = 0; cumVol = 0; cumTP2V = 0;
      } else continue;
    }

    if (anchorTime == null) {
      const day = new Date(b.time).getUTCDate();
      if (day !== lastDay) {
        cumTPV = 0; cumVol = 0; cumTP2V = 0;
        lastDay = day;
      }
    }

    const tp = (b.high + b.low + b.close) / 3;
    const vol = b.volume || 0;
    cumTPV += tp * vol;
    cumVol += vol;
    cumTP2V += tp * tp * vol;

    if (cumVol > 0) {
      const vwapVal = cumTPV / cumVol;
      const variance = Math.max(0, (cumTP2V / cumVol) - (vwapVal * vwapVal));
      const sd = Math.sqrt(variance);

      out.vwap[i] = vwapVal;
      out.upper1[i] = vwapVal + sd;
      out.lower1[i] = vwapVal - sd;
      out.upper2[i] = vwapVal + 2 * sd;
      out.lower2[i] = vwapVal - 2 * sd;
      out.upper3[i] = vwapVal + 3 * sd;
      out.lower3[i] = vwapVal - 3 * sd;
    }
  }

  return out;
}

/**
 * Session VWAP — auto-resets at configurable session boundaries.
 * Unlike day-boundary VWAP, this resets at a specific UTC hour.
 */
export function sessionVWAP(bars: Bar[], resetHourUTC: number = 0) {
  const len = bars.length;
  const vwapOut = new Array(len).fill(NaN);
  const upper = new Array(len).fill(NaN);
  const lower = new Array(len).fill(NaN);

  let cumPV = 0, cumVol = 0, cumPV2 = 0;

  for (let i = 0; i < len; i++) {
    const d = new Date(bars[i].time);
    const hour = d.getUTCHours();

    if (i === 0 || (hour === resetHourUTC && (i === 0 || new Date(bars[i - 1].time).getUTCHours() !== resetHourUTC))) {
      cumPV = 0;
      cumVol = 0;
      cumPV2 = 0;
    }

    const tp = (bars[i].high + bars[i].low + bars[i].close) / 3;
    const vol = bars[i].volume || 0;
    cumPV += tp * vol;
    cumVol += vol;
    cumPV2 += tp * tp * vol;

    if (cumVol > 0) {
      const v = cumPV / cumVol;
      vwapOut[i] = v;
      const variance = Math.max(0, (cumPV2 / cumVol) - v * v);
      const sd = Math.sqrt(variance);
      upper[i] = v + sd;
      lower[i] = v - sd;
    }
  }
  return { vwap: vwapOut, upper, lower };
}
