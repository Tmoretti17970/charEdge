// ═══════════════════════════════════════════════════════════════
// charEdge — VWAP (Volume Weighted Average Price)
// vwap, vwapBands, sessionVWAP
// ═══════════════════════════════════════════════════════════════

import type { Bar } from './helpers.ts';
import { temporalEngine } from '../../core/TemporalEngine.ts';

/**
 * VWAP — resets at each new day boundary.
 */
export function vwap(bars: Bar[], timezone: string = 'UTC'): number[] {
  const out = new Array(bars.length).fill(NaN);
  let cumTPV = 0,
    cumVol = 0,
    lastDayStart = -1;

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const dayStart = temporalEngine.dayStartUTC(b.time, timezone);

    if (dayStart !== lastDayStart) {
      cumTPV = 0;
      cumVol = 0;
      lastDayStart = dayStart;
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
export function vwapBands(bars: Bar[], anchorTime: number | null = null, timezone: string = 'UTC') {
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

  // P1: Welford's online algorithm for numerically stable variance.
  // The naive formula (cumTP2V/cumVol - mean²) suffers from catastrophic
  // cancellation when the running sums grow large, sometimes producing
  // negative variance → NaN from sqrt(). Welford's M2 is always non-negative.
  let cumTPV = 0, cumVol = 0, M2 = 0;
  let lastDay = -1;
  let started = anchorTime == null;

  for (let i = 0; i < len; i++) {
    const b = bars[i];

    if (anchorTime != null && !started) {
      if (b.time >= anchorTime) {
        started = true;
        cumTPV = 0; cumVol = 0; M2 = 0;
      } else continue;
    }

    if (anchorTime == null) {
      const dayStart = temporalEngine.dayStartUTC(b.time, timezone);
      if (dayStart !== lastDay) {
        cumTPV = 0; cumVol = 0; M2 = 0;
        lastDay = dayStart;
      }
    }

    const tp = (b.high + b.low + b.close) / 3;
    const vol = b.volume || 0;

    const prevVwap = cumVol > 0 ? cumTPV / cumVol : tp;
    cumTPV += tp * vol;
    cumVol += vol;

    if (cumVol > 0) {
      const vwapVal = cumTPV / cumVol;
      // Welford's incremental update: M2 += weight * (tp - prevMean) * (tp - newMean)
      const delta = tp - prevVwap;
      const delta2 = tp - vwapVal;
      M2 += vol * delta * delta2;

      const variance = M2 / cumVol;
      const sd = Math.sqrt(Math.max(0, variance));

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
 *
 * P1 Fix (H3): Uses Welford's online algorithm for numerically stable
 * variance (same as vwapBands). The naive cumPV2/cumVol - v² formula
 * suffers catastrophic cancellation on long sessions.
 */
export function sessionVWAP(bars: Bar[], resetHourUTC: number = 0, timezone: string = 'UTC') {
  const len = bars.length;
  const vwapOut = new Array(len).fill(NaN);
  const upper = new Array(len).fill(NaN);
  const lower = new Array(len).fill(NaN);

  let cumPV = 0, cumVol = 0, M2 = 0;

  for (let i = 0; i < len; i++) {
    const parts = temporalEngine.getParts(bars[i].time, timezone);
    const hour = parts.hour;

    if (i === 0 || (hour === resetHourUTC && (i === 0 || temporalEngine.getParts(bars[i - 1].time, timezone).hour !== resetHourUTC))) {
      cumPV = 0;
      cumVol = 0;
      M2 = 0;
    }

    const tp = (bars[i].high + bars[i].low + bars[i].close) / 3;
    const vol = bars[i].volume || 0;

    const prevVwap = cumVol > 0 ? cumPV / cumVol : tp;
    cumPV += tp * vol;
    cumVol += vol;

    if (cumVol > 0) {
      const v = cumPV / cumVol;
      vwapOut[i] = v;
      // Welford's incremental update
      const delta = tp - prevVwap;
      const delta2 = tp - v;
      M2 += vol * delta * delta2;

      const variance = M2 / cumVol;
      const sd = Math.sqrt(Math.max(0, variance));
      upper[i] = v + sd;
      lower[i] = v - sd;
    }
  }
  return { vwap: vwapOut, upper, lower };
}
