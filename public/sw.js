// ═══════════════════════════════════════════════════════════════════
// charEdge — Tiered Service Worker
//
// Replaces the self-destruct stub with a proper caching strategy:
//   - Network-first for API routes (/api/*)
//   - Stale-while-revalidate for static assets (JS/CSS/images)
//   - Cache-first for WGSL shaders (never change once deployed)
//   - Push notification handler for Web Push payback
//
// Tasks: 3.2.16 (tiered SW caching), 3.3.2 (push delivery)
// ═══════════════════════════════════════════════════════════════════

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `charEdge-static-${CACHE_VERSION}`;
const API_CACHE = `charEdge-api-${CACHE_VERSION}`;
const SHADER_CACHE = `charEdge-shaders-${CACHE_VERSION}`;

// Critical resources to precache on install
const PRECACHE_URLS = [
  '/',
  '/favicon.svg',
];

// ─── Install ────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ───────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== API_CACHE && key !== SHADER_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ─── Fetch Strategy Router ──────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip WebSocket requests
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return;

  // Skip Chrome extensions
  if (url.protocol === 'chrome-extension:') return;

  // API routes: Network-first with fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(event.request, API_CACHE));
    return;
  }

  // WGSL shaders: Cache-first (immutable once deployed)
  if (url.pathname.endsWith('.wgsl')) {
    event.respondWith(cacheFirst(event.request, SHADER_CACHE));
    return;
  }

  // Static assets with content hashes: Cache-first
  if (isHashedAsset(url.pathname)) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  // Everything else: Stale-while-revalidate
  event.respondWith(staleWhileRevalidate(event.request, STATIC_CACHE));
});

// ─── Caching Strategies ─────────────────────────────────────────

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    return new Response('', { status: 504, statusText: 'Gateway Timeout' });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Revalidate in background
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  // Return cached immediately if available, otherwise wait for fetch
  return cached || fetchPromise || new Response('', { status: 504 });
}

// ─── Helpers ────────────────────────────────────────────────────

function isHashedAsset(pathname) {
  // Vite content-hashed files: filename-HASH.ext
  return /\.[a-f0-9]{8,}\.(js|css|woff2?|png|jpg|svg|webp)$/i.test(pathname);
}

// ─── Push Notification Handler ──────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (_) {
    payload = { title: 'charEdge', body: event.data.text() };
  }

  const { title, body, icon, tag, data } = payload;

  event.waitUntil(
    self.registration.showNotification(title || 'charEdge Alert', {
      body: body || '',
      icon: icon || '/favicon.svg',
      tag: tag || 'charEdge-notification',
      badge: '/favicon.svg',
      vibrate: [200, 100, 200],
      data: data || {},
      actions: [
        { action: 'view', title: 'View Chart' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  );
});

// ─── Notification Click Handler ─────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  if (event.action === 'dismiss') return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Focus existing tab if open
        for (const client of clients) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        // Open new tab
        return self.clients.openWindow(url);
      })
  );
});
