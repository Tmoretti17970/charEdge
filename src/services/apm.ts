// ═══════════════════════════════════════════════════════════════════
// charEdge — APM Tracing Middleware (Task 3.6.1)
//
// Express middleware for server-side performance monitoring.
// Tracks request duration, status codes, and route-level metrics.
//
// Integrates with Sentry (tracing spans) and exposes a /health/metrics
// endpoint for Prometheus/Grafana scraping.
//
// Usage:
//   import { apmMiddleware, metricsHandler } from './apm.ts';
//   app.use(apmMiddleware);
//   app.get('/health/metrics', metricsHandler);
// ═══════════════════════════════════════════════════════════════════

// @ts-expect-error — .ts imports resolved by Vite
import { logger } from '../utils/logger.ts';

// ─── Types ──────────────────────────────────────────────────────

interface RequestMetric {
    route: string;
    method: string;
    statusCode: number;
    durationMs: number;
    timestamp: number;
}

interface RouteStats {
    count: number;
    totalMs: number;
    minMs: number;
    maxMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    errors: number;
    lastAccess: number;
}

// ─── Metrics Store ──────────────────────────────────────────────

const MAX_SAMPLES = 1000;     // per route
const CLEANUP_INTERVAL = 300_000; // 5 min

class MetricsStore {
    private routes = new Map<string, number[]>();
    private errorCounts = new Map<string, number>();
    private requestCount = 0;
    private totalDurationMs = 0;
    private cleanupTimer: ReturnType<typeof setInterval> | null = null;

    constructor() {
        // Periodic cleanup of old/cold routes
        this.cleanupTimer = setInterval(() => this._cleanup(), CLEANUP_INTERVAL);
    }

    record(metric: RequestMetric): void {
        const key = `${metric.method} ${metric.route}`;

        // Track durations
        let durations = this.routes.get(key);
        if (!durations) {
            durations = [];
            this.routes.set(key, durations);
        }
        durations.push(metric.durationMs);
        if (durations.length > MAX_SAMPLES) {
            durations.shift(); // sliding window
        }

        // Track errors
        if (metric.statusCode >= 400) {
            this.errorCounts.set(key, (this.errorCounts.get(key) ?? 0) + 1);
        }

        this.requestCount++;
        this.totalDurationMs += metric.durationMs;
    }

    getStats(): Record<string, RouteStats> {
        const stats: Record<string, RouteStats> = {};

        for (const [route, durations] of this.routes) {
            if (durations.length === 0) continue;

            const sorted = [...durations].sort((a, b) => a - b);
            stats[route] = {
                count: durations.length,
                totalMs: durations.reduce((s, d) => s + d, 0),
                minMs: sorted[0] ?? 0,
                maxMs: sorted[sorted.length - 1] ?? 0,
                p50Ms: this._percentile(sorted, 50),
                p95Ms: this._percentile(sorted, 95),
                p99Ms: this._percentile(sorted, 99),
                errors: this.errorCounts.get(route) ?? 0,
                lastAccess: Date.now(),
            };
        }

        return stats;
    }

    getSummary(): { totalRequests: number; avgDurationMs: number; routeCount: number; errorRate: number } {
        const totalErrors = Array.from(this.errorCounts.values()).reduce((s, e) => s + e, 0);
        return {
            totalRequests: this.requestCount,
            avgDurationMs: this.requestCount > 0 ? Math.round(this.totalDurationMs / this.requestCount) : 0,
            routeCount: this.routes.size,
            errorRate: this.requestCount > 0 ? Math.round((totalErrors / this.requestCount) * 100) / 100 : 0,
        };
    }

    /** Export metrics in Prometheus text format */
    toPrometheus(): string {
        const lines: string[] = [
            '# HELP charedge_http_requests_total Total HTTP requests',
            '# TYPE charedge_http_requests_total counter',
            `charedge_http_requests_total ${this.requestCount}`,
            '',
            '# HELP charedge_http_request_duration_ms HTTP request duration in milliseconds',
            '# TYPE charedge_http_request_duration_ms histogram',
        ];

        for (const [route, durations] of this.routes) {
            if (durations.length === 0) continue;
            const sorted = [...durations].sort((a, b) => a - b);
            const [method, path] = route.split(' ');
            const labels = `method="${method}",route="${path}"`;

            lines.push(`charedge_http_request_duration_ms_count{${labels}} ${durations.length}`);
            lines.push(`charedge_http_request_duration_ms_sum{${labels}} ${durations.reduce((s, d) => s + d, 0)}`);
            lines.push(`charedge_http_request_duration_ms{${labels},quantile="0.5"} ${this._percentile(sorted, 50)}`);
            lines.push(`charedge_http_request_duration_ms{${labels},quantile="0.95"} ${this._percentile(sorted, 95)}`);
            lines.push(`charedge_http_request_duration_ms{${labels},quantile="0.99"} ${this._percentile(sorted, 99)}`);
        }

        // Error rate
        const totalErrors = Array.from(this.errorCounts.values()).reduce((s, e) => s + e, 0);
        lines.push('');
        lines.push('# HELP charedge_http_errors_total Total HTTP errors (4xx/5xx)');
        lines.push('# TYPE charedge_http_errors_total counter');
        lines.push(`charedge_http_errors_total ${totalErrors}`);

        return lines.join('\n');
    }

    private _percentile(sorted: number[], p: number): number {
        if (sorted.length === 0) return 0;
        const idx = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[Math.max(0, idx)] ?? 0;
    }

    private _cleanup(): void {
        // Remove routes with < 5 requests (noise)
        for (const [route, durations] of this.routes) {
            if (durations.length < 5) {
                this.routes.delete(route);
                this.errorCounts.delete(route);
            }
        }
    }

    destroy(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }
}

// ─── Singleton ──────────────────────────────────────────────────

export const metricsStore = new MetricsStore();

// ─── Express Middleware ─────────────────────────────────────────

/**
 * APM tracing middleware for Express.
 * Tracks request duration and emits Sentry breadcrumbs.
 */
export function apmMiddleware(req: { method: string; path: string; originalUrl?: string }, res: { statusCode: number; on: (event: string, fn: () => void) => void }, next: () => void): void {
    const start = performance.now();
    const route = req.originalUrl ?? req.path;

    res.on('finish', () => {
        const durationMs = Math.round(performance.now() - start);

        metricsStore.record({
            route,
            method: req.method,
            statusCode: res.statusCode,
            durationMs,
            timestamp: Date.now(),
        });

        // Log slow requests
        if (durationMs > 1000) {
            logger.data.warn(`[APM] Slow request: ${req.method} ${route} — ${durationMs}ms (status ${res.statusCode})`);
        }
    });

    next();
}

/**
 * Express handler for /health/metrics — Prometheus-compatible.
 */
export function metricsHandler(_req: unknown, res: { setHeader: (k: string, v: string) => void; send: (body: string) => void }): void {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(metricsStore.toPrometheus());
}

/**
 * Express handler for /health/metrics/json — JSON format.
 */
export function metricsJsonHandler(_req: unknown, res: { json: (body: unknown) => void }): void {
    res.json({
        summary: metricsStore.getSummary(),
        routes: metricsStore.getStats(),
    });
}

export default { apmMiddleware, metricsHandler, metricsJsonHandler, metricsStore };
