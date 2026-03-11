// ═══════════════════════════════════════════════════════════════════
// charEdge — Vercel Edge Proxy: Polygon.io
//
// Proxies client requests to https://api.polygon.io
// and injects the POLYGON_API_KEY from server-side environment variables.
//
// Route: /api/proxy/polygon/* → https://api.polygon.io/*
// Runtime: Edge
// ═══════════════════════════════════════════════════════════════════

export const config = { runtime: 'edge' };

const POLYGON_BASE = 'https://api.polygon.io';

export default async function handler(request) {
    if (request.method !== 'GET') {
        return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
    }

    const apiKey = process.env.POLYGON_API_KEY;
    if (!apiKey) {
        return Response.json({ ok: false, error: 'Polygon API key not configured' }, { status: 503 });
    }

    const { pathname, searchParams } = new URL(request.url);
    const path = pathname.replace(/^\/api\/proxy\/polygon\/?/, '');
    if (!path) {
        return Response.json({ ok: false, error: 'Missing API path' }, { status: 400 });
    }

    const url = new URL(`${POLYGON_BASE}/${path}`);
    searchParams.forEach((v, k) => url.searchParams.set(k, v));
    url.searchParams.set('apiKey', apiKey);

    try {
        const upstream = await fetch(url.toString(), {
            headers: { 'User-Agent': 'charEdge/1.0' },
            signal: AbortSignal.timeout(15_000),
        });

        return new Response(upstream.body, {
            status: upstream.status,
            headers: {
                'Content-Type': upstream.headers.get('content-type') || 'application/json',
                'Cache-Control': 'public, max-age=5',
            },
        });
    } catch (err) {
        return Response.json({ ok: false, error: `Polygon proxy error: ${err.message}` }, { status: 502 });
    }
}
