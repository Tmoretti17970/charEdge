// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Exchange API Proxy Routes
// Server-side API key injection — keeps secrets off the client bundle.
// Pattern: /api/proxy/{provider}/{path} → upstream with env key injected.
// ═══════════════════════════════════════════════════════════════════

import { Router } from 'express';
import { checkRateLimit, RATE_LIMIT_WINDOW_MS } from '../middleware/rateLimiter.js';

/**
 * @typedef {Object} ProxyConfig
 * @property {string} base - Upstream API base URL
 * @property {string} [envKey] - Environment variable name for API key (query-param auth)
 * @property {string} [paramName] - Query parameter name to inject API key
 * @property {number} cache - Cache-Control max-age in seconds
 * @property {Record<string, string>} [extraParams] - Additional query parameters
 * @property {'query'|'header'} [authStyle] - Auth injection style (default: 'query')
 * @property {Record<string, string>} [envKeys] - Multiple env var names for header auth
 * @property {Record<string, string>} [headerMap] - Map envKey → header name for header auth
 */

/** @type {Record<string, ProxyConfig>} */
const PROXY_CONFIGS = {
    alpaca: {
        base: 'https://data.alpaca.markets',
        authStyle: 'header',
        envKeys: { keyId: 'ALPACA_KEY_ID', secret: 'ALPACA_SECRET' },
        headerMap: { keyId: 'APCA-API-KEY-ID', secret: 'APCA-API-SECRET-KEY' },
        cache: 5,
    },
    polygon: {
        base: 'https://api.polygon.io',
        envKey: 'POLYGON_API_KEY',
        paramName: 'apiKey',
        cache: 5,
    },
    alphavantage: {
        base: 'https://www.alphavantage.co',
        envKey: 'ALPHAVANTAGE_API_KEY',
        paramName: 'apikey',
        cache: 30,
    },
    fmp: {
        base: 'https://financialmodelingprep.com/api/v3',
        envKey: 'FMP_API_KEY',
        paramName: 'apikey',
        cache: 30,
    },
    fred: {
        base: 'https://api.stlouisfed.org/fred',
        envKey: 'FRED_API_KEY',
        paramName: 'api_key',
        cache: 300,
        extraParams: { file_type: 'json' },
    },
    finnhub: {
        base: 'https://finnhub.io/api/v1',
        envKey: 'FINNHUB_API_KEY',
        paramName: 'token',
        cache: 5,
    },
    tiingo: {
        base: 'https://api.tiingo.com',
        envKey: 'TIINGO_API_TOKEN',
        paramName: 'token',
        cache: 60,
    },
};

/**
 * Creates exchange API proxy router.
 * Supports two auth styles:
 *   - 'query' (default): inject API key as a query parameter
 *   - 'header': inject API credentials as request headers
 * @returns {import('express').Router}
 */
export function createProxyRouter() {
    const router = Router();

    router.get('/api/proxy/:provider/*', async (req, res) => {
        const { provider } = req.params;
        const config = PROXY_CONFIGS[provider];
        if (!config) {
            return res.status(400).json({ ok: false, error: `Unknown provider: ${provider}` });
        }

        const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
        if (!checkRateLimit(clientIp)) {
            res.setHeader('Retry-After', Math.ceil(RATE_LIMIT_WINDOW_MS / 1000));
            return res.status(429).json({ ok: false, error: 'Rate limit exceeded' });
        }

        // Resolve auth credentials
        const isHeaderAuth = config.authStyle === 'header';
        const authHeaders = {};

        if (isHeaderAuth && config.envKeys && config.headerMap) {
            for (const [key, envName] of Object.entries(config.envKeys)) {
                const val = process.env[envName];
                if (!val) {
                    return res.status(503).json({ ok: false, error: `${provider.toUpperCase()} API key not configured (missing ${envName})` });
                }
                const headerName = config.headerMap[key];
                if (headerName) authHeaders[headerName] = val;
            }
        } else {
            const apiKey = process.env[config.envKey];
            if (!apiKey) {
                return res.status(503).json({ ok: false, error: `${provider.toUpperCase()} API key not configured` });
            }
        }

        const proxyPath = req.params[0] || '';
        if (!proxyPath) {
            return res.status(400).json({ ok: false, error: 'Missing API path' });
        }

        // Security: validate proxy path
        const decodedProxyPath = decodeURIComponent(proxyPath);
        if (
            decodedProxyPath.includes('..') ||
            decodedProxyPath.includes('\0') ||
            proxyPath.includes('%2e') ||
            proxyPath.includes('%2E') ||
            proxyPath.includes('%00')
        ) {
            return res.status(400).json({ ok: false, error: 'Invalid path' });
        }

        // Security: validate symbol-like query params
        const symbolParam = /** @type {string|undefined} */ (req.query.symbol || req.query.ticker || req.query.tickers || req.query.q);
        if (symbolParam && typeof symbolParam === 'string') {
            if (!/^[A-Za-z0-9._\-/,^=:]+$/.test(symbolParam) || symbolParam.length > 200) {
                return res.status(400).json({ ok: false, error: 'Invalid symbol format' });
            }
        }

        // Build upstream URL
        const url = new URL(`${config.base}/${proxyPath}`);
        for (const [k, v] of Object.entries(req.query)) {
            if (typeof v === 'string') url.searchParams.set(k, v);
        }
        if (!isHeaderAuth) {
            url.searchParams.set(config.paramName, process.env[config.envKey]);
        }
        if (config.extraParams) {
            for (const [k, v] of Object.entries(config.extraParams)) {
                url.searchParams.set(k, v);
            }
        }

        try {
            const upstream = await fetch(url.toString(), {
                headers: { 'User-Agent': 'charEdge/1.0', ...authHeaders },
                signal: AbortSignal.timeout(15_000),
            });

            res.setHeader('Cache-Control', `public, max-age=${config.cache}`);
            res.status(upstream.status);

            const contentType = upstream.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                res.json(await upstream.json());
            } else {
                res.send(await upstream.text());
            }
        } catch {
            res.status(502).json({ ok: false, error: 'Upstream proxy error' });
        }
    });

    return router;
}
