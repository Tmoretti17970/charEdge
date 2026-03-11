// ═══════════════════════════════════════════════════════════════════
// charEdge — CSRF Protection Middleware
//
// Phase 2: Converted to TypeScript.
//
// How it works:
//   1. GET /api/csrf-token → sets csrfToken cookie + returns token in JSON
//   2. All POST/PUT/DELETE requests must include the token in
//      X-CSRF-Token header, matching the cookie value
//   3. GET/HEAD/OPTIONS are exempt (safe methods)
//
// Uses crypto.randomUUID() for cryptographically secure tokens.
// ═══════════════════════════════════════════════════════════════════

import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

const CSRF_COOKIE = 'csrfToken';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const TOKEN_MAX_AGE = 8 * 60 * 60; // 8 hours

/**
 * Generate a fresh CSRF token and set it as a cookie.
 * Call this on a GET route to provide the token to the client.
 */
export function generateCsrfToken(_req: Request, res: Response): void {
    const token = randomUUID();
    res.cookie(CSRF_COOKIE, token, {
        httpOnly: false,   // Client JS needs to read this to include in header
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: TOKEN_MAX_AGE * 1000,
        path: '/',
    });
    res.json({ ok: true, data: { csrfToken: token } });
}

/**
 * CSRF protection middleware.
 * Validates that the X-CSRF-Token header matches the csrfToken cookie.
 * Skips validation for safe HTTP methods (GET, HEAD, OPTIONS).
 */
export function csrfProtect(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
        // Safe methods don't need CSRF protection
        if (SAFE_METHODS.has(req.method)) {
            next();
            return;
        }

        const cookieToken = req.cookies?.[CSRF_COOKIE] as string | undefined;
        const headerToken = req.headers[CSRF_HEADER] as string | undefined;

        if (!cookieToken || !headerToken) {
            res.status(403).json({
                ok: false,
                error: {
                    code: 'CSRF_MISSING',
                    message: 'CSRF token missing. Fetch a token from GET /api/csrf-token first.',
                },
            });
            return;
        }

        // Constant-time comparison to prevent timing attacks
        const tokensMatch = cookieToken.length === headerToken.length &&
            timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));

        if (!tokensMatch) {
            res.status(403).json({
                ok: false,
                error: {
                    code: 'CSRF_INVALID',
                    message: 'CSRF token mismatch. Refresh the token and try again.',
                },
            });
            return;
        }

        next();
    };
}

export default { generateCsrfToken, csrfProtect };
