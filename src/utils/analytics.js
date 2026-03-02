// ═══════════════════════════════════════════════════════════════════
// charEdge — Analytics Service
//
// Lightweight analytics abstraction. Supports PostHog out of the box.
// Set VITE_POSTHOG_KEY in .env to enable. SDK is dynamically imported
// — zero bundle cost when key is absent.
//
// Usage:
//   import { trackEvent, trackPageView } from '../utils/analytics.js';
//   trackEvent('trade_logged', { symbol: 'BTCUSDT', pnl: 120 });
//   trackPageView('/journal');
// ═══════════════════════════════════════════════════════════════════

let _posthog = null;
let _initAttempted = false;

/**
 * Initialize analytics provider. Called automatically on first use.
 * Gated on GDPR consent — only initializes when user has opted in.
 * @private
 */
async function _ensureInit() {
  if (_initAttempted) return;

  // GDPR: check consent before initializing analytics
  try {
    const { useConsentStore } = await import('../state/useConsentStore.js');
    const consent = useConsentStore.getState().analytics;
    if (consent !== true) return; // Not opted in — skip analytics entirely
  } catch {
    return; // Consent store not available — skip analytics
  }

  _initAttempted = true;

  const key = typeof import.meta !== 'undefined' && import.meta.env?.VITE_POSTHOG_KEY;
  if (!key) return;

  try {
    const { default: posthog } = await import('posthog-js');
    posthog.init(key, {
      api_host: import.meta.env?.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
      autocapture: false,        // We'll send explicit events only
      capture_pageview: false,   // We handle page views ourselves
      persistence: 'localStorage',
      loaded: (ph) => {
        // Respect Do Not Track
        if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl) {
          ph.opt_out_capturing();
        }
      },
    });
    _posthog = posthog;
    console.info('[Analytics] PostHog initialized');
  } catch {
    // posthog-js not installed — that's fine
    console.debug('[Analytics] PostHog SDK not available (install posthog-js to enable)');
  }
}

/**
 * Track a named event with optional properties.
 * No-ops if analytics is not configured.
 *
 * @param {string} eventName - e.g. 'trade_logged', 'chart_opened'
 * @param {Object} [properties] - Event metadata
 */
export function trackEvent(eventName, properties = {}) {
  _ensureInit();
  if (_posthog) {
    _posthog.capture(eventName, properties);
  }
}

/**
 * Track a page view.
 * No-ops if analytics is not configured.
 *
 * @param {string} [path] - Page path, defaults to current location
 */
export function trackPageView(path) {
  _ensureInit();
  if (_posthog) {
    _posthog.capture('$pageview', {
      $current_url: path || (typeof window !== 'undefined' ? window.location.pathname : '/'),
    });
  }
}

/**
 * Identify a user (associates events with a user ID).
 * No-ops if analytics is not configured.
 *
 * @param {string} userId
 * @param {Object} [traits] - User properties
 */
export function identifyUser(userId, traits = {}) {
  _ensureInit();
  if (_posthog) {
    _posthog.identify(userId, traits);
  }
}

/**
 * Reset analytics identity (on logout).
 */
export function resetAnalytics() {
  if (_posthog) {
    _posthog.reset();
  }
}

export default { trackEvent, trackPageView, identifyUser, resetAnalytics };
