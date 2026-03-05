import { logger } from './logger';

// ═══════════════════════════════════════════════════════════════════
// charEdge — Global Error Handler (TypeScript)
//
// Phase 2: Converted to TypeScript.
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

interface ErrorMeta {
    source?: string;
    component?: string;
    silent?: boolean;
    [key: string]: unknown;
}

interface ErrorLogEntry {
    timestamp: string;
    message: string;
    stack: string | undefined;
    category: ErrorCategoryValue;
    source: string;
    component: string | null;
}

interface UserMessage {
    title: string;
    body: string;
}

interface SafeAsyncOptions {
    source?: string;
    fallback?: unknown;
}

interface NotificationStore {
    getState(): {
        addEntry(entry: { type: string; title: string; body: string }): void;
    };
}

type ErrorCategoryValue = 'render' | 'network' | 'storage' | 'parse' | 'runtime' | 'unknown';

interface SentryLike {
    init(opts: Record<string, unknown>): void;
    captureException(err: Error, opts?: Record<string, unknown>): void;
}

// ─── Constants ───────────────────────────────────────────────────

const TAG = '[charEdge]';
const MAX_ERRORS = 50;
let errorCount = 0;
let lastErrorTime = 0;

let _sentry: SentryLike | null = null;
let _sentryInitAttempted = false;

const ErrorCategory: Record<string, ErrorCategoryValue> = {
    RENDER: 'render',
    NETWORK: 'network',
    STORAGE: 'storage',
    PARSE: 'parse',
    RUNTIME: 'runtime',
    UNKNOWN: 'unknown',
};

function categorize(error: Error | string): ErrorCategoryValue {
    const msg = (typeof error === 'string' ? error : error?.message || '').toLowerCase();

    if (msg.includes('network') || msg.includes('fetch') || msg.includes('cors') || msg.includes('failed to fetch')) {
        return ErrorCategory.NETWORK!;
    }
    if (msg.includes('json') || msg.includes('parse') || msg.includes('unexpected token')) {
        return ErrorCategory.PARSE!;
    }
    if (msg.includes('quota') || msg.includes('storage') || msg.includes('indexeddb')) {
        return ErrorCategory.STORAGE!;
    }
    if (msg.includes('render') || msg.includes('minified react') || msg.includes('hydrat')) {
        return ErrorCategory.RENDER!;
    }
    return ErrorCategory.RUNTIME!;
}

// ─── Error buffer ────────────────────────────────────────────────

const errorLog: ErrorLogEntry[] = [];

function pushError(entry: ErrorLogEntry): void {
    errorLog.push(entry);
    if (errorLog.length > MAX_ERRORS) errorLog.shift();
}

export function getErrorLog(): ErrorLogEntry[] {
    return [...errorLog];
}

export function clearErrorLog(): void {
    errorLog.length = 0;
    errorCount = 0;
}

// ─── Throttle ────────────────────────────────────────────────────

function isThrottled(): boolean {
    const now = Date.now();
    if (now - lastErrorTime < 100) {
        errorCount++;
    } else {
        errorCount = 1;
    }
    lastErrorTime = now;
    return errorCount > MAX_ERRORS;
}

// ─── Central error reporter ──────────────────────────────────────

export function reportError(error: Error | string, meta: ErrorMeta = {}): void {
    if (isThrottled()) return;

    const err = error instanceof Error ? error : new Error(String(error));
    const category = categorize(err);
    const entry: ErrorLogEntry = {
        timestamp: new Date().toISOString(),
        message: err.message,
        stack: err.stack?.split('\n').slice(0, 5).join('\n'),
        category,
        source: meta.source || 'unknown',
        component: meta.component || null,
    };

    pushError(entry);

    if (!meta.silent) {
        logger.ui.error(`${TAG} [${category}] ${err.message}`, meta.source ? `(source: ${meta.source})` : '');
    }

    if (_sentry) {
        try {
            _sentry.captureException(err, {
                tags: { category, source: meta.source || 'unknown' },
                extra: { component: meta.component },
            });
        } catch (_) {
            // Sentry forwarding failed
        }
    }

    try {
        const store = (globalThis as unknown as { __charEdge_notification_store__?: NotificationStore }).__charEdge_notification_store__;
        if (store) {
            const userMessage = getUserMessage(category, err.message);
            store.getState().addEntry({
                type: category === 'network' ? 'warning' : 'error',
                title: userMessage.title,
                body: userMessage.body,
            });
        }
    } catch (_) {
        // Notification store not ready
    }
}

function getUserMessage(category: ErrorCategoryValue, rawMessage: string): UserMessage {
    switch (category) {
        case ErrorCategory.NETWORK:
            return { title: 'Connection issue', body: 'Unable to reach the server. Check your internet connection.' };
        case ErrorCategory.STORAGE:
            return { title: 'Storage issue', body: 'Browser storage is full or unavailable. Some data may not persist.' };
        case ErrorCategory.PARSE:
            return { title: 'Data error', body: 'Failed to read data. The file may be corrupted.' };
        case ErrorCategory.RENDER:
            return { title: 'Display error', body: 'A component failed to render. Try refreshing the page.' };
        default:
            return { title: 'Unexpected error', body: rawMessage.length > 100 ? rawMessage.slice(0, 100) + '…' : rawMessage };
    }
}

// ─── Install global handlers ─────────────────────────────────

declare global {
    interface Window {
        __charEdge_error_handlers_installed__?: boolean;
    }
}

export function installGlobalErrorHandlers(): void {
    if (typeof window === 'undefined') return;
    if (window.__charEdge_error_handlers_installed__) return;
    window.__charEdge_error_handlers_installed__ = true;

    _initSentry();

    window.addEventListener('error', (event: ErrorEvent) => {
        if (!event.error) return;
        reportError(event.error as Error, { source: 'window.onerror' });
    });

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
        const reason = event.reason;
        const error = reason instanceof Error ? reason : new Error(String(reason || 'Unhandled promise rejection'));
        reportError(error, { source: 'unhandledrejection' });
    });
}

// ─── Sentry initialization ───────────────────────────────────

function _initSentry(): void {
    if (_sentryInitAttempted) return;
    _sentryInitAttempted = true;

    const dsn = typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SENTRY_DSN as string | undefined);
    if (!dsn) return;

    const sentryPkg = '@sentry/browser';
    import(/* @vite-ignore */ sentryPkg).then((Sentry: SentryLike) => {
        Sentry.init({
            dsn,
            environment: (import.meta.env?.MODE as string) || 'production',
            release: `charedge@${(import.meta.env?.VITE_APP_VERSION as string) || '11.0.0'}`,
            tracesSampleRate: 0.1,
            integrations: (defaults: Array<{ name: string }>) => defaults.filter((i: { name: string }) => i.name !== 'Breadcrumbs'),
        });
        _sentry = Sentry;
        logger.ui.info(`${TAG} Sentry initialized`);
    }).catch(() => {
        logger.ui.debug(`${TAG} Sentry SDK not available (install @sentry/browser to enable)`);
    });
}

// ─── Async/sync wrappers ─────────────────────────────────────

export function safeAsync<T>(fn: (...args: unknown[]) => Promise<T>, opts: SafeAsyncOptions = {}): (...args: unknown[]) => Promise<T | undefined> {
    return async (...args: unknown[]) => {
        try {
            return await fn(...args);
        } catch (err) {
            reportError(err as Error, { source: opts.source || fn.name || 'safeAsync' });
            return opts.fallback as T | undefined;
        }
    };
}

export function safeSync<T>(fn: (...args: unknown[]) => T, opts: SafeAsyncOptions = {}): (...args: unknown[]) => T | undefined {
    return (...args: unknown[]) => {
        try {
            return fn(...args);
        } catch (err) {
            reportError(err as Error, { source: opts.source || fn.name || 'safeSync' });
            return opts.fallback as T | undefined;
        }
    };
}

export { ErrorCategory };
export default { reportError, installGlobalErrorHandlers, safeAsync, safeSync, getErrorLog, clearErrorLog };
