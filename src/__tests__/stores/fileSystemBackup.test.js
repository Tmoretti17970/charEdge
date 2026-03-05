// ═══════════════════════════════════════════════════════════════════
// charEdge — Tests for File System Backup & Encryption
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── DataEncryption Tests ──────────────────────────────────────

describe('DataEncryption', () => {
  // Web Crypto is available in Node 20+ via globalThis.crypto
  const hasCrypto = typeof globalThis.crypto?.subtle !== 'undefined';

  it('module exports expected functions', async () => {
    const mod = await import('../../utils/DataEncryption.ts');
    expect(typeof mod.encryptData).toBe('function');
    expect(typeof mod.decryptData).toBe('function');
    expect(typeof mod.isEncryptionSupported).toBe('function');
  });

  it('isEncryptionSupported returns boolean', async () => {
    const { isEncryptionSupported } = await import('../../utils/DataEncryption.ts');
    expect(typeof isEncryptionSupported()).toBe('boolean');
  });

  it.skipIf(!hasCrypto)('round-trip encrypt/decrypt preserves data', async () => {
    const { encryptData, decryptData } = await import('../../utils/DataEncryption.ts');

    const original = {
      trades: [{ id: 't1', symbol: 'AAPL', pnl: 150.25 }],
      notes: ['Entry looked good', 'Market was choppy'],
      nested: { deep: { value: 42 } },
    };
    const passphrase = 'MyStr0ng!Pa$$w0rd';

    const encrypted = await encryptData(original, passphrase);
    expect(encrypted).toBeInstanceOf(Blob);
    expect(encrypted.size).toBeGreaterThan(28); // salt(16) + iv(12) + at least some ciphertext

    const decrypted = await decryptData(encrypted, passphrase);
    expect(decrypted).toEqual(original);
  });

  it.skipIf(!hasCrypto)('wrong passphrase throws', async () => {
    const { encryptData, decryptData } = await import('../../utils/DataEncryption.ts');

    const data = { secret: 'hello world' };
    const encrypted = await encryptData(data, 'correctPassword');

    await expect(decryptData(encrypted, 'wrongPassword')).rejects.toThrow();
  });

  it.skipIf(!hasCrypto)('empty object round-trips', async () => {
    const { encryptData, decryptData } = await import('../../utils/DataEncryption.ts');

    const original = {};
    const passphrase = 'test123';

    const encrypted = await encryptData(original, passphrase);
    const decrypted = await decryptData(encrypted, passphrase);
    expect(decrypted).toEqual(original);
  });

  it.skipIf(!hasCrypto)('large array round-trips', async () => {
    const { encryptData, decryptData } = await import('../../utils/DataEncryption.ts');

    const original = Array.from({ length: 1000 }, (_, i) => ({
      id: `trade_${i}`,
      symbol: 'BTC-USDT',
      pnl: Math.random() * 1000 - 500,
      date: new Date(2025, 0, 1 + i).toISOString(),
    }));
    const passphrase = 'bulk_test!';

    const encrypted = await encryptData(original, passphrase);
    const decrypted = await decryptData(encrypted, passphrase);
    expect(decrypted).toEqual(original);
    expect(decrypted.length).toBe(1000);
  });

  it.skipIf(!hasCrypto)('different encryptions produce different blobs (random salt/iv)', async () => {
    const { encryptData } = await import('../../utils/DataEncryption.ts');

    const data = { test: true };
    const passphrase = 'same';

    const blob1 = await encryptData(data, passphrase);
    const blob2 = await encryptData(data, passphrase);

    // Same data + same passphrase should produce different ciphertext (random salt + iv)
    const buf1 = new Uint8Array(await blob1.arrayBuffer());
    const buf2 = new Uint8Array(await blob2.arrayBuffer());

    // The salt (first 16 bytes) should differ
    const salt1 = buf1.slice(0, 16);
    const salt2 = buf2.slice(0, 16);
    const saltsMatch = salt1.every((b, i) => b === salt2[i]);
    expect(saltsMatch).toBe(false);
  });

  it('rejects corrupted data', async () => {
    const { decryptData } = await import('../../utils/DataEncryption.ts');
    const tinyBlob = new Blob([new Uint8Array(10)]); // Too short
    await expect(decryptData(tinyBlob, 'pass')).rejects.toThrow(/too short/);
  });
});

// ─── FileSystemBackup Tests ────────────────────────────────────

describe('FileSystemBackup', () => {
  it('module exports expected functions', async () => {
    const mod = await import('../../data/FileSystemBackup.js');
    expect(typeof mod.isFileSystemAccessSupported).toBe('function');
    expect(typeof mod.pickBackupFolder).toBe('function');
    expect(typeof mod.restoreBackupHandle).toBe('function');
    expect(typeof mod.runBackup).toBe('function');
    expect(typeof mod.restoreFromBackup).toBe('function');
    expect(typeof mod.startAutoSave).toBe('function');
    expect(typeof mod.stopAutoSave).toBe('function');
    expect(typeof mod.downloadBackup).toBe('function');
    expect(typeof mod.uploadAndRestore).toBe('function');
    expect(typeof mod.getBackupStatus).toBe('function');
    expect(typeof mod.disconnectBackup).toBe('function');
  });

  it('isFileSystemAccessSupported returns false in Node', async () => {
    const { isFileSystemAccessSupported } = await import('../../data/FileSystemBackup.js');
    expect(isFileSystemAccessSupported()).toBe(false);
  });

  it('pickBackupFolder returns error when unsupported', async () => {
    const { pickBackupFolder } = await import('../../data/FileSystemBackup.js');
    const result = await pickBackupFolder();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not supported');
  });

  it('restoreBackupHandle returns false when unsupported', async () => {
    const { restoreBackupHandle } = await import('../../data/FileSystemBackup.js');
    const result = await restoreBackupHandle();
    expect(result).toBe(false);
  });

  it('runBackup returns error when no folder selected', async () => {
    const { runBackup } = await import('../../data/FileSystemBackup.js');
    const result = await runBackup();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('No backup folder');
  });

  it('restoreFromBackup returns error when no folder selected', async () => {
    const { restoreFromBackup } = await import('../../data/FileSystemBackup.js');
    const result = await restoreFromBackup();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('No backup folder');
  });

  it('getBackupStatus reflects initial state', async () => {
    const { getBackupStatus } = await import('../../data/FileSystemBackup.js');
    const status = getBackupStatus();
    expect(status.isConfigured).toBe(false);
    expect(status.folderName).toBeNull();
    expect(status.isAutoSaving).toBe(false);
    expect(status.lastBackup).toBeNull();
    expect(status.backupCount).toBe(0);
  });

  it('startAutoSave returns error when no folder', async () => {
    const { startAutoSave } = await import('../../data/FileSystemBackup.js');
    const result = startAutoSave();
    expect(result.ok).toBe(false);
  });

  describe('uploadAndRestore', () => {
    it('rejects invalid backup format', async () => {
      const { uploadAndRestore } = await import('../../data/FileSystemBackup.js');
      const badFile = new File(['{"random": true}'], 'bad.json', { type: 'application/json' });
      const result = await uploadAndRestore(badFile);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Invalid backup file format');
    });

    it('rejects non-JSON file', async () => {
      const { uploadAndRestore } = await import('../../data/FileSystemBackup.js');
      const badFile = new File(['not json at all'], 'bad.txt', { type: 'text/plain' });
      const result = await uploadAndRestore(badFile);
      expect(result.ok).toBe(false);
    });

    it('accepts valid backup format and restores data', async () => {
      const { uploadAndRestore } = await import('../../data/FileSystemBackup.js');

      const validBackup = {
        _meta: { version: '11.0.0', format: 'charEdge-backup-v1', exportedAt: '2026-02-28' },
        trades: [
          { id: 't1', symbol: 'AAPL', pnl: 100, date: '2026-01-15' },
          { id: 't2', symbol: 'TSLA', pnl: -50, date: '2026-01-16' },
        ],
        playbooks: [{ id: 'p1', name: 'Momentum' }],
        notes: [],
        tradePlans: [],
        settings: {},
        localStorage: {},
      };

      const file = new File([JSON.stringify(validBackup)], 'backup.json', {
        type: 'application/json',
      });

      const result = await uploadAndRestore(file);
      expect(result.ok).toBe(true);
      expect(result.restored).toContain('trades (2)');
      expect(result.restored).toContain('playbooks (1)');
    });
  });
});

// ─── Integration-style Tests ───────────────────────────────────

describe('Backup Integration', () => {
  const hasDOM = typeof document !== 'undefined';

  it.skipIf(!hasDOM)('downloadBackup creates valid JSON bundle', async () => {
    const { downloadBackup } = await import('../../data/FileSystemBackup.js');

    // Mock document.createElement to capture the download
    const mockA = { href: '', download: '', click: vi.fn() };
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') return mockA;
      return origCreateElement(tag);
    });
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();

    const result = await downloadBackup();
    expect(result.ok).toBe(true);
    expect(mockA.click).toHaveBeenCalled();
    expect(mockA.download).toMatch(/^charEdge-backup-/);

    // Cleanup
    URL.createObjectURL = originalCreateObjectURL;
    vi.restoreAllMocks();
  });
});
