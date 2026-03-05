// ═══════════════════════════════════════════════════════════════════
// charEdge — SecureStore (H1.2 + Tier 3.1 Security Hardening)
//
// Encrypted localStorage storage using Web Crypto AES-GCM.
// Used for sensitive data (auth tokens, API keys) that must not
// be stored in plain text.
//
// Architecture:
//   1. Derives an AES-GCM key via PBKDF2 from:
//      a) User-provided passphrase (preferred, real encryption)
//      b) Device fingerprint fallback (obfuscation only)
//   2. Encrypts JSON payloads before storing in localStorage
//   3. Decrypts on read
//   4. Falls back to base64 encoding when crypto.subtle is unavailable
//      (non-secure context, SSR, etc.)
// ═══════════════════════════════════════════════════════════════════

const SALT_KEY = 'charEdge-sec-salt';
const PBKDF2_ITERATIONS = 100_000;

// ─── Passphrase (in-memory only, never persisted) ────────────────
let _passphrase = null;

// ─── Helpers ─────────────────────────────────────────────────────

/** Check if Web Crypto subtle API is available (requires secure context) */
function _hasCryptoSubtle() {
  return (
    typeof globalThis !== 'undefined' &&
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.subtle !== 'undefined'
  );
}

/** Get or create a persistent random salt (stored in localStorage) */
function _getSalt() {
  try {
    let salt = localStorage.getItem(SALT_KEY);
    if (!salt) {
      // Generate 16 random bytes as hex
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      salt = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(SALT_KEY, salt);
    }
    return salt;
  } catch {
    return 'charEdge-fallback-salt-v1';
  }
}

/** Build a deterministic device fingerprint for key derivation */
function _getFingerprint() {
  const parts = [
    typeof navigator !== 'undefined' ? navigator.userAgent : 'ssr',
    typeof location !== 'undefined' ? location.origin : 'localhost',
    _getSalt(),
  ];
  return parts.join('|');
}

/**
 * Derive an AES-GCM key via PBKDF2.
 * Uses passphrase when set (real encryption), otherwise falls back
 * to device fingerprint (obfuscation only).
 */
async function _deriveKey() {
  const enc = new TextEncoder();
  // Prefer user passphrase over device fingerprint
  const secret = _passphrase || _getFingerprint();
  const salt = enc.encode(_getSalt());

  // Import secret as raw key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  // Derive AES-GCM key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ─── Base64 Fallback ─────────────────────────────────────────────

function _b64Encode(str) {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return btoa(str);
  }
}

function _b64Decode(b64) {
  try {
    return decodeURIComponent(escape(atob(b64)));
  } catch {
    return atob(b64);
  }
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Encrypt an object and store it in localStorage.
 * Falls back to base64 encoding if Web Crypto is unavailable.
 *
 * @param {string} key - localStorage key
 * @param {object} data - Plain object to encrypt and store
 */
async function encryptAndStore(key, data) {
  const json = JSON.stringify(data);

  if (!_hasCryptoSubtle()) {
    // Fallback: base64 encode (obfuscation only, not true encryption)
    if (typeof console !== 'undefined') {
      console.warn('[SecureStore] crypto.subtle unavailable — using base64 fallback');
    }
    try {
      localStorage.setItem(key, JSON.stringify({ _f: 'b64', _d: _b64Encode(json) }));
    } catch { /* quota exceeded — handled by caller */ }
    return;
  }

  try {
    const cryptoKey = await _deriveKey();
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      enc.encode(json),
    );

    // Store as JSON: { _f: 'aes', _iv: hex, _ct: base64 }
    const ivHex = Array.from(iv, (b) => b.toString(16).padStart(2, '0')).join('');
    const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));

    localStorage.setItem(key, JSON.stringify({ _f: 'aes', _iv: ivHex, _ct: ctB64 }));
  } catch (err) {
    // If encryption fails, fall back to base64
    if (typeof console !== 'undefined') {
      console.warn('[SecureStore] Encryption failed, using base64 fallback:', err.message);
    }
    try {
      localStorage.setItem(key, JSON.stringify({ _f: 'b64', _d: _b64Encode(json) }));
    } catch { /* quota exceeded */ }
  }
}

/**
 * Load and decrypt an object from localStorage.
 * Handles both encrypted (AES-GCM) and legacy plain-text formats.
 *
 * @param {string} key - localStorage key
 * @returns {object|null} Decrypted object, or null if not found/invalid
 */
async function loadAndDecrypt(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    let envelope;
    try {
      envelope = JSON.parse(raw);
    } catch {
      // Not valid JSON — might be legacy plain text
      return null;
    }

    // ─── Legacy migration: plain-text JSON (no _f field) ─────
    if (!envelope._f) {
      // This is old unencrypted data — return it and let caller re-save encrypted
      return envelope;
    }

    // ─── Base64 fallback format ──────────────────────────────
    if (envelope._f === 'b64') {
      return JSON.parse(_b64Decode(envelope._d));
    }

    // ─── AES-GCM encrypted format ───────────────────────────
    if (envelope._f === 'aes') {
      if (!_hasCryptoSubtle()) {
        console.warn('[SecureStore] Cannot decrypt AES data without crypto.subtle');
        return null;
      }

      const cryptoKey = await _deriveKey();

      // Decode IV from hex
      const ivBytes = new Uint8Array(
        envelope._iv.match(/.{2}/g).map((h) => parseInt(h, 16)),
      );

      // Decode ciphertext from base64
      const ctBytes = Uint8Array.from(atob(envelope._ct), (c) => c.charCodeAt(0));

      const plainBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBytes },
        cryptoKey,
        ctBytes,
      );

      return JSON.parse(new TextDecoder().decode(plainBuf));
    }

    // Unknown format
    return null;
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[SecureStore] Failed to load/decrypt:', err.message);
    }
    return null;
  }
}

/**
 * Remove an encrypted entry from localStorage.
 * @param {string} key - localStorage key
 */
function clear(key) {
  try {
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}

/**
 * Check if SecureStore is using real encryption (vs base64 fallback).
 * Useful for UI indicators.
 * @returns {boolean}
 */
function isEncryptionAvailable() {
  return _hasCryptoSubtle();
}

/**
 * Set a user-provided passphrase for key derivation.
 * Stored in memory only — never persisted to disk.
 * When set, encryption uses this instead of the device fingerprint.
 *
 * @param {string|null} phrase - Passphrase string, or null to clear
 */
function setPassphrase(phrase) {
  _passphrase = typeof phrase === 'string' && phrase.length > 0 ? phrase : null;
}

/**
 * Check if a passphrase is currently set.
 * @returns {boolean}
 */
function hasPassphrase() {
  return _passphrase !== null;
}

export const SecureStore = {
  encryptAndStore,
  loadAndDecrypt,
  clear,
  isEncryptionAvailable,
  setPassphrase,
  hasPassphrase,
};

export default SecureStore;
