// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Security Headers Middleware
// CSP, HSTS, X-Frame-Options, X-Content-Type-Options, XSS, Referrer
// ═══════════════════════════════════════════════════════════════════

/**
 * Security headers middleware.
 * @param {{ isProduction: boolean }} opts
 * @returns {import('express').RequestHandler}
 */
export function securityHeaders({ isProduction }) {
    return (req, res, next) => {
        // Prevent clickjacking
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        // Prevent MIME sniffing
        res.setHeader('X-Content-Type-Options', 'nosniff');
        // XSS protection (legacy browsers)
        res.setHeader('X-XSS-Protection', '1; mode=block');
        // Referrer policy
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        // Permissions policy
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

        // HSTS — enforce HTTPS (production only)
        if (isProduction) {
            res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
        }

        // CSP — permissive enough for all data adapters + Google Fonts
        if (isProduction) {
            res.setHeader('Content-Security-Policy', [
                "default-src 'self'",
                "script-src 'self'",
                "style-src 'self'",
                "font-src 'self'",
                "img-src 'self' data: blob: https:",
                "connect-src 'self' https://api.binance.com https://data-api.binance.vision wss://stream.binance.com:9443 wss://stream.binance.us:9443 wss://data-stream.binance.vision https://api.coingecko.com https://query1.finance.yahoo.com https://hermes.pyth.network wss://ws.kraken.com https://api.kraken.com https://data.sec.gov https://efts.sec.gov https://api.stlouisfed.org https://api.frankfurter.dev https://api.alternative.me https://apewisdom.io https://finnhub.io wss://ws.finnhub.io https://financialmodelingprep.com https://api.whale-alert.io https://api.etherscan.io https://api.polygon.io wss://socket.polygon.io https://data.alpaca.markets https://paper-api.alpaca.markets https://api.alpaca.markets",
                "worker-src 'self' blob:",
                "manifest-src 'self'",
                "base-uri 'self'",
                "form-action 'self'",
                "frame-ancestors 'none'",
                "upgrade-insecure-requests",
                "report-uri /api/csp-report",
            ].join('; '));
        }

        next();
    };
}

/**
 * CSP violation report handler.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export function cspReportHandler(req, res) {
    const report = req.body?.['csp-report'] || req.body;
    if (report) {
        console.warn('[CSP Violation]', JSON.stringify({
            blockedUri: report['blocked-uri'],
            violatedDirective: report['violated-directive'],
            documentUri: report['document-uri'],
            timestamp: new Date().toISOString(),
        }));
    }
    res.status(204).end();
}
