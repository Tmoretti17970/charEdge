// ═══════════════════════════════════════════════════════════════════
// charEdge — Client-Side AES-256-GCM Encryption
//
// Uses Web Crypto API (available in all modern browsers).
// Key derivation: PBKDF2 with 600K iterations + random salt.
// Encryption: AES-256-GCM with random 12-byte IV.
//
// Binary format: [salt:16][iv:12][ciphertext:...]
// ═══════════════════════════════════════════════════════════════════

const PBKDF2_ITERATIONS = 600_000;

/**
 * Derive an AES-256-GCM key from a passphrase + salt.
 * @param {string} passphrase
 * @param {Uint8Array} salt
 * @returns {Promise<CryptoKey>}
 */
async function _deriveKey(passphrase, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt an object into an encrypted Blob.
 * @param {*} plaintext — any JSON-serializable value
 * @param {string} passphrase — user's encryption passphrase
 * @returns {Promise<Blob>} — binary blob: salt(16) + iv(12) + ciphertext
 */
export async function encryptData(plaintext, passphrase) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await _deriveKey(passphrase, salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(plaintext))
  );

  // Pack: salt (16) + iv (12) + ciphertext
  const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  result.set(salt, 0);
  result.set(iv, salt.length);
  result.set(new Uint8Array(encrypted), salt.length + iv.length);

  return new Blob([result], { type: 'application/octet-stream' });
}

/**
 * Decrypt an encrypted Blob back into the original object.
 * @param {Blob} blob — encrypted blob from encryptData()
 * @param {string} passphrase — must be the same passphrase used to encrypt
 * @returns {Promise<*>} — the original JSON-serializable value
 * @throws if passphrase is wrong or data is corrupted
 */
export async function decryptData(blob, passphrase) {
  const buffer = await blob.arrayBuffer();
  const data = new Uint8Array(buffer);

  if (data.length < 29) {
    throw new Error('Encrypted data too short — corrupted or not a charEdge backup');
  }

  const salt = data.slice(0, 16);
  const iv = data.slice(16, 28);
  const ciphertext = data.slice(28);

  const key = await _deriveKey(passphrase, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return JSON.parse(new TextDecoder().decode(decrypted));
}

/**
 * Check whether the Web Crypto API is available.
 * @returns {boolean}
 */
export function isEncryptionSupported() {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
}
