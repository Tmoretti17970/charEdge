// ═══════════════════════════════════════════════════════════════════
// charEdge — IndicatorWorker
//
// Dedicated Web Worker for computing technical indicators.
// Runs CPU-bound math (SMA, EMA, RSI, MACD, Bollinger Bands, etc.)
// off the main thread using typed arrays for maximum throughput.
//
// Message Types (Main → Worker):
//   'compute'   — Compute indicators on provided bar data
//   'dispose'   — Clean up
//
// Message Types (Worker → Main):
//   'result'    — Computed indicator values
// ═══════════════════════════════════════════════════════════════════

self.onmessage = function(e) {
  const { type, payload } = e.data;

  switch (type) {
    case 'compute':
      handleCompute(payload);
      break;
    case 'dispose':
      break;
  }
};

function handleCompute(payload) {
  const { indicators, barData } = payload;
  const results = {};

  const close = new Float64Array(barData.close);
  const high = new Float64Array(barData.high);
  const low = new Float64Array(barData.low);
  const length = barData.length;

  for (const ind of indicators) {
    try {
      results[ind.id] = computeIndicator(ind, close, high, low, length);
    } catch (err) {
      results[ind.id] = { error: err.message };
    }
  }

  self.postMessage({ type: 'result', payload: results });
}

// ─── Indicator Computations ─────────────────────────────────────

function computeIndicator(ind, close, high, low, length) {
  switch (ind.type) {
    case 'sma': return computeSMA(close, length, ind.period || 20);
    case 'ema': return computeEMA(close, length, ind.period || 20);
    case 'rsi': return computeRSI(close, length, ind.period || 14);
    case 'macd': return computeMACD(close, length, ind.fast || 12, ind.slow || 26, ind.signal || 9);
    case 'bollinger': return computeBollinger(close, length, ind.period || 20, ind.stdDev || 2);
    case 'atr': return computeATR(high, low, close, length, ind.period || 14);
    case 'vwap': return { values: new Float64Array(length) }; // placeholder
    default: return { values: new Float64Array(length) };
  }
}

// ─── SMA ──────────────────────────────────────────────────────

function computeSMA(close, length, period) {
  const values = new Float64Array(length);
  if (length < period) return { values };

  let sum = 0;
  for (let i = 0; i < period; i++) sum += close[i];
  values[period - 1] = sum / period;

  for (let i = period; i < length; i++) {
    sum += close[i] - close[i - period];
    values[i] = sum / period;
  }

  // Fill initial NaN values
  for (let i = 0; i < period - 1; i++) values[i] = NaN;

  return { values };
}

// ─── EMA ──────────────────────────────────────────────────────

function computeEMA(close, length, period) {
  const values = new Float64Array(length);
  if (length < period) return { values };

  const k = 2 / (period + 1);

  // Seed with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) sum += close[i];
  values[period - 1] = sum / period;

  for (let i = period; i < length; i++) {
    values[i] = close[i] * k + values[i - 1] * (1 - k);
  }

  for (let i = 0; i < period - 1; i++) values[i] = NaN;

  return { values };
}

// ─── RSI ──────────────────────────────────────────────────────

function computeRSI(close, length, period) {
  const values = new Float64Array(length);
  if (length < period + 1) return { values };

  let avgGain = 0, avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = close[i] - close[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  values[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < length; i++) {
    const change = close[i] - close[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    values[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }

  for (let i = 0; i < period; i++) values[i] = NaN;

  return { values };
}

// ─── MACD ─────────────────────────────────────────────────────

function computeMACD(close, length, fastPeriod, slowPeriod, signalPeriod) {
  const fast = computeEMA(close, length, fastPeriod).values;
  const slow = computeEMA(close, length, slowPeriod).values;
  const macdLine = new Float64Array(length);
  const signalLine = new Float64Array(length);
  const histogram = new Float64Array(length);

  for (let i = 0; i < length; i++) {
    macdLine[i] = fast[i] - slow[i];
  }

  // Signal line = EMA of MACD line
  const k = 2 / (signalPeriod + 1);
  let seed = 0, count = 0;
  for (let i = slowPeriod - 1; i < slowPeriod - 1 + signalPeriod && i < length; i++) {
    if (!isNaN(macdLine[i])) { seed += macdLine[i]; count++; }
  }
  const signalStart = slowPeriod - 1 + signalPeriod - 1;
  if (count > 0 && signalStart < length) {
    signalLine[signalStart] = seed / count;
    for (let i = signalStart + 1; i < length; i++) {
      signalLine[i] = macdLine[i] * k + signalLine[i - 1] * (1 - k);
    }
  }

  for (let i = 0; i < length; i++) {
    histogram[i] = macdLine[i] - signalLine[i];
  }

  for (let i = 0; i < signalStart; i++) {
    signalLine[i] = NaN;
    histogram[i] = NaN;
  }
  for (let i = 0; i < slowPeriod - 1; i++) macdLine[i] = NaN;

  return { macd: macdLine, signal: signalLine, histogram };
}

// ─── Bollinger Bands ──────────────────────────────────────────

function computeBollinger(close, length, period, stdDevMultiplier) {
  const middle = computeSMA(close, length, period).values;
  const upper = new Float64Array(length);
  const lower = new Float64Array(length);

  for (let i = period - 1; i < length; i++) {
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = close[j] - middle[i];
      sumSq += diff * diff;
    }
    const stdDev = Math.sqrt(sumSq / period);
    upper[i] = middle[i] + stdDev * stdDevMultiplier;
    lower[i] = middle[i] - stdDev * stdDevMultiplier;
  }

  for (let i = 0; i < period - 1; i++) {
    upper[i] = NaN;
    lower[i] = NaN;
  }

  return { upper, middle, lower };
}

// ─── ATR ──────────────────────────────────────────────────────

function computeATR(high, low, close, length, period) {
  const tr = new Float64Array(length);
  const values = new Float64Array(length);

  tr[0] = high[0] - low[0];
  for (let i = 1; i < length; i++) {
    tr[i] = Math.max(
      high[i] - low[i],
      Math.abs(high[i] - close[i - 1]),
      Math.abs(low[i] - close[i - 1])
    );
  }

  // Initial ATR = SMA of first 'period' TR values
  let sum = 0;
  for (let i = 0; i < Math.min(period, length); i++) sum += tr[i];
  if (period <= length) {
    values[period - 1] = sum / period;
    for (let i = period; i < length; i++) {
      values[i] = (values[i - 1] * (period - 1) + tr[i]) / period;
    }
  }

  for (let i = 0; i < period - 1; i++) values[i] = NaN;

  return { values };
}
