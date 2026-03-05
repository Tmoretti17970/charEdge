// ═══════════════════════════════════════════════════════════════════
// charEdge — KeyVault (TypeScript)
//
// Server-side encrypted key-value store for API keys.
// Uses AES-256-GCM with random IVs for each encryption.
// Phase 2: Converted to TypeScript.
// ═══════════════════════════════════════════════════════════════════

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// ─── Types ────────────────────────────────────────────────────────

export interface KeyVaultOptions {
    /** Secret used to derive the encryption key (min 16 chars). */
    secret: string;
    /** Path to the encrypted vault file on disk. */
    path: string;
}

type VaultData = Record<string, string>;

// ─── Constants ────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm' as const;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const MIN_SECRET_LENGTH = 16;

// ─── KeyVault Class ───────────────────────────────────────────────

export class KeyVault {
    private readonly _secret: string;
    private readonly _path: string;

    constructor(opts: KeyVaultOptions) {
        this._secret = opts.secret;
        this._path = opts.path;
    }

    /**
     * Derive a 256-bit key from the secret.
     * Throws if secret is too short.
     */
    private _deriveKey(): Buffer {
        if (!this._secret || this._secret.length < MIN_SECRET_LENGTH) {
            throw new Error('VAULT_SECRET must be at least 16 characters');
        }
        return createHash('sha256').update(this._secret).digest();
    }

    /**
     * Encrypt plaintext string → Buffer (IV + ciphertext + authTag).
     */
    private _encrypt(plaintext: string): Buffer {
        const key = this._deriveKey();
        const iv = randomBytes(IV_LENGTH);
        const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

        const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();

        return Buffer.concat([iv, encrypted, authTag]);
    }

    /**
     * Decrypt Buffer → plaintext string.
     */
    private _decrypt(buf: Buffer): string {
        const key = this._deriveKey();
        const iv = buf.subarray(0, IV_LENGTH);
        const authTag = buf.subarray(buf.length - AUTH_TAG_LENGTH);
        const encrypted = buf.subarray(IV_LENGTH, buf.length - AUTH_TAG_LENGTH);

        const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
        decipher.setAuthTag(authTag);

        return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
    }

    /**
     * Load the vault data from disk.
     */
    private async _load(): Promise<VaultData> {
        if (!existsSync(this._path)) return {};
        const raw = await readFile(this._path);
        const json = this._decrypt(raw);
        return JSON.parse(json) as VaultData;
    }

    /**
     * Save vault data to disk.
     */
    private async _save(data: VaultData): Promise<void> {
        const json = JSON.stringify(data);
        const encrypted = this._encrypt(json);
        await writeFile(this._path, encrypted);
    }

    /**
     * Set a key-value pair.
     */
    async set(name: string, value: string): Promise<void> {
        const data = await this._load();
        data[name] = value;
        await this._save(data);
    }

    /**
     * Get a value by key name. Returns null if not found.
     */
    async get(name: string): Promise<string | null> {
        const data = await this._load();
        return data[name] ?? null;
    }

    /**
     * Delete a key.
     */
    async delete(name: string): Promise<void> {
        const data = await this._load();
        delete data[name];
        await this._save(data);
    }

    /**
     * List all key names.
     */
    async list(): Promise<string[]> {
        const data = await this._load();
        return Object.keys(data);
    }

    /**
     * Check if a key exists.
     */
    async has(name: string): Promise<boolean> {
        const data = await this._load();
        return name in data;
    }
}
