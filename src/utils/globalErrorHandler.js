// ═══════════════════════════════════════════════════════════════════
// charEdge — Global Error Handler
// Catches window.onerror, unhandledrejection, and provides a
// central error reporting pipeline. Integrates with the
// notification log for user-visible error alerts.
//
// Sentry Integration:
//   Set VITE_SENTRY_DSN in .env to enable. Sentry SDK is
//   dynamically imported — zero bundle cost when DSN is absent.
// ═══════════════════════════════════════════════════════════════════

const TAG = '[charEdge]';
const MAX_ERRORS = 50; // Prevent infinite error loops from flooding
let errorCount = 0;
let lastErrorTime = 0;

// ─── Sentry lazy reference ───────────────────────────────────
let _sentry = null;
let _sentryInitAttempted = false;

// ─── Error categories ────────────────────────────────────────

const ErrorCategory = {
  RENDER: 'render',
  NETWORK: 'network',
  STORAGE: 'storage',
  PARSE: 'parse',
  RUNTIME: 'runtime',
  UNKNOWN: 'unknown',
};

/**
 * Classify an error into a category for smarter handling.
 */
function categorize(error) {
  const msg = (error?.message || error?.toString() || '').toLowerCase();

  if (msg.includes('network') || msg.includes('fetch') || msg.includes('cors') || msg.includes('failed to fetch')) {
    return ErrorCategory.NETWORK;
  }
  if (msg.includes('json') || msg.includes('parse') || msg.includes('unexpected token')) {
    return ErrorCategory.PARSE;
  }
  if (msg.includes('quota') || msg.includes('storage') || msg.includes('indexeddb')) {
    return ErrorCategory.STORAGE;
  }
  if (msg.includes('render') || msg.includes('minified react') || msg.includes('hydrat')) {
    return ErrorCategory.RENDER;
  }
  return ErrorCategory.RUNTIME;
}

// ─── Error buffer (for diagnostics/export) ───────────────────

const errorLog = [];

function pushError(entry) {
  errorLog.push(entry);
  if (errorLog.length > MAX_ERRORS) errorLog.shift();
}

/**
 * Get the error log for diagnostics.
 * @returns {Array}
 */
export function getErrorLog() {
  return [...errorLog];
}

/**
 * Clear the error log.
 */
export function clearErrorLog() {
  errorLog.length = 0;
  errorCount = 0;
}

// ─── Throttle check ──────────────────────────────────────────

function isThrottled() {
  const now = Date.now();
  if (now - lastErrorTime < 100) {
    errorCount++;
  } else {
    errorCount = 1;
  }
  lastErrorTime = now;
  return errorCount > MAX_ERRORS;
}

// ─── Central error reporter ──────────────────────────────────

/**
 * Report an error through the central pipeline.
 * @param {Error|string} error
 * @param {Object} [meta] - Additional context
 * @param {string} [meta.source] - Where the error originated
 * @param {string} [meta.component] - React component name
 * @param {boolean} [meta.silent] - Don't log to console
 */
export function reportError(error, meta = {}) {
  if (isThrottled()) return;

  const err = error instanceof Error ? error : new Error(String(error));
  const category = categorize(err);
  const entry = {
    timestamp: new Date().toISOString(),
    message: err.message,
    stack: err.stack?.split('\n').slice(0, 5).join('\n'),
    category,
    source: meta.source || 'unknown',
    component: meta.component || null,
  };

  pushError(entry);

  if (!meta.silent) {
    console.error(`${TAG} [${category}] ${err.message}`, meta.source ? `(source: ${meta.source})` : '');
  }

  // Forward to Sentry if initialized
  if (_sentry) {
    try {
      _sentry.captureException(err, {
        tags: { category, source: meta.source || 'unknown' },
        extra: { component: meta.component },
      });
    } catch {
      // Sentry forwarding failed — do not recurse
    }
  }

  // Notify the notification log if available (lazy import to avoid circular deps)
  try {
    const store = globalThis.__charEdge_notification_store__;
    if (store) {
      const userMessage = getUserMessage(category, err.message);
      store.getState().addEntry({
        type: category === 'network' ? 'warning' : 'error',
        title: userMessage.title,
        body: userMessage.body,
      });
    }
  } catch {
    // Notification store not ready yet — that's fine
  }
}

/**
 * Generate user-friendly error messages by category.
 */
function getUserMessage(category, rawMessage) {
  switch (category) {
    case ErrorCategory.NETWORK:
      return {
        title: 'Connection issue',
        body: 'Unable to reach the server. Check your internet connection.',
      };
    case ErrorCategory.STORAGE:
      return {
        title: 'Storage issue',
        body: 'Browser storage is full or unavailable. Some data may not persist.',
      };
    case ErrorCategory.PARSE:
      return {
        title: 'Data error',
        body: 'Failed to read data. The file may be corrupted.',
      };
    case ErrorCategory.RENDER:
      return {
        title: 'Display error',
        body: 'A component failed to render. Try refreshing the page.',
      };
    default:
      return {
        title: 'Unexpected error',
        body: rawMessage.length > 100 ? rawMessage.slice(0, 100) + '…' : rawMessage,
      };
  }
}

// ─── Install global handlers ─────────────────────────────────

/**
 * Call once at app boot to install global error listeners.
 * Safe to call multiple times (idempotent).
 */
export function installGlobalErrorHandlers() {
  if (typeof window === 'undefined') return;
  if (window.__charEdge_error_handlers_installed__) return;
  window.__charEdge_error_handlers_installed__ = true;

  // Initialize Sentry if DSN is configured
  _initSentry();

  // Synchronous errors (throw/reference errors in non-async code)
  window.addEventListener('error', (event) => {
    // Ignore script loading errors (CSP, ad blockers, etc.)
    if (!event.error) return;

    reportError(event.error, {
      source: `window.onerror`,
    });
  });

  // Unhandled promise rejections (forgotten .catch(), async throws)
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const error = reason instanceof Error ? reason : new Error(String(reason || 'Unhandled promise rejection'));

    reportError(error, {
      source: 'unhandledrejection',
    });
  });
}

// ─── Sentry initialization ───────────────────────────────────

/**
 * Lazily initialize Sentry when VITE_SENTRY_DSN is set.
 * No-ops if DSN is absent — zero bundle cost.
 * @private
 */
function _initSentry() {
  if (_sentryInitAttempted) return;
  _sentryInitAttempted = true;

  const dsn = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SENTRY_DSN;
  if (!dsn) return;

  // Use a variable to prevent Vite's static import analysis from
  // failing when @sentry/browser is not installed.
  const sentryPkg = '@sentry/browser';
  import(/* @vite-ignore */ sentryPkg).then((Sentry) => {
    Sentry.init({
      dsn,
      environment: import.meta.env?.MODE || 'production',
      release: `charedge@${import.meta.env?.VITE_APP_VERSION || '11.0.0'}`,
      tracesSampleRate: 0.1,
      // Don't capture console logs or breadcrumbs by default
      integrations: (defaults) => defaults.filter(i => i.name !== 'Breadcrumbs'),
    });
    _sentry = Sentry;
    console.info(`${TAG} Sentry initialized`);
  }).catch(() => {
    // @sentry/browser not installed — that's fine
    console.debug(`${TAG} Sentry SDK not available (install @sentry/browser to enable)`);
  });
}

// ─── Async wrapper ───────────────────────────────────────────

/**
 * Wrap an async function to catch and report errors automatically.
 * Useful for event handlers: onClick={safeAsync(() => doSomething())}

 *
 * @param {Function} fn - Async function
 * @param {Object} [opts]
 * @param {string} [opts.source] - Context label
 * @param {*} [opts.fallback] - Return value on error
 * @returns {Function}
 */
export function safeAsync(fn, opts = {}) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      reportError(err, { source: opts.source || fn.name || 'safeAsync' });
      return opts.fallback;
    }
  };
}

/**
 * Wrap a sync function to catch and report errors.
 * @param {Function} fn
 * @param {Object} [opts]
 * @returns {Function}
 */
export function safeSync(fn, opts = {}) {
  return (...args) => {
    try {
      return fn(...args);
    } catch (err) {
      reportError(err, { source: opts.source || fn.name || 'safeSync' });
      return opts.fallback;
    }
  };
}

export { ErrorCategory };
export default { reportError, installGlobalErrorHandlers, safeAsync, safeSync, getErrorLog, clearErrorLog };
