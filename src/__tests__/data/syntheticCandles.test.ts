// ═══════════════════════════════════════════════════════════════════
// charEdge — generateSyntheticCandles Smoke Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { generateSyntheticCandles } from '../utils/generateSyntheticCandles.ts';

describe('generateSyntheticCandles', () => {

    it('generates the requested number of candles', () => {
        const candles = generateSyntheticCandles({ count: 50 });
        expect(candles.length).toBe(50);
    });

    it('defaults to 100 candles', () => {
        const candles = generateSyntheticCandles();
        expect(candles.length).toBe(100);
    });

    it('each candle has OHLCV shape with correct types', () => {
        const candles = generateSyntheticCandles({ count: 5 });
        for (const c of candles) {
            expect(typeof c.time).toBe('number');
            expect(typeof c.open).toBe('number');
            expect(typeof c.high).toBe('number');
            expect(typeof c.low).toBe('number');
            expect(typeof c.close).toBe('number');
            expect(typeof c.volume).toBe('number');
        }
    });

    it('high >= max(open, close) and low <= min(open, close)', () => {
        const candles = generateSyntheticCandles({ count: 200 });
        for (const c of candles) {
            expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close));
            expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close));
        }
    });

    it('timestamps are ascending with correct interval', () => {
        const candles = generateSyntheticCandles({ count: 10, intervalMs: 60_000 });
        for (let i = 1; i < candles.length; i++) {
            expect(candles[i].time - candles[i - 1].time).toBe(60_000);
        }
    });

    it('is deterministic with the same seed', () => {
        const a = generateSyntheticCandles({ count: 20, seed: 123 });
        const b = generateSyntheticCandles({ count: 20, seed: 123 });
        expect(a).toEqual(b);
    });

    it('different seeds produce different data', () => {
        const a = generateSyntheticCandles({ count: 20, seed: 1 });
        const b = generateSyntheticCandles({ count: 20, seed: 2 });
        expect(a[5].close).not.toBe(b[5].close);
    });

    it('injects gap at specified position', () => {
        const candles = generateSyntheticCandles({
            count: 30,
            gaps: [{ at: 15, pct: 0.10 }], // 10% gap up
        });
        const prevClose = candles[14].close;
        const gapOpen = candles[15].open;
        const gapPct = (gapOpen - prevClose) / prevClose;
        expect(gapPct).toBeCloseTo(0.10, 1);
    });

    it('injects spike at specified position', () => {
        const candles = generateSyntheticCandles({
            count: 30,
            volatility: 0.001, // very low base vol
            spikes: [{ at: 20, pct: 0.15 }], // 15% spike
        });
        const ret = (candles[20].close - candles[20].open) / candles[20].open;
        expect(ret).toBeCloseTo(0.15, 1);
    });

    it('injects volume spike at specified position', () => {
        const candles = generateSyntheticCandles({
            count: 30,
            baseVolume: 1000,
            volumeProfile: 'stable',
            volumeSpikes: [{ at: 10, multiplier: 20 }],
        });
        expect(candles[10].volume).toBe(20_000);
    });

    it('volume profiles produce expected patterns', () => {
        const stable = generateSyntheticCandles({ count: 50, volumeProfile: 'stable', baseVolume: 5000 });
        expect(stable[0].volume).toBe(5000);
        expect(stable[25].volume).toBe(5000);

        const uShape = generateSyntheticCandles({ count: 50, volumeProfile: 'u-shape', baseVolume: 5000 });
        // U-shape: edges should be higher than middle on average
        const edgeAvg = (uShape[0].volume + uShape[49].volume) / 2;
        const midVol = uShape[25].volume;
        expect(edgeAvg).toBeGreaterThan(midVol);
    });

    it('trend shifts price over time', () => {
        const uptrend = generateSyntheticCandles({
            count: 100,
            startPrice: 100,
            trend: 0.01, // +1% per bar
            volatility: 0.001,
        });
        // After 100 bars with +1% drift, should be much higher
        expect(uptrend[99].close).toBeGreaterThan(200);
    });

    it('all volumes are positive', () => {
        const candles = generateSyntheticCandles({ count: 200 });
        for (const c of candles) {
            expect(c.volume).toBeGreaterThan(0);
        }
    });
});
