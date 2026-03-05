// ═══════════════════════════════════════════════════════════════════
// charEdge — Sentry Error Monitoring (TypeScript)
//
// Phase 2: Converted to TypeScript.
// ═══════════════════════════════════════════════════════════════════

import { registerErrorReporter } from './logger.ts';
import { logger } from './logger';

interface SentryModule {
    init(options: Record<string, unknown>): void;
    captureException(error: Error, opts?: Record<string, unknown>): void;
}

interface ErrorContext {
    error?: Error;
    source?: string;
    [key: string]: unknown;
}

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

if (DSN) {
    import('@sentry/browser').then((Sentry: SentryModule) => {
        Sentry.init({
            dsn: DSN,
            release: (import.meta.env.VITE_APP_VERSION as string) || '11.0.0',
            environment: (import.meta.env.MODE as string) || 'production',
            tracesSampleRate: 0.1,
            enabled: import.meta.env.PROD,
            ignoreErrors: [
                'ResizeObserver loop',
                'Non-Error promise rejection',
                'AbortError',
                'NetworkError',
                'Load failed',
            ],
            beforeSend(event: Record<string, unknown>) {
                const exception = event.exception as { values?: Array<{ stacktrace?: { frames?: Array<{ filename?: string }> } }> } | undefined;
                if (exception?.values) {
                    for (const ex of exception.values) {
                        if (ex.stacktrace?.frames) {
                            for (const frame of ex.stacktrace.frames) {
                                if (frame.filename) {
                                    frame.filename = frame.filename.replace(/^.*\/assets\//, '/assets/');
                                }
                            }
                        }
                    }
                }
                return event;
            },
        });

        registerErrorReporter((message: string, context?: ErrorContext) => {
            Sentry.captureException(
                context?.error instanceof Error
                    ? context.error
                    : new Error(String(message)),
                {
                    extra: context,
                    tags: {
                        source: context?.source || 'logger',
                    },
                },
            );
        });

        logger.ui.info('[Sentry] Error monitoring initialized');
    }).catch(() => {
        // Sentry failed to load — non-critical, app continues normally
    });
}
