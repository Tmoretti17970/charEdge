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

import { logger } from '@/observability/logger';
import SecureStore from '@/security/SecureStore';

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
    const knownProviders = ['polygon', 'alphavantage', 'finnhub', 'fmp', 'fred', 'whalealert', 'coingecko', 'etherscan', 'gemini', 'groq'];
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
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) { /* SSR or private mode */ }
    }

    // 3. If we migrated any keys, persist them encrypted
    if (migrated) {
      await _persistKeys();
      if (typeof console !== 'undefined') {
        logger.data.info('[ApiKeyStore] Migrated legacy plain-text keys to encrypted storage');
      }
    }

    // 4. Seed from VITE_*_API_KEY env vars (defaults — user keys take priority)
    const envMap = {
      polygon: 'VITE_POLYGON_API_KEY',
      alphavantage: 'VITE_ALPHAVANTAGE_API_KEY',
      finnhub: 'VITE_FINNHUB_API_KEY',
      fmp: 'VITE_FMP_API_KEY',
      fred: 'VITE_FRED_API_KEY',
      whalealert: 'VITE_WHALEALERT_API_KEY',
      coingecko: 'VITE_COINGECKO_API_KEY',
      etherscan: 'VITE_ETHERSCAN_API_KEY',
      gemini: 'VITE_GEMINI_API_KEY',
      groq: 'VITE_GROQ_API_KEY',
    };
    try {
      const env = import.meta?.env;
      if (env) {
        for (const [provider, envKey] of Object.entries(envMap)) {
          if (!_cache[provider] && env[envKey]) {
            _cache[provider] = env[envKey];
          }
        }
      }
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) { /* SSR / non-Vite environment */ }
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
