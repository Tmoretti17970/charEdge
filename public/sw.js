// ═══════════════════════════════════════════════════════════════════
// charEdge — Service Worker (Self-Destruct)
//
// This SW exists ONLY to replace and kill any previously cached SW.
// It clears all caches and unregisters itself immediately.
// This fixes blank screens caused by stale cached HTML/JS from
// previous deployments, especially on Safari iOS.
// ═══════════════════════════════════════════════════════════════════

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() => self.registration.unregister())
      .then(() => {
        // Notify all open tabs to reload with fresh content
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => client.navigate(client.url));
        });
      })
  );
});

// Don't intercept ANY fetches — let everything go directly to the network
