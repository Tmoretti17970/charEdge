// ═══════════════════════════════════════════════════════════════════
// charEdge v17 — Streaming Indicator Worker
//
// Dedicated Web Worker for real-time streaming indicator computations.
// Receives individual ticks via postMessage and computes running EMA,
// RSI, MACD, Bollinger, OBV, VWAP incrementally (O(1) per tick).
//
// Protocol:
//   IN:  { type: 'activate', symbol, indicators: [...] }
//   IN:  { type: 'tick', symbol, price, volume, time }
//   IN:  { type: 'tickBatch', symbol, ticks: [...] }
//   IN:  { type: 'deactivate', symbol }
//   IN:  { type: 'getValues', symbol, requestId }
//   OUT: { type: 'values', symbol, values: {...} }
//   OUT: { type: 'response', requestId, values: {...} }
// ═══════════════════════════════════════════════════════════════════

// ─── Running Indicator Classes ─────────────────────────────────

class RunningEMA {
  constructor(period) { this.period = period; this.k = 2 / (period + 1); this.value = null; this.count = 0; this.sum = 0; }
  update(price) {
    this.count++;
    if (this.value === null) { this.sum += price; if (this.count >= this.period) this.value = this.sum / this.period; }
    else { this.value = price * this.k + this.value * (1 - this.k); }
    return this.value;
  }
}

class RunningSMA {
  constructor(period) { this.period = period; this.window = []; this.sum = 0; this.value = null; }
  update(price) {
    this.window.push(price); this.sum += price;
    if (this.window.length > this.period) this.sum -= this.window.shift();
    this.value = this.window.length >= this.period ? this.sum / this.period : null;
    return this.value;
  }
}

class RunningRSI {
  constructor(period = 14) { this.period = period; this.avgGain = 0; this.avgLoss = 0; this.prevPrice = null; this.count = 0; this.value = null; }
  update(price) {
    if (this.prevPrice === null) { this.prevPrice = price; return null; }
    const change = price - this.prevPrice; this.prevPrice = price;
    const gain = change > 0 ? change : 0, loss = change < 0 ? -change : 0;
    this.count++;
    if (this.count <= this.period) {
      this.avgGain += gain / this.period; this.avgLoss += loss / this.period;
      if (this.count === this.period) { const rs = this.avgLoss === 0 ? 100 : this.avgGain / this.avgLoss; this.value = 100 - 100 / (1 + rs); }
    } else {
      this.avgGain = (this.avgGain * (this.period - 1) + gain) / this.period;
      this.avgLoss = (this.avgLoss * (this.period - 1) + loss) / this.period;
      const rs = this.avgLoss === 0 ? 100 : this.avgGain / this.avgLoss; this.value = 100 - 100 / (1 + rs);
    }
    return this.value;
  }
}

class RunningMACD {
  constructor(f = 12, s = 26, sig = 9) { this.fastEMA = new RunningEMA(f); this.slowEMA = new RunningEMA(s); this.signalEMA = new RunningEMA(sig); this.value = { macd: null, signal: null, histogram: null }; }
  update(price) {
    const f = this.fastEMA.update(price), s = this.slowEMA.update(price);
    if (f !== null && s !== null) { const m = f - s; const sig = this.signalEMA.update(m); this.value = { macd: Math.round(m * 1e6) / 1e6, signal: sig != null ? Math.round(sig * 1e6) / 1e6 : null, histogram: sig != null ? Math.round((m - sig) * 1e6) / 1e6 : null }; }
    return this.value;
  }
}

class RunningBollinger {
  constructor(period = 20, mult = 2) { this.sma = new RunningSMA(period); this.period = period; this.mult = mult; this.window = []; this.value = { upper: null, middle: null, lower: null }; }
  update(price) {
    const mid = this.sma.update(price); this.window.push(price); if (this.window.length > this.period) this.window.shift();
    if (mid !== null && this.window.length >= this.period) { let v = 0; for (const x of this.window) v += (x - mid) ** 2; const sd = Math.sqrt(v / this.window.length); this.value = { upper: Math.round((mid + this.mult * sd) * 100) / 100, middle: Math.round(mid * 100) / 100, lower: Math.round((mid - this.mult * sd) * 100) / 100 }; }
    return this.value;
  }
}

class RunningOBV {
  constructor() { this.value = 0; this.prevPrice = null; }
  update(price, volume) { if (this.prevPrice !== null) { if (price > this.prevPrice) this.value += volume; else if (price < this.prevPrice) this.value -= volume; } this.prevPrice = price; return this.value; }
}

class RunningVWAP {
  constructor() { this.cumPV = 0; this.cumVol = 0; this.value = 0; this.dayStart = 0; }
  update(price, volume, time) { const d = Math.floor(time / 86400000); if (d !== this.dayStart) { this.cumPV = 0; this.cumVol = 0; this.dayStart = d; } this.cumPV += price * volume; this.cumVol += volume; this.value = this.cumVol > 0 ? this.cumPV / this.cumVol : price; return Math.round(this.value * 100) / 100; }
}

class RunningATR {
  constructor(period = 14) { this.period = period; this.prevClose = null; this.count = 0; this.value = null; this.sum = 0; }
  updateCandle(h, l, c) { let tr; if (this.prevClose === null) tr = h - l; else tr = Math.max(h - l, Math.abs(h - this.prevClose), Math.abs(l - this.prevClose)); this.prevClose = c; this.count++; if (this.count <= this.period) { this.sum += tr; if (this.count === this.period) this.value = this.sum / this.period; } else if (this.value !== null) { this.value = (this.value * (this.period - 1) + tr) / this.period; } return this.value; }
}

// ─── Factory ───────────────────────────────────────────────────

const F = {
  ema: (p) => new RunningEMA(p?.period || 20),
  sma: (p) => new RunningSMA(p?.period || 20),
  rsi: (p) => new RunningRSI(p?.period || 14),
  macd: (p) => new RunningMACD(p?.fast || 12, p?.slow || 26, p?.signal || 9),
  bollinger: (p) => new RunningBollinger(p?.period || 20, p?.multiplier || 2),
  atr: (p) => new RunningATR(p?.period || 14),
  obv: () => new RunningOBV(),
  vwap: () => new RunningVWAP(),
};

// ─── State ─────────────────────────────────────────────────────

const symbols = new Map();
const emitCounters = new Map();
const EMIT_EVERY = 5;

function processTick(sym, price, volume, time) {
  const state = symbols.get(sym);
  if (!state) return null;
  for (const [, entry] of state.indicators) {
    const inst = entry.instance;
    if (inst instanceof RunningVWAP) entry.lastValue = inst.update(price, volume, time || Date.now());
    else if (inst instanceof RunningOBV) entry.lastValue = inst.update(price, volume);
    else if (inst instanceof RunningATR) entry.lastValue = inst.updateCandle(price, price, price);
    else if (inst.update) entry.lastValue = inst.update(price);
  }
  return getValues(sym);
}

function getValues(sym) {
  const state = symbols.get(sym);
  if (!state) return {};
  const v = {};
  for (const [key, entry] of state.indicators) v[key] = entry.lastValue;
  return v;
}

// ─── Message Handler ───────────────────────────────────────────

self.onmessage = (event) => {
  const msg = event.data;
  switch (msg.type) {
    case 'activate': {
      const sym = (msg.symbol || '').toUpperCase();
      if (!symbols.has(sym)) symbols.set(sym, { indicators: new Map() });
      const state = symbols.get(sym);
      for (const ind of (msg.indicators || [])) {
        const name = typeof ind === 'string' ? ind : ind.name;
        const params = typeof ind === 'string' ? {} : ind;
        const key = typeof ind === 'string' ? ind : `${ind.name}_${ind.period || ''}`;
        if (!state.indicators.has(key) && F[name]) state.indicators.set(key, { name, instance: F[name](params), lastValue: null });
      }
      break;
    }
    case 'tick': {
      const sym = (msg.symbol || '').toUpperCase();
      const values = processTick(sym, msg.price, msg.volume, msg.time);
      if (values) {
        const count = (emitCounters.get(sym) || 0) + 1;
        emitCounters.set(sym, count);
        if (count % EMIT_EVERY === 0) self.postMessage({ type: 'values', symbol: sym, values });
      }
      break;
    }
    case 'tickBatch': {
      const sym = (msg.symbol || '').toUpperCase();
      let values;
      for (const t of (msg.ticks || [])) values = processTick(sym, t.price, t.volume, t.time);
      if (values) self.postMessage({ type: 'values', symbol: sym, values });
      break;
    }
    case 'getValues': {
      self.postMessage({ type: 'response', requestId: msg.requestId, values: getValues((msg.symbol || '').toUpperCase()) });
      break;
    }
    case 'deactivate': {
      const sym = (msg.symbol || '').toUpperCase();
      symbols.delete(sym);
      emitCounters.delete(sym);
      break;
    }
  }
};

self.postMessage({ type: 'ready' });
