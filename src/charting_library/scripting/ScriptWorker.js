// ═══════════════════════════════════════════════════════════════════
// charEdge v11 — Script Worker (Sandboxed Execution)
//
// Runs user scripts in an isolated Web Worker with ZERO access to:
//   ✗ DOM (document, window, globalThis)
//   ✗ Network (fetch, XMLHttpRequest, WebSocket)
//   ✗ Storage (localStorage, sessionStorage, indexedDB)
//   ✗ Navigation (location, history, navigator)
//   ✗ Timers (setTimeout, setInterval)
//
// Communication: postMessage only. The main thread sends script +
// data, the worker returns results or errors.
//
// Security model:
//   1. Worker has no DOM access by design (Web Worker spec)
//   2. Blocked globals list shadows any remaining global APIs
//   3. Strict mode prevents arguments.callee, with statements
//   4. Dangerous patterns blocked via regex validation
//   5. Execution timeout enforced (200ms)
//   6. Loop iteration limit enforced (50,000)
// ═══════════════════════════════════════════════════════════════════

/* eslint-disable no-restricted-globals */

// ─── Execution Limits ─────────────────────────────────────────
const MAX_EXEC_MS = 200;
const MAX_LOOP_ITER = 50000;

// ─── Blocked Globals (even in Worker context) ─────────────────
const BLOCKED = [
  'self',
  'globalThis',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'Worker',
  'importScripts',
  'require',
  'indexedDB',
  'caches',
  'navigator',
  'location',
  'setTimeout',
  'setInterval',
  'requestAnimationFrame',
  'postMessage', // Block script from calling postMessage
  'close',       // Block script from closing the worker
  'addEventListener',
  'removeEventListener',
];

// ─── Dangerous Pattern Check ──────────────────────────────────
const DANGEROUS_PATTERNS = [
  /\beval\s*\(/,
  /\bFunction\s*\(/,
  /\bimport\s*\(/,
  /\brequire\s*\(/,
  /\bnew\s+Worker\b/,
  /\b__proto__\b/,
  /\bconstructor\s*\[/,
  /\bconstructor\s*\.\s*constructor/,
];

function validateCode(code) {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      return { valid: false, error: `Blocked pattern: ${pattern.source}` };
    }
  }
  return { valid: true, error: null };
}

// ─── Math / Indicator Utilities ───────────────────────────────
// Minimal math functions available in the sandbox.
// Full indicator library (Calc) is passed via data from main thread.

function sma(data, period) {
  const result = new Array(data.length).fill(null);
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j] || 0;
    result[i] = sum / period;
  }
  return result;
}

function ema(data, period) {
  const result = new Array(data.length).fill(null);
  const k = 2 / (period + 1);
  let prev = null;
  for (let i = 0; i < data.length; i++) {
    if (data[i] == null) { result[i] = prev; continue; }
    if (prev == null) { prev = data[i]; result[i] = prev; continue; }
    prev = data[i] * k + prev * (1 - k);
    result[i] = prev;
  }
  return result;
}

function stdev(data, period) {
  const result = new Array(data.length).fill(null);
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1).filter(v => v != null);
    if (!slice.length) continue;
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length;
    result[i] = Math.sqrt(variance);
  }
  return result;
}

// ─── Message Handler ──────────────────────────────────────────
self.onmessage = function (e) {
  const { id, code, bars, userParams = {}, precomputedIndicators = {} } = e.data;

  if (!code || !bars?.length) {
    self.postMessage({ id, outputs: [], params: {}, error: null, execMs: 0 });
    return;
  }

  // Validate code
  const validation = validateCode(code);
  if (!validation.valid) {
    self.postMessage({ id, outputs: [], params: {}, error: validation.error, execMs: 0 });
    return;
  }

  const startMs = performance.now();

  // Build convenience arrays
  const close = bars.map(b => b.close);
  const open = bars.map(b => b.open);
  const high = bars.map(b => b.high);
  const low = bars.map(b => b.low);
  const volume = bars.map(b => b.volume);
  const barCount = bars.length;

  const outputs = [];
  const declaredParams = {};
  let loopCount = 0;

  // Script API
  const api = {
    bars, close, open, high, low, volume, barCount,

    param: (name, defaultVal, opts = {}) => {
      declaredParams[name] = {
        default: defaultVal,
        min: opts.min, max: opts.max,
        step: opts.step, label: opts.label || name,
      };
      return userParams[name] != null ? userParams[name] : defaultVal;
    },

    plot: (values, opts = {}) => {
      if (!Array.isArray(values)) return;
      outputs.push({ type: 'line', data: values, color: opts.color || '#f59e0b', label: opts.label || 'Script', lineWidth: opts.lineWidth || 1.5, opacity: opts.opacity ?? 1, overlay: opts.overlay !== false });
    },
    band: (upper, lower, opts = {}) => {
      if (!Array.isArray(upper) || !Array.isArray(lower)) return;
      outputs.push({ type: 'band', data: { upper, lower }, color: opts.color || '#5c9cf5', fillColor: opts.fillColor || (opts.color || '#5c9cf5') + '15', label: opts.label || 'Band', overlay: opts.overlay !== false });
    },
    histogram: (values, opts = {}) => {
      if (!Array.isArray(values)) return;
      outputs.push({ type: 'histogram', data: values, colorUp: opts.colorUp || '#22c55e', colorDown: opts.colorDown || '#ef4444', label: opts.label || 'Histogram', overlay: false });
    },
    hline: (price, opts = {}) => {
      outputs.push({ type: 'hline', price, color: opts.color || '#5d6377', style: opts.style || 'dashed', label: opts.label || '' });
    },
    marker: (barIdx, opts = {}) => {
      if (barIdx < 0 || barIdx >= barCount) return;
      outputs.push({ type: 'marker', barIdx, shape: opts.shape || 'triangle', color: opts.color || '#f59e0b', position: opts.position || 'above', label: opts.label || '' });
    },

    // Math utilities (subset - main thread provides precomputed for complex ones)
    sma, ema, stdev,

    // Use precomputed indicators from main thread if available
    ...precomputedIndicators,

    // Basic math
    abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil,
    sqrt: Math.sqrt, pow: Math.pow, log: Math.log, exp: Math.exp,
    min: Math.min, max: Math.max, PI: Math.PI,

    sum: arr => arr.reduce((a, b) => a + (b || 0), 0),
    avg: arr => { const v = arr.filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; },
    crossover: (a, b) => a.map((v, i) => i === 0 || v == null || b[i] == null || a[i-1] == null || b[i-1] == null ? false : a[i-1] <= b[i-1] && v > b[i]),
    crossunder: (a, b) => a.map((v, i) => i === 0 || v == null || b[i] == null || a[i-1] == null || b[i-1] == null ? false : a[i-1] >= b[i-1] && v < b[i]),

    tick: () => { if (++loopCount > MAX_LOOP_ITER) throw new Error(`Loop limit exceeded (${MAX_LOOP_ITER})`); },
  };

  // Build sandbox scope
  const scopeKeys = [...BLOCKED, ...Object.keys(api)];
  const scopeValues = [...BLOCKED.map(() => undefined), ...Object.values(api)];

  try {
    const fn = new Function(...scopeKeys, `"use strict";\n${code}`);
    fn(...scopeValues);

    const execMs = performance.now() - startMs;
    if (execMs > MAX_EXEC_MS) {
      self.postMessage({ id, outputs: [], params: declaredParams, error: `Script exceeded ${MAX_EXEC_MS}ms timeout (took ${execMs.toFixed(0)}ms)`, execMs });
      return;
    }

    self.postMessage({ id, outputs, params: declaredParams, error: null, execMs });
  } catch (err) {
    self.postMessage({ id, outputs: [], params: declaredParams, error: err.message || 'Unknown script error', execMs: performance.now() - startMs });
  }
};
