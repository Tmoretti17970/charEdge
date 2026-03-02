// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — StorageAdapter (Sprint 7)
//
// I1.1: Abstract storage behind a provider interface so IndexedDB
//       and Supabase are interchangeable.
// I1.2: Supabase auth shell (email/password + OAuth).
// I1.3: Optimistic writes with last-write-wins conflict resolution.
//
// Architecture:
//   StorageAdapter wraps the existing MiniDB-based StorageService
//   and adds a cloud sync layer. Writes are always local-first
//   (optimistic) and sync to Supabase in the background.
//
// Usage:
//   import { storageAdapter } from './StorageAdapter.js';
//   await storageAdapter.trades.put(trade);  // writes local + queues sync
//   await storageAdapter.sync();             // push/pull with cloud
// ═══════════════════════════════════════════════════════════════════

import StorageService from './StorageService.js';
import SecureStore from '../utils/SecureStore.js';

// ─── I1.2: Auth State ───────────────────────────────────────────

const AUTH_KEY = 'charEdge-auth';

const _authState = {
  user: null,
  session: null,
  supabaseUrl: '',
  supabaseKey: '',
  isAuthenticated: false,
  provider: 'local', // 'local' | 'supabase'
  _tokenExpiresAt: 0, // epoch ms when access_token expires
};

/** Load persisted auth from SecureStore (encrypted localStorage) */
async function _loadAuth() {
  try {
    const saved = await SecureStore.loadAndDecrypt(AUTH_KEY);
    if (saved) {
      Object.assign(_authState, saved);
      // Re-encrypt if this was legacy plain-text data (migration)
      if (!saved._f) await _saveAuth();
    }
  } catch {
    /* ignore */
  }
}

/** Persist auth to SecureStore (encrypted localStorage) */
async function _saveAuth() {
  try {
    await SecureStore.encryptAndStore(AUTH_KEY, {
      user: _authState.user,
      session: _authState.session,
      supabaseUrl: _authState.supabaseUrl,
      supabaseKey: _authState.supabaseKey,
      isAuthenticated: _authState.isAuthenticated,
      provider: _authState.provider,
      _tokenExpiresAt: _authState._tokenExpiresAt,
    });
  } catch {
    /* ignore */
  }
}

// ─── I1.2: Auth API ─────────────────────────────────────────────

/**
 * Configure Supabase connection.
 * Call this from Settings page when user enters their Supabase credentials.
 */
async function configureSupabase(url, anonKey) {
  _authState.supabaseUrl = url;
  _authState.supabaseKey = anonKey;
  await _saveAuth();
}

/**
 * Sign in with email/password via Supabase Auth REST API.
 * No Supabase SDK dependency — uses raw fetch.
 */
async function signIn(email, password) {
  if (!_authState.supabaseUrl || !_authState.supabaseKey) {
    return { ok: false, error: 'Supabase not configured. Set URL and anon key in Settings.' };
  }

  try {
    const res = await fetch(`${_authState.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: _authState.supabaseKey,
      },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err.error_description || err.msg || `Auth failed (${res.status})` };
    }

    const data = await res.json();
    _authState.user = data.user;
    _authState.session = { access_token: data.access_token, refresh_token: data.refresh_token };
    _authState.isAuthenticated = true;
    _authState.provider = 'supabase';
    // Track token expiry (Supabase returns expires_in in seconds)
    _authState._tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    await _saveAuth();

    return { ok: true, user: data.user };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Sign up with email/password.
 */
async function signUp(email, password) {
  if (!_authState.supabaseUrl || !_authState.supabaseKey) {
    return { ok: false, error: 'Supabase not configured.' };
  }

  try {
    const res = await fetch(`${_authState.supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: _authState.supabaseKey,
      },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err.error_description || err.msg || `Signup failed (${res.status})` };
    }

    const data = await res.json();
    return { ok: true, user: data.user || data, message: 'Check email for confirmation link.' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Sign out — clear session, revert to local-only mode.
 */
async function signOut() {
  _authState.user = null;
  _authState.session = null;
  _authState.isAuthenticated = false;
  _authState.provider = 'local';
  _authState._tokenExpiresAt = 0;
  await _saveAuth();
  // Clear sync queue
  _syncQueue.length = 0;
}

// ─── Token Lifecycle Management ─────────────────────────────────

/** Check if the current access token is expired or about to expire (5 min buffer) */
function _isTokenExpired() {
  if (!_authState._tokenExpiresAt) return true;
  return Date.now() >= _authState._tokenExpiresAt - 5 * 60 * 1000; // 5-min pre-emptive refresh
}

/**
 * Refresh the access token using the refresh_token.
 * Supabase Auth REST API: POST /auth/v1/token?grant_type=refresh_token
 */
async function _refreshToken() {
  if (!_authState.supabaseUrl || !_authState.supabaseKey) return false;
  const refreshToken = _authState.session?.refresh_token;
  if (!refreshToken) return false;

  try {
    const res = await fetch(
      `${_authState.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: _authState.supabaseKey,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
    );

    if (!res.ok) {
      console.warn('[StorageAdapter] Token refresh failed:', res.status);
      return false;
    }

    const data = await res.json();
    _authState.session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    };
    _authState._tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    await _saveAuth();
    return true;
  } catch (e) {
    console.warn('[StorageAdapter] Token refresh error:', e.message);
    return false;
  }
}

function getAuth() {
  return { ..._authState };
}

function isCloudEnabled() {
  return _authState.isAuthenticated && _authState.provider === 'supabase';
}

// ─── I1.3: Sync Queue (Optimistic Writes) ───────────────────────

/**
 * Sync queue stores pending writes that haven't been pushed to cloud.
 * Format: { table, op, data, timestamp }
 * Persisted in localStorage so writes survive page refresh.
 */
const SYNC_QUEUE_KEY = 'charEdge-sync-queue';
let _syncQueue = [];
let _syncing = false;
let _lastSyncTime = 0;

function _loadSyncQueue() {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    if (raw) _syncQueue = JSON.parse(raw);
  } catch {
    _syncQueue = [];
  }
}

function _saveSyncQueue() {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(_syncQueue));
  } catch (err) {
    // Handle localStorage quota exceeded error
    if (err?.name === 'QuotaExceededError' || err?.code === 22) {
      console.warn('[StorageAdapter] localStorage quota exceeded, trimming sync queue');
      // Keep only the most recent 250 items
      _syncQueue = _syncQueue.slice(-250);
      try {
        localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(_syncQueue));
      } catch {
        // If still too big, clear the queue entirely to prevent data loss on new writes
        console.error('[StorageAdapter] Sync queue too large even after trim, clearing');
        _syncQueue = [];
        localStorage.removeItem(SYNC_QUEUE_KEY);
      }
    }
  }
}

const SYNC_QUEUE_MAX = 500;

function _enqueue(table, op, data) {
  if (!isCloudEnabled()) return;

  // Cap queue size to prevent unbounded growth
  if (_syncQueue.length >= SYNC_QUEUE_MAX) {
    // Drop oldest items to make room
    const overflow = _syncQueue.length - SYNC_QUEUE_MAX + 1;
    _syncQueue.splice(0, overflow);
    console.warn(`[StorageAdapter] Sync queue at capacity (${SYNC_QUEUE_MAX}), dropped ${overflow} oldest items`);
  }

  _syncQueue.push({ table, op, data, ts: Date.now() });
  _saveSyncQueue();
  // Auto-sync after short delay (debounce)
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => sync(), 2000);
}

let _syncTimer = null;

// ─── I1.3: Supabase REST Helpers ────────────────────────────────

async function _supabaseRequest(method, table, body = null, query = '') {
  // Pre-emptive token refresh if expired or about to expire
  if (_isTokenExpired()) {
    await _refreshToken();
  }

  const url = `${_authState.supabaseUrl}/rest/v1/${table}${query}`;
  const headers = {
    apikey: _authState.supabaseKey,
    Authorization: `Bearer ${_authState.session?.access_token}`,
    'Content-Type': 'application/json',
    Prefer: method === 'POST' ? 'resolution=merge-duplicates' : 'return=minimal',
  };

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  let res = await fetch(url, opts);

  // Retry once on 401 (token may have been revoked server-side)
  if (res.status === 401) {
    const refreshed = await _refreshToken();
    if (refreshed) {
      opts.headers.Authorization = `Bearer ${_authState.session?.access_token}`;
      res = await fetch(url, opts);
    }
  }

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Supabase ${method} ${table}: ${res.status} ${err}`);
  }

  if (method === 'GET') return res.json();
  return null;
}

// ─── I1.3: Sync Engine ──────────────────────────────────────────

/**
 * Push queued writes to Supabase, then pull latest from cloud.
 * Uses last-write-wins conflict resolution:
 *   - Local writes include a `_updatedAt` timestamp
 *   - On conflict (same id), the later timestamp wins
 *   - Supabase upsert with `on_conflict=id` handles this server-side
 *
 * @returns {{ ok: boolean, pushed: number, pulled: number, errors: string[] }}
 */
async function sync() {
  if (!isCloudEnabled() || _syncing) return { ok: true, pushed: 0, pulled: 0, errors: [] };
  _syncing = true;
  const errors = [];
  let pushed = 0;
  let pulled = 0;

  try {
    // ─── PUSH: Send queued writes ───────────────────────
    const queue = [..._syncQueue];
    for (const item of queue) {
      try {
        const record = { ...item.data, _updatedAt: new Date(item.ts).toISOString() };
        // Add user_id for RLS
        if (_authState.user?.id) record.user_id = _authState.user.id;

        if (item.op === 'delete') {
          await _supabaseRequest('DELETE', item.table, null, `?id=eq.${item.data.id}`);
        } else {
          // Upsert (POST with merge-duplicates)
          await _supabaseRequest('POST', item.table, record);
        }
        pushed++;
      } catch (e) {
        errors.push(`Push ${item.table}/${item.op}: ${e.message}`);
      }
    }

    // Clear processed items from queue
    if (pushed > 0) {
      _syncQueue = _syncQueue.slice(queue.length);
      _saveSyncQueue();
    }

    // ─── PULL: Fetch latest from cloud ──────────────────
    // Only pull records updated after our last sync
    const since = _lastSyncTime ? `&_updatedAt=gte.${new Date(_lastSyncTime).toISOString()}` : '';

    for (const table of ['trades', 'playbooks', 'notes']) {
      try {
        const userFilter = _authState.user?.id
          ? `?user_id=eq.${_authState.user.id}${since.replace('&', '&')}`
          : `?select=*${since}`;

        const remote = await _supabaseRequest('GET', table, null, userFilter);
        if (!remote?.length) continue;

        // Last-write-wins merge: compare _updatedAt timestamps
        const local = await StorageService[table].getAll();
        const localMap = new Map();
        if (local.ok) {
          for (const item of local.data) {
            localMap.set(item.id, item);
          }
        }

        const toWrite = [];
        for (const remoteItem of remote) {
          const localItem = localMap.get(remoteItem.id);
          if (!localItem) {
            // New from cloud
            toWrite.push(remoteItem);
          } else {
            // Conflict: compare timestamps
            const remoteTime = new Date(remoteItem._updatedAt || 0).getTime();
            const localTime = new Date(localItem._updatedAt || 0).getTime();
            if (remoteTime > localTime) {
              toWrite.push(remoteItem); // Cloud wins
            }
            // else: local wins (already there)
          }
        }

        if (toWrite.length > 0) {
          if (StorageService[table].bulkPut) {
            await StorageService[table].bulkPut(toWrite);
          } else {
            for (const item of toWrite) {
              await StorageService[table].put(item);
            }
          }
          pulled += toWrite.length;
        }
      } catch (e) {
        errors.push(`Pull ${table}: ${e.message}`);
      }
    }

    _lastSyncTime = Date.now();
  } finally {
    _syncing = false;
  }

  return { ok: errors.length === 0, pushed, pulled, errors };
}

/** Get sync status for UI display */
function getSyncStatus() {
  return {
    isCloudEnabled: isCloudEnabled(),
    pending: _syncQueue.length,
    syncing: _syncing,
    lastSync: _lastSyncTime ? new Date(_lastSyncTime).toISOString() : null,
  };
}

// ─── I1.1: StorageAdapter (Wraps StorageService + Sync) ─────────

/**
 * StorageAdapter proxies all reads through local StorageService
 * and enqueues writes for cloud sync when authenticated.
 *
 * This is the single interface all stores should use instead of
 * importing StorageService directly.
 */
const storageAdapter = {
  trades: {
    async getAll() {
      return StorageService.trades.getAll();
    },
    async put(trade) {
      const result = await StorageService.trades.put(trade);
      if (result.ok) _enqueue('trades', 'upsert', trade);
      return result;
    },
    async bulkPut(trades) {
      const result = await StorageService.trades.bulkPut(trades);
      if (result.ok) {
        for (const t of trades) _enqueue('trades', 'upsert', t);
      }
      return result;
    },
    async delete(id) {
      const result = await StorageService.trades.delete(id);
      if (result.ok) _enqueue('trades', 'delete', { id });
      return result;
    },
    async count() {
      return StorageService.trades.count();
    },
    async clear() {
      return StorageService.trades.clear();
    },
    async replaceAll(trades) {
      const result = await StorageService.trades.replaceAll(trades);
      // Full replace: enqueue all as upserts
      if (result.ok) {
        for (const t of trades) _enqueue('trades', 'upsert', t);
      }
      return result;
    },
  },

  playbooks: {
    async getAll() {
      return StorageService.playbooks.getAll();
    },
    async put(pb) {
      const result = await StorageService.playbooks.put(pb);
      if (result.ok) _enqueue('playbooks', 'upsert', pb);
      return result;
    },
    async delete(id) {
      const result = await StorageService.playbooks.delete(id);
      if (result.ok) _enqueue('playbooks', 'delete', { id });
      return result;
    },
    async replaceAll(items) {
      const result = await StorageService.playbooks.replaceAll(items);
      if (result.ok) {
        for (const item of items) _enqueue('playbooks', 'upsert', item);
      }
      return result;
    },
  },

  notes: {
    async getAll() {
      return StorageService.notes.getAll();
    },
    async put(note) {
      const result = await StorageService.notes.put(note);
      if (result.ok) _enqueue('notes', 'upsert', note);
      return result;
    },
    async delete(id) {
      const result = await StorageService.notes.delete(id);
      if (result.ok) _enqueue('notes', 'delete', { id });
      return result;
    },
    async replaceAll(items) {
      const result = await StorageService.notes.replaceAll(items);
      if (result.ok) {
        for (const item of items) _enqueue('notes', 'upsert', item);
      }
      return result;
    },
  },

  tradePlans: {
    async getAll() {
      return StorageService.tradePlans.getAll();
    },
    async put(plan) {
      const result = await StorageService.tradePlans.put(plan);
      if (result.ok) _enqueue('tradePlans', 'upsert', plan);
      return result;
    },
    async delete(id) {
      const result = await StorageService.tradePlans.delete(id);
      if (result.ok) _enqueue('tradePlans', 'delete', { id });
      return result;
    },
    async replaceAll(items) {
      const result = await StorageService.tradePlans.replaceAll(items);
      if (result.ok) {
        for (const item of items) _enqueue('tradePlans', 'upsert', item);
      }
      return result;
    },
  },

  settings: {
    async get(key) {
      return StorageService.settings.get(key);
    },
    async set(key, value) {
      return StorageService.settings.set(key, value);
    },
    async getAll() {
      return StorageService.settings.getAll();
    },
  },

  async clearAll() {
    return StorageService.clearAll();
  },
  async checkQuota() {
    return StorageService.checkQuota();
  },
  async getTradesBySymbol(sym) {
    return StorageService.getTradesBySymbol(sym);
  },
  async getTradesByDateRange(from, to) {
    return StorageService.getTradesByDateRange(from, to);
  },
};

// ─── Initialize ─────────────────────────────────────────────────

// _loadAuth is now async — call it and let it resolve in the background.
// The sync queue loads synchronously, auth state resolves shortly after page load.
_loadAuth().catch((err) => {
  console.warn('[StorageAdapter] Auth load failed:', err?.message);
});
_loadSyncQueue();

// ─── Exports ────────────────────────────────────────────────────

export {
  storageAdapter,
  // Auth
  configureSupabase,
  signIn,
  signUp,
  signOut,
  getAuth,
  isCloudEnabled,
  // Sync
  sync,
  getSyncStatus,
};

export default storageAdapter;
