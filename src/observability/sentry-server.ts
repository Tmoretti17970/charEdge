/* global process */
// ═══════════════════════════════════════════════════════════════════
// charEdge — Server-Side Sentry Integration
//
// Phase 2 Task 2.1.8: @sentry/node for server-side error tracking.
//
// Usage:
//   import { initSentry, captureError } from './sentry-server.js';
//   initSentry(); // Call once at server startup
//   // In error handlers:
//   captureError(err, { route: '/api/proxy/rss', userId: 'xyz' });
//
// Requires: SENTRY_DSN environment variable
// ═══════════════════════════════════════════════════════════════════

import type { ErrorSeverity } from '../shared/errors';
import { logger } from './logger';

// ─── Types ───────────────────────────────────────────────────────

interface SentryModule {
    init(opts: Record<string, unknown>): void;
    captureException(err: unknown, extra?: Record<string, unknown>): void;
    captureMessage(msg: string, level?: string): void;
    setTag(key: string, value: string): void;
    addBreadcrumb(crumb: Record<string, unknown>): void;
}

let _sentry: SentryModule | null = null;
let _initialized = false;

// ─── Initialization ──────────────────────────────────────────────

/**
 * Initialize Sentry server-side error tracking.
 * No-op if SENTRY_DSN is not set.
 */
export async function initSentry(): Promise<boolean> {
    if (_initialized) return !!_sentry;

    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
        logger.ui.info('[Sentry] No SENTRY_DSN set — server error tracking disabled');
        _initialized = true;
        return false;
    }

    try {
        const Sentry = await import('@sentry/node');
        Sentry.init({
            dsn,
            environment: process.env.NODE_ENV || 'development',
            release: `charedge@${process.env.npm_package_version || '11.0.0'}`,
            tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
            // Don't send PII
            sendDefaultPii: false,
            // Filter out noisy errors
            beforeSend(event: Record<string, unknown>) {
                // Don't report rate limit errors (expected behavior)
                const msg = (event as { message?: string }).message;
                if (msg && typeof msg === 'string' && msg.includes('Rate limit')) {
                    return null;
                }
                return event;
            },
        });

        _sentry = Sentry as unknown as SentryModule;
        _initialized = true;
        logger.ui.info('[Sentry] Server error tracking initialized');
        return true;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
        logger.ui.warn('[Sentry] Failed to initialize — @sentry/node may not be installed');
        _initialized = true;
        return false;
    }
}

// ─── Error Capture ───────────────────────────────────────────────

const SEVERITY_MAP: Record<ErrorSeverity, string> = {
    fatal: 'fatal',
    error: 'error',
    warning: 'warning',
    info: 'info',
};

/**
 * Capture an error in Sentry with context.
 * No-op if Sentry is not initialized.
 */
export function captureError(
    err: unknown,
    context?: Record<string, unknown>,
    severity: ErrorSeverity = 'error',
): void {
    if (!_sentry) return;

    try {
        if (context) {
            _sentry.addBreadcrumb({
                category: 'context',
                data: context,
                level: SEVERITY_MAP[severity],
            });
        }

        if (err instanceof Error) {
            _sentry.captureException(err, {
                extra: context,
                level: SEVERITY_MAP[severity],
            } as Record<string, unknown>);
        } else {
            _sentry.captureMessage(String(err), SEVERITY_MAP[severity]);
        }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
        // Sentry capture failed — don't crash the server over telemetry
        logger.ui.error('[Sentry] Failed to capture error:', err);
    }
}

/**
 * Set a tag on Sentry scope (e.g. 'route', 'userId').
 */
export function setTag(key: string, value: string): void {
    _sentry?.setTag(key, value);
}

/**
 * Add a breadcrumb for debugging.
 */
export function addBreadcrumb(
    category: string,
    message: string,
    data?: Record<string, unknown>,
): void {
    _sentry?.addBreadcrumb({ category, message, data, level: 'info' });
}

export default { initSentry, captureError, setTag, addBreadcrumb };
