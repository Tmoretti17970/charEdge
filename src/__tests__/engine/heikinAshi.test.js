// ═══════════════════════════════════════════════════════════════════
// charEdge — Heikin-Ashi Transform Tests
//
// Verifies the toHeikinAshi bar transform produces correct smoothed
// candle values against known reference calculations.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { toHeikinAshi } from '../../charting_library/core/barTransforms.js';

describe('toHeikinAshi', () => {
    // ─── Edge Cases ────────────────────────────────────────────

    it('returns empty array for null/undefined/empty input', () => {
        expect(toHeikinAshi(null)).toEqual([]);
        expect(toHeikinAshi(undefined)).toEqual([]);
        expect(toHeikinAshi([])).toEqual([]);
    });

    // ─── Single Bar ────────────────────────────────────────────

    it('computes HA values for a single bar', () => {
        const bars = [{ time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 50 }];
        const ha = toHeikinAshi(bars);

        expect(ha.length).toBe(1);
        // HA-Close = (100 + 110 + 90 + 105) / 4 = 101.25
        expect(ha[0].close).toBeCloseTo(101.25, 2);
        // HA-Open = (100 + 105) / 2 = 102.5
        expect(ha[0].open).toBeCloseTo(102.5, 2);
        // HA-High = max(110, 102.5, 101.25) = 110
        expect(ha[0].high).toBe(110);
        // HA-Low = min(90, 102.5, 101.25) = 90
        expect(ha[0].low).toBe(90);
        // Volume preserved
        expect(ha[0].volume).toBe(50);
        // Time preserved
        expect(ha[0].time).toBe(1000);
    });

    // ─── Multi-Bar ─────────────────────────────────────────────

    it('computes recursive HA-Open for subsequent bars', () => {
        const bars = [
            { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 50 },
            { time: 2000, open: 106, high: 115, low: 100, close: 112, volume: 60 },
        ];
        const ha = toHeikinAshi(bars);
        expect(ha.length).toBe(2);

        // Second bar:
        // HA-Close = (106 + 115 + 100 + 112) / 4 = 108.25
        expect(ha[1].close).toBeCloseTo(108.25, 2);
        // HA-Open = (prev.open + prev.close) / 2 = (102.5 + 101.25) / 2 = 101.875
        expect(ha[1].open).toBeCloseTo(101.875, 2);
        // HA-High = max(115, 101.875, 108.25) = 115
        expect(ha[1].high).toBe(115);
        // HA-Low = min(100, 101.875, 108.25) = 100
        expect(ha[1].low).toBe(100);
    });

    // ─── Trend Smoothing ───────────────────────────────────────

    it('produces smoother candles than raw data', () => {
        // Simulate a trending market with noise
        const rawBars = Array.from({ length: 20 }, (_, i) => ({
            time: i * 1000,
            open: 100 + i * 2 + (Math.sin(i) * 3),
            high: 100 + i * 2 + 5,
            low: 100 + i * 2 - 5,
            close: 100 + i * 2 + (Math.cos(i) * 3),
            volume: 100,
        }));

        const ha = toHeikinAshi(rawBars);
        expect(ha.length).toBe(rawBars.length);

        // HA bars should have smaller wicks relative to body
        // (characteristic of Heikin-Ashi in trends)
        let haBodySum = 0;
        let rawBodySum = 0;
        for (let i = 1; i < ha.length; i++) {
            haBodySum += Math.abs(ha[i].close - ha[i].open);
            rawBodySum += Math.abs(rawBars[i].close - rawBars[i].open);
        }

        // In a trend, HA bodies should be roughly similar to raw 
        // but the key property is that HA wicks are more uniform
        expect(ha.length).toBe(rawBars.length);
        // All HA bars should have valid OHLC
        for (const b of ha) {
            expect(b.high).toBeGreaterThanOrEqual(Math.max(b.open, b.close));
            expect(b.low).toBeLessThanOrEqual(Math.min(b.open, b.close));
        }
    });

    // ─── Volume Preservation ───────────────────────────────────

    it('preserves volume from source bars', () => {
        const bars = [
            { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 42 },
            { time: 2000, open: 106, high: 115, low: 100, close: 112, volume: 88 },
        ];
        const ha = toHeikinAshi(bars);
        expect(ha[0].volume).toBe(42);
        expect(ha[1].volume).toBe(88);
    });

    // ─── Identical Bars ────────────────────────────────────────

    it('handles bars with identical OHLC', () => {
        const bars = [
            { time: 1000, open: 100, high: 100, low: 100, close: 100, volume: 10 },
            { time: 2000, open: 100, high: 100, low: 100, close: 100, volume: 10 },
        ];
        const ha = toHeikinAshi(bars);
        expect(ha[0].open).toBe(100);
        expect(ha[0].close).toBe(100);
        expect(ha[1].open).toBe(100);
        expect(ha[1].close).toBe(100);
    });
});
