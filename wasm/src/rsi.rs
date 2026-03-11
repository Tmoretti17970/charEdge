// ═══════════════════════════════════════════════════════════════════
// charEdge WASM — Relative Strength Index (RSI)
//
// Wilder's smoothing: avgGain/avgLoss use (p-1)/p decay.
// Returns NaN for the first `period` elements.
// Handles flat prices (gain=0, loss=0) → RSI = 50.
// ═══════════════════════════════════════════════════════════════════

/// Compute RSI over a slice of close prices using Wilder's smoothing.
/// Returns values in [0, 100], with NaN for warm-up indices.
pub fn compute_rsi(close: &[f64], period: usize) -> Vec<f64> {
    let n = close.len();
    let mut result = vec![f64::NAN; n];

    if n < period + 1 || period == 0 {
        return result;
    }

    // Initial average gain/loss over first `period` changes
    let mut avg_gain = 0.0_f64;
    let mut avg_loss = 0.0_f64;

    for i in 1..=period {
        let change = close[i] - close[i - 1];
        if change > 0.0 {
            avg_gain += change;
        } else {
            avg_loss += change.abs();
        }
    }
    avg_gain /= period as f64;
    avg_loss /= period as f64;

    // First RSI value
    if avg_gain == 0.0 && avg_loss == 0.0 {
        result[period] = 50.0;
    } else if avg_loss == 0.0 {
        result[period] = 100.0;
    } else {
        result[period] = 100.0 - 100.0 / (1.0 + avg_gain / avg_loss);
    }

    // Subsequent values with Wilder's smoothing
    let p = period as f64;
    for i in (period + 1)..n {
        let change = close[i] - close[i - 1];
        let gain = if change > 0.0 { change } else { 0.0 };
        let loss = if change < 0.0 { change.abs() } else { 0.0 };

        avg_gain = (avg_gain * (p - 1.0) + gain) / p;
        avg_loss = (avg_loss * (p - 1.0) + loss) / p;

        if avg_gain == 0.0 && avg_loss == 0.0 {
            result[i] = 50.0;
        } else if avg_loss == 0.0 {
            result[i] = 100.0;
        } else {
            result[i] = 100.0 - 100.0 / (1.0 + avg_gain / avg_loss);
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rsi_all_gains() {
        // 16 ascending values → RSI should be 100
        let data: Vec<f64> = (0..16).map(|i| 100.0 + i as f64).collect();
        let result = compute_rsi(&data, 14);
        assert!((result[14] - 100.0).abs() < 1e-10);
    }

    #[test]
    fn rsi_all_losses() {
        // 16 descending values → RSI should be 0
        let data: Vec<f64> = (0..16).map(|i| 100.0 - i as f64).collect();
        let result = compute_rsi(&data, 14);
        assert!((result[14] - 0.0).abs() < 1e-10);
    }

    #[test]
    fn rsi_flat_prices() {
        // All same price → RSI = 50 (not NaN)
        let data = vec![100.0; 20];
        let result = compute_rsi(&data, 14);
        assert!((result[14] - 50.0).abs() < 1e-10);
        assert!((result[19] - 50.0).abs() < 1e-10);
    }

    #[test]
    fn rsi_in_range() {
        let data = vec![
            44.0, 44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1,
            45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28,
            46.0, 46.03,
        ];
        let result = compute_rsi(&data, 14);
        for v in &result {
            if !v.is_nan() {
                assert!(*v >= 0.0 && *v <= 100.0);
            }
        }
    }

    #[test]
    fn rsi_short_data() {
        let data = vec![1.0, 2.0, 3.0];
        let result = compute_rsi(&data, 14);
        assert!(result.iter().all(|v| v.is_nan()));
    }

    #[test]
    fn rsi_empty() {
        let result = compute_rsi(&[], 14);
        assert!(result.is_empty());
    }
}
