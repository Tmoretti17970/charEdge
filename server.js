// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v11.0 — Production Server
//
// Modes:
//   Development:  npm run dev        (Vite dev server, HMR)
//   Dev + SSR:    npm run dev:ssr    (This file + Vite middleware)
//   Production:   npm run build && npm run serve
//
// Features:
//   ✓ SSR for public/SEO pages (symbol, snapshot, leaderboard)
//   ✓ SPA fallback for authenticated app routes
//   ✓ Gzip/Brotli compression
//   ✓ Security headers
//   ✓ Static asset caching (1yr for hashed, no-cache for HTML)
//   ✓ Health check endpoint
//   ✓ Graceful shutdown
//   ✓ Request logging
//   ✓ Error handling
// ═══════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import compression from 'compression';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT || '5173', 10);
const HOST = process.env.HOST || '0.0.0.0';

// ─── App Setup ───────────────────────────────────────────────────
const app = express();

// Trust proxy — only enable when behind a reverse proxy (Nginx, Cloudflare, Fly.io)
// Without a proxy, attackers can spoof IP via X-Forwarded-For, bypassing rate limits.
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// ─── Security Headers ────────────────────────────────────────────
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // XSS protection (legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions policy
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // HSTS — enforce HTTPS (production only)
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  // CSP — permissive enough for Binance WebSocket + Google Fonts
  if (isProduction) {
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://api.binance.com wss://stream.binance.com:9443 wss://stream.binance.us:9443 https://api.coingecko.com https://query1.finance.yahoo.com https://hermes.pyth.network wss://ws.kraken.com https://api.kraken.com https://data.sec.gov https://efts.sec.gov https://api.stlouisfed.org https://api.frankfurter.dev https://api.alternative.me https://apewisdom.io https://finnhub.io wss://ws.finnhub.io https://financialmodelingprep.com https://api.whale-alert.io https://api.etherscan.io",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join('; '));
  }

  next();
});

// ─── Compression ─────────────────────────────────────────────────
app.use(compression({
  level: 6,
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

// ─── Request Logging ─────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const status = res.statusCode;
    const color = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
    // Only log non-asset requests or slow requests
    if (!req.url.match(/\.(js|css|png|jpg|svg|ico|woff2?)$/) || ms > 500) {
      console.log(`${color}${status}\x1b[0m ${req.method} ${req.url} \x1b[90m${ms}ms\x1b[0m`);
    }
  });
  next();
});

// ─── Health Check ────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '11.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage().rss,
    timestamp: new Date().toISOString(),
  });
});

// ─── RSS Proxy for News Aggregation ──────────────────────────────
// Lightweight proxy to fetch RSS feeds that don't support CORS.
// Only allows known RSS domains for security.
const ALLOWED_RSS_DOMAINS = [
  'finance.yahoo.com', 'news.google.com', 'efts.sec.gov',
  'feeds.reuters.com', 'rss.nytimes.com',
];

// ─── Rate Limiter (in-memory, per-IP) ────────────────────────────
// No npm dependency needed — simple sliding window counter.
const _rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 30;           // max requests per window (stricter for proxy)

function _checkRateLimit(ip) {
  const now = Date.now();
  let entry = _rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    _rateLimitMap.set(ip, entry);
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

// Periodic cleanup of stale rate-limit entries (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of _rateLimitMap) {
    if (now > entry.resetAt) _rateLimitMap.delete(ip);
  }
}, 5 * 60_000);

app.get('/api/proxy/rss', async (req, res) => {
  // Rate limit check
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  if (!_checkRateLimit(clientIp)) {
    res.setHeader('Retry-After', Math.ceil(RATE_LIMIT_WINDOW_MS / 1000));
    return res.status(429).json({
      error: 'Too many requests. Limit: 30 per minute.',
      retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
    });
  }

  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'Missing url parameter' });

  try {
    const parsed = new URL(targetUrl);

    // Security: only allow HTTPS
    if (parsed.protocol !== 'https:') {
      return res.status(400).json({ error: 'Only HTTPS URLs are allowed' });
    }

    // Security: block path traversal attempts (encoded or decoded)
    const decodedPath = decodeURIComponent(parsed.pathname);
    if (decodedPath.includes('..') || parsed.pathname.includes('%2e') || parsed.pathname.includes('%2E')) {
      return res.status(400).json({ error: 'Path traversal not allowed' });
    }

    // Security: domain allowlist
    if (!ALLOWED_RSS_DOMAINS.some(d => parsed.hostname.endsWith(d))) {
      return res.status(403).json({ error: 'Domain not allowed' });
    }

    const resp = await fetch(parsed.href, {
      headers: { 'User-Agent': 'charEdge/11.0' },
      signal: AbortSignal.timeout(5000),
      redirect: 'error', // Don't follow redirects (SSRF prevention)
    });
    if (!resp.ok) return res.status(resp.status).json({ error: 'Upstream error' });

    const text = await resp.text();
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache
    res.send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API Routes ──────────────────────────────────────────────────
import { createApiRouter } from './src/api/routes.js';
import {
  apiKeyAuth,
  rateLimiter,
  cors as apiCors,
  requestLogger,
  apiErrorHandler,
} from './src/api/middleware.js';

// Simple in-memory API key store for self-hosted mode
const _apiKeyStore = {
  _keys: new Map(),
  validate(key) {
    return this._keys.get(key) || null;
  },
  create(userId) {
    const key = `tf_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const data = { id: key, userId, createdAt: Date.now() };
    this._keys.set(key, data);
    return data;
  },
};

// Auto-create a dev API key in development
if (!isProduction) {
  const devKey = _apiKeyStore.create('dev-user');
  console.info(`[API] Dev API key: ${devKey.id}`);
}

// Mount API middleware + routes
app.use('/api/v1', express.json({ limit: '10mb' }));
app.use('/api/v1', apiCors());
app.use('/api/v1', rateLimiter({ windowMs: 60_000, max: 120 }));
app.use('/api/v1', apiKeyAuth(_apiKeyStore));
app.use('/api/v1', requestLogger());
app.use('/api/v1', createApiRouter({ _keyStore: _apiKeyStore }));
app.use('/api/v1', apiErrorHandler());

// ═══════════════════════════════════════════════════════════════════
// Production Mode
// ═══════════════════════════════════════════════════════════════════
if (isProduction) {
  const distClient = path.join(__dirname, 'dist/client');
  const distServer = path.join(__dirname, 'dist/server');

  // Verify build exists
  if (!fs.existsSync(distClient)) {
    console.error('\x1b[31m✗ Build not found. Run: npm run build\x1b[0m');
    process.exit(1);
  }

  // Read index.html template
  const template = fs.readFileSync(path.join(distClient, 'index.html'), 'utf-8');

  // Load SSR module
  let ssrRender = null;
  const ssrEntry = path.join(distServer, 'entry-server.js');
  if (fs.existsSync(ssrEntry)) {
    try {
      const ssrModule = await import(ssrEntry);
      ssrRender = ssrModule.render;
      console.log('✓ SSR module loaded');
    } catch (err) {
      console.warn('⚠ SSR module failed to load, falling back to SPA mode:', err.message);
    }
  }

  // ─── Static Assets (hashed = immutable cache) ──────────
  app.use('/assets', express.static(path.join(distClient, 'assets'), {
    maxAge: '1y',
    immutable: true,
    etag: false,
  }));

  // ─── Other Static Files (icons, manifest, sw.js) ───────
  app.use(express.static(distClient, {
    maxAge: '1h',
    index: false, // Don't serve index.html for /
  }));

  // ─── Service Worker (no-cache — must always be fresh) ──
  app.get('/sw.js', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(distClient, 'sw.js'));
  });

  // ─── All Routes → SSR or SPA Fallback ──────────────────
  app.get('*', async (req, res) => {
    try {
      let html = template;

      // Try SSR for public/SEO pages
      if (ssrRender) {
        const ssrResult = await ssrRender(req.originalUrl);

        if (ssrResult.redirect) {
          return res.redirect(ssrResult.statusCode || 302, ssrResult.redirect);
        }

        if (ssrResult.html) {
          html = html.replace('<!--ssr-outlet-->', ssrResult.html);
        }
        if (ssrResult.head) {
          html = html.replace('<!--ssr-head-->', ssrResult.head);
        }

        res.status(ssrResult.statusCode || 200);
      }

      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(html);
    } catch (err) {
      console.error('SSR render error:', err);
      // Fallback: serve SPA shell
      res.status(200)
        .setHeader('Content-Type', 'text/html')
        .send(template);
    }
  });

// ═══════════════════════════════════════════════════════════════════
// Development Mode (with Vite middleware)
// ═══════════════════════════════════════════════════════════════════
} else {
  const { createServer: createViteServer } = await import('vite');

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });

  // Use Vite's middleware for HMR, module transforms, etc.
  app.use(vite.middlewares);

  // All routes → SSR with Vite transforms
  app.get('*', async (req, res) => {
    try {
      // Read fresh template (Vite transforms it)
      let template = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
      template = await vite.transformIndexHtml(req.originalUrl, template);

      // Load SSR module through Vite (gets HMR)
      const { render } = await vite.ssrLoadModule('/src/entry-server.jsx');
      const ssrResult = await render(req.originalUrl);

      if (ssrResult.redirect) {
        return res.redirect(ssrResult.statusCode || 302, ssrResult.redirect);
      }

      let html = template;
      if (ssrResult.html) {
        html = html.replace('<!--ssr-outlet-->', ssrResult.html);
      }
      if (ssrResult.head) {
        html = html.replace('<!--ssr-head-->', ssrResult.head);
      }

      res.status(ssrResult.statusCode || 200)
        .setHeader('Content-Type', 'text/html')
        .send(html);
    } catch (err) {
      vite.ssrFixStacktrace(err);
      console.error('Dev SSR error:', err);
      res.status(500).send(`
        <pre style="color:red;font-family:monospace;padding:2em;white-space:pre-wrap">
          ${err.stack || err.message}
        </pre>
      `);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// Start Server
// ═══════════════════════════════════════════════════════════════════
const server = app.listen(PORT, HOST, () => {
  const mode = isProduction ? '\x1b[32mproduction\x1b[0m' : '\x1b[33mdevelopment\x1b[0m';
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║         TradeForge OS v11.0              ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
  console.log(`  → Mode:    ${mode}`);
  console.log(`  → Local:   \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
  console.log(`  → Network: \x1b[36mhttp://${HOST}:${PORT}\x1b[0m`);
  console.log('');
  if (!isProduction) {
    console.log('  \x1b[90mHMR enabled. Edit files and see changes instantly.\x1b[0m');
    console.log('');
  }
});

// ─── Graceful Shutdown ───────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n\x1b[33m${signal} received. Shutting down gracefully...\x1b[0m`);
  server.close(() => {
    console.log('\x1b[32m✓ Server closed\x1b[0m');
    process.exit(0);
  });
  // Force kill after 10s
  setTimeout(() => {
    console.error('\x1b[31m✗ Forced shutdown after timeout\x1b[0m');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ─── Unhandled Errors ────────────────────────────────────────────
process.on('unhandledRejection', (err) => {
  console.error('\x1b[31mUnhandled Promise Rejection:\x1b[0m', err);
});

process.on('uncaughtException', (err) => {
  console.error('\x1b[31mUncaught Exception:\x1b[0m', err);
  process.exit(1);
});
