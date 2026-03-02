// ═══════════════════════════════════════════════════════════════════
// charEdge — Core Web Vitals Reporter
//
// Lightweight CWV measurement using native PerformanceObserver API.
// Logs metrics in dev, wires to analytics stub in prod.
// Zero dependencies — no external library required.
// ═══════════════════════════════════════════════════════════════════

const isDev = import.meta.env?.DEV;

/**
 * Observe a performance entry type and invoke callback for each entry.
 * @param {string} type - PerformanceObserver entry type
 * @param {function} callback - receives the entry
 */
function observe(type, callback) {
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        callback(entry);
      }
    });
    observer.observe({ type, buffered: true });
  } catch {
    // PerformanceObserver not supported — silently ignore
  }
}

/**
 * Report a web vital metric.
 * In dev mode, logs to console. In prod, fires analytics event if available.
 */
function report(name, value) {
  const rounded = Math.round(value);
  if (isDev) {
    // eslint-disable-next-line no-console
    console.log(`[CWV] ${name}: ${rounded}ms`);
  }
  // Wire to analytics (PostHog stub) if available
  if (typeof window !== 'undefined' && window.__analytics?.track) {
    window.__analytics.track('web_vital', { name, value: rounded });
  }
}

/**
 * Start observing Core Web Vitals:
 *   - FCP (First Contentful Paint)
 *   - LCP (Largest Contentful Paint)
 *   - CLS (Cumulative Layout Shift)
 */
export function reportWebVitals() {
  if (typeof window === 'undefined' || !window.PerformanceObserver) return;

  // FCP — First Contentful Paint
  observe('paint', (entry) => {
    if (entry.name === 'first-contentful-paint') {
      report('FCP', entry.startTime);
    }
  });

  // LCP — Largest Contentful Paint
  observe('largest-contentful-paint', (entry) => {
    report('LCP', entry.startTime);
  });

  // CLS — Cumulative Layout Shift
  let clsValue = 0;
  observe('layout-shift', (entry) => {
    if (!entry.hadRecentInput) {
      clsValue += entry.value;
    }
  });

  // Report CLS on page hide (final value)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        report('CLS', clsValue * 1000); // Report as integer ms-scale
      }
    });
  }
}
