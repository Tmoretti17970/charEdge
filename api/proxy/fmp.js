// ═══════════════════════════════════════════════════════════════════
// charEdge — Vercel Edge Proxy: Financial Modeling Prep (FMP)
//
// Proxies client requests to https://financialmodelingprep.com/api/v3
// and injects the FMP_API_KEY from server-side environment variables.
//
// Route: /api/proxy/fmp/* → https://financialmodelingprep.com/api/v3/*
// Runtime: Edge
// ═══════════════════════════════════════════════════════════════════

export const config = { runtime: 'edge' };

const FMP_BASE = 'https://financialmodelingprep.com/api/v3';

export default async function handler(request) {
  if (request.method !== 'GET') {
    return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
  }

  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) {
    return Response.json({ ok: false, error: 'FMP API key not configured' }, { status: 503 });
  }

  const { pathname, searchParams } = new URL(request.url);
  const path = pathname.replace(/^\/api\/proxy\/fmp\/?/, '');
  if (!path) {
    return Response.json({ ok: false, error: 'Missing API path' }, { status: 400 });
  }

  const url = new URL(`${FMP_BASE}/${path}`);
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
    return Response.json({ ok: false, error: `FMP proxy error: ${err.message}` }, { status: 502 });
  }
}
