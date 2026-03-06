// ═══════════════════════════════════════════════════════════════════
// charEdge — Unified Backup Service (Batch 16: 3.1.4)
//
// Merges CloudBackup + FileSystemBackup into a single service with
// a strategy pattern. Eliminates duplicate LS_BACKUP_KEYS and
// provides a unified API for all backup operations.
//
// Strategies:
//   'cloud'      — Google Drive / Dropbox (encrypted, passphrase)
//   'filesystem'  — File System Access API (local folder, auto-save)
//   'download'   — Manual JSON download/upload (fallback)
//
// Usage:
//   import { backupService } from './BackupService.js';
//   await backupService.backup('cloud', { passphrase: 'my-secret' });
//   await backupService.backup('filesystem');
//   await backupService.backup('download');
// ═══════════════════════════════════════════════════════════════════

import { logger } from '../utils/logger.js';

// ─── Shared Backup Keys ─────────────────────────────────────────
// Single source of truth: all localStorage keys worth backing up.
// Previously duplicated in CloudBackup.js and FileSystemBackup.js.

export const LS_BACKUP_KEYS = [
    'charEdge-annotations',
    'charEdge-chart-templates',
    'charEdge-chart-sessions',
    'charEdge-chart-colors',
    'charEdge-quick-styles',
    'charEdge-tool-style-memory',
    'charEdge-alerts',
    'charEdge-settings',
];

// ─── Strategy: Cloud Backup ─────────────────────────────────────

async function _getCloudModule() {
    return import('./CloudBackup.js');
}

const cloudStrategy = {
    /** @param {{ passphrase: string, provider?: string }} opts */
    async backup(opts) {
        const mod = await _getCloudModule();
        return mod.cloudBackup(opts.passphrase);
    },
    /** @param {{ passphrase: string, filename: string }} opts */
    async restore(opts) {
        const mod = await _getCloudModule();
        return mod.cloudRestore(opts.passphrase, opts.filename);
    },
    async list() {
        const mod = await _getCloudModule();
        return mod.listCloudBackups();
    },
    async getStatus() {
        const mod = await _getCloudModule();
        return mod.getCloudStatus();
    },
    /** @param {'google-drive'|'dropbox'} provider */
    async connect(provider) {
        const mod = await _getCloudModule();
        return mod.connectCloud(provider);
    },
    async disconnect() {
        const mod = await _getCloudModule();
        return mod.disconnectCloud();
    },
};

// ─── Strategy: File System Backup ───────────────────────────────

async function _getFsModule() {
    return import('./FileSystemBackup.js');
}

const filesystemStrategy = {
    async backup() {
        const mod = await _getFsModule();
        return mod.runBackup();
    },
    async restore() {
        const mod = await _getFsModule();
        return mod.restoreFromBackup();
    },
    async list() {
        // File system doesn't have a list — return empty
        return { ok: true, backups: [] };
    },
    async getStatus() {
        const mod = await _getFsModule();
        return mod.getBackupStatus();
    },
    async pickFolder() {
        const mod = await _getFsModule();
        return mod.pickBackupFolder();
    },
    async disconnect() {
        const mod = await _getFsModule();
        return mod.disconnectBackup();
    },
    async startAutoSave() {
        const mod = await _getFsModule();
        return mod.startAutoSave();
    },
    async stopAutoSave() {
        const mod = await _getFsModule();
        return mod.stopAutoSave();
    },
    isSupported() {
        return typeof window !== 'undefined'
            && 'showDirectoryPicker' in window;
    },
};

// ─── Strategy: Download Backup ──────────────────────────────────

const downloadStrategy = {
    async backup() {
        const mod = await _getFsModule();
        return mod.downloadBackup();
    },
    /** @param {{ file: File }} opts */
    async restore(opts) {
        const mod = await _getFsModule();
        return mod.uploadAndRestore(opts.file);
    },
    async list() {
        return { ok: true, backups: [] };
    },
    async getStatus() {
        return {
            isConfigured: true,
            folderName: null,
            isAutoSaving: false,
            lastBackup: null,
            backupCount: 0,
        };
    },
    async disconnect() {
        // No-op for download strategy
    },
};

// ─── Unified Backup Service ─────────────────────────────────────

const _strategies = {
    cloud: cloudStrategy,
    filesystem: filesystemStrategy,
    download: downloadStrategy,
};

class BackupService {
    /**
     * Run a backup using the specified strategy.
     * @param {'cloud'|'filesystem'|'download'} strategy
     * @param {object} [opts]
     * @returns {Promise<{ ok: boolean, [key: string]: any }>}
     */
    async backup(strategy, opts = {}) {
        const s = _strategies[strategy];
        if (!s) return { ok: false, error: `Unknown strategy: ${strategy}` };
        try {
            logger.data.info(`[BackupService] Backup via ${strategy}...`);
            return await s.backup(opts);
        } catch (err) {
            logger.data.error(`[BackupService] Backup failed (${strategy}):`, err?.message);
            return { ok: false, error: err?.message || 'Unknown error' };
        }
    }

    /**
     * Restore from a backup using the specified strategy.
     * @param {'cloud'|'filesystem'|'download'} strategy
     * @param {object} [opts]
     * @returns {Promise<{ ok: boolean, [key: string]: any }>}
     */
    async restore(strategy, opts = {}) {
        const s = _strategies[strategy];
        if (!s) return { ok: false, error: `Unknown strategy: ${strategy}` };
        try {
            logger.data.info(`[BackupService] Restore via ${strategy}...`);
            return await s.restore(opts);
        } catch (err) {
            logger.data.error(`[BackupService] Restore failed (${strategy}):`, err?.message);
            return { ok: false, error: err?.message || 'Unknown error' };
        }
    }

    /**
     * List available backups for a strategy.
     * @param {'cloud'|'filesystem'|'download'} strategy
     * @returns {Promise<{ ok: boolean, backups?: Array }>}
     */
    async listBackups(strategy) {
        const s = _strategies[strategy];
        if (!s) return { ok: false, error: `Unknown strategy: ${strategy}` };
        try {
            return await s.list();
        } catch (err) {
            return { ok: false, error: err?.message || 'Unknown error' };
        }
    }

    /**
     * Get status for a strategy.
     * @param {'cloud'|'filesystem'|'download'} strategy
     * @returns {Promise<object>}
     */
    async getStatus(strategy) {
        const s = _strategies[strategy];
        if (!s) return { connected: false, error: `Unknown strategy: ${strategy}` };
        try {
            return await s.getStatus();
        } catch (err) {
            return { connected: false, error: err?.message };
        }
    }

    /**
     * Connect a cloud provider.
     * @param {'google-drive'|'dropbox'} provider
     */
    async connectCloud(provider) {
        return cloudStrategy.connect(provider);
    }

    /**
     * Disconnect from the current backup strategy.
     * @param {'cloud'|'filesystem'|'download'} strategy
     */
    async disconnect(strategy) {
        const s = _strategies[strategy];
        if (!s) return;
        try {
            await s.disconnect();
        } catch (_) { /* swallow */ }
    }

    /**
     * Check if file system backup is supported.
     * @returns {boolean}
     */
    isFileSystemSupported() {
        return filesystemStrategy.isSupported();
    }

    /**
     * Pick a backup folder (filesystem strategy).
     */
    async pickFolder() {
        return filesystemStrategy.pickFolder();
    }

    /**
     * Start auto-save (filesystem strategy).
     */
    async startAutoSave() {
        return filesystemStrategy.startAutoSave();
    }

    /**
     * Stop auto-save (filesystem strategy).
     */
    async stopAutoSave() {
        return filesystemStrategy.stopAutoSave();
    }

    /**
     * Get the shared backup key list.
     * @returns {string[]}
     */
    getBackupKeys() {
        return [...LS_BACKUP_KEYS];
    }
}

// ─── Singleton + Exports ─────────────────────────────────────────

export const backupService = new BackupService();
export { BackupService };
export default backupService;
