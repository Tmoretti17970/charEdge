// ═══════════════════════════════════════════════════════════════════
// charEdge — Indicator Computations
// Pure math functions. No rendering, no state, no side effects.
//
// Every function takes an array of bars (or closes) and returns
// an array of computed values aligned 1:1 with the input.
// NaN is used for periods where insufficient data exists.
//
// Indicators implemented:
//   Overlay:  SMA, EMA, WMA, DEMA, TEMA, Bollinger Bands, VWAP,
//             Supertrend, Ichimoku Cloud
//   Pane:     RSI, MACD, Stochastic, ATR, ADX, CCI, MFI,
//             Williams %R, OBV, Rate of Change
// ═══════════════════════════════════════════════════════════════════

/**
 * Extract close prices from bar array.
 * @param {Array<{close: number}>} bars
 * @returns {number[]}
 */
export function closes(bars) {
  return bars.map((b) => b.close);
}
export function highs(bars) {
  return bars.map((b) => b.high);
}
export function lows(bars) {
  return bars.map((b) => b.low);
}
export function volumes(bars) {
  return bars.map((b) => b.volume || 0);
}

// ═══════════════════════════════════════════════════════════════
// Moving Averages
// ═══════════════════════════════════════════════════════════════

/**
 * Simple Moving Average.
 * @param {number[]} src    - Source values
 * @param {number}   period - Lookback period
 * @returns {number[]}
 */
export function sma(src, period) {
  const out = new Array(src.length).fill(NaN);
  if (period > src.length) return out;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += src[i];
  out[period - 1] = sum / period;

  for (let i = period; i < src.length; i++) {
    sum += src[i] - src[i - period];
    out[i] = sum / period;
  }
  return out;
}

/**
 * Exponential Moving Average.
 * @param {number[]} src
 * @param {number}   period
 * @returns {number[]}
 */
export function ema(src, period) {
  const out = new Array(src.length).fill(NaN);
  if (period > src.length) return out;

  const k = 2 / (period + 1);

  // Seed with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) sum += src[i];
  out[period - 1] = sum / period;

  for (let i = period; i < src.length; i++) {
    out[i] = src[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

/** Incremental EMA */
export function nextEma(prevEma, nextSrc, period) {
  if (isNaN(prevEma)) return NaN;
  const k = 2 / (period + 1);
  return nextSrc * k + prevEma * (1 - k);
}

/**
 * Weighted Moving Average.
 */
export function wma(src, period) {
  const out = new Array(src.length).fill(NaN);
  const denom = (period * (period + 1)) / 2;

  for (let i = period - 1; i < src.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += src[i - period + 1 + j] * (j + 1);
    }
    out[i] = sum / denom;
  }
  return out;
}

/**
 * Double EMA (DEMA).
 */
export function dema(src, period) {
  const e1 = ema(src, period);
  const e2 = ema(
    e1.map((v) => (isNaN(v) ? 0 : v)),
    period,
  );
  return e1.map((v, i) => (isNaN(v) || isNaN(e2[i]) ? NaN : 2 * v - e2[i]));
}

/**
 * Triple EMA (TEMA).
 */
export function tema(src, period) {
  const e1 = ema(src, period);
  const clean1 = e1.map((v) => (isNaN(v) ? 0 : v));
  const e2 = ema(clean1, period);
  const clean2 = e2.map((v) => (isNaN(v) ? 0 : v));
  const e3 = ema(clean2, period);
  return e1.map((v, i) => {
    if (isNaN(v) || isNaN(e2[i]) || isNaN(e3[i])) return NaN;
    return 3 * v - 3 * e2[i] + e3[i];
  });
}

/**
 * Donchian Channel helper (highest high, lowest low over period).
 */
function donchian(bars, period, i) {
  let h = -Infinity,
    l = Infinity;
  for (let j = i - period + 1; j <= i; j++) {
    if (bars[j].high > h) h = bars[j].high;
    if (bars[j].low < l) l = bars[j].low;
  }
  return { high: h, low: l, mid: (h + l) / 2 };
}

/**
 * Ichimoku Cloud.
 * @param {Array<{high:number, low:number, close:number}>} bars
 * @param {number} convP - Conversion period (default 9)
 * @param {number} baseP - Base period (default 26)
 * @param {number} spanP - Lagging span 2 period (default 52)
 * @param {number} disp  - Displacement (default 26)
 * @returns {{ conversion: number[], base: number[], spanA: number[], spanB: number[], lagging: number[] }}
 */
export function ichimoku(bars, convP = 9, baseP = 26, spanP = 52, disp = 26) {
  const len = bars.length;
  const conversion = new Array(len).fill(NaN);
  const baseLine = new Array(len).fill(NaN);
  const spanA = new Array(len).fill(NaN);
  const spanB = new Array(len).fill(NaN);
  // Lagging span is displaced backwards by 'disp' periods
  const lagging = new Array(len).fill(NaN);

  for (let i = 0; i < len; i++) {
    if (i >= convP - 1) {
      conversion[i] = donchian(bars, convP, i).mid;
    }
    if (i >= baseP - 1) {
      baseLine[i] = donchian(bars, baseP, i).mid;
    }
    if (i >= baseP - 1 && !isNaN(conversion[i]) && !isNaN(baseLine[i])) {
      // Span A is shifted forward by disp - 1
      if (i + disp - 1 < len) {
        spanA[i + disp - 1] = (conversion[i] + baseLine[i]) / 2;
      }
    }
    if (i >= spanP - 1) {
      // Span B is shifted forward by disp - 1
      if (i + disp - 1 < len) {
        spanB[i + disp - 1] = donchian(bars, spanP, i).mid;
      }
    }
    // Lagging span is today's close shifted back by disp - 1
    if (i >= disp - 1) {
      lagging[i - disp + 1] = bars[i].close;
    }
  }

  return { conversion, base: baseLine, spanA, spanB, lagging };
}

// ═══════════════════════════════════════════════════════════════
// Bollinger Bands
// ═══════════════════════════════════════════════════════════════

/**
 * Bollinger Bands.
 * @param {number[]} src
 * @param {number}   period   - SMA period (default 20)
 * @param {number}   stdDev   - Standard deviation multiplier (default 2)
 * @returns {{ middle: number[], upper: number[], lower: number[] }}
 */
export function bollingerBands(src, period = 20, stdDev = 2) {
  const middle = sma(src, period);
  const upper = new Array(src.length).fill(NaN);
  const lower = new Array(src.length).fill(NaN);

  for (let i = period - 1; i < src.length; i++) {
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = src[j] - middle[i];
      sumSq += diff * diff;
    }
    const sd = Math.sqrt(sumSq / period);
    upper[i] = middle[i] + stdDev * sd;
    lower[i] = middle[i] - stdDev * sd;
  }

  return { middle, upper, lower };
}

// ═══════════════════════════════════════════════════════════════
// VWAP (Volume Weighted Average Price)
// ═══════════════════════════════════════════════════════════════

/**
 * VWAP — resets at each new day boundary.
 * @param {Array<{high:number, low:number, close:number, volume:number, time:number}>} bars
 * @returns {number[]}
 */
export function vwap(bars) {
  const out = new Array(bars.length).fill(NaN);
  let cumTPV = 0,
    cumVol = 0,
    lastDay = -1;

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const day = new Date(b.time).getUTCDate();

    // Reset on new day
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
 * @param {Array<{high:number, low:number, close:number, volume:number, time:number}>} bars
 * @param {number|null} anchorTime - If provided, start accumulation from this timestamp instead of day boundaries
 * @returns {{ vwap: number[], upper1: number[], lower1: number[], upper2: number[], lower2: number[], upper3: number[], lower3: number[] }}
 */
export function vwapBands(bars, anchorTime = null) {
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
  let started = anchorTime == null; // start immediately if no anchor

  for (let i = 0; i < len; i++) {
    const b = bars[i];

    // Anchored mode: wait until we reach the anchor bar
    if (anchorTime != null && !started) {
      if (b.time >= anchorTime) {
        started = true;
        cumTPV = 0; cumVol = 0; cumTP2V = 0;
      } else continue;
    }

    // Session reset mode (no anchor): reset on new day
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
      // Variance = E[X²] - E[X]² (volume-weighted)
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

// ═══════════════════════════════════════════════════════════════
// RSI (Relative Strength Index)
// ═══════════════════════════════════════════════════════════════

/**
 * RSI using Wilder's smoothing method.
 * @param {number[]} src
 * @param {number}   period - Default 14
 * @returns {number[]}
 */
export function rsi(src, period = 14) {
  const out = new Array(src.length).fill(NaN);
  if (src.length < period + 1) return out;

  let avgGain = 0,
    avgLoss = 0;

  // Initial average
  for (let i = 1; i <= period; i++) {
    const change = src[i] - src[i - 1];
    if (change >= 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;

  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  // Wilder's smoothing
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

// ═══════════════════════════════════════════════════════════════
// MACD (Moving Average Convergence Divergence)
// ═══════════════════════════════════════════════════════════════

/**
 * MACD.
 * @param {number[]} src
 * @param {number}   fast   - Fast EMA period (default 12)
 * @param {number}   slow   - Slow EMA period (default 26)
 * @param {number}   signal - Signal EMA period (default 9)
 * @returns {{ macd: number[], signal: number[], histogram: number[] }}
 */
export function macd(src, fast = 12, slow = 26, signal = 9) {
  const fastEma = ema(src, fast);
  const slowEma = ema(src, slow);

  const macdLine = fastEma.map((f, i) => (isNaN(f) || isNaN(slowEma[i]) ? NaN : f - slowEma[i]));

  const cleanMacd = macdLine.map((v) => (isNaN(v) ? 0 : v));
  const signalLine = ema(cleanMacd, signal);

  // Fix: only show signal where MACD is valid
  const firstValid = macdLine.findIndex((v) => !isNaN(v));
  const signalOut = signalLine.map((v, i) => (i < firstValid + signal - 1 ? NaN : v));

  const histogram = macdLine.map((m, i) => (isNaN(m) || isNaN(signalOut[i]) ? NaN : m - signalOut[i]));

  return { macd: macdLine, signal: signalOut, histogram };
}

// ═══════════════════════════════════════════════════════════════
// Stochastic Oscillator
// ═══════════════════════════════════════════════════════════════

/**
 * Stochastic %K and %D.
 * @param {Array<{high:number, low:number, close:number}>} bars
 * @param {number} kPeriod - %K period (default 14)
 * @param {number} dPeriod - %D smoothing (default 3)
 * @returns {{ k: number[], d: number[] }}
 */
export function stochastic(bars, kPeriod = 14, dPeriod = 3) {
  const k = new Array(bars.length).fill(NaN);

  for (let i = kPeriod - 1; i < bars.length; i++) {
    let high = -Infinity,
      low = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (bars[j].high > high) high = bars[j].high;
      if (bars[j].low < low) low = bars[j].low;
    }
    const range = high - low;
    k[i] = range === 0 ? 50 : ((bars[i].close - low) / range) * 100;
  }

  const d = sma(
    k.map((v) => (isNaN(v) ? 0 : v)),
    dPeriod,
  );
  // Fix alignment
  const firstK = k.findIndex((v) => !isNaN(v));
  for (let i = 0; i < firstK + dPeriod - 1; i++) d[i] = NaN;

  return { k, d };
}

// ═══════════════════════════════════════════════════════════════
// ATR (Average True Range)
// ═══════════════════════════════════════════════════════════════

/**
 * True Range.
 */
export function trueRange(bars) {
  return bars.map((b, i) => {
    if (i === 0) return b.high - b.low;
    const prev = bars[i - 1].close;
    return Math.max(b.high - b.low, Math.abs(b.high - prev), Math.abs(b.low - prev));
  });
}

/**
 * ATR using Wilder's smoothing.
 * @param {Array} bars
 * @param {number} period - Default 14
 * @returns {number[]}
 */
export function atr(bars, period = 14) {
  const tr = trueRange(bars);
  const out = new Array(bars.length).fill(NaN);

  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i];
  out[period - 1] = sum / period;

  for (let i = period; i < bars.length; i++) {
    out[i] = (out[i - 1] * (period - 1) + tr[i]) / period;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════
// ADX (Average Directional Index)
// ═══════════════════════════════════════════════════════════════

/**
 * ADX with +DI and -DI.
 * @param {Array} bars
 * @param {number} period - Default 14
 * @returns {{ adx: number[], plusDI: number[], minusDI: number[] }}
 */
export function adx(bars, period = 14) {
  const len = bars.length;
  const plusDI = new Array(len).fill(NaN);
  const minusDI = new Array(len).fill(NaN);
  const adxOut = new Array(len).fill(NaN);

  const tr = trueRange(bars);

  // +DM and -DM
  const plusDM = new Array(len).fill(0);
  const minusDM = new Array(len).fill(0);

  for (let i = 1; i < len; i++) {
    const upMove = bars[i].high - bars[i - 1].high;
    const downMove = bars[i - 1].low - bars[i].low;
    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
  }

  // Smoothed TR, +DM, -DM
  let sTR = 0,
    sPDM = 0,
    sMDM = 0;
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

  // DX and ADX
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

// ═══════════════════════════════════════════════════════════════
// CCI (Commodity Channel Index)
// ═══════════════════════════════════════════════════════════════

/**
 * CCI.
 * @param {Array} bars
 * @param {number} period - Default 20
 * @returns {number[]}
 */
export function cci(bars, period = 20) {
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

// ═══════════════════════════════════════════════════════════════
// OBV (On Balance Volume)
// ═══════════════════════════════════════════════════════════════

/**
 * OBV.
 * @param {Array} bars
 * @returns {number[]}
 */
export function obv(bars) {
  const out = new Array(bars.length);
  out[0] = bars[0]?.volume || 0;

  for (let i = 1; i < bars.length; i++) {
    if (bars[i].close > bars[i - 1].close) out[i] = out[i - 1] + (bars[i].volume || 0);
    else if (bars[i].close < bars[i - 1].close) out[i] = out[i - 1] - (bars[i].volume || 0);
    else out[i] = out[i - 1];
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════
// Williams %R
// ═══════════════════════════════════════════════════════════════

/**
 * Williams %R.
 * @param {Array} bars
 * @param {number} period - Default 14
 * @returns {number[]}
 */
export function williamsR(bars, period = 14) {
  const out = new Array(bars.length).fill(NaN);

  for (let i = period - 1; i < bars.length; i++) {
    let high = -Infinity,
      low = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (bars[j].high > high) high = bars[j].high;
      if (bars[j].low < low) low = bars[j].low;
    }
    const range = high - low;
    out[i] = range === 0 ? -50 : ((high - bars[i].close) / range) * -100;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════
// ROC (Rate of Change)
// ═══════════════════════════════════════════════════════════════

/**
 * ROC (percentage).
 * @param {number[]} src
 * @param {number}   period - Default 12
 * @returns {number[]}
 */
export function roc(src, period = 12) {
  const out = new Array(src.length).fill(NaN);
  for (let i = period; i < src.length; i++) {
    out[i] = src[i - period] === 0 ? 0 : ((src[i] - src[i - period]) / src[i - period]) * 100;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════
// MFI (Money Flow Index)
// ═══════════════════════════════════════════════════════════════

/**
 * MFI.
 * @param {Array} bars
 * @param {number} period - Default 14
 * @returns {number[]}
 */
export function mfi(bars, period = 14) {
  const out = new Array(bars.length).fill(NaN);
  const tp = bars.map((b) => (b.high + b.low + b.close) / 3);

  for (let i = period; i < bars.length; i++) {
    let posMF = 0,
      negMF = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const mf = tp[j] * (bars[j].volume || 0);
      if (tp[j] > tp[j - 1]) posMF += mf;
      else if (tp[j] < tp[j - 1]) negMF += mf;
    }
    out[i] = negMF === 0 ? 100 : 100 - 100 / (1 + posMF / negMF);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════
// VRVP (Visible Range Volume Profile)
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate Volume Profile for a specific range of bars.
 * This does NOT return an array aligned 1:1 with bars like other functions.
 * Instead, it returns an array of price bins.
 *
 * @param {Array<{high:number, low:number, close:number, open:number, volume:number}>} bars - Only the VISIBLE bars
 * @param {number} rowCount - Number of price bins (e.g. 24 or 50)
 * @returns {Array<{priceStart: number, priceEnd: number, priceCenter: number, totalVol: number, upVol: number, downVol: number}>}
 */
export function calculateVRVP(bars, rowCount = 24) {
  if (!bars || !bars.length) return [];

  let minP = Infinity,
    maxP = -Infinity;
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
    // Simple allocation: assign all volume to the bin that contains the typical price
    const typical = (b.high + b.low + b.close) / 3;
    let binIdx = Math.floor((typical - minP) / step);

    // clamp just in case of float precision issues
    if (binIdx < 0) binIdx = 0;
    if (binIdx >= rowCount) binIdx = rowCount - 1;

    bins[binIdx].totalVol += b.volume;
    if (isUp) bins[binIdx].upVol += b.volume;
    else bins[binIdx].downVol += b.volume;
  }

  return bins;
}

// ═══════════════════════════════════════════════════════════════
// Sprint 9 — 15 New Indicators
// ═══════════════════════════════════════════════════════════════

/**
 * Chaikin Money Flow (CMF).
 * Measures accumulation/distribution pressure over a period.
 */
export function cmf(bars, period = 20) {
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

/**
 * Keltner Channel.
 * EMA ± ATR multiplier for volatility-based channels.
 */
export function keltnerChannel(bars, emaPeriod = 20, atrPeriod = 10, multiplier = 1.5) {
  const cls = closes(bars);
  const middle = ema(cls, emaPeriod);
  const atrVals = atr(bars, atrPeriod);
  const upper = new Array(bars.length).fill(NaN);
  const lower = new Array(bars.length).fill(NaN);

  for (let i = 0; i < bars.length; i++) {
    if (!isNaN(middle[i]) && !isNaN(atrVals[i])) {
      upper[i] = middle[i] + multiplier * atrVals[i];
      lower[i] = middle[i] - multiplier * atrVals[i];
    }
  }
  return { middle, upper, lower };
}

/**
 * Volume Weighted Moving Average (VWMA).
 */
export function vwma(bars, period = 20) {
  const out = new Array(bars.length).fill(NaN);
  for (let i = period - 1; i < bars.length; i++) {
    let sumPV = 0, sumV = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumPV += bars[j].close * (bars[j].volume || 0);
      sumV += bars[j].volume || 0;
    }
    out[i] = sumV === 0 ? bars[i].close : sumPV / sumV;
  }
  return out;
}

/**
 * Hull Moving Average (HMA).
 * Reduced lag MA: WMA(2*WMA(n/2) - WMA(n), sqrt(n))
 */
export function hma(src, period = 9) {
  const half = Math.max(1, Math.floor(period / 2));
  const sqrtP = Math.max(1, Math.floor(Math.sqrt(period)));
  const wmaHalf = wma(src, half);
  const wmaFull = wma(src, period);
  const diff = wmaHalf.map((v, i) => isNaN(v) || isNaN(wmaFull[i]) ? NaN : 2 * v - wmaFull[i]);
  return wma(diff.map(v => isNaN(v) ? 0 : v), sqrtP);
}

/**
 * Full Donchian Channel (upper, lower, basis).
 */
export function donchianChannel(bars, period = 20) {
  const upper = new Array(bars.length).fill(NaN);
  const lower = new Array(bars.length).fill(NaN);
  const basis = new Array(bars.length).fill(NaN);
  for (let i = period - 1; i < bars.length; i++) {
    let h = -Infinity, l = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (bars[j].high > h) h = bars[j].high;
      if (bars[j].low < l) l = bars[j].low;
    }
    upper[i] = h;
    lower[i] = l;
    basis[i] = (h + l) / 2;
  }
  return { upper, lower, basis };
}

/**
 * Linear Regression Channel.
 */
export function linearRegressionChannel(src, period = 20, stdDevMult = 2) {
  const mid = new Array(src.length).fill(NaN);
  const upper = new Array(src.length).fill(NaN);
  const lower = new Array(src.length).fill(NaN);

  for (let i = period - 1; i < src.length; i++) {
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let j = 0; j < period; j++) {
      sumX += j;
      sumY += src[i - period + 1 + j];
      sumXY += j * src[i - period + 1 + j];
      sumX2 += j * j;
    }
    const slope = (period * sumXY - sumX * sumY) / (period * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / period;
    const predicted = intercept + slope * (period - 1);
    mid[i] = predicted;

    // Standard deviation
    let sumSq = 0;
    for (let j = 0; j < period; j++) {
      const pred = intercept + slope * j;
      sumSq += (src[i - period + 1 + j] - pred) ** 2;
    }
    const sd = Math.sqrt(sumSq / period);
    upper[i] = predicted + stdDevMult * sd;
    lower[i] = predicted - stdDevMult * sd;
  }
  return { mid, upper, lower };
}

/**
 * TRIX — Triple EMA rate of change (momentum oscillator).
 */
export function trix(src, period = 15) {
  const e1 = ema(src, period);
  const e2 = ema(e1.map(v => isNaN(v) ? 0 : v), period);
  const e3 = ema(e2.map(v => isNaN(v) ? 0 : v), period);
  const out = new Array(src.length).fill(NaN);
  for (let i = 1; i < src.length; i++) {
    if (!isNaN(e3[i]) && !isNaN(e3[i - 1]) && e3[i - 1] !== 0) {
      out[i] = ((e3[i] - e3[i - 1]) / e3[i - 1]) * 10000;
    }
  }
  return out;
}

/**
 * Chaikin Oscillator — MACD of Accumulation/Distribution Line.
 */
export function chaikinOscillator(bars, fastP = 3, slowP = 10) {
  // Build AD line
  const adLine = new Array(bars.length).fill(0);
  for (let i = 0; i < bars.length; i++) {
    const hl = bars[i].high - bars[i].low;
    const mfm = hl === 0 ? 0 : ((bars[i].close - bars[i].low) - (bars[i].high - bars[i].close)) / hl;
    adLine[i] = (i > 0 ? adLine[i - 1] : 0) + mfm * (bars[i].volume || 0);
  }
  const fastEma = ema(adLine, fastP);
  const slowEma = ema(adLine, slowP);
  return fastEma.map((v, i) => isNaN(v) || isNaN(slowEma[i]) ? NaN : v - slowEma[i]);
}

/**
 * Aroon Oscillator.
 */
export function aroon(bars, period = 25) {
  const up = new Array(bars.length).fill(NaN);
  const down = new Array(bars.length).fill(NaN);
  const osc = new Array(bars.length).fill(NaN);

  for (let i = period; i < bars.length; i++) {
    let highIdx = i, lowIdx = i;
    for (let j = i - period; j <= i; j++) {
      if (bars[j].high >= bars[highIdx].high) highIdx = j;
      if (bars[j].low <= bars[lowIdx].low) lowIdx = j;
    }
    up[i] = ((period - (i - highIdx)) / period) * 100;
    down[i] = ((period - (i - lowIdx)) / period) * 100;
    osc[i] = up[i] - down[i];
  }
  return { up, down, osc };
}

/**
 * Percentage Price Oscillator (PPO) — MACD normalized as percentage.
 */
export function ppo(src, fastP = 12, slowP = 26, signalP = 9) {
  const fastEma = ema(src, fastP);
  const slowEma = ema(src, slowP);
  const ppoLine = fastEma.map((v, i) => {
    if (isNaN(v) || isNaN(slowEma[i]) || slowEma[i] === 0) return NaN;
    return ((v - slowEma[i]) / slowEma[i]) * 100;
  });
  const signalLine = ema(ppoLine.map(v => isNaN(v) ? 0 : v), signalP);
  const hist = ppoLine.map((v, i) => isNaN(v) || isNaN(signalLine[i]) ? NaN : v - signalLine[i]);
  return { ppo: ppoLine, signal: signalLine, histogram: hist };
}

/**
 * Detrended Price Oscillator (DPO).
 */
export function dpo(src, period = 20) {
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

/**
 * Mass Index.
 */
export function massIndex(bars, emaPeriod = 9, sumPeriod = 25) {
  const hl = bars.map(b => b.high - b.low);
  const singleEma = ema(hl, emaPeriod);
  const doubleEma = ema(singleEma.map(v => isNaN(v) ? 0 : v), emaPeriod);
  const ratio = singleEma.map((v, i) => {
    if (isNaN(v) || isNaN(doubleEma[i]) || doubleEma[i] === 0) return NaN;
    return v / doubleEma[i];
  });
  const out = new Array(bars.length).fill(NaN);
  for (let i = sumPeriod - 1; i < bars.length; i++) {
    let sum = 0;
    for (let j = i - sumPeriod + 1; j <= i; j++) {
      sum += isNaN(ratio[j]) ? 0 : ratio[j];
    }
    out[i] = sum;
  }
  return out;
}

/**
 * KST (Know Sure Thing) — momentum oscillator.
 */
export function kst(src) {
  const r1 = roc(src, 10);
  const r2 = roc(src, 15);
  const r3 = roc(src, 20);
  const r4 = roc(src, 30);
  const s1 = sma(r1.map(v => isNaN(v) ? 0 : v), 10);
  const s2 = sma(r2.map(v => isNaN(v) ? 0 : v), 10);
  const s3 = sma(r3.map(v => isNaN(v) ? 0 : v), 10);
  const s4 = sma(r4.map(v => isNaN(v) ? 0 : v), 15);
  const kstLine = s1.map((v, i) => {
    if (isNaN(v) || isNaN(s2[i]) || isNaN(s3[i]) || isNaN(s4[i])) return NaN;
    return v * 1 + s2[i] * 2 + s3[i] * 3 + s4[i] * 4;
  });
  const signalLine = sma(kstLine.map(v => isNaN(v) ? 0 : v), 9);
  return { kst: kstLine, signal: signalLine };
}

/**
 * Coppock Curve.
 */
export function coppock(src, longP = 14, shortP = 11, wmaP = 10) {
  const longROC = roc(src, longP);
  const shortROC = roc(src, shortP);
  const sum = longROC.map((v, i) => isNaN(v) || isNaN(shortROC[i]) ? NaN : v + shortROC[i]);
  return wma(sum.map(v => isNaN(v) ? 0 : v), wmaP);
}

/**
 * Squeeze Momentum (TTM Squeeze).
 * Detects Bollinger Bands inside Keltner Channel = squeeze on.
 */
export function squeezeMomentum(bars, bbPeriod = 20, bbMult = 2, kcPeriod = 20, kcMult = 1.5) {
  const cls = closes(bars);
  const bb = bollingerBands(cls, bbPeriod, bbMult);
  const kc = keltnerChannel(bars, kcPeriod, kcPeriod, kcMult);

  const squeezeOn = new Array(bars.length).fill(false);
  const momentum = new Array(bars.length).fill(NaN);

  for (let i = 0; i < bars.length; i++) {
    if (!isNaN(bb.lower[i]) && !isNaN(kc.lower[i])) {
      squeezeOn[i] = bb.lower[i] > kc.lower[i] && bb.upper[i] < kc.upper[i];
    }
    // Momentum: linear regression of (close - midline of kc and bb average)
    if (!isNaN(kc.middle[i]) && !isNaN(bb.middle[i])) {
      momentum[i] = cls[i] - (kc.middle[i] + bb.middle[i]) / 2;
    }
  }
  return { squeezeOn, momentum };
}

// ═══════════════════════════════════════════════════════════════
// Phase 1 Deep Dive — New Indicator Computations
// ═══════════════════════════════════════════════════════════════

/**
 * Supertrend — ATR-based trend-following indicator.
 * @param {Array} bars
 * @param {number} period - ATR period (default 10)
 * @param {number} multiplier - ATR multiplier (default 3)
 * @returns {{ supertrend: number[], direction: number[] }}
 */
export function supertrend(bars, period = 10, multiplier = 3) {
  const len = bars.length;
  const st = new Array(len).fill(NaN);
  const dir = new Array(len).fill(1); // 1 = up, -1 = down
  const atrVals = atr(bars, period);

  let upperBand = 0, lowerBand = 0;
  let prevUpper = 0, prevLower = 0;

  for (let i = period; i < len; i++) {
    const hl2 = (bars[i].high + bars[i].low) / 2;
    const atrVal = atrVals[i];
    if (isNaN(atrVal)) continue;

    let curUpper = hl2 + multiplier * atrVal;
    let curLower = hl2 - multiplier * atrVal;

    // Keep bands from moving against the trend
    if (i > period) {
      curUpper = curUpper < prevUpper || bars[i - 1].close > prevUpper ? curUpper : prevUpper;
      curLower = curLower > prevLower || bars[i - 1].close < prevLower ? curLower : prevLower;
    }

    // Direction
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

/**
 * Parabolic SAR — acceleration factor system.
 * @param {Array} bars
 * @param {number} step - Acceleration factor step (default 0.02)
 * @param {number} max - Maximum acceleration factor (default 0.2)
 * @returns {{ sar: number[], isUpTrend: boolean[] }}
 */
export function parabolicSAR(bars, step = 0.02, max = 0.2) {
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

/**
 * Accumulation/Distribution Line.
 * @param {Array} bars
 * @returns {number[]}
 */
export function adLine(bars) {
  const out = new Array(bars.length).fill(0);
  for (let i = 0; i < bars.length; i++) {
    const hl = bars[i].high - bars[i].low;
    const mfm = hl === 0 ? 0 : ((bars[i].close - bars[i].low) - (bars[i].high - bars[i].close)) / hl;
    out[i] = (i > 0 ? out[i - 1] : 0) + mfm * (bars[i].volume || 0);
  }
  return out;
}

/**
 * Momentum — simple price difference over N periods.
 * @param {number[]} src
 * @param {number} period - Default 10
 * @returns {number[]}
 */
export function momentum(src, period = 10) {
  const out = new Array(src.length).fill(NaN);
  for (let i = period; i < src.length; i++) {
    out[i] = src[i] - src[i - period];
  }
  return out;
}

/**
 * True Strength Index (TSI) — double-smoothed momentum oscillator.
 * @param {number[]} src
 * @param {number} longP - Long smoothing period (default 25)
 * @param {number} shortP - Short smoothing period (default 13)
 * @param {number} signalP - Signal smoothing period (default 13)
 * @returns {{ tsi: number[], signal: number[] }}
 */
export function tsi(src, longP = 25, shortP = 13, signalP = 13) {
  const len = src.length;
  // Price change
  const pc = new Array(len).fill(0);
  const absPC = new Array(len).fill(0);
  for (let i = 1; i < len; i++) {
    pc[i] = src[i] - src[i - 1];
    absPC[i] = Math.abs(pc[i]);
  }

  // Double smooth: EMA(EMA(pc, longP), shortP)
  const pcEma1 = ema(pc, longP);
  const pcEma2 = ema(pcEma1.map(v => isNaN(v) ? 0 : v), shortP);
  const absPcEma1 = ema(absPC, longP);
  const absPcEma2 = ema(absPcEma1.map(v => isNaN(v) ? 0 : v), shortP);

  const tsiLine = new Array(len).fill(NaN);
  for (let i = 0; i < len; i++) {
    if (!isNaN(pcEma2[i]) && !isNaN(absPcEma2[i]) && absPcEma2[i] !== 0) {
      tsiLine[i] = (pcEma2[i] / absPcEma2[i]) * 100;
    }
  }

  const signalLine = ema(tsiLine.map(v => isNaN(v) ? 0 : v), signalP);
  return { tsi: tsiLine, signal: signalLine };
}

// ═══════════════════════════════════════════════════════════════
// Phase 1 Deep Dive — 8 Additional Indicators
// ═══════════════════════════════════════════════════════════════

/**
 * Vortex Indicator — +VI and -VI based on true range.
 * @param {Array} bars
 * @param {number} period - Default 14
 * @returns {{ plusVI: number[], minusVI: number[] }}
 */
export function vortex(bars, period = 14) {
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

/**
 * Ultimate Oscillator — weighted multi-period buying pressure.
 * @param {Array} bars
 * @param {number} p1 - Short period (default 7)
 * @param {number} p2 - Medium period (default 14)
 * @param {number} p3 - Long period (default 28)
 * @returns {number[]}
 */
export function ultimateOscillator(bars, p1 = 7, p2 = 14, p3 = 28) {
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

/**
 * Klinger Volume Oscillator — EMA of force (volume × trend).
 * @param {Array} bars
 * @param {number} fastP - Fast EMA period (default 34)
 * @param {number} slowP - Slow EMA period (default 55)
 * @param {number} signalP - Signal EMA period (default 13)
 * @returns {{ kvo: number[], signal: number[] }}
 */
export function klinger(bars, fastP = 34, slowP = 55, signalP = 13) {
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

/**
 * Standard Deviation of close prices over a period.
 * @param {number[]} src
 * @param {number} period - Default 20
 * @returns {number[]}
 */
export function stdDev(src, period = 20) {
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

/**
 * Historical Volatility — annualized standard deviation of log returns.
 * @param {number[]} src - Close prices
 * @param {number} period - Default 20
 * @param {number} annualize - Trading days per year (default 252)
 * @returns {number[]}
 */
export function historicalVolatility(src, period = 20, annualize = 252) {
  const out = new Array(src.length).fill(NaN);
  // Log returns
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

/**
 * Awesome Oscillator — SMA(5 of median) − SMA(34 of median).
 * @param {Array} bars
 * @returns {number[]}
 */
export function awesomeOscillator(bars) {
  const median = bars.map(b => (b.high + b.low) / 2);
  const fast = sma(median, 5);
  const slow = sma(median, 34);
  return fast.map((v, i) => isNaN(v) || isNaN(slow[i]) ? NaN : v - slow[i]);
}

/**
 * Accelerator Oscillator — AO minus SMA(5 of AO).
 * @param {Array} bars
 * @returns {number[]}
 */
export function acceleratorOscillator(bars) {
  const ao = awesomeOscillator(bars);
  const aoSma = sma(ao.map(v => isNaN(v) ? 0 : v), 5);
  return ao.map((v, i) => isNaN(v) || isNaN(aoSma[i]) ? NaN : v - aoSma[i]);
}

/**
 * Chande Momentum Oscillator (CMO).
 * CMO = (sumUp - sumDown) / (sumUp + sumDown) × 100
 * @param {number[]} src
 * @param {number} period - Default 9
 * @returns {number[]}
 */
export function chandeMomentumOscillator(src, period = 9) {
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

// ═══════════════════════════════════════════════════════════════
// Phase 2 Deep Dive — 3 New Indicator Computations
// ═══════════════════════════════════════════════════════════════

/**
 * Session VWAP — auto-resets at configurable session boundaries.
 * Unlike day-boundary VWAP, this resets at a specific UTC hour.
 * @param {Array<{high:number, low:number, close:number, volume:number, time:number}>} bars
 * @param {number} resetHourUTC - UTC hour to reset (default 0 = midnight)
 * @returns {{ vwap: number[], upper: number[], lower: number[] }}
 */
export function sessionVWAP(bars, resetHourUTC = 0) {
  const len = bars.length;
  const vwapOut = new Array(len).fill(NaN);
  const upper = new Array(len).fill(NaN);
  const lower = new Array(len).fill(NaN);

  let cumPV = 0, cumVol = 0, cumPV2 = 0;

  for (let i = 0; i < len; i++) {
    const d = new Date(bars[i].time);
    const hour = d.getUTCHours();

    // Reset on session boundary
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

/**
 * Volume-Weighted RSI — RSI that weights price changes by volume.
 * Gives more significance to moves that happen on high volume.
 * @param {Array<{close:number, volume:number}>} bars
 * @param {number} period - RSI period (default 14)
 * @returns {number[]}
 */
export function volumeWeightedRSI(bars, period = 14) {
  const len = bars.length;
  const out = new Array(len).fill(NaN);
  if (len < 2) return out;

  // Volume-weighted price changes
  const gains = new Array(len).fill(0);
  const losses = new Array(len).fill(0);

  for (let i = 1; i < len; i++) {
    const diff = bars[i].close - bars[i - 1].close;
    const vol = bars[i].volume || 1;
    if (diff > 0) gains[i] = diff * vol;
    else losses[i] = Math.abs(diff) * vol;
  }

  // Wilder's smoothing
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

/**
 * Fear & Greed Index — composite sentiment indicator.
 * Combines RSI momentum, ATR volatility, and volume surge into 0-100 score.
 * @param {Array} bars
 * @param {number} period - Lookback period (default 14)
 * @returns {{ index: number[], label: string[] }}
 */
export function fearGreedIndex(bars, period = 14) {
  const len = bars.length;
  const index = new Array(len).fill(NaN);
  const label = new Array(len).fill('');

  const cls = closes(bars);
  const rsiVals = rsi(cls, period);
  const atrVals = atr(bars, period);

  // Compute rolling average volume for surge detection
  const avgVol = sma(bars.map(b => b.volume || 0), period);

  for (let i = period; i < len; i++) {
    if (isNaN(rsiVals[i]) || isNaN(atrVals[i])) continue;

    // Component 1: RSI momentum (already 0-100)
    const rsiScore = rsiVals[i];

    // Component 2: Volatility (inverse — high vol = fear)
    // Normalize ATR as % of price, then invert
    const atrPct = (atrVals[i] / bars[i].close) * 100;
    const volScore = Math.max(0, Math.min(100, 100 - atrPct * 20));

    // Component 3: Volume surge (high volume = greed if up, fear if down)
    const volRatio = avgVol[i] > 0 ? (bars[i].volume || 0) / avgVol[i] : 1;
    const isUp = bars[i].close >= bars[i].open;
    const surgeScore = isUp
      ? Math.min(100, 50 + volRatio * 15)
      : Math.max(0, 50 - volRatio * 15);

    // Weighted average: RSI 40%, Volatility 30%, Volume Surge 30%
    const composite = rsiScore * 0.4 + volScore * 0.3 + surgeScore * 0.3;
    index[i] = Math.round(Math.max(0, Math.min(100, composite)));

    // Labels
    if (index[i] <= 20) label[i] = 'Extreme Fear';
    else if (index[i] <= 40) label[i] = 'Fear';
    else if (index[i] <= 60) label[i] = 'Neutral';
    else if (index[i] <= 80) label[i] = 'Greed';
    else label[i] = 'Extreme Greed';
  }
  return { index, label };
}

/**
 * Chaikin Volatility — EMA of (High - Low) rate of change.
 * Measures whether the trading range is expanding or contracting.
 * Rising values = increasing volatility, falling = decreasing.
 * @param {Array} bars
 * @param {number} emaPeriod - EMA smoothing period (default 10)
 * @param {number} rocPeriod - Rate of change lookback (default 10)
 * @returns {number[]}
 */
export function chaikinVolatility(bars, emaPeriod = 10, rocPeriod = 10) {
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
