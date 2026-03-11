// ═══════════════════════════════════════════════════════════════════
// charEdge WASM — Average True Range (ATR)
//
// Wilder's smoothing: seed = SMA of first `period` TR values,
// then recursively smooth: ATR[i] = (ATR[i-1] * (p-1) + TR[i]) / p.
// Returns NaN for the first (period - 1) elements.
// ═══════════════════════════════════════════════════════════════════

/// Compute True Range from parallel high/low/close arrays.
pub fn compute_tr(high: &[f64], low: &[f64], close: &[f64]) -> Vec<f64> {
    let n = high.len();
    let mut tr = vec![0.0; n];

    if n == 0 {
        return tr;
    }

    tr[0] = high[0] - low[0];
    for i in 1..n {
        let hl = high[i] - low[i];
        let hc = (high[i] - close[i - 1]).abs();
        let lc = (low[i] - close[i - 1]).abs();
        tr[i] = hl.max(hc).max(lc);
    }

    tr
}

/// Compute ATR using Wilder's smoothing.
pub fn compute_atr(high: &[f64], low: &[f64], close: &[f64], period: usize) -> Vec<f64> {
    let n = high.len();
    let mut result = vec![f64::NAN; n];

    if n < period || period == 0 {
        return result;
    }

    let tr = compute_tr(high, low, close);

    // Seed = SMA of first `period` TR values
    let sum: f64 = tr[..period].iter().sum();
    let mut avg = sum / period as f64;
    result[period - 1] = avg;

    // Wilder's smoothing
    let p = period as f64;
    for i in period..n {
        avg = (avg * (p - 1.0) + tr[i]) / p;
        result[i] = avg;
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn atr_no_range() {
        let h = vec![100.0; 20];
        let l = vec![100.0; 20];
        let c = vec![100.0; 20];
        let result = compute_atr(&h, &l, &c, 14);
        assert!((result[13] - 0.0).abs() < 1e-10);
    }

    #[test]
    fn atr_positive() {
        let mut h = vec![0.0; 20];
        let mut l = vec![0.0; 20];
        let mut c = vec![0.0; 20];
        for i in 0..20 {
            let p = 100.0 + (i as f64 * 0.5).sin() * 10.0;
            h[i] = p + 5.0;
            l[i] = p - 5.0;
            c[i] = p + 1.0;
        }
        let result = compute_atr(&h, &l, &c, 14);
        assert!(result[13] > 0.0);
        // ATR should always be non-negative
        for v in &result {
            if !v.is_nan() {
                assert!(*v >= 0.0);
            }
        }
    }

    #[test]
    fn atr_short_data() {
        let h = vec![110.0];
        let l = vec![90.0];
        let c = vec![100.0];
        let result = compute_atr(&h, &l, &c, 14);
        assert!(result.iter().all(|v| v.is_nan()));
    }

    #[test]
    fn tr_basic() {
        let h = vec![110.0, 115.0];
        let l = vec![90.0, 95.0];
        let c = vec![100.0, 105.0];
        let tr = compute_tr(&h, &l, &c);
        assert!((tr[0] - 20.0).abs() < 1e-10); // 110 - 90
        // TR[1] = max(115-95, |115-100|, |95-100|) = max(20, 15, 5) = 20
        assert!((tr[1] - 20.0).abs() < 1e-10);
    }
}
