// ═══════════════════════════════════════════════════════════════════
// Advanced Indicators — Core (Session VWAP, vwRSI, F&G, Liquidity, CV)
// Phase 2 Deep Dive — 6 indicators
// ═══════════════════════════════════════════════════════════════════

import * as C from '../computations.js';

export const CORE_INDICATORS = {
    sessionVwap: {
        id: 'sessionVwap', name: 'Session VWAP', shortName: 'sVWAP', mode: 'overlay',
        params: { resetHour: { default: 0, min: 0, max: 23, step: 1, label: 'Reset Hour (UTC)' } },
        outputs: [
            { key: 'vwap', label: 'sVWAP', color: '#FF6D00', width: 2, type: 'line' },
            { key: 'upper', label: 'Upper', color: '#FF6D00', width: 1, type: 'line', dash: [4, 4] },
            { key: 'lower', label: 'Lower', color: '#FF6D00', width: 1, type: 'line', dash: [4, 4] },
        ],
        fills: [{ upper: 'upper', lower: 'lower', color: 'rgba(255, 109, 0, 0.06)' }],
        compute(bars, params) { return C.sessionVWAP(bars, params.resetHour); },
    },

    anchoredVwap: {
        id: 'anchoredVwap', name: 'Anchored VWAP', shortName: 'aVWAP', mode: 'overlay',
        params: { anchorTime: { default: null, label: 'Anchor Time' } },
        outputs: [
            { key: 'vwap', label: 'aVWAP', color: '#E040FB', width: 2, type: 'line' },
            { key: 'upper1', label: '+1σ', color: '#E040FB', width: 1, type: 'line', dash: [4, 4] },
            { key: 'lower1', label: '-1σ', color: '#E040FB', width: 1, type: 'line', dash: [4, 4] },
        ],
        fills: [{ upper: 'upper1', lower: 'lower1', color: 'rgba(224, 64, 251, 0.06)' }],
        compute(bars, params) {
            const result = C.vwapBands(bars, params.anchorTime);
            return { vwap: result.vwap, upper1: result.upper1, lower1: result.lower1 };
        },
    },

    vwRsi: {
        id: 'vwRsi', name: 'Volume-Weighted RSI', shortName: 'vwRSI', mode: 'pane',
        params: { period: { default: 14, min: 2, max: 100, step: 1, label: 'Period' } },
        outputs: [{ key: 'vwRsi', label: 'vwRSI', color: '#00BCD4', width: 2, type: 'line' }],
        paneConfig: {
            min: 0, max: 100,
            bands: [
                { value: 70, color: 'rgba(239, 83, 80, 0.3)', dash: [4, 4] },
                { value: 30, color: 'rgba(38, 166, 154, 0.3)', dash: [4, 4] },
                { value: 50, color: 'rgba(120, 123, 134, 0.2)', dash: [2, 4] },
            ],
        },
        compute(bars, params) { return { vwRsi: C.volumeWeightedRSI(bars, params.period) }; },
    },

    fearGreed: {
        id: 'fearGreed', name: 'Fear & Greed Index', shortName: 'F&G', mode: 'pane',
        params: { period: { default: 14, min: 5, max: 50, step: 1, label: 'Period' } },
        outputs: [{ key: 'index', label: 'F&G', color: '#FFD54F', width: 2, type: 'line' }],
        paneConfig: {
            min: 0, max: 100,
            bands: [
                { value: 80, color: 'rgba(76, 175, 80, 0.2)', dash: [4, 4] },
                { value: 60, color: 'rgba(255, 213, 79, 0.15)', dash: [2, 4] },
                { value: 40, color: 'rgba(255, 213, 79, 0.15)', dash: [2, 4] },
                { value: 20, color: 'rgba(239, 83, 80, 0.2)', dash: [4, 4] },
            ],
            fills: [
                { above: 80, color: 'rgba(76, 175, 80, 0.06)' },
                { below: 20, color: 'rgba(239, 83, 80, 0.06)' },
            ],
        },
        compute(bars, params) { return C.fearGreedIndex(bars, params.period); },
    },

    liquidationLevels: {
        id: 'liquidationLevels', name: 'Liquidation Levels', shortName: 'Liq', mode: 'overlay',
        params: { leverages: { default: '5,10,25,50', label: 'Leverages (comma-separated)' } },
        outputs: [
            { key: 'longLiq', label: 'Long Liq', color: '#EF5350', width: 1, type: 'line', dash: [6, 3] },
            { key: 'shortLiq', label: 'Short Liq', color: '#26A69A', width: 1, type: 'line', dash: [6, 3] },
        ],
        compute(bars, params) {
            const leverages = String(params.leverages).split(',').map(Number).filter(n => n > 0);
            const mainLev = leverages[0] || 10;
            const len = bars.length;
            const longLiq = new Array(len).fill(NaN);
            const shortLiq = new Array(len).fill(NaN);
            for (let i = 0; i < len; i++) {
                const price = bars[i].close;
                longLiq[i] = price * (1 - 1 / mainLev);
                shortLiq[i] = price * (1 + 1 / mainLev);
            }
            return { longLiq, shortLiq };
        },
    },

    chaikinVol: {
        id: 'chaikinVol', name: 'Chaikin Volatility', shortName: 'CV', mode: 'pane',
        params: {
            emaPeriod: { default: 10, min: 2, max: 50, step: 1, label: 'EMA Period' },
            rocPeriod: { default: 10, min: 2, max: 50, step: 1, label: 'ROC Period' },
        },
        outputs: [{ key: 'cv', label: 'CV', color: '#FF7043', width: 2, type: 'line' }],
        paneConfig: { bands: [{ value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }] },
        compute(bars, params) { return { cv: C.chaikinVolatility(bars, params.emaPeriod, params.rocPeriod) }; },
    },
};
