// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — API Middleware (TypeScript)
//
// Express middleware stack for the public API.
// Phase 2: Converted to TypeScript with full type annotations.
// ═══════════════════════════════════════════════════════════════════

import type { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from 'express';

// ─── Types ────────────────────────────────────────────────────────

export interface ApiKeyData {
  id: string;
  userId: string;
  createdAt: number;
}

export interface ApiKeyStore {
  validate(key: string): ApiKeyData | null;
  create(userId: string): ApiKeyData;
}

export interface RateLimiterOptions {
  windowMs?: number | undefined;
  max?: number | undefined;
  /** Use Redis-backed rate limiting (distributed). Falls back to in-memory if Redis unavailable. */
  useRedis?: boolean | undefined;
}

export interface CorsOptions {
  origins?: string[] | undefined;
}

export interface PaginationDefaults {
  limit?: number | undefined;
  maxLimit?: number | undefined;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  meta?: Record<string, unknown>;
  error?: { code: string; message: string; retryAfter?: number };
}

// Augment Express Request with our custom properties
declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKeyData;
      userId?: string;
    }
  }
}

// ─── API Key Authentication ───────────────────────────────────

const API_KEY_HEADER = 'x-api-key';
const API_KEY_QUERY = 'api_key';

/**
 * Validates API key from header or query param.
 */
export function apiKeyAuth(keyStore: ApiKeyStore): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = (req.headers[API_KEY_HEADER] as string | undefined) || (req.query[API_KEY_QUERY] as string | undefined);

    if (!key) {
      res.status(401).json({
        ok: false,
        error: {
          code: 'AUTH_MISSING',
          message: 'API key required. Pass via x-api-key header or api_key query param.',
        },
      });
      return;
    }

    const keyData = keyStore.validate(key);
    if (!keyData) {
      res.status(401).json({
        ok: false,
        error: {
          code: 'AUTH_INVALID',
          message: 'Invalid or revoked API key.',
        },
      });
      return;
    }

    req.apiKey = keyData;
    req.userId = keyData.userId;
    next();
  };
}

/**
 * Rate limiter middleware.
 *
 * Supports two modes:
 * - **In-memory** (default): sliding window per-key, suitable for dev/single-instance.
 * - **Redis** (`useRedis: true`): delegates to redis.ts `checkRateLimit()` for
 *   distributed production deployments. Falls back to in-memory if Redis unavailable.
 */
export function rateLimiter({ windowMs = 60_000, max = 60, useRedis = false }: RateLimiterOptions = {}): RequestHandler {
  // ── Redis-backed path ──────────────────────────────────────
  if (useRedis) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const { checkRateLimit } = await import('./services/redis.js');
        const key = `rl:${req.userId || req.apiKey?.id || req.ip || 'anon'}`;
        const windowSec = Math.ceil(windowMs / 1000);
        const { allowed, remaining, resetIn } = await checkRateLimit(key, max, windowSec);

        res.set('X-RateLimit-Limit', String(max));
        res.set('X-RateLimit-Remaining', String(remaining));
        res.set('X-RateLimit-Reset', String(Math.ceil((Date.now() + resetIn * 1000) / 1000)));

        if (!allowed) {
          res.set('Retry-After', String(resetIn));
          res.status(429).json({
            ok: false,
            error: {
              code: 'RATE_LIMITED',
              message: `Rate limit exceeded. Try again in ${resetIn}s.`,
              retryAfter: resetIn,
            },
          });
          return;
        }

        next();
      } catch {
        // Redis unavailable — fall through to allow request (fail-open)
        next();
      }
    };
  }

  // ── In-memory sliding window path ──────────────────────────
  const hits = new Map<string, RateLimitEntry>();

  // Cleanup expired entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) {
      if (v.resetAt < now) hits.delete(k);
    }
  }, 300_000);

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.userId || req.apiKey?.id || req.ip || 'anonymous';
    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count++;

    const remaining = Math.max(0, max - entry.count);
    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(remaining));
    res.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      res.status(429).json({
        ok: false,
        error: {
          code: 'RATE_LIMITED',
          message: `Rate limit exceeded. Try again in ${retryAfter}s.`,
          retryAfter,
        },
      });
      return;
    }

    next();
  };
}

// ─── CORS ─────────────────────────────────────────────────────

/**
 * CORS middleware for API routes.
 */
export function cors({ origins = ['*'] }: CorsOptions = {}): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;

    if (origins.includes('*') || (origin && origins.includes(origin))) {
      res.set('Access-Control-Allow-Origin', origin || '*');
    }

    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
    res.set('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}

// ─── Request Logger ───────────────────────────────────────────

export function requestLogger(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();
    const { method, originalUrl } = req;

    res.on('finish', () => {
      const ms = Date.now() - start;
      const status = res.statusCode;
      const keyId = req.apiKey?.id?.slice(0, 8) || 'no-key';
      // Server-side logging via process.stdout (ESLint-safe)
      process.stdout.write(`[API] ${method} ${originalUrl} → ${status} (${ms}ms) [${keyId}]\n`);
    });

    next();
  };
}

// ─── Audit Logger ─────────────────────────────────────────────

interface AuditLoggerOptions {
  /** SQLite database instance */
  getDb: () => { prepare: (sql: string) => { run: (...args: unknown[]) => void } } | null;
  /** Methods to skip (default: GET, HEAD, OPTIONS) */
  skipMethods?: string[];
}

/**
 * Audit logging middleware — records userId, endpoint, method,
 * timestamp, IP, and response status to the audit_log SQLite table.
 * Non-blocking: writes happen in res.on('finish').
 */
export function auditLogger({ getDb, skipMethods = ['GET', 'HEAD', 'OPTIONS'] }: AuditLoggerOptions): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (skipMethods.includes(req.method)) {
      next();
      return;
    }

    res.on('finish', () => {
      try {
        const db = getDb();
        if (!db) return;

        db.prepare(
          `INSERT INTO audit_log (user_id, action, entity_type, entity_id, metadata, created_at)
                     VALUES (?, ?, ?, ?, ?, ?)`
        ).run(
          req.userId || 'anonymous',
          `${req.method} ${req.originalUrl}`,
          req.baseUrl?.replace('/api/v1/', '') || 'api',
          null,
          JSON.stringify({
            status: res.statusCode,
            ip: req.ip || req.socket?.remoteAddress || 'unknown',
            userAgent: (req.headers['user-agent'] || '').slice(0, 200),
          }),
          Date.now(),
        );
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_) {
        // Non-critical — never block the response
      }
    });

    next();
  };
}

// ─── Error Handler ────────────────────────────────────────────

interface ApiError extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
}

/**
 * Final error handler for API routes.
 */
export function apiErrorHandler(): ErrorRequestHandler {
  return (err: ApiError, _req: Request, res: Response, _next: NextFunction): void => {
    process.stderr.write(`[API Error] ${err.stack || err.message}\n`);

    const status = err.status || err.statusCode || 500;
    const code = err.code || 'INTERNAL_ERROR';
    const message = status === 500 ? 'An internal error occurred.' : err.message || 'Unknown error';

    res.status(status).json({
      ok: false,
      error: { code, message },
    });
  };
}

// ─── Pagination Helper ────────────────────────────────────────

export function parsePagination(
  query: Record<string, string | undefined>,
  defaults: PaginationDefaults = { limit: 20, maxLimit: 100 },
): { limit: number; offset: number } {
  const defaultLimit = defaults.limit ?? 20;
  const maxLimit = defaults.maxLimit ?? 100;
  let limit = parseInt(query.limit || '', 10) || defaultLimit;
  let offset = parseInt(query.offset || '', 10) || 0;
  limit = Math.min(Math.max(1, limit), maxLimit);
  offset = Math.max(0, offset);
  return { limit, offset };
}

// ─── Response Helpers ─────────────────────────────────────────

export function okResponse<T>(res: Response, data: T, meta?: Record<string, unknown>): void {
  const body: ApiResponse<T> = { ok: true, data };
  if (meta) body.meta = meta;
  res.json(body);
}

export function errorResponse(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({
    ok: false,
    error: { code, message },
  });
}

// ─── P2 8.4: Not Found Handler ──────────────────────────────────

/**
 * Catch-all 404 handler for API routes.
 * Mount after all API route handlers to return proper JSON 404s
 * instead of falling through to the SPA index.html catch-all.
 */
export function notFound(): RequestHandler {
  return (_req: Request, res: Response, _next: NextFunction): void => {
    res.status(404).json({
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: `API endpoint not found: ${_req.method} ${_req.originalUrl}`,
      },
    });
  };
}
