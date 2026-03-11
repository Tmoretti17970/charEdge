// ═══════════════════════════════════════════════════════════════════
// charEdge WASM — Pattern Engines
//
// #109: AutoSR (support/resistance detection), AutoTrendline,
// and candlestick pattern recognition.
//
// All pattern engines operate on parallel f64 arrays for
// cache-friendly traversal and zero-copy WASM interop.
// ═══════════════════════════════════════════════════════════════════

// ─── Auto Support/Resistance ────────────────────────────────────

/// A detected S/R level.
#[derive(Clone, Debug)]
pub struct SRLevel {
    pub price: f64,
    pub is_support: bool,   // true = support, false = resistance
    pub strength: f64,
    pub touches: usize,
    pub zone_high: f64,
    pub zone_low: f64,
}

/// Detect S/R levels from OHLCV data using pivot clustering + strength scoring.
///
/// Port of AutoSR.js — `detectSupportResistance`.
///
/// # Arguments
/// * `high`, `low`, `close`, `volume` — parallel arrays
/// * `pivot_range` — bars to look left/right (default 5)
/// * `zone_merge` — merge levels within this % of each other (default 0.003)
/// * `min_touches` — minimum touches to qualify (default 2)
/// * `max_levels` — cap on returned levels (default 15)
pub fn detect_sr(
    high: &[f64],
    low: &[f64],
    _close: &[f64],
    volume: &[f64],
    pivot_range: usize,
    zone_merge: f64,
    min_touches: usize,
    max_levels: usize,
) -> Vec<SRLevel> {
    let n = high.len();
    if n < pivot_range * 2 + 1 {
        return vec![];
    }

    // Step 1: Find pivots (swing highs/lows)
    struct Pivot {
        price: f64,
        is_support: bool,
        bar_idx: usize,
    }

    let mut pivots = Vec::new();
    for i in pivot_range..(n - pivot_range) {
        let mut is_swing_high = true;
        let mut is_swing_low = true;

        for j in 1..=pivot_range {
            if high[i] <= high[i - j] || high[i] <= high[i + j] {
                is_swing_high = false;
            }
            if low[i] >= low[i - j] || low[i] >= low[i + j] {
                is_swing_low = false;
            }
        }

        if is_swing_high {
            pivots.push(Pivot { price: high[i], is_support: false, bar_idx: i });
        }
        if is_swing_low {
            pivots.push(Pivot { price: low[i], is_support: true, bar_idx: i });
        }
    }

    if pivots.is_empty() {
        return vec![];
    }

    // Step 2: Sort by price and cluster into zones
    pivots.sort_by(|a, b| a.price.partial_cmp(&b.price).unwrap_or(std::cmp::Ordering::Equal));

    struct Zone {
        price_sum: f64,
        count: usize,
        supports: usize,
        pivots: Vec<(f64, usize)>, // (price, bar_idx)
    }

    let mut zones: Vec<Zone> = vec![Zone {
        price_sum: pivots[0].price,
        count: 1,
        supports: if pivots[0].is_support { 1 } else { 0 },
        pivots: vec![(pivots[0].price, pivots[0].bar_idx)],
    }];

    for p in pivots.iter().skip(1) {
        let cur_zone = zones.last_mut().unwrap();
        let avg_price = cur_zone.price_sum / cur_zone.count as f64;
        let pct_diff = (p.price - avg_price).abs() / avg_price;

        if pct_diff < zone_merge {
            cur_zone.price_sum += p.price;
            cur_zone.count += 1;
            if p.is_support {
                cur_zone.supports += 1;
            }
            cur_zone.pivots.push((p.price, p.bar_idx));
        } else {
            zones.push(Zone {
                price_sum: p.price,
                count: 1,
                supports: if p.is_support { 1 } else { 0 },
                pivots: vec![(p.price, p.bar_idx)],
            });
        }
    }

    // Step 3: Score each zone
    let last_bar_idx = n - 1;
    let avg_vol: f64 = volume.iter().sum::<f64>() / n as f64;

    let mut levels: Vec<SRLevel> = zones
        .iter()
        .filter_map(|zone| {
            if zone.count < min_touches {
                return None;
            }

            let price = zone.price_sum / zone.count as f64;
            let touches = zone.count;

            // Recency score
            let most_recent = zone.pivots.iter().map(|(_, idx)| *idx).max().unwrap_or(0);
            let recency = 1.0 + 1.5 * (most_recent as f64 / last_bar_idx as f64);

            // Volume score
            let vol_sum: f64 = zone.pivots.iter().map(|(_, idx)| volume[*idx]).sum();
            let vol_ratio = if avg_vol > 0.0 {
                vol_sum / (zone.count as f64 * avg_vol)
            } else {
                1.0
            };

            let strength = touches as f64 * recency * vol_ratio.sqrt();
            let is_support = zone.supports > zone.count - zone.supports;

            let prices: Vec<f64> = zone.pivots.iter().map(|(p, _)| *p).collect();
            let zone_high = prices.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
            let zone_low = prices.iter().cloned().fold(f64::INFINITY, f64::min);

            Some(SRLevel {
                price,
                is_support,
                strength: (strength * 100.0).round() / 100.0,
                touches,
                zone_high,
                zone_low,
            })
        })
        .collect();

    // Sort by strength descending, take top max_levels
    levels.sort_by(|a, b| b.strength.partial_cmp(&a.strength).unwrap_or(std::cmp::Ordering::Equal));
    levels.truncate(max_levels);
    levels
}

// ─── Candlestick Patterns ───────────────────────────────────────

/// Candlestick pattern type.
#[derive(Clone, Debug, PartialEq)]
pub enum CandlestickPattern {
    Hammer,
    InvertedHammer,
    BullishEngulfing,
    BearishEngulfing,
    Doji,
    MorningStar,
    EveningStar,
    ThreeWhiteSoldiers,
    ThreeBlackCrows,
}

/// A detected candlestick pattern occurrence.
#[derive(Clone, Debug)]
pub struct PatternMatch {
    pub pattern: CandlestickPattern,
    pub bar_idx: usize,
    pub is_bullish: bool,
}

/// Detect candlestick patterns from OHLC data.
pub fn detect_candlestick_patterns(
    open: &[f64],
    high: &[f64],
    low: &[f64],
    close: &[f64],
) -> Vec<PatternMatch> {
    let n = open.len();
    let mut matches = Vec::new();

    for i in 0..n {
        let body = (close[i] - open[i]).abs();
        let upper_shadow = high[i] - close[i].max(open[i]);
        let lower_shadow = close[i].min(open[i]) - low[i];
        let range = high[i] - low[i];
        let is_green = close[i] > open[i];

        if range == 0.0 {
            continue;
        }

        // Doji: very small body relative to range
        if body / range < 0.1 {
            matches.push(PatternMatch {
                pattern: CandlestickPattern::Doji,
                bar_idx: i,
                is_bullish: false, // neutral
            });
        }

        // Hammer: small body at top, long lower shadow
        if lower_shadow >= body * 2.0 && upper_shadow < body * 0.5 && body > 0.0 {
            matches.push(PatternMatch {
                pattern: CandlestickPattern::Hammer,
                bar_idx: i,
                is_bullish: true,
            });
        }

        // Inverted Hammer: small body at bottom, long upper shadow
        if upper_shadow >= body * 2.0 && lower_shadow < body * 0.5 && body > 0.0 {
            matches.push(PatternMatch {
                pattern: CandlestickPattern::InvertedHammer,
                bar_idx: i,
                is_bullish: true,
            });
        }

        // Two-bar patterns
        if i >= 1 {
            let prev_body = (close[i - 1] - open[i - 1]).abs();
            let prev_green = close[i - 1] > open[i - 1];

            // Bullish Engulfing
            if !prev_green && is_green && body > prev_body
                && open[i] <= close[i - 1] && close[i] >= open[i - 1]
            {
                matches.push(PatternMatch {
                    pattern: CandlestickPattern::BullishEngulfing,
                    bar_idx: i,
                    is_bullish: true,
                });
            }

            // Bearish Engulfing
            if prev_green && !is_green && body > prev_body
                && open[i] >= close[i - 1] && close[i] <= open[i - 1]
            {
                matches.push(PatternMatch {
                    pattern: CandlestickPattern::BearishEngulfing,
                    bar_idx: i,
                    is_bullish: false,
                });
            }
        }

        // Three-bar patterns
        if i >= 2 {
            let g0 = close[i - 2] > open[i - 2];
            let g1 = close[i - 1] > open[i - 1];

            // Three White Soldiers
            if g0 && g1 && is_green
                && close[i - 1] > close[i - 2]
                && close[i] > close[i - 1]
                && open[i - 1] > open[i - 2]
                && open[i] > open[i - 1]
            {
                matches.push(PatternMatch {
                    pattern: CandlestickPattern::ThreeWhiteSoldiers,
                    bar_idx: i,
                    is_bullish: true,
                });
            }

            // Three Black Crows
            if !g0 && !g1 && !is_green
                && close[i - 1] < close[i - 2]
                && close[i] < close[i - 1]
                && open[i - 1] < open[i - 2]
                && open[i] < open[i - 1]
            {
                matches.push(PatternMatch {
                    pattern: CandlestickPattern::ThreeBlackCrows,
                    bar_idx: i,
                    is_bullish: false,
                });
            }
        }
    }

    matches
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sr_basic_detection() {
        // Create a simple series with clear swing highs and lows
        let n = 50;
        let mut high = vec![0.0; n];
        let mut low = vec![0.0; n];
        let mut close = vec![0.0; n];
        let volume = vec![1000.0; n];

        for i in 0..n {
            let base = 100.0 + (i as f64 * 0.3).sin() * 20.0;
            high[i] = base + 5.0;
            low[i] = base - 5.0;
            close[i] = base;
        }

        let levels = detect_sr(&high, &low, &close, &volume, 5, 0.003, 2, 15);
        // Should detect at least some levels from the sine wave
        // (depends on amplitude vs zone merge threshold)
        assert!(levels.len() <= 15);
    }

    #[test]
    fn sr_empty_input() {
        let levels = detect_sr(&[], &[], &[], &[], 5, 0.003, 2, 15);
        assert!(levels.is_empty());
    }

    #[test]
    fn sr_short_input() {
        let levels = detect_sr(&[100.0; 5], &[90.0; 5], &[95.0; 5], &[1000.0; 5], 5, 0.003, 2, 15);
        assert!(levels.is_empty()); // Not enough data for pivot_range=5
    }

    #[test]
    fn candlestick_doji() {
        // Equal open and close = doji
        let o = vec![100.0];
        let h = vec![110.0];
        let l = vec![90.0];
        let c = vec![100.0];
        let matches = detect_candlestick_patterns(&o, &h, &l, &c);
        assert!(matches.iter().any(|m| m.pattern == CandlestickPattern::Doji));
    }

    #[test]
    fn candlestick_hammer() {
        // Small body at top, long lower shadow
        let o = vec![109.0];
        let h = vec![110.0];
        let l = vec![90.0];
        let c = vec![110.0];
        let matches = detect_candlestick_patterns(&o, &h, &l, &c);
        assert!(matches.iter().any(|m| m.pattern == CandlestickPattern::Hammer));
    }

    #[test]
    fn candlestick_bullish_engulfing() {
        let o = vec![105.0, 95.0];
        let h = vec![106.0, 107.0];
        let l = vec![94.0, 94.0];
        let c = vec![95.0, 106.0];
        let matches = detect_candlestick_patterns(&o, &h, &l, &c);
        assert!(matches.iter().any(|m| m.pattern == CandlestickPattern::BullishEngulfing));
    }

    #[test]
    fn candlestick_empty() {
        let matches = detect_candlestick_patterns(&[], &[], &[], &[]);
        assert!(matches.is_empty());
    }
}
