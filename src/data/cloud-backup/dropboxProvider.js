// ═══════════════════════════════════════════════════════════════════
// Cloud Backup — Dropbox Provider
//
// OAuth2 PKCE flow (no server secret needed).
// All data encrypted with AES-256-GCM before uploading.
// ═══════════════════════════════════════════════════════════════════

import { DROPBOX_CLIENT_ID, BACKUP_EXTENSION } from './cloudBackupConstants.js';

const DROPBOX_FOLDER = '/charEdge';

let _dropboxCodeVerifier = null;

/**
 * Generate a random code verifier for PKCE.
 */
function _generatePKCE() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
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
 * Build Dropbox OAuth2 PKCE authorization URL.
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
 * @param {Function} onSuccess — callback with { token, expiry, provider }
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function dropboxConnect(onSuccess) {
  // eslint-disable-next-line no-async-promise-executor
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
            onSuccess({
              token: tokenData.access_token,
              expiry: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : null,
              provider: 'dropbox',
            });
            resolve({ ok: true });
          } catch (e) {
            resolve({ ok: false, error: `Token exchange error: ${e.message}` });
          }
        }
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) {
        // Cross-origin — popup hasn't redirected yet
      }
    }, 500);

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
export async function dropboxUpload(blob, filename, token) {
  const path = `${DROPBOX_FOLDER}/${filename}`;

  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({ path, mode: 'overwrite', autorename: false, mute: true }),
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
export async function dropboxDownload(filename, token) {
  const path = `${DROPBOX_FOLDER}/${filename}`;

  const res = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
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
export async function dropboxListBackups(token) {
  let res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: DROPBOX_FOLDER }),
  });

  if (!res.ok) {
    const createRes = await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: DROPBOX_FOLDER, autorename: false }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      if (!err.includes('conflict')) {
        throw new Error(`Dropbox folder creation failed: ${err}`);
      }
    }

    res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
