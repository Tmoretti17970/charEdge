// ═══════════════════════════════════════════════════════════════════
// charEdge WASM — Exponential Moving Average (EMA)
//
// Seed with SMA of first `period` values, then apply multiplier.
// Returns NaN for the first (period - 1) elements.
// ═══════════════════════════════════════════════════════════════════

use crate::sma::compute_sma;

/// Compute EMA over a slice of close prices.
/// Multiplier k = 2 / (period + 1).
/// Seed = SMA of first `period` values.
pub fn compute_ema(close: &[f64], period: usize) -> Vec<f64> {
    let n = close.len();
    let mut result = vec![f64::NAN; n];

    if n < period || period == 0 {
        return result;
    }

    let k = 2.0 / (period as f64 + 1.0);

    // Seed with SMA of first `period` values
    let sma_vals = compute_sma(close, period);
    let seed = sma_vals[period - 1];
    result[period - 1] = seed;

    // Apply EMA formula
    for i in period..n {
        result[i] = close[i] * k + result[i - 1] * (1.0 - k);
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ema_seeds_with_sma() {
        let data = vec![2.0, 4.0, 6.0, 8.0, 10.0];
        let result = compute_ema(&data, 3);
        assert!(result[0].is_nan());
        assert!(result[1].is_nan());
        // Seed = SMA(2,4,6) = 4.0
        assert!((result[2] - 4.0).abs() < 1e-10);
    }

    #[test]
    fn ema_multiplier() {
        let data = vec![2.0, 4.0, 6.0, 8.0, 10.0];
        let result = compute_ema(&data, 3);
        let _k = 2.0 / 4.0; // 0.5
        // result[3] = 8 * 0.5 + 4 * 0.5 = 6.0
        assert!((result[3] - 6.0).abs() < 1e-10);
        // result[4] = 10 * 0.5 + 6 * 0.5 = 8.0
        assert!((result[4] - 8.0).abs() < 1e-10);
    }

    #[test]
    fn ema_constant() {
        let data = vec![5.0; 10];
        let result = compute_ema(&data, 3);
        for i in 2..10 {
            assert!((result[i] - 5.0).abs() < 1e-10);
        }
    }

    #[test]
    fn ema_short_data() {
        let data = vec![1.0, 2.0];
        let result = compute_ema(&data, 5);
        assert!(result.iter().all(|v| v.is_nan()));
    }

    #[test]
    fn ema_empty() {
        let result = compute_ema(&[], 3);
        assert!(result.is_empty());
    }
}
