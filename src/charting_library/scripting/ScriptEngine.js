// ═══════════════════════════════════════════════════════════════════
// charEdge v11 — Script Engine
//
// Sandboxed JavaScript executor for user-defined indicators.
// Scripts receive OHLCV data + math primitives and return plot
// commands that integrate with the chart renderer.
//
// Security Architecture:
//   PRIMARY:   Web Worker sandbox (executeScriptAsync)
//              - Zero DOM/network/storage access by spec
//              - Blocked globals shadow remaining Worker APIs
//              - Timeout via AbortSignal + iteration limit
//
//   FALLBACK:  Inline sandbox (executeScript)
//              - new Function() with restricted scope
//              - Used when Worker unavailable (SSR, tests)
//              - Same blocked globals + pattern validation
//
// Script API:
//   Inputs:  bars[], close[], open[], high[], low[], volume[]
//   Math:    sma(), ema(), wma(), rsi(), atr(), stdev(), min(), max()
//   Output:  plot(values, opts), band(upper, lower, opts), hline(price, opts)
//   Params:  param(name, default) — declares configurable parameters
//
// Output shape (matches compInd result format):
//   { type: 'line'|'band'|'histogram', data: [...], color, label }
// ═══════════════════════════════════════════════════════════════════

import { Calc } from '../model/Calc.js';

// ─── Execution Limits ─────────────────────────────────────────
const MAX_EXEC_MS = 200; // Hard timeout
const MAX_LOOP_ITER = 50000; // Prevent infinite loops

// ─── Sandbox Blocked Globals ──────────────────────────────────
// These are explicitly set to undefined in the sandbox scope
// to prevent scripts from escaping the sandbox.
const BLOCKED = [
  'window',
  'document',
  'globalThis',
  'self',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'Worker',
  'importScripts',
  'require',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'navigator',
  'location',
  'history',
  'setTimeout',
  'setInterval',
  'requestAnimationFrame',
  'alert',
  'confirm',
  'prompt',
  'console',
  // P1: Additional globals that could leak data or bootstrap exploits
  'Blob',
  'URL',
  'TextEncoder',
  'TextDecoder',
  'FormData',
  'Headers',
  'Request',
  'Response',
  'AbortController',
  'BroadcastChannel',
  'MessageChannel',
  'crypto',
];
// Note: 'eval', 'arguments', 'Function', and 'import' are reserved in
// strict mode and can't be used as new Function() parameter names.
// The sandbox naturally blocks these: Function body code can't use
// import/export statements, and eval/Function are shadowed by the
// restricted scope chain.

// ─── Worker-based Sandbox (Primary) ──────────────────────────
let _worker = null;
let _msgId = 0;
const _pending = new Map(); // id → { resolve, reject, timer }

function _getWorker() {
  if (_worker) return _worker;
  try {
    _worker = new Worker(
      new URL('./ScriptWorker.js', import.meta.url),
      { type: 'module' }
    );
    _worker.onmessage = (e) => {
      const { id, ...result } = e.data;
      const entry = _pending.get(id);
      if (entry) {
        clearTimeout(entry.timer);
        _pending.delete(id);
        entry.resolve(result);
      }
    };
    _worker.onerror = (err) => {
      // Reject all pending with error
      for (const [_id, entry] of _pending) {
        clearTimeout(entry.timer);
        entry.resolve({ outputs: [], params: {}, error: `Worker error: ${err.message}`, execMs: 0 });
      }
      _pending.clear();
    };
    return _worker;
  } catch {
    // Worker not available (SSR, unsupported env)
    return null;
  }
}

/**
 * Execute a user script asynchronously in an isolated Web Worker.
 * PREFERRED method — provides true sandboxing via Worker isolation.
 *
 * @param {string} code - User's script source
 * @param {Object[]} bars - Array of { open, high, low, close, volume, time }
 * @param {Object} [userParams={}] - User-overridden parameter values
 * @returns {Promise<{ outputs: Array, params: Object, error: string|null, execMs: number }>}
 */
export function executeScriptAsync(code, bars, userParams = {}) {
  const worker = _getWorker();
  if (!worker) {
    // Fallback to synchronous inline sandbox
    return Promise.resolve(executeScript(code, bars, userParams));
  }

  const id = ++_msgId;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      _pending.delete(id);
      resolve({ outputs: [], params: {}, error: `Script timed out (>${MAX_EXEC_MS * 5}ms)`, execMs: MAX_EXEC_MS * 5 });
    }, MAX_EXEC_MS * 5); // Worker gets 5x the inline timeout as grace

    _pending.set(id, { resolve, timer });
    worker.postMessage({ id, code, bars, userParams });
  });
}

/**
 * Execute a user script synchronously (FALLBACK for SSR/tests).
 * Uses inline new Function() sandbox — less secure than Worker.
 *
 * @param {string} code - User's script source
 * @param {Object[]} bars - Array of { open, high, low, close, volume, time }
 * @param {Object} [userParams={}] - User-overridden parameter values
 * @returns {{ outputs: Array, params: Object, error: string|null, execMs: number }}
 */
export function executeScript(code, bars, userParams = {}) {
  const startMs = performance.now();

  if (!code || !bars?.length) {
    return { outputs: [], params: {}, error: null, execMs: 0 };
  }

  // Build convenience arrays
  const close = bars.map((b) => b.close);
  const open = bars.map((b) => b.open);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const volume = bars.map((b) => b.volume);
  const barCount = bars.length;

  // Collect outputs and declared params
  const outputs = [];
  const declaredParams = {};
  let loopCount = 0;

  // ─── Script API Functions ───────────────────────────────
  const api = {
    // Data access
    bars,
    close,
    open,
    high,
    low,
    volume,
    barCount,

    // Parameter declaration
    param: (name, defaultVal, opts = {}) => {
      declaredParams[name] = {
        default: defaultVal,
        min: opts.min,
        max: opts.max,
        step: opts.step,
        label: opts.label || name,
      };
      return userParams[name] != null ? userParams[name] : defaultVal;
    },

    // ─── Plot Commands ────────────────────────────────────
    plot: (values, opts = {}) => {
      if (!Array.isArray(values)) return;
      outputs.push({
        type: 'line',
        data: values,
        color: opts.color || '#f59e0b',
        label: opts.label || 'Script',
        lineWidth: opts.lineWidth || 1.5,
        opacity: opts.opacity ?? 1,
        overlay: opts.overlay !== false, // default: overlay on price
      });
    },

    band: (upper, lower, opts = {}) => {
      if (!Array.isArray(upper) || !Array.isArray(lower)) return;
      outputs.push({
        type: 'band',
        data: { upper, lower },
        color: opts.color || '#5c9cf5',
        fillColor: opts.fillColor || (opts.color || '#5c9cf5') + '15',
        label: opts.label || 'Band',
        overlay: opts.overlay !== false,
      });
    },

    histogram: (values, opts = {}) => {
      if (!Array.isArray(values)) return;
      outputs.push({
        type: 'histogram',
        data: values,
        colorUp: opts.colorUp || '#22c55e',
        colorDown: opts.colorDown || '#ef4444',
        label: opts.label || 'Histogram',
        overlay: false, // histograms go in sub-pane
      });
    },

    hline: (price, opts = {}) => {
      outputs.push({
        type: 'hline',
        price,
        color: opts.color || '#5d6377',
        style: opts.style || 'dashed', // solid, dashed, dotted
        label: opts.label || '',
      });
    },

    marker: (barIdx, opts = {}) => {
      if (barIdx < 0 || barIdx >= barCount) return;
      outputs.push({
        type: 'marker',
        barIdx,
        shape: opts.shape || 'triangle', // triangle, circle, diamond
        color: opts.color || '#f59e0b',
        position: opts.position || 'above', // above, below
        label: opts.label || '',
      });
    },

    // ─── Math Utilities ───────────────────────────────────
    sma: (data, period) => Calc.sma(data, period),
    ema: (data, period) => Calc.ema(data, period),
    wma: (data, period) => Calc.wma(data, period),
    rsi: (data, period) => Calc.rsi(data, period),
    atr: (ohlcvData, period) => Calc.atr(ohlcvData || bars, period),
    vwap: (ohlcvData) => Calc.vwap(ohlcvData || bars),
    bollinger: (data, period, mult) => Calc.bollinger(data, period, mult),
    macd: (data, fast, slow, signal) => Calc.macd(data, fast, slow, signal),
    stochastic: (ohlcvData, k, d) => Calc.stochastic(ohlcvData || bars, k, d),

    // Extended indicators
    dema: (data, period) => Calc.dema(data, period),
    tema: (data, period) => Calc.tema(data, period),
    hullma: (data, period) => Calc.hullma(data, period),
    adx: (ohlcvData, period) => Calc.adx(ohlcvData || bars, period),
    cci: (ohlcvData, period) => Calc.cci(ohlcvData || bars, period),
    mfi: (ohlcvData, period) => Calc.mfi(ohlcvData || bars, period),
    obv: (ohlcvData) => Calc.obv(ohlcvData || bars),
    williamsR: (ohlcvData, period) => Calc.williamsR(ohlcvData || bars, period),
    supertrend: (ohlcvData, period, mult) => Calc.supertrend(ohlcvData || bars, period, mult),
    ichimoku: (ohlcvData, t, k, sb, disp) => Calc.ichimoku(ohlcvData || bars, t, k, sb, disp),
    pivotPoints: (ohlcvData) => Calc.pivotPoints(ohlcvData || bars),
    heikinAshi: (ohlcvData) => Calc.heikinAshi(ohlcvData || bars),
    linearRegression: (data, period) => Calc.linearRegression(data, period),

    // New indicators
    keltner: (ohlcvData, emaPeriod, atrPeriod, mult) => Calc.keltner(ohlcvData || bars, emaPeriod, atrPeriod, mult),
    donchian: (ohlcvData, period) => Calc.donchian(ohlcvData || bars, period),
    vwma: (ohlcvData, period) => Calc.vwma(ohlcvData || bars, period),
    cmf: (ohlcvData, period) => Calc.cmf(ohlcvData || bars, period),
    roc: (data, period) => Calc.roc(data, period),

    // Array helpers (Pine Script-style)
    highest: (data, period) => Calc.highest(data, period),
    lowest: (data, period) => Calc.lowest(data, period),
    change: (data, lookback) => Calc.change(data, lookback),
    barssince: (condArr) => Calc.barssince(condArr),
    valuewhen: (condArr, srcArr, occurrence) => Calc.valuewhen(condArr, srcArr, occurrence),
    fillna: (data, fillValue) => Calc.fillna(data, fillValue),
    offset: (data, n) => Calc.offsetArr(data, n),

    // Basic math
    abs: Math.abs,
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil,
    sqrt: Math.sqrt,
    pow: Math.pow,
    log: Math.log,
    exp: Math.exp,
    min: Math.min,
    max: Math.max,
    PI: Math.PI,

    // Array helpers
    sum: (arr) => arr.reduce((a, b) => a + (b || 0), 0),
    avg: (arr) => {
      const valid = arr.filter((v) => v != null);
      return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
    },
    stdev: (arr, period) => Calc.stdev(arr, period),
    crossover: (a, b) => {
      // Returns boolean array: true when a crosses above b
      return a.map((v, i) => {
        if (i === 0 || v == null || b[i] == null || a[i - 1] == null || b[i - 1] == null) return false;
        return a[i - 1] <= b[i - 1] && v > b[i];
      });
    },
    crossunder: (a, b) => {
      return a.map((v, i) => {
        if (i === 0 || v == null || b[i] == null || a[i - 1] == null || b[i - 1] == null) return false;
        return a[i - 1] >= b[i - 1] && v < b[i];
      });
    },

    // Loop guard — scripts should call this in tight loops
    tick: () => {
      if (++loopCount > MAX_LOOP_ITER) {
        throw new Error(`Loop limit exceeded (${MAX_LOOP_ITER} iterations)`);
      }
    },
  };

  // ─── Build Sandbox Scope ────────────────────────────────
  const scopeKeys = [...BLOCKED, ...Object.keys(api)];
  const scopeValues = [...BLOCKED.map(() => undefined), ...Object.values(api)];

  try {
    // Construct the sandboxed function
    // The function receives all API items as arguments, blocking globals
    const fn = new Function(...scopeKeys, `"use strict";\n${code}`);

    // ── Freeze prototypes to prevent sandbox escape ──
    // Without this, user code can do ({}).constructor.constructor('return this')()
    // to escape the sandbox and access the global scope.
    const origObjProto = Object.getOwnPropertyDescriptors(Object.prototype);
    const origFuncProto = Object.getOwnPropertyDescriptors(Function.prototype);
    Object.freeze(Object.prototype);
    Object.freeze(Function.prototype);

    let execError = null;
    try {
      // Execute with timeout check
      const _timeoutAt = startMs + MAX_EXEC_MS;
      fn(...scopeValues);
    } catch (err) {
      execError = err;
    } finally {
      // ── Restore prototypes — MUST happen even if script throws ──
      // Unfreeze by re-defining original descriptors
      for (const [key, desc] of Object.entries(origObjProto)) {
        // eslint-disable-next-line unused-imports/no-unused-vars
        try { Object.defineProperty(Object.prototype, key, desc); } catch (_) { /* skip non-configurable */ }
      }
      for (const [key, desc] of Object.entries(origFuncProto)) {
        // eslint-disable-next-line unused-imports/no-unused-vars
        try { Object.defineProperty(Function.prototype, key, desc); } catch (_) { /* skip non-configurable */ }
      }
    }

    if (execError) throw execError;

    const execMs = performance.now() - startMs;

    if (execMs > MAX_EXEC_MS) {
      return {
        outputs: [],
        params: declaredParams,
        error: `Script exceeded ${MAX_EXEC_MS}ms timeout (took ${execMs.toFixed(0)}ms)`,
        execMs,
      };
    }

    return { outputs, params: declaredParams, error: null, execMs };
  } catch (err) {
    return {
      outputs: [],
      params: declaredParams,
      error: err.message || 'Unknown script error',
      execMs: performance.now() - startMs,
    };
  }
}

/**
 * Validate script source without executing it.
 * P3 E1: Uses acorn AST parsing for robust validation instead of regex.
 * Walks every node to detect dangerous patterns that regex can't catch
 * (e.g., string concat, Unicode escapes, bracket notation).
 *
 * @param {string} code
 * @returns {{ valid: boolean, error: string|null, violations: string[] }}
 */
export function validateScript(code) {
  if (!code?.trim()) return { valid: false, error: 'Script is empty', violations: [] };

  // ── Phase 1: Parse via acorn ─────────────────────────────
  let ast;
  try {
    // Dynamic import already bundled — acorn is a dependency
    // eslint-disable-next-line no-undef
    const acorn = require('acorn');
    ast = acorn.parse(code, {
      ecmaVersion: 2022,
      sourceType: 'script', // Not module — no import/export
      allowReturnOutsideFunction: true, // Script runs inside Function body
    });
  } catch (err) {
    return { valid: false, error: `Syntax error: ${err.message}`, violations: [] };
  }

  // ── Phase 2: Walk AST for violations ─────────────────────
  const BLOCKED_IDENTIFIERS = new Set([
    'eval', 'Function', 'import', 'require', 'fetch',
    'XMLHttpRequest', 'WebSocket', 'Worker', 'importScripts',
    'localStorage', 'sessionStorage', 'indexedDB',
    'document', 'window', 'globalThis', 'self',
    'navigator', 'location', 'history',
    'setTimeout', 'setInterval', 'requestAnimationFrame',
    'alert', 'confirm', 'prompt',
    'Blob', 'URL', 'TextEncoder', 'TextDecoder',
    'FormData', 'Headers', 'Request', 'Response',
    'AbortController', 'BroadcastChannel', 'MessageChannel', 'crypto',
  ]);

  const BLOCKED_PROPERTIES = new Set([
    '__proto__', 'constructor', 'prototype',
  ]);

  const violations = [];

  function walk(node) {
    if (!node || typeof node !== 'object') return;

    // ── Check node types ────────────────────────────────────
    switch (node.type) {
      // Call expressions: eval(), Function(), import(), require(), fetch()
      case 'CallExpression': {
        const callee = node.callee;
        if (callee.type === 'Identifier' && BLOCKED_IDENTIFIERS.has(callee.name)) {
          violations.push(`Blocked call: ${callee.name}()`);
        }
        // new Function()
        if (callee.type === 'MemberExpression') {
          const prop = _propName(callee);
          if (prop && BLOCKED_IDENTIFIERS.has(prop)) {
            violations.push(`Blocked member call: .${prop}()`);
          }
        }
        break;
      }

      // new expressions: new Worker(), new Function()
      case 'NewExpression': {
        const callee = node.callee;
        if (callee.type === 'Identifier' && BLOCKED_IDENTIFIERS.has(callee.name)) {
          violations.push(`Blocked constructor: new ${callee.name}()`);
        }
        break;
      }

      // Member expressions: obj.__proto__, obj.constructor.constructor
      case 'MemberExpression': {
        const prop = _propName(node);
        if (prop && BLOCKED_PROPERTIES.has(prop)) {
          violations.push(`Blocked property access: .${prop}`);
        }
        break;
      }

      // Import declarations/expressions (should not parse in 'script' mode, but guard)
      case 'ImportDeclaration':
      case 'ImportExpression':
        violations.push('Blocked: import statement');
        break;

      // Export declarations
      case 'ExportNamedDeclaration':
      case 'ExportDefaultDeclaration':
      case 'ExportAllDeclaration':
        violations.push('Blocked: export statement');
        break;

      // Meta property: import.meta
      case 'MetaProperty':
        if (node.meta?.name === 'import') {
          violations.push('Blocked: import.meta');
        }
        break;
    }

    // ── Recurse into child nodes ─────────────────────────────
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'start' || key === 'end') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object' && item.type) walk(item);
        }
      } else if (child && typeof child === 'object' && child.type) {
        walk(child);
      }
    }
  }

  /** Extract property name from MemberExpression (handles computed + literal) */
  function _propName(memberExpr) {
    if (!memberExpr.computed && memberExpr.property?.type === 'Identifier') {
      return memberExpr.property.name;
    }
    if (memberExpr.computed && memberExpr.property?.type === 'Literal') {
      return String(memberExpr.property.value);
    }
    return null;
  }

  walk(ast);

  if (violations.length > 0) {
    return {
      valid: false,
      error: `Security violation: ${violations[0]}`,
      violations,
    };
  }

  return { valid: true, error: null, violations: [] };
}

/**
 * Terminate the Worker and release resources.
 */
export function disposeScriptEngine() {
  if (_worker) {
    _worker.terminate();
    _worker = null;
    for (const [, entry] of _pending) {
      clearTimeout(entry.timer);
    }
    _pending.clear();
  }
}

export default { executeScript, executeScriptAsync, validateScript, disposeScriptEngine };
