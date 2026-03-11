// ═══════════════════════════════════════════════════════════════════
// Advanced Indicators — Sprint 1 Quick-Wins + Divergence
// StochRSI, Pivots, Elder-Ray, ADXR, Auto-Fib, ZigZag
// ═══════════════════════════════════════════════════════════════════

import { detectSwings } from '../../PriceActionEngine.js';
import * as C from '../computations.js';

const _detectAutoFibSwings = detectSwings;

export const QUICKWIN_INDICATORS = {
    stochRsi: {
        id: 'stochRsi', name: 'Stochastic RSI', shortName: 'StochRSI', mode: 'pane',
        params: {
            rsiPeriod: { default: 14, min: 2, max: 100, step: 1, label: 'RSI Period' },
            stochPeriod: { default: 14, min: 2, max: 100, step: 1, label: 'Stoch Period' },
            kSmooth: { default: 3, min: 1, max: 10, step: 1, label: '%K Smooth' },
            dSmooth: { default: 3, min: 1, max: 10, step: 1, label: '%D Smooth' },
        },
        outputs: [
            { key: 'k', label: '%K', color: '#2962FF', width: 1.5, type: 'line' },
            { key: 'd', label: '%D', color: '#FF6D00', width: 1, type: 'line', dash: [4, 4] },
        ],
        paneConfig: {
            min: 0, max: 100,
            bands: [
                { value: 80, color: 'rgba(239, 83, 80, 0.3)', dash: [4, 4] },
                { value: 20, color: 'rgba(38, 166, 154, 0.3)', dash: [4, 4] },
                { value: 50, color: 'rgba(120, 123, 134, 0.2)', dash: [2, 4] },
            ],
        },
        compute(bars, params) { return C.stochRsi(bars, params.rsiPeriod, params.stochPeriod, params.kSmooth, params.dSmooth); },
    },

    pivotPoints: {
        id: 'pivotPoints', name: 'Pivot Points', shortName: 'Pivots', mode: 'overlay',
        params: { periodBars: { default: 1, min: 1, max: 100, step: 1, label: 'Period (bars)' } },
        outputs: [
            { key: 'pivot', label: 'PP', color: '#FFD54F', width: 2, type: 'line' },
            { key: 'r1', label: 'R1', color: '#EF5350', width: 1, type: 'line', dash: [4, 4] },
            { key: 'r2', label: 'R2', color: '#EF5350', width: 1, type: 'line', dash: [6, 3] },
            { key: 'r3', label: 'R3', color: '#EF5350', width: 1, type: 'line', dash: [2, 4] },
            { key: 's1', label: 'S1', color: '#26A69A', width: 1, type: 'line', dash: [4, 4] },
            { key: 's2', label: 'S2', color: '#26A69A', width: 1, type: 'line', dash: [6, 3] },
            { key: 's3', label: 'S3', color: '#26A69A', width: 1, type: 'line', dash: [2, 4] },
        ],
        compute(bars, params) { return C.pivotPoints(bars, params.periodBars); },
    },

    elderRay: {
        id: 'elderRay', name: 'Elder-Ray Index', shortName: 'Elder', mode: 'pane',
        params: { period: { default: 13, min: 2, max: 100, step: 1, label: 'EMA Period' } },
        outputs: [
            { key: 'bullPower', label: 'Bull', color: '#26A69A', width: 0, type: 'histogram' },
            { key: 'bearPower', label: 'Bear', color: '#EF5350', width: 2, type: 'line' },
        ],
        paneConfig: { bands: [{ value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }] },
        compute(bars, params) { return C.elderRay(bars, params.period); },
    },

    adxr: {
        id: 'adxr', name: 'ADX Rating', shortName: 'ADXR', mode: 'pane',
        params: { period: { default: 14, min: 2, max: 100, step: 1, label: 'Period' } },
        outputs: [
            { key: 'adxr', label: 'ADXR', color: '#E040FB', width: 2, type: 'line' },
            { key: 'adx', label: 'ADX', color: '#FF6D00', width: 1, type: 'line', dash: [4, 4] },
            { key: 'plusDI', label: '+DI', color: '#26A69A', width: 1, type: 'line' },
            { key: 'minusDI', label: '-DI', color: '#EF5350', width: 1, type: 'line' },
        ],
        paneConfig: { min: 0, max: 100, bands: [{ value: 25, color: 'rgba(120, 123, 134, 0.3)', dash: [4, 4] }] },
        compute(bars, params) { return C.adxr(bars, params.period); },
    },

    autoFib: {
        id: 'autoFib', name: 'Auto Fibonacci', shortName: 'Auto-Fib', mode: 'overlay',
        params: { strength: { default: 8, min: 3, max: 20, step: 1, label: 'Swing Strength' } },
        outputs: [
            { key: 'high', label: '100%', color: '#EF5350', width: 1, type: 'line' },
            { key: 'fib786', label: '78.6%', color: '#FF7043', width: 1, type: 'line', dash: [4, 4] },
            { key: 'fib618', label: '61.8%', color: '#FFD54F', width: 1, type: 'line', dash: [4, 4] },
            { key: 'fib500', label: '50%', color: '#78909C', width: 1, type: 'line', dash: [2, 4] },
            { key: 'fib382', label: '38.2%', color: '#42A5F5', width: 1, type: 'line', dash: [4, 4] },
            { key: 'fib236', label: '23.6%', color: '#66BB6A', width: 1, type: 'line', dash: [4, 4] },
            { key: 'low', label: '0%', color: '#26A69A', width: 1, type: 'line' },
        ],
        compute(bars, params) {
            const len = bars.length;
            const result = {
                high: new Array(len).fill(NaN), low: new Array(len).fill(NaN),
                fib786: new Array(len).fill(NaN), fib618: new Array(len).fill(NaN),
                fib500: new Array(len).fill(NaN), fib382: new Array(len).fill(NaN),
                fib236: new Array(len).fill(NaN)
            };
            const swings = _detectAutoFibSwings(bars, params.strength);
            if (!swings) return result;
            const { swingHigh, swingLow } = swings;
            const h = swingHigh.price, l = swingLow.price, range = h - l;
            const startIdx = Math.min(swingHigh.idx, swingLow.idx);
            for (let i = startIdx; i < len; i++) {
                result.high[i] = h; result.low[i] = l;
                result.fib786[i] = l + range * 0.786; result.fib618[i] = l + range * 0.618;
                result.fib500[i] = l + range * 0.5; result.fib382[i] = l + range * 0.382;
                result.fib236[i] = l + range * 0.236;
            }
            return result;
        },
    },

    zigzag: {
        id: 'zigzag', name: 'ZigZag', shortName: 'ZigZag', category: 'overlay', mode: 'overlay',
        params: {
            deviation: { default: 5, min: 1, max: 20, step: 0.5, label: 'Deviation %' },
            depth: { default: 12, min: 3, max: 50, step: 1, label: 'Depth' },
        },
        outputs: [{ key: 'line', label: 'ZigZag', color: '#FF4081', type: 'line' }],
        compute(bars, params) {
            const result = C.zigzag(bars, params.deviation, params.depth);
            return { line: result.line, _points: result.points };
        },
    },
};
