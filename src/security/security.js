// ═══════════════════════════════════════════════════════════════════
// charEdge — CSP Violation Detector (Sprint 2 — Task 2.2)
//
// Logs Content-Security-Policy violations for visibility.
// In development: console.warn for immediate feedback.
// In all modes: logger.data.warn for structured logging.
//
// Usage: import once at app entry (e.g., main.jsx)
//   import './security/security.js';
// ═══════════════════════════════════════════════════════════════════

import { logger } from '@/observability/logger';

if (typeof document !== 'undefined') {
    document.addEventListener('securitypolicyviolation', (e) => {
        const msg = `[CSP Violation] Directive: ${e.violatedDirective} | ` +
            `Blocked: ${e.blockedURI || '(inline)'} | ` +
            `Source: ${e.sourceFile}:${e.lineNumber}`;

        logger.data.warn(msg);

        // Also console in dev for immediate visibility
        const __DEV__ = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
        if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn(msg);
        }
    });
}
