// ═══════════════════════════════════════════════════════════════════
// charEdge — ServiceWorker (Data Cache)
//
// Lightweight SW that caches REST API responses with stale-while-revalidate.
// Only caches data API routes — no app shell caching.
//
// Cached routes:
//   /api/binance/v3/klines   — 5 min TTL
//   /api/binance/v3/ticker   — 30 sec TTL
// ═══════════════════════════════════════════════════════════════════

const CACHE_NAME = 'charedge-data-v1';

// Route-specific TTLs (milliseconds)
const CACHE_RULES = [
  { pattern: /\/api\/binance\/v3\/klines/,    ttl: 300_000 },  // 5 min
  { pattern: /\/api\/binance\/v3\/ticker/,     ttl: 30_000 },   // 30 sec
  { pattern: /\/api\/binance\/v3\/exchangeInfo/, ttl: 3600_000 }, // 1 hour
];

// ─── Install ────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// ─── Activate ───────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('charedge-data-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ─── Fetch Handler ──────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Only intercept matching API routes
  const rule = CACHE_RULES.find((r) => r.pattern.test(url));
  if (!rule) return; // Let browser handle normally

  event.respondWith(staleWhileRevalidate(event.request, rule.ttl));
});

/**
 * Stale-while-revalidate strategy:
 * 1. Check cache — if fresh, return immediately
 * 2. If stale — return stale + revalidate in background
 * 3. If miss — fetch from network, cache the response
 */
async function staleWhileRevalidate(request, ttl) {
  const cache = await caches.open(CACHE_NAME);

  // Check cache
  const cached = await cache.match(request);
  if (cached) {
    const cachedTime = cached.headers.get('x-tf-cached-at');
    const age = cachedTime ? Date.now() - parseInt(cachedTime, 10) : Infinity;

    if (age < ttl) {
      // Fresh — return immediately
      return cached;
    }

    // Stale — return stale, refresh in background
    refreshCache(request, cache).catch(() => {});
    return cached;
  }

  // Cache miss — fetch from network
  try {
    return await fetchAndCache(request, cache);
  } catch (err) {
    // Network error — return whatever we have (even if stale)
    const anyCached = await cache.match(request);
    if (anyCached) return anyCached;
    throw err;
  }
}

/**
 * Fetch from network and store in cache with timestamp header.
 */
async function fetchAndCache(request, cache) {
  const response = await fetch(request);

  if (response.ok) {
    // Clone response and add timestamp header
    const body = await response.arrayBuffer();
    const headers = new Headers(response.headers);
    headers.set('x-tf-cached-at', String(Date.now()));

    const cachedResponse = new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });

    // Store in cache (don't await — non-blocking)
    cache.put(request, cachedResponse.clone()).catch(() => {});
    return cachedResponse;
  }

  return response;
}

/**
 * Background refresh: fetch fresh and update cache.
 */
async function refreshCache(request, cache) {
  try {
    await fetchAndCache(request, cache);
  } catch {
    // Network error during background refresh — keep stale data
  }
}
