// ═══════════════════════════════════════════════════════════════════
// charEdge — Telemetry Utility
// Lightweight, privacy-first event tracking for simplification metrics.
//
// All data stays LOCAL (IndexedDB via Zustand persist). No external
// analytics services. This is for internal product development only.
//
// Usage:
//   import { track, trackPageView, trackFeatureUse } from './telemetry.js';
//
//   track('button_click', { target: 'add_trade', page: 'home' });
//   trackPageView('charts');
//   trackFeatureUse('replay_mode');
// ═══════════════════════════════════════════════════════════════════

// ─── Session Management ────────────────────────────────────────────

let _sessionId = null;
let _sessionStart = null;
let _lastActivity = null;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 min inactivity = new session

function getSessionId() {
  const now = Date.now();
  if (!_sessionId || !_lastActivity || (now - _lastActivity) > SESSION_TIMEOUT_MS) {
    _sessionId = `s_${now}_${Math.random().toString(36).slice(2, 8)}`;
    _sessionStart = now;
  }
  _lastActivity = now;
  return _sessionId;
}

function getSessionDuration() {
  if (!_sessionStart) return 0;
  return Date.now() - _sessionStart;
}

// ─── Event Buffer ──────────────────────────────────────────────────
// Events are buffered and flushed to the store periodically to avoid
// re-renders on every micro-interaction.

const EVENT_BUFFER = [];
const FLUSH_INTERVAL_MS = 5000; // flush every 5s
const MAX_BUFFER_SIZE = 50;
let _flushTimer = null;
let _storeRef = null; // set by init()

function startFlushTimer() {
  if (_flushTimer) return;
  _flushTimer = setInterval(() => {
    flushEvents();
  }, FLUSH_INTERVAL_MS);
}

function flushEvents() {
  if (EVENT_BUFFER.length === 0 || !_storeRef) return;
  const batch = EVENT_BUFFER.splice(0, EVENT_BUFFER.length);
  try {
    _storeRef.getState().ingestEvents(batch);
  } catch (err) {
    console.warn('[Telemetry] Flush failed:', err.message);
  }
}

// ─── Core Track Function ───────────────────────────────────────────

/**
 * Track an event with optional properties.
 * Events are buffered and periodically flushed to the metrics store.
 *
 * @param {string} event - Event name (e.g. 'page_view', 'feature_use', 'button_click')
 * @param {Object} [props={}] - Additional properties
 */
export function track(event, props = {}) {
  const entry = {
    event,
    ts: Date.now(),
    session: getSessionId(),
    ...props,
  };

  EVENT_BUFFER.push(entry);

  // Auto-flush if buffer is full
  if (EVENT_BUFFER.length >= MAX_BUFFER_SIZE) {
    flushEvents();
  }

  // Dev logging (only in development)
  if (import.meta.env?.DEV) {
    console.debug(`[📊 Track] ${event}`, props);
  }
}

// ─── Convenience Helpers ───────────────────────────────────────────

/**
 * Track a page view.
 * @param {string} page - Page name (e.g. 'charts', 'journal', 'social')
 */
export function trackPageView(page) {
  track('page_view', { page });
}

/**
 * Track feature usage — when a user activates/opens a feature.
 * @param {string} feature - Feature identifier (e.g. 'replay_mode', 'strategy_builder')
 * @param {Object} [meta={}] - Extra metadata
 */
export function trackFeatureUse(feature, meta = {}) {
  track('feature_use', { feature, ...meta });
}

/**
 * Track first meaningful action in a session (time-to-first-action).
 * Only fires once per session.
 */
let _firstActionTracked = false;
export function trackFirstAction(action) {
  if (_firstActionTracked) return;
  _firstActionTracked = true;
  const elapsed = getSessionDuration();
  track('first_action', { action, elapsed_ms: elapsed });
}

/**
 * Track a click on a specific UI element.
 * @param {string} target - Element identifier
 * @param {string} [page] - Current page context
 */
export function trackClick(target, page) {
  track('click', { target, page });
}

/**
 * Track when a user completes a meaningful workflow.
 * @param {string} workflow - Workflow name (e.g. 'trade_logged', 'csv_imported')
 */
export function trackWorkflow(workflow) {
  track('workflow_complete', { workflow });
}

// ─── Session Lifecycle ─────────────────────────────────────────────

/**
 * Track session end. Call this on beforeunload or visibility change.
 */
export function trackSessionEnd() {
  const duration = getSessionDuration();
  if (duration > 1000) { // ignore sub-second sessions
    track('session_end', { duration_ms: duration });
    flushEvents(); // immediate flush on session end
  }
}

/**
 * Initialize the telemetry system.
 * Must be called once with a reference to the metrics store.
 * @param {Object} store - Zustand store reference (useTelemetryStore)
 */
export function initTelemetry(store) {
  _storeRef = store;
  _firstActionTracked = false;
  getSessionId(); // start the session

  startFlushTimer();

  // Track session end on page unload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', trackSessionEnd);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        trackSessionEnd();
      }
    });
  }

  track('session_start', {
    viewport: typeof window !== 'undefined'
      ? `${window.innerWidth}x${window.innerHeight}`
      : 'unknown',
    userAgent: typeof navigator !== 'undefined'
      ? navigator.userAgent.slice(0, 80)
      : 'unknown',
  });
}

/**
 * Cleanup, for use in tests or HMR.
 */
export function destroyTelemetry() {
  if (_flushTimer) {
    clearInterval(_flushTimer);
    _flushTimer = null;
  }
  flushEvents();
  _storeRef = null;
  _sessionId = null;
  _sessionStart = null;
  _lastActivity = null;
  _firstActionTracked = false;
}

export { getSessionDuration, getSessionId };
