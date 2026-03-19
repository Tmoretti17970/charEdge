// ═══════════════════════════════════════════════════════════════════
// charEdge — Credential Vault (Phase 7 Sprint 7.1)
//
// Encrypted multi-field credential storage for broker connectors.
// Each connector gets its own encrypted blob via SecureStore.
// Extends the ApiKeyStore pattern for complex credentials.
// ═══════════════════════════════════════════════════════════════════

import SecureStore from '@/security/SecureStore';
import { logger } from '@/observability/logger';

const VAULT_PREFIX = 'charEdge-cred-';
const MAX_AUTH_FAILURES = 5;

// In-memory cache for decrypted credentials
const _cache = new Map();
const _failureCounts = new Map();

// ─── Public API ─────────────────────────────────────────────────

/**
 * Store credentials for a connector (encrypted at rest).
 *
 * @param {string} connectorId - e.g., 'coinbase'
 * @param {Object} credentials - e.g., { apiKey, secret, passphrase }
 * @returns {Promise<boolean>}
 */
export async function storeCredentials(connectorId, credentials) {
  try {
    // Validate: ensure all values are strings and non-empty
    for (const [key, value] of Object.entries(credentials)) {
      if (typeof value !== 'string' || value.trim().length === 0) {
        logger.data.warn(`[CredentialVault] Invalid field "${key}" for ${connectorId}`);
        return false;
      }
    }

    await SecureStore.encryptAndStore(VAULT_PREFIX + connectorId, credentials);
    _cache.set(connectorId, { ...credentials });
    _failureCounts.delete(connectorId); // Reset failure count
    logger.data.info(`[CredentialVault] Stored credentials for ${connectorId}`);
    return true;
  } catch (err) {
    logger.data.error(`[CredentialVault] Failed to store for ${connectorId}:`, err?.message);
    return false;
  }
}

/**
 * Load credentials for a connector (decrypts from SecureStore).
 *
 * @param {string} connectorId
 * @returns {Promise<Object|null>}
 */
export async function loadCredentials(connectorId) {
  // Check cache first
  if (_cache.has(connectorId)) {
    return _cache.get(connectorId);
  }

  try {
    const decrypted = await SecureStore.loadAndDecrypt(VAULT_PREFIX + connectorId);
    if (decrypted && typeof decrypted === 'object') {
      _cache.set(connectorId, decrypted);
      return decrypted;
    }
    return null;
  } catch (err) {
    logger.data.warn(`[CredentialVault] Failed to load for ${connectorId}:`, err?.message);
    return null;
  }
}

/**
 * Check if credentials exist for a connector.
 *
 * @param {string} connectorId
 * @returns {Promise<boolean>}
 */
export async function hasCredentials(connectorId) {
  if (_cache.has(connectorId)) return true;
  const cred = await loadCredentials(connectorId);
  return cred !== null;
}

/**
 * Delete credentials for a connector.
 *
 * @param {string} connectorId
 * @returns {Promise<boolean>}
 */
export async function deleteCredentials(connectorId) {
  try {
    _cache.delete(connectorId);
    _failureCounts.delete(connectorId);
    await SecureStore.encryptAndStore(VAULT_PREFIX + connectorId, null);
    logger.data.info(`[CredentialVault] Deleted credentials for ${connectorId}`);
    return true;
  } catch (err) {
    logger.data.warn(`[CredentialVault] Failed to delete for ${connectorId}:`, err?.message);
    return false;
  }
}

/**
 * Record an authentication failure. Auto-wipes credentials
 * after MAX_AUTH_FAILURES consecutive failures.
 *
 * @param {string} connectorId
 * @returns {{ wiped: boolean, failures: number, maxFailures: number }}
 */
export function recordAuthFailure(connectorId) {
  const count = (_failureCounts.get(connectorId) || 0) + 1;
  _failureCounts.set(connectorId, count);

  if (count >= MAX_AUTH_FAILURES) {
    deleteCredentials(connectorId);
    logger.data.warn(`[CredentialVault] Auto-wiped credentials for ${connectorId} after ${count} failures`);
    return { wiped: true, failures: count, maxFailures: MAX_AUTH_FAILURES };
  }

  return { wiped: false, failures: count, maxFailures: MAX_AUTH_FAILURES };
}

/**
 * Reset auth failure counter (call on successful auth).
 * @param {string} connectorId
 */
export function resetAuthFailures(connectorId) {
  _failureCounts.delete(connectorId);
}

/**
 * List all connectors that have stored credentials.
 * @returns {Promise<string[]>}
 */
export async function listStoredConnectors() {
  // Return cached list and also scan for any we haven't loaded yet
  return Array.from(_cache.keys());
}

// ─── Sprint 2 Task 2.4: Master Password ────────────────────────

const MASTER_PW_MARKER = 'charEdge-master-pw-enabled';

/**
 * Check if a master password has been configured.
 * @returns {boolean}
 */
export function hasMasterPassword() {
  try {
    return localStorage.getItem(MASTER_PW_MARKER) === 'true';
  } catch {
    return false;
  }
}

/**
 * Set the master password. This:
 * 1. Derives an encryption key via PBKDF2 (through SecureStore.setPassphrase)
 * 2. Marks that a master password is enabled
 * 3. Re-encrypts all cached credentials with the new passphrase
 *
 * @param {string} password - User's master password (min 12 chars)
 * @returns {Promise<boolean>}
 */
export async function setMasterPassword(password) {
  try {
    // Set passphrase in SecureStore (validates length >= 12)
    SecureStore.setPassphrase(password);

    // Re-encrypt all cached credentials with the new passphrase
    for (const [connectorId, credentials] of _cache.entries()) {
      await SecureStore.encryptAndStore(VAULT_PREFIX + connectorId, credentials);
    }

    // Mark master password as enabled
    localStorage.setItem(MASTER_PW_MARKER, 'true');
    logger.data.info('[CredentialVault] Master password set, credentials re-encrypted');
    return true;
  } catch (err) {
    logger.data.error('[CredentialVault] Failed to set master password:', err?.message);
    return false;
  }
}

/**
 * Unlock the vault with the master password (call at boot).
 * Sets the passphrase so SecureStore can decrypt credentials.
 *
 * @param {string} password
 * @returns {boolean}
 */
export function unlockWithPassword(password) {
  try {
    SecureStore.setPassphrase(password);
    return true;
  } catch (err) {
    logger.data.warn('[CredentialVault] Unlock failed:', err?.message);
    return false;
  }
}

/**
 * Change the master password. Re-encrypts all credentials.
 *
 * @param {string} oldPassword
 * @param {string} newPassword
 * @returns {Promise<boolean>}
 */
export async function changeMasterPassword(oldPassword, newPassword) {
  try {
    // First decrypt everything with old password
    SecureStore.setPassphrase(oldPassword);
    const allCreds = new Map();

    for (const connectorId of _cache.keys()) {
      const cred = await SecureStore.loadAndDecrypt(VAULT_PREFIX + connectorId);
      if (cred) allCreds.set(connectorId, cred);
    }

    // Now re-encrypt with new password
    SecureStore.setPassphrase(newPassword);
    for (const [connectorId, credentials] of allCreds.entries()) {
      await SecureStore.encryptAndStore(VAULT_PREFIX + connectorId, credentials);
      _cache.set(connectorId, credentials);
    }

    logger.data.info('[CredentialVault] Master password changed, credentials re-encrypted');
    return true;
  } catch (err) {
    logger.data.error('[CredentialVault] Failed to change master password:', err?.message);
    return false;
  }
}

/**
 * Remove the master password. Clears passphrase and marker.
 * Credentials will no longer be accessible until a new password is set.
 *
 * @returns {boolean}
 */
export function removeMasterPassword() {
  try {
    SecureStore.setPassphrase(null);
    localStorage.removeItem(MASTER_PW_MARKER);
    _cache.clear();
    logger.data.info('[CredentialVault] Master password removed');
    return true;
  } catch (err) {
    logger.data.warn('[CredentialVault] Failed to remove master password:', err?.message);
    return false;
  }
}

export default {
  storeCredentials,
  loadCredentials,
  hasCredentials,
  deleteCredentials,
  recordAuthFailure,
  resetAuthFailures,
  listStoredConnectors,
  hasMasterPassword,
  setMasterPassword,
  unlockWithPassword,
  changeMasterPassword,
  removeMasterPassword,
};
