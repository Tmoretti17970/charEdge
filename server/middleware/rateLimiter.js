// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Rate Limiter (in-memory, per-IP)
// Simple sliding window counter — no npm dependency.
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} RateLimitEntry
 * @property {number} count - Request count in current window
 * @property {number} resetAt - Timestamp when window resets
 */

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 30;           // max requests per window

/** @type {Map<string, RateLimitEntry>} */
const _rateLimitMap = new Map();

/**
 * Check if a client IP is within rate limits.
 * @param {string} ip - Client IP address
 * @returns {boolean} True if within limits
 */
export function checkRateLimit(ip) {
    const now = Date.now();
    let entry = _rateLimitMap.get(ip);
    if (!entry || now > entry.resetAt) {
        entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
        _rateLimitMap.set(ip, entry);
    }
    entry.count++;
    return entry.count <= RATE_LIMIT_MAX;
}

/** Window duration in ms (exported for Retry-After header). */
export { RATE_LIMIT_WINDOW_MS };

// Periodic cleanup of stale rate-limit entries (every 5 min)
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of _rateLimitMap) {
        if (now > entry.resetAt) _rateLimitMap.delete(ip);
    }
}, 5 * 60_000);
