// ═══════════════════════════════════════════════════════════════════
// Trade Form Constants — Controlled vocabulary enums
// ═══════════════════════════════════════════════════════════════════

export const SIDES = ['long', 'short'];
export const ASSET_CLASSES = ['futures', 'crypto', 'stocks', 'forex', 'options'];
// P2 3.4: Controlled vocab enums for trade classification
export const TRADE_OUTCOMES = ['win', 'loss', 'breakeven', 'scratch'];
export const TRADE_TIMEFRAMES = ['scalp', 'intraday', 'swing', 'position'];
export const CONVICTION_LEVELS = ['low', 'medium', 'high', 'max'];

/**
 * Empty form state — used to reset or initialize the trade form.
 */
export const EMPTY_FORM = {
    symbol: '',
    side: 'long',
    assetClass: 'futures',
    qty: '',
    entry: '',
    exit: '',
    pnl: '',
    fees: '',
    date: new Date().toISOString().slice(0, 16), // datetime-local format
    closeDate: '', // J2.3: Exit time for duration tracking
    emotion: '',
    playbook: '',
    rMultiple: '',
    tags: '',
    notes: '',
    ruleBreak: false,
    screenshots: [],
};
