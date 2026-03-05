import { logger } from './logger';

// ═══════════════════════════════════════════════════════════════════
// charEdge — Error Class Hierarchy
//
// Phase 2 Task 2.1.7: Structured error classification.
//
// Every thrown/caught error in charEdge should be one of these types.
// All extend AppError which provides code, severity, context.
//
// Usage:
//   throw new DataError('OHLC_INVALID', 'High < Low', { bar });
//   catch (err) { logger.error(classifyError(err)); }
// ═══════════════════════════════════════════════════════════════════

export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';

export type ErrorCategory =
    | 'data'
    | 'render'
    | 'network'
    | 'validation'
    | 'storage'
    | 'auth'
    | 'unknown';

// ─── Base Error ──────────────────────────────────────────────────

export class AppError extends Error {
    /** Machine-readable error code (e.g. 'OHLC_INVALID', 'WS_TIMEOUT') */
    readonly code: string;
    /** Severity level for logging/alerting */
    readonly severity: ErrorSeverity;
    /** Error category for routing to handlers */
    readonly category: ErrorCategory;
    /** Arbitrary context for debugging */
    readonly context: Record<string, unknown>;
    /** ISO timestamp of when the error occurred */
    readonly timestamp: string;
    /** Original error if this wraps another */
    readonly cause?: Error | undefined;

    constructor(
        code: string,
        message: string,
        opts: {
            severity?: ErrorSeverity | undefined;
            category?: ErrorCategory | undefined;
            context?: Record<string, unknown> | undefined;
            cause?: Error | undefined;
        } = {},
    ) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.severity = opts.severity ?? 'error';
        this.category = opts.category ?? 'unknown';
        this.context = opts.context ?? {};
        this.timestamp = new Date().toISOString();
        this.cause = opts.cause;

        // Maintains proper stack trace in V8
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /** Serialize for logging/telemetry */
    toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            severity: this.severity,
            category: this.category,
            context: this.context,
            timestamp: this.timestamp,
            stack: this.stack,
        };
    }
}

// ─── Data Errors ─────────────────────────────────────────────────
// OHLC validation, parsing, transformation, staleness

export class DataError extends AppError {
    constructor(code: string, message: string, context?: Record<string, unknown>, cause?: Error) {
        super(code, message, { severity: 'error', category: 'data', context, cause });
        this.name = 'DataError';
    }
}

// ─── Render Errors ───────────────────────────────────────────────
// Canvas, WebGL, DOM rendering failures

export class RenderError extends AppError {
    constructor(code: string, message: string, context?: Record<string, unknown>, cause?: Error) {
        super(code, message, { severity: 'error', category: 'render', context, cause });
        this.name = 'RenderError';
    }
}

// ─── Network Errors ──────────────────────────────────────────────
// WebSocket, fetch, proxy, timeout

export class NetworkError extends AppError {
    constructor(code: string, message: string, context?: Record<string, unknown>, cause?: Error) {
        super(code, message, { severity: 'warning', category: 'network', context, cause });
        this.name = 'NetworkError';
    }
}

// ─── Validation Errors ───────────────────────────────────────────
// User input, schema validation, form errors

export class ValidationError extends AppError {
    readonly fields: Array<{ path: string; message: string }>;

    constructor(
        message: string,
        fields: Array<{ path: string; message: string }> = [],
        context?: Record<string, unknown>,
    ) {
        super('VALIDATION_ERROR', message, { severity: 'warning', category: 'validation', context });
        this.name = 'ValidationError';
        this.fields = fields;
    }
}

// ─── Storage Errors ──────────────────────────────────────────────
// IndexedDB, OPFS, localStorage, quota

export class StorageError extends AppError {
    constructor(code: string, message: string, context?: Record<string, unknown>, cause?: Error) {
        super(code, message, { severity: 'error', category: 'storage', context, cause });
        this.name = 'StorageError';
    }
}

// ─── Error Classification ────────────────────────────────────────

/**
 * Classify any caught value into an AppError for structured logging.
 * If already an AppError, returns it as-is.
 * If a native Error, wraps it with best-guess classification.
 * If a string or unknown, wraps in a generic AppError.
 */
export function classifyError(err: unknown): AppError {
    if (err instanceof AppError) return err;

    if (err instanceof Error) {
        // Heuristic: classify by error properties
        const msg = err.message.toLowerCase();

        if (msg.includes('websocket') || msg.includes('fetch') || msg.includes('network') || msg.includes('timeout') || msg.includes('abort')) {
            return new NetworkError('NETWORK_UNKNOWN', err.message, {}, err);
        }
        if (msg.includes('indexeddb') || msg.includes('storage') || msg.includes('quota') || msg.includes('opfs')) {
            return new StorageError('STORAGE_UNKNOWN', err.message, {}, err);
        }
        if (msg.includes('canvas') || msg.includes('webgl') || msg.includes('render') || msg.includes('gpu')) {
            return new RenderError('RENDER_UNKNOWN', err.message, {}, err);
        }
        if (msg.includes('ohlc') || msg.includes('candle') || msg.includes('bar') || msg.includes('parse')) {
            return new DataError('DATA_UNKNOWN', err.message, {}, err);
        }

        return new AppError('UNKNOWN', err.message, { cause: err });
    }

    if (typeof err === 'string') {
        return new AppError('UNKNOWN', err);
    }

    return new AppError('UNKNOWN', 'An unknown error occurred', {
        context: { rawError: String(err) },
    });
}

// ─── Error Codes ─────────────────────────────────────────────────

/** Common error codes for reference */
export const ERROR_CODES = {
    // Data
    OHLC_INVALID: 'OHLC_INVALID',
    TIMESTAMP_NONMONOTONIC: 'TIMESTAMP_NONMONOTONIC',
    DATA_STALE: 'DATA_STALE',
    DATA_CORRUPT: 'DATA_CORRUPT',
    PARSE_FAILED: 'PARSE_FAILED',

    // Network
    WS_TIMEOUT: 'WS_TIMEOUT',
    WS_CLOSE_UNEXPECTED: 'WS_CLOSE_UNEXPECTED',
    FETCH_FAILED: 'FETCH_FAILED',
    PROXY_ERROR: 'PROXY_ERROR',
    RATE_LIMITED: 'RATE_LIMITED',

    // Render
    WEBGL_CONTEXT_LOST: 'WEBGL_CONTEXT_LOST',
    CANVAS_ERROR: 'CANVAS_ERROR',
    SHADER_COMPILE: 'SHADER_COMPILE',

    // Storage
    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
    INDEXEDDB_ERROR: 'INDEXEDDB_ERROR',
    OPFS_ERROR: 'OPFS_ERROR',
    MIGRATION_FAILED: 'MIGRATION_FAILED',

    // Validation
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    SCHEMA_MISMATCH: 'SCHEMA_MISMATCH',
} as const;

// ─── Result Type ─────────────────────────────────────────────────
// Type-safe error handling without exceptions.
//
// Usage:
//   const result = tryCatch(() => JSON.parse(raw));
//   if (result.ok) console.log(result.value);
//   else console.error(result.error);

/** A discriminated union for success/failure outcomes. */
export type Result<T, E = Error> =
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly error: E };

/** Create a success Result. */
export function ok<T>(value: T): Result<T, never> {
    return { ok: true, value };
}

/** Create a failure Result. */
export function err<E = Error>(error: E): Result<never, E> {
    return { ok: false, error };
}

/**
 * Wrap a synchronous function call in a Result.
 * Returns ok(value) on success, err(Error) on throw.
 */
export function tryCatch<T>(fn: () => T): Result<T, Error> {
    try {
        return ok(fn());
    } catch (e) {
        return err(e instanceof Error ? e : new Error(String(e)));
    }
}

/**
 * Wrap an async function call in a Result.
 * Returns ok(value) on success, err(Error) on rejection.
 */
export async function tryCatchAsync<T>(fn: () => Promise<T>): Promise<Result<T, Error>> {
    try {
        return ok(await fn());
    } catch (e) {
        return err(e instanceof Error ? e : new Error(String(e)));
    }
}
