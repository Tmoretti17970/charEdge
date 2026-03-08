// ═══════════════════════════════════════════════════════════════════
// charEdge — Indicator Templates (Strategy Item #11)
//
// Built-in preset configurations for common indicators.
// Each template provides a name, description, and a set of overrides
// that can be applied via applyOverrides(idx, overrides).
//
// Custom templates are stored in localStorage via the indicatorSlice
// saveIndicatorTemplate / loadIndicatorTemplate actions.
// ═══════════════════════════════════════════════════════════════════

export interface IndicatorTemplate {
    name: string;
    description: string;
    overrides: Record<string, unknown>;
}

/**
 * Built-in templates organized by indicator ID.
 * These provide common configurations out-of-the-box.
 */
export const BUILT_IN_TEMPLATES: Record<string, IndicatorTemplate[]> = {
    // ─── RSI ──────────────────────────────────────────────────────
    rsi: [
        {
            name: 'Default (14)',
            description: 'Standard 14-period RSI with 70/30 bands',
            overrides: {
                'params.period': 14,
                'outputStyles.rsi.color': '#7E57C2',
                'outputStyles.rsi.width': 2,
            },
        },
        {
            name: 'Aggressive (7)',
            description: 'Short-period RSI for day trading',
            overrides: {
                'params.period': 7,
                'outputStyles.rsi.color': '#FF6D00',
                'outputStyles.rsi.width': 2,
            },
        },
        {
            name: 'Smooth (21)',
            description: 'Longer period RSI for swing trading',
            overrides: {
                'params.period': 21,
                'outputStyles.rsi.color': '#26A69A',
                'outputStyles.rsi.width': 2,
            },
        },
    ],

    // ─── MACD ─────────────────────────────────────────────────────
    macd: [
        {
            name: 'Default (12, 26, 9)',
            description: 'Standard MACD with signal line',
            overrides: {
                'params.fast': 12,
                'params.slow': 26,
                'params.signal': 9,
                'outputStyles.macd.color': '#2962FF',
                'outputStyles.signal.color': '#FF6D00',
            },
        },
        {
            name: 'Fast (5, 13, 5)',
            description: 'Faster MACD for volatile markets',
            overrides: {
                'params.fast': 5,
                'params.slow': 13,
                'params.signal': 5,
                'outputStyles.macd.color': '#00BCD4',
                'outputStyles.signal.color': '#FF5252',
            },
        },
    ],

    // ─── SMA ──────────────────────────────────────────────────────
    sma: [
        {
            name: 'Short (20)',
            description: '20-period SMA for short-term trends',
            overrides: { 'params.period': 20, 'color': '#f59e0b' },
        },
        {
            name: 'Medium (50)',
            description: '50-period SMA for medium-term trends',
            overrides: { 'params.period': 50, 'color': '#a855f7' },
        },
        {
            name: 'Long (200)',
            description: '200-period SMA for long-term support/resistance',
            overrides: { 'params.period': 200, 'color': '#EF5350' },
        },
    ],

    // ─── EMA ──────────────────────────────────────────────────────
    ema: [
        {
            name: 'Short (12)',
            description: '12-period EMA for fast signal',
            overrides: { 'params.period': 12, 'color': '#26C6DA' },
        },
        {
            name: 'Medium (26)',
            description: '26-period EMA',
            overrides: { 'params.period': 26, 'color': '#AB47BC' },
        },
        {
            name: 'Long (50)',
            description: '50-period EMA for trend following',
            overrides: { 'params.period': 50, 'color': '#66BB6A' },
        },
    ],

    // ─── Bollinger Bands ──────────────────────────────────────────
    bbands: [
        {
            name: 'Default (20, 2σ)',
            description: 'Standard 20-period with 2 standard deviations',
            overrides: {
                'params.period': 20,
                'params.stdDev': 2,
                'outputStyles.upper.color': '#42A5F5',
                'outputStyles.lower.color': '#42A5F5',
                'outputStyles.middle.color': '#FFB74D',
            },
        },
        {
            name: 'Tight (20, 1σ)',
            description: 'Narrow bands for breakout detection',
            overrides: {
                'params.period': 20,
                'params.stdDev': 1,
                'outputStyles.upper.color': '#EF5350',
                'outputStyles.lower.color': '#EF5350',
                'outputStyles.middle.color': '#BDBDBD',
            },
        },
    ],

    // ─── Stochastic ───────────────────────────────────────────────
    stochastic: [
        {
            name: 'Default (14, 3, 3)',
            description: 'Standard stochastic oscillator',
            overrides: {
                'params.kPeriod': 14,
                'params.dPeriod': 3,
                'params.smooth': 3,
                'outputStyles.k.color': '#2962FF',
                'outputStyles.d.color': '#FF6D00',
            },
        },
        {
            name: 'Fast (5, 3, 3)',
            description: 'Fast stochastic for scalping',
            overrides: {
                'params.kPeriod': 5,
                'params.dPeriod': 3,
                'params.smooth': 1,
                'outputStyles.k.color': '#00E676',
                'outputStyles.d.color': '#FF1744',
            },
        },
    ],

    // ─── ATR ──────────────────────────────────────────────────────
    atr: [
        {
            name: 'Default (14)',
            description: 'Standard 14-period ATR',
            overrides: { 'params.period': 14, 'outputStyles.atr.color': '#B39DDB' },
        },
        {
            name: 'Short (7)',
            description: 'Responsive ATR for volatile assets',
            overrides: { 'params.period': 7, 'outputStyles.atr.color': '#FF8A65' },
        },
    ],
};

/**
 * Get built-in templates for an indicator.
 * Returns empty array if no templates are defined.
 */
export function getBuiltInTemplates(indicatorId: string): IndicatorTemplate[] {
    return BUILT_IN_TEMPLATES[indicatorId] || [];
}

/**
 * Get all templates (built-in + user-saved) for an indicator.
 * User templates override built-in templates with the same name.
 */
export function getAllTemplates(indicatorId: string): IndicatorTemplate[] {
    const builtIn = getBuiltInTemplates(indicatorId);

    // Load user-saved templates from localStorage
    const key = `indTemplate:${indicatorId}`;
    let userTemplates: IndicatorTemplate[] = [];
    try {
        const saved = JSON.parse(localStorage.getItem(key) || '{}');
        userTemplates = Object.entries(saved).map(([name, config]) => ({
            name,
            description: 'User template',
            overrides: config as Record<string, unknown>,
        }));
    } catch {
        // Ignore parse errors
    }

    // Merge: user templates with same name override built-in
    const userNames = new Set(userTemplates.map(t => t.name));
    const merged = builtIn.filter(t => !userNames.has(t.name));
    return [...merged, ...userTemplates];
}
