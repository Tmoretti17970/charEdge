// ═══════════════════════════════════════════════════════════════════
// charEdge — Health Check Middleware
//
// GET /api/health — returns server health status as JSON.
// Checks: uptime, memory usage, and downstream readiness.
// ═══════════════════════════════════════════════════════════════════

/**
 * Health check endpoint for monitoring and load balancers.
 * @returns {import('express').Router}
 */
export function healthCheck() {
    return (req, res) => {
        const uptime = process.uptime();
        const mem = process.memoryUsage();

        const health = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime_seconds: Math.round(uptime),
            memory: {
                rss_mb: Math.round(mem.rss / 1048576),
                heap_used_mb: Math.round(mem.heapUsed / 1048576),
                heap_total_mb: Math.round(mem.heapTotal / 1048576),
            },
            version: process.env.npm_package_version || 'unknown',
            node_version: process.version,
        };

        res.status(200).json(health);
    };
}
