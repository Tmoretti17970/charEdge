// ═══════════════════════════════════════════════════════════════════
// charEdge — Vercel Edge Proxy: FRED (Federal Reserve)
//
// Proxies client requests to https://api.stlouisfed.org/fred
// and injects the FRED_API_KEY from server-side environment variables.
//
// Route: /api/proxy/fred/* → https://api.stlouisfed.org/fred/*
// Runtime: Edge
// ═══════════════════════════════════════════════════════════════════

export const config = { runtime: 'edge' };

const FRED_BASE = 'https://api.stlouisfed.org/fred';

export default async function handler(request) {
  if (request.method !== 'GET') {
    return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
  }

  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return Response.json({ ok: false, error: 'FRED API key not configured' }, { status: 503 });
  }

  const { pathname, searchParams } = new URL(request.url);
  const path = pathname.replace(/^\/api\/proxy\/fred\/?/, '');
  if (!path) {
    return Response.json({ ok: false, error: 'Missing API path' }, { status: 400 });
  }

  const url = new URL(`${FRED_BASE}/${path}`);
  searchParams.forEach((v, k) => url.searchParams.set(k, v));
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('file_type', 'json');

  try {
    const upstream = await fetch(url.toString(), {
      headers: { 'User-Agent': 'charEdge/1.0' },
      signal: AbortSignal.timeout(15_000),
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (err) {
    return Response.json({ ok: false, error: `FRED proxy error: ${err.message}` }, { status: 502 });
  }
}
