import type { Request, Response, NextFunction, Router } from 'express';
// ═══════════════════════════════════════════════════════════════════
// charEdge — Redis Service
//
// Phase 5 Task 5.1.5: Redis client for rate limiting, session
// storage, and API response caching.
//
// Environment variables:
//   REDIS_URL — Redis connection string (default: redis://localhost:6379)
// ═══════════════════════════════════════════════════════════════════

/** @type {Map<string, { value: string, expiresAt: number }>} */
const _memStore = new Map();
let _useMemory = true;
let _redis = null;

/**
 * Get or create the Redis client.
 * Falls back to in-memory Map when Redis is unavailable.
 * @returns {Object} Redis-like client
 */
export async function getRedis() {
    if (_redis) return _redis;

    const url = process.env.REDIS_URL;
    if (!url) {
        console.info('[Redis] REDIS_URL not set — using in-memory fallback');
        _useMemory = true;
        return createMemoryClient();
    }

    try {
        // Dynamic import to avoid requiring ioredis when not configured
        const Redis = (await import('ioredis')).default;
        _redis = new Redis(url, {
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            retryStrategy: (times) => Math.min(times * 200, 5000),
        });

        await _redis.connect();
        _useMemory = false;
        console.info('[Redis] Connected');
        return _redis;
    } catch (err) {
        console.warn('[Redis] Connection failed, using in-memory fallback:', err.message);
        _useMemory = true;
        return createMemoryClient();
    }
}

/**
 * In-memory fallback that mimics basic Redis commands.
 */
function createMemoryClient() {
    // Periodic cleanup of expired keys
    setInterval(() => {
        const now = Date.now();
        for (const [k, v] of _memStore) {
            if (v.expiresAt && v.expiresAt < now) _memStore.delete(k);
        }
    }, 60_000);

    return {
        async get(key) {
            const entry = _memStore.get(key);
            if (!entry) return null;
            if (entry.expiresAt && entry.expiresAt < Date.now()) {
                _memStore.delete(key);
                return null;
            }
            return entry.value;
        },

        async set(key, value, mode, ttl) {
            const expiresAt = (mode === 'EX' && ttl) ? Date.now() + ttl * 1000 : null;
            _memStore.set(key, { value: String(value), expiresAt });
            return 'OK';
        },

        async setex(key, ttl, value) {
            _memStore.set(key, { value: String(value), expiresAt: Date.now() + ttl * 1000 });
            return 'OK';
        },

        async del(key) {
            return _memStore.delete(key) ? 1 : 0;
        },

        async incr(key) {
            const entry = _memStore.get(key);
            const val = entry ? parseInt(entry.value, 10) + 1 : 1;
            _memStore.set(key, { value: String(val), expiresAt: entry?.expiresAt || null });
            return val;
        },

        async expire(key, ttl) {
            const entry = _memStore.get(key);
            if (entry) {
                entry.expiresAt = Date.now() + ttl * 1000;
                return 1;
            }
            return 0;
        },

        async ttl(key) {
            const entry = _memStore.get(key);
            if (!entry) return -2;
            if (!entry.expiresAt) return -1;
            return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
        },

        async ping() { return 'PONG'; },

        get isMemoryFallback() { return true; },
    };
}

/**
 * Check Redis connectivity.
 * @returns {Promise<{ ok: boolean, latencyMs: number, mode: string }>}
 */
export async function pingRedis() {
    const client = await getRedis();
    const start = performance.now();
    try {
        await client.ping();
        return {
            ok: true,
            latencyMs: Math.round(performance.now() - start),
            mode: _useMemory ? 'memory' : 'redis',
        };
    } catch (_) {
        return { ok: false, latencyMs: Math.round(performance.now() - start), mode: 'error' };
    }
}

/**
 * Redis-backed rate limiter.
 * @param {string} key - Rate limit key (e.g. `rl:${ip}`)
 * @param {number} max - Max requests per window
 * @param {number} windowSec - Window duration in seconds
 * @returns {Promise<{ allowed: boolean, remaining: number, resetIn: number }>}
 */
export async function checkRateLimit(key, max = 60, windowSec = 60) {
    const client = await getRedis();
    const count = await client.incr(key);
    if (count === 1) {
        await client.expire(key, windowSec);
    }
    const ttl = await client.ttl(key);
    return {
        allowed: count <= max,
        remaining: Math.max(0, max - count),
        resetIn: ttl > 0 ? ttl : windowSec,
    };
}

/**
 * Close Redis connection.
 */
export async function closeRedis() {
    if (_redis && !_useMemory) {
        await _redis.quit();
        _redis = null;
        console.info('[Redis] Connection closed');
    }
}

export default { getRedis, pingRedis, checkRateLimit, closeRedis };
