// ═══════════════════════════════════════════════════════════════════
// charEdge — Key Vault (6.2.6)
//
// Server-side encrypted API key storage. Replaces client-side
// plaintext API key handling with AES-256-GCM encryption at rest.
//
// Usage:
//   import { vault } from './KeyVault.js';
//   await vault.set('polygon', 'pk_abc123');
//   const key = await vault.get('polygon');
//
// Env: VAULT_SECRET — master encryption key (min 32 chars)
// ═══════════════════════════════════════════════════════════════════

import crypto from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';

// ─── Constants ──────────────────────────────────────────────────

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const DEFAULT_VAULT_PATH = join(process.cwd(), '.vault', 'keys.enc');

// ─── Key Vault ──────────────────────────────────────────────────

class KeyVault {
    constructor(opts = {}) {
        this._path = opts.path || DEFAULT_VAULT_PATH;
        this._secret = opts.secret || process.env.VAULT_SECRET || '';
        this._cache = null; // In-memory cache of decrypted vault
    }

    /**
     * Derive a 256-bit encryption key from the master secret.
     * @private
     */
    _deriveKey() {
        if (!this._secret || this._secret.length < 16) {
            throw new Error(
                'VAULT_SECRET not set or too short (min 16 chars). '
                + 'Set VAULT_SECRET env var or pass secret in constructor.',
            );
        }
        return crypto
            .createHash('sha256')
            .update(this._secret)
            .digest();
    }

    /**
     * Encrypt plaintext to buffer: [IV (16)] [AuthTag (16)] [CipherText].
     * @private
     */
    _encrypt(plaintext) {
        const key = this._deriveKey();
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGO, key, iv);

        const encrypted = Buffer.concat([
            cipher.update(plaintext, 'utf8'),
            cipher.final(),
        ]);

        const authTag = cipher.getAuthTag();

        // Pack: IV + AuthTag + Ciphertext
        return Buffer.concat([iv, authTag, encrypted]);
    }

    /**
     * Decrypt buffer back to plaintext.
     * @private
     */
    _decrypt(data) {
        const key = this._deriveKey();

        const iv = data.subarray(0, IV_LENGTH);
        const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

        const decipher = crypto.createDecipheriv(ALGO, key, iv);
        decipher.setAuthTag(authTag);

        return decipher.update(ciphertext, null, 'utf8') + decipher.final('utf8');
    }

    /**
     * Load and decrypt the vault file.
     * @private
     */
    async _load() {
        if (this._cache) return this._cache;

        if (!existsSync(this._path)) {
            this._cache = {};
            return this._cache;
        }

        const raw = await readFile(this._path);
        const json = this._decrypt(raw);
        this._cache = JSON.parse(json);
        return this._cache;
    }

    /**
     * Encrypt and save the vault to disk.
     * @private
     */
    async _save() {
        const dir = dirname(this._path);
        if (!existsSync(dir)) {
            await mkdir(dir, { recursive: true });
        }

        const json = JSON.stringify(this._cache || {});
        const encrypted = this._encrypt(json);
        await writeFile(this._path, encrypted);
    }

    // ─── Public API ──────────────────────────────────────────────

    /**
     * Get a key by name.
     * @param {string} name - Key name (e.g., 'polygon', 'alpaca_key_id')
     * @returns {Promise<string|null>} The key value, or null if not found
     */
    async get(name) {
        const data = await this._load();
        return data[name]?.value || null;
    }

    /**
     * Store a key.
     * @param {string} name - Key name
     * @param {string} value - Key value (API key, secret, etc.)
     * @param {Object} [meta] - Optional metadata { provider, createdBy }
     */
    async set(name, value, meta = {}) {
        await this._load();
        this._cache[name] = {
            value,
            updatedAt: new Date().toISOString(),
            ...meta,
        };
        await this._save();
    }

    /**
     * Delete a key.
     * @param {string} name
     */
    async delete(name) {
        await this._load();
        delete this._cache[name];
        await this._save();
    }

    /**
     * List all key names (not values).
     * @returns {Promise<string[]>}
     */
    async list() {
        const data = await this._load();
        return Object.keys(data);
    }

    /**
     * Check if a key exists.
     * @param {string} name
     * @returns {Promise<boolean>}
     */
    async has(name) {
        const data = await this._load();
        return name in data;
    }

    /**
     * Clear the in-memory cache (forces reload from disk on next access).
     */
    clearCache() {
        this._cache = null;
    }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const vault = new KeyVault();
export { KeyVault };
export default vault;
