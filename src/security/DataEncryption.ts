// ═══════════════════════════════════════════════════════════════════
// charEdge — Client-Side AES-256-GCM Encryption
//
// Uses Web Crypto API (available in all modern browsers).
// Key derivation: PBKDF2 with 600K iterations + random salt.
// Encryption: AES-256-GCM with random 12-byte IV.
//
// Binary format: [salt:16][iv:12][ciphertext:...]
// ═══════════════════════════════════════════════════════════════════

export const PBKDF2_ITERATIONS = 600_000;

/**
 * Derive an AES-256-GCM key from a passphrase + salt.
 */
export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
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
 * @param plaintext — any JSON-serializable value
 * @param passphrase — user's encryption passphrase
 * @returns binary blob: salt(16) + iv(12) + ciphertext
 */
export async function encryptData(plaintext: unknown, passphrase: string): Promise<Blob> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKey(passphrase, salt);

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
 * @param blob — encrypted blob from encryptData()
 * @param passphrase — must be the same passphrase used to encrypt
 * @returns the original JSON-serializable value
 * @throws if passphrase is wrong or data is corrupted
 */
export async function decryptData(blob: Blob, passphrase: string): Promise<unknown> {
  const buffer = await blob.arrayBuffer();
  const data = new Uint8Array(buffer);

  // Minimum: 16 (salt) + 12 (iv) + 16 (AES-GCM auth tag) = 44 bytes
  if (data.length < 44) {
    throw new Error('Encrypted data too short — corrupted or not a charEdge backup');
  }

  const salt = data.slice(0, 16);
  const iv = data.slice(16, 28);
  const ciphertext = data.slice(28);

  const key = await deriveKey(passphrase, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return JSON.parse(new TextDecoder().decode(decrypted));
}

// ─── #16: String-based helpers for SecureStore ──────────────────
// Encrypts to/from base64 strings (for localStorage storage).
// Uses the same PBKDF2 + AES-GCM pipeline as Blob-based helpers.

/**
 * Encrypt a JSON string to a base64-encoded envelope.
 * Returns JSON string: { _f: 'aes', _iv: hex, _ct: base64, _salt: hex }
 */
export async function encryptToBase64(json: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(json)
  );

  const toHex = (b: Uint8Array) => Array.from(b, v => v.toString(16).padStart(2, '0')).join('');
  const ivHex = toHex(iv);
  const saltHex = toHex(salt);
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));

  return JSON.stringify({ _f: 'aes', _iv: ivHex, _ct: ctB64, _salt: saltHex });
}

/**
 * Decrypt a base64-encoded envelope back to JSON string.
 * Accepts the JSON string produced by encryptToBase64().
 */
export async function decryptFromBase64(envelope: string, passphrase: string): Promise<string> {
  const parsed = JSON.parse(envelope);
  if (parsed._f !== 'aes') throw new Error('Unknown encryption format');

  const fromHex = (hex: string) => new Uint8Array(hex.match(/.{2}/g)!.map(h => parseInt(h, 16)));
  const iv = fromHex(parsed._iv);
  const salt = parsed._salt ? fromHex(parsed._salt) : fromHex(parsed._iv.slice(0, 32)); // compat
  const ctBytes = Uint8Array.from(atob(parsed._ct), c => c.charCodeAt(0));

  const key = await deriveKey(passphrase, salt);

  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ctBytes
  );

  return new TextDecoder().decode(plainBuf);
}

/**
 * Check whether the Web Crypto API is available.
 */
export function isEncryptionSupported() {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
}

