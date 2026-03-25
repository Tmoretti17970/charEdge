// ═══════════════════════════════════════════════════════════════════
// charEdge — Expansion Indicators (Sprint 68)
//
// 15 additional indicators to bring the total past 95.
// Uses existing computation helpers where possible.
// ═══════════════════════════════════════════════════════════════════

import * as C from '../computations.js';

// ─── Helper: Simple EMA computation ─────────────────────────────
function emaArray(src, period) {
  const k = 2 / (period + 1);
  const out = new Array(src.length).fill(null);
  let prev = src[0];
  out[0] = prev;
  for (let i = 1; i < src.length; i++) {
    if (src[i] == null) {
      out[i] = prev;
      continue;
    }
    prev = src[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function smaArray(src, period) {
  const out = new Array(src.length).fill(null);
  let sum = 0;
  for (let i = 0; i < src.length; i++) {
    sum += src[i] || 0;
    if (i >= period) sum -= src[i - period] || 0;
    out[i] = i >= period - 1 ? sum / period : null;
  }
  return out;
}

export const EXPANSION_INDICATORS = {
  // ─── 1. Percentage Price Oscillator Histogram ──────────────
  ppoHistogram: {
    id: 'ppoHistogram',
    name: 'PPO Histogram',
    shortName: 'PPO-H',
    mode: 'pane',
    params: {
      fast: { default: 12, min: 2, max: 100, step: 1, label: 'Fast' },
      slow: { default: 26, min: 2, max: 200, step: 1, label: 'Slow' },
      signal: { default: 9, min: 2, max: 50, step: 1, label: 'Signal' },
    },
    outputs: [{ key: 'histogram', label: 'PPO Hist', color: '#26A69A', width: 0, type: 'histogram' }],
    paneConfig: { bands: [{ value: 0, color: 'rgba(120,123,134,0.3)', dash: [2, 4] }] },
    compute(bars, params) {
      const close = C.closes(bars);
      const fastEma = emaArray(close, params.fast);
      const slowEma = emaArray(close, params.slow);
      const ppo = close.map((_, i) => (slowEma[i] ? ((fastEma[i] - slowEma[i]) / slowEma[i]) * 100 : null));
      const sig = emaArray(
        ppo.map((v) => v ?? 0),
        params.signal,
      );
      return { histogram: ppo.map((v, i) => (v != null && sig[i] != null ? v - sig[i] : null)) };
    },
  },

  // ─── 2. Choppiness Index ───────────────────────────────────
  choppiness: {
    id: 'choppiness',
    name: 'Choppiness Index',
    shortName: 'CHOP',
    mode: 'pane',
    params: {
      period: { default: 14, min: 2, max: 100, step: 1, label: 'Period' },
    },
    outputs: [{ key: 'chop', label: 'CHOP', color: '#7E57C2', width: 1.5, type: 'line' }],
    paneConfig: {
      min: 0,
      max: 100,
      bands: [
        { value: 61.8, color: 'rgba(239,83,80,0.3)', label: 'Choppy', dash: [4, 4] },
        { value: 38.2, color: 'rgba(38,166,154,0.3)', label: 'Trending', dash: [4, 4] },
      ],
    },
    compute(bars, params) {
      const { period } = params;
      const chop = new Array(bars.length).fill(null);
      for (let i = period; i < bars.length; i++) {
        let atrSum = 0;
        let highestHigh = -Infinity,
          lowestLow = Infinity;
        for (let j = i - period + 1; j <= i; j++) {
          const tr = Math.max(
            bars[j].high - bars[j].low,
            Math.abs(bars[j].high - bars[j - 1].close),
            Math.abs(bars[j].low - bars[j - 1].close),
          );
          atrSum += tr;
          highestHigh = Math.max(highestHigh, bars[j].high);
          lowestLow = Math.min(lowestLow, bars[j].low);
        }
        const range = highestHigh - lowestLow;
        chop[i] = range > 0 ? (100 * Math.log10(atrSum / range)) / Math.log10(period) : 50;
      }
      return { chop };
    },
  },

  // ─── 3. Detrended Price Oscillator Enhanced ────────────────
  dpoEnhanced: {
    id: 'dpoEnhanced',
    name: 'DPO with Signal',
    shortName: 'DPO+',
    mode: 'pane',
    params: {
      period: { default: 20, min: 5, max: 200, step: 1, label: 'Period' },
      signalPeriod: { default: 9, min: 2, max: 50, step: 1, label: 'Signal' },
    },
    outputs: [
      { key: 'dpo', label: 'DPO', color: '#42A5F5', width: 1.5, type: 'line' },
      { key: 'signal', label: 'Signal', color: '#FF7043', width: 1, type: 'line' },
    ],
    paneConfig: { bands: [{ value: 0, color: 'rgba(120,123,134,0.3)', dash: [2, 4] }] },
    compute(bars, params) {
      const close = C.closes(bars);
      const ma = smaArray(close, params.period);
      const shift = Math.floor(params.period / 2) + 1;
      const dpo = close.map((c, i) => (i >= shift && ma[i - shift] != null ? c - ma[i - shift] : null));
      const signal = emaArray(
        dpo.map((v) => v ?? 0),
        params.signalPeriod,
      );
      return { dpo, signal };
    },
  },

  // ─── 4. Balance of Power ──────────────────────────────────
  balanceOfPower: {
    id: 'balanceOfPower',
    name: 'Balance of Power',
    shortName: 'BOP',
    mode: 'pane',
    params: {
      smooth: { default: 14, min: 1, max: 50, step: 1, label: 'Smooth' },
    },
    outputs: [{ key: 'bop', label: 'BOP', color: '#26C6DA', width: 1.5, type: 'line' }],
    paneConfig: {
      min: -1,
      max: 1,
      bands: [{ value: 0, color: 'rgba(120,123,134,0.3)', dash: [2, 4] }],
    },
    compute(bars, params) {
      const raw = bars.map((b) => (b.high !== b.low ? (b.close - b.open) / (b.high - b.low) : 0));
      return { bop: smaArray(raw, params.smooth) };
    },
  },

  // ─── 5. Ease of Movement ──────────────────────────────────
  easeOfMovement: {
    id: 'easeOfMovement',
    name: 'Ease of Movement',
    shortName: 'EMV',
    mode: 'pane',
    params: {
      period: { default: 14, min: 2, max: 100, step: 1, label: 'Period' },
    },
    outputs: [{ key: 'emv', label: 'EMV', color: '#66BB6A', width: 1.5, type: 'line' }],
    paneConfig: { bands: [{ value: 0, color: 'rgba(120,123,134,0.3)', dash: [2, 4] }] },
    compute(bars, params) {
      const raw = bars.map((b, i) => {
        if (i === 0 || b.volume === 0) return 0;
        const dm = (b.high + b.low) / 2 - (bars[i - 1].high + bars[i - 1].low) / 2;
        const br = b.volume / (b.high - b.low || 1);
        return dm / (br / 1e6);
      });
      return { emv: smaArray(raw, params.period) };
    },
  },

  // ─── 6. Force Index ───────────────────────────────────────
  forceIndex: {
    id: 'forceIndex',
    name: 'Force Index',
    shortName: 'FI',
    mode: 'pane',
    params: {
      period: { default: 13, min: 1, max: 100, step: 1, label: 'Period' },
    },
    outputs: [{ key: 'fi', label: 'FI', color: '#5C6BC0', width: 1.5, type: 'line' }],
    paneConfig: { bands: [{ value: 0, color: 'rgba(120,123,134,0.3)', dash: [2, 4] }] },
    compute(bars, params) {
      const raw = bars.map((b, i) => (i === 0 ? 0 : (b.close - bars[i - 1].close) * b.volume));
      return { fi: emaArray(raw, params.period) };
    },
  },

  // ─── 7. Price Volume Trend ────────────────────────────────
  pvt: {
    id: 'pvt',
    name: 'Price Volume Trend',
    shortName: 'PVT',
    mode: 'pane',
    params: {},
    outputs: [{ key: 'pvt', label: 'PVT', color: '#FF8A65', width: 1.5, type: 'line' }],
    paneConfig: {},
    compute(bars) {
      const out = new Array(bars.length).fill(null);
      out[0] = 0;
      for (let i = 1; i < bars.length; i++) {
        const pctChange = bars[i - 1].close ? (bars[i].close - bars[i - 1].close) / bars[i - 1].close : 0;
        out[i] = out[i - 1] + pctChange * bars[i].volume;
      }
      return { pvt: out };
    },
  },

  // ─── 8. Negative Volume Index ──────────────────────────────
  nvi: {
    id: 'nvi',
    name: 'Negative Volume Index',
    shortName: 'NVI',
    mode: 'pane',
    params: {
      signalPeriod: { default: 255, min: 10, max: 500, step: 1, label: 'Signal MA' },
    },
    outputs: [
      { key: 'nvi', label: 'NVI', color: '#EF5350', width: 1.5, type: 'line' },
      { key: 'signal', label: 'Signal', color: '#78909C', width: 1, type: 'line' },
    ],
    paneConfig: {},
    compute(bars, params) {
      const nvi = new Array(bars.length).fill(null);
      nvi[0] = 1000;
      for (let i = 1; i < bars.length; i++) {
        nvi[i] =
          bars[i].volume < bars[i - 1].volume
            ? nvi[i - 1] + ((bars[i].close - bars[i - 1].close) / bars[i - 1].close) * nvi[i - 1]
            : nvi[i - 1];
      }
      return { nvi, signal: emaArray(nvi, params.signalPeriod) };
    },
  },

  // ─── 9. Positive Volume Index ──────────────────────────────
  pvi: {
    id: 'pvi',
    name: 'Positive Volume Index',
    shortName: 'PVI',
    mode: 'pane',
    params: {
      signalPeriod: { default: 255, min: 10, max: 500, step: 1, label: 'Signal MA' },
    },
    outputs: [
      { key: 'pvi', label: 'PVI', color: '#26A69A', width: 1.5, type: 'line' },
      { key: 'signal', label: 'Signal', color: '#78909C', width: 1, type: 'line' },
    ],
    paneConfig: {},
    compute(bars, params) {
      const pvi = new Array(bars.length).fill(null);
      pvi[0] = 1000;
      for (let i = 1; i < bars.length; i++) {
        pvi[i] =
          bars[i].volume > bars[i - 1].volume
            ? pvi[i - 1] + ((bars[i].close - bars[i - 1].close) / bars[i - 1].close) * pvi[i - 1]
            : pvi[i - 1];
      }
      return { pvi, signal: emaArray(pvi, params.signalPeriod) };
    },
  },

  // ─── 10. Know Sure Thing Signal ────────────────────────────
  kstSignal: {
    id: 'kstSignal',
    name: 'KST with Signal',
    shortName: 'KST+',
    mode: 'pane',
    params: {
      r1: { default: 10, min: 5, max: 50, step: 1, label: 'ROC 1' },
      r2: { default: 15, min: 5, max: 50, step: 1, label: 'ROC 2' },
      r3: { default: 20, min: 5, max: 100, step: 1, label: 'ROC 3' },
      r4: { default: 30, min: 10, max: 100, step: 1, label: 'ROC 4' },
      signal: { default: 9, min: 2, max: 50, step: 1, label: 'Signal' },
    },
    outputs: [
      { key: 'kst', label: 'KST', color: '#AB47BC', width: 1.5, type: 'line' },
      { key: 'signal', label: 'Signal', color: '#FF7043', width: 1, type: 'line' },
      { key: 'histogram', label: 'Histogram', color: '#78909C', width: 0, type: 'histogram' },
    ],
    paneConfig: { bands: [{ value: 0, color: 'rgba(120,123,134,0.3)', dash: [2, 4] }] },
    compute(bars, params) {
      const close = C.closes(bars);
      const roc = (src, period) =>
        src.map((v, i) => (i >= period && src[i - period] ? ((v - src[i - period]) / src[i - period]) * 100 : 0));
      const r1 = smaArray(roc(close, params.r1), 10);
      const r2 = smaArray(roc(close, params.r2), 10);
      const r3 = smaArray(roc(close, params.r3), 10);
      const r4 = smaArray(roc(close, params.r4), 15);
      const kst = close.map((_, i) => (r1[i] || 0) * 1 + (r2[i] || 0) * 2 + (r3[i] || 0) * 3 + (r4[i] || 0) * 4);
      const sig = smaArray(kst, params.signal);
      return { kst, signal: sig, histogram: kst.map((v, i) => (sig[i] != null ? v - sig[i] : null)) };
    },
  },

  // ─── 11. Accumulation Swing Index ──────────────────────────
  asi: {
    id: 'asi',
    name: 'Accumulation Swing Index',
    shortName: 'ASI',
    mode: 'pane',
    params: {
      limitMove: { default: 0, min: 0, max: 1000, step: 0.01, label: 'Limit Move (0=auto)' },
    },
    outputs: [{ key: 'asi', label: 'ASI', color: '#FF5722', width: 1.5, type: 'line' }],
    paneConfig: { bands: [{ value: 0, color: 'rgba(120,123,134,0.3)', dash: [2, 4] }] },
    compute(bars, params) {
      const T = params.limitMove || bars.reduce((mx, b) => Math.max(mx, b.high - b.low), 0) * 3;
      const asi = new Array(bars.length).fill(null);
      asi[0] = 0;
      for (let i = 1; i < bars.length; i++) {
        const c1 = bars[i - 1].close,
          o1 = bars[i - 1].open;
        const h = bars[i].high,
          l = bars[i].low,
          c = bars[i].close,
          o = bars[i].open;
        const k = Math.max(Math.abs(h - c1), Math.abs(l - c1));
        const tr = Math.max(h - l, Math.abs(h - c1), Math.abs(l - c1));
        if (tr === 0) {
          asi[i] = asi[i - 1];
          continue;
        }
        const er =
          Math.abs(h - c1) > Math.abs(l - c1)
            ? Math.abs(h - c1) - 0.5 * Math.abs(l - c1) + 0.25 * Math.abs(c1 - o1)
            : Math.abs(l - c1) - 0.5 * Math.abs(h - c1) + 0.25 * Math.abs(c1 - o1);
        const si = er !== 0 ? 50 * ((c - c1 + 0.5 * (c - o) + 0.25 * (c1 - o1)) / er) * (k / T) : 0;
        asi[i] = asi[i - 1] + si;
      }
      return { asi };
    },
  },

  // ─── 12. Williams Accumulation Distribution ────────────────
  williamsAD: {
    id: 'williamsAD',
    name: 'Williams Accumulation/Distribution',
    shortName: 'WAD',
    mode: 'pane',
    params: {},
    outputs: [{ key: 'wad', label: 'WAD', color: '#009688', width: 1.5, type: 'line' }],
    paneConfig: {},
    compute(bars) {
      const wad = new Array(bars.length).fill(null);
      wad[0] = 0;
      for (let i = 1; i < bars.length; i++) {
        const c = bars[i].close,
          pc = bars[i - 1].close;
        let ad;
        if (c > pc) ad = c - Math.min(bars[i].low, pc);
        else if (c < pc) ad = c - Math.max(bars[i].high, pc);
        else ad = 0;
        wad[i] = wad[i - 1] + ad;
      }
      return { wad };
    },
  },

  // ─── 13. Trend Intensity Index ─────────────────────────────
  trendIntensity: {
    id: 'trendIntensity',
    name: 'Trend Intensity Index',
    shortName: 'TII',
    mode: 'pane',
    params: {
      period: { default: 30, min: 5, max: 200, step: 1, label: 'Period' },
    },
    outputs: [{ key: 'tii', label: 'TII', color: '#FFA726', width: 1.5, type: 'line' }],
    paneConfig: {
      min: 0,
      max: 100,
      bands: [
        { value: 80, color: 'rgba(38,166,154,0.3)', label: 'Strong Trend', dash: [4, 4] },
        { value: 20, color: 'rgba(239,83,80,0.3)', label: 'Weak/Chop', dash: [4, 4] },
      ],
    },
    compute(bars, params) {
      const close = C.closes(bars);
      const ma = smaArray(close, params.period);
      const tii = new Array(bars.length).fill(null);
      for (let i = params.period; i < bars.length; i++) {
        let up = 0;
        for (let j = i - params.period + 1; j <= i; j++) {
          if (close[j] > ma[j]) up++;
        }
        tii[i] = (up / params.period) * 100;
      }
      return { tii };
    },
  },

  // ─── 14. Relative Volatility Index ─────────────────────────
  relativeVolatility: {
    id: 'relativeVolatility',
    name: 'Relative Volatility Index',
    shortName: 'RVoI',
    mode: 'pane',
    params: {
      period: { default: 10, min: 2, max: 100, step: 1, label: 'Period' },
      smoothing: { default: 14, min: 2, max: 50, step: 1, label: 'Smoothing' },
    },
    outputs: [{ key: 'rvol', label: 'RVoI', color: '#EC407A', width: 1.5, type: 'line' }],
    paneConfig: {
      min: 0,
      max: 100,
      bands: [{ value: 50, color: 'rgba(120,123,134,0.3)', dash: [2, 4] }],
    },
    compute(bars, params) {
      const close = C.closes(bars);
      // Compute standard deviation
      const stdev = new Array(close.length).fill(0);
      for (let i = params.period; i < close.length; i++) {
        let sum = 0,
          sumSq = 0;
        for (let j = i - params.period + 1; j <= i; j++) {
          sum += close[j];
          sumSq += close[j] * close[j];
        }
        const mean = sum / params.period;
        stdev[i] = Math.sqrt(sumSq / params.period - mean * mean);
      }
      // RVI calculation
      const upDev = close.map((c, i) => (i > 0 && c > close[i - 1] ? stdev[i] : 0));
      const dnDev = close.map((c, i) => (i > 0 && c <= close[i - 1] ? stdev[i] : 0));
      const upSmooth = emaArray(upDev, params.smoothing);
      const dnSmooth = emaArray(dnDev, params.smoothing);
      const rvol = upSmooth.map((u, i) => {
        const total = u + dnSmooth[i];
        return total > 0 ? (u / total) * 100 : 50;
      });
      return { rvol };
    },
  },

  // ─── 15. Double EMA Crossover Signal ───────────────────────
  demaCrossover: {
    id: 'demaCrossover',
    name: 'DEMA Crossover',
    shortName: 'DEMA-X',
    mode: 'overlay',
    params: {
      fast: { default: 9, min: 2, max: 100, step: 1, label: 'Fast' },
      slow: { default: 21, min: 5, max: 200, step: 1, label: 'Slow' },
    },
    outputs: [
      { key: 'fast', label: 'Fast DEMA', color: '#26A69A', width: 1.5, type: 'line' },
      { key: 'slow', label: 'Slow DEMA', color: '#EF5350', width: 1.5, type: 'line' },
    ],
    compute(bars, params) {
      const close = C.closes(bars);
      const e1f = emaArray(close, params.fast);
      const e2f = emaArray(e1f, params.fast);
      const fast = e1f.map((v, i) => 2 * v - e2f[i]);
      const e1s = emaArray(close, params.slow);
      const e2s = emaArray(e1s, params.slow);
      const slow = e1s.map((v, i) => 2 * v - e2s[i]);
      return { fast, slow };
    },
  },
};
