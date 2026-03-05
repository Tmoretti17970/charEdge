// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — PostHog Analytics
//
// Lazy-loaded product analytics. Only initializes when
// VITE_POSTHOG_KEY is set. No-ops gracefully in dev/test.
//
// Usage:
//   import { posthog, trackEvent } from './posthog.js';
//   trackEvent('chart_opened', { symbol: 'BTCUSDT', timeframe: '1h' });
// ═══════════════════════════════════════════════════════════════════

/** @type {import('posthog-js').PostHog | null} */
let _posthog = null;
let _initAttempted = false;

/**
 * Lazily initialize PostHog. No-ops if key is missing.
 * @returns {Promise<import('posthog-js').PostHog | null>}
 */
async function _init() {
  if (_initAttempted) return _posthog;
  _initAttempted = true;

  const apiKey = import.meta.env?.VITE_POSTHOG_KEY;
  if (!apiKey) {
    console.info('[PostHog] No VITE_POSTHOG_KEY set — analytics disabled');
    return null;
  }

  try {
    const { default: posthogLib } = await import('posthog-js');
    posthogLib.init(apiKey, {
      api_host: import.meta.env?.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
      loaded: (ph) => {
        // Disable in dev unless explicitly enabled
        if (import.meta.env?.DEV && !import.meta.env?.VITE_POSTHOG_DEV) {
          ph.opt_out_capturing();
        }
      },
      capture_pageview: true,
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
      autocapture: false,  // We track manually for precision
    });
    _posthog = posthogLib;
    console.info('[PostHog] Initialized');
    return _posthog;
  } catch (err) {
    console.warn('[PostHog] Failed to initialize:', err);
    return null;
  }
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Track a custom event.
 * @param {string} event - Event name (e.g. 'chart_opened', 'trade_logged')
 * @param {Record<string, any>} [properties] - Event properties
 */
export async function trackEvent(event, properties = {}) {
  const ph = await _init();
  ph?.capture(event, properties);
}

/**
 * Identify a user (call after login/signup).
 * @param {string} userId - Unique user identifier
 * @param {Record<string, any>} [traits] - User properties
 */
export async function identifyUser(userId, traits = {}) {
  const ph = await _init();
  ph?.identify(userId, traits);
}

/**
 * Track a page view manually.
 * @param {string} [pageName] - Page name override
 */
export async function trackPageView(pageName) {
  const ph = await _init();
  ph?.capture('$pageview', pageName ? { page: pageName } : undefined);
}

/**
 * Reset analytics (call on logout).
 */
export async function resetAnalytics() {
  const ph = await _init();
  ph?.reset();
}

/**
 * Get the PostHog instance (for advanced usage).
 * @returns {Promise<import('posthog-js').PostHog | null>}
 */
export async function getPostHog() {
  return _init();
}

export default { trackEvent, identifyUser, trackPageView, resetAnalytics, getPostHog };
