// ═══════════════════════════════════════════════════════════════════
// Advanced Indicators — Adaptive + Computation + Tier 2
// KAMA, VIDYA, FRAMA, Adaptive RSI, Dynamic ATR, Regime Switcher,
// Sigma Bands, RVOL, McGinley, Connors RSI, STC, Fisher, RVI
// ═══════════════════════════════════════════════════════════════════

import * as C from '../computations.js';

export const ADAPTIVE_INDICATORS = {
    // ─── Adaptive ─────────────────────────────────────────────────
    kama: {
        id: 'kama', name: 'KAMA (Kaufman Adaptive MA)', shortName: 'KAMA',
        category: 'adaptive', mode: 'overlay',
        params: {
            period: { default: 10, min: 2, max: 100, step: 1, label: 'ER Period' },
            fastPeriod: { default: 2, min: 2, max: 10, step: 1, label: 'Fast Period' },
            slowPeriod: { default: 30, min: 10, max: 100, step: 1, label: 'Slow Period' },
        },
        outputs: [{ key: 'kama', label: 'KAMA', color: '#FF6B35', type: 'line' }],
        compute(bars, params) {
            return { kama: C.kama(bars.map(b => b.close), params.period, params.fastPeriod, params.slowPeriod) };
        },
    },

    vidya: {
        id: 'vidya', name: 'VIDYA (Variable Index Dynamic Average)', shortName: 'VIDYA',
        category: 'adaptive', mode: 'overlay',
        params: {
            period: { default: 14, min: 2, max: 100, step: 1, label: 'Period' },
            cmoPeriod: { default: 9, min: 2, max: 50, step: 1, label: 'CMO Period' },
        },
        outputs: [{ key: 'vidya', label: 'VIDYA', color: '#00D2FF', type: 'line' }],
        compute(bars, params) {
            return { vidya: C.vidya(bars.map(b => b.close), params.period, params.cmoPeriod) };
        },
    },

    frama: {
        id: 'frama', name: 'FRAMA (Fractal Adaptive MA)', shortName: 'FRAMA',
        category: 'adaptive', mode: 'overlay',
        params: { period: { default: 16, min: 4, max: 100, step: 2, label: 'Period' } },
        outputs: [{ key: 'frama', label: 'FRAMA', color: '#A855F7', type: 'line' }],
        compute(bars, params) {
            return { frama: C.frama(bars.map(b => b.close), params.period) };
        },
    },

    adaptiveRsi: {
        id: 'adaptiveRsi', name: 'Adaptive RSI', shortName: 'ARSI',
        category: 'adaptive', mode: 'pane',
        params: {
            basePeriod: { default: 14, min: 2, max: 50, step: 1, label: 'Base Period' },
            minPeriod: { default: 5, min: 2, max: 20, step: 1, label: 'Min Period' },
            maxPeriod: { default: 30, min: 10, max: 50, step: 1, label: 'Max Period' },
        },
        paneConfig: {
            min: 0, max: 100, bands: [
                { value: 70, color: 'rgba(255,77,77,0.3)' },
                { value: 30, color: 'rgba(77,255,77,0.3)' },
                { value: 50, color: 'rgba(128,128,128,0.15)' },
            ]
        },
        outputs: [{ key: 'values', label: 'ARSI', color: '#FF6B35', type: 'line' }],
        compute(bars, params) {
            return { values: C.adaptiveRsi(bars, params.basePeriod, 14, params.minPeriod, params.maxPeriod).values };
        },
    },

    // ─── Advanced Computation ─────────────────────────────────────
    dynamicATR: {
        id: 'dynamicATR', name: 'Dynamic ATR', shortName: 'dATR',
        category: 'volatility', mode: 'pane',
        params: {
            basePeriod: { default: 14, min: 5, max: 50, step: 1, label: 'Base Period' },
            lookback: { default: 100, min: 20, max: 500, step: 10, label: 'Lookback' },
            minPeriod: { default: 7, min: 3, max: 20, step: 1, label: 'Min Period' },
            maxPeriod: { default: 28, min: 14, max: 56, step: 1, label: 'Max Period' },
        },
        paneConfig: { min: 0 },
        outputs: [{ key: 'atr', label: 'dATR', color: '#FFB74D', type: 'line' }],
        compute(bars, params) {
            return { atr: C.dynamicATR(bars, params.basePeriod, params.lookback, params.minPeriod, params.maxPeriod).atr };
        },
    },

    regimeSwitcher: {
        id: 'regimeSwitcher', name: 'Regime Switcher', shortName: 'Regime',
        category: 'trend', mode: 'pane',
        params: {
            adxPeriod: { default: 14, min: 5, max: 50, step: 1, label: 'ADX Period' },
            trendThreshold: { default: 25, min: 15, max: 40, step: 1, label: 'Trend Threshold' },
            rangeThreshold: { default: 20, min: 10, max: 35, step: 1, label: 'Range Threshold' },
        },
        paneConfig: {
            min: 0, max: 100, bands: [
                { value: 25, color: 'rgba(77,255,77,0.2)' },
                { value: 20, color: 'rgba(255,77,77,0.2)' },
            ]
        },
        outputs: [
            { key: 'adx', label: 'ADX', color: '#42A5F5', type: 'line' },
            { key: 'strength', label: 'Strength', color: '#66BB6A', type: 'histogram' },
        ],
        compute(bars, params) {
            const result = C.regimeSwitcher(bars, params.adxPeriod, params.trendThreshold, params.rangeThreshold);
            return { adx: result.adx, strength: result.strength };
        },
    },

    sigmaBands: {
        id: 'sigmaBands', name: 'Sigma Bands (Z-Score)', shortName: 'σ Bands',
        category: 'volatility', mode: 'overlay',
        params: { period: { default: 20, min: 5, max: 100, step: 1, label: 'Period' } },
        outputs: [
            { key: 'mean', label: 'Mean', color: '#78909C', type: 'line' },
            { key: 'upper2', label: '+2σ', color: '#EF5350', type: 'line' },
            { key: 'lower2', label: '−2σ', color: '#26A69A', type: 'line' },
            { key: 'upper3', label: '+3σ', color: '#FF1744', type: 'line' },
            { key: 'lower3', label: '−3σ', color: '#00E676', type: 'line' },
        ],
        fills: [
            { upper: 'upper2', lower: 'lower2', color: 'rgba(158,158,158,0.08)' },
            { upper: 'upper3', lower: 'lower3', color: 'rgba(158,158,158,0.04)' },
        ],
        compute(bars, params) { return C.sigmaBands(bars.map(b => b.close), params.period); },
    },

    rvolFilter: {
        id: 'rvolFilter', name: 'Relative Volume (RVOL)', shortName: 'RVOL',
        category: 'volume', mode: 'pane',
        params: { period: { default: 20, min: 5, max: 100, step: 1, label: 'Period' } },
        paneConfig: {
            min: 0, bands: [
                { value: 1.0, color: 'rgba(128,128,128,0.3)' },
                { value: 1.5, color: 'rgba(255,152,0,0.3)' },
                { value: 3.0, color: 'rgba(255,77,77,0.3)' },
            ]
        },
        outputs: [{ key: 'rvol', label: 'RVOL', color: '#7E57C2', type: 'histogram' }],
        compute(bars, params) { return { rvol: C.rvolFilter(bars, params.period).rvol }; },
    },

    // ─── Tier 2 ───────────────────────────────────────────────────
    mcginleyDynamic: {
        id: 'mcginleyDynamic', name: 'McGinley Dynamic', shortName: 'McGinley',
        category: 'tier2', mode: 'overlay',
        params: { period: { default: 14, min: 2, max: 200, step: 1, label: 'Period' } },
        outputs: [{ key: 'values', label: 'McGinley', color: '#26C6DA', width: 2, type: 'line' }],
        compute(bars, params) { return C.mcginleyDynamic(C.closes(bars), params.period); },
    },

    connorsRsi: {
        id: 'connorsRsi', name: 'Connors RSI', shortName: 'CRSI',
        category: 'tier2', mode: 'pane',
        params: {
            rsiPeriod: { default: 3, min: 2, max: 50, step: 1, label: 'RSI Period' },
            streakPeriod: { default: 2, min: 2, max: 50, step: 1, label: 'Streak Period' },
            pctRankPeriod: { default: 100, min: 10, max: 500, step: 1, label: 'Pct Rank Period' },
        },
        outputs: [{ key: 'values', label: 'CRSI', color: '#AB47BC', width: 1.5, type: 'line' }],
        paneConfig: {
            min: 0, max: 100,
            bands: [
                { value: 70, color: 'rgba(239, 83, 80, 0.3)', dash: [4, 4] },
                { value: 30, color: 'rgba(38, 166, 154, 0.3)', dash: [4, 4] },
            ],
        },
        compute(bars, params) { return C.connorsRsi(bars, params.rsiPeriod, params.streakPeriod, params.pctRankPeriod); },
    },

    schaffTrendCycle: {
        id: 'schaffTrendCycle', name: 'Schaff Trend Cycle', shortName: 'STC',
        category: 'tier2', mode: 'pane',
        params: {
            period: { default: 10, min: 2, max: 100, step: 1, label: 'Cycle Period' },
            fast: { default: 23, min: 2, max: 100, step: 1, label: 'Fast MA' },
            slow: { default: 50, min: 5, max: 200, step: 1, label: 'Slow MA' },
        },
        outputs: [{ key: 'values', label: 'STC', color: '#FF7043', width: 2, type: 'line' }],
        paneConfig: {
            min: 0, max: 100,
            bands: [
                { value: 75, color: 'rgba(239, 83, 80, 0.3)', dash: [4, 4] },
                { value: 25, color: 'rgba(38, 166, 154, 0.3)', dash: [4, 4] },
            ],
        },
        compute(bars, params) { return C.schaffTrendCycle(C.closes(bars), params.period, params.fast, params.slow); },
    },

    ehlersFisher: {
        id: 'ehlersFisher', name: 'Ehlers Fisher Transform', shortName: 'Fisher',
        category: 'tier2', mode: 'pane',
        params: { period: { default: 10, min: 2, max: 100, step: 1, label: 'Period' } },
        outputs: [
            { key: 'fisher', label: 'Fisher', color: '#42A5F5', width: 2, type: 'line' },
            { key: 'trigger', label: 'Trigger', color: '#EF5350', width: 1, type: 'line', dash: [4, 4] },
        ],
        paneConfig: { bands: [{ value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }] },
        compute(bars, params) { return C.ehlersFisher(bars, params.period); },
    },

    rvi: {
        id: 'rvi', name: 'Relative Vigor Index', shortName: 'RVI',
        category: 'tier2', mode: 'pane',
        params: { period: { default: 10, min: 2, max: 100, step: 1, label: 'Period' } },
        outputs: [
            { key: 'rvi', label: 'RVI', color: '#66BB6A', width: 2, type: 'line' },
            { key: 'signal', label: 'Signal', color: '#EF5350', width: 1, type: 'line', dash: [4, 4] },
        ],
        paneConfig: { bands: [{ value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] }] },
        compute(bars, params) { return C.rvi(bars, params.period); },
    },
};
