// ═══════════════════════════════════════════════════════════════════
// charEdge — Vercel Edge Proxy: Alpaca Markets
//
// Proxies client requests to Alpaca's data API and injects
// ALPACA_KEY_ID + ALPACA_SECRET from server-side environment variables
// as authentication headers.
//
// Route: /api/proxy/alpaca/* → https://data.alpaca.markets/*
// Runtime: Edge (runs at CDN edge, ~50ms cold start)
// ═══════════════════════════════════════════════════════════════════

export const config = { runtime: 'edge' };

const ALPACA_DATA_BASE = 'https://data.alpaca.markets';

export default async function handler(request) {
    if (request.method !== 'GET') {
        return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
    }

    const keyId = process.env.ALPACA_KEY_ID;
    const secret = process.env.ALPACA_SECRET;
    if (!keyId || !secret) {
        return Response.json({ ok: false, error: 'Alpaca API keys not configured' }, { status: 503 });
    }

    const { pathname, searchParams } = new URL(request.url);
    const path = pathname.replace(/^\/api\/proxy\/alpaca\/?/, '');
    if (!path) {
        return Response.json({ ok: false, error: 'Missing API path' }, { status: 400 });
    }

    const url = new URL(`${ALPACA_DATA_BASE}/${path}`);
    searchParams.forEach((v, k) => url.searchParams.set(k, v));

    try {
        const upstream = await fetch(url.toString(), {
            headers: {
                'User-Agent': 'charEdge/1.0',
                'APCA-API-KEY-ID': keyId,
                'APCA-API-SECRET-KEY': secret,
            },
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
        return Response.json({ ok: false, error: `Alpaca proxy error: ${err.message}` }, { status: 502 });
    }
}
