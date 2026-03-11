// ═══════════════════════════════════════════════════════════════════
// charEdge — Vercel Edge Middleware (P3 C2)
//
// Runs at the edge for every request. Checks if the path is a known
// SPA route, static asset, or API route. Unknown paths get a proper
// 404 with X-Robots-Tag: noindex, preventing search engines from
// indexing junk URLs as duplicate content.
//
// Known route patterns mirror src/seo/routes.js PUBLIC_ROUTES.
//
// Vercel Edge Middleware docs:
//   https://vercel.com/docs/functions/edge-middleware
// ═══════════════════════════════════════════════════════════════════

// ── Known SPA route patterns ─────────────────────────────────────
// These mirror PUBLIC_ROUTES in src/seo/routes.js.
// Static assets (/assets/*, favicons, sw.js, etc.) are excluded from
// middleware via the matcher in vercel.json.

const KNOWN_PATTERNS: RegExp[] = [
    /^\/$/,                          // Landing page
    /^\/pricing\/?$/,                // Pricing
    /^\/terms\/?$/,                  // Terms of Service
    /^\/privacy\/?$/,                // Privacy Policy
    /^\/changelog\/?$/,              // Changelog
    /^\/leaderboard\/?$/,            // Leaderboard
    /^\/s\/[A-Za-z0-9._-]+\/?$/,    // Symbol page: /s/BTCUSDT
    /^\/snap\/[A-Za-z0-9_-]+\/?$/,  // Trade snapshot: /snap/:id
    /^\/u\/[A-Za-z0-9_-]+\/?$/,     // User profile: /u/:username

    // ── App routes (authenticated SPA) ──
    /^\/dashboard\/?$/,
    /^\/journal\/?$/,
    /^\/chart\/?$/,
    /^\/settings\/?$/,
    /^\/notes\/?$/,
    /^\/screener\/?$/,
    /^\/briefing\/?$/,
    /^\/analytics\/?$/,
    /^\/coach\/?$/,
    /^\/voice\/?$/,

    // ── API and internal routes ──
    /^\/api\//,                      // All API routes
    /^\/_internal\//,                // Internal endpoints

    // ── Vercel system routes ──
    /^\/__vercel\//,                 // Vercel internals
];

// ── Static asset patterns (bypass middleware) ────────────────────

const STATIC_ASSET = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map|webp|webm|json|xml|txt)$/i;

// ── 404 HTML ─────────────────────────────────────────────────────

const NOT_FOUND_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="robots" content="noindex, nofollow">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 — Page Not Found | charEdge</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: #0a0a0f;
      color: #e0e0e8;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .container {
      text-align: center;
      max-width: 480px;
      padding: 2rem;
    }
    .code {
      font-size: 6rem;
      font-weight: 800;
      background: linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
      color: #f0f0f5;
    }
    p {
      color: #9ca3af;
      margin-bottom: 2rem;
      line-height: 1.6;
    }
    a {
      display: inline-block;
      padding: 0.75rem 2rem;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #fff;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      transition: opacity 0.2s;
    }
    a:hover { opacity: 0.85; }
  </style>
</head>
<body>
  <div class="container">
    <div class="code">404</div>
    <h1>Page Not Found</h1>
    <p>The page you're looking for doesn't exist or has been moved.</p>
    <a href="/">Back to charEdge</a>
  </div>
</body>
</html>`;

// ── Middleware handler ───────────────────────────────────────────
// Vercel Edge Middleware uses standard Web API Request/Response.

export default function middleware(request: Request): Response | undefined {
    const url = new URL(request.url);
    const { pathname } = url;

    // Let static assets through (fallback — most are excluded by matcher)
    if (STATIC_ASSET.test(pathname)) {
        return undefined; // Continue to origin
    }

    // Check if this path matches any known route pattern
    const isKnown = KNOWN_PATTERNS.some((pattern) => pattern.test(pathname));

    if (isKnown) {
        return undefined; // Continue to origin (SPA index.html or API)
    }

    // Unknown route → proper 404
    return new Response(NOT_FOUND_HTML, {
        status: 404,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'X-Robots-Tag': 'noindex, nofollow',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
    });
}

// ── Vercel config ────────────────────────────────────────────────
// Export config for the middleware matcher.
// Exclude static assets from middleware processing entirely.

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|assets/|favicon\\.ico|icon-.*\\.png|apple-touch-icon\\.png|manifest\\.json|sw\\.js|robots\\.txt|sitemap\\.xml).*)',
    ],
};
