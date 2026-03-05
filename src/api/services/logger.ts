// ═══════════════════════════════════════════════════════════════════
// charEdge — Structured Logger (Pino)
//
// Phase 5 Task 5.2.2 + 5.2.6: JSON structured logging with
// correlation IDs, request context, and Express middleware.
//
// When Pino is not installed, falls back to console-based logging
// with the same JSON format.
// ═══════════════════════════════════════════════════════════════════

import { randomUUID } from 'node:crypto';

// ─── Logger Setup ───────────────────────────────────────────────

let _pino = null;
let _logger = null;

/**
 * Create or return the singleton logger.
 */
export function getLogger() {
    if (_logger) return _logger;

    try {
        // Try to use Pino if installed
        const pinoModule = await import('pino');
        _pino = pinoModule.default || pinoModule;
        _logger = _pino({
            level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
            transport: process.env.NODE_ENV !== 'production' ? {
                target: 'pino-pretty',
                options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
            } : undefined,
            serializers: {
                req: (req) => ({
                    method: req.method,
                    url: req.url,
                    userAgent: req.headers?.['user-agent'],
                    correlationId: req.correlationId,
                }),
                res: (res) => ({
                    statusCode: res.statusCode,
                }),
                err: _pino.stdSerializers?.err || ((err) => ({
                    message: err.message,
                    stack: err.stack,
                    code: err.code,
                })),
            },
        });
        return _logger;
    } catch (_) {
        // Fallback: console-based structured logger
        _logger = createConsoleLogger();
        return _logger;
    }
}

/**
 * Console-based fallback logger with JSON output.
 */
function createConsoleLogger() {
    const level = process.env.LOG_LEVEL || 'info';
    const LEVELS = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 };
    const minLevel = LEVELS[level] || 30;

    function log(lvl, msg, data = {}) {
        if (LEVELS[lvl] < minLevel) return;
        const entry = {
            level: lvl,
            time: new Date().toISOString(),
            msg,
            ...data,
        };
        const fn = lvl === 'error' || lvl === 'fatal' ? console.error
            : lvl === 'warn' ? console.warn
                : console.info;
        fn(JSON.stringify(entry));
    }

    return {
        trace: (msg, data) => log('trace', msg, data),
        debug: (msg, data) => log('debug', msg, data),
        info: (msg, data) => log('info', msg, data),
        warn: (msg, data) => log('warn', msg, data),
        error: (msg, data) => log('error', msg, data),
        fatal: (msg, data) => log('fatal', msg, data),
        child: (bindings) => {
            const childLog = (lvl, msg, data) => log(lvl, msg, { ...bindings, ...data });
            return {
                trace: (msg, data) => childLog('trace', msg, data),
                debug: (msg, data) => childLog('debug', msg, data),
                info: (msg, data) => childLog('info', msg, data),
                warn: (msg, data) => childLog('warn', msg, data),
                error: (msg, data) => childLog('error', msg, data),
                fatal: (msg, data) => childLog('fatal', msg, data),
            };
        },
    };
}

// ─── Express Middleware ─────────────────────────────────────────

/**
 * Correlation ID middleware.
 * Reads `X-Request-ID` header or generates a new UUID.
 * Attaches to req.correlationId and response header.
 */
export function correlationId() {
    return (req, res, next) => {
        const id = req.headers['x-request-id'] || randomUUID();
        req.correlationId = id;
        res.set('X-Request-ID', id);
        next();
    };
}

/**
 * Request logging middleware using structured logger.
 * Logs method, URL, status, duration, and correlation ID.
 */
export function requestLog() {
    return async (req, res, next) => {
        const logger = await getLoggerAsync();
        const start = performance.now();

        res.on('finish', () => {
            const duration = Math.round(performance.now() - start);
            const log = {
                correlationId: req.correlationId,
                method: req.method,
                url: req.originalUrl,
                status: res.statusCode,
                durationMs: duration,
                userId: req.user?.id,
                ip: req.ip,
            };

            if (res.statusCode >= 500) {
                logger.error('Request error', log);
            } else if (res.statusCode >= 400) {
                logger.warn('Client error', log);
            } else {
                logger.info('Request', log);
            }
        });

        next();
    };
}

/**
 * Async logger getter (for use in middleware).
 */
async function getLoggerAsync() {
    if (_logger) return _logger;
    return getLogger();
}

export default { getLogger, correlationId, requestLog };
