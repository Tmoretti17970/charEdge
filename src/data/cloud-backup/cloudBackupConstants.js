// ═══════════════════════════════════════════════════════════════════
// Cloud Backup — Shared Constants & Config
// ═══════════════════════════════════════════════════════════════════

export const APP_VERSION = '11.0.0';
export const BACKUP_EXTENSION = '.tfbackup';
export const TOKEN_STORAGE_KEY = 'charEdge-cloud-token';
export const PROVIDER_STORAGE_KEY = 'charEdge-cloud-provider';
export const PASSPHRASE_VALIDATED_KEY = 'charEdge-cloud-passphrase-set';

// LocalStorage keys worth backing up (same list as FileSystemBackup)
export const LS_BACKUP_KEYS = [
  'charEdge-annotations',
  'charEdge-chart-templates',
  'charEdge-chart-sessions',
  'charEdge-chart-colors',
  'charEdge-quick-styles',
  'charEdge-tool-style-memory',
  'charEdge-toolbar-position',
];

// OAuth Client IDs
// Replace these with your registered client IDs before going live.
export const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
export const DROPBOX_CLIENT_ID = 'YOUR_DROPBOX_CLIENT_ID';
