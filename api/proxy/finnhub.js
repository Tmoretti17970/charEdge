// ═══════════════════════════════════════════════════════════════════
// charEdge — Vercel Edge Proxy: Finnhub
//
// Proxies client requests to https://finnhub.io/api/v1
// and injects the FINNHUB_API_KEY from server-side environment variables.
//
// Route: /api/proxy/finnhub/* → https://finnhub.io/api/v1/*
// Runtime: Edge
// ═══════════════════════════════════════════════════════════════════

export const config = { runtime: 'edge' };

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

export default async function handler(request) {
  if (request.method !== 'GET') {
    return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return Response.json({ ok: false, error: 'Finnhub API key not configured' }, { status: 503 });
  }

  const { pathname, searchParams } = new URL(request.url);
  const path = pathname.replace(/^\/api\/proxy\/finnhub\/?/, '');
  if (!path) {
    return Response.json({ ok: false, error: 'Missing API path' }, { status: 400 });
  }

  const url = new URL(`${FINNHUB_BASE}/${path}`);
  searchParams.forEach((v, k) => url.searchParams.set(k, v));
  url.searchParams.set('token', apiKey);

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
    return Response.json({ ok: false, error: `Finnhub proxy error: ${err.message}` }, { status: 502 });
  }
}
