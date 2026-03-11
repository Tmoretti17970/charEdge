// ═══════════════════════════════════════════════════════════════════
// charEdge — File System Backup
//
// Uses the File System Access API to auto-save ALL user data to a
// real folder on the user's computer. Falls back to download/upload
// for browsers that don't support the API (Firefox, Safari).
//
// Data backed up:
//   • trades, playbooks, notes, trade plans, settings (StorageService)
//   • annotations/drawings (useAnnotationStore)
//   • chart templates (localStorage)
//   • drawing styles (localStorage)
//
// File format: Individual JSON files per data type, plus a _meta.json
// with version info and timestamp.
// ═══════════════════════════════════════════════════════════════════

import StorageService from './StorageService';
import { logger } from '@/observability/logger';

// ─── Configuration ─────────────────────────────────────────────
const BACKUP_INTERVAL_MS = 60_000; // 1 minute auto-save
const HANDLE_STORAGE_KEY = 'charEdge-fs-backup-handle';
const META_FILENAME = '_meta.json';
const APP_VERSION = '11.0.0';

// LocalStorage keys that hold user data worth backing up
const LS_BACKUP_KEYS = [
  'charEdge-annotations',
  'charEdge-chart-templates',
  'charEdge-chart-sessions',
  'charEdge-chart-colors',
  'charEdge-quick-styles',
  'charEdge-tool-style-memory',
  'charEdge-toolbar-position',
];

// ─── State ─────────────────────────────────────────────────────
let _dirHandle = null;
let _autoSaveInterval = null;
let _lastBackupTime = null;
let _backupCount = 0;

// ─── Feature Detection ────────────────────────────────────────
/**
 * Check if the File System Access API is supported.
 * @returns {boolean}
 */
export function isFileSystemAccessSupported() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

// ─── Folder Picker ─────────────────────────────────────────────

/**
 * Prompt the user to pick a backup folder.
 * Stores the directory handle in IndexedDB for persistence across sessions.
 * @returns {Promise<{ ok: boolean, path?: string, error?: string }>}
 */
export async function pickBackupFolder() {
  if (!isFileSystemAccessSupported()) {
    return { ok: false, error: 'File System Access API not supported in this browser' };
  }

  try {
    _dirHandle = await window.showDirectoryPicker({
      id: 'charEdge-backup',
      mode: 'readwrite',
      startIn: 'documents',
    });

    // Persist the handle via IndexedDB (can't use localStorage for FileSystemDirectoryHandle)
    await _persistHandle(_dirHandle);

    return { ok: true, path: _dirHandle.name };
  } catch (e) {
    if (e.name === 'AbortError') {
      return { ok: false, error: 'Folder selection cancelled' };
    }
    return { ok: false, error: e.message };
  }
}

/**
 * Try to restore a previously saved directory handle.
 * Returns true if a valid handle was restored and permission is still granted.
 * @returns {Promise<boolean>}
 */
export async function restoreBackupHandle() {
  if (!isFileSystemAccessSupported()) return false;

  try {
    const handle = await _loadHandle();
    if (!handle) return false;

    // Check if we still have permission
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      _dirHandle = handle;
      return true;
    }

    // In some browsers, we can request permission without a user gesture
    // if the handle was recently used. Otherwise this will fail silently.
    try {
      const newPerm = await handle.requestPermission({ mode: 'readwrite' });
      if (newPerm === 'granted') {
        _dirHandle = handle;
        return true;
      }
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) {
      // Permission denied or requires user gesture — expected
    }

    return false;
  // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (_) {
    return false;
  }
}

// ─── Backup ────────────────────────────────────────────────────

/**
 * Run a full backup of all user data to the selected folder.
 * @returns {Promise<{ ok: boolean, files?: number, error?: string }>}
 */
export async function runBackup() {
  if (!_dirHandle) {
    return { ok: false, error: 'No backup folder selected' };
  }

  try {
    // Verify permission is still valid
    const perm = await _dirHandle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') {
      return { ok: false, error: 'Permission to backup folder revoked' };
    }

    // ─── Gather all data ───────────────────────────────────
    const [trades, playbooks, notes, tradePlans, settings] = await Promise.all([
      StorageService.trades.getAll(),
      StorageService.playbooks.getAll(),
      StorageService.notes.getAll(),
      StorageService.tradePlans.getAll(),
      StorageService.settings.getAll(),
    ]);

    // Gather localStorage data (annotations, drawing styles, templates)
    const localStorageData = {};
    for (const key of LS_BACKUP_KEYS) {
      try {
        const val = localStorage.getItem(key);
        if (val !== null) {
          localStorageData[key] = JSON.parse(val);
        }
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (_) {
        // Malformed JSON — skip
      }
    }

    // ─── Write files ───────────────────────────────────────
    let filesWritten = 0;

    const writeJobs = [
      _writeJSON('trades.json', trades.data || []),
      _writeJSON('playbooks.json', playbooks.data || []),
      _writeJSON('notes.json', notes.data || []),
      _writeJSON('tradePlans.json', tradePlans.data || []),
      _writeJSON('settings.json', settings.data || {}),
      _writeJSON('localStorage.json', localStorageData),
      _writeJSON(META_FILENAME, {
        version: APP_VERSION,
        exportedAt: new Date().toISOString(),
        tradeCount: trades.data?.length || 0,
        playbookCount: playbooks.data?.length || 0,
        noteCount: notes.data?.length || 0,
        tradePlanCount: tradePlans.data?.length || 0,
        localStorageKeys: Object.keys(localStorageData),
      }),
    ];

    await Promise.all(writeJobs);
    filesWritten = writeJobs.length;

    _lastBackupTime = Date.now();
    _backupCount++;

    return { ok: true, files: filesWritten };
  } catch (e) {
    logger.data.error('[FileSystemBackup] Backup failed:', e);
    return { ok: false, error: e.message };
  }
}

/**
 * Restore all user data from the backup folder.
 * @returns {Promise<{ ok: boolean, restored?: string[], error?: string }>}
 */
export async function restoreFromBackup() {
  if (!_dirHandle) {
    return { ok: false, error: 'No backup folder selected' };
  }

  try {
    const restored = [];

    // ─── Read all backup files ─────────────────────────────
    const trades = await _readJSON('trades.json');
    const playbooks = await _readJSON('playbooks.json');
    const notes = await _readJSON('notes.json');
    const tradePlans = await _readJSON('tradePlans.json');
    const settings = await _readJSON('settings.json');
    const lsData = await _readJSON('localStorage.json');

    // ─── Restore to StorageService (IDB) ───────────────────
    if (trades?.length) {
      await StorageService.trades.replaceAll(trades);
      restored.push(`trades (${trades.length})`);
    }
    if (playbooks?.length) {
      await StorageService.playbooks.replaceAll(playbooks);
      restored.push(`playbooks (${playbooks.length})`);
    }
    if (notes?.length) {
      await StorageService.notes.replaceAll(notes);
      restored.push(`notes (${notes.length})`);
    }
    if (tradePlans?.length) {
      await StorageService.tradePlans.replaceAll(tradePlans);
      restored.push(`tradePlans (${tradePlans.length})`);
    }
    if (settings && typeof settings === 'object') {
      for (const [key, value] of Object.entries(settings)) {
        await StorageService.settings.set(key, value);
      }
      restored.push(`settings (${Object.keys(settings).length} keys)`);
    }

    // ─── Restore localStorage data ─────────────────────────
    if (lsData && typeof lsData === 'object') {
      for (const [key, value] of Object.entries(lsData)) {
        try {
          localStorage.setItem(key, JSON.stringify(value));
        // eslint-disable-next-line unused-imports/no-unused-vars
        } catch (_) {
          // Quota exceeded — skip
        }
      }
      restored.push(`localStorage (${Object.keys(lsData).length} keys)`);
    }

    return { ok: true, restored };
  } catch (e) {
    logger.data.error('[FileSystemBackup] Restore failed:', e);
    return { ok: false, error: e.message };
  }
}

// ─── Auto-Save ─────────────────────────────────────────────────

/**
 * Start the auto-save interval. Backs up every BACKUP_INTERVAL_MS.
 * @returns {{ ok: boolean }}
 */
export function startAutoSave() {
  if (_autoSaveInterval) return { ok: true }; // Already running
  if (!_dirHandle) return { ok: false, error: 'No backup folder' };

  _autoSaveInterval = setInterval(() => {
    runBackup().catch((e) => {
      logger.data.warn('[FileSystemBackup] Auto-save failed:', e);
    });
  }, BACKUP_INTERVAL_MS);

  // Run initial backup immediately
  runBackup().catch(() => {});

  return { ok: true };
}

/**
 * Stop the auto-save interval.
 */
export function stopAutoSave() {
  if (_autoSaveInterval) {
    clearInterval(_autoSaveInterval);
    _autoSaveInterval = null;
  }
}

// ─── Fallback: Manual Download/Upload ──────────────────────────

/**
 * Fallback for browsers without File System Access API.
 * Downloads a single JSON file containing ALL user data.
 * @returns {Promise<{ ok: boolean }>}
 */
export async function downloadBackup() {
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
      } catch (_) { /* storage may be blocked */ }
    }

    const bundle = {
      _meta: {
        version: APP_VERSION,
        exportedAt: new Date().toISOString(),
        format: 'charEdge-backup-v1',
      },
      trades: trades.data || [],
      playbooks: playbooks.data || [],
      notes: notes.data || [],
      tradePlans: tradePlans.data || [],
      settings: settings.data || {},
      localStorage: localStorageData,
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `charEdge-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Fallback for browsers without File System Access API.
 * Upload and restore from a previously downloaded backup JSON.
 * @param {File} file — the .json backup file
 * @returns {Promise<{ ok: boolean, restored?: string[], error?: string }>}
 */
export async function uploadAndRestore(file) {
  try {
    const text = await file.text();
    const bundle = JSON.parse(text);

    if (!bundle._meta || bundle._meta.format !== 'charEdge-backup-v1') {
      return { ok: false, error: 'Invalid backup file format' };
    }

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
        // eslint-disable-next-line unused-imports/no-unused-vars
        } catch (_) { /* storage may be blocked */ }
      }
      restored.push(`localStorage (${Object.keys(bundle.localStorage).length} keys)`);
    }

    return { ok: true, restored };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ─── Status / Getters ──────────────────────────────────────────

/**
 * Get current backup status.
 * @returns {{ isConfigured: boolean, folderName: string|null, isAutoSaving: boolean, lastBackup: number|null, backupCount: number }}
 */
export function getBackupStatus() {
  return {
    isConfigured: _dirHandle !== null,
    folderName: _dirHandle?.name ?? null,
    isAutoSaving: _autoSaveInterval !== null,
    lastBackup: _lastBackupTime,
    backupCount: _backupCount,
  };
}

/**
 * Disconnect from the backup folder and stop auto-save.
 */
export function disconnectBackup() {
  stopAutoSave();
  _dirHandle = null;
  _removeHandle();
}

// ─── Internal Helpers ──────────────────────────────────────────

/** Write a JSON object to a file in the backup folder */
async function _writeJSON(filename, data) {
  const fileHandle = await _dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

/** Read a JSON file from the backup folder. Returns null if file doesn't exist. */
async function _readJSON(filename) {
  try {
    const fileHandle = await _dirHandle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (_) {
    return null; // File doesn't exist yet
  }
}

/** Persist directory handle to IndexedDB */
async function _persistHandle(handle) {
  try {
    // Use a dedicated tiny IDB store for the handle
    const db = await _openHandleDB();
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put({ key: HANDLE_STORAGE_KEY, handle });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    logger.data.warn('[FileSystemBackup] Failed to persist handle:', e);
  }
}

/** Load directory handle from IndexedDB */
async function _loadHandle() {
  try {
    const db = await _openHandleDB();
    const tx = db.transaction('handles', 'readonly');
    const req = tx.objectStore('handles').get(HANDLE_STORAGE_KEY);
    const row = await new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    return row?.handle ?? null;
  // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (_) {
    return null;
  }
}

/** Remove persisted handle */
async function _removeHandle() {
  try {
    const db = await _openHandleDB();
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').delete(HANDLE_STORAGE_KEY);
  // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (_) {
    // Ignore
  }
}

/** Open or create the tiny IDB database for storing file handles */
function _openHandleDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('charEdge-fs-handles', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('handles')) {
        db.createObjectStore('handles', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
