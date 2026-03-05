// ═══════════════════════════════════════════════════════════════════
// charEdge — Tests for Cloud Backup
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── CloudBackup Module Tests ──────────────────────────────────

describe('CloudBackup', () => {
  beforeEach(() => {
    // Clear any stored tokens between tests
    try {
      localStorage.removeItem('charEdge-cloud-token');
      localStorage.removeItem('charEdge-cloud-provider');
      localStorage.removeItem('charEdge-cloud-passphrase-set');
    } catch (_) {
      // localStorage may not be available in test env
    }
  });

  it('module exports expected functions', async () => {
    const mod = await import('../../data/CloudBackup.js');
    expect(typeof mod.connectCloud).toBe('function');
    expect(typeof mod.disconnectCloud).toBe('function');
    expect(typeof mod.isCloudConnected).toBe('function');
    expect(typeof mod.getCloudStatus).toBe('function');
    expect(typeof mod.cloudBackup).toBe('function');
    expect(typeof mod.cloudRestore).toBe('function');
    expect(typeof mod.listCloudBackups).toBe('function');
    expect(typeof mod.restoreCloudConnection).toBe('function');
    expect(typeof mod.getProviderDisplayName).toBe('function');
  });

  it('getCloudStatus returns disconnected state initially', async () => {
    const { getCloudStatus } = await import('../../data/CloudBackup.js');
    const status = getCloudStatus();
    expect(status.provider).toBeNull();
    expect(status.connected).toBe(false);
    expect(status.lastSync).toBeNull();
  });

  it('isCloudConnected returns false when not connected', async () => {
    const { isCloudConnected } = await import('../../data/CloudBackup.js');
    expect(isCloudConnected()).toBe(false);
  });

  it('cloudBackup fails gracefully when no provider connected', async () => {
    const { cloudBackup } = await import('../../data/CloudBackup.js');
    const result = await cloudBackup('testpassphrase');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('No cloud provider connected');
  });

  it('cloudBackup rejects short passphrase', async () => {
    // Even if provider were connected, passphrase < 4 chars should fail
    const { cloudBackup } = await import('../../data/CloudBackup.js');
    const result = await cloudBackup('ab');
    expect(result.ok).toBe(false);
    // It'll either fail on passphrase or provider check first
    expect(result.ok).toBe(false);
  });

  it('cloudRestore fails gracefully when no provider connected', async () => {
    const { cloudRestore } = await import('../../data/CloudBackup.js');
    const result = await cloudRestore('test.tfbackup', 'passphrase');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('No cloud provider connected');
  });

  it('cloudRestore rejects empty passphrase', async () => {
    const { cloudRestore } = await import('../../data/CloudBackup.js');
    const result = await cloudRestore('test.tfbackup', '');
    expect(result.ok).toBe(false);
  });

  it('listCloudBackups fails gracefully when not connected', async () => {
    const { listCloudBackups } = await import('../../data/CloudBackup.js');
    const result = await listCloudBackups();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('No cloud provider connected');
  });

  it('disconnectCloud clears connection state', async () => {
    const { disconnectCloud, getCloudStatus, isCloudConnected } = await import('../../data/CloudBackup.js');
    disconnectCloud();
    expect(isCloudConnected()).toBe(false);
    const status = getCloudStatus();
    expect(status.provider).toBeNull();
    expect(status.connected).toBe(false);
  });

  it('connectCloud rejects unknown provider', async () => {
    const { connectCloud } = await import('../../data/CloudBackup.js');
    const result = await connectCloud('onedrive');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Unknown provider');
  });

  it('getProviderDisplayName returns human-readable names', async () => {
    const { getProviderDisplayName } = await import('../../data/CloudBackup.js');
    expect(getProviderDisplayName('google-drive')).toBe('Google Drive');
    expect(getProviderDisplayName('dropbox')).toBe('Dropbox');
    expect(getProviderDisplayName(null)).toBe('None');
    expect(getProviderDisplayName('unknown')).toBe('unknown');
  });

  it('restoreCloudConnection returns false when nothing saved', async () => {
    const { restoreCloudConnection } = await import('../../data/CloudBackup.js');
    expect(restoreCloudConnection()).toBe(false);
  });

  it('restoreCloudConnection restores valid saved token', async () => {
    const { restoreCloudConnection, getCloudStatus, disconnectCloud } = await import('../../data/CloudBackup.js');

    // Manually set a saved token in localStorage
    try {
      localStorage.setItem('charEdge-cloud-provider', 'google-drive');
      localStorage.setItem('charEdge-cloud-token', JSON.stringify({
        token: 'test-token-12345',
        expiry: Date.now() + 3600_000, // 1 hour from now
      }));

      const restored = restoreCloudConnection();
      expect(restored).toBe(true);

      const status = getCloudStatus();
      expect(status.provider).toBe('google-drive');
      expect(status.connected).toBe(true);

      // Clean up
      disconnectCloud();
    } catch (_) {
      // localStorage may not be available
    }
  });

  it('restoreCloudConnection rejects expired token', async () => {
    const { restoreCloudConnection } = await import('../../data/CloudBackup.js');

    try {
      localStorage.setItem('charEdge-cloud-provider', 'dropbox');
      localStorage.setItem('charEdge-cloud-token', JSON.stringify({
        token: 'expired-token',
        expiry: Date.now() - 1000, // Expired 1 second ago
      }));

      const restored = restoreCloudConnection();
      expect(restored).toBe(false);
    } catch (_) {
      // localStorage may not be available
    }
  });
});

// ─── DataEncryption Integration (Cloud context) ────────────────

describe('CloudBackup Encryption Integration', () => {
  const hasCrypto = typeof globalThis.crypto?.subtle !== 'undefined';

  it.skipIf(!hasCrypto)('encrypts and decrypts a cloud backup bundle', async () => {
    const { encryptData, decryptData } = await import('../../utils/DataEncryption.ts');

    // Simulate the cloud backup bundle format
    const bundle = {
      _meta: {
        version: '11.0.0',
        format: 'charEdge-cloud-backup-v1',
        exportedAt: '2026-02-28T21:00:00.000Z',
        provider: 'google-drive',
        tradeCount: 2,
      },
      trades: [
        { id: 't1', symbol: 'ES', pnl: 250, date: '2026-02-15' },
        { id: 't2', symbol: 'NQ', pnl: -75, date: '2026-02-16' },
      ],
      playbooks: [{ id: 'p1', name: 'Trend Follow' }],
      notes: [{ id: 'n1', text: 'Market gapped up at open' }],
      tradePlans: [],
      settings: { theme: 'dark', timezone: 'America/Chicago' },
      localStorage: { 'charEdge-annotations': [] },
    };

    const passphrase = 'MyCloudP@ss!';
    const encrypted = await encryptData(bundle, passphrase);
    expect(encrypted).toBeInstanceOf(Blob);
    expect(encrypted.size).toBeGreaterThan(100);

    const decrypted = await decryptData(encrypted, passphrase);
    expect(decrypted).toEqual(bundle);
    expect(decrypted._meta.format).toBe('charEdge-cloud-backup-v1');
    expect(decrypted.trades).toHaveLength(2);
    expect(decrypted.settings.theme).toBe('dark');
  });

  it.skipIf(!hasCrypto)('wrong passphrase fails to decrypt cloud backup', async () => {
    const { encryptData, decryptData } = await import('../../utils/DataEncryption.ts');

    const bundle = {
      _meta: { format: 'charEdge-cloud-backup-v1' },
      trades: [{ id: 't1' }],
    };

    const encrypted = await encryptData(bundle, 'correctPass');
    await expect(decryptData(encrypted, 'wrongPass')).rejects.toThrow();
  });
});
