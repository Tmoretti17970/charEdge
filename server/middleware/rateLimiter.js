// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Rate Limiter (in-memory, per-IP)
// Simple sliding window counter — no npm dependency.
// #24: Fail-closed — on any error, DENY the request.
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
 * #24: FAIL-CLOSED — on any error, returns false (deny).
 * @param {string} ip - Client IP address
 * @returns {boolean} True if within limits
 */
export function checkRateLimit(ip) {
    try {
        const now = Date.now();
        let entry = _rateLimitMap.get(ip);
        if (!entry || now > entry.resetAt) {
            entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
            _rateLimitMap.set(ip, entry);
        }
        entry.count++;
        return entry.count <= RATE_LIMIT_MAX;
    } catch {
        // #24: Fail closed — if rate limiter throws (OOM, corruption),
        // deny the request rather than silently passing through.
        return false;
    }
}

/**
 * Express middleware that enforces rate limiting.
 * Returns 429 on rate limit exceeded, 503 on internal error.
 * @returns {import('express').RequestHandler}
 */
export function rateLimitMiddleware() {
    return (req, res, next) => {
        try {
            const ip = req.ip || req.socket?.remoteAddress || 'unknown';
            if (!checkRateLimit(ip)) {
                res.setHeader('Retry-After', Math.ceil(RATE_LIMIT_WINDOW_MS / 1000));
                return res.status(429).json({ ok: false, error: 'Rate limit exceeded' });
            }
            next();
        } catch {
            // #24: Fail closed — 503, never silently pass through
            return res.status(503).json({ ok: false, error: 'Rate limiter unavailable' });
        }
    };
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

