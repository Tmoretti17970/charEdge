// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Built-in Script Library
//
// Defines the set of built-in indicator scripts that ship with
// charEdge.  Each entry follows the script data shape expected by
// useScriptStore:
//   { id, name, description, category, builtin, enabled,
//     code, params, createdAt, updatedAt }
// ═══════════════════════════════════════════════════════════════════

const CREATED = '2025-01-01T00:00:00.000Z';

/** @type {Array<import('../../state/useScriptStore').Script>} */
export const BUILTIN_SCRIPTS = [
    // ─── Trend ─────────────────────────────────────────────────
    {
        id: 'builtin_sma',
        name: 'Simple Moving Average',
        description: 'Arithmetic mean of the last N closing prices.',
        category: 'trend',
        builtin: true,
        enabled: false,
        params: { period: 20 },
        code: `const period = param('period', 20, { min: 2, max: 500, label: 'Period' });
const values = sma(close, period);
plot(values, { color: '#3b82f6', label: 'SMA ' + period });`,
        createdAt: CREATED,
        updatedAt: CREATED,
    },
    {
        id: 'builtin_ema',
        name: 'Exponential Moving Average',
        description: 'Weighted moving average that gives more weight to recent prices.',
        category: 'trend',
        builtin: true,
        enabled: false,
        params: { period: 20 },
        code: `const period = param('period', 20, { min: 2, max: 500, label: 'Period' });
const values = ema(close, period);
plot(values, { color: '#f59e0b', label: 'EMA ' + period });`,
        createdAt: CREATED,
        updatedAt: CREATED,
    },
    {
        id: 'builtin_dema',
        name: 'Double EMA',
        description: 'Two-stage EMA for reduced lag.',
        category: 'trend',
        builtin: true,
        enabled: false,
        params: { period: 21 },
        code: `const period = param('period', 21, { min: 2, max: 500, label: 'Period' });
const e1 = ema(close, period);
const e2 = ema(e1, period);
const values = e1.map((v, i) => 2 * v - (e2[i] ?? v));
plot(values, { color: '#8b5cf6', label: 'DEMA ' + period });`,
        createdAt: CREATED,
        updatedAt: CREATED,
    },

    // ─── Oscillators ───────────────────────────────────────────
    {
        id: 'builtin_rsi',
        name: 'Relative Strength Index',
        description: 'Momentum oscillator measuring speed and magnitude of price changes.',
        category: 'oscillator',
        builtin: true,
        enabled: false,
        params: { period: 14, overbought: 70, oversold: 30 },
        code: `const period = param('period', 14, { min: 2, max: 100, label: 'Period' });
const ob = param('overbought', 70, { min: 50, max: 90, label: 'Overbought' });
const os = param('oversold', 30, { min: 10, max: 50, label: 'Oversold' });
const values = rsi(close, period);
plot(values, { color: '#a855f7', label: 'RSI', panel: 'below' });
hline(ob, { color: '#ef4444', style: 'dashed' });
hline(os, { color: '#22c55e', style: 'dashed' });`,
        createdAt: CREATED,
        updatedAt: CREATED,
    },
    {
        id: 'builtin_macd',
        name: 'MACD',
        description: 'Moving Average Convergence Divergence — trend-following momentum indicator.',
        category: 'oscillator',
        builtin: true,
        enabled: false,
        params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
        code: `const fast = param('fastPeriod', 12, { min: 2, max: 50, label: 'Fast' });
const slow = param('slowPeriod', 26, { min: 2, max: 100, label: 'Slow' });
const sig = param('signalPeriod', 9, { min: 2, max: 50, label: 'Signal' });
const macdLine = ema(close, fast).map((v, i) => v - (ema(close, slow)[i] ?? 0));
const signalLine = ema(macdLine, sig);
const hist = macdLine.map((v, i) => v - (signalLine[i] ?? 0));
plot(macdLine, { color: '#3b82f6', label: 'MACD', panel: 'below' });
plot(signalLine, { color: '#f97316', label: 'Signal', panel: 'below' });
histogram(hist, { colorUp: '#22c55e', colorDown: '#ef4444', panel: 'below' });`,
        createdAt: CREATED,
        updatedAt: CREATED,
    },

    // ─── Volatility ────────────────────────────────────────────
    {
        id: 'builtin_bollinger',
        name: 'Bollinger Bands',
        description: 'Volatility bands placed above and below a simple moving average.',
        category: 'volatility',
        builtin: true,
        enabled: false,
        params: { period: 20, multiplier: 2 },
        code: `const period = param('period', 20, { min: 2, max: 200, label: 'Period' });
const mult = param('multiplier', 2, { min: 0.5, max: 5, step: 0.1, label: 'Std Dev' });
const { upper, middle, lower } = bollinger(close, period, mult);
plot(middle, { color: '#6366f1', label: 'BB Mid' });
band(upper, lower, { color: 'rgba(99,102,241,0.12)', label: 'BB Band' });`,
        createdAt: CREATED,
        updatedAt: CREATED,
    },
    {
        id: 'builtin_atr',
        name: 'Average True Range',
        description: 'Measures market volatility by the average range of price bars.',
        category: 'volatility',
        builtin: true,
        enabled: false,
        params: { period: 14 },
        code: `const period = param('period', 14, { min: 1, max: 100, label: 'Period' });
const values = atr(high, low, close, period);
plot(values, { color: '#14b8a6', label: 'ATR', panel: 'below' });`,
        createdAt: CREATED,
        updatedAt: CREATED,
    },

    // ─── Volume ────────────────────────────────────────────────
    {
        id: 'builtin_vwap',
        name: 'VWAP',
        description: 'Volume-weighted average price — intraday benchmark.',
        category: 'volume',
        builtin: true,
        enabled: false,
        params: {},
        code: `const typical = bars.map(b => (b.high + b.low + b.close) / 3);
let cumVol = 0, cumTP = 0;
const values = typical.map((tp, i) => {
  cumTP += tp * volume[i];
  cumVol += volume[i];
  return cumVol ? cumTP / cumVol : tp;
});
plot(values, { color: '#0ea5e9', label: 'VWAP', lineWidth: 2 });`,
        createdAt: CREATED,
        updatedAt: CREATED,
    },
];
