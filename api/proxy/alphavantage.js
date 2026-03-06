// ═══════════════════════════════════════════════════════════════════
// charEdge — Vercel Serverless Proxy: Alpha Vantage
//
// Proxies client requests to https://www.alphavantage.co
// and injects the ALPHAVANTAGE_API_KEY from server-side environment variables.
//
// Route: /api/proxy/alphavantage/* → https://www.alphavantage.co/*
// ═══════════════════════════════════════════════════════════════════

const AV_BASE = 'https://www.alphavantage.co';

const _hits = new Map();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 60;

function _checkRateLimit(ip) {
    const now = Date.now();
    let entry = _hits.get(ip);
    if (!entry || entry.resetAt < now) {
        entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
        _hits.set(ip, entry);
    }
    entry.count++;
    return entry.count <= RATE_LIMIT_MAX;
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    if (!_checkRateLimit(clientIp)) {
        res.setHeader('Retry-After', '60');
        return res.status(429).json({ ok: false, error: 'Rate limit exceeded' });
    }

    const apiKey = process.env.ALPHAVANTAGE_API_KEY;
    if (!apiKey) {
        return res.status(503).json({ ok: false, error: 'Alpha Vantage API key not configured' });
    }

    const { proxy } = req.query;
    const path = Array.isArray(proxy) ? proxy.join('/') : proxy || '';
    if (!path) {
        return res.status(400).json({ ok: false, error: 'Missing API path' });
    }

    const url = new URL(`${AV_BASE}/${path}`);
    for (const [key, value] of Object.entries(req.query)) {
        if (key === 'proxy') continue;
        url.searchParams.set(key, value);
    }
    url.searchParams.set('apikey', apiKey);

    try {
        const upstream = await fetch(url.toString(), {
            headers: { 'User-Agent': 'charEdge/1.0' },
            signal: AbortSignal.timeout(15_000),
        });

        res.setHeader('Cache-Control', 'public, max-age=30');
        res.status(upstream.status);

        const contentType = upstream.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            res.json(await upstream.json());
        } else {
            res.send(await upstream.text());
        }
    } catch (err) {
        res.status(502).json({ ok: false, error: `Alpha Vantage proxy error: ${err.message}` });
    }
}
