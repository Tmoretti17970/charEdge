// ═══════════════════════════════════════════════════════════════════
// charEdge WASM — MACD (Moving Average Convergence Divergence)
//
// MACD line = EMA(fast) - EMA(slow)
// Signal line = EMA of MACD line (over signal period)
// Histogram = MACD - Signal
// ═══════════════════════════════════════════════════════════════════

use crate::ema::compute_ema;

/// MACD result: three parallel arrays.
pub struct MacdResult {
    pub macd: Vec<f64>,
    pub signal: Vec<f64>,
    pub histogram: Vec<f64>,
}

/// Compute MACD with given fast, slow, and signal periods.
/// Typical values: fast=12, slow=26, signal=9.
pub fn compute_macd(close: &[f64], fast: usize, slow: usize, signal: usize) -> MacdResult {
    let n = close.len();
    let mut macd_line = vec![f64::NAN; n];
    let mut signal_line = vec![f64::NAN; n];
    let mut histogram = vec![f64::NAN; n];

    if n < slow || slow == 0 || fast == 0 || signal == 0 {
        return MacdResult {
            macd: macd_line,
            signal: signal_line,
            histogram,
        };
    }

    let fast_ema = compute_ema(close, fast);
    let slow_ema = compute_ema(close, slow);

    // MACD line = fast EMA - slow EMA
    // Valid from index (slow - 1) onward (when both EMAs exist)
    for i in 0..n {
        if !fast_ema[i].is_nan() && !slow_ema[i].is_nan() {
            macd_line[i] = fast_ema[i] - slow_ema[i];
        }
    }

    // Signal line = EMA of MACD values
    // Collect non-NaN MACD values for signal EMA computation
    let macd_valid: Vec<f64> = macd_line.iter().filter(|v| !v.is_nan()).copied().collect();
    if macd_valid.len() >= signal {
        let signal_ema = compute_ema(&macd_valid, signal);

        // Map signal EMA back to original indices
        let mut valid_idx = 0;
        for i in 0..n {
            if !macd_line[i].is_nan() {
                if !signal_ema[valid_idx].is_nan() {
                    signal_line[i] = signal_ema[valid_idx];
                    histogram[i] = macd_line[i] - signal_line[i];
                }
                valid_idx += 1;
            }
        }
    }

    MacdResult {
        macd: macd_line,
        signal: signal_line,
        histogram,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn macd_constant_prices() {
        let data = vec![100.0; 50];
        let result = compute_macd(&data, 12, 26, 9);
        // Constant prices → fast EMA = slow EMA → MACD ≈ 0
        for i in 25..50 {
            if !result.macd[i].is_nan() {
                assert!(result.macd[i].abs() < 1e-10);
            }
        }
    }

    #[test]
    fn macd_uptrend_positive() {
        let data: Vec<f64> = (0..50).map(|i| 100.0 + i as f64 * 2.0).collect();
        let result = compute_macd(&data, 12, 26, 9);
        // In uptrend: fast EMA > slow EMA → MACD > 0
        let last_valid = result.macd.iter().rev().find(|v| !v.is_nan());
        assert!(last_valid.unwrap() > &0.0);
    }

    #[test]
    fn macd_has_signal_and_histogram() {
        let data: Vec<f64> = (0..50).map(|i| 100.0 + (i as f64 * 0.3).sin() * 10.0).collect();
        let result = compute_macd(&data, 12, 26, 9);
        // After slow + signal - 1 warmup, signal and histogram should exist
        let has_signal = result.signal.iter().any(|v| !v.is_nan());
        let has_hist = result.histogram.iter().any(|v| !v.is_nan());
        assert!(has_signal);
        assert!(has_hist);
    }

    #[test]
    fn macd_short_data() {
        let data = vec![100.0; 10];
        let result = compute_macd(&data, 12, 26, 9);
        assert!(result.macd.iter().all(|v| v.is_nan()));
    }
}
