// ═══════════════════════════════════════════════════════════════════
// charEdge — Vercel Serverless Proxy: Alpaca Markets
//
// Proxies client requests to Alpaca's data API and injects
// ALPACA_KEY_ID + ALPACA_SECRET from server-side environment variables
// as authentication headers.
//
// Route: /api/proxy/alpaca/* → https://data.alpaca.markets/*
// ═══════════════════════════════════════════════════════════════════

const ALPACA_DATA_BASE = 'https://data.alpaca.markets';

const _hits = new Map();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 200; // Alpaca free tier: 200 req/min

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

    const keyId = process.env.ALPACA_KEY_ID;
    const secret = process.env.ALPACA_SECRET;
    if (!keyId || !secret) {
        return res.status(503).json({ ok: false, error: 'Alpaca API keys not configured' });
    }

    const { proxy } = req.query;
    const path = Array.isArray(proxy) ? proxy.join('/') : proxy || '';
    if (!path) {
        return res.status(400).json({ ok: false, error: 'Missing API path' });
    }

    const url = new URL(`${ALPACA_DATA_BASE}/${path}`);
    for (const [key, value] of Object.entries(req.query)) {
        if (key === 'proxy') continue;
        url.searchParams.set(key, value);
    }

    try {
        const upstream = await fetch(url.toString(), {
            headers: {
                'User-Agent': 'charEdge/1.0',
                'APCA-API-KEY-ID': keyId,
                'APCA-API-SECRET-KEY': secret,
            },
            signal: AbortSignal.timeout(15_000),
        });

        res.setHeader('Cache-Control', 'public, max-age=5');
        res.status(upstream.status);

        const contentType = upstream.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            res.json(await upstream.json());
        } else {
            res.send(await upstream.text());
        }
    } catch (err) {
        res.status(502).json({ ok: false, error: `Alpaca proxy error: ${err.message}` });
    }
}
