// ═══════════════════════════════════════════════════════════════════
// charEdge — WASM Indicator Bridge
//
// Lazy-initializes the charedge-wasm module and provides
// indicator functions with automatic JS fallback.
//
// Usage in Web Workers:
//   import { wasmReady, wasmSMA, wasmEMA, ... } from './wasmBridge.js';
//   await wasmReady;  // ensure WASM is loaded
//   const result = wasmSMA(closeArray, 20);
// ═══════════════════════════════════════════════════════════════════

let wasmModule = null;
let initPromise = null;

/**
 * Initialize the WASM module. Safe to call multiple times.
 * Returns a promise that resolves when WASM is ready (or rejects on failure).
 */
function initWasm() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Dynamic import of the wasm-pack generated module
      const wasm = await import(/* @vite-ignore */ '../../../wasm/pkg/charedge_wasm.js');
      await wasm.default();
      wasmModule = wasm;
      return true;
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_err) {
      wasmModule = null;
      return false;
    }
  })();

  return initPromise;
}

/** Promise that resolves when WASM is ready (or falls back to JS). */
export const wasmReady = initWasm();

/** Check if WASM is available. */
export function isWasmAvailable() {
  return wasmModule !== null;
}

// ─── SMA ────────────────────────────────────────────────────────

/**
 * Compute SMA via WASM.
 * @param {Float64Array} close
 * @param {number} period
 * @returns {Float64Array}
 */
export function wasmSMA(close, period) {
  if (!wasmModule) return null;
  return wasmModule.wasm_sma(close, period);
}

// ─── EMA ────────────────────────────────────────────────────────

/**
 * Compute EMA via WASM.
 * @param {Float64Array} close
 * @param {number} period
 * @returns {Float64Array}
 */
export function wasmEMA(close, period) {
  if (!wasmModule) return null;
  return wasmModule.wasm_ema(close, period);
}

// ─── RSI ────────────────────────────────────────────────────────

/**
 * Compute RSI via WASM.
 * @param {Float64Array} close
 * @param {number} period
 * @returns {Float64Array}
 */
export function wasmRSI(close, period) {
  if (!wasmModule) return null;
  return wasmModule.wasm_rsi(close, period);
}

// ─── Bollinger Bands ────────────────────────────────────────────

/**
 * Compute Bollinger Bands via WASM.
 * @param {Float64Array} close
 * @param {number} period
 * @param {number} multiplier
 * @returns {{ upper: Float64Array, middle: Float64Array, lower: Float64Array }}
 */
export function wasmBollinger(close, period, multiplier) {
  if (!wasmModule) return null;
  const flat = wasmModule.wasm_bollinger(close, period, multiplier);
  const n = close.length;
  return {
    upper: flat.slice(0, n),
    middle: flat.slice(n, n * 2),
    lower: flat.slice(n * 2, n * 3),
  };
}

// ─── MACD ───────────────────────────────────────────────────────

/**
 * Compute MACD via WASM.
 * @param {Float64Array} close
 * @param {number} fast
 * @param {number} slow
 * @param {number} signal
 * @returns {{ macd: Float64Array, signal: Float64Array, histogram: Float64Array }}
 */
export function wasmMACD(close, fast, slow, signal) {
  if (!wasmModule) return null;
  const flat = wasmModule.wasm_macd(close, fast, slow, signal);
  const n = close.length;
  return {
    macd: flat.slice(0, n),
    signal: flat.slice(n, n * 2),
    histogram: flat.slice(n * 2, n * 3),
  };
}

// ─── ATR ────────────────────────────────────────────────────────

/**
 * Compute ATR via WASM.
 * @param {Float64Array} high
 * @param {Float64Array} low
 * @param {Float64Array} close
 * @param {number} period
 * @returns {Float64Array}
 */
export function wasmATR(high, low, close, period) {
  if (!wasmModule) return null;
  return wasmModule.wasm_atr(high, low, close, period);
}
