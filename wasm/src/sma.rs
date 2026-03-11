// ═══════════════════════════════════════════════════════════════════
// charEdge WASM — Simple Moving Average (SMA)
//
// Sliding-window sum for O(n) computation.
// Returns NaN for the first (period - 1) elements.
// ═══════════════════════════════════════════════════════════════════

/// Compute SMA over a slice of close prices.
/// Returns a Vec<f64> of the same length, with NaN for warm-up indices.
pub fn compute_sma(close: &[f64], period: usize) -> Vec<f64> {
    let n = close.len();
    let mut result = vec![f64::NAN; n];

    if n < period || period == 0 {
        return result;
    }

    // Seed: sum of first `period` values
    let mut sum: f64 = close[..period].iter().sum();
    result[period - 1] = sum / period as f64;

    // Slide the window
    for i in period..n {
        sum += close[i] - close[i - period];
        result[i] = sum / period as f64;
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sma_basic() {
        let data = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let result = compute_sma(&data, 3);
        assert!(result[0].is_nan());
        assert!(result[1].is_nan());
        assert!((result[2] - 2.0).abs() < 1e-10);
        assert!((result[3] - 3.0).abs() < 1e-10);
        assert!((result[4] - 4.0).abs() < 1e-10);
    }

    #[test]
    fn sma_constant_values() {
        let data = vec![5.0; 10];
        let result = compute_sma(&data, 3);
        for i in 2..10 {
            assert!((result[i] - 5.0).abs() < 1e-10);
        }
    }

    #[test]
    fn sma_short_data() {
        let data = vec![1.0, 2.0];
        let result = compute_sma(&data, 5);
        assert!(result.iter().all(|v| v.is_nan()));
    }

    #[test]
    fn sma_period_one() {
        let data = vec![5.0, 10.0, 15.0];
        let result = compute_sma(&data, 1);
        assert!((result[0] - 5.0).abs() < 1e-10);
        assert!((result[1] - 10.0).abs() < 1e-10);
        assert!((result[2] - 15.0).abs() < 1e-10);
    }

    #[test]
    fn sma_empty() {
        let result = compute_sma(&[], 3);
        assert!(result.is_empty());
    }
}
