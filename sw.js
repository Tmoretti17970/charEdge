// ═══════════════════════════════════════════════════════════════════
// charEdge — Service Worker (Sprint 5.7)
//
// Provides offline support and intelligent caching:
//   - Cache-first for static assets (JS, CSS, fonts, images)
//   - Network-first for API calls (Yahoo proxy, server API)
//   - Offline fallback page
//
// Versioned cache — bumping VERSION clears stale caches on update.
// ═══════════════════════════════════════════════════════════════════

const VERSION = 'tf-v11.1';
const STATIC_CACHE = `${VERSION}-static`;
const DYNAMIC_CACHE = `${VERSION}-dynamic`;

// Assets to precache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ─── Install ────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate — clean old caches ────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          // Only delete charEdge caches — other apps on same origin may have their own
          .filter(key => (key.startsWith('charEdge-') || key.startsWith('ce-')) && key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch Strategy ─────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Chrome extensions, dev tools, etc.
  if (!url.protocol.startsWith('http')) return;

  // API calls → network-first with cache fallback
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/yahoo/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // External resources (fonts, CDN) → cache-first
  if (url.origin !== location.origin) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Static assets → cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Navigation (HTML pages) → network-first
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Default → network-first
  event.respondWith(networkFirstStrategy(request));
});

// ─── Strategies ─────────────────────────────────────────────────

async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline — return generic offline response for non-critical assets
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

const MAX_DYNAMIC_CACHE_ENTRIES = 100;

// Volatile intervals that shouldn't be cached in the service worker
const _VOLATILE_INTERVALS = new Set(['1m', '3m', '5m', '15m', '30m']);

// Sensitive URL path segments that should NEVER be cached.
// Trading activity cached in the SW creates a fingerprint of user behavior.
const _SENSITIVE_PATTERNS = [
  'klines', 'trades', 'ticker', 'account', 'order', 'position',
  'balance', 'portfolio', '/api/sync',
];

/**
 * Check if a kline request URL uses a volatile (short) interval.
 * @param {URL} url
 * @returns {boolean}
 */
function _isVolatileKlineRequest(url) {
  if (!url.pathname.includes('/klines')) return false;
  const interval = url.searchParams.get('interval');
  return _VOLATILE_INTERVALS.has(interval);
}

/**
 * Check if a request URL matches sensitive trading endpoints.
 * These should never be stored in the SW cache.
 * @param {URL} url
 * @returns {boolean}
 */
function _isSensitiveRequest(url) {
  const href = url.href.toLowerCase();
  // Known sensitive API hosts
  if (href.includes('api.binance.com')) return true;
  if (href.includes('api.polygon.io')) return true;
  if (href.includes('stream.binance.com')) return true;
  // Sensitive path patterns
  return _SENSITIVE_PATTERNS.some(p => href.includes(p));
}

async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const url = new URL(request.url);

      // Skip caching volatile short-interval kline data
      if (_isVolatileKlineRequest(url)) {
        return response;
      }

      // Skip caching sensitive trading API responses (Tier 3.7)
      if (_isSensitiveRequest(url)) {
        return response;
      }

      const cache = await caches.open(DYNAMIC_CACHE);
      // Cap dynamic cache size to prevent unbounded growth
      const keys = await cache.keys();
      if (keys.length >= MAX_DYNAMIC_CACHE_ENTRIES) {
        // Evict oldest entries to make room
        const toEvict = keys.length - MAX_DYNAMIC_CACHE_ENTRIES + 1;
        for (let i = 0; i < toEvict; i++) {
          await cache.delete(keys[i]);
        }
      }
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Network failed — try cache
    const cached = await caches.match(request);
    if (cached) return cached;

    // For navigation requests, return cached index.html (SPA)
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
    }

    return new Response(
      JSON.stringify({ error: 'offline', message: 'No network connection' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function isStaticAsset(pathname) {
  return /\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|ico|webp|avif)(\?.*)?$/.test(pathname);
}

// ─── Background Sync ────────────────────────────────────────────
// Queues offline mutations and replays them when connectivity returns.
// Supports: watchlist changes, indicator configs, trade journal entries.

const SYNC_DB_NAME = 'charEdge-sync-queue';
const SYNC_DB_VERSION = 1;
const SYNC_STORE = 'mutations';

/**
 * Open (or create) the sync queue IndexedDB.
 * @returns {Promise<IDBDatabase>}
 */
function openSyncDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SYNC_DB_NAME, SYNC_DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(SYNC_STORE)) {
        db.createObjectStore(SYNC_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Drain all queued mutations and replay them as fetch requests.
 * Each mutation has: { url, method, body, headers, timestamp }.
 */
async function replayMutations() {
  try {
    const db = await openSyncDB();
    const tx = db.transaction(SYNC_STORE, 'readwrite');
    const store = tx.objectStore(SYNC_STORE);
    const all = await new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    if (all.length === 0) {
      db.close();
      return;
    }

    console.log(`[SW] Background Sync: replaying ${all.length} queued mutations`);

    const replayedIds = [];
    for (const mutation of all) {
      try {
        await fetch(mutation.url, {
          method: mutation.method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Idempotency key: backend should reject duplicate replay IDs
            'X-Idempotency-Key': mutation.id + '-' + (mutation.timestamp || 0),
            ...(mutation.headers || {}),
          },
          body: mutation.body ? JSON.stringify(mutation.body) : undefined,
        });
        replayedIds.push(mutation.id);
      } catch {
        // If replay fails, keep the mutation for next sync
        console.warn(`[SW] Failed to replay mutation ${mutation.id}, will retry`);
      }
    }

    // Batch-delete all successfully replayed mutations in one transaction
    if (replayedIds.length > 0) {
      const delTx = db.transaction(SYNC_STORE, 'readwrite');
      const delStore = delTx.objectStore(SYNC_STORE);
      for (const id of replayedIds) {
        delStore.delete(id);
      }
      await new Promise(r => { delTx.oncomplete = r; delTx.onerror = r; });
    }

    db.close();
  } catch (err) {
    console.warn('[SW] Background Sync replay failed:', err);
  }
}

// Listen for sync events
self.addEventListener('sync', (event) => {
  if (event.tag === 'charEdge-sync') {
    event.waitUntil(replayMutations());
  }
});

// Also replay on service worker activation (in case sync API isn't available)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'replay-sync-queue') {
    event.waitUntil(replayMutations());
  }
});

// ─── Push Notifications (Batch 16: 3.5.4) ───────────────────────
// Receives push messages from the server and displays notifications.
// Works even when all charEdge tabs are closed.

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    // Plain text fallback
    payload = {
      title: 'charEdge Alert',
      body: event.data.text(),
    };
  }

  const title = payload.title || 'charEdge';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: payload.tag || payload.data?.alertId || 'charedge-alert',
    data: payload.data || { url: '/' },
    requireInteraction: true,
    vibrate: [200, 100, 200],
    actions: [
      { action: 'view', title: 'View Chart' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification click — focus or open window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Focus existing window if available
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.postMessage({
              type: 'notification-click',
              url,
              alertId: event.notification.data?.alertId,
            });
            return;
          }
        }
        // No existing window — open new one
        return self.clients.openWindow(url);
      })
  );
});
