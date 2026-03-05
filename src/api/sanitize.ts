// ═══════════════════════════════════════════════════════════════════
// charEdge — Input Sanitization Middleware
//
// Defense-in-depth: runs BEFORE Zod validation to reject
// prototype pollution attacks and strip dangerous HTML from
// string fields.
// ═══════════════════════════════════════════════════════════════════

import type { Request, Response, NextFunction, RequestHandler } from 'express';

// ─── Prototype Pollution Filter ─────────────────────────────────

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Recursively check an object for prototype pollution keys.
 * Returns true if a dangerous key is found.
 */
function hasPollutionKeys(obj: unknown, depth: number = 0): boolean {
    if (depth > 10 || obj === null || typeof obj !== 'object') return false;

    for (const key of Object.keys(obj as Record<string, unknown>)) {
        if (FORBIDDEN_KEYS.has(key)) return true;
        if (hasPollutionKeys((obj as Record<string, unknown>)[key], depth + 1)) return true;
    }

    if (Array.isArray(obj)) {
        for (const item of obj) {
            if (hasPollutionKeys(item, depth + 1)) return true;
        }
    }

    return false;
}

/**
 * Middleware: Reject requests with prototype pollution payloads.
 * Checks req.body, req.query, and req.params.
 */
export function rejectPrototypePollution(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (hasPollutionKeys(req.body) || hasPollutionKeys(req.query)) {
            res.status(400).json({
                ok: false,
                error: {
                    code: 'PROTOTYPE_POLLUTION',
                    message: 'Request contains forbidden property keys.',
                },
            });
            return;
        }
        next();
    };
}

// ─── HTML / XSS Sanitizer ───────────────────────────────────────

// Lightweight tag stripper — removes all HTML tags from strings.
// For a financial app, there is no legitimate reason to have HTML in any field.
const HTML_TAG_RE = /<[^>]*>/g;
const SCRIPT_RE = /javascript:/gi;
const EVENT_RE = /\bon\w+\s*=/gi;

function stripHtml(str: string): string {
    return str
        .replace(HTML_TAG_RE, '')
        .replace(SCRIPT_RE, '')
        .replace(EVENT_RE, '');
}

/**
 * Recursively sanitize all string values in an object.
 * Strips HTML tags, javascript: URIs, and inline event handlers.
 */
function sanitizeObject(obj: unknown, depth: number = 0): unknown {
    if (depth > 10) return obj;

    if (typeof obj === 'string') {
        return stripHtml(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item, depth + 1));
    }

    if (obj !== null && typeof obj === 'object') {
        const sanitized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
            sanitized[key] = sanitizeObject(value, depth + 1);
        }
        return sanitized;
    }

    return obj;
}

/**
 * Middleware: Sanitize all string fields in req.body.
 * Strips HTML tags, javascript: URIs, and on* event handlers.
 */
export function sanitizeInput(): RequestHandler {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (req.body && typeof req.body === 'object') {
            req.body = sanitizeObject(req.body);
        }
        next();
    };
}

// ─── Combined Middleware ────────────────────────────────────────

/**
 * Combined security middleware: prototype pollution check + input sanitization.
 * Use this as a single middleware in the pipeline.
 */
export function secureInput(): RequestHandler {
    const pollutionFilter = rejectPrototypePollution();
    const sanitizer = sanitizeInput();

    return (req: Request, res: Response, next: NextFunction): void => {
        pollutionFilter(req, res, (err?: unknown) => {
            if (err || res.headersSent) return;
            sanitizer(req, res, next);
        });
    };
}
