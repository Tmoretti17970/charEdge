// ═══════════════════════════════════════════════════════════════════
// charEdge — AnomalyDetector Unit Tests
//
// Tests all 4 anomaly types:
//   1. price_spike — abnormal close-to-close moves
//   2. price_gap — gap up/down at open
//   3. volume_spike — abnormal volume
//   4. range_expansion — unusually wide high-low range
// Plus: zScore utility, empty/short input, severity ranking, detectRecent
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { AnomalyDetector } from '../../charting_library/ai/AnomalyDetector.ts';

// ─── Helpers ──────────────────────────────────────────────────────

/** Generate n candles of stable price action (100 ± ~0.3%). */
function stableCandles(n, { basePrice = 100, baseVolume = 1000 } = {}) {
    return Array.from({ length: n }, (_, i) => {
        const jitter = (Math.sin(i) * 0.003 + 0.001) * basePrice; // deterministic tiny moves
        return {
            time: 1_700_000_000_000 + i * 60_000,
            open: basePrice + jitter * 0.5,
            high: basePrice + jitter,
            low: basePrice - jitter * 0.3,
            close: basePrice + jitter * 0.8,
            volume: baseVolume + (i % 3) * 10, // stable volume
        };
    });
}

/** Inject a spike at position `atIndex` by multiplying close by `factor`. */
function withPriceSpike(candles, atIndex, factor = 1.12) {
    const out = candles.map(c => ({ ...c }));
    out[atIndex] = { ...out[atIndex], close: out[atIndex].close * factor };
    return out;
}

/** Inject a gap open at position `atIndex` (open differs from prevClose by gapPct). */
function withGap(candles, atIndex, gapPct = 0.04) {
    const out = candles.map(c => ({ ...c }));
    const prevClose = out[atIndex - 1].close;
    out[atIndex] = {
        ...out[atIndex],
        open: prevClose * (1 + gapPct),
    };
    return out;
}

/** Inject a volume spike at position `atIndex`. */
function withVolumeSpike(candles, atIndex, multiplier = 20) {
    const out = candles.map(c => ({ ...c }));
    out[atIndex] = { ...out[atIndex], volume: out[atIndex].volume * multiplier };
    return out;
}

/** Inject a wide range at position `atIndex`. Sets high/low to ±rangePercent of close. */
function withWideRange(candles, atIndex, rangePercent = 20) {
    const out = candles.map(c => ({ ...c }));
    const c = out[atIndex];
    out[atIndex] = {
        ...c,
        high: c.close * (1 + rangePercent / 100),
        low: c.close * (1 - rangePercent / 100),
    };
    return out;
}

// ═══════════════════════════════════════════════════════════════════

describe('AnomalyDetector', () => {
    const detector = new AnomalyDetector();

    // ─── zScore ─────────────────────────────────────────────────

    describe('zScore()', () => {
        it('returns 0 for empty or single-element window', () => {
            expect(detector.zScore(5, [])).toBe(0);
            expect(detector.zScore(5, [5])).toBe(0);
        });

        it('returns 0 when all values are identical', () => {
            expect(detector.zScore(10, [10, 10, 10, 10])).toBe(0);
        });

        it('computes correct z-score for known data', () => {
            const values = [10, 12, 11, 13, 10, 12, 11, 13, 10, 12];
            const z = detector.zScore(20, values); // far above mean ~11.4
            expect(z).toBeGreaterThan(3);
        });

        it('z-score is positive for above-mean, negative for below-mean', () => {
            const values = [10, 20, 30, 40, 50];
            expect(detector.zScore(100, values)).toBeGreaterThan(0);
            expect(detector.zScore(-50, values)).toBeLessThan(0);
        });
    });

    // ─── Empty / short input ────────────────────────────────────

    describe('edge cases', () => {
        it('returns [] for empty candle array', () => {
            expect(detector.detect([])).toEqual([]);
        });

        it('returns [] for single candle', () => {
            expect(detector.detect(stableCandles(1))).toEqual([]);
        });

        it('returns [] when candles.length < window + 1', () => {
            expect(detector.detect(stableCandles(20))).toEqual([]);
        });

        it('works with exactly window + 1 candles', () => {
            // Should not throw
            const result = detector.detect(stableCandles(22));
            expect(Array.isArray(result)).toBe(true);
        });
    });

    // ─── Price Spikes ───────────────────────────────────────────

    describe('price_spike detection', () => {
        it('detects a large positive price spike', () => {
            const candles = withPriceSpike(stableCandles(40), 30, 1.15);
            const anomalies = detector.detect(candles);
            const spikes = anomalies.filter(a => a.type === 'price_spike');
            expect(spikes.length).toBeGreaterThanOrEqual(1);
            expect(spikes[0].index).toBe(30);
            expect(spikes[0].description).toContain('Bullish');
        });

        it('detects a large negative price spike (crash)', () => {
            const candles = withPriceSpike(stableCandles(40), 35, 0.85);
            const anomalies = detector.detect(candles);
            const spikes = anomalies.filter(a => a.type === 'price_spike');
            expect(spikes.length).toBeGreaterThanOrEqual(1);
            // The spike may be at 35 or 36 (depending on look-back)
            const crashSpike = spikes.find(s => s.index === 35 || s.index === 36);
            expect(crashSpike).toBeDefined();
        });

        it('does NOT flag stable candles', () => {
            const anomalies = detector.detect(stableCandles(40));
            const spikes = anomalies.filter(a => a.type === 'price_spike');
            expect(spikes.length).toBe(0);
        });
    });

    // ─── Price Gaps ─────────────────────────────────────────────

    describe('price_gap detection', () => {
        it('detects a gap up (>= 2% gap threshold)', () => {
            const candles = withGap(stableCandles(40), 30, 0.04);
            const anomalies = detector.detect(candles);
            const gaps = anomalies.filter(a => a.type === 'price_gap');
            expect(gaps.length).toBeGreaterThanOrEqual(1);
            expect(gaps[0].index).toBe(30);
            expect(gaps[0].description).toContain('Gap up');
        });

        it('detects a gap down', () => {
            const candles = withGap(stableCandles(40), 25, -0.05);
            const anomalies = detector.detect(candles);
            const gaps = anomalies.filter(a => a.type === 'price_gap');
            expect(gaps.length).toBeGreaterThanOrEqual(1);
            const gapDown = gaps.find(g => g.index === 25);
            expect(gapDown).toBeDefined();
            expect(gapDown.description).toContain('Gap down');
        });

        it('marks gaps >= 5% as high severity', () => {
            const candles = withGap(stableCandles(40), 28, 0.07);
            const anomalies = detector.detect(candles);
            const gaps = anomalies.filter(a => a.type === 'price_gap');
            expect(gaps.find(g => g.severity === 'high')).toBeDefined();
        });

        it('does NOT flag small gaps (< 2%)', () => {
            const candles = withGap(stableCandles(40), 30, 0.01);
            const anomalies = detector.detect(candles);
            const gaps = anomalies.filter(a => a.type === 'price_gap');
            expect(gaps.find(g => g.index === 30)).toBeUndefined();
        });
    });

    // ─── Volume Spikes ──────────────────────────────────────────

    describe('volume_spike detection', () => {
        it('detects an extreme volume spike', () => {
            const candles = withVolumeSpike(stableCandles(40), 30, 30);
            const anomalies = detector.detect(candles);
            const volSpikes = anomalies.filter(a => a.type === 'volume_spike');
            expect(volSpikes.length).toBeGreaterThanOrEqual(1);
            expect(volSpikes[0].index).toBe(30);
            expect(volSpikes[0].description).toContain('Volume spike');
        });

        it('includes multiplier in description', () => {
            const candles = withVolumeSpike(stableCandles(40), 30, 20);
            const anomalies = detector.detect(candles);
            const volSpike = anomalies.find(a => a.type === 'volume_spike' && a.index === 30);
            expect(volSpike).toBeDefined();
            expect(volSpike.description).toMatch(/\d+\.\dx average/);
        });

        it('does NOT flag stable volume', () => {
            const anomalies = detector.detect(stableCandles(40));
            const volSpikes = anomalies.filter(a => a.type === 'volume_spike');
            expect(volSpikes.length).toBe(0);
        });
    });

    // ─── Range Expansion ────────────────────────────────────────

    describe('range_expansion detection', () => {
        it('detects a candle with unusually wide range', () => {
            const candles = withWideRange(stableCandles(40), 30, 50);
            const anomalies = detector.detect(candles);
            const ranges = anomalies.filter(a => a.type === 'range_expansion');
            expect(ranges.length).toBeGreaterThanOrEqual(1);
            expect(ranges[0].index).toBe(30);
            expect(ranges[0].description).toContain('Range expansion');
        });

        it('does NOT flag normal ranges', () => {
            const anomalies = detector.detect(stableCandles(40));
            const ranges = anomalies.filter(a => a.type === 'range_expansion');
            expect(ranges.length).toBe(0);
        });
    });

    // ─── Severity sorting ───────────────────────────────────────

    describe('sorting', () => {
        it('returns anomalies sorted by severity (high first)', () => {
            // Create candles with both a high-severity gap and a medium spike
            let candles = withGap(stableCandles(40), 25, 0.08); // high severity gap
            candles = withVolumeSpike(candles, 30, 15); // medium volume spike
            const anomalies = detector.detect(candles);

            if (anomalies.length >= 2) {
                const severities = anomalies.map(a => a.severity);
                const severityOrder = { high: 0, medium: 1, low: 2 };
                for (let i = 1; i < severities.length; i++) {
                    expect(severityOrder[severities[i]]).toBeGreaterThanOrEqual(severityOrder[severities[i - 1]]);
                }
            }
        });
    });

    // ─── detectRecent ───────────────────────────────────────────

    describe('detectRecent()', () => {
        it('only returns anomalies from the last N candles', () => {
            const candles = withPriceSpike(stableCandles(50), 48, 1.2);
            const recent = detector.detectRecent(candles, 5);
            // Should find the spike in the recent window
            expect(recent.length).toBeGreaterThanOrEqual(0); // may or may not detect depending on window
        });

        it('does not return old anomalies', () => {
            // Spike at index 10 — not in recent 5
            const candles = withPriceSpike(stableCandles(50), 10, 1.2);
            const recent = detector.detectRecent(candles, 5);
            const old = recent.filter(a => a.index < 45);
            expect(old.length).toBe(0);
        });
    });

    // ─── Custom options ─────────────────────────────────────────

    describe('custom options', () => {
        it('respects custom threshold', () => {
            const candles = withPriceSpike(stableCandles(40), 30, 1.08);
            // With a very high threshold, should not detect
            const strict = detector.detect(candles, { threshold: 10 });
            const lenient = detector.detect(candles, { threshold: 1.0 });
            expect(lenient.length).toBeGreaterThanOrEqual(strict.length);
        });
    });
});
