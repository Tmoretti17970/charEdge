// ═══════════════════════════════════════════════════════════════════
// charEdge v14 — Indicator Computation Web Worker
//
// Runs heavy indicator math off the main thread.
// Receives candle data + indicator config via postMessage,
// computes the result, and sends it back.
//
// Supported indicators (all from IndicatorLibrary.js):
//   obv, mfi, ichimoku, supertrend, vwapBands, anchoredVWAP,
//   roc, williamsR, cmf, adx, heikinAshi, renko
//
// Message protocol:
//   IN:  { type: 'compute', id, indicator, params, bars }
//   OUT: { type: 'result', id, indicator, data }
//   OUT: { type: 'error', id, indicator, error }
//
//   IN:  { type: 'batch', id, tasks: [{ indicator, params }], bars }
//   OUT: { type: 'batch-result', id, results: { [indicator]: data } }
//
// The `id` field is a correlation ID so the bridge can match responses.
// ═══════════════════════════════════════════════════════════════════

// ─── WASM Integration ──────────────────────────────────────────

let wasmModule = null;

async function initWasm() {
  try {
    const wasm = await import('../../../charting_library/core/wasmBridge.js');
    await wasm.wasmReady;
    if (wasm.isWasmAvailable()) {
      wasmModule = wasm;
    }
  // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (_err) {
    // no-op
  }
}

initWasm();

// ─── Inline Helpers (WASM-accelerated with JS fallback) ────────

function sma(values, period) {
  // WASM fast path — convert to Float64Array and back
  if (wasmModule) {
    const f64 = new Float64Array(values.length);
    for (let i = 0; i < values.length; i++) f64[i] = values[i] ?? 0;
    const result = wasmModule.wasmSMA(f64, period);
    if (result) return Array.from(result, v => isNaN(v) ? null : v);
  }

  // JS fallback
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

function _ema(values, period) {
  // WASM fast path
  if (wasmModule) {
    const f64 = new Float64Array(values.length);
    for (let i = 0; i < values.length; i++) f64[i] = values[i] ?? 0;
    const result = wasmModule.wasmEMA(f64, period);
    if (result) return Array.from(result, v => isNaN(v) ? null : v);
  }

  // JS fallback
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
    return Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
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

// ─── Indicator Implementations ─────────────────────────────────

const indicators = {
  obv(candles) {
    if (!candles?.length) return [];
    let obv = 0;
    return candles.map((c, i) => {
      if (i === 0) return { time: c.time, obv: 0 };
      const prev = candles[i - 1];
      if (c.close > prev.close) obv += c.volume;
      else if (c.close < prev.close) obv -= c.volume;
      return { time: c.time, obv };
    });
  },

  mfi(candles, period = 14) {
    if (!candles || candles.length < period + 1) return [];
    const result = [];
    for (let i = 0; i < candles.length; i++) {
      if (i < period) { result.push({ time: candles[i].time, mfi: null }); continue; }
      let posFlow = 0, negFlow = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const tp = (candles[j].high + candles[j].low + candles[j].close) / 3;
        const prevTp = (candles[j-1].high + candles[j-1].low + candles[j-1].close) / 3;
        const rawFlow = tp * candles[j].volume;
        if (tp > prevTp) posFlow += rawFlow;
        else if (tp < prevTp) negFlow += rawFlow;
      }
      const mfi = negFlow === 0 ? 100 : 100 - (100 / (1 + posFlow / negFlow));
      result.push({ time: candles[i].time, mfi: Math.round(mfi * 100) / 100 });
    }
    return result;
  },

  ichimoku(candles, params = {}) {
    if (!candles?.length) return [];
    const tp = params.tenkanPeriod || 9;
    const kp = params.kijunPeriod || 26;
    const sp = params.senkouBPeriod || 52;
    const disp = params.displacement || 26;
    const result = [];
    for (let i = 0; i < candles.length + disp; i++) {
      const time = i < candles.length ? candles[i].time : candles[candles.length-1].time + (i - candles.length + 1) * 60000;
      let tenkan = null;
      if (i >= tp - 1 && i < candles.length) tenkan = (highestHigh(candles, tp, i) + lowestLow(candles, tp, i)) / 2;
      let kijun = null;
      if (i >= kp - 1 && i < candles.length) kijun = (highestHigh(candles, kp, i) + lowestLow(candles, kp, i)) / 2;
      let senkouA = null;
      const aIdx = i - disp;
      if (aIdx >= 0 && aIdx < candles.length) {
        const t = aIdx >= tp - 1 ? (highestHigh(candles, tp, aIdx) + lowestLow(candles, tp, aIdx)) / 2 : null;
        const k = aIdx >= kp - 1 ? (highestHigh(candles, kp, aIdx) + lowestLow(candles, kp, aIdx)) / 2 : null;
        if (t !== null && k !== null) senkouA = (t + k) / 2;
      }
      let senkouB = null;
      const bIdx = i - disp;
      if (bIdx >= sp - 1 && bIdx < candles.length) senkouB = (highestHigh(candles, sp, bIdx) + lowestLow(candles, sp, bIdx)) / 2;
      let chikou = null;
      const chikouIdx = i + disp;
      if (chikouIdx < candles.length) chikou = candles[chikouIdx].close;
      if (i < candles.length) result.push({ time, tenkan, kijun, senkouA, senkouB, chikou });
    }
    return result;
  },

  supertrend(candles, period = 10, multiplier = 3) {
    if (!candles || candles.length < period) return [];
    const trValues = tr(candles);
    const atrValues = sma(trValues, period);
    const result = [];
    let prevUpperBand = 0, prevLowerBand = 0, prevSupertrend = 0, direction = 1;
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      if (atrValues[i] === null) { result.push({ time: c.time, supertrend: null, direction: 0, upperBand: null, lowerBand: null }); continue; }
      const hl2 = (c.high + c.low) / 2;
      let upperBand = hl2 + multiplier * atrValues[i];
      let lowerBand = hl2 - multiplier * atrValues[i];
      if (prevLowerBand > 0 && lowerBand < prevLowerBand && candles[i-1]?.close > prevLowerBand) lowerBand = prevLowerBand;
      if (prevUpperBand > 0 && upperBand > prevUpperBand && candles[i-1]?.close < prevUpperBand) upperBand = prevUpperBand;
      if (prevSupertrend === prevUpperBand) direction = c.close > upperBand ? 1 : -1;
      else direction = c.close < lowerBand ? -1 : 1;
      const supertrend = direction === 1 ? lowerBand : upperBand;
      result.push({ time: c.time, supertrend: Math.round(supertrend * 100) / 100, direction, upperBand: Math.round(upperBand * 100) / 100, lowerBand: Math.round(lowerBand * 100) / 100 });
      prevUpperBand = upperBand; prevLowerBand = lowerBand; prevSupertrend = supertrend;
    }
    return result;
  },

  vwapBands(candles) {
    if (!candles?.length) return [];
    const result = [];
    let cumVolume = 0, cumTPVolume = 0, cumTPSqVolume = 0, lastDay = null;
    for (const c of candles) {
      const day = new Date(c.time).toDateString();
      if (day !== lastDay) { cumVolume = 0; cumTPVolume = 0; cumTPSqVolume = 0; lastDay = day; }
      const tp = (c.high + c.low + c.close) / 3;
      cumVolume += c.volume; cumTPVolume += tp * c.volume; cumTPSqVolume += tp * tp * c.volume;
      if (cumVolume === 0) { result.push({ time: c.time, vwap: tp, upper1: tp, upper2: tp, upper3: tp, lower1: tp, lower2: tp, lower3: tp }); continue; }
      const vwap = cumTPVolume / cumVolume;
      const variance = (cumTPSqVolume / cumVolume) - (vwap * vwap);
      const stddev = Math.sqrt(Math.max(0, variance));
      result.push({ time: c.time, vwap: Math.round(vwap*100)/100, upper1: Math.round((vwap+stddev)*100)/100, upper2: Math.round((vwap+2*stddev)*100)/100, upper3: Math.round((vwap+3*stddev)*100)/100, lower1: Math.round((vwap-stddev)*100)/100, lower2: Math.round((vwap-2*stddev)*100)/100, lower3: Math.round((vwap-3*stddev)*100)/100 });
    }
    return result;
  },

  anchoredVWAP(candles, anchorIndex = 0) {
    if (!candles?.length) return [];
    const result = [];
    let cumVolume = 0, cumTPVolume = 0;
    for (let i = 0; i < candles.length; i++) {
      if (i < anchorIndex) { result.push({ time: candles[i].time, avwap: null }); continue; }
      const c = candles[i];
      const tp = (c.high + c.low + c.close) / 3;
      cumVolume += c.volume; cumTPVolume += tp * c.volume;
      result.push({ time: c.time, avwap: Math.round((cumVolume > 0 ? cumTPVolume / cumVolume : tp) * 100) / 100 });
    }
    return result;
  },

  roc(candles, period = 12) {
    if (!candles?.length) return [];
    return candles.map((c, i) => {
      if (i < period) return { time: c.time, roc: null };
      const prev = candles[i - period];
      return { time: c.time, roc: Math.round(((c.close - prev.close) / (prev.close || 1)) * 10000) / 100 };
    });
  },

  williamsR(candles, period = 14) {
    if (!candles?.length) return [];
    return candles.map((c, i) => {
      if (i < period - 1) return { time: c.time, williamsR: null };
      const hh = highestHigh(candles, period, i);
      const ll = lowestLow(candles, period, i);
      return { time: c.time, williamsR: Math.round((hh !== ll ? ((hh - c.close) / (hh - ll)) * -100 : 0) * 100) / 100 };
    });
  },

  cmf(candles, period = 20) {
    if (!candles?.length) return [];
    return candles.map((c, i) => {
      if (i < period - 1) return { time: c.time, cmf: null };
      let sumMFV = 0, sumVol = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const bar = candles[j];
        const range = bar.high - bar.low;
        const clv = range > 0 ? ((bar.close - bar.low) - (bar.high - bar.close)) / range : 0;
        sumMFV += clv * bar.volume; sumVol += bar.volume;
      }
      return { time: c.time, cmf: Math.round((sumVol !== 0 ? sumMFV / sumVol : 0) * 10000) / 10000 };
    });
  },

  adx(candles, period = 14) {
    if (!candles || candles.length < period * 2) return [];
    const dmPlus = [], dmMinus = [], trValues = [];
    for (let i = 0; i < candles.length; i++) {
      if (i === 0) { dmPlus.push(0); dmMinus.push(0); trValues.push(candles[i].high - candles[i].low); continue; }
      const prev = candles[i-1], c = candles[i];
      const upMove = c.high - prev.high, downMove = prev.low - c.low;
      dmPlus.push(upMove > downMove && upMove > 0 ? upMove : 0);
      dmMinus.push(downMove > upMove && downMove > 0 ? downMove : 0);
      trValues.push(Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close)));
    }
    const smoothedTR = [], smoothedDMPlus = [], smoothedDMMinus = [];
    let sumTR = 0, sumDMPlus = 0, sumDMMinus = 0;
    for (let i = 0; i < period; i++) { sumTR += trValues[i]; sumDMPlus += dmPlus[i]; sumDMMinus += dmMinus[i]; }
    smoothedTR.push(sumTR); smoothedDMPlus.push(sumDMPlus); smoothedDMMinus.push(sumDMMinus);
    for (let i = period; i < candles.length; i++) {
      smoothedTR.push(smoothedTR[smoothedTR.length-1] - smoothedTR[smoothedTR.length-1] / period + trValues[i]);
      smoothedDMPlus.push(smoothedDMPlus[smoothedDMPlus.length-1] - smoothedDMPlus[smoothedDMPlus.length-1] / period + dmPlus[i]);
      smoothedDMMinus.push(smoothedDMMinus[smoothedDMMinus.length-1] - smoothedDMMinus[smoothedDMMinus.length-1] / period + dmMinus[i]);
    }
    const diPlus = [], diMinus = [], dx = [];
    for (let i = 0; i < smoothedTR.length; i++) {
      const pdi = smoothedTR[i] > 0 ? (smoothedDMPlus[i] / smoothedTR[i]) * 100 : 0;
      const mdi = smoothedTR[i] > 0 ? (smoothedDMMinus[i] / smoothedTR[i]) * 100 : 0;
      diPlus.push(pdi); diMinus.push(mdi);
      dx.push(pdi + mdi > 0 ? (Math.abs(pdi - mdi) / (pdi + mdi)) * 100 : 0);
    }
    const result = [];
    const offset = period;
    for (let i = 0; i < candles.length; i++) {
      if (i < offset) { result.push({ time: candles[i].time, adx: null, pdi: null, mdi: null }); continue; }
      const dxIdx = i - offset;
      if (dxIdx < period) { result.push({ time: candles[i].time, adx: null, pdi: Math.round(diPlus[dxIdx]*100)/100, mdi: Math.round(diMinus[dxIdx]*100)/100 }); continue; }
      let adxSum = 0;
      for (let j = dxIdx - period + 1; j <= dxIdx; j++) adxSum += dx[j];
      result.push({ time: candles[i].time, adx: Math.round((adxSum / period)*100)/100, pdi: Math.round(diPlus[dxIdx]*100)/100, mdi: Math.round(diMinus[dxIdx]*100)/100 });
    }
    return result;
  },

  heikinAshi(candles) {
    if (!candles?.length) return [];
    const result = [];
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const haClose = (c.open + c.high + c.low + c.close) / 4;
      const haOpen = i === 0 ? (c.open + c.close) / 2 : (result[i-1].open + result[i-1].close) / 2;
      result.push({ time: c.time, open: Math.round(haOpen*100)/100, high: Math.max(c.high, haOpen, haClose), low: Math.min(c.low, haOpen, haClose), close: Math.round(haClose*100)/100, volume: c.volume });
    }
    return result;
  },

  renko(candles, brickSize) {
    if (!candles?.length) return [];
    if (!brickSize) {
      const trValues = tr(candles);
      const atr = trValues.slice(-14).reduce((a, b) => a + b, 0) / Math.min(14, trValues.length);
      brickSize = Math.round(atr * 100) / 100 || 1;
    }
    const bricks = [];
    let lastBrickClose = Math.round(candles[0].close / brickSize) * brickSize;
    for (const c of candles) {
      const diff = c.close - lastBrickClose;
      const numBricks = Math.floor(Math.abs(diff) / brickSize);
      for (let j = 0; j < numBricks; j++) {
        const dir = diff > 0 ? 1 : -1;
        const open = lastBrickClose;
        const close = lastBrickClose + dir * brickSize;
        bricks.push({ time: c.time, open, high: Math.max(open, close), low: Math.min(open, close), close, volume: c.volume / Math.max(numBricks, 1), direction: dir });
        lastBrickClose = close;
      }
    }
    return bricks;
  },
};

// ─── Message Handler ───────────────────────────────────────────

self.onmessage = function(event) {
  const msg = event.data;

  if (msg.type === 'compute') {
    try {
      const fn = indicators[msg.indicator];
      if (!fn) throw new Error(`Unknown indicator: ${msg.indicator}`);
      const params = msg.params || {};
      const args = [msg.bars];
      // Pass additional params based on indicator
      if (msg.indicator === 'mfi' || msg.indicator === 'williamsR' || msg.indicator === 'cmf') args.push(params.period);
      else if (msg.indicator === 'ichimoku') args.push(params);
      else if (msg.indicator === 'supertrend') { args.push(params.period); args.push(params.multiplier); }
      else if (msg.indicator === 'anchoredVWAP') args.push(params.anchorIndex);
      else if (msg.indicator === 'roc') args.push(params.period);
      else if (msg.indicator === 'adx') args.push(params.period);
      else if (msg.indicator === 'renko') args.push(params.brickSize);

      const data = fn(...args);
      self.postMessage({ type: 'result', id: msg.id, indicator: msg.indicator, data });
    } catch (err) {
      self.postMessage({ type: 'error', id: msg.id, indicator: msg.indicator, error: err.message });
    }
  }

  else if (msg.type === 'batch') {
    try {
      const results = {};
      for (const task of msg.tasks) {
        const fn = indicators[task.indicator];
        if (!fn) { results[task.indicator] = []; continue; }
        const params = task.params || {};
        const args = [msg.bars];
        if (task.indicator === 'mfi' || task.indicator === 'williamsR' || task.indicator === 'cmf') args.push(params.period);
        else if (task.indicator === 'ichimoku') args.push(params);
        else if (task.indicator === 'supertrend') { args.push(params.period); args.push(params.multiplier); }
        else if (task.indicator === 'anchoredVWAP') args.push(params.anchorIndex);
        else if (task.indicator === 'roc') args.push(params.period);
        else if (task.indicator === 'adx') args.push(params.period);
        else if (task.indicator === 'renko') args.push(params.brickSize);
        results[task.indicator] = fn(...args);
      }
      self.postMessage({ type: 'batch-result', id: msg.id, results });
    } catch (err) {
      self.postMessage({ type: 'error', id: msg.id, error: err.message });
    }
  }
};

self.postMessage({ type: 'ready' });
