// ═══════════════════════════════════════════════════════════════════
// charEdge — Encrypted Persist Storage (1A.2)
//
// Custom Zustand persist storage adapter wrapping EncryptedStore.
// Implements { getItem, setItem, removeItem } for Zustand's persist()
// middleware, routing data through AES-256-GCM encrypted IndexedDB.
//
// Usage in a Zustand store:
//   import { encryptedPersistStorage } from './encryptedPersistStorage.js';
//
//   const useMyStore = create(
//     persist(stateCreator, {
//       name: 'my-store',
//       storage: encryptedPersistStorage('trades'),
//     })
//   );
//
// Migration: On first load, checks localStorage for existing plain-text
// data, migrates it to encrypted IndexedDB, then removes the localStorage
// entry. Silent auto-migration with console logging.
// ═══════════════════════════════════════════════════════════════════

import { encryptedStore } from './EncryptedStore.js';
import { logger } from '@/observability/logger';

/**
 * Create a Zustand-compatible persist storage adapter backed by
 * EncryptedStore (AES-256-GCM IndexedDB).
 *
 * @param {string} storeName - IndexedDB object store name
 *   ('journal', 'trades', 'settings', 'apikeys')
 * @returns {{ getItem, setItem, removeItem }}
 */
export function encryptedPersistStorage(storeName) {
    return {
        /**
         * Load persisted state from encrypted IndexedDB.
         * Falls back to localStorage migration on first load.
         * @param {string} name - Zustand persist key
         * @returns {Promise<object|null>}
         */
        async getItem(name) {
            try {
                await encryptedStore.init();

                // 1. Try encrypted IndexedDB first
                const encrypted = await encryptedStore.get(storeName, name);
                if (encrypted !== null && encrypted !== undefined) {
                    return encrypted;
                }

                // 2. Check localStorage for legacy plain-text data (migration)
                let legacy = null;
                try {
                    const raw = localStorage.getItem(name);
                    if (raw) {
                        legacy = JSON.parse(raw);
                    }
                } catch { /* SSR or private mode */ }

                if (legacy !== null) {
                    // Migrate: write to encrypted store, remove from localStorage
                    logger.data.info(
                        `[EncryptedPersist] Migrating "${name}" from localStorage → encrypted IndexedDB`
                    );
                    await encryptedStore.put(storeName, name, legacy);
                    try {
                        localStorage.removeItem(name);
                    } catch { /* SSR */ }
                    return legacy;
                }

                return null;
            } catch (err) {
                logger.data.warn(`[EncryptedPersist] getItem("${name}") failed:`, err?.message);
                // Graceful fallback: try localStorage as read-only backup
                try {
                    const raw = localStorage.getItem(name);
                    return raw ? JSON.parse(raw) : null;
                } catch {
                    return null;
                }
            }
        },

        /**
         * Persist state to encrypted IndexedDB.
         * @param {string} name - Zustand persist key
         * @param {object} value - State to persist
         */
        async setItem(name, value) {
            try {
                await encryptedStore.init();
                await encryptedStore.put(storeName, name, value);
            } catch (err) {
                logger.data.warn(`[EncryptedPersist] setItem("${name}") failed:`, err?.message);
                // Fallback: try localStorage (degraded mode — NO ENCRYPTION)
                logger.data.warn(
                    `[EncryptedPersist] ⚠️ Falling back to UNENCRYPTED localStorage for "${name}". ` +
                    'Data will NOT be encrypted at rest. Ensure IndexedDB is available.'
                );
                try {
                    localStorage.setItem(name, JSON.stringify(value));
                } catch { /* quota exceeded */ }
            }
        },

        /**
         * Remove persisted state from encrypted IndexedDB.
         * @param {string} name - Zustand persist key
         */
        async removeItem(name) {
            try {
                await encryptedStore.init();
                await encryptedStore.delete(storeName, name);
            } catch (err) {
                logger.data.warn(`[EncryptedPersist] removeItem("${name}") failed:`, err?.message);
            }
            // Also clean localStorage in case of legacy data
            try {
                localStorage.removeItem(name);
            } catch { /* SSR */ }
        },
    };
}

export default encryptedPersistStorage;
