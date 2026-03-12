// ═══════════════════════════════════════════════════════════════════
// charEdge — Encrypted Store (#22: Consolidated into UnifiedDB)
//
// Client-side IndexedDB wrapper using Web Crypto API for transparent
// encryption at rest. Sensitive data (trades, journal, API keys) is
// encrypted before writing and decrypted on read.
//
// #22 CHANGE: Now uses charEdge-unified (via openUnifiedDB) instead
// of its own charEdge_encrypted database. Stores are prefixed with
// enc_ to avoid collisions.
//
// Usage:
//   import { encryptedStore } from './EncryptedStore.js';
//   await encryptedStore.init();
//   await encryptedStore.put('journal', 'entry-1', { text: 'my notes' });
//   const data = await encryptedStore.get('journal', 'entry-1');
// ═══════════════════════════════════════════════════════════════════

import openUnifiedDB from './UnifiedDB.js';

// #22: Store name mapping — callers still use 'journal', 'trades', etc.
// but we prefix with enc_ in the unified DB to avoid collisions.
const STORE_PREFIX = 'enc_';
const KEY_STORE = 'enc_crypto_keys';

/** Map caller store name to unified DB store name */
function _mapStore(storeName) {
    if (storeName === '__crypto_keys__') return KEY_STORE;
    if (storeName.startsWith('enc_')) return storeName; // already mapped
    return `${STORE_PREFIX}${storeName}`;
}

// ─── Encrypted Store ────────────────────────────────────────────

class EncryptedStore {
    constructor() {
        /** @type {IDBDatabase|null} */
        this._db = null;
        /** @type {CryptoKey|null} */
        this._cryptoKey = null;
        this._initPromise = null;
    }

    /**
     * Initialize the encrypted store.
     * Generates or loads the encryption key.
     */
    async init() {
        if (this._db) return;
        if (this._initPromise) return this._initPromise;

        this._initPromise = this._doInit();
        return this._initPromise;
    }

    /** @private */
    async _doInit() {
        // #22: Use the unified database instead of a separate one
        this._db = await openUnifiedDB();

        // Now that DB is open, get or create encryption key
        this._cryptoKey = await this._getOrCreateKey();
    }

    // ─── CRUD ───────────────────────────────────────────────────

    /**
     * Store an encrypted value.
     * @param {string} storeName - IndexedDB object store
     * @param {string} key - Record key
     * @param {*} value - Data to encrypt and store
     */
    async put(storeName, key, value) {
        await this.init();
        const mapped = _mapStore(storeName);
        const encrypted = await this._encrypt(JSON.stringify(value));

        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(mapped, 'readwrite');
            const store = tx.objectStore(mapped);
            const req = store.put(encrypted, key);
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * Get and decrypt a value.
     * @param {string} storeName
     * @param {string} key
     * @returns {Promise<*|null>}
     */
    async get(storeName, key) {
        await this.init();
        const mapped = _mapStore(storeName);

        const encrypted = await new Promise((resolve, reject) => {
            const tx = this._db.transaction(mapped, 'readonly');
            const store = tx.objectStore(mapped);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });

        if (!encrypted) return null;

        try {
            const json = await this._decrypt(encrypted);
            return JSON.parse(json);
        // eslint-disable-next-line unused-imports/no-unused-vars
        } catch (_) {
            return null; // Corrupted or wrong key
        }
    }

    /**
     * Delete a record.
     */
    async delete(storeName, key) {
        await this.init();
        const mapped = _mapStore(storeName);

        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(mapped, 'readwrite');
            const store = tx.objectStore(mapped);
            const req = store.delete(key);
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * Get all keys in a store.
     */
    async keys(storeName) {
        await this.init();
        const mapped = _mapStore(storeName);

        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(mapped, 'readonly');
            const store = tx.objectStore(mapped);
            const req = store.getAllKeys();
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    // ─── Crypto ─────────────────────────────────────────────────

    /**
     * Get or create the AES-GCM encryption key.
     * Key is stored as a non-extractable CryptoKey in IndexedDB
     * (IDB supports structured clone of CryptoKey objects).
     * @private
     */
    async _getOrCreateKey() {
        // Try to load from IndexedDB (the key store is created in _doInit)
        if (this._db) {
            const existing = await new Promise((resolve, reject) => {
                const tx = this._db.transaction(KEY_STORE, 'readonly');
                const kstore = tx.objectStore(KEY_STORE);
                const req = kstore.get('master');
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = (e) => reject(e.target.error);
            });
            if (existing) return existing;
        }

        // Generate new non-extractable key
        const key = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            false, // Non-extractable — key material cannot be read by JS
            ['encrypt', 'decrypt'],
        );

        // Store in IndexedDB if DB is ready
        if (this._db) {
            await new Promise((resolve, reject) => {
                const tx = this._db.transaction(KEY_STORE, 'readwrite');
                const kstore = tx.objectStore(KEY_STORE);
                const req = kstore.put(key, 'master');
                req.onsuccess = () => resolve();
                req.onerror = (e) => reject(e.target.error);
            });
        }

        return key;
    }

    /**
     * Encrypt a string using AES-256-GCM.
     * @private
     * @returns {ArrayBuffer} [IV (12 bytes) | Ciphertext]
     */
    async _encrypt(plaintext) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(plaintext);

        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            this._cryptoKey,
            encoded,
        );

        // Pack IV + ciphertext
        const packed = new Uint8Array(iv.length + ciphertext.byteLength);
        packed.set(iv, 0);
        packed.set(new Uint8Array(ciphertext), iv.length);

        return packed.buffer;
    }

    /**
     * Decrypt an ArrayBuffer using AES-256-GCM.
     * @private
     */
    async _decrypt(data) {
        const bytes = new Uint8Array(data);
        const iv = bytes.slice(0, 12);
        const ciphertext = bytes.slice(12);

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            this._cryptoKey,
            ciphertext,
        );

        return new TextDecoder().decode(decrypted);
    }

    /**
     * Close the database connection.
     */
    dispose() {
        this._db?.close();
        this._db = null;
        this._cryptoKey = null;
        this._initPromise = null;
    }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const encryptedStore = new EncryptedStore();
export { EncryptedStore };
export default encryptedStore;
