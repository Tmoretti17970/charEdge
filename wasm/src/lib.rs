// ═══════════════════════════════════════════════════════════════════
// charEdge WASM — Entry Point (lib.rs)
//
// wasm_bindgen exports for all technical indicators.
// Input/output: Float64Array via js_sys for zero-copy interop.
// ═══════════════════════════════════════════════════════════════════

mod sma;
mod ema;
mod rsi;
mod bollinger;
mod macd;
mod atr;
mod patterns;
mod transforms;

use wasm_bindgen::prelude::*;
use js_sys::Float64Array;

// ─── Helpers ───────────────────────────────────────────────────

/// Convert a Float64Array to a Rust Vec<f64>.
fn js_to_vec(arr: &Float64Array) -> Vec<f64> {
    let mut v = vec![0.0_f64; arr.length() as usize];
    arr.copy_to(&mut v);
    v
}

/// Convert a Vec<f64> to a Float64Array.
fn vec_to_js(v: &[f64]) -> Float64Array {
    let arr = Float64Array::new_with_length(v.len() as u32);
    arr.copy_from(v);
    arr
}

// ─── Exports ────────────────────────────────────────────────────

/// Compute Simple Moving Average.
/// Returns Float64Array with NaN for warm-up indices.
#[wasm_bindgen]
pub fn wasm_sma(close: &Float64Array, period: u32) -> Float64Array {
    let data = js_to_vec(close);
    let result = sma::compute_sma(&data, period as usize);
    vec_to_js(&result)
}

/// Compute Exponential Moving Average.
/// Returns Float64Array with NaN for warm-up indices.
#[wasm_bindgen]
pub fn wasm_ema(close: &Float64Array, period: u32) -> Float64Array {
    let data = js_to_vec(close);
    let result = ema::compute_ema(&data, period as usize);
    vec_to_js(&result)
}

/// Compute Relative Strength Index (Wilder's smoothing).
/// Returns Float64Array with values in [0, 100], NaN for warm-up.
#[wasm_bindgen]
pub fn wasm_rsi(close: &Float64Array, period: u32) -> Float64Array {
    let data = js_to_vec(close);
    let result = rsi::compute_rsi(&data, period as usize);
    vec_to_js(&result)
}

/// Compute Bollinger Bands.
/// Returns a flat Float64Array of length 3*n: [upper..., middle..., lower...].
/// Caller must split by n to get each band.
#[wasm_bindgen]
pub fn wasm_bollinger(close: &Float64Array, period: u32, multiplier: f64) -> Float64Array {
    let data = js_to_vec(close);
    let result = bollinger::compute_bollinger(&data, period as usize, multiplier);
    let n = data.len();
    let mut flat = Vec::with_capacity(n * 3);
    flat.extend_from_slice(&result.upper);
    flat.extend_from_slice(&result.middle);
    flat.extend_from_slice(&result.lower);
    vec_to_js(&flat)
}

/// Compute MACD.
/// Returns a flat Float64Array of length 3*n: [macd..., signal..., histogram...].
/// Caller must split by n to get each line.
#[wasm_bindgen]
pub fn wasm_macd(close: &Float64Array, fast: u32, slow: u32, signal: u32) -> Float64Array {
    let data = js_to_vec(close);
    let result = macd::compute_macd(&data, fast as usize, slow as usize, signal as usize);
    let n = data.len();
    let mut flat = Vec::with_capacity(n * 3);
    flat.extend_from_slice(&result.macd);
    flat.extend_from_slice(&result.signal);
    flat.extend_from_slice(&result.histogram);
    vec_to_js(&flat)
}

/// Compute Average True Range (Wilder's smoothing).
/// Requires parallel high/low/close Float64Arrays.
/// Returns Float64Array with NaN for warm-up indices.
#[wasm_bindgen]
pub fn wasm_atr(high: &Float64Array, low: &Float64Array, close: &Float64Array, period: u32) -> Float64Array {
    let h = js_to_vec(high);
    let l = js_to_vec(low);
    let c = js_to_vec(close);
    let result = atr::compute_atr(&h, &l, &c, period as usize);
    vec_to_js(&result)
}
