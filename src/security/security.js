// ═══════════════════════════════════════════════════════════════════
// charEdge — Dev-mode CSP Violation Detector (P3 Cleanup)
//
// In development mode, adds a listener for CSP violations and logs
// them to the console for early detection before they reach
// production. In production, this module is a no-op.
//
// Usage: import once at app entry (e.g., main.jsx)
//   import './utils/security.js';
// ═══════════════════════════════════════════════════════════════════

const __DEV__ = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

if (__DEV__ && typeof document !== 'undefined') {
    // Listen for CSP violations and log them for early detection
    document.addEventListener('securitypolicyviolation', (e) => {
        // eslint-disable-next-line no-console
        console.warn(
            `[CSP Violation] Directive: ${e.violatedDirective} | ` +
            `Blocked: ${e.blockedURI || '(inline)'} | ` +
            `Source: ${e.sourceFile}:${e.lineNumber}`
        );
    });

}
