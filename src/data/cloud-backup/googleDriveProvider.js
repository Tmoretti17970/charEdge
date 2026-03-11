// ═══════════════════════════════════════════════════════════════════
// Cloud Backup — Google Drive Provider
//
// OAuth2 implicit flow, drive.file scope.
// All data encrypted with AES-256-GCM before uploading.
// ═══════════════════════════════════════════════════════════════════

import { GOOGLE_CLIENT_ID, BACKUP_EXTENSION } from './cloudBackupConstants.js';

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
 * @param {Function} onSuccess — callback with { token, expiry, provider }
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function googleConnect(onSuccess) {
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
            onSuccess({
              token: accessToken,
              expiry: Date.now() + expiresIn * 1000,
              provider: 'google-drive',
            });
            resolve({ ok: true });
          } else {
            const error = params.get('error') || 'No access token received';
            resolve({ ok: false, error });
          }
        }
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) {
        // Cross-origin — popup hasn't redirected yet, keep polling
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
 * Ensure the /charEdge/ folder exists in Google Drive.
 */
async function _ensureFolder(token) {
  if (_googleFolderId) return _googleFolderId;

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${GOOGLE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!searchRes.ok) throw new Error(`Google Drive search failed: ${searchRes.status}`);
  const searchData = await searchRes.json();

  if (searchData.files?.length > 0) {
    _googleFolderId = searchData.files[0].id;
    return _googleFolderId;
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: GOOGLE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });

  if (!createRes.ok) throw new Error(`Google Drive folder creation failed: ${createRes.status}`);
  const folder = await createRes.json();
  _googleFolderId = folder.id;
  return _googleFolderId;
}

/**
 * Upload a blob to Google Drive.
 */
export async function googleUpload(blob, filename, token) {
  const folderId = await _ensureFolder(token);

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${filename}' and '${folderId}' in parents and trashed=false`)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const searchData = await searchRes.json();
  const existingId = searchData.files?.[0]?.id;

  if (existingId) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
        body: blob,
      }
    );
    if (!res.ok) throw new Error(`Google Drive update failed: ${res.status}`);
    return res.json();
  }

  const metadata = { name: filename, parents: [folderId], mimeType: 'application/octet-stream' };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
  );

  if (!res.ok) throw new Error(`Google Drive upload failed: ${res.status}`);
  return res.json();
}

/**
 * Download a file from Google Drive by name.
 */
export async function googleDownload(filename, token) {
  const folderId = await _ensureFolder(token);

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${filename}' and '${folderId}' in parents and trashed=false`)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const searchData = await searchRes.json();

  if (!searchData.files?.length) {
    throw new Error(`File "${filename}" not found in Google Drive`);
  }

  const fileId = searchData.files[0].id;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) throw new Error(`Google Drive download failed: ${res.status}`);
  return res.blob();
}

/**
 * List backup files in Google Drive.
 */
export async function googleListBackups(token) {
  const folderId = await _ensureFolder(token);

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents and trashed=false`)}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc`,
    { headers: { Authorization: `Bearer ${token}` } }
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

/** Reset cached folder ID (for disconnect) */
export function googleResetFolderCache() {
  _googleFolderId = null;
}
