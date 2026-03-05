// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Request ID Middleware
// Adds X-Request-ID header for log correlation.
// ═══════════════════════════════════════════════════════════════════

import { randomUUID } from 'node:crypto';

/**
 * Attaches a unique request ID to each request for log correlation.
 * @returns {import('express').RequestHandler}
 */
export function requestId() {
    return (req, res, next) => {
        const id = req.headers['x-request-id'] || randomUUID();
        req.id = id;
        res.setHeader('X-Request-ID', id);
        next();
    };
}
