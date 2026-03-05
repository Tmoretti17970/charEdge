// ═══════════════════════════════════════════════════════════════════
// charEdge — Sentry Error Monitoring
//
// Initializes Sentry for production error tracking.
// Wires into the existing registerErrorReporter() hook in logger.ts
// so all logger.error() calls are automatically sent to Sentry.
//
// Configuration:
//   Set VITE_SENTRY_DSN in your .env file.
//   Without a DSN, this module is a no-op.
// ═══════════════════════════════════════════════════════════════════

import { registerErrorReporter } from './logger.ts';

const DSN = import.meta.env.VITE_SENTRY_DSN;

if (DSN) {
  import('@sentry/browser').then((Sentry) => {
    Sentry.init({
      dsn: DSN,
      release: import.meta.env.VITE_APP_VERSION || '11.0.0',
      environment: import.meta.env.MODE || 'production',

      // Sample 10% of transactions for performance monitoring
      tracesSampleRate: 0.1,

      // Only report errors in production
      enabled: import.meta.env.PROD,

      // Filter noisy errors
      ignoreErrors: [
        'ResizeObserver loop',
        'Non-Error promise rejection',
        'AbortError',
        'NetworkError',
        'Load failed',
      ],

      beforeSend(event) {
        // Strip local file paths from stack traces
        if (event.exception?.values) {
          for (const ex of event.exception.values) {
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

    // Wire Sentry into charEdge's logger system
    registerErrorReporter((message, context) => {
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

    console.info('[Sentry] Error monitoring initialized');
  }).catch(() => {
    // Sentry failed to load — non-critical, app continues normally
  });
}
