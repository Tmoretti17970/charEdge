// ═══════════════════════════════════════════════════════════════════
// charEdge — Cloud Backup (User-Owned Cloud Storage)
//
// Lets users back up their encrypted data to their OWN Google Drive
// or Dropbox account. Zero server cost — you never see user data.
//
// Providers:
//   • Google Drive — OAuth2 implicit flow, drive.file scope
//   • Dropbox — OAuth2 PKCE flow (no secret needed)
//
// All data encrypted with AES-256-GCM via DataEncryption.js before
// leaving the browser.
// ═══════════════════════════════════════════════════════════════════

import StorageService from './StorageService.js';
import { encryptData, decryptData, isEncryptionSupported } from '../utils/DataEncryption.js';

// ─── Configuration ─────────────────────────────────────────────
const APP_VERSION = '11.0.0';
const BACKUP_EXTENSION = '.tfbackup';
const TOKEN_STORAGE_KEY = 'charEdge-cloud-token';
const PROVIDER_STORAGE_KEY = 'charEdge-cloud-provider';
const PASSPHRASE_VALIDATED_KEY = 'charEdge-cloud-passphrase-set';

// LocalStorage keys worth backing up (same list as FileSystemBackup)
const LS_BACKUP_KEYS = [
  'charEdge-annotations',
  'charEdge-chart-templates',
  'charEdge-chart-sessions',
  'charEdge-chart-colors',
  'charEdge-quick-styles',
  'charEdge-tool-style-memory',
  'charEdge-toolbar-position',
];

// ─── OAuth Client IDs ──────────────────────────────────────────
// Replace these with your registered client IDs before going live.
// Both are free to register:
//   Google: https://console.cloud.google.com → APIs & Services → Credentials
//   Dropbox: https://www.dropbox.com/developers/apps
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const DROPBOX_CLIENT_ID = 'YOUR_DROPBOX_CLIENT_ID';

// ─── State ─────────────────────────────────────────────────────
let _provider = null;     // 'google-drive' | 'dropbox' | null
let _token = null;        // OAuth access token
let _tokenExpiry = null;  // Token expiry timestamp
let _lastSync = null;     // Last successful sync timestamp

// ═══════════════════════════════════════════════════════════════════
// Google Drive Provider
// ═══════════════════════════════════════════════════════════════════

const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.file';
const GOOGLE_FOLDER_NAME = 'charEdge';

let _googleFolderId = null;

/**
 * Build Google OAuth2 authorization URL (implicit flow — no server).
 */
function _buildGoogleAuthUrl() {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', window.location.origin);
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('scope', GOOGLE_SCOPES);
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('prompt', 'consent');
  return url.toString();
}

/**
 * Connect to Google Drive via OAuth2 popup.
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function _googleConnect() {
  return new Promise((resolve) => {
    const authUrl = _buildGoogleAuthUrl();
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      'google_auth',
      `width=${width},height=${height},left=${left},top=${top},popup=1`
    );

    if (!popup) {
      resolve({ ok: false, error: 'Popup blocked. Please allow popups for this site.' });
      return;
    }

    // Poll for redirect with token in URL hash
    const pollInterval = setInterval(() => {
      try {
        if (!popup || popup.closed) {
          clearInterval(pollInterval);
          resolve({ ok: false, error: 'Authentication cancelled' });
          return;
        }

        const popupUrl = popup.location.href;
        if (popupUrl.startsWith(window.location.origin)) {
          clearInterval(pollInterval);

          const hash = popup.location.hash.substring(1);
          const params = new URLSearchParams(hash);
          const accessToken = params.get('access_token');
          const expiresIn = parseInt(params.get('expires_in') || '3600', 10);

          popup.close();

          if (accessToken) {
            _token = accessToken;
            _tokenExpiry = Date.now() + expiresIn * 1000;
            _provider = 'google-drive';
            _persistConnection();
            resolve({ ok: true });
          } else {
            const error = params.get('error') || 'No access token received';
            resolve({ ok: false, error });
          }
        }
      } catch {
        // Cross-origin — popup hasn't redirected yet, keep polling
      }
    }, 500);

    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      if (popup && !popup.closed) popup.close();
      resolve({ ok: false, error: 'Authentication timed out' });
    }, 300_000);
  });
}

/**
 * Ensure the /charEdge/ folder exists in Google Drive.
 */
async function _googleEnsureFolder() {
  if (_googleFolderId) return _googleFolderId;

  // Search for existing folder
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${GOOGLE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}`,
    { headers: { Authorization: `Bearer ${_token}` } }
  );

  if (!searchRes.ok) throw new Error(`Google Drive search failed: ${searchRes.status}`);
  const searchData = await searchRes.json();

  if (searchData.files?.length > 0) {
    _googleFolderId = searchData.files[0].id;
    return _googleFolderId;
  }

  // Create folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: GOOGLE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!createRes.ok) throw new Error(`Google Drive folder creation failed: ${createRes.status}`);
  const folder = await createRes.json();
  _googleFolderId = folder.id;
  return _googleFolderId;
}

/**
 * Upload a blob to Google Drive.
 */
async function _googleUpload(blob, filename) {
  const folderId = await _googleEnsureFolder();

  // Check if file already exists (update instead of creating duplicate)
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${filename}' and '${folderId}' in parents and trashed=false`)}`,
    { headers: { Authorization: `Bearer ${_token}` } }
  );
  const searchData = await searchRes.json();
  const existingId = searchData.files?.[0]?.id;

  if (existingId) {
    // Update existing file
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${_token}`,
          'Content-Type': 'application/octet-stream',
        },
        body: blob,
      }
    );
    if (!res.ok) throw new Error(`Google Drive update failed: ${res.status}`);
    return res.json();
  }

  // Create new file (multipart upload)
  const metadata = {
    name: filename,
    parents: [folderId],
    mimeType: 'application/octet-stream',
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', blob);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${_token}` },
      body: form,
    }
  );

  if (!res.ok) throw new Error(`Google Drive upload failed: ${res.status}`);
  return res.json();
}

/**
 * Download a file from Google Drive by name.
 */
async function _googleDownload(filename) {
  const folderId = await _googleEnsureFolder();

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${filename}' and '${folderId}' in parents and trashed=false`)}`,
    { headers: { Authorization: `Bearer ${_token}` } }
  );
  const searchData = await searchRes.json();

  if (!searchData.files?.length) {
    throw new Error(`File "${filename}" not found in Google Drive`);
  }

  const fileId = searchData.files[0].id;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${_token}` } }
  );

  if (!res.ok) throw new Error(`Google Drive download failed: ${res.status}`);
  return res.blob();
}

/**
 * List backup files in Google Drive.
 */
async function _googleListBackups() {
  const folderId = await _googleEnsureFolder();

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents and trashed=false`)}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc`,
    { headers: { Authorization: `Bearer ${_token}` } }
  );

  if (!res.ok) throw new Error(`Google Drive list failed: ${res.status}`);
  const data = await res.json();

  return (data.files || [])
    .filter((f) => f.name.endsWith(BACKUP_EXTENSION))
    .map((f) => ({
      name: f.name,
      modified: f.modifiedTime,
      size: parseInt(f.size || '0', 10),
    }));
}

// ═══════════════════════════════════════════════════════════════════
// Dropbox Provider
// ═══════════════════════════════════════════════════════════════════

const DROPBOX_FOLDER = '/charEdge';
let _dropboxCodeVerifier = null;

/**
 * Generate a random code verifier + challenge for PKCE.
 */
function _generatePKCE() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return verifier;
}

async function _sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Build Dropbox OAuth2 PKCE authorization URL (no server secret needed).
 */
async function _buildDropboxAuthUrl() {
  _dropboxCodeVerifier = _generatePKCE();
  const challenge = await _sha256(_dropboxCodeVerifier);

  const url = new URL('https://www.dropbox.com/oauth2/authorize');
  url.searchParams.set('client_id', DROPBOX_CLIENT_ID);
  url.searchParams.set('redirect_uri', window.location.origin);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('token_access_type', 'offline');
  return url.toString();
}

/**
 * Connect to Dropbox via OAuth2 PKCE popup.
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function _dropboxConnect() {
  return new Promise(async (resolve) => {
    const authUrl = await _buildDropboxAuthUrl();
    const width = 500;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      'dropbox_auth',
      `width=${width},height=${height},left=${left},top=${top},popup=1`
    );

    if (!popup) {
      resolve({ ok: false, error: 'Popup blocked. Please allow popups for this site.' });
      return;
    }

    // Poll for redirect with auth code
    const pollInterval = setInterval(async () => {
      try {
        if (!popup || popup.closed) {
          clearInterval(pollInterval);
          resolve({ ok: false, error: 'Authentication cancelled' });
          return;
        }

        const popupUrl = popup.location.href;
        if (popupUrl.startsWith(window.location.origin)) {
          clearInterval(pollInterval);

          const params = new URL(popupUrl).searchParams;
          const code = params.get('code');

          popup.close();

          if (!code) {
            const error = params.get('error_description') || params.get('error') || 'No auth code received';
            resolve({ ok: false, error });
            return;
          }

          // Exchange code for token (PKCE — no server secret needed)
          try {
            const tokenRes = await fetch('https://api.dropboxapi.com/oauth2/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                code,
                grant_type: 'authorization_code',
                client_id: DROPBOX_CLIENT_ID,
                redirect_uri: window.location.origin,
                code_verifier: _dropboxCodeVerifier,
              }),
            });

            if (!tokenRes.ok) {
              const err = await tokenRes.text();
              resolve({ ok: false, error: `Token exchange failed: ${err}` });
              return;
            }

            const tokenData = await tokenRes.json();
            _token = tokenData.access_token;
            _tokenExpiry = tokenData.expires_in
              ? Date.now() + tokenData.expires_in * 1000
              : null;
            _provider = 'dropbox';
            _persistConnection();
            resolve({ ok: true });
          } catch (e) {
            resolve({ ok: false, error: `Token exchange error: ${e.message}` });
          }
        }
      } catch {
        // Cross-origin — popup hasn't redirected yet
      }
    }, 500);

    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      if (popup && !popup.closed) popup.close();
      resolve({ ok: false, error: 'Authentication timed out' });
    }, 300_000);
  });
}

/**
 * Upload a blob to Dropbox.
 */
async function _dropboxUpload(blob, filename) {
  const path = `${DROPBOX_FOLDER}/${filename}`;

  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${_token}`,
      'Dropbox-API-Arg': JSON.stringify({
        path,
        mode: 'overwrite',
        autorename: false,
        mute: true,
      }),
      'Content-Type': 'application/octet-stream',
    },
    body: blob,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Dropbox upload failed: ${err}`);
  }
  return res.json();
}

/**
 * Download a file from Dropbox by name.
 */
async function _dropboxDownload(filename) {
  const path = `${DROPBOX_FOLDER}/${filename}`;

  const res = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${_token}`,
      'Dropbox-API-Arg': JSON.stringify({ path }),
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Dropbox download failed: ${err}`);
  }
  return res.blob();
}

/**
 * List backup files in Dropbox.
 */
async function _dropboxListBackups() {
  // Ensure folder exists by trying to list — create if needed
  let res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: DROPBOX_FOLDER }),
  });

  if (!res.ok) {
    // Folder might not exist — create it
    const createRes = await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: DROPBOX_FOLDER, autorename: false }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      // If it's a conflict (folder already exists), that's fine
      if (!err.includes('conflict')) {
        throw new Error(`Dropbox folder creation failed: ${err}`);
      }
    }

    // Retry listing
    res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: DROPBOX_FOLDER }),
    });

    if (!res.ok) throw new Error(`Dropbox list failed: ${res.status}`);
  }

  const data = await res.json();
  return (data.entries || [])
    .filter((f) => f['.tag'] === 'file' && f.name.endsWith(BACKUP_EXTENSION))
    .map((f) => ({
      name: f.name,
      modified: f.server_modified || f.client_modified,
      size: f.size || 0,
    }));
}

// ═══════════════════════════════════════════════════════════════════
// Provider Dispatch — route calls to the active provider
// ═══════════════════════════════════════════════════════════════════

function _upload(blob, filename) {
  if (_provider === 'google-drive') return _googleUpload(blob, filename);
  if (_provider === 'dropbox') return _dropboxUpload(blob, filename);
  throw new Error('No cloud provider connected');
}

function _download(filename) {
  if (_provider === 'google-drive') return _googleDownload(filename);
  if (_provider === 'dropbox') return _dropboxDownload(filename);
  throw new Error('No cloud provider connected');
}

function _listBackups() {
  if (_provider === 'google-drive') return _googleListBackups();
  if (_provider === 'dropbox') return _dropboxListBackups();
  throw new Error('No cloud provider connected');
}

// ═══════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════

/**
 * Connect to a cloud provider.
 * @param {'google-drive' | 'dropbox'} provider
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function connectCloud(provider) {
  if (provider === 'google-drive') return _googleConnect();
  if (provider === 'dropbox') return _dropboxConnect();
  return { ok: false, error: `Unknown provider: ${provider}` };
}

/**
 * Disconnect from the current cloud provider.
 */
export function disconnectCloud() {
  _token = null;
  _tokenExpiry = null;
  _provider = null;
  _googleFolderId = null;
  _lastSync = null;

  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(PROVIDER_STORAGE_KEY);
    localStorage.removeItem(PASSPHRASE_VALIDATED_KEY);
  } catch {
    // localStorage not available
  }
}

/**
 * Check if a cloud provider is connected and token is valid.
 * @returns {boolean}
 */
export function isCloudConnected() {
  if (!_token || !_provider) return false;
  if (_tokenExpiry && Date.now() > _tokenExpiry) {
    // Token expired
    disconnectCloud();
    return false;
  }
  return true;
}

/**
 * Get current cloud backup status.
 * @returns {{ provider: string|null, connected: boolean, lastSync: number|null }}
 */
export function getCloudStatus() {
  return {
    provider: _provider,
    connected: isCloudConnected(),
    lastSync: _lastSync,
  };
}

/**
 * Run an encrypted cloud backup.
 * Gathers all data, encrypts with passphrase, uploads to cloud.
 *
 * @param {string} passphrase — encryption passphrase
 * @returns {Promise<{ ok: boolean, filename?: string, error?: string }>}
 */
export async function cloudBackup(passphrase) {
  if (!isCloudConnected()) {
    return { ok: false, error: 'No cloud provider connected' };
  }
  if (!passphrase || passphrase.length < 4) {
    return { ok: false, error: 'Passphrase must be at least 4 characters' };
  }
  if (!isEncryptionSupported()) {
    return { ok: false, error: 'Web Crypto API not available in this browser' };
  }

  try {
    // ─── Gather all data ───────────────────────────────────
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
      } catch {
        // Skip malformed JSON
      }
    }

    const bundle = {
      _meta: {
        version: APP_VERSION,
        format: 'charEdge-cloud-backup-v1',
        exportedAt: new Date().toISOString(),
        provider: _provider,
        tradeCount: trades.data?.length || 0,
        playbookCount: playbooks.data?.length || 0,
        noteCount: notes.data?.length || 0,
      },
      trades: trades.data || [],
      playbooks: playbooks.data || [],
      notes: notes.data || [],
      tradePlans: tradePlans.data || [],
      settings: settings.data || {},
      localStorage: localStorageData,
    };

    // ─── Encrypt ───────────────────────────────────────────
    const encryptedBlob = await encryptData(bundle, passphrase);

    // ─── Upload ────────────────────────────────────────────
    const date = new Date().toISOString().slice(0, 10);
    const filename = `charEdge-backup-${date}${BACKUP_EXTENSION}`;

    await _upload(encryptedBlob, filename);
    _lastSync = Date.now();

    return { ok: true, filename };
  } catch (e) {
    console.error('[CloudBackup] Backup failed:', e);
    return { ok: false, error: e.message };
  }
}

/**
 * List available cloud backups.
 * @returns {Promise<{ ok: boolean, backups?: Array, error?: string }>}
 */
export async function listCloudBackups() {
  if (!isCloudConnected()) {
    return { ok: false, error: 'No cloud provider connected' };
  }

  try {
    const backups = await _listBackups();
    return { ok: true, backups };
  } catch (e) {
    console.error('[CloudBackup] List failed:', e);
    return { ok: false, error: e.message };
  }
}

/**
 * Restore from a cloud backup file.
 *
 * @param {string} filename — the backup file to restore
 * @param {string} passphrase — decryption passphrase (must match backup)
 * @returns {Promise<{ ok: boolean, restored?: string[], error?: string }>}
 */
export async function cloudRestore(filename, passphrase) {
  if (!isCloudConnected()) {
    return { ok: false, error: 'No cloud provider connected' };
  }
  if (!passphrase) {
    return { ok: false, error: 'Passphrase required for decryption' };
  }

  try {
    // ─── Download + Decrypt ────────────────────────────────
    const blob = await _download(filename);
    const bundle = await decryptData(blob, passphrase);

    if (!bundle._meta || bundle._meta.format !== 'charEdge-cloud-backup-v1') {
      return { ok: false, error: 'Invalid backup file format' };
    }

    // ─── Restore data ──────────────────────────────────────
    const restored = [];

    if (bundle.trades?.length) {
      await StorageService.trades.replaceAll(bundle.trades);
      restored.push(`trades (${bundle.trades.length})`);
    }
    if (bundle.playbooks?.length) {
      await StorageService.playbooks.replaceAll(bundle.playbooks);
      restored.push(`playbooks (${bundle.playbooks.length})`);
    }
    if (bundle.notes?.length) {
      await StorageService.notes.replaceAll(bundle.notes);
      restored.push(`notes (${bundle.notes.length})`);
    }
    if (bundle.tradePlans?.length) {
      await StorageService.tradePlans.replaceAll(bundle.tradePlans);
      restored.push(`tradePlans (${bundle.tradePlans.length})`);
    }
    if (bundle.settings && typeof bundle.settings === 'object') {
      for (const [key, value] of Object.entries(bundle.settings)) {
        await StorageService.settings.set(key, value);
      }
      restored.push(`settings (${Object.keys(bundle.settings).length} keys)`);
    }

    if (bundle.localStorage && typeof bundle.localStorage === 'object') {
      for (const [key, value] of Object.entries(bundle.localStorage)) {
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch {
          // Quota exceeded — skip
        }
      }
      restored.push(`localStorage (${Object.keys(bundle.localStorage).length} keys)`);
    }

    _lastSync = Date.now();
    return { ok: true, restored };
  } catch (e) {
    console.error('[CloudBackup] Restore failed:', e);
    // Special-case wrong passphrase
    if (e.message?.includes('decrypt') || e.name === 'OperationError') {
      return { ok: false, error: 'Decryption failed — wrong passphrase or corrupted file' };
    }
    return { ok: false, error: e.message };
  }
}

/**
 * Try to restore a previously saved cloud connection from localStorage.
 * @returns {boolean} true if connection successfully restored.
 */
export function restoreCloudConnection() {
  try {
    const savedProvider = localStorage.getItem(PROVIDER_STORAGE_KEY);
    const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);

    if (!savedProvider || !savedToken) return false;

    const tokenData = JSON.parse(savedToken);
    if (tokenData.expiry && Date.now() > tokenData.expiry) {
      // Token expired — clean up
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(PROVIDER_STORAGE_KEY);
      return false;
    }

    _provider = savedProvider;
    _token = tokenData.token;
    _tokenExpiry = tokenData.expiry || null;
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the display name for a provider
 * @param {string} provider
 * @returns {string}
 */
export function getProviderDisplayName(provider) {
  if (provider === 'google-drive') return 'Google Drive';
  if (provider === 'dropbox') return 'Dropbox';
  return provider || 'None';
}

// ─── Internal Helpers ──────────────────────────────────────────

/** Persist connection to localStorage */
function _persistConnection() {
  try {
    localStorage.setItem(PROVIDER_STORAGE_KEY, _provider);
    localStorage.setItem(
      TOKEN_STORAGE_KEY,
      JSON.stringify({ token: _token, expiry: _tokenExpiry })
    );
  } catch {
    // localStorage not available
  }
}
