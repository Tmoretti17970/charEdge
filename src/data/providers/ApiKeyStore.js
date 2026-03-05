// ═══════════════════════════════════════════════════════════════════
// charEdge — API Key Storage (Encrypted)
//
// Centralized API key management for all data providers.
// Keys are encrypted at rest using SecureStore (AES-GCM / PBKDF2).
//
// Architecture:
//   - In-memory cache for synchronous reads (getApiKey stays sync)
//   - Async encryption on write (setApiKey encrypts in background)
//   - initApiKeys() loads + decrypts all keys on app startup
//   - Auto-migrates legacy plain-text keys on first load
//
// Usage stays the same:
//   import { getApiKey, setApiKey } from './ApiKeyStore.js';
//   const key = getApiKey('polygon');  // sync
//   setApiKey('polygon', 'pk_...');    // async (fire-and-forget)
// ═══════════════════════════════════════════════════════════════════

import SecureStore from '../../utils/SecureStore.ts';
import { logger } from '../../utils/logger';

const SECURE_KEY = 'charEdge-apikeys'; // Single encrypted blob for all keys
const LEGACY_PREFIX = 'charEdge-apikey-'; // Old per-key plain-text prefix

// ─── In-Memory Cache ────────────────────────────────────────────
// Populated by initApiKeys() on app start, kept in sync by setApiKey().
const _cache = {};
let _initialized = false;

// ─── Public API ─────────────────────────────────────────────────

/**
 * Get an API key (synchronous — reads from in-memory cache).
 * @param {string} provider - e.g., 'polygon', 'alphavantage'
 * @returns {string}
 */
export function getApiKey(provider) {
  return _cache[provider] || '';
}

/**
 * Set an API key (updates cache immediately, encrypts to disk async).
 * @param {string} provider
 * @param {string} key
 */
export function setApiKey(provider, key) {
  if (key) {
    _cache[provider] = key;
  } else {
    delete _cache[provider];
  }

  // Fire-and-forget encrypted persistence
  _persistKeys().catch((err) => {
    if (typeof console !== 'undefined') {
      logger.data.warn('[ApiKeyStore] Failed to persist keys:', err?.message);
    }
  });
}

/**
 * Check if a provider has an API key configured.
 * @param {string} provider
 * @returns {boolean}
 */
export function hasApiKey(provider) {
  return getApiKey(provider).length > 0;
}

/**
 * Initialize API keys — load from encrypted storage into memory.
 * Call once on app startup. Handles migration from legacy plain-text keys.
 * @returns {Promise<void>}
 */
export async function initApiKeys() {
  if (_initialized) return;
  _initialized = true;

  try {
    // 1. Try loading from encrypted SecureStore
    const encrypted = await SecureStore.loadAndDecrypt(SECURE_KEY);
    if (encrypted && typeof encrypted === 'object') {
      Object.assign(_cache, encrypted);
    }

    // 2. Migrate legacy plain-text keys (charEdge-apikey-*)
    let migrated = false;
    const knownProviders = ['polygon', 'alphavantage', 'finnhub', 'fmp', 'fred', 'whalealert', 'coingecko', 'etherscan'];
    for (const provider of knownProviders) {
      try {
        const legacyKey = localStorage.getItem(LEGACY_PREFIX + provider);
        if (legacyKey && !_cache[provider]) {
          _cache[provider] = legacyKey;
          migrated = true;
        }
        // Remove legacy plain-text key regardless (cleanup)
        if (legacyKey) {
          localStorage.removeItem(LEGACY_PREFIX + provider);
        }
      } catch (_) { /* SSR or private mode */ }
    }

    // 3. If we migrated any keys, persist them encrypted
    if (migrated) {
      await _persistKeys();
      if (typeof console !== 'undefined') {
        logger.data.info('[ApiKeyStore] Migrated legacy plain-text keys to encrypted storage');
      }
    }
  } catch (err) {
    if (typeof console !== 'undefined') {
      logger.data.warn('[ApiKeyStore] Init failed, falling back to empty:', err?.message);
    }
  }
}

// ─── Internal ───────────────────────────────────────────────────

/** Encrypt and persist all keys as a single blob */
async function _persistKeys() {
  // Only persist non-empty keys
  const toStore = {};
  for (const [k, v] of Object.entries(_cache)) {
    if (v) toStore[k] = v;
  }
  await SecureStore.encryptAndStore(SECURE_KEY, toStore);
}
