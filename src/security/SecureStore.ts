import { logger } from '../observability/logger';
import {
  encryptToBase64,
  decryptFromBase64,
  isEncryptionSupported,
} from './DataEncryption';

// ═══════════════════════════════════════════════════════════════════
// charEdge — SecureStore (Phase 2 — #16/#17/#18 Hardened)
//
// Encrypted localStorage storage using Web Crypto AES-GCM.
// Uses the canonical DataEncryption module (PBKDF2 600K + AES-256-GCM).
//
// SECURITY CHANGES (Phase 2):
//   #16: Consolidated — uses DataEncryption.ts (600K PBKDF2) instead
//        of its own duplicate 100K implementation.
//   #17: Passphrase REQUIRED — device fingerprint fallback removed.
//        Calls fail with logged error if no passphrase is set.
//   #18: No plaintext/base64 fallback — if crypto.subtle is unavailable,
//        operations throw instead of silently storing in plain text.
// ═══════════════════════════════════════════════════════════════════

// ─── Passphrase (in-memory only, never persisted) ────────────────
let _passphrase: string | null = null;

// Minimum passphrase length (#20)
const MIN_PASSPHRASE_LENGTH = 12;

// ─── Public API ──────────────────────────────────────────────────

/**
 * Encrypt an object and store it in localStorage.
 * REQUIRES: passphrase must be set via setPassphrase() first.
 * REQUIRES: Web Crypto API available (secure context).
 *
 * @param key — localStorage key
 * @param data — Plain object to encrypt and store
 * @throws if passphrase not set or crypto unavailable
 */
async function encryptAndStore(key: string, data: unknown): Promise<void> {
  // #17: Passphrase required — no fingerprint fallback
  if (!_passphrase) {
    logger.ui.warn(
      '[SecureStore] Cannot encrypt — no passphrase set. Call SecureStore.setPassphrase() first.'
    );
    throw new Error('Passphrase required for encryption');
  }

  // #18: No fallback — crypto.subtle must be available
  if (!isEncryptionSupported()) {
    logger.ui.warn('[SecureStore] crypto.subtle unavailable — cannot encrypt data');
    throw new Error('Web Crypto unavailable — secure context required');
  }

  try {
    const json = JSON.stringify(data);
    // #16: Uses canonical DataEncryption (600K PBKDF2 + AES-256-GCM)
    const encrypted = await encryptToBase64(json, _passphrase);
    localStorage.setItem(key, encrypted);
  } catch (err) {
    // #18: No base64 fallback — propagate error
    logger.ui.warn('[SecureStore] Encryption failed:', (err as Error).message);
    throw err;
  }
}

/**
 * Load and decrypt an object from localStorage.
 * Handles encrypted (AES-GCM) and legacy plain-text formats.
 * Legacy data is returned as-is for migration by the caller.
 *
 * @param key — localStorage key
 * @returns Decrypted object, or null if not found/invalid
 */
async function loadAndDecrypt(key: string): Promise<unknown> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    let envelope: Record<string, unknown>;
    try {
      envelope = JSON.parse(raw);
    } catch {
      // Not valid JSON — corrupted
      return null;
    }

    // ─── Legacy migration: plain-text JSON (no _f field) ─────
    if (!envelope._f) {
      // Old unencrypted data — return it, caller should re-save encrypted
      return envelope;
    }

    // ─── Legacy base64 format (from old SecureStore) ─────────
    // Read but don't write — this format is deprecated
    if (envelope._f === 'b64') {
      try {
        const decoded = decodeURIComponent(escape(atob(envelope._d as string)));
        return JSON.parse(decoded);
      } catch {
        return atob(envelope._d as string);
      }
    }

    // ─── AES-GCM encrypted format ───────────────────────────
    if (envelope._f === 'aes') {
      if (!isEncryptionSupported()) {
        logger.ui.warn('[SecureStore] Cannot decrypt AES data without crypto.subtle');
        return null;
      }

      if (!_passphrase) {
        logger.ui.warn('[SecureStore] Cannot decrypt — no passphrase set');
        return null;
      }

      // #16: Uses canonical DataEncryption decryption
      const json = await decryptFromBase64(raw, _passphrase);
      return JSON.parse(json);
    }

    // Unknown format
    return null;
  } catch (err) {
    logger.ui.warn('[SecureStore] Failed to load/decrypt:', (err as Error).message);
    return null;
  }
}

/**
 * Remove an encrypted entry from localStorage.
 */
function clear(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}

/**
 * Check if SecureStore can perform real encryption.
 * Requires both Web Crypto and a passphrase.
 */
function isEncryptionAvailable(): boolean {
  return isEncryptionSupported() && _passphrase !== null;
}

/**
 * Check if a passphrase is currently set.
 */
function hasPassphrase(): boolean {
  return _passphrase !== null;
}

/**
 * Check if a passphrase needs to be set before encryption can proceed.
 * UI should show PassphraseGate if this returns true.
 */
function isPassphraseRequired(): boolean {
  return _passphrase === null;
}

/**
 * Validate a passphrase string.
 * #20: Enforces minimum 12 characters.
 * @returns { valid, error }
 */
function validatePassphrase(phrase: string): { valid: boolean; error: string | null } {
  if (!phrase || typeof phrase !== 'string') {
    return { valid: false, error: 'Passphrase is required' };
  }
  if (phrase.length < MIN_PASSPHRASE_LENGTH) {
    return { valid: false, error: `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters` };
  }
  // Check character class diversity (bonus, not blocking)
  return { valid: true, error: null };
}

/**
 * Set a user-provided passphrase for key derivation.
 * Stored in memory only — never persisted to disk.
 * #20: Validates minimum length (12 chars).
 *
 * @param phrase — Passphrase string, or null to clear
 * @throws if passphrase is too short
 */
function setPassphrase(phrase: string | null): void {
  if (phrase === null) {
    _passphrase = null;
    return;
  }

  const validation = validatePassphrase(phrase);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid passphrase');
  }

  _passphrase = phrase;
}

export const SecureStore = {
  encryptAndStore,
  loadAndDecrypt,
  clear,
  isEncryptionAvailable,
  setPassphrase,
  hasPassphrase,
  isPassphraseRequired,
  validatePassphrase,
};

export default SecureStore;
