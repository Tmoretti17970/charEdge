import type { Request, Response, NextFunction, Router } from 'express';
// ═══════════════════════════════════════════════════════════════════
// charEdge — Prometheus Metrics
//
// Phase 5 Task 5.2.3 + 5.2.4: /metrics endpoint serving
// Prometheus-format metrics with custom performance gauges.
//
// Metrics exposed:
//   - http_requests_total (counter)
//   - http_request_duration_ms (histogram)
//   - active_websocket_connections (gauge)
//   - time_to_first_candle_ms (gauge)
//   - ws_connect_time_ms (gauge)
//   - nodejs_heap_used_bytes (gauge)
// ═══════════════════════════════════════════════════════════════════

// ─── Metric Storage ─────────────────────────────────────────────

const counters = new Map();
const gauges = new Map();
const histograms = new Map();

function incCounter(name, labels = {}) {
    const key = `${name}${JSON.stringify(labels)}`;
    counters.set(key, { name, labels, value: (counters.get(key)?.value || 0) + 1 });
}

function setGauge(name, value, labels = {}) {
    const key = `${name}${JSON.stringify(labels)}`;
    gauges.set(key, { name, labels, value });
}

function observeHistogram(name, value, labels = {}) {
    const key = `${name}${JSON.stringify(labels)}`;
    const h = histograms.get(key) || { name, labels, sum: 0, count: 0, buckets: {} };
    h.sum += value;
    h.count += 1;
    // Standard histogram buckets
    for (const b of [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]) {
        if (!h.buckets[b]) h.buckets[b] = 0;
        if (value <= b) h.buckets[b]++;
    }
    histograms.set(key, h);
}

// ─── Express Middleware ─────────────────────────────────────────

/**
 * Middleware that tracks request count and duration.
 */
export function metricsMiddleware() {
    return (req, res, next) => {
        const start = performance.now();
        res.on('finish', () => {
            const duration = performance.now() - start;
            const route = req.route?.path || req.path || 'unknown';
            const method = req.method;
            const status = String(res.statusCode);
            incCounter('http_requests_total', { method, route, status });
            observeHistogram('http_request_duration_ms', duration, { method, route });
        });
        next();
    };
}

// ─── /metrics Endpoint ──────────────────────────────────────────

function formatLabels(labels) {
    const pairs = Object.entries(labels).map(([k, v]) => `${k}="${v}"`);
    return pairs.length ? `{${pairs.join(',')}}` : '';
}

/**
 * Render all metrics in Prometheus text format.
 * @returns {string}
 */
export function renderMetrics() {
    const lines = [];

    // Node.js process metrics
    const mem = process.memoryUsage();
    lines.push('# HELP nodejs_heap_used_bytes Node.js heap used bytes');
    lines.push('# TYPE nodejs_heap_used_bytes gauge');
    lines.push(`nodejs_heap_used_bytes ${mem.heapUsed}`);
    lines.push(`nodejs_heap_total_bytes ${mem.heapTotal}`);
    lines.push(`nodejs_rss_bytes ${mem.rss}`);
    lines.push(`nodejs_external_bytes ${mem.external}`);

    const uptime = process.uptime();
    lines.push('# HELP process_uptime_seconds Process uptime');
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds ${Math.round(uptime)}`);

    // Counters
    const counterNames = new Set([...counters.values()].map(c => c.name));
    for (const name of counterNames) {
        lines.push(`# HELP ${name} Total count`);
        lines.push(`# TYPE ${name} counter`);
        for (const c of counters.values()) {
            if (c.name === name) {
                lines.push(`${name}${formatLabels(c.labels)} ${c.value}`);
            }
        }
    }

    // Gauges
    const gaugeNames = new Set([...gauges.values()].map(g => g.name));
    for (const name of gaugeNames) {
        lines.push(`# HELP ${name} Gauge value`);
        lines.push(`# TYPE ${name} gauge`);
        for (const g of gauges.values()) {
            if (g.name === name) {
                lines.push(`${name}${formatLabels(g.labels)} ${g.value}`);
            }
        }
    }

    // Histograms
    const histNames = new Set([...histograms.values()].map(h => h.name));
    for (const name of histNames) {
        lines.push(`# HELP ${name} Request duration histogram`);
        lines.push(`# TYPE ${name} histogram`);
        for (const h of histograms.values()) {
            if (h.name === name) {
                const lbl = formatLabels(h.labels);
                for (const [b, count] of Object.entries(h.buckets).sort((a, b) => a[0] - b[0])) {
                    lines.push(`${name}_bucket${lbl ? lbl.slice(0, -1) + `,le="${b}"}` : `{le="${b}"}`} ${count}`);
                }
                lines.push(`${name}_bucket${lbl ? lbl.slice(0, -1) + ',le="+Inf"}' : '{le="+Inf"}'} ${h.count}`);
                lines.push(`${name}_sum${lbl} ${h.sum.toFixed(2)}`);
                lines.push(`${name}_count${lbl} ${h.count}`);
            }
        }
    }

    return lines.join('\n') + '\n';
}

/**
 * Express route handler for GET /metrics.
 */
export function metricsHandler(req, res) {
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(renderMetrics());
}

// ─── Custom Metric Setters ──────────────────────────────────────

export function setWsConnections(count) { setGauge('active_websocket_connections', count); }
export function setTimeToFirstCandle(ms) { setGauge('time_to_first_candle_ms', ms); }
export function setWsConnectTime(ms) { setGauge('ws_connect_time_ms', ms); }
export function recordError(type) { incCounter('errors_total', { type }); }

export default {
    metricsMiddleware,
    metricsHandler,
    renderMetrics,
    incCounter,
    setGauge,
    observeHistogram,
    setWsConnections,
    setTimeToFirstCandle,
    setWsConnectTime,
    recordError,
};
