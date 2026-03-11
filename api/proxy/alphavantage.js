// ═══════════════════════════════════════════════════════════════════
// charEdge — Vercel Edge Proxy: Alpha Vantage
//
// Proxies client requests to https://www.alphavantage.co
// and injects the ALPHAVANTAGE_API_KEY from server-side environment variables.
//
// Route: /api/proxy/alphavantage/* → https://www.alphavantage.co/*
// Runtime: Edge
// ═══════════════════════════════════════════════════════════════════

export const config = { runtime: 'edge' };

const AV_BASE = 'https://www.alphavantage.co';

export default async function handler(request) {
    if (request.method !== 'GET') {
        return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
    }

    const apiKey = process.env.ALPHAVANTAGE_API_KEY;
    if (!apiKey) {
        return Response.json({ ok: false, error: 'Alpha Vantage API key not configured' }, { status: 503 });
    }

    const { pathname, searchParams } = new URL(request.url);
    const path = pathname.replace(/^\/api\/proxy\/alphavantage\/?/, '');
    if (!path) {
        return Response.json({ ok: false, error: 'Missing API path' }, { status: 400 });
    }

    const url = new URL(`${AV_BASE}/${path}`);
    searchParams.forEach((v, k) => url.searchParams.set(k, v));
    url.searchParams.set('apikey', apiKey);

    try {
        const upstream = await fetch(url.toString(), {
            headers: { 'User-Agent': 'charEdge/1.0' },
            signal: AbortSignal.timeout(15_000),
        });

        return new Response(upstream.body, {
            status: upstream.status,
            headers: {
                'Content-Type': upstream.headers.get('content-type') || 'application/json',
                'Cache-Control': 'public, max-age=30',
            },
        });
    } catch (err) {
        return Response.json({ ok: false, error: `Alpha Vantage proxy error: ${err.message}` }, { status: 502 });
    }
}
