// ═══════════════════════════════════════════════════════════════════
// charEdge — Vercel Serverless Proxy: Finnhub
//
// Proxies client requests to https://finnhub.io/api/v1
// and injects the FINNHUB_API_KEY from server-side environment variables.
//
// Route: /api/proxy/finnhub/* → https://finnhub.io/api/v1/*
// ═══════════════════════════════════════════════════════════════════

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

// Simple in-memory rate limiter
const _hits = new Map();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 55; // Finnhub free tier: 60/min — leave 5 headroom

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

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ ok: false, error: 'Finnhub API key not configured' });
  }

  const { proxy } = req.query;
  const path = Array.isArray(proxy) ? proxy.join('/') : proxy || '';
  if (!path) {
    return res.status(400).json({ ok: false, error: 'Missing API path' });
  }

  // Build upstream URL
  const url = new URL(`${FINNHUB_BASE}/${path}`);
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'proxy') continue;
    url.searchParams.set(key, value);
  }
  url.searchParams.set('token', apiKey);

  try {
    const upstream = await fetch(url.toString(), {
      headers: { 'User-Agent': 'charEdge/1.0' },
      signal: AbortSignal.timeout(15_000),
    });

    res.setHeader('Cache-Control', 'public, max-age=5'); // Short cache for real-time data
    res.status(upstream.status);

    const contentType = upstream.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      res.json(await upstream.json());
    } else {
      res.send(await upstream.text());
    }
  } catch (err) {
    res.status(502).json({ ok: false, error: `Finnhub proxy error: ${err.message}` });
  }
}
