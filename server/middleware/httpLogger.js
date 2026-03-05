// ═══════════════════════════════════════════════════════════════════
// charEdge — HTTP Request Logger Middleware (Structured JSON)
//
// Logs non-static HTTP requests as structured JSON lines.
// Parseable by Datadog, CloudWatch, Vercel Logs, etc.
// Filters out static asset requests under 500ms to reduce noise.
// ═══════════════════════════════════════════════════════════════════

/**
 * Express middleware that logs each completed request as structured JSON.
 * @returns {import('express').RequestHandler}
 */
export function httpRequestLogger() {
    return (req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration_ms = Date.now() - start;
            const status = res.statusCode;

            // Skip static assets under 500ms to reduce noise
            if (req.url.match(/\.(js|css|png|jpg|svg|ico|woff2?)$/) && duration_ms < 500) {
                return;
            }

            const logEntry = {
                timestamp: new Date().toISOString(),
                level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
                method: req.method,
                path: req.url,
                status,
                duration_ms,
                content_length: res.getHeader('content-length') || null,
                user_agent: req.get('user-agent') || null,
                request_id: req.id || null,
            };

            process.stdout.write(JSON.stringify(logEntry) + '\n');
        });
        next();
    };
}

