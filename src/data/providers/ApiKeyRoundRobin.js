// ═══════════════════════════════════════════════════════════════════
// charEdge — API Key Round-Robin (Task C2.1 + C2.3)
//
// Multi-key rotation with race failover and per-key cooldown tracking.
//
// Usage:
//   roundRobin.addProvider('polygon', ['key1', 'key2', 'key3']);
//   const result = await roundRobin.race('polygon', (key) => fetch(`/api?key=${key}`));
//
// Features:
//   • Round-robin key rotation per provider
//   • 100ms race failover (fire next key if no response)
//   • Per-key cooldown from Retry-After headers
//   • Exponential backoff on consecutive failures (max 60s)
//   • Auto-expire cooldowns
//
// ═══════════════════════════════════════════════════════════════════

import { logger } from '@/observability/logger.js';

// ─── Constants ─────────────────────────────────────────────────

const DEFAULT_RACE_TIMEOUT_MS = 100;  // Fire next key if no response in 100ms
const MAX_BACKOFF_MS = 60_000;        // Max exponential backoff: 60s
const BASE_BACKOFF_MS = 1_000;        // Starting backoff: 1s

// ─── Provider State ────────────────────────────────────────────

/**
 * @typedef {Object} KeyState
 * @property {string} key - The API key
 * @property {number} cooldownUntil - Timestamp when cooldown expires (0 = no cooldown)
 * @property {number} consecutiveFailures - Count of sequential failures
 */

/**
 * @typedef {Object} ProviderState
 * @property {KeyState[]} keys - Array of key states
 * @property {number} currentIndex - Current position in the rotation
 */

// ─── ApiKeyRoundRobin ──────────────────────────────────────────

class _ApiKeyRoundRobin {
  constructor() {
    /** @type {Map<string, ProviderState>} providerId → state */
    this._providers = new Map();
  }

  // ── Registration ───────────────────────────────────────────

  /**
   * Register a provider with one or more API keys.
   * @param {string} providerId - Provider identifier (e.g. 'polygon')
   * @param {string[]} keys - Array of API keys for this provider
   */
  addProvider(providerId, keys) {
    if (!keys?.length) {
      logger.data.warn(`[ApiKeyRoundRobin] No keys provided for ${providerId}`);
      return;
    }

    this._providers.set(providerId, {
      keys: keys.map(key => ({
        key,
        cooldownUntil: 0,
        consecutiveFailures: 0,
      })),
      currentIndex: 0,
    });

    logger.data.info(`[ApiKeyRoundRobin] Registered ${providerId} with ${keys.length} key(s)`);
  }

  /**
   * Check if a provider is registered.
   * @param {string} providerId
   * @returns {boolean}
   */
  hasProvider(providerId) {
    return this._providers.has(providerId);
  }

  // ── Key Selection ──────────────────────────────────────────

  /**
   * Get the next available (non-cooled-down) key for a provider.
   * Advances the rotation index.
   * @param {string} providerId
   * @returns {{ key: string, index: number }|null}
   */
  getNextKey(providerId) {
    const state = this._providers.get(providerId);
    if (!state) return null;

    const now = Date.now();
    const len = state.keys.length;

    // Try each key starting from currentIndex
    for (let i = 0; i < len; i++) {
      const idx = (state.currentIndex + i) % len;
      const keyState = state.keys[idx];

      // Skip keys in cooldown
      if (keyState.cooldownUntil > now) continue;

      // Advance index past this key for next call
      state.currentIndex = (idx + 1) % len;

      return { key: keyState.key, index: idx };
    }

    // All keys are in cooldown
    return null;
  }

  /**
   * Get number of available (non-cooled-down) keys for a provider.
   * @param {string} providerId
   * @returns {number}
   */
  getAvailableKeyCount(providerId) {
    const state = this._providers.get(providerId);
    if (!state) return 0;

    const now = Date.now();
    return state.keys.filter(k => k.cooldownUntil <= now).length;
  }

  // ── Cooldown Management ────────────────────────────────────

  /**
   * Mark a key as cooled down after a 429 or failure.
   * @param {string} providerId
   * @param {number} keyIndex - Index into the keys array
   * @param {number} [retryAfterMs] - Explicit cooldown from Retry-After header
   */
  markCooldown(providerId, keyIndex, retryAfterMs) {
    const state = this._providers.get(providerId);
    if (!state || !state.keys[keyIndex]) return;

    const keyState = state.keys[keyIndex];
    keyState.consecutiveFailures++;

    // Use Retry-After if provided, otherwise exponential backoff
    const backoffMs = retryAfterMs ||
      Math.min(BASE_BACKOFF_MS * Math.pow(2, keyState.consecutiveFailures - 1), MAX_BACKOFF_MS);

    keyState.cooldownUntil = Date.now() + backoffMs;

    logger.data.info(
      `[ApiKeyRoundRobin] Key ${keyIndex} for ${providerId} cooled down for ${backoffMs}ms ` +
      `(failures: ${keyState.consecutiveFailures})`
    );
  }

  /**
   * Mark a key as successful (reset failure count).
   * @param {string} providerId
   * @param {number} keyIndex
   */
  markSuccess(providerId, keyIndex) {
    const state = this._providers.get(providerId);
    if (!state || !state.keys[keyIndex]) return;
    state.keys[keyIndex].consecutiveFailures = 0;
    state.keys[keyIndex].cooldownUntil = 0;
  }

  /**
   * Parse Retry-After header value to milliseconds.
   * Supports both seconds (integer) and HTTP-date formats.
   * @param {string|number} value
   * @returns {number|null} milliseconds, or null if unparseable
   */
  static parseRetryAfter(value) {
    if (value === undefined || value === null) return null;

    // Numeric seconds
    const num = Number(value);
    if (!isNaN(num) && num > 0) return num * 1000;

    // HTTP-date format
    const dateMs = Date.parse(String(value));
    if (!isNaN(dateMs)) {
      const delta = dateMs - Date.now();
      return delta > 0 ? delta : 1000;
    }

    return null;
  }

  // ── Race Failover ──────────────────────────────────────────

  /**
   * Fire a request with the first available key. If no response within
   * `timeoutMs`, fire with the next key in parallel. Return first success.
   *
   * @param {string} providerId
   * @param {Function} fetchFn - (apiKey: string) => Promise<{ data, response? }>
   * @param {number} [timeoutMs=100] - Timeout before racing next key
   * @returns {Promise<{ data: any, keyIndex: number }|null>}
   */
  async race(providerId, fetchFn, timeoutMs = DEFAULT_RACE_TIMEOUT_MS) {
    const state = this._providers.get(providerId);
    if (!state) return null;

    const availableKeys = [];
    const now = Date.now();

    // Collect available keys in rotation order
    for (let i = 0; i < state.keys.length; i++) {
      const idx = (state.currentIndex + i) % state.keys.length;
      if (state.keys[idx].cooldownUntil <= now) {
        availableKeys.push(idx);
      }
    }

    if (availableKeys.length === 0) {
      logger.data.warn(`[ApiKeyRoundRobin] All keys exhausted for ${providerId}`);
      return null;
    }

    // Advance rotation past all keys we'll try
    state.currentIndex = (availableKeys[availableKeys.length - 1] + 1) % state.keys.length;

    // If only one key, just fire it directly
    if (availableKeys.length === 1) {
      const keyIndex = availableKeys[0];
      const key = state.keys[keyIndex].key;
      try {
        const result = await fetchFn(key);
        this.markSuccess(providerId, keyIndex);
        return { data: result, keyIndex };
      } catch (err) {
        this._handleError(providerId, keyIndex, err);
        return null;
      }
    }

    // Race: fire first key, then stagger subsequent keys after timeout
    return this._staggeredRace(providerId, fetchFn, availableKeys, timeoutMs);
  }

  /**
   * @private
   * Staggered race — fire requests with increasing delays.
   */
  async _staggeredRace(providerId, fetchFn, keyIndices, timeoutMs) {
    const state = this._providers.get(providerId);
    if (!state) return null;

    const controllers = [];
    const promises = [];

    for (let i = 0; i < keyIndices.length; i++) {
      const keyIndex = keyIndices[i];
      const key = state.keys[keyIndex].key;
      const delay = i * timeoutMs; // 0ms, 100ms, 200ms, ...

      const controller = new AbortController();
      controllers.push(controller);

      const p = new Promise((resolve, reject) => {
        const timer = delay > 0 ? setTimeout(() => {
          if (controller.signal.aborted) return;
          this._executeFetch(providerId, fetchFn, key, keyIndex, controller.signal)
            .then(resolve)
            .catch(reject);
        }, delay) : null;

        if (delay === 0) {
          this._executeFetch(providerId, fetchFn, key, keyIndex, controller.signal)
            .then(resolve)
            .catch(reject);
        }

        // Store timer ref for cleanup
        controller._timer = timer;
      });

      promises.push(p);
    }

    try {
      // Race all promises — first to resolve wins
      const result = await Promise.any(promises);

      // Abort remaining requests
      for (const ctrl of controllers) {
        ctrl.abort();
        if (ctrl._timer) clearTimeout(ctrl._timer);
      }

      return result;
    } catch {
      // All failed
      for (const ctrl of controllers) {
        if (ctrl._timer) clearTimeout(ctrl._timer);
      }
      return null;
    }
  }

  /**
   * @private
   * Execute a single fetch with error handling.
   */
  async _executeFetch(providerId, fetchFn, key, keyIndex, signal) {
    if (signal?.aborted) throw new Error('Aborted');

    try {
      const result = await fetchFn(key);
      this.markSuccess(providerId, keyIndex);
      return { data: result, keyIndex };
    } catch (err) {
      this._handleError(providerId, keyIndex, err);
      throw err;
    }
  }

  /**
   * @private
   * Handle fetch errors — parse Retry-After, apply cooldown.
   */
  _handleError(providerId, keyIndex, err) {
    // Try to extract Retry-After from response
    let retryAfterMs = null;
    if (err?.response?.headers?.get) {
      const retryAfter = err.response.headers.get('Retry-After');
      retryAfterMs = _ApiKeyRoundRobin.parseRetryAfter(retryAfter);
    } else if (err?.status === 429 || err?.statusCode === 429) {
      retryAfterMs = 5000; // Default 5s cooldown for 429
    }

    this.markCooldown(providerId, keyIndex, retryAfterMs);
  }

  // ── Status ─────────────────────────────────────────────────

  /**
   * Get status for all providers.
   * @returns {Object} providerId → { totalKeys, availableKeys, keys: [...] }
   */
  getStatus() {
    const now = Date.now();
    const result = {};

    for (const [id, state] of this._providers) {
      result[id] = {
        totalKeys: state.keys.length,
        availableKeys: state.keys.filter(k => k.cooldownUntil <= now).length,
        currentIndex: state.currentIndex,
        keys: state.keys.map((k, i) => ({
          index: i,
          inCooldown: k.cooldownUntil > now,
          cooldownRemaining: Math.max(0, k.cooldownUntil - now),
          consecutiveFailures: k.consecutiveFailures,
        })),
      };
    }

    return result;
  }

  /**
   * Reset all state (for testing).
   */
  reset() {
    this._providers.clear();
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const ApiKeyRoundRobin = _ApiKeyRoundRobin;
export const apiKeyRoundRobin = new _ApiKeyRoundRobin();
export default apiKeyRoundRobin;
