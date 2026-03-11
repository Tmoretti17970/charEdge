// ═══════════════════════════════════════════════════════════════════
// Advanced Indicators — Exotic + Signal Integration
// Heikin-Ashi, Market Profile, MAMA, Hurst, Renko,
// FVG, Wick Rejection, Confluence Score, Signal Quality
// ═══════════════════════════════════════════════════════════════════

import * as C from '../computations.js';

export const EXOTIC_INDICATORS = {
    // ─── Architecture & Performance ───────────────────────────────
    heikinAshi: {
        id: 'heikinAshi', name: 'Heikin-Ashi', shortName: 'HA',
        category: 'overlay', mode: 'overlay', params: {},
        outputs: [
            { key: 'haOpen', label: 'HA Open', color: '#26A69A', width: 1, type: 'line', hidden: true },
            { key: 'haHigh', label: 'HA High', color: '#26A69A', width: 1, type: 'line', hidden: true },
            { key: 'haLow', label: 'HA Low', color: '#EF5350', width: 1, type: 'line', hidden: true },
            { key: 'haClose', label: 'HA Close', color: '#26A69A', width: 1, type: 'line' },
        ],
        compute(bars) { return C.heikinAshi(bars); },
    },

    marketProfile: {
        id: 'marketProfile', name: 'Market Profile', shortName: 'TPO',
        category: 'volume', mode: 'pane',
        params: {
            tickSize: { default: 1, min: 0.01, max: 100, step: 0.01, label: 'Tick Size' },
            sessionBars: { default: 390, min: 10, max: 2000, step: 1, label: 'Session Bars' },
        },
        outputs: [
            { key: 'poc', label: 'POC', color: '#FF7043', width: 2, type: 'line' },
            { key: 'valueAreaHigh', label: 'VA High', color: '#26A69A', width: 1, type: 'line', dash: [4, 4] },
            { key: 'valueAreaLow', label: 'VA Low', color: '#EF5350', width: 1, type: 'line', dash: [4, 4] },
        ],
        compute(bars, params) {
            const result = C.marketProfile(bars, { tickSize: params.tickSize, sessionBars: params.sessionBars });
            return { poc: result.poc, valueAreaHigh: result.valueAreaHigh, valueAreaLow: result.valueAreaLow };
        },
    },

    mama: {
        id: 'mama', name: 'MAMA (Mesa Adaptive)', shortName: 'MAMA',
        category: 'adaptive', mode: 'overlay',
        params: {
            fastLimit: { default: 0.5, min: 0.01, max: 1, step: 0.01, label: 'Fast Limit' },
            slowLimit: { default: 0.05, min: 0.01, max: 0.5, step: 0.01, label: 'Slow Limit' },
        },
        outputs: [
            { key: 'mama', label: 'MAMA', color: '#42A5F5', width: 2, type: 'line' },
            { key: 'fama', label: 'FAMA', color: '#EF5350', width: 1, type: 'line', dash: [4, 4] },
        ],
        compute(bars, params) { return C.mama(C.closes(bars), params.fastLimit, params.slowLimit); },
    },

    // ─── Exotic ───────────────────────────────────────────────────
    hurstExponent: {
        id: 'hurstExponent', name: 'Hurst Exponent', shortName: 'Hurst',
        category: 'exotic', mode: 'pane',
        params: { windowSize: { default: 100, min: 20, max: 500, step: 10, label: 'Window' } },
        outputs: [{ key: 'hurst', label: 'H', color: '#AB47BC', width: 2, type: 'line' }],
        paneConfig: {
            minHeight: 60,
            bands: [
                { value: 0.5, color: 'rgba(120, 123, 134, 0.4)', dash: [4, 4] },
                { value: 0.65, color: 'rgba(38, 166, 154, 0.25)', dash: [2, 4] },
                { value: 0.35, color: 'rgba(239, 83, 80, 0.25)', dash: [2, 4] },
            ],
        },
        compute(bars, params) { return C.hurstExponent(C.closes(bars), params.windowSize); },
    },

    renkoBrickCount: {
        id: 'renkoBrickCount', name: 'Renko Brick Count', shortName: 'Renko',
        category: 'exotic', mode: 'pane',
        params: { brickSize: { default: 1, min: 0.01, max: 1000, step: 0.01, label: 'Brick Size' } },
        outputs: [
            { key: 'bricks', label: 'Net Bricks', color: '#42A5F5', width: 2, type: 'line' },
            { key: 'direction', label: 'Direction', color: '#FF7043', width: 1, type: 'histogram' },
            { key: 'brickCount', label: 'Total', color: '#78909C', width: 1, type: 'line', hidden: true },
        ],
        paneConfig: {
            minHeight: 60, bands: [{ value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }],
        },
        compute(bars, params) { return C.renkoBrickCount(C.closes(bars), params.brickSize); },
    },

    // ─── Signal Integration ───────────────────────────────────────
    fvgDetector: {
        id: 'fvgDetector', name: 'Fair Value Gap', shortName: 'FVG',
        category: 'signals', mode: 'pane',
        params: { minGapPct: { default: 0.1, min: 0.01, max: 2.0, step: 0.01, label: 'Min Gap %' } },
        outputs: [
            { key: 'bullishCount', label: 'Bullish FVGs', color: '#26A69A', width: 2, type: 'line' },
            { key: 'bearishCount', label: 'Bearish FVGs', color: '#EF5350', width: 2, type: 'line' },
            { key: 'openCount', label: 'Open Gaps', color: '#AB47BC', width: 1, type: 'histogram' },
        ],
        paneConfig: { minHeight: 50, bands: [{ value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }] },
        compute(bars, params) {
            const fvgs = C.detectFVGs(bars, params.minGapPct);
            const n = bars.length;
            const bullishCount = new Array(n).fill(0);
            const bearishCount = new Array(n).fill(0);
            const openCount = new Array(n).fill(0);
            for (const fvg of fvgs) {
                const endIdx = fvg.filled ? fvg.fillIdx : n - 1;
                for (let i = fvg.startIdx; i <= endIdx; i++) {
                    if (fvg.type === 'bullish') bullishCount[i]++;
                    else bearishCount[i]++;
                    if (!fvg.filled) openCount[i]++;
                }
            }
            return { bullishCount, bearishCount, openCount };
        },
    },

    wickRejection: {
        id: 'wickRejection', name: 'Wick Rejection', shortName: 'WickRej',
        category: 'signals', mode: 'pane',
        params: { minRatio: { default: 2.0, min: 1.0, max: 5.0, step: 0.1, label: 'Min Ratio' } },
        outputs: [
            { key: 'upper', label: 'Upper Rej', color: '#EF5350', width: 2, type: 'histogram' },
            { key: 'lower', label: 'Lower Rej', color: '#26A69A', width: 2, type: 'histogram' },
        ],
        paneConfig: { minHeight: 50, bands: [{ value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }] },
        compute(bars, params) {
            const rejections = C.detectWickRejections(bars, params.minRatio);
            const n = bars.length;
            const upper = new Array(n).fill(0);
            const lower = new Array(n).fill(0);
            for (const rej of rejections) {
                if (rej.type === 'upper') upper[rej.idx] = rej.ratio;
                else lower[rej.idx] = -rej.ratio;
            }
            return { upper, lower };
        },
    },

    confluenceScore: {
        id: 'confluenceScore', name: 'Confluence Score', shortName: 'Conflu',
        category: 'signals', mode: 'pane', params: {},
        outputs: [
            { key: 'score', label: 'Score', color: '#FFB74D', width: 2, type: 'line' },
            { key: 'bias', label: 'Bias', color: '#42A5F5', width: 1, type: 'histogram' },
        ],
        paneConfig: { minHeight: 50, bands: [{ value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }] },
        compute(bars) {
            const n = bars.length;
            const score = new Array(n).fill(0);
            const bias = new Array(n).fill(0);
            const rsi = C.rsi(bars.map(b => b.close), 14);
            const macd = C.macd(bars.map(b => b.close), 12, 26, 9);
            const adxRes = C.adx(bars, 14);
            for (let i = 0; i < n; i++) {
                let s = 0, b = 0;
                if (!isNaN(rsi[i])) {
                    if (rsi[i] > 50) { s++; b++; } else if (rsi[i] < 50) { s++; b--; }
                    if (rsi[i] > 70) s++;
                    if (rsi[i] < 30) s++;
                }
                if (macd.histogram?.[i]) {
                    if (macd.histogram[i] > 0) { s++; b++; } else { s++; b--; }
                }
                if (adxRes?.adx?.[i] > 25) { s++; }
                score[i] = s;
                bias[i] = b;
            }
            return { score, bias };
        },
    },

    signalQuality: {
        id: 'signalQuality', name: 'Signal Quality', shortName: 'SigQ',
        category: 'signals', mode: 'pane', params: {},
        outputs: [{ key: 'quality', label: 'Quality', color: '#66BB6A', width: 2, type: 'line' }],
        paneConfig: {
            minHeight: 50,
            bands: [
                { value: 0.7, color: 'rgba(38, 166, 154, 0.25)', dash: [2, 4] },
                { value: 0.3, color: 'rgba(239, 83, 80, 0.25)', dash: [2, 4] },
            ],
        },
        compute(bars) {
            const n = bars.length;
            const quality = new Array(n).fill(0);
            const closes = bars.map(b => b.close);
            const rsi = C.rsi(closes, 14);
            const macd = C.macd(closes, 12, 26, 9);
            const vol20 = C.sma(bars.map(b => b.volume || 0), 20);
            for (let i = 0; i < n; i++) {
                let factors = 0, total = 0;
                if (!isNaN(rsi[i])) {
                    total++;
                    const rsiSignal = rsi[i] > 70 || rsi[i] < 30 ? 1 : rsi[i] > 60 || rsi[i] < 40 ? 0.5 : 0;
                    factors += rsiSignal;
                }
                if (macd.histogram?.[i] !== undefined) {
                    total++;
                    const prev = macd.histogram[i - 1] || 0;
                    const curr = macd.histogram[i];
                    if ((prev < 0 && curr > 0) || (prev > 0 && curr < 0)) factors += 1;
                    else if (Math.abs(curr) > Math.abs(prev)) factors += 0.5;
                }
                if (vol20[i] > 0 && bars[i].volume) {
                    total++;
                    const rvol = bars[i].volume / vol20[i];
                    factors += rvol > 2 ? 1 : rvol > 1.5 ? 0.75 : rvol > 1 ? 0.5 : 0.25;
                }
                const trendStrength = i >= 20
                    ? Math.abs(closes[i] - closes[i - 20]) / (closes[i - 20] || 1)
                    : 0;
                total++;
                factors += trendStrength > 0.05 ? 1 : trendStrength > 0.02 ? 0.5 : 0;
                quality[i] = total > 0 ? factors / total : 0;
            }
            return { quality };
        },
    },
};
