// ═══════════════════════════════════════════════════════════════════
// charEdge — Cloud Backup (User-Owned Cloud Storage)
//
// Lets users back up their encrypted data to their OWN Google Drive
// or Dropbox account. Zero server cost — you never see user data.
//
// Decomposed: provider implementations live in ./cloud-backup/.
// ═══════════════════════════════════════════════════════════════════

import {
  APP_VERSION, BACKUP_EXTENSION, TOKEN_STORAGE_KEY,
  PROVIDER_STORAGE_KEY, PASSPHRASE_VALIDATED_KEY, LS_BACKUP_KEYS,
} from './cloud-backup/cloudBackupConstants.js';
import { dropboxConnect, dropboxUpload, dropboxDownload, dropboxListBackups } from './cloud-backup/dropboxProvider.js';
import { googleConnect, googleUpload, googleDownload, googleListBackups, googleResetFolderCache } from './cloud-backup/googleDriveProvider.js';
import { encryptedStore } from './EncryptedStore.js';
import StorageService from './StorageService';
import { logger } from '@/observability/logger';
import { encryptData, decryptData, isEncryptionSupported } from '@/security/DataEncryption';


// ─── State ─────────────────────────────────────────────────────
let _provider = null;
let _token = null;
let _tokenExpiry = null;
let _lastSync = null;

// ═══════════════════════════════════════════════════════════════════
// Provider Dispatch
// ═══════════════════════════════════════════════════════════════════

function _upload(blob, filename) {
  if (_provider === 'google-drive') return googleUpload(blob, filename, _token);
  if (_provider === 'dropbox') return dropboxUpload(blob, filename, _token);
  throw new Error('No cloud provider connected');
}

function _download(filename) {
  if (_provider === 'google-drive') return googleDownload(filename, _token);
  if (_provider === 'dropbox') return dropboxDownload(filename, _token);
  throw new Error('No cloud provider connected');
}

function _listBackups() {
  if (_provider === 'google-drive') return googleListBackups(_token);
  if (_provider === 'dropbox') return dropboxListBackups(_token);
  throw new Error('No cloud provider connected');
}

// ═══════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════

function _handleConnectSuccess({ token, expiry, provider }) {
  _token = token;
  _tokenExpiry = expiry;
  _provider = provider;
  _persistConnection();
}

/**
 * Connect to a cloud provider.
 * @param {'google-drive' | 'dropbox'} provider
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function connectCloud(provider) {
  if (provider === 'google-drive') return googleConnect(_handleConnectSuccess);
  if (provider === 'dropbox') return dropboxConnect(_handleConnectSuccess);
  return { ok: false, error: `Unknown provider: ${provider}` };
}

/**
 * Disconnect from the current cloud provider.
 */
export function disconnectCloud() {
  _token = null;
  _tokenExpiry = null;
  _provider = null;
  googleResetFolderCache();
  _lastSync = null;

  try {
    localStorage.removeItem(PROVIDER_STORAGE_KEY);
    encryptedStore.delete('apikeys', TOKEN_STORAGE_KEY).catch(() => { });
    localStorage.removeItem(PASSPHRASE_VALIDATED_KEY);
  // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (_) {
    // localStorage not available
  }
}

/**
 * Check if a cloud provider is connected and token is valid.
 */
export function isCloudConnected() {
  if (!_token || !_provider) return false;
  if (_tokenExpiry && Date.now() > _tokenExpiry) {
    disconnectCloud();
    return false;
  }
  return true;
}

/**
 * Get current cloud backup status.
 */
export function getCloudStatus() {
  return { provider: _provider, connected: isCloudConnected(), lastSync: _lastSync };
}

/**
 * Run an encrypted cloud backup.
 */
export async function cloudBackup(passphrase) {
  if (!isCloudConnected()) return { ok: false, error: 'No cloud provider connected' };
  if (!passphrase || passphrase.length < 4) return { ok: false, error: 'Passphrase must be at least 4 characters' };
  if (!isEncryptionSupported()) return { ok: false, error: 'Web Crypto API not available in this browser' };

  try {
    const [trades, playbooks, notes, tradePlans, settings] = await Promise.all([
      StorageService.trades.getAll(),
      StorageService.playbooks.getAll(),
      StorageService.notes.getAll(),
      StorageService.tradePlans.getAll(),
      StorageService.settings.getAll(),
    ]);

    const localStorageData = {};
    for (const key of LS_BACKUP_KEYS) {
      try {
        const val = localStorage.getItem(key);
        if (val !== null) localStorageData[key] = JSON.parse(val);
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) { /* skip malformed JSON */ }
    }

    const bundle = {
      _meta: {
        version: APP_VERSION, format: 'charEdge-cloud-backup-v1',
        exportedAt: new Date().toISOString(), provider: _provider,
        tradeCount: trades.data?.length || 0, playbookCount: playbooks.data?.length || 0,
        noteCount: notes.data?.length || 0,
      },
      trades: trades.data || [], playbooks: playbooks.data || [],
      notes: notes.data || [], tradePlans: tradePlans.data || [],
      settings: settings.data || {}, localStorage: localStorageData,
    };

    const encryptedBlob = await encryptData(bundle, passphrase);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `charEdge-backup-${date}${BACKUP_EXTENSION}`;

    await _upload(encryptedBlob, filename);
    _lastSync = Date.now();
    return { ok: true, filename };
  } catch (e) {
    logger.data.error('[CloudBackup] Backup failed:', e);
    return { ok: false, error: e.message };
  }
}

/**
 * List available cloud backups.
 */
export async function listCloudBackups() {
  if (!isCloudConnected()) return { ok: false, error: 'No cloud provider connected' };
  try {
    const backups = await _listBackups();
    return { ok: true, backups };
  } catch (e) {
    logger.data.error('[CloudBackup] List failed:', e);
    return { ok: false, error: e.message };
  }
}

/**
 * Restore from a cloud backup file.
 */
export async function cloudRestore(filename, passphrase) {
  if (!isCloudConnected()) return { ok: false, error: 'No cloud provider connected' };
  if (!passphrase) return { ok: false, error: 'Passphrase required for decryption' };

  try {
    const blob = await _download(filename);
    const bundle = await decryptData(blob, passphrase);

    if (!bundle._meta || bundle._meta.format !== 'charEdge-cloud-backup-v1') {
      return { ok: false, error: 'Invalid backup file format' };
    }

    const restored = [];

    if (bundle.trades?.length) { await StorageService.trades.replaceAll(bundle.trades); restored.push(`trades (${bundle.trades.length})`); }
    if (bundle.playbooks?.length) { await StorageService.playbooks.replaceAll(bundle.playbooks); restored.push(`playbooks (${bundle.playbooks.length})`); }
    if (bundle.notes?.length) { await StorageService.notes.replaceAll(bundle.notes); restored.push(`notes (${bundle.notes.length})`); }
    if (bundle.tradePlans?.length) { await StorageService.tradePlans.replaceAll(bundle.tradePlans); restored.push(`tradePlans (${bundle.tradePlans.length})`); }

    if (bundle.settings && typeof bundle.settings === 'object') {
      for (const [key, value] of Object.entries(bundle.settings)) await StorageService.settings.set(key, value);
      restored.push(`settings (${Object.keys(bundle.settings).length} keys)`);
    }

    if (bundle.localStorage && typeof bundle.localStorage === 'object') {
      for (const [key, value] of Object.entries(bundle.localStorage)) {
        // eslint-disable-next-line unused-imports/no-unused-vars
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* quota exceeded */ }
      }
      restored.push(`localStorage (${Object.keys(bundle.localStorage).length} keys)`);
    }

    _lastSync = Date.now();
    return { ok: true, restored };
  } catch (e) {
    logger.data.error('[CloudBackup] Restore failed:', e);
    if (e.message?.includes('decrypt') || e.name === 'OperationError') {
      return { ok: false, error: 'Decryption failed — wrong passphrase or corrupted file' };
    }
    return { ok: false, error: e.message };
  }
}

/**
 * Try to restore a previously saved cloud connection from localStorage.
 */
export async function restoreCloudConnection() {
  try {
    const savedProvider = localStorage.getItem(PROVIDER_STORAGE_KEY);
    if (!savedProvider) return false;

    const tokenData = await encryptedStore.get('apikeys', TOKEN_STORAGE_KEY);
    if (!tokenData) return false;

    if (tokenData.expiry && Date.now() > tokenData.expiry) {
      await encryptedStore.delete('apikeys', TOKEN_STORAGE_KEY);
      localStorage.removeItem(PROVIDER_STORAGE_KEY);
      return false;
    }

    _provider = savedProvider;
    _token = tokenData.token;
    _tokenExpiry = tokenData.expiry || null;
    return true;
  // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (_) {
    return false;
  }
}

/**
 * Get the display name for a provider.
 */
export function getProviderDisplayName(provider) {
  if (provider === 'google-drive') return 'Google Drive';
  if (provider === 'dropbox') return 'Dropbox';
  return provider || 'None';
}

// ─── Internal Helpers ──────────────────────────────────────────

async function _persistConnection() {
  try {
    localStorage.setItem(PROVIDER_STORAGE_KEY, _provider);
    await encryptedStore.put('apikeys', TOKEN_STORAGE_KEY, { token: _token, expiry: _tokenExpiry });
  // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (_) { /* Storage not available */ }
}
