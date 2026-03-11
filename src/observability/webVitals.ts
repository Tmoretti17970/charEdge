import { logger } from './logger.ts';
// ═══════════════════════════════════════════════════════════════════
// charEdge — Core Web Vitals Reporter
//
// Tracks all Core Web Vitals using the official `web-vitals` library:
//   FCP, LCP, CLS, INP, TTFB
//
// Reports to:
//   1. Dev console (in development)
//   2. Vercel Analytics (via window.__analytics)
//   3. Sentry (via @sentry/browser metrics, if loaded)
//
// Zero-config — just call reportWebVitals() on app mount.
// ═══════════════════════════════════════════════════════════════════

const isDev = import.meta.env?.DEV;

/**
 * Report a web vital metric to all configured sinks.
 * @param {{ name: string, value: number, rating: string, id: string }} metric
 */
function report(metric) {
  const { name, value, rating, id } = metric;
  const rounded = Math.round(name === 'CLS' ? value * 1000 : value);

  if (isDev) {
    // Color-code by rating: green=good, yellow=needs-improvement, red=poor
    const colors = { good: '#0cce6b', 'needs-improvement': '#ffa400', poor: '#ff4e42' };
    const color = colors[rating] || '#888';
    logger.boot.info(
      `%c[CWV]%c ${name}: ${rounded}${name === 'CLS' ? '' : 'ms'} (${rating})`,
      `color: ${color}; font-weight: 700`,
      'color: inherit',
    );
  }

  // Wire to analytics (PostHog / Vercel) if available
  if (typeof window !== 'undefined' && window.__analytics?.track) {
    window.__analytics.track('web_vital', { name, value: rounded, rating, id });
  }

  // Forward to Sentry as custom measurements
  try {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    import('@sentry/browser').then((Sentry) => {
      if (Sentry.setMeasurement) {
        Sentry.setMeasurement(name, value, name === 'CLS' ? '' : 'millisecond');
      }
    }).catch(() => {});
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_) {
    // Sentry not available — fine
  }
}

/**
 * Start observing all Core Web Vitals.
 * Uses the official `web-vitals` library for accurate, spec-compliant measurement.
 */
export function reportWebVitals() {
  if (typeof window === 'undefined') return;

  import('web-vitals').then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
    onCLS(report);
    onFCP(report);
    onINP(report);
    onLCP(report);
    onTTFB(report);
  }).catch(() => {
    // web-vitals library not available — fall back to basic PerformanceObserver
    _fallbackObservers();
  });
}

/**
 * Fallback: use raw PerformanceObserver for FCP + LCP + CLS
 * if the web-vitals library fails to load.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
function _fallbackObservers() {
  try {
    const observe = (type, cb) => {
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) cb(entry);
      });
      po.observe({ type, buffered: true });
    };

    observe('paint', (entry) => {
      if (entry.name === 'first-contentful-paint') {
        report({ name: 'FCP', value: entry.startTime, rating: 'good', id: 'fallback' });
      }
    });

    observe('largest-contentful-paint', (entry) => {
      report({ name: 'LCP', value: entry.startTime, rating: 'good', id: 'fallback' });
    });

    let clsValue = 0;
    observe('layout-shift', (entry) => {
      if (!entry.hadRecentInput) clsValue += entry.value;
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        report({ name: 'CLS', value: clsValue, rating: 'good', id: 'fallback' });
      }
    });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_) {
    // PerformanceObserver not supported
  }
}
