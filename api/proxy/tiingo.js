// ═══════════════════════════════════════════════════════════════════
// charEdge — Vercel Edge Proxy: Tiingo
//
// Proxies client requests to https://api.tiingo.com
// and injects the TIINGO_API_TOKEN from server-side environment variables.
//
// Route: /api/proxy/tiingo/* → https://api.tiingo.com/*
// Runtime: Edge
// ═══════════════════════════════════════════════════════════════════

export const config = { runtime: 'edge' };

const TIINGO_BASE = 'https://api.tiingo.com';

export default async function handler(request) {
    if (request.method !== 'GET') {
        return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
    }

    const apiToken = process.env.TIINGO_API_TOKEN;
    if (!apiToken) {
        return Response.json({ ok: false, error: 'Tiingo API token not configured' }, { status: 503 });
    }

    const { pathname, searchParams } = new URL(request.url);
    const path = pathname.replace(/^\/api\/proxy\/tiingo\/?/, '');
    if (!path) {
        return Response.json({ ok: false, error: 'Missing API path' }, { status: 400 });
    }

    const url = new URL(`${TIINGO_BASE}/${path}`);
    searchParams.forEach((v, k) => url.searchParams.set(k, v));
    url.searchParams.set('token', apiToken);

    try {
        const upstream = await fetch(url.toString(), {
            headers: { 'User-Agent': 'charEdge/1.0' },
            signal: AbortSignal.timeout(15_000),
        });

        return new Response(upstream.body, {
            status: upstream.status,
            headers: {
                'Content-Type': upstream.headers.get('content-type') || 'application/json',
                'Cache-Control': 'public, max-age=60',
            },
        });
    } catch (err) {
        return Response.json({ ok: false, error: `Tiingo proxy error: ${err.message}` }, { status: 502 });
    }
}
