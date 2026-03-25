// ═══════════════════════════════════════════════════════════════════
// charEdge — Storage Encryption (Sprint 2 — Task 2.1)
//
// Transparent AES-256-GCM encryption for IndexedDB records.
// Uses a per-device key generated via Web Crypto API and stored
// in a separate IDB object store ('_keyStore').
//
// No passphrase required — the key lives on-device only.
// For passphrase-based encryption, see SecureStore.ts.
// ═══════════════════════════════════════════════════════════════════
/* global JsonWebKey */

import { logger } from '@/observability/logger';

// ─── Constants ──────────────────────────────────────────────────

const KEY_STORE_NAME = '_charEdge_keyStore';
const KEY_ID = 'device-encryption-key';
const DB_NAME = 'charEdge-keyStore';
const DB_VERSION = 1;

// Marker field on encrypted records
const ENC_MARKER = '_enc';

// ─── Key Management ─────────────────────────────────────────────

let _cachedKey: CryptoKey | null = null;
let _encryptionEnabled = true;

/**
 * Open the dedicated key-store IDB.
 */
function openKeyStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KEY_STORE_NAME)) {
        db.createObjectStore(KEY_STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Generate a new AES-256-GCM key via Web Crypto.
 */
async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable — needed to export/store in IDB
    ['encrypt', 'decrypt'],
  );
}

/**
 * Export a CryptoKey to a JWK for IDB storage.
 */
async function exportKey(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', key);
}

/**
 * Import a JWK back into a CryptoKey.
 */
async function importKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

/**
 * Get or create the per-device encryption key.
 * Caches in memory after first load.
 */
export async function getDeviceKey(): Promise<CryptoKey> {
  if (_cachedKey) return _cachedKey;

  try {
    const db = await openKeyStore();

    // Try loading existing key
    const stored = await new Promise<{ id: string; jwk: JsonWebKey } | undefined>((resolve, reject) => {
      const tx = db.transaction(KEY_STORE_NAME, 'readonly');
      const req = tx.objectStore(KEY_STORE_NAME).get(KEY_ID);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (stored?.jwk) {
      _cachedKey = await importKey(stored.jwk);
      db.close();
      return _cachedKey;
    }

    // Generate new key
    const key = await generateKey();
    const jwk = await exportKey(key);

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(KEY_STORE_NAME, 'readwrite');
      const req = tx.objectStore(KEY_STORE_NAME).put({ id: KEY_ID, jwk });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    _cachedKey = key;
    db.close();
    logger.data.info('[StorageEncryption] Generated new device encryption key');
    return _cachedKey;
  } catch (err) {
    logger.data.warn('[StorageEncryption] Key management failed:', (err as Error)?.message);
    throw err;
  }
}

// ─── Encrypt / Decrypt ──────────────────────────────────────────

/**
 * Encrypt a single IDB record's data fields.
 * Preserves the primary key field (id) unencrypted for IDB indexing.
 * Returns a new object: { id, _enc: true, _iv: hex, _ct: base64 }
 */
export async function encryptRecord<T extends Record<string, unknown>>(
  record: T,
  pkField = 'id',
): Promise<Record<string, unknown>> {
  if (!_encryptionEnabled || !isEncryptionSupported()) return record;
  if ((record as Record<string, unknown>)[ENC_MARKER]) return record; // Already encrypted

  const key = await getDeviceKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const json = JSON.stringify(record);

  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(json));

  const toHex = (b: Uint8Array) => Array.from(b, (v) => v.toString(16).padStart(2, '0')).join('');
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));

  // Preserve primary key + any index fields for IDB queries
  const result: Record<string, unknown> = {
    [pkField]: record[pkField],
    [ENC_MARKER]: true,
    _iv: toHex(iv),
    _ct: ctB64,
  };

  // Preserve 'symbol' and 'date' fields for indexed queries (unencrypted)
  if ('symbol' in record) result.symbol = record.symbol;
  if ('date' in record) result.date = record.date;
  if ('key' in record) result.key = record.key; // settings store key

  return result;
}

/**
 * Decrypt a single encrypted IDB record.
 * If the record is not encrypted (_enc !== true), returns it as-is.
 */
export async function decryptRecord<T = unknown>(record: Record<string, unknown>): Promise<T> {
  if (!record || !record[ENC_MARKER]) return record as T;

  const key = await getDeviceKey();

  const fromHex = (hex: string) => new Uint8Array((hex.match(/.{2}/g) || []).map((h) => parseInt(h, 16)));

  const iv = fromHex(record._iv as string);
  const ctBytes = Uint8Array.from(atob(record._ct as string), (c) => c.charCodeAt(0));

  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ctBytes);
  return JSON.parse(new TextDecoder().decode(plainBuf)) as T;
}

/**
 * Check if a record is encrypted.
 */
export function isEncrypted(record: unknown): boolean {
  return !!record && typeof record === 'object' && (record as Record<string, unknown>)[ENC_MARKER] === true;
}

// ─── Migration ──────────────────────────────────────────────────

/**
 * Encrypt all unencrypted records in a given IDB object store.
 * Called once during AppBoot migration.
 * @returns number of records migrated
 */
export async function migrateStore(db: IDBDatabase, storeName: string, pkField = 'id'): Promise<number> {
  if (!_encryptionEnabled || !isEncryptionSupported()) return 0;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    let migrated = 0;

    req.onsuccess = async () => {
      const records = req.result || [];
      const unencrypted = records.filter((r: Record<string, unknown>) => !r[ENC_MARKER]);

      if (unencrypted.length === 0) {
        resolve(0);
        return;
      }

      try {
        // Encrypt each record and write back in a new transaction
        const writeTx = db.transaction(storeName, 'readwrite');
        const writeStore = writeTx.objectStore(storeName);

        for (const record of unencrypted) {
          const encrypted = await encryptRecord(record, pkField);
          writeStore.put(encrypted);
          migrated++;
        }

        writeTx.oncomplete = () => resolve(migrated);
        writeTx.onerror = () => reject(writeTx.error);
      } catch (err) {
        reject(err);
      }
    };

    req.onerror = () => reject(req.error);
  });
}

// ─── Configuration ──────────────────────────────────────────────

/**
 * Enable or disable encryption (for Settings toggle).
 */
export function setEncryptionEnabled(enabled: boolean): void {
  _encryptionEnabled = enabled;
}

/**
 * Check if encryption is currently enabled.
 */
export function isEncryptionEnabled(): boolean {
  return _encryptionEnabled;
}

/**
 * Check whether the Web Crypto API is available.
 */
export function isEncryptionSupported(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
}
