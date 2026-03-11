// ═══════════════════════════════════════════════════════════════════
// charEdge — Trade Data Sanitizer
//
// Cleans internal/developer log strings into trader-friendly display
// text. Provides contextual asset-class icons for symbol decoration.
// ═══════════════════════════════════════════════════════════════════

// ─── Internal log patterns to clean ──────────────────────────────
const LOG_PATTERNS = [
    { match: /SOLE\.LOG\s*\([^)]*\)/gi, replace: '⚙️ API Execution' },
    { match: /DEBUG[:_]\s*.*/gi, replace: '⚙️ System Event' },
    { match: /ERR(OR)?[:_]\s*.*/gi, replace: '⚠️ Error Event' },
    { match: /INFO[:_]\s*.*/gi, replace: 'ℹ️ Info Event' },
    { match: /WARN(ING)?[:_]\s*.*/gi, replace: '⚠️ Warning' },
    { match: /^null$|^undefined$|^NaN$/i, replace: '—' },
];

// ─── Recognized asset symbols ────────────────────────────────────
const CRYPTO = new Set([
    'BTC', 'ETH', 'SOL', 'DOGE', 'ADA', 'XRP', 'AVAX', 'DOT', 'MATIC',
    'LINK', 'UNI', 'AAVE', 'LTC', 'BCH', 'ATOM', 'FIL', 'APE', 'SHIB',
    'ARB', 'OP', 'SUI', 'SEI', 'TIA', 'JUP', 'WIF', 'PEPE', 'BONK',
]);

const FUTURES = new Set([
    'ES', 'NQ', 'YM', 'RTY', 'MES', 'MNQ', 'MYM', 'M2K',
    'CL', 'GC', 'SI', 'HG', 'NG', 'ZB', 'ZN', 'ZF', 'ZT',
    '6E', '6J', '6B', '6A', '6C', '6S',
]);

const FOREX_RE = /^[A-Z]{3}\/[A-Z]{3}$|^[A-Z]{6}$/;

/**
 * Clean a raw strategy/log string into trader-friendly text.
 * @param {string} raw - The raw string from the database
 * @returns {string} Cleaned, display-ready string
 */
export function sanitizeStrategy(raw) {
    if (!raw || typeof raw !== 'string') return '—';

    let cleaned = raw.trim();
    if (!cleaned) return '—';

    // Apply log pattern replacements
    for (const { match, replace } of LOG_PATTERNS) {
        // Reset lastIndex BEFORE .test() — global regexes (/gi) advance lastIndex
        // on match, and if we return early, the stale lastIndex breaks the next call
        match.lastIndex = 0;
        if (match.test(cleaned)) {
            return replace;
        }
    }

    // Title-case short all-caps strings (e.g. "MEAN REVERSION" → "Mean Reversion")
    if (cleaned === cleaned.toUpperCase() && cleaned.length > 3 && !cleaned.includes('_')) {
        cleaned = cleaned
            .toLowerCase()
            .replace(/\b\w/g, (c) => c.toUpperCase());
    }

    // Replace underscores with spaces
    cleaned = cleaned.replace(/_/g, ' ');

    return cleaned;
}

/**
 * Get a contextual icon for an asset class based on symbol.
 * @param {string} symbol - Trading symbol (e.g. "BTC", "AAPL", "ES")
 * @returns {string} Emoji/character icon
 */
export function getAssetIcon(symbol) {
    if (!symbol || typeof symbol !== 'string') return '📊';

    const sym = symbol.toUpperCase().replace(/\/.*$/, '').replace(/USDT?$|BUSD$|PERP$/i, '');

    if (CRYPTO.has(sym)) return '₿';
    if (FUTURES.has(sym)) return '📦';
    if (FOREX_RE.test(symbol.toUpperCase())) return '💱';

    // Default: equities
    return '$';
}
