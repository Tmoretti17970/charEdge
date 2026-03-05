// ═══════════════════════════════════════════════════════════════════
// charEdge — Health Check Service
//
// Phase 5 Task 5.2.5: Multi-component health check covering
// database, Redis, upstream APIs, and WebSocket connections.
//
// GET /api/health → structured JSON with per-component status
// ═══════════════════════════════════════════════════════════════════

import { pingDb } from '../db/connection.js';
import { pingRedis } from './redis.js';

/**
 * Run all health checks and return structured results.
 * @param {Object} [context] - Optional context (e.g. wsConnectionCount)
 * @returns {Promise<Object>}
 */
export async function runHealthCheck(context = {}) {
    const start = performance.now();

    // Run checks in parallel
    const [db, redis, upstream] = await Promise.allSettled([
        checkDatabase(),
        checkRedis(),
        checkUpstream(),
    ]);

    const components = {
        database: db.status === 'fulfilled' ? db.value : { ok: false, error: 'check_failed' },
        redis: redis.status === 'fulfilled' ? redis.value : { ok: false, error: 'check_failed' },
        upstream: upstream.status === 'fulfilled' ? upstream.value : { ok: false, error: 'check_failed' },
    };

    // Add WebSocket info if available
    if (context.wsConnectionCount !== undefined) {
        components.websocket = {
            ok: true,
            activeConnections: context.wsConnectionCount,
        };
    }

    const allOk = Object.values(components).every(c => c.ok);
    const totalMs = Math.round(performance.now() - start);

    return {
        status: allOk ? 'healthy' : 'degraded',
        version: process.env.npm_package_version || 'unknown',
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
        checkDurationMs: totalMs,
        components,
    };
}

/**
 * Check database connectivity.
 */
async function checkDatabase() {
    try {
        const result = await pingDb();
        return {
            ok: result.ok,
            latencyMs: result.latencyMs,
            type: 'postgresql',
        };
    } catch (err) {
        return { ok: false, error: err.message, type: 'postgresql' };
    }
}

/**
 * Check Redis connectivity.
 */
async function checkRedis() {
    try {
        const result = await pingRedis();
        return {
            ok: result.ok,
            latencyMs: result.latencyMs,
            mode: result.mode,
        };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

/**
 * Check upstream API availability (Binance, etc.).
 */
async function checkUpstream() {
    const upstreams = [
        { name: 'binance', url: 'https://api.binance.com/api/v3/ping' },
    ];

    const results = {};
    for (const { name, url } of upstreams) {
        try {
            const start = performance.now();
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            results[name] = {
                ok: res.ok,
                latencyMs: Math.round(performance.now() - start),
                status: res.status,
            };
        } catch (err) {
            results[name] = { ok: false, error: err.message };
        }
    }

    return {
        ok: Object.values(results).some(r => r.ok),
        apis: results,
    };
}

/**
 * Express route handler for GET /api/health.
 */
export async function healthHandler(req, res) {
    const result = await runHealthCheck({
        wsConnectionCount: req.app?.locals?.wsConnectionCount,
    });
    const status = result.status === 'healthy' ? 200 : 503;
    res.status(status).json(result);
}

export default { runHealthCheck, healthHandler };
