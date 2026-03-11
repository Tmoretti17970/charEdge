// ═══════════════════════════════════════════════════════════════════
// charEdge WASM — Bar Transforms
//
// #110: Renko, Heikin-Ashi, Range Bars, Kagi charts.
// All transforms take raw OHLCV arrays and produce transformed bars.
// ═══════════════════════════════════════════════════════════════════

// ─── Renko ──────────────────────────────────────────────────────

/// A single Renko brick.
#[derive(Clone, Debug)]
pub struct RenkoBrick {
    pub open: f64,
    pub close: f64,
    pub high: f64,
    pub low: f64,
    pub direction: i8, // +1 up, -1 down
}

/// Generate Renko bricks from close prices.
///
/// Port of renkoBrickCount.ts and IndicatorWorker renko().
pub fn renko(close: &[f64], brick_size: f64) -> Vec<RenkoBrick> {
    if close.is_empty() || brick_size <= 0.0 {
        return vec![];
    }

    let mut bricks = Vec::new();
    let mut anchor = (close[0] / brick_size).floor() * brick_size;

    for &price in close.iter() {
        let diff = price - anchor;
        let num_bricks = (diff.abs() / brick_size).floor() as usize;
        let dir: i8 = if diff > 0.0 { 1 } else { -1 };

        for _ in 0..num_bricks {
            let open = anchor;
            let close_val = anchor + dir as f64 * brick_size;
            bricks.push(RenkoBrick {
                open,
                close: close_val,
                high: open.max(close_val),
                low: open.min(close_val),
                direction: dir,
            });
            anchor = close_val;
        }
    }

    bricks
}

// ─── Heikin-Ashi ────────────────────────────────────────────────

/// Heikin-Ashi transformed bar.
#[derive(Clone, Debug)]
pub struct HeikinAshiBar {
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
}

/// Transform OHLC into Heikin-Ashi bars.
///
/// HA Close = (O + H + L + C) / 4
/// HA Open[0] = (O + C) / 2, HA Open[i] = (HA_Open[i-1] + HA_Close[i-1]) / 2
/// HA High = max(H, HA_Open, HA_Close)
/// HA Low = min(L, HA_Open, HA_Close)
pub fn heikin_ashi(
    open: &[f64],
    high: &[f64],
    low: &[f64],
    close: &[f64],
) -> Vec<HeikinAshiBar> {
    let n = open.len();
    let mut result = Vec::with_capacity(n);

    if n == 0 {
        return result;
    }

    // First bar
    let ha_close0 = (open[0] + high[0] + low[0] + close[0]) / 4.0;
    let ha_open0 = (open[0] + close[0]) / 2.0;
    result.push(HeikinAshiBar {
        open: ha_open0,
        high: high[0].max(ha_open0).max(ha_close0),
        low: low[0].min(ha_open0).min(ha_close0),
        close: ha_close0,
    });

    // Subsequent bars
    for i in 1..n {
        let ha_close = (open[i] + high[i] + low[i] + close[i]) / 4.0;
        let ha_open = (result[i - 1].open + result[i - 1].close) / 2.0;
        result.push(HeikinAshiBar {
            open: ha_open,
            high: high[i].max(ha_open).max(ha_close),
            low: low[i].min(ha_open).min(ha_close),
            close: ha_close,
        });
    }

    result
}

// ─── Range Bars ─────────────────────────────────────────────────

/// A single range bar.
#[derive(Clone, Debug)]
pub struct RangeBar {
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
}

/// Generate range bars from close prices.
///
/// A new range bar starts when the H-L range exceeds `range_size`.
pub fn range_bars(close: &[f64], range_size: f64) -> Vec<RangeBar> {
    if close.is_empty() || range_size <= 0.0 {
        return vec![];
    }

    let mut bars = Vec::new();
    let mut bar_open = close[0];
    let mut bar_high = close[0];
    let mut bar_low = close[0];

    for &price in close.iter() {
        bar_high = bar_high.max(price);
        bar_low = bar_low.min(price);

        if bar_high - bar_low >= range_size {
            bars.push(RangeBar {
                open: bar_open,
                high: bar_high,
                low: bar_low,
                close: price,
            });
            bar_open = price;
            bar_high = price;
            bar_low = price;
        }
    }

    // Emit the final incomplete bar if it has data
    if bar_high != bar_low || bars.is_empty() {
        bars.push(RangeBar {
            open: bar_open,
            high: bar_high,
            low: bar_low,
            close: *close.last().unwrap(),
        });
    }

    bars
}

// ─── Kagi ───────────────────────────────────────────────────────

/// A Kagi line segment.
#[derive(Clone, Debug)]
pub struct KagiLine {
    pub price: f64,
    pub direction: i8, // +1 = yang (thick), -1 = yin (thin)
}

/// Generate Kagi chart from close prices.
///
/// A reversal occurs when price moves `reversal_pct` (e.g. 0.04 = 4%)
/// against the current direction.
pub fn kagi(close: &[f64], reversal_pct: f64) -> Vec<KagiLine> {
    if close.is_empty() || reversal_pct <= 0.0 {
        return vec![];
    }

    let mut lines = Vec::new();
    let mut direction: i8 = 0;
    let mut last_price = close[0];
    let mut extreme = close[0]; // Current high (up) or low (down)

    lines.push(KagiLine { price: close[0], direction: 1 });

    for &price in close.iter().skip(1) {
        if direction == 0 {
            // Determine initial direction
            let pct_change = (price - last_price) / last_price;
            if pct_change.abs() >= reversal_pct {
                direction = if pct_change > 0.0 { 1 } else { -1 };
                extreme = price;
                lines.push(KagiLine { price, direction });
            }
        } else if direction == 1 {
            // Uptrend
            if price > extreme {
                extreme = price;
                if let Some(last) = lines.last_mut() {
                    last.price = price;
                }
            } else {
                let decline = (extreme - price) / extreme;
                if decline >= reversal_pct {
                    direction = -1;
                    extreme = price;
                    lines.push(KagiLine { price, direction: -1 });
                }
            }
        } else {
            // Downtrend
            if price < extreme {
                extreme = price;
                if let Some(last) = lines.last_mut() {
                    last.price = price;
                }
            } else {
                let rally = (price - extreme) / extreme;
                if rally >= reversal_pct {
                    direction = 1;
                    extreme = price;
                    lines.push(KagiLine { price, direction: 1 });
                }
            }
        }

        last_price = price;
    }

    lines
}

#[cfg(test)]
mod tests {
    use super::*;

    // ─── Renko tests ────────────────────────────────────────────

    #[test]
    fn renko_basic() {
        let closes = vec![100.0, 110.0, 120.0, 115.0, 105.0, 95.0];
        let bricks = renko(&closes, 10.0);
        assert!(!bricks.is_empty());
        assert!(bricks[0].direction == 1); // first move up
    }

    #[test]
    fn renko_no_movement() {
        let closes = vec![100.0; 10];
        let bricks = renko(&closes, 10.0);
        assert!(bricks.is_empty());
    }

    #[test]
    fn renko_empty() {
        assert!(renko(&[], 10.0).is_empty());
    }

    #[test]
    fn renko_brick_sizes() {
        let closes = vec![100.0, 130.0]; // 30 point move
        let bricks = renko(&closes, 10.0);
        assert_eq!(bricks.len(), 3); // 3 bricks of size 10
    }

    // ─── Heikin-Ashi tests ──────────────────────────────────────

    #[test]
    fn heikin_ashi_basic() {
        let o = vec![100.0, 102.0, 104.0];
        let h = vec![105.0, 107.0, 109.0];
        let l = vec![98.0, 100.0, 102.0];
        let c = vec![103.0, 105.0, 107.0];
        let ha = heikin_ashi(&o, &h, &l, &c);
        assert_eq!(ha.len(), 3);
        // HA Close[0] = (100+105+98+103)/4 = 101.5
        assert!((ha[0].close - 101.5).abs() < 1e-10);
        // HA Open[0] = (100+103)/2 = 101.5
        assert!((ha[0].open - 101.5).abs() < 1e-10);
    }

    #[test]
    fn heikin_ashi_empty() {
        assert!(heikin_ashi(&[], &[], &[], &[]).is_empty());
    }

    #[test]
    fn heikin_ashi_sequential_open() {
        let o = vec![100.0, 102.0];
        let h = vec![110.0, 112.0];
        let l = vec![90.0, 92.0];
        let c = vec![105.0, 108.0];
        let ha = heikin_ashi(&o, &h, &l, &c);
        // HA Open[1] = (HA_Open[0] + HA_Close[0]) / 2
        let expected_open1 = (ha[0].open + ha[0].close) / 2.0;
        assert!((ha[1].open - expected_open1).abs() < 1e-10);
    }

    // ─── Range Bars tests ───────────────────────────────────────

    #[test]
    fn range_bars_basic() {
        let closes = vec![100.0, 105.0, 110.0, 108.0, 115.0, 120.0];
        let bars = range_bars(&closes, 10.0);
        assert!(!bars.is_empty());
        // Each bar should have range <= range_size (except possibly the last)
        for bar in &bars[..bars.len().saturating_sub(1)] {
            assert!(bar.high - bar.low >= 10.0 - 1e-10);
        }
    }

    #[test]
    fn range_bars_empty() {
        assert!(range_bars(&[], 10.0).is_empty());
    }

    // ─── Kagi tests ─────────────────────────────────────────────

    #[test]
    fn kagi_basic() {
        let closes = vec![100.0, 105.0, 110.0, 100.0, 95.0, 110.0];
        let lines = kagi(&closes, 0.05); // 5% reversal
        assert!(!lines.is_empty());
        assert_eq!(lines[0].direction, 1); // starts positive
    }

    #[test]
    fn kagi_no_reversal() {
        // Steady climb, no reversal
        let closes: Vec<f64> = (0..20).map(|i| 100.0 + i as f64).collect();
        let lines = kagi(&closes, 0.05);
        // Should be mostly upward with no reversals
        assert!(lines.iter().all(|l| l.direction == 1));
    }

    #[test]
    fn kagi_empty() {
        assert!(kagi(&[], 0.05).is_empty());
    }
}
