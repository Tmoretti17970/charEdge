// ═══════════════════════════════════════════════════════════════════
// charEdge — Encrypted Store (6.2.1)
//
// Client-side IndexedDB wrapper using Web Crypto API for transparent
// encryption at rest. Sensitive data (trades, journal, API keys) is
// encrypted before writing and decrypted on read.
//
// Usage:
//   import { encryptedStore } from './EncryptedStore.js';
//   await encryptedStore.init();
//   await encryptedStore.put('journal', 'entry-1', { text: 'my notes' });
//   const data = await encryptedStore.get('journal', 'entry-1');
// ═══════════════════════════════════════════════════════════════════

const DB_NAME = 'charEdge_encrypted';
const DB_VERSION = 1;
const KEY_STORE = '__crypto_keys__';

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
        // Generate or retrieve encryption key
        this._cryptoKey = await this._getOrCreateKey();

        // Open IndexedDB
        this._db = await new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);

            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                // Create stores for common data types
                for (const store of ['journal', 'trades', 'settings', 'apikeys']) {
                    if (!db.objectStoreNames.contains(store)) {
                        db.createObjectStore(store);
                    }
                }
            };

            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
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
        const encrypted = await this._encrypt(JSON.stringify(value));

        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
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

        const encrypted = await new Promise((resolve, reject) => {
            const tx = this._db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });

        if (!encrypted) return null;

        try {
            const json = await this._decrypt(encrypted);
            return JSON.parse(json);
        } catch (_) {
            return null; // Corrupted or wrong key
        }
    }

    /**
     * Delete a record.
     */
    async delete(storeName, key) {
        await this.init();

        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
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

        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAllKeys();
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    // ─── Crypto ─────────────────────────────────────────────────

    /**
     * Get or create the AES-GCM encryption key.
     * Key is stored in sessionStorage (cleared when tab closes).
     * @private
     */
    async _getOrCreateKey() {
        // Try to load from sessionStorage
        const stored = sessionStorage.getItem(KEY_STORE);
        if (stored) {
            const jwk = JSON.parse(stored);
            return crypto.subtle.importKey('jwk', jwk, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
        }

        // Generate new key
        const key = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true, // Extractable (for sessionStorage)
            ['encrypt', 'decrypt'],
        );

        // Store in sessionStorage
        const jwk = await crypto.subtle.exportKey('jwk', key);
        sessionStorage.setItem(KEY_STORE, JSON.stringify(jwk));

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
