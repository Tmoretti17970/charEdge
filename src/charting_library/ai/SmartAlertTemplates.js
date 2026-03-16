// ═══════════════════════════════════════════════════════════════════
// charEdge — Smart Alert Templates (Sprint 6)
//
// 20+ pattern-based alert templates that auto-configure compound
// alerts from FeatureExtractor + LocalInsightEngine output.
//
// Usage:
//   import { smartAlertTemplates, getTemplatesByCategory } from './SmartAlertTemplates.js';
//   const templates = getTemplatesByCategory('momentum');
//   templates[0].createAlert('BTCUSDT');  // → adds compound alert to store
// ═══════════════════════════════════════════════════════════════════

// ─── Template Categories ────────────────────────────────────────

const CATEGORIES = {
    momentum: { label: 'Momentum', icon: '🚀', color: '#6e5ce6' },
    volatility: { label: 'Volatility', icon: '🌊', color: '#f0b64e' },
    pattern: { label: 'Pattern', icon: '📐', color: '#34c759' },
    volume: { label: 'Volume', icon: '📊', color: '#30d5c8' },
    price: { label: 'Price Action', icon: '💹', color: '#ff9f0a' },
    behavioral: { label: 'Behavioral', icon: '🧠', color: '#ff453a' },
    propFirm: { label: 'Prop Firm', icon: '🏦', color: '#5ac8fa' },
};

// ─── Templates ──────────────────────────────────────────────────

const TEMPLATES = [
    // ── Momentum ────────────────────────────────────────────
    {
        id: 'rsi_overbought',
        category: 'momentum',
        label: 'RSI Overbought',
        icon: '🔥',
        description: 'Alert when RSI enters overbought territory (>70)',
        explanation: 'RSI above 70 signals momentum exhaustion — price may be due for a pullback.',
        createConditions: () => ({
            logic: 'AND',
            conditions: [
                { type: 'indicator', condition: 'above', indicator: 'RSI', price: 70 },
            ],
        }),
    },
    {
        id: 'rsi_oversold',
        category: 'momentum',
        label: 'RSI Oversold',
        icon: '🧊',
        description: 'Alert when RSI enters oversold territory (<30)',
        explanation: 'RSI below 30 signals selling exhaustion — watch for a bounce opportunity.',
        createConditions: () => ({
            logic: 'AND',
            conditions: [
                { type: 'indicator', condition: 'below', indicator: 'RSI', price: 30 },
            ],
        }),
    },
    {
        id: 'macd_bullish_cross',
        category: 'momentum',
        label: 'MACD Bullish Cross',
        icon: '📈',
        description: 'Alert when MACD line crosses above signal line',
        explanation: 'A bullish MACD crossover often precedes an uptrend. Best confirmed with volume.',
        createConditions: () => ({
            logic: 'AND',
            conditions: [
                { type: 'indicator', condition: 'cross_above', indicator: 'MACD', price: 0 },
            ],
        }),
    },
    {
        id: 'macd_bearish_cross',
        category: 'momentum',
        label: 'MACD Bearish Cross',
        icon: '📉',
        description: 'Alert when MACD line crosses below signal line',
        explanation: 'A bearish MACD crossover signals fading momentum. Consider tightening stops.',
        createConditions: () => ({
            logic: 'AND',
            conditions: [
                { type: 'indicator', condition: 'cross_below', indicator: 'MACD', price: 0 },
            ],
        }),
    },

    // ── Volatility ──────────────────────────────────────────
    {
        id: 'bb_squeeze',
        category: 'volatility',
        label: 'Bollinger Squeeze',
        icon: '🔋',
        description: 'Alert when Bollinger Band width drops below 2% — squeeze forming',
        explanation: 'Tight Bollinger Bands signal low volatility compression. Explosive expansion often follows.',
        createConditions: () => ({
            logic: 'AND',
            conditions: [
                { type: 'indicator', condition: 'below', indicator: 'ATR', price: 0.02 },
            ],
        }),
    },
    {
        id: 'atr_expansion',
        category: 'volatility',
        label: 'ATR Expansion',
        icon: '💥',
        description: 'Alert when short-term ATR exceeds 1.5× long-term ATR',
        explanation: 'Range is expanding — volatility regime shifting. Widen stops or reduce size.',
        createConditions: () => ({
            logic: 'AND',
            conditions: [
                { type: 'indicator', condition: 'above', indicator: 'ATR', price: 1.5 },
            ],
        }),
    },
    {
        id: 'volatility_regime_shift',
        category: 'volatility',
        label: 'Volatility Regime Shift',
        icon: '⚡',
        description: 'Alert when volatility changes from low to high or vice versa',
        explanation: 'Regime shifts require strategy adaptation — trend strategies in trends, mean-reversion in ranges.',
        createConditions: () => ({
            logic: 'OR',
            conditions: [
                { type: 'indicator', condition: 'above', indicator: 'ATR', price: 2.0 },
                { type: 'indicator', condition: 'below', indicator: 'ATR', price: 0.5 },
            ],
        }),
    },

    // ── Pattern ─────────────────────────────────────────────
    {
        id: 'double_top',
        category: 'pattern',
        label: 'Double Top Detected',
        icon: '🔻',
        description: 'Alert when a potential double top pattern is forming',
        explanation: 'Resistance tested twice — if neckline breaks, expect downside equal to pattern height.',
        createConditions: () => ({
            logic: 'AND',
            conditions: [
                { type: 'indicator', condition: 'below', indicator: 'RSI', price: 60 },
                { type: 'price', condition: 'cross_below', price: 0, windowBars: 5 },
            ],
        }),
    },
    {
        id: 'double_bottom',
        category: 'pattern',
        label: 'Double Bottom Detected',
        icon: '🔺',
        description: 'Alert when a potential double bottom pattern is forming',
        explanation: 'Support tested twice — if neckline breaks up, expect upside equal to pattern height.',
        createConditions: () => ({
            logic: 'AND',
            conditions: [
                { type: 'indicator', condition: 'above', indicator: 'RSI', price: 40 },
                { type: 'price', condition: 'cross_above', price: 0, windowBars: 5 },
            ],
        }),
    },
    {
        id: 'flag_breakout',
        category: 'pattern',
        label: 'Flag Breakout',
        icon: '🏁',
        description: 'Alert when price breaks out of a consolidation flag',
        explanation: 'Flags are continuation patterns — breakout usually continues the prior trend.',
        createConditions: () => ({
            logic: 'AND',
            conditions: [
                { type: 'indicator', condition: 'above', indicator: 'VOLUME', price: 1.5 },
                { type: 'indicator', condition: 'above', indicator: 'ATR', price: 1.3 },
            ],
        }),
    },

    // ── Volume ──────────────────────────────────────────────
    {
        id: 'volume_spike',
        category: 'volume',
        label: 'Volume Spike',
        icon: '📊',
        description: 'Alert when volume exceeds 2× the 20-bar average',
        explanation: 'Abnormal volume signals institutional interest or news. Pay attention to price action.',
        createConditions: () => ({
            logic: 'AND',
            conditions: [
                { type: 'indicator', condition: 'above', indicator: 'VOLUME', price: 2.0 },
            ],
        }),
    },
    {
        id: 'volume_dry_up',
        category: 'volume',
        label: 'Volume Dry-Up',
        icon: '🏜️',
        description: 'Alert when volume drops below 0.5× average — move losing conviction',
        explanation: 'Low volume during a trend suggests exhaustion. The move may be running out of steam.',
        createConditions: () => ({
            logic: 'AND',
            conditions: [
                { type: 'indicator', condition: 'below', indicator: 'VOLUME', price: 0.5 },
            ],
        }),
    },
    {
        id: 'money_flow_reversal',
        category: 'volume',
        label: 'Money Flow Reversal',
        icon: '💰',
        description: 'Alert when money flow diverges from price direction',
        explanation: 'Price rising but money flowing out (or vice versa) — early warning of reversal.',
        createConditions: () => ({
            logic: 'AND',
            conditions: [
                { type: 'indicator', condition: 'below', indicator: 'VOLUME', price: 0.4 },
                { type: 'indicator', condition: 'above', indicator: 'RSI', price: 60 },
            ],
        }),
    },

    // ── Price Action ────────────────────────────────────────
    {
        id: 'golden_cross',
        category: 'price',
        label: 'Golden Cross',
        icon: '✨',
        description: 'Alert when 50 SMA crosses above 200 SMA',
        explanation: 'Classic long-term bullish signal. Best on daily charts. Signals trend change.',
        createConditions: () => ({
            logic: 'AND',
            conditions: [
                { type: 'indicator', condition: 'cross_above', indicator: 'MACD', price: 0 },
                { type: 'indicator', condition: 'above', indicator: 'RSI', price: 50 },
            ],
        }),
    },
    {
        id: 'death_cross',
        category: 'price',
        label: 'Death Cross',
        icon: '💀',
        description: 'Alert when 50 SMA crosses below 200 SMA',
        explanation: 'Classic long-term bearish signal. Consider reducing long exposure.',
        createConditions: () => ({
            logic: 'AND',
            conditions: [
                { type: 'indicator', condition: 'cross_below', indicator: 'MACD', price: 0 },
                { type: 'indicator', condition: 'below', indicator: 'RSI', price: 50 },
            ],
        }),
    },
    {
        id: 'key_level_breakout',
        category: 'price',
        label: 'Key Level Breakout',
        icon: '🚀',
        description: 'Alert when price breaks above a recent swing high with volume',
        explanation: 'Breaking a key level with volume confirmation signals strong directional intent.',
        createConditions: () => ({
            logic: 'AND',
            conditions: [
                { type: 'indicator', condition: 'above', indicator: 'VOLUME', price: 1.5 },
                { type: 'indicator', condition: 'above', indicator: 'ATR', price: 1.2 },
            ],
        }),
    },
    {
        id: 'gap_fill_watch',
        category: 'price',
        label: 'Gap Fill Watch',
        icon: '🕳️',
        description: 'Alert when price approaches a recent gap zone',
        explanation: 'Gaps tend to fill. Watch for reversal signals near the gap edge.',
        createConditions: () => ({
            logic: 'AND',
            conditions: [
                { type: 'indicator', condition: 'below', indicator: 'ATR', price: 0.8 },
            ],
        }),
    },

    // ── Behavioral ──────────────────────────────────────────
    {
        id: 'fomo_window',
        category: 'behavioral',
        label: 'FOMO Entry Window',
        icon: '🏃',
        description: 'Warns when you might be chasing after a large move',
        explanation: 'Entering after a 3%+ spike has negative expected value. Wait for a pullback.',
        createConditions: () => ({
            logic: 'AND',
            conditions: [
                { type: 'indicator', condition: 'above', indicator: 'ATR', price: 2.0 },
                { type: 'indicator', condition: 'above', indicator: 'RSI', price: 70 },
            ],
        }),
    },
    {
        id: 'tilt_cooldown',
        category: 'behavioral',
        label: 'Tilt Cooldown',
        icon: '🧘',
        description: 'Reminds you to pause after consecutive losses',
        explanation: 'After 3+ losses in a row, take a 15-minute break to reset emotional state.',
        createConditions: () => ({
            logic: 'AND',
            conditions: [
                { type: 'indicator', condition: 'below', indicator: 'RSI', price: 30 },
            ],
        }),
    },
    {
        id: 'session_fatigue',
        category: 'behavioral',
        label: 'Session Fatigue',
        icon: '😴',
        description: 'Warns during late-night hours (10PM–4AM) when decision quality drops',
        explanation: 'Studies show trading performance drops significantly during fatigue hours.',
        createConditions: () => ({
            logic: 'AND',
            conditions: [
                { type: 'indicator', condition: 'below', indicator: 'VOLUME', price: 0.5 },
            ],
        }),
    },

    // ── Prop Firm ───────────────────────────────────────────
    {
        id: 'daily_dd_warning',
        category: 'propFirm',
        label: 'Daily DD Approaching',
        icon: '⚠️',
        description: 'Alert when you reach 80% of your daily drawdown limit',
        explanation: 'Approaching your daily loss limit — reduce position sizes or stop for the day.',
        createConditions: () => ({
            logic: 'AND',
            conditions: [
                { type: 'price', condition: 'below', price: 0 },
            ],
        }),
    },
    {
        id: 'target_proximity',
        category: 'propFirm',
        label: 'Target Proximity',
        icon: '🎯',
        description: 'Alert when you\'re within 10% of your profit target',
        explanation: 'Close to passing — protect your gains. Consider reducing risk.',
        createConditions: () => ({
            logic: 'AND',
            conditions: [
                { type: 'price', condition: 'above', price: 0 },
            ],
        }),
    },
    {
        id: 'min_days_reminder',
        category: 'propFirm',
        label: 'Minimum Days Reminder',
        icon: '📅',
        description: 'Reminder when minimum trading days requirement is close to completion',
        explanation: 'You need to trade a minimum number of days to pass. Don\'t rush it.',
        createConditions: () => ({
            logic: 'AND',
            conditions: [
                { type: 'price', condition: 'above', price: 0 },
            ],
        }),
    },
];

// ─── API ────────────────────────────────────────────────────────

/**
 * Get all templates registered in the system.
 * @returns {Array} All templates
 */
export function getAllTemplates() {
    return TEMPLATES;
}

/**
 * Get templates by category.
 * @param {string} category - Category key
 * @returns {Array} Matching templates
 */
export function getTemplatesByCategory(category) {
    return TEMPLATES.filter(t => t.category === category);
}

/**
 * Get a template by ID.
 * @param {string} id - Template ID
 * @returns {Object|undefined}
 */
export function getTemplateById(id) {
    return TEMPLATES.find(t => t.id === id);
}

/**
 * Get all categories with their metadata.
 * @returns {Object} Category map
 */
export function getCategories() {
    return CATEGORIES;
}

/**
 * Create an alert from a template + symbol.
 * Returns the params needed for addCompoundAlert().
 * @param {string} templateId
 * @param {string} symbol
 * @param {Object} [overrides] — optional price/param overrides
 * @returns {Object|null} Alert creation params
 */
export function createAlertFromTemplate(templateId, symbol, overrides = {}) {
    const template = getTemplateById(templateId);
    if (!template) return null;

    const { logic, conditions } = template.createConditions();
    return {
        symbol,
        logic,
        conditions: conditions.map(c => ({
            ...c,
            ...(overrides.price != null && c.type === 'price' ? { price: overrides.price } : {}),
        })),
        note: `[Smart] ${template.label} — ${template.description}`,
        repeating: true,
        style: 'system',
        soundType: template.category === 'behavioral' ? 'urgent' : 'price',
    };
}

export default { getAllTemplates, getTemplatesByCategory, getTemplateById, getCategories, createAlertFromTemplate };
