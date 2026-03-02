// ═══════════════════════════════════════════════════════════════════
// charEdge v15 — Universal Compute Worker
//
// Handles ALL compute-heavy tasks in the worker pool:
//   • Indicator computation (OBV, MFI, Ichimoku, RSI, etc.)
//   • Volume Profile computation
//   • Correlation matrix
//   • Statistical computations (volatility, regression)
//   • Data export formatting
//
// This worker is spawned N times by ComputeWorkerPool.
// Each instance handles one task at a time.
//
// Message Protocol:
//   IN:  { type, taskId, indicator?, params?, data }
//   OUT: { type: 'result', taskId, data }
//        { type: 'error', taskId, error }
//        { type: 'progress', taskId, progress }
// ═══════════════════════════════════════════════════════════════════

// ─── Inline Math Helpers ───────────────────────────────────────

function sma(values, period) {
  const result = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    result.push(sum / period);
  }
  return result;
}

function ema(values, period) {
  const result = [];
  const k = 2 / (period + 1);
  let prev = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    if (prev === null) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += values[j];
      prev = sum / period;
    } else {
      prev = values[i] * k + prev * (1 - k);
    }
    result.push(prev);
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
  for (let i = Math.max(0, idx - period + 1); i <= idx; i++) max = Math.max(max, candles[i].high);
  return max;
}

function lowestLow(candles, period, idx) {
  let min = Infinity;
  for (let i = Math.max(0, idx - period + 1); i <= idx; i++) min = Math.min(min, candles[i].low);
  return min;
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

function pearsonCorrelation(x, y) {
  if (x.length !== y.length || x.length < 2) return 0;
  const n = x.length;
  const mx = mean(x), my = mean(y);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx, b = y[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

// ─── Indicator Implementations ─────────────────────────────────

const indicators = {
  obv(candles) {
    const result = [];
    let obv = 0;
    for (let i = 0; i < candles.length; i++) {
      if (i > 0) {
        if (candles[i].close > candles[i - 1].close) obv += candles[i].volume || 0;
        else if (candles[i].close < candles[i - 1].close) obv -= candles[i].volume || 0;
      }
      result.push({ time: candles[i].time, value: obv });
    }
    return result;
  },

  mfi(candles, period = 14) {
    const result = [];
    for (let i = 0; i < candles.length; i++) {
      if (i < period) { result.push({ time: candles[i].time, value: null }); continue; }
      let posFlow = 0, negFlow = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const tp = (candles[j].high + candles[j].low + candles[j].close) / 3;
        const prevTp = j > 0 ? (candles[j-1].high + candles[j-1].low + candles[j-1].close) / 3 : tp;
        const rawMF = tp * (candles[j].volume || 1);
        if (tp > prevTp) posFlow += rawMF; else negFlow += rawMF;
      }
      const mfr = negFlow === 0 ? 100 : posFlow / negFlow;
      result.push({ time: candles[i].time, value: 100 - (100 / (1 + mfr)) });
    }
    return result;
  },

  ichimoku(candles, params = {}) {
    const tenkan = params.tenkan || 9;
    const kijun = params.kijun || 26;
    const senkou = params.senkou || 52;
    const result = [];
    for (let i = 0; i < candles.length; i++) {
      const tHigh = highestHigh(candles, tenkan, i);
      const tLow = lowestLow(candles, tenkan, i);
      const tenkanSen = (tHigh + tLow) / 2;
      const kHigh = highestHigh(candles, kijun, i);
      const kLow = lowestLow(candles, kijun, i);
      const kijunSen = (kHigh + kLow) / 2;
      const senkouA = (tenkanSen + kijunSen) / 2;
      const sHigh = highestHigh(candles, senkou, i);
      const sLow = lowestLow(candles, senkou, i);
      const senkouB = (sHigh + sLow) / 2;
      result.push({ time: candles[i].time, tenkanSen, kijunSen, senkouA, senkouB, chikou: candles[i].close });
    }
    return result;
  },

  supertrend(candles, period = 10, multiplier = 3) {
    const atrValues = tr(candles);
    const result = [];
    let trend = 1, prevUpper = 0, prevLower = 0;
    for (let i = 0; i < candles.length; i++) {
      if (i < period) { result.push({ time: candles[i].time, value: null, trend: 1 }); continue; }
      const atrSlice = atrValues.slice(i - period + 1, i + 1);
      const atr = mean(atrSlice);
      const hl2 = (candles[i].high + candles[i].low) / 2;
      let upper = hl2 + multiplier * atr;
      let lower = hl2 - multiplier * atr;
      if (prevLower > 0) lower = candles[i - 1].close > prevLower ? Math.max(lower, prevLower) : lower;
      if (prevUpper > 0) upper = candles[i - 1].close < prevUpper ? Math.min(upper, prevUpper) : upper;
      trend = candles[i].close > prevUpper ? 1 : candles[i].close < prevLower ? -1 : trend;
      result.push({ time: candles[i].time, value: trend === 1 ? lower : upper, trend });
      prevUpper = upper; prevLower = lower;
    }
    return result;
  },

  adx(candles, period = 14) {
    const result = [];
    if (candles.length < period * 2) return candles.map(c => ({ time: c.time, adx: null, pdi: null, ndi: null }));
    const pdm = [], ndm = [], trArr = [];
    for (let i = 1; i < candles.length; i++) {
      const upMove = candles[i].high - candles[i - 1].high;
      const downMove = candles[i - 1].low - candles[i].low;
      pdm.push(upMove > downMove && upMove > 0 ? upMove : 0);
      ndm.push(downMove > upMove && downMove > 0 ? downMove : 0);
      trArr.push(Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close)));
    }
    const smoothedPDM = ema(pdm, period);
    const smoothedNDM = ema(ndm, period);
    const smoothedTR = ema(trArr, period);
    const dx = [];
    for (let i = 0; i < smoothedPDM.length; i++) {
      if (smoothedPDM[i] == null || smoothedTR[i] == null || smoothedTR[i] === 0) {
        result.push({ time: candles[i + 1]?.time, adx: null, pdi: null, ndi: null });
        dx.push(null);
        continue;
      }
      const pdi = (smoothedPDM[i] / smoothedTR[i]) * 100;
      const ndi = (smoothedNDM[i] / smoothedTR[i]) * 100;
      const dxVal = Math.abs(pdi - ndi) / (pdi + ndi) * 100;
      dx.push(dxVal);
      result.push({ time: candles[i + 1]?.time, adx: null, pdi, ndi });
    }
    const adxLine = ema(dx.filter(v => v != null), period);
    let ai = 0;
    for (let i = 0; i < result.length; i++) {
      if (dx[i] != null && ai < adxLine.length) {
        result[i].adx = adxLine[ai++];
      }
    }
    // Pad first candle
    result.unshift({ time: candles[0]?.time, adx: null, pdi: null, ndi: null });
    return result.slice(0, candles.length);
  },

  rsi(candles, period = 14) {
    const result = [];
    let avgGain = 0, avgLoss = 0;
    for (let i = 0; i < candles.length; i++) {
      if (i === 0) { result.push({ time: candles[i].time, value: null }); continue; }
      const change = candles[i].close - candles[i - 1].close;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;
      if (i <= period) {
        avgGain += gain / period;
        avgLoss += loss / period;
        result.push({ time: candles[i].time, value: i === period ? (100 - 100 / (1 + (avgGain / (avgLoss || 1)))) : null });
      } else {
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        result.push({ time: candles[i].time, value: 100 - 100 / (1 + (avgGain / (avgLoss || 1))) });
      }
    }
    return result;
  },

  macd(candles, params = {}) {
    const fast = params.fast || 12;
    const slow = params.slow || 26;
    const signal = params.signal || 9;
    const closes = candles.map(c => c.close);
    const fastEMA = ema(closes, fast);
    const slowEMA = ema(closes, slow);
    const macdLine = fastEMA.map((f, i) => (f != null && slowEMA[i] != null) ? f - slowEMA[i] : null);
    const validMacd = macdLine.filter(v => v != null);
    const signalLine = ema(validMacd, signal);
    const result = [];
    let si = 0;
    for (let i = 0; i < candles.length; i++) {
      if (macdLine[i] == null) {
        result.push({ time: candles[i].time, macd: null, signal: null, histogram: null });
      } else {
        const sig = si < signalLine.length ? signalLine[si++] : null;
        result.push({
          time: candles[i].time,
          macd: macdLine[i],
          signal: sig,
          histogram: sig != null ? macdLine[i] - sig : null,
        });
      }
    }
    return result;
  },

  bollinger(candles, period = 20, mult = 2) {
    const closes = candles.map(c => c.close);
    const mid = sma(closes, period);
    const result = [];
    for (let i = 0; i < candles.length; i++) {
      if (mid[i] == null) {
        result.push({ time: candles[i].time, upper: null, middle: null, lower: null });
        continue;
      }
      const slice = closes.slice(Math.max(0, i - period + 1), i + 1);
      const sd = stddev(slice);
      result.push({
        time: candles[i].time,
        upper: mid[i] + mult * sd,
        middle: mid[i],
        lower: mid[i] - mult * sd,
      });
    }
    return result;
  },

  vwapBands(candles) {
    const result = [];
    let cumPV = 0, cumVol = 0, cumPV2 = 0;
    for (const c of candles) {
      const tp = (c.high + c.low + c.close) / 3;
      const vol = c.volume || 1;
      cumPV += tp * vol;
      cumVol += vol;
      cumPV2 += tp * tp * vol;
      const vwap = cumPV / cumVol;
      const variance = (cumPV2 / cumVol) - vwap * vwap;
      const sd = Math.sqrt(Math.max(0, variance));
      result.push({ time: c.time, vwap, upper1: vwap + sd, lower1: vwap - sd, upper2: vwap + 2 * sd, lower2: vwap - 2 * sd });
    }
    return result;
  },
};

// ─── Task Handlers ─────────────────────────────────────────────

const taskHandlers = {
  indicator(task) {
    const fn = indicators[task.indicator];
    if (!fn) throw new Error(`Unknown indicator: ${task.indicator}`);
    return fn(task.data, task.params?.period || undefined, task.params?.multiplier || undefined);
  },

  volumeProfile(task) {
    const { candles, tickSize: requestedTickSize, valueAreaPct = 0.70 } = task;
    if (!candles?.length) return null;

    const tickSize = requestedTickSize || autoTickSize(candles[0].close);
    const profile = new Map();
    let totalVolume = 0;

    for (const c of candles) {
      const tp = (c.high + c.low + c.close) / 3;
      const vol = c.volume || 1;
      const closeWeight = vol * 0.6;
      const rangeWeight = vol * 0.4;
      const range = c.high - c.low;
      const steps = Math.max(1, Math.round(range / tickSize));

      // Close-weighted volume at typical price
      const bucket = Math.round(tp / tickSize) * tickSize;
      const entry = profile.get(bucket) || { buyVol: 0, sellVol: 0, totalVol: 0 };
      const isBullish = c.close > c.open;
      if (isBullish) entry.buyVol += closeWeight; else entry.sellVol += closeWeight;
      entry.totalVol += closeWeight;
      profile.set(bucket, entry);

      // Distribute range volume
      for (let s = 0; s < steps; s++) {
        const price = Math.round((c.low + (s / steps) * range) / tickSize) * tickSize;
        const e = profile.get(price) || { buyVol: 0, sellVol: 0, totalVol: 0 };
        const stepVol = rangeWeight / steps;
        if (isBullish) e.buyVol += stepVol; else e.sellVol += stepVol;
        e.totalVol += stepVol;
        profile.set(price, e);
      }

      totalVolume += vol;
    }

    // Convert to sorted array + compute POC and value area
    const levels = [...profile.entries()]
      .map(([price, data]) => ({ price, ...data }))
      .sort((a, b) => a.price - b.price);

    let maxVol = 0, pocPrice = 0;
    for (const l of levels) {
      if (l.totalVol > maxVol) { maxVol = l.totalVol; pocPrice = l.price; }
    }

    return { levels, poc: pocPrice, tickSize, totalVolume };
  },

  correlation(task) {
    const { priceMap } = task;
    const symbols = Object.keys(priceMap);
    const n = symbols.length;
    const matrix = Array.from({ length: n }, () => Array(n).fill(0));
    const returnsMap = {};

    for (const sym of symbols) {
      const prices = priceMap[sym];
      returnsMap[sym] = [];
      for (let i = 1; i < prices.length; i++) {
        returnsMap[sym].push((prices[i] - prices[i - 1]) / prices[i - 1]);
      }
    }

    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1;
      for (let j = i + 1; j < n; j++) {
        const ri = returnsMap[symbols[i]];
        const rj = returnsMap[symbols[j]];
        const len = Math.min(ri.length, rj.length);
        const corr = pearsonCorrelation(ri.slice(-len), rj.slice(-len));
        matrix[i][j] = Math.round(corr * 1000) / 1000;
        matrix[j][i] = matrix[i][j];
      }
    }

    return { matrix, symbols };
  },

  volatility(task) {
    const { closes, period = 20, tradingDays = 252 } = task;
    if (!closes || closes.length < period + 1) return null;

    const logReturns = [];
    for (let i = 1; i < closes.length; i++) {
      logReturns.push(Math.log(closes[i] / closes[i - 1]));
    }

    const recent = logReturns.slice(-period);
    const vol = stddev(recent) * Math.sqrt(tradingDays);
    return { volatility: Math.round(vol * 10000) / 10000, volatilityPct: Math.round(vol * 10000) / 100 };
  },
};

function autoTickSize(price) {
  if (price >= 10000) return 10;
  if (price >= 1000) return 1;
  if (price >= 100) return 0.5;
  if (price >= 10) return 0.1;
  if (price >= 1) return 0.01;
  return 0.0001;
}

// ─── Main task dispatcher (used by both Worker mode and fallback) ──

export function computeTask(task) {
  const handler = taskHandlers[task.type];
  if (!handler) throw new Error(`Unknown task type: ${task.type}`);
  return handler(task);
}

// ─── Worker Message Handler ────────────────────────────────────

if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
  self.onmessage = (event) => {
    const task = event.data;
    try {
      const result = computeTask(task);
      self.postMessage({ type: 'result', taskId: task.taskId, data: result });
    } catch (err) {
      self.postMessage({ type: 'error', taskId: task.taskId, error: err.message });
    }
  };
}
