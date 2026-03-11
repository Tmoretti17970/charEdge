// ═══════════════════════════════════════════════════════════════════
// charEdge — Supabase Persistence Service (Task 3.2.10)
//
// Cloud sync layer for user preferences and settings.
// Replaces in-memory Maps with Supabase-backed persistence when
// authenticated. Falls back to localStorage when offline or in demo.
//
// Synced entities:
//   - User preferences (theme, fontSize, accent, layout)
//   - Watchlists
//   - Drawing annotations
//   - Journal entries (metadata only — full text stays local)
//
// Usage:
//   import { persistenceService } from './PersistenceService.js';
//   await persistenceService.save('preferences', { theme: 'deep-sea' });
//   const prefs = await persistenceService.load('preferences');
// ═══════════════════════════════════════════════════════════════════

import { logger } from '@/observability/logger.js';

const LOCAL_PREFIX = 'charEdge-persist-';
const DEBOUNCE_MS = 2000; // Debounce cloud writes to avoid spamming

/**
 * @typedef {'preferences' | 'watchlists' | 'drawings' | 'journal-meta' | 'workspaces'} EntityType
 */

class PersistenceService {
    constructor() {
        /** @type {import('@supabase/supabase-js').SupabaseClient | null} */
        this._supabase = null;
        this._userId = null;
        this._initialized = false;
        /** @type {Map<string, ReturnType<typeof setTimeout>>} */
        this._pendingWrites = new Map();
    }

    /**
     * Initialize with Supabase client and user ID.
     * Call after auth is confirmed.
     *
     * @param {import('@supabase/supabase-js').SupabaseClient | null} client
     * @param {string | null} userId
     */
    async init(client, userId) {
        this._supabase = client;
        this._userId = userId;
        this._initialized = true;

        if (client && userId) {
            logger.store.info('[Persist] Cloud sync enabled', { userId });
        } else {
            logger.store.info('[Persist] Local-only mode');
        }
    }

    /**
     * Save an entity. Writes to localStorage immediately and
     * debounces the Supabase write for cloud sync.
     *
     * @param {EntityType} entity
     * @param {unknown} data
     */
    async save(entity, data) {
        // Always save locally (offline-first)
        this._saveLocal(entity, data);

        // Debounced cloud write
        if (this._supabase && this._userId) {
            this._debouncedCloudWrite(entity, data);
        }
    }

    /**
     * Load an entity. Tries cloud first (if available), falls back to local.
     *
     * @param {EntityType} entity
     * @returns {Promise<unknown>}
     */
    async load(entity) {
        // Try cloud first if available
        if (this._supabase && this._userId) {
            try {
                const cloudData = await this._loadCloud(entity);
                if (cloudData !== null) {
                    // Update local cache with cloud data
                    this._saveLocal(entity, cloudData);
                    return cloudData;
                }
            } catch (err) {
                logger.store.warn(`[Persist] Cloud load failed for ${entity}`, err);
            }
        }

        // Fallback to local
        return this._loadLocal(entity);
    }

    /**
     * Delete an entity from both local and cloud.
     * @param {EntityType} entity
     */
    async delete(entity) {
        this._deleteLocal(entity);

        if (this._supabase && this._userId) {
            try {
                await this._supabase
                    .from('user_data')
                    .delete()
                    .eq('user_id', this._userId)
                    .eq('entity', entity);
            } catch (err) {
                logger.store.warn(`[Persist] Cloud delete failed for ${entity}`, err);
            }
        }
    }

    /**
     * Sync local data to cloud (e.g., after first sign-in).
     * Uploads all locally-stored entities to Supabase.
     */
    async syncLocalToCloud() {
        if (!this._supabase || !this._userId) return;

        const entities = ['preferences', 'watchlists', 'drawings', 'journal-meta', 'workspaces'];
        let synced = 0;

        for (const entity of entities) {
            const localData = this._loadLocal(entity);
            if (localData !== null) {
                try {
                    await this._writeCloud(entity, localData);
                    synced++;
                // eslint-disable-next-line unused-imports/no-unused-vars
                } catch (_) { /* best effort */ }
            }
        }

        logger.store.info(`[Persist] Synced ${synced} entities to cloud`);
    }

    // ─── Private: Local Storage ─────────────────────────────────────

    /** @private */
    _saveLocal(entity, data) {
        try {
            localStorage.setItem(LOCAL_PREFIX + entity, JSON.stringify(data));
        } catch (err) {
            logger.store.warn(`[Persist] Local save failed for ${entity}`, err);
        }
    }

    /** @private */
    _loadLocal(entity) {
        try {
            const raw = localStorage.getItem(LOCAL_PREFIX + entity);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    /** @private */
    _deleteLocal(entity) {
        try {
            localStorage.removeItem(LOCAL_PREFIX + entity);
        } catch { /* ok */ }
    }

    // ─── Private: Cloud (Supabase) ──────────────────────────────────

    /** @private */
    async _loadCloud(entity) {
        const { data, error } = await this._supabase
            .from('user_data')
            .select('data')
            .eq('user_id', this._userId)
            .eq('entity', entity)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            throw error;
        }

        return data?.data ?? null;
    }

    /** @private */
    async _writeCloud(entity, value) {
        const { error } = await this._supabase
            .from('user_data')
            .upsert({
                user_id: this._userId,
                entity,
                data: value,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,entity' });

        if (error) throw error;
    }

    /** @private */
    _debouncedCloudWrite(entity, data) {
        // Cancel pending write for this entity
        const existing = this._pendingWrites.get(entity);
        if (existing) clearTimeout(existing);

        const timeout = setTimeout(async () => {
            try {
                await this._writeCloud(entity, data);
                this._pendingWrites.delete(entity);
            } catch (err) {
                logger.store.warn(`[Persist] Cloud write failed for ${entity}`, err);
            }
        }, DEBOUNCE_MS);

        this._pendingWrites.set(entity, timeout);
    }

    /**
     * Check if cloud sync is available.
     * @returns {boolean}
     */
    get isCloudEnabled() {
        return Boolean(this._supabase && this._userId);
    }
}

// ─── Singleton + Exports ──────────────────────────────────────────

export const persistenceService = new PersistenceService();
export default persistenceService;
