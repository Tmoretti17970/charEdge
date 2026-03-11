// ═══════════════════════════════════════════════════════════════════
// charEdge WASM — Bollinger Bands
//
// Middle = SMA(period), Upper/Lower = Middle ± multiplier × stddev.
// Returns three parallel arrays: upper, middle, lower.
// NaN for the first (period - 1) elements.
// ═══════════════════════════════════════════════════════════════════

use crate::sma::compute_sma;

/// Bollinger Bands result: three parallel arrays of the same length.
pub struct BollingerResult {
    pub upper: Vec<f64>,
    pub middle: Vec<f64>,
    pub lower: Vec<f64>,
}

/// Compute Bollinger Bands.
/// `multiplier` is the standard deviation multiplier (typically 2.0).
pub fn compute_bollinger(close: &[f64], period: usize, multiplier: f64) -> BollingerResult {
    let n = close.len();
    let middle = compute_sma(close, period);
    let mut upper = vec![f64::NAN; n];
    let mut lower = vec![f64::NAN; n];

    if n < period || period == 0 {
        return BollingerResult { upper, middle, lower };
    }

    for i in (period - 1)..n {
        let mid = middle[i];
        // Population standard deviation over the window
        let mut sum_sq = 0.0_f64;
        for j in (i + 1 - period)..=i {
            let diff = close[j] - mid;
            sum_sq += diff * diff;
        }
        let std_dev = (sum_sq / period as f64).sqrt();
        upper[i] = mid + multiplier * std_dev;
        lower[i] = mid - multiplier * std_dev;
    }

    BollingerResult { upper, middle, lower }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bollinger_constant_values() {
        let data = vec![100.0; 25];
        let result = compute_bollinger(&data, 20, 2.0);
        // stddev = 0, so upper = middle = lower = 100
        assert!((result.middle[20] - 100.0).abs() < 1e-10);
        assert!((result.upper[20] - 100.0).abs() < 1e-10);
        assert!((result.lower[20] - 100.0).abs() < 1e-10);
    }

    #[test]
    fn bollinger_ordering() {
        let data: Vec<f64> = (0..25).map(|i| 100.0 + (i as f64 * 0.5).sin() * 10.0).collect();
        let result = compute_bollinger(&data, 20, 2.0);
        for i in 19..25 {
            assert!(result.upper[i] > result.middle[i]);
            assert!(result.middle[i] > result.lower[i]);
        }
    }

    #[test]
    fn bollinger_warmup_nans() {
        let data = vec![100.0; 25];
        let result = compute_bollinger(&data, 20, 2.0);
        for i in 0..19 {
            assert!(result.upper[i].is_nan());
            assert!(result.lower[i].is_nan());
        }
    }

    #[test]
    fn bollinger_short_data() {
        let data = vec![1.0, 2.0, 3.0];
        let result = compute_bollinger(&data, 20, 2.0);
        assert!(result.upper.iter().all(|v| v.is_nan()));
        assert!(result.lower.iter().all(|v| v.is_nan()));
    }
}
