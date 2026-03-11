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
            cb({ didTimeout: false, timeRemaining: function () { return Math.max(0, 50 - (Date.now() - start)); } });
        }, 1);
    };
    window.cancelIdleCallback = function (id) { clearTimeout(id); };
}

// ─── Boot diagnostic — catches ALL failure modes including silent module load errors ───
window.__CE_ERRORS = [];
window.addEventListener('error', function (e) {
    window.__CE_ERRORS.push('ERROR: ' + (e.message || 'Unknown') + ' @ ' + (e.filename || '?') + ':' + (e.lineno || '?'));
});
window.addEventListener('unhandledrejection', function (e) {
    var msg = e.reason ? (e.reason.message || String(e.reason)) : 'Unknown rejection';
    window.__CE_ERRORS.push('REJECT: ' + msg);
});

// After 3s, if React hasn't mounted, show diagnostics
setTimeout(function () {
    var root = document.getElementById('root');
    // Check if React actually rendered (it adds real DOM elements, not just comments)
    var hasReactContent = root && root.querySelector && root.querySelector('[data-reactroot], div, section, main, form, button');
    if (!hasReactContent) {
        var errors = window.__CE_ERRORS;
        var info = 'Browser: ' + navigator.userAgent + '\nErrors (' + errors.length + '):\n' + errors.join('\n');
        // Use textContent for the error details to prevent XSS via error messages
        var container = document.createElement('div');
        container.style.cssText = 'padding:2rem;color:#ececef;font-family:sans-serif;text-align:center;max-width:500px;margin:auto;margin-top:10vh';

        var h2 = document.createElement('h2');
        h2.style.cssText = 'color:#f59e0b;margin-bottom:1rem;font-size:20px';
        h2.textContent = 'charEdge failed to load';
        container.appendChild(h2);

        var p = document.createElement('p');
        p.style.cssText = 'font-size:13px;color:#aaa;margin-bottom:1.5rem';
        p.textContent = 'This browser may not be supported. Try Chrome or Firefox.';
        container.appendChild(p);

        var pre = document.createElement('pre');
        pre.style.cssText = 'font-size:10px;color:#ef4444;background:#1a1a2e;padding:12px;border-radius:8px;text-align:left;overflow:auto;max-height:300px;white-space:pre-wrap;word-break:break-all';
        pre.textContent = info; // textContent is XSS-safe
        container.appendChild(pre);

        var btn = document.createElement('button');
        btn.style.cssText = 'margin-top:1rem;padding:10px 24px;border:none;border-radius:8px;background:#f59e0b;color:#fff;font-weight:700;cursor:pointer;font-size:14px';
        btn.textContent = 'Reload';
        btn.addEventListener('click', function () { location.reload(); });
        container.appendChild(btn);

        root.innerHTML = '';
        root.appendChild(container);
    }
}, 3000);
