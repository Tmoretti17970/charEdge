// ═══════════════════════════════════════════════════════════════════
// charEdge v13 — Enhanced Indicator Library
//
// Pure computation functions for advanced technical indicators.
// All functions are stateless — pass in candle data, get results.
//
// Indicators:
//   • CVD (Cumulative Volume Delta) chart series
//   • OBV (On-Balance Volume)
//   • MFI (Money Flow Index — volume-weighted RSI)
//   • Ichimoku Cloud (Tenkan, Kijun, Senkou A/B, Chikou)
//   • Supertrend (ATR-based trend follower)
//   • VWAP Bands (1σ, 2σ, 3σ)
//   • Anchored VWAP (from any start point)
//   • Rate of Change (ROC)
//   • Williams %R
//   • Chaikin Money Flow (CMF)
//   • ADX (Average Directional Index)
//
// All functions accept standard OHLCV arrays:
//   [{ open, high, low, close, volume, time }]
//
// Usage:
//   import { indicators } from './IndicatorLibrary.js';
//   const ichi = indicators.ichimoku(candles);
//   const st = indicators.supertrend(candles, 10, 3);
// ═══════════════════════════════════════════════════════════════════

// ─── Helpers ───────────────────────────────────────────────────

function sma(values, period) {
  const result = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += values[i - j];
      result.push(sum / period);
    }
  }
  return result;
}

function ema(values, period) {
  const result = [];
  const multiplier = 2 / (period + 1);
  let prev = null;

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += values[i - j];
      prev = sum / period;
      result.push(prev);
    } else {
      prev = (values[i] - prev) * multiplier + prev;
      result.push(prev);
    }
  }
  return result;
}

function tr(candles) {
  return candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prev = candles[i - 1];
    return Math.max(
      c.high - c.low,
      Math.abs(c.high - prev.close),
      Math.abs(c.low - prev.close)
    );
  });
}

function highestHigh(candles, period, idx) {
  let max = -Infinity;
  for (let i = Math.max(0, idx - period + 1); i <= idx; i++) {
    if (candles[i].high > max) max = candles[i].high;
  }
  return max;
}

function lowestLow(candles, period, idx) {
  let min = Infinity;
  for (let i = Math.max(0, idx - period + 1); i <= idx; i++) {
    if (candles[i].low < min) min = candles[i].low;
  }
  return min;
}

// ─── Indicators ────────────────────────────────────────────────

export const indicators = {

  // ─── Simple Moving Average ───────────────────────────────

  /**
   * SMA overlay — wraps the private sma() helper for bridge/worker access.
   * @param {Array} candles
   * @param {number} [period=20]
   * @returns {Array<{ time, value }>}
   */
  sma(candles, period = 20) {
    if (!candles?.length) return [];
    const closes = candles.map(c => c.close);
    const values = sma(closes, period);
    return candles.map((c, i) => ({ time: c.time, value: values[i] }));
  },

  // ─── Exponential Moving Average ──────────────────────────

  /**
   * EMA overlay — wraps the private ema() helper for bridge/worker access.
   * @param {Array} candles
   * @param {number} [period=20]
   * @returns {Array<{ time, value }>}
   */
  ema(candles, period = 20) {
    if (!candles?.length) return [];
    const closes = candles.map(c => c.close);
    const values = ema(closes, period);
    return candles.map((c, i) => ({ time: c.time, value: values[i] }));
  },

  // ─── On-Balance Volume ───────────────────────────────────

  /**
   * On-Balance Volume: running total of volume, direction determined by close vs prior close.
   * @param {Array} candles
   * @returns {Array<{ time, obv }>}
   */
  obv(candles) {
    if (!candles?.length) return [];
    let obv = 0;

    return candles.map((c, i) => {
      if (i === 0) {
        return { time: c.time, obv: 0 };
      }
      const prev = candles[i - 1];
      if (c.close > prev.close) obv += c.volume;
      else if (c.close < prev.close) obv -= c.volume;
      // Equal close: OBV unchanged
      return { time: c.time, obv };
    });
  },

  // ─── Money Flow Index (Volume-Weighted RSI) ──────────────

  /**
   * Money Flow Index: 0-100 oscillator.
   * @param {Array} candles
   * @param {number} [period=14]
   * @returns {Array<{ time, mfi }>}
   */
  mfi(candles, period = 14) {
    if (!candles || candles.length < period + 1) return [];

    const result = [];
    for (let i = 0; i < candles.length; i++) {
      if (i < period) {
        result.push({ time: candles[i].time, mfi: null });
        continue;
      }

      let posFlow = 0;
      let negFlow = 0;

      for (let j = i - period + 1; j <= i; j++) {
        const tp = (candles[j].high + candles[j].low + candles[j].close) / 3;
        const prevTp = (candles[j - 1].high + candles[j - 1].low + candles[j - 1].close) / 3;
        const rawFlow = tp * candles[j].volume;

        if (tp > prevTp) posFlow += rawFlow;
        else if (tp < prevTp) negFlow += rawFlow;
      }

      const mfi = negFlow === 0 ? 100 : 100 - (100 / (1 + posFlow / negFlow));
      result.push({ time: candles[i].time, mfi: Math.round(mfi * 100) / 100 });
    }

    return result;
  },

  // ─── Ichimoku Cloud ──────────────────────────────────────

  /**
   * Ichimoku Kinko Hyo cloud.
   * @param {Array} candles
   * @param {Object} [params]
   * @param {number} [params.tenkanPeriod=9]
   * @param {number} [params.kijunPeriod=26]
   * @param {number} [params.senkouBPeriod=52]
   * @param {number} [params.displacement=26]
   * @returns {Array<{ time, tenkan, kijun, senkouA, senkouB, chikou }>}
   */
  ichimoku(candles, params = {}) {
    if (!candles?.length) return [];

    const tp = params.tenkanPeriod || 9;
    const kp = params.kijunPeriod || 26;
    const sp = params.senkouBPeriod || 52;
    const disp = params.displacement || 26;

    const result = [];

    for (let i = 0; i < candles.length + disp; i++) {
      const cIdx = Math.min(i, candles.length - 1);
      const time = i < candles.length ? candles[i].time : candles[candles.length - 1].time + (i - candles.length + 1) * 60000;

      // Tenkan-sen (Conversion Line): (9-period high + 9-period low) / 2
      let tenkan = null;
      if (i >= tp - 1 && i < candles.length) {
        tenkan = (highestHigh(candles, tp, i) + lowestLow(candles, tp, i)) / 2;
      }

      // Kijun-sen (Base Line): (26-period high + 26-period low) / 2
      let kijun = null;
      if (i >= kp - 1 && i < candles.length) {
        kijun = (highestHigh(candles, kp, i) + lowestLow(candles, kp, i)) / 2;
      }

      // Senkou Span A: (tenkan + kijun) / 2, displaced forward
      let senkouA = null;
      const aIdx = i - disp;
      if (aIdx >= 0 && aIdx < candles.length) {
        const t = aIdx >= tp - 1 ? (highestHigh(candles, tp, aIdx) + lowestLow(candles, tp, aIdx)) / 2 : null;
        const k = aIdx >= kp - 1 ? (highestHigh(candles, kp, aIdx) + lowestLow(candles, kp, aIdx)) / 2 : null;
        if (t !== null && k !== null) senkouA = (t + k) / 2;
      }

      // Senkou Span B: (52-period high + 52-period low) / 2, displaced forward
      let senkouB = null;
      const bIdx = i - disp;
      if (bIdx >= sp - 1 && bIdx < candles.length) {
        senkouB = (highestHigh(candles, sp, bIdx) + lowestLow(candles, sp, bIdx)) / 2;
      }

      // Chikou Span: Close price, displaced backward
      let chikou = null;
      const chikouIdx = i + disp;
      if (chikouIdx < candles.length) {
        chikou = candles[chikouIdx].close;
      }

      if (i < candles.length) {
        result.push({ time, tenkan, kijun, senkouA, senkouB, chikou });
      }
    }

    return result;
  },

  // ─── Supertrend ──────────────────────────────────────────

  /**
   * Supertrend indicator (ATR-based).
   * @param {Array} candles
   * @param {number} [period=10] - ATR period
   * @param {number} [multiplier=3] - ATR multiplier
   * @returns {Array<{ time, supertrend, direction, upperBand, lowerBand }>}
   */
  supertrend(candles, period = 10, multiplier = 3) {
    if (!candles || candles.length < period) return [];

    // Compute ATR
    const trValues = tr(candles);
    const atrValues = sma(trValues, period);

    const result = [];
    let prevUpperBand = 0;
    let prevLowerBand = 0;
    let prevSupertrend = 0;
    let direction = 1; // 1 = up, -1 = down

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];

      if (atrValues[i] === null) {
        result.push({ time: c.time, supertrend: null, direction: 0, upperBand: null, lowerBand: null });
        continue;
      }

      const hl2 = (c.high + c.low) / 2;
      let upperBand = hl2 + multiplier * atrValues[i];
      let lowerBand = hl2 - multiplier * atrValues[i];

      // Carryover: bands can only move in favorable direction
      if (prevLowerBand > 0 && lowerBand < prevLowerBand && candles[i - 1]?.close > prevLowerBand) {
        lowerBand = prevLowerBand;
      }
      if (prevUpperBand > 0 && upperBand > prevUpperBand && candles[i - 1]?.close < prevUpperBand) {
        upperBand = prevUpperBand;
      }

      // Determine direction
      if (prevSupertrend === prevUpperBand) {
        direction = c.close > upperBand ? 1 : -1;
      } else {
        direction = c.close < lowerBand ? -1 : 1;
      }

      const supertrend = direction === 1 ? lowerBand : upperBand;

      result.push({
        time: c.time,
        supertrend: Math.round(supertrend * 100) / 100,
        direction, // 1 = bullish, -1 = bearish
        upperBand: Math.round(upperBand * 100) / 100,
        lowerBand: Math.round(lowerBand * 100) / 100,
      });

      prevUpperBand = upperBand;
      prevLowerBand = lowerBand;
      prevSupertrend = supertrend;
    }

    return result;
  },

  // ─── VWAP Bands ──────────────────────────────────────────

  /**
   * VWAP with standard deviation bands (1σ, 2σ, 3σ).
   * Assumes intraday data (resets each day).
   * @param {Array} candles
   * @returns {Array<{ time, vwap, upper1, upper2, upper3, lower1, lower2, lower3 }>}
   */
  vwapBands(candles) {
    if (!candles?.length) return [];

    const result = [];
    let cumVolume = 0;
    let cumTPVolume = 0;
    let cumTPSqVolume = 0;
    let lastDay = null;

    for (const c of candles) {
      const day = new Date(c.time).toDateString();
      if (day !== lastDay) {
        // Reset for new day
        cumVolume = 0;
        cumTPVolume = 0;
        cumTPSqVolume = 0;
        lastDay = day;
      }

      const tp = (c.high + c.low + c.close) / 3;
      cumVolume += c.volume;
      cumTPVolume += tp * c.volume;
      cumTPSqVolume += tp * tp * c.volume;

      if (cumVolume === 0) {
        result.push({ time: c.time, vwap: tp, upper1: tp, upper2: tp, upper3: tp, lower1: tp, lower2: tp, lower3: tp });
        continue;
      }

      const vwap = cumTPVolume / cumVolume;
      const variance = (cumTPSqVolume / cumVolume) - (vwap * vwap);
      const stddev = Math.sqrt(Math.max(0, variance));

      result.push({
        time: c.time,
        vwap: Math.round(vwap * 100) / 100,
        upper1: Math.round((vwap + stddev) * 100) / 100,
        upper2: Math.round((vwap + 2 * stddev) * 100) / 100,
        upper3: Math.round((vwap + 3 * stddev) * 100) / 100,
        lower1: Math.round((vwap - stddev) * 100) / 100,
        lower2: Math.round((vwap - 2 * stddev) * 100) / 100,
        lower3: Math.round((vwap - 3 * stddev) * 100) / 100,
      });
    }

    return result;
  },

  // ─── Anchored VWAP ──────────────────────────────────────

  /**
   * Anchored VWAP — VWAP from a user-selected starting point.
   * Does NOT reset at day boundaries.
   * @param {Array} candles
   * @param {number} anchorIndex - Starting candle index
   * @returns {Array<{ time, avwap }>}
   */
  anchoredVWAP(candles, anchorIndex = 0) {
    if (!candles?.length) return [];

    const result = [];
    let cumVolume = 0;
    let cumTPVolume = 0;

    for (let i = 0; i < candles.length; i++) {
      if (i < anchorIndex) {
        result.push({ time: candles[i].time, avwap: null });
        continue;
      }

      const c = candles[i];
      const tp = (c.high + c.low + c.close) / 3;
      cumVolume += c.volume;
      cumTPVolume += tp * c.volume;

      const avwap = cumVolume > 0 ? cumTPVolume / cumVolume : tp;
      result.push({
        time: c.time,
        avwap: Math.round(avwap * 100) / 100,
      });
    }

    return result;
  },

  // ─── Rate of Change ──────────────────────────────────────

  /**
   * Rate of Change: ((close - close_n) / close_n) * 100
   * @param {Array} candles
   * @param {number} [period=12]
   * @returns {Array<{ time, roc }>}
   */
  roc(candles, period = 12) {
    if (!candles?.length) return [];

    return candles.map((c, i) => {
      if (i < period) return { time: c.time, roc: null };
      const prev = candles[i - period];
      const roc = prev.close !== 0 ? ((c.close - prev.close) / prev.close) * 100 : 0;
      return { time: c.time, roc: Math.round(roc * 100) / 100 };
    });
  },

  // ─── Williams %R ─────────────────────────────────────────

  /**
   * Williams %R: -100 to 0 oscillator (oversold < -80, overbought > -20).
   * @param {Array} candles
   * @param {number} [period=14]
   * @returns {Array<{ time, williamsR }>}
   */
  williamsR(candles, period = 14) {
    if (!candles?.length) return [];

    return candles.map((c, i) => {
      if (i < period - 1) return { time: c.time, williamsR: null };
      const hh = highestHigh(candles, period, i);
      const ll = lowestLow(candles, period, i);
      const wr = hh !== ll ? ((hh - c.close) / (hh - ll)) * -100 : 0;
      return { time: c.time, williamsR: Math.round(wr * 100) / 100 };
    });
  },

  // ─── Chaikin Money Flow ──────────────────────────────────

  /**
   * Chaikin Money Flow: -1 to +1 (accumulation/distribution).
   * @param {Array} candles
   * @param {number} [period=20]
   * @returns {Array<{ time, cmf }>}
   */
  cmf(candles, period = 20) {
    if (!candles?.length) return [];

    return candles.map((c, i) => {
      if (i < period - 1) return { time: c.time, cmf: null };

      let sumMFV = 0;
      let sumVol = 0;

      for (let j = i - period + 1; j <= i; j++) {
        const bar = candles[j];
        const range = bar.high - bar.low;
        const clv = range > 0 ? ((bar.close - bar.low) - (bar.high - bar.close)) / range : 0;
        sumMFV += clv * bar.volume;
        sumVol += bar.volume;
      }

      const cmf = sumVol !== 0 ? sumMFV / sumVol : 0;
      return { time: c.time, cmf: Math.round(cmf * 10000) / 10000 };
    });
  },

  // ─── ADX (Average Directional Index) ─────────────────────

  /**
   * ADX: 0-100, trend strength (>25 = trending, <20 = ranging).
   * @param {Array} candles
   * @param {number} [period=14]
   * @returns {Array<{ time, adx, pdi, mdi }>}
   */
  adx(candles, period = 14) {
    if (!candles || candles.length < period * 2) return [];

    const dmPlus = [];
    const dmMinus = [];
    const trValues = [];

    for (let i = 0; i < candles.length; i++) {
      if (i === 0) {
        dmPlus.push(0);
        dmMinus.push(0);
        trValues.push(candles[i].high - candles[i].low);
        continue;
      }

      const prev = candles[i - 1];
      const c = candles[i];
      const upMove = c.high - prev.high;
      const downMove = prev.low - c.low;

      dmPlus.push(upMove > downMove && upMove > 0 ? upMove : 0);
      dmMinus.push(downMove > upMove && downMove > 0 ? downMove : 0);
      trValues.push(Math.max(
        c.high - c.low,
        Math.abs(c.high - prev.close),
        Math.abs(c.low - prev.close)
      ));
    }

    // Smoothed using Wilder's method
    const smoothedTR = [];
    const smoothedDMPlus = [];
    const smoothedDMMinus = [];

    let sumTR = 0, sumDMPlus = 0, sumDMMinus = 0;
    for (let i = 0; i < period; i++) {
      sumTR += trValues[i];
      sumDMPlus += dmPlus[i];
      sumDMMinus += dmMinus[i];
    }

    smoothedTR.push(sumTR);
    smoothedDMPlus.push(sumDMPlus);
    smoothedDMMinus.push(sumDMMinus);

    for (let i = period; i < candles.length; i++) {
      const prevT = smoothedTR[smoothedTR.length - 1];
      const prevP = smoothedDMPlus[smoothedDMPlus.length - 1];
      const prevM = smoothedDMMinus[smoothedDMMinus.length - 1];

      smoothedTR.push(prevT - prevT / period + trValues[i]);
      smoothedDMPlus.push(prevP - prevP / period + dmPlus[i]);
      smoothedDMMinus.push(prevM - prevM / period + dmMinus[i]);
    }

    // Compute DI+ and DI-
    const diPlus = [];
    const diMinus = [];
    const dx = [];

    for (let i = 0; i < smoothedTR.length; i++) {
      const tr = smoothedTR[i];
      const pdi = tr > 0 ? (smoothedDMPlus[i] / tr) * 100 : 0;
      const mdi = tr > 0 ? (smoothedDMMinus[i] / tr) * 100 : 0;
      diPlus.push(pdi);
      diMinus.push(mdi);
      dx.push(pdi + mdi > 0 ? (Math.abs(pdi - mdi) / (pdi + mdi)) * 100 : 0);
    }

    // Smooth DX to get ADX
    const result = [];
    const offset = period; // First DI values start at index 'period'

    for (let i = 0; i < candles.length; i++) {
      if (i < offset) {
        result.push({ time: candles[i].time, adx: null, pdi: null, mdi: null });
        continue;
      }

      const dxIdx = i - offset;
      if (dxIdx < period) {
        result.push({
          time: candles[i].time,
          adx: null,
          pdi: Math.round(diPlus[dxIdx] * 100) / 100,
          mdi: Math.round(diMinus[dxIdx] * 100) / 100,
        });
        continue;
      }

      // Simple ADX: running average of DX
      let adxSum = 0;
      for (let j = dxIdx - period + 1; j <= dxIdx; j++) {
        adxSum += dx[j];
      }

      result.push({
        time: candles[i].time,
        adx: Math.round((adxSum / period) * 100) / 100,
        pdi: Math.round(diPlus[dxIdx] * 100) / 100,
        mdi: Math.round(diMinus[dxIdx] * 100) / 100,
      });
    }

    return result;
  },

  // ─── CVD Series (from Order Flow Engine data) ────────────

  /**
   * Format CVD history from OrderFlowEngine for chart rendering.
   * @param {Array<{ time, cvd }>} cvdHistory - from orderFlowEngine.getCVD()
   * @returns {Array<{ time, value }>}
   */
  formatCVD(cvdHistory) {
    return (cvdHistory || []).map(d => ({
      time: d.time,
      value: Math.round(d.cvd * 1000) / 1000,
    }));
  },

  // ─── Heikin-Ashi Transform ───────────────────────────────

  /**
   * Transform standard OHLCV candles to Heikin-Ashi.
   * @param {Array} candles
   * @returns {Array<{ time, open, high, low, close, volume }>}
   */
  heikinAshi(candles) {
    if (!candles?.length) return [];

    const result = [];
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const haClose = (c.open + c.high + c.low + c.close) / 4;

      let haOpen;
      if (i === 0) {
        haOpen = (c.open + c.close) / 2;
      } else {
        haOpen = (result[i - 1].open + result[i - 1].close) / 2;
      }

      result.push({
        time: c.time,
        open: Math.round(haOpen * 100) / 100,
        high: Math.max(c.high, haOpen, haClose),
        low: Math.min(c.low, haOpen, haClose),
        close: Math.round(haClose * 100) / 100,
        volume: c.volume,
      });
    }

    return result;
  },

  // ─── Renko Transform ─────────────────────────────────────

  /**
   * Transform standard OHLCV candles to Renko bricks.
   * @param {Array} candles
   * @param {number} [brickSize] - Auto-calculated from ATR if omitted
   * @returns {Array<{ time, open, high, low, close, volume, direction }>}
   */
  renko(candles, brickSize) {
    if (!candles?.length) return [];

    // Auto-calc brick size from ATR(14) if not provided
    if (!brickSize) {
      const trValues = tr(candles);
      const atr = trValues.slice(-14).reduce((a, b) => a + b, 0) / Math.min(14, trValues.length);
      brickSize = Math.round(atr * 100) / 100 || 1;
    }

    const bricks = [];
    let lastClose = candles[0].close;
    let lastBrickClose = Math.round(lastClose / brickSize) * brickSize;

    for (const c of candles) {
      const diff = c.close - lastBrickClose;
      const numBricks = Math.floor(Math.abs(diff) / brickSize);

      for (let j = 0; j < numBricks; j++) {
        const dir = diff > 0 ? 1 : -1;
        const open = lastBrickClose;
        const close = lastBrickClose + dir * brickSize;

        bricks.push({
          time: c.time,
          open,
          high: Math.max(open, close),
          low: Math.min(open, close),
          close,
          volume: c.volume / Math.max(numBricks, 1),
          direction: dir,
        });

        lastBrickClose = close;
      }
    }

    return bricks;
  },

  // ─── Keltner Channels ────────────────────────────────────

  /**
   * Keltner Channels: EMA ± ATR multiplier.
   * @param {Array} candles
   * @param {number} [emaPeriod=20] - EMA period for the middle band
   * @param {number} [atrPeriod=10] - ATR period
   * @param {number} [multiplier=2] - ATR multiplier for upper/lower bands
   * @returns {Array<{ time, middle, upper, lower }>}
   */
  keltner(candles, emaPeriod = 20, atrPeriod = 10, multiplier = 2) {
    if (!candles?.length) return [];

    const closes = candles.map(c => c.close);
    const emaValues = ema(closes, emaPeriod);
    const trValues = tr(candles);
    const atrValues = ema(trValues, atrPeriod);

    return candles.map((c, i) => {
      if (emaValues[i] === null || atrValues[i] === null) {
        return { time: c.time, middle: null, upper: null, lower: null };
      }
      const mid = emaValues[i];
      const atrVal = atrValues[i];
      return {
        time: c.time,
        middle: Math.round(mid * 100) / 100,
        upper: Math.round((mid + multiplier * atrVal) * 100) / 100,
        lower: Math.round((mid - multiplier * atrVal) * 100) / 100,
      };
    });
  },

  // ─── Donchian Channels ───────────────────────────────────

  /**
   * Donchian Channels: Highest high / Lowest low over N periods.
   * @param {Array} candles
   * @param {number} [period=20]
   * @returns {Array<{ time, upper, lower, middle }>}
   */
  donchian(candles, period = 20) {
    if (!candles?.length) return [];

    return candles.map((c, i) => {
      if (i < period - 1) {
        return { time: c.time, upper: null, lower: null, middle: null };
      }
      const upper = highestHigh(candles, period, i);
      const lower = lowestLow(candles, period, i);
      return {
        time: c.time,
        upper: Math.round(upper * 100) / 100,
        lower: Math.round(lower * 100) / 100,
        middle: Math.round((upper + lower) / 2 * 100) / 100,
      };
    });
  },

  // ─── Point & Figure Transform ────────────────────────────

  /**
   * Transform standard OHLCV candles to Point & Figure columns.
   * @param {Array} candles
   * @param {number} [boxSize] - Auto-calculated from ATR(14) if omitted
   * @param {number} [reversalCount=3] - Number of boxes for reversal
   * @returns {Array<{ time, direction, top, bottom, boxes }>}
   */
  pointAndFigure(candles, boxSize, reversalCount = 3) {
    if (!candles?.length || candles.length < 2) return [];

    // Auto-calc box size from ATR(14)
    if (!boxSize) {
      const trValues = tr(candles);
      const atr = trValues.slice(-14).reduce((a, b) => a + b, 0) / Math.min(14, trValues.length);
      boxSize = Math.round(atr * 100) / 100 || 1;
    }

    const columns = [];
    let currentDir = 0;
    let colTop = Math.round(candles[0].close / boxSize) * boxSize;
    let colBot = colTop;

    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low  = candles[i].low;

      if (currentDir === 0) {
        const upBoxes  = Math.floor((high - colTop) / boxSize);
        const dnBoxes  = Math.floor((colBot - low) / boxSize);
        if (upBoxes >= reversalCount) {
          currentDir = 1;
          colTop += upBoxes * boxSize;
          columns.push({ time: candles[i].time, direction: 1, top: colTop, bottom: colBot, boxes: upBoxes + 1 });
        } else if (dnBoxes >= reversalCount) {
          currentDir = -1;
          colBot -= dnBoxes * boxSize;
          columns.push({ time: candles[i].time, direction: -1, top: colTop, bottom: colBot, boxes: dnBoxes + 1 });
        }
        continue;
      }

      if (currentDir === 1) {
        const upBoxes = Math.floor((high - colTop) / boxSize);
        if (upBoxes > 0) {
          colTop += upBoxes * boxSize;
          const last = columns[columns.length - 1];
          last.top = colTop;
          last.boxes = Math.round((last.top - last.bottom) / boxSize) + 1;
        } else {
          const dnBoxes = Math.floor((colTop - low) / boxSize);
          if (dnBoxes >= reversalCount) {
            currentDir = -1;
            colTop -= boxSize;
            colBot = colTop - (dnBoxes - 1) * boxSize;
            columns.push({ time: candles[i].time, direction: -1, top: colTop, bottom: colBot, boxes: dnBoxes });
          }
        }
      } else {
        const dnBoxes = Math.floor((colBot - low) / boxSize);
        if (dnBoxes > 0) {
          colBot -= dnBoxes * boxSize;
          const last = columns[columns.length - 1];
          last.bottom = colBot;
          last.boxes = Math.round((last.top - last.bottom) / boxSize) + 1;
        } else {
          const upBoxes = Math.floor((high - colBot) / boxSize);
          if (upBoxes >= reversalCount) {
            currentDir = 1;
            colBot += boxSize;
            colTop = colBot + (upBoxes - 1) * boxSize;
            columns.push({ time: candles[i].time, direction: 1, top: colTop, bottom: colBot, boxes: upBoxes });
          }
        }
      }
    }

    return columns;
  },
};

export default indicators;
