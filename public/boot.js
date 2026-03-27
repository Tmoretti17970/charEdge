/* global window, document, navigator, location, setTimeout, clearTimeout, MutationObserver */
// ═══════════════════════════════════════════════════════════════════
// charEdge — Boot Scripts (extracted from index.html for CSP compliance)
//
// These scripts were previously inline <script> blocks, which break
// Content-Security-Policy headers that disallow 'unsafe-inline'.
// ═══════════════════════════════════════════════════════════════════

// ─── Polyfill: requestIdleCallback (not available on some Safari/iOS versions) ───
if (typeof window.requestIdleCallback !== 'function') {
  window.requestIdleCallback = function (cb) {
    var start = Date.now();
    return setTimeout(function () {
      cb({
        didTimeout: false,
        timeRemaining: function () {
          return Math.max(0, 50 - (Date.now() - start));
        },
      });
    }, 1);
  };
  window.cancelIdleCallback = function (id) {
    clearTimeout(id);
  };
}

// ─── Boot diagnostic — MutationObserver + timeout fallback ───────
// Uses MutationObserver to detect when React mounts real DOM into #root.
// Only shows the failure screen if React hasn't rendered after 15s AND
// there are real JS errors (not just Vite WebSocket noise).
window.__CE_ERRORS = [];
window.addEventListener('error', function (e) {
  window.__CE_ERRORS.push('ERROR: ' + (e.message || 'Unknown') + ' @ ' + (e.filename || '?') + ':' + (e.lineno || '?'));
});
window.addEventListener('unhandledrejection', function (e) {
  var msg = e.reason ? e.reason.message || String(e.reason) : 'Unknown rejection';
  window.__CE_ERRORS.push('REJECT: ' + msg);
});

(function () {
  var root = document.getElementById('root');
  if (!root) return;

  var bootResolved = false;
  var failTimer = null;

  // Cancel fallback as soon as React renders anything into #root
  function cancelFallback() {
    if (bootResolved) return;
    bootResolved = true;
    if (failTimer) clearTimeout(failTimer);
    if (observer) observer.disconnect();
  }

  // Watch for React adding child elements to #root
  var observer = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].addedNodes.length > 0) {
          // React mounted something — app is loading
          cancelFallback();
          return;
        }
      }
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  // Also check if React already rendered (race condition guard)
  if (root.children.length > 0) {
    cancelFallback();
    return;
  }

  function showFailureScreen() {
    if (bootResolved) return;
    bootResolved = true;
    if (observer) observer.disconnect();

    var errors = window.__CE_ERRORS;
    // Filter out Vite HMR WebSocket errors — they don't prevent the app from loading
    var realErrors = errors.filter(function (e) {
      return e.indexOf('WebSocket') === -1 && e.indexOf('websocket') === -1 && e.indexOf('[vite]') === -1;
    });
    var info = 'Browser: ' + navigator.userAgent + '\nErrors (' + realErrors.length + '):\n' + realErrors.join('\n');

    var container = document.createElement('div');
    container.style.cssText =
      'padding:2rem;color:#ececef;font-family:sans-serif;text-align:center;max-width:500px;margin:auto;margin-top:10vh';

    var h2 = document.createElement('h2');
    h2.style.cssText = 'color:#f59e0b;margin-bottom:1rem;font-size:20px';
    h2.textContent = 'charEdge failed to load';
    container.appendChild(h2);

    var p = document.createElement('p');
    p.style.cssText = 'font-size:13px;color:#aaa;margin-bottom:1.5rem';
    p.textContent = 'This browser may not be supported. Try Chrome or Firefox.';
    container.appendChild(p);

    var pre = document.createElement('pre');
    pre.style.cssText =
      'font-size:10px;color:#ef4444;background:#1a1a2e;padding:12px;border-radius:8px;text-align:left;overflow:auto;max-height:300px;white-space:pre-wrap;word-break:break-all';
    pre.textContent = info;
    container.appendChild(pre);

    var btn = document.createElement('button');
    btn.style.cssText =
      'margin-top:1rem;padding:10px 24px;border:none;border-radius:8px;background:#f59e0b;color:#fff;font-weight:700;cursor:pointer;font-size:14px';
    btn.textContent = 'Reload';
    btn.addEventListener('click', function () {
      location.reload();
    });
    container.appendChild(btn);

    root.innerHTML = '';
    root.appendChild(container);
  }

  // Fallback: if React hasn't mounted anything after 15s, show diagnostics
  failTimer = setTimeout(showFailureScreen, 15000);
})();
