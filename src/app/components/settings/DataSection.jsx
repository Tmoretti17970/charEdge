import { useState, useRef, useEffect, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import {
  connectCloud,
  disconnectCloud,
  getCloudStatus,
  cloudBackup,
  cloudRestore,
  listCloudBackups,
  restoreCloudConnection,
  getProviderDisplayName,
} from '../../../data/CloudBackup.js';
import {
  isFileSystemAccessSupported,
  pickBackupFolder,
  restoreBackupHandle,
  runBackup,
  restoreFromBackup,
  startAutoSave,
  stopAutoSave,
  downloadBackup,
  uploadAndRestore,
  getBackupStatus,
  disconnectBackup,
} from '../../../data/FileSystemBackup.js';
import { exportCSV, exportJSON, downloadFile, importFile } from '../../../data/ImportExport.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { radii } from '../../../theme/tokens.js';
import { computeFast } from '../../features/analytics/analyticsFast.js';
import { generateReport, downloadReport } from '../../features/analytics/ReportGenerator.js';
import { Card, Btn, inputStyle } from '../ui/UIKit.jsx';
import { SectionHeader, SettingRow, AlertBanner } from './SettingsHelpers.jsx';

export default function DataSection() {
  const trades = useJournalStore((s) => s.trades);
  const setTrades = useJournalStore((s) => s.setTrades);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [dedupMode, setDedupMode] = useState('skip'); // 'skip' | 'all'
  const lastFileRef = useRef(null);

  // ─── Backup State ──────────────────────────────────────────
  const [backupStatus, setBackupStatus] = useState(getBackupStatus());
  const [backupMsg, setBackupMsg] = useState(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const restoreFileRef = useRef(null);

  // ─── Cloud State ───────────────────────────────────────────
  const [cloudStatus, setCloudStatus] = useState(getCloudStatus());
  const [cloudMsg, setCloudMsg] = useState(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudPassphrase, setCloudPassphrase] = useState('');
  const [cloudBackups, setCloudBackups] = useState([]);
  const [showBackupList, setShowBackupList] = useState(false);

  const refreshBackupStatus = useCallback(() => setBackupStatus(getBackupStatus()), []);
  const refreshCloudStatus = useCallback(() => setCloudStatus(getCloudStatus()), []);

  // Try to restore saved folder handle and cloud connection on mount
  useEffect(() => {
    restoreBackupHandle().then((ok) => {
      if (ok) refreshBackupStatus();
    });
    if (restoreCloudConnection()) {
      refreshCloudStatus();
    }
  }, [refreshBackupStatus, refreshCloudStatus]);

  const handleExportCSV = () => {
    const csv = exportCSV(trades);
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(csv, `charEdge-export-${date}.csv`, 'text/csv');
  };

  const handleExportJSON = () => {
    const json = exportJSON(trades);
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(json, `charEdge-export-${date}.json`, 'application/json');
  };

  const handleExportReport = () => {
    const analytics = computeFast(trades);
    const md = generateReport(trades, analytics, { title: 'charEdge Performance Report' });
    downloadReport(md);
  };

  const runImport = async (file, mode) => {
    setImporting(true);
    setImportResult(null);
    const opts = mode === 'skip' ? { existingTrades: trades } : {};
    const result = await importFile(file, opts);
    setImporting(false);
    if (!result.ok) {
      setImportResult({ ok: false, message: result.error });
      return;
    }
    const parts = [`Detected: ${result.brokerLabel || result.broker}. Found ${result.count} trade${result.count !== 1 ? 's' : ''}`];
    if (result.duplicates > 0) parts.push(`${result.duplicates} duplicate${result.duplicates !== 1 ? 's' : ''} skipped`);
    if (result.skipped > 0) parts.push(`${result.skipped} row${result.skipped !== 1 ? 's' : ''} skipped`);
    setImportResult({
      ok: true,
      message: parts[0] + (parts.length > 1 ? ` (${parts.slice(1).join(', ')})` : '') + '.',
      trades: result.trades,
      broker: result.broker,
      duplicates: result.duplicates || 0,
    });
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    lastFileRef.current = file;
    setDedupMode('skip');
    await runImport(file, 'skip');
  };

  const handleDedupChange = async (mode) => {
    setDedupMode(mode);
    if (lastFileRef.current) {
      await runImport(lastFileRef.current, mode);
    }
  };

  const confirmImport = () => {
    if (!importResult?.trades?.length) return;
    const existing = trades;
    const merged = [...existing, ...importResult.trades];
    setTrades(merged);
    setImportResult({
      ok: true,
      message: `✅ Imported ${importResult.trades.length} trades. Total: ${merged.length}.`,
      trades: null,
    });
    lastFileRef.current = null;
  };

  // ─── Backup Handlers ──────────────────────────────────────
  const handlePickFolder = async () => {
    setBackupBusy(true);
    setBackupMsg(null);
    const result = await pickBackupFolder();
    if (result.ok) {
      setBackupMsg({ ok: true, text: `📁 Backup folder set: ${result.path}` });
      startAutoSave();
    } else {
      setBackupMsg({ ok: false, text: result.error });
    }
    refreshBackupStatus();
    setBackupBusy(false);
  };

  const handleManualBackup = async () => {
    setBackupBusy(true);
    setBackupMsg(null);
    const result = await runBackup();
    if (result.ok) {
      setBackupMsg({ ok: true, text: `✅ Backed up ${result.files} files` });
    } else {
      setBackupMsg({ ok: false, text: result.error });
    }
    refreshBackupStatus();
    setBackupBusy(false);
  };

  const handleRestore = async () => {
    if (!confirm('This will replace ALL current data with the backup. Continue?')) return;
    setBackupBusy(true);
    setBackupMsg(null);
    const result = await restoreFromBackup();
    if (result.ok) {
      setBackupMsg({ ok: true, text: `✅ Restored: ${result.restored.join(', ')}` });
      // Reload trades into the journal store
      window.location.reload();
    } else {
      setBackupMsg({ ok: false, text: result.error });
    }
    setBackupBusy(false);
  };

  const handleToggleAutoSave = () => {
    if (backupStatus.isAutoSaving) {
      stopAutoSave();
      setBackupMsg({ ok: true, text: 'Auto-save stopped' });
    } else {
      const r = startAutoSave();
      setBackupMsg(r.ok ? { ok: true, text: 'Auto-save started (every 60s)' } : { ok: false, text: r.error });
    }
    refreshBackupStatus();
  };

  const handleDisconnect = () => {
    disconnectBackup();
    setBackupMsg({ ok: true, text: 'Backup folder disconnected' });
    refreshBackupStatus();
  };

  // Fallback download/upload
  const handleFallbackDownload = async () => {
    setBackupBusy(true);
    await downloadBackup();
    setBackupMsg({ ok: true, text: '✅ Backup file downloaded' });
    setBackupBusy(false);
  };

  const handleFallbackUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('This will replace ALL current data with the backup file. Continue?')) return;
    setBackupBusy(true);
    const result = await uploadAndRestore(file);
    if (result.ok) {
      setBackupMsg({ ok: true, text: `✅ Restored: ${result.restored.join(', ')}` });
      window.location.reload();
    } else {
      setBackupMsg({ ok: false, text: result.error });
    }
    setBackupBusy(false);
  };

  const fsSupported = isFileSystemAccessSupported();

  // ─── Cloud Handlers ────────────────────────────────────────
  const handleCloudConnect = async (provider) => {
    setCloudBusy(true);
    setCloudMsg(null);
    const result = await connectCloud(provider);
    if (result.ok) {
      setCloudMsg({ ok: true, text: `✅ Connected to ${getProviderDisplayName(provider)}` });
    } else {
      setCloudMsg({ ok: false, text: result.error });
    }
    refreshCloudStatus();
    setCloudBusy(false);
  };

  const handleCloudDisconnect = () => {
    disconnectCloud();
    setCloudMsg({ ok: true, text: 'Cloud provider disconnected' });
    setCloudBackups([]);
    setShowBackupList(false);
    refreshCloudStatus();
  };

  const handleCloudBackup = async () => {
    if (!cloudPassphrase || cloudPassphrase.length < 4) {
      setCloudMsg({ ok: false, text: 'Enter a passphrase (4+ characters) to encrypt your backup' });
      return;
    }
    setCloudBusy(true);
    setCloudMsg(null);
    const result = await cloudBackup(cloudPassphrase);
    if (result.ok) {
      setCloudMsg({ ok: true, text: `✅ Encrypted backup uploaded: ${result.filename}` });
    } else {
      setCloudMsg({ ok: false, text: result.error });
    }
    refreshCloudStatus();
    setCloudBusy(false);
  };

  const handleListBackups = async () => {
    setCloudBusy(true);
    setCloudMsg(null);
    const result = await listCloudBackups();
    if (result.ok) {
      setCloudBackups(result.backups || []);
      setShowBackupList(true);
      if (!result.backups?.length) {
        setCloudMsg({ ok: false, text: 'No backups found in cloud folder' });
      }
    } else {
      setCloudMsg({ ok: false, text: result.error });
    }
    setCloudBusy(false);
  };

  const handleCloudRestore = async (filename) => {
    if (!cloudPassphrase) {
      setCloudMsg({ ok: false, text: 'Enter your passphrase to decrypt the backup' });
      return;
    }
    if (!confirm('This will replace ALL current data with the cloud backup. Continue?')) return;
    setCloudBusy(true);
    setCloudMsg(null);
    const result = await cloudRestore(filename, cloudPassphrase);
    if (result.ok) {
      setCloudMsg({ ok: true, text: `✅ Restored: ${result.restored.join(', ')}` });
      window.location.reload();
    } else {
      setCloudMsg({ ok: false, text: result.error });
    }
    setCloudBusy(false);
  };

  return (
    <section style={{ marginBottom: 40 }}>
      <SectionHeader icon="folder" title="Data" description="Import trades, export backups, and generate reports" />
      <Card style={{ padding: 20 }}>
        {/* Trade count summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: C.sf2, borderRadius: radii.md, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: C.b + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📊</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: M, color: C.t1 }}>{trades.length}</div>
            <div style={{ fontSize: 11, color: C.t3 }}>trade{trades.length !== 1 ? 's' : ''} stored locally</div>
          </div>
        </div>

        {/* Export */}
        <div style={{ fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 10 }}>Export</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <Btn onClick={handleExportCSV} style={{ fontSize: 12, padding: '8px 14px' }}>📥 Export CSV</Btn>
          <Btn onClick={handleExportJSON} style={{ fontSize: 12, padding: '8px 14px' }}>📥 Export JSON</Btn>
          <Btn onClick={handleExportReport} style={{ fontSize: 12, padding: '8px 14px' }}>📊 Performance Report</Btn>
        </div>

        {/* Import */}
        <div style={{ paddingTop: 16, borderTop: `1px solid ${C.bd}` }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 4 }}>Import</div>
          <div style={{ fontSize: 11, color: C.t3, marginBottom: 10, fontFamily: M }}>
            Supports Tradovate, NinjaTrader, ThinkorSwim, TradeStation, IBKR, Robinhood, Webull, MT5, Binance, Coinbase, Kraken, Bybit, Fidelity, or generic CSV/JSON
          </div>
          <SettingRow label="Choose file">
            <input type="file" accept=".csv,.json,.txt" onChange={handleImport} disabled={importing} className="tf-input"
              style={{ fontSize: 12, fontFamily: F, color: C.t2, padding: '8px 0' }} />
          </SettingRow>
          {importing && <div style={{ fontSize: 12, color: C.b, fontFamily: M, marginBottom: 8 }}>Parsing file...</div>}
          {importResult && <AlertBanner ok={importResult.ok} message={importResult.message} />}
          {/* Dedup strategy toggle — shown after successful parse with trades */}
          {importResult?.trades?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.t3, marginBottom: 6 }}>Duplicate handling</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {[
                  { id: 'skip', label: '🛡️ Skip duplicates', hint: 'Default — existing trades are preserved' },
                  { id: 'all', label: '📥 Import all', hint: 'Ignore duplicates, import every row' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleDedupChange(opt.id)}
                    disabled={importing}
                    className="tf-btn"
                    title={opt.hint}
                    style={{
                      fontSize: 11,
                      padding: '6px 12px',
                      borderRadius: radii.md,
                      border: `1px solid ${dedupMode === opt.id ? C.b : C.bd}`,
                      background: dedupMode === opt.id ? C.b + '15' : 'transparent',
                      color: dedupMode === opt.id ? C.b : C.t2,
                      fontWeight: 600,
                      fontFamily: F,
                      cursor: importing ? 'wait' : 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {importResult.duplicates > 0 && (
                <div style={{ fontSize: 11, color: C.w, fontFamily: M, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  ⚠️ {importResult.duplicates} duplicate{importResult.duplicates !== 1 ? 's' : ''} detected
                </div>
              )}
              <Btn onClick={confirmImport} style={{ fontSize: 12, padding: '8px 14px' }}>✅ Confirm Import ({importResult.trades.length} trades)</Btn>
            </div>
          )}
        </div>

        {/* ─── Backup & Sync ────────────────────────────────── */}
        <div style={{ paddingTop: 20, marginTop: 20, borderTop: `1px solid ${C.bd}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>🔒</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>Backup & Sync</div>
              <div style={{ fontSize: 11, color: C.t3, fontFamily: M }}>
                Your data stays on your device. Back up to a folder you control.
              </div>
            </div>
          </div>

          {/* File System Access API — auto-save to folder */}
          {fsSupported ? (
            <div style={{ marginBottom: 12 }}>
              {!backupStatus.isConfigured ? (
                <div>
                  <div style={{ fontSize: 11, color: C.t3, marginBottom: 8, fontFamily: M }}>
                    Pick a folder on your computer. charEdge will auto-save all your data there every 60 seconds.
                    {' '}If the folder is inside Dropbox, OneDrive, or Google Drive — it syncs to the cloud automatically. You own it.
                  </div>
                  <Btn onClick={handlePickFolder} disabled={backupBusy} style={{ fontSize: 12, padding: '8px 16px' }}>
                    📁 Choose Backup Folder
                  </Btn>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: C.sf2, borderRadius: radii.md, marginBottom: 10 }}>
                    <span style={{ fontSize: 14 }}>📁</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: M }}>{backupStatus.folderName}</div>
                      <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
                        {backupStatus.isAutoSaving ? '🟢 Auto-saving every 60s' : '⏸️ Auto-save paused'}
                        {backupStatus.lastBackup && ` · Last: ${new Date(backupStatus.lastBackup).toLocaleTimeString()}`}
                        {backupStatus.backupCount > 0 && ` · ${backupStatus.backupCount} backup${backupStatus.backupCount !== 1 ? 's' : ''} this session`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Btn onClick={handleToggleAutoSave} disabled={backupBusy} style={{ fontSize: 11, padding: '6px 12px' }}>
                      {backupStatus.isAutoSaving ? '⏸️ Pause' : '▶️ Resume'} Auto-Save
                    </Btn>
                    <Btn onClick={handleManualBackup} disabled={backupBusy} style={{ fontSize: 11, padding: '6px 12px' }}>
                      💾 Backup Now
                    </Btn>
                    <Btn onClick={handleRestore} disabled={backupBusy} style={{ fontSize: 11, padding: '6px 12px' }}>
                      📂 Restore from Backup
                    </Btn>
                    <Btn onClick={handleDisconnect} style={{ fontSize: 11, padding: '6px 12px', color: C.r, borderColor: C.r + '40' }}>
                      ✕ Disconnect
                    </Btn>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Fallback for Firefox/Safari */
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.t3, marginBottom: 8, fontFamily: M }}>
                Your browser doesn't support auto-save to a folder. Use manual backup & restore instead.
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Btn onClick={handleFallbackDownload} disabled={backupBusy} style={{ fontSize: 11, padding: '6px 12px' }}>
                  💾 Download Full Backup
                </Btn>
                <div>
                  <input
                    ref={restoreFileRef}
                    type="file"
                    accept=".json"
                    onChange={handleFallbackUpload}
                    style={{ display: 'none' }}
                  />
                  <Btn onClick={() => restoreFileRef.current?.click()} disabled={backupBusy} style={{ fontSize: 11, padding: '6px 12px' }}>
                    📂 Restore from File
                  </Btn>
                </div>
              </div>
            </div>
          )}

          {backupMsg && (
            <div style={{
              marginTop: 8,
              fontSize: 11,
              fontFamily: M,
              padding: '8px 12px',
              borderRadius: radii.md,
              background: backupMsg.ok ? (C.g + '15') : (C.r + '15'),
              color: backupMsg.ok ? C.g : C.r,
            }}>
              {backupMsg.text}
            </div>
          )}
        </div>

        {/* ─── Cloud Backup ─────────────────────────────────── */}
        <div style={{ paddingTop: 20, marginTop: 20, borderTop: `1px solid ${C.bd}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>☁️</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>Cloud Backup</div>
              <div style={{ fontSize: 11, color: C.t3, fontFamily: M }}>
                Back up to YOUR Google Drive or Dropbox. Encrypted end-to-end — we never see your data.
              </div>
            </div>
          </div>

          {!cloudStatus.connected ? (
            <div>
              <div style={{ fontSize: 11, color: C.t3, marginBottom: 10, fontFamily: M }}>
                Connect your own cloud storage. All backups are encrypted with your passphrase before upload.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn onClick={() => handleCloudConnect('google-drive')} disabled={cloudBusy}
                  style={{ fontSize: 12, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>🔵</span> Connect Google Drive
                </Btn>
                <Btn onClick={() => handleCloudConnect('dropbox')} disabled={cloudBusy}
                  style={{ fontSize: 12, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>🔷</span> Connect Dropbox
                </Btn>
              </div>
            </div>
          ) : (
            <div>
              {/* Connected status bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: C.sf2, borderRadius: radii.md, marginBottom: 10 }}>
                <span style={{ fontSize: 14 }}>{cloudStatus.provider === 'google-drive' ? '🔵' : '🔷'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: M }}>
                    {getProviderDisplayName(cloudStatus.provider)}
                  </div>
                  <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
                    🟢 Connected
                    {cloudStatus.lastSync && ` · Last sync: ${new Date(cloudStatus.lastSync).toLocaleTimeString()}`}
                  </div>
                </div>
              </div>

              {/* Passphrase input */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.t3, marginBottom: 4 }}>Encryption passphrase</div>
                <input
                  type="password"
                  value={cloudPassphrase}
                  onChange={(e) => setCloudPassphrase(e.target.value)}
                  placeholder="Enter passphrase to encrypt/decrypt backups"
                  className="tf-input"
                  style={{
                    ...inputStyle,
                    fontSize: 12,
                    width: '100%',
                    maxWidth: 320,
                    padding: '8px 12px',
                  }}
                />
                <div style={{ fontSize: 10, color: C.t3, fontFamily: M, marginTop: 4 }}>
                  🔐 Remember this passphrase — it's needed to restore your backups
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                <Btn onClick={handleCloudBackup} disabled={cloudBusy} style={{ fontSize: 11, padding: '6px 12px' }}>
                  ☁️ Backup to Cloud
                </Btn>
                <Btn onClick={handleListBackups} disabled={cloudBusy} style={{ fontSize: 11, padding: '6px 12px' }}>
                  📋 List Backups
                </Btn>
                <Btn onClick={handleCloudDisconnect} style={{ fontSize: 11, padding: '6px 12px', color: C.r, borderColor: C.r + '40' }}>
                  ✕ Disconnect
                </Btn>
              </div>

              {/* Backup list */}
              {showBackupList && cloudBackups.length > 0 && (
                <div style={{ marginTop: 8, padding: '10px 14px', background: C.sf2, borderRadius: radii.md }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.t2, marginBottom: 8 }}>Available backups</div>
                  {cloudBackups.map((bk) => (
                    <div
                      key={bk.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 0',
                        borderBottom: `1px solid ${C.bd}`,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.t1, fontFamily: M }}>{bk.name}</div>
                        <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
                          {bk.modified && new Date(bk.modified).toLocaleString()}
                          {bk.size > 0 && ` · ${(bk.size / 1024).toFixed(1)} KB`}
                        </div>
                      </div>
                      <Btn
                        onClick={() => handleCloudRestore(bk.name)}
                        disabled={cloudBusy}
                        style={{ fontSize: 10, padding: '4px 10px' }}
                      >
                        📥 Restore
                      </Btn>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {cloudMsg && (
            <div style={{
              marginTop: 8,
              fontSize: 11,
              fontFamily: M,
              padding: '8px 12px',
              borderRadius: radii.md,
              background: cloudMsg.ok ? (C.g + '15') : (C.r + '15'),
              color: cloudMsg.ok ? C.g : C.r,
            }}>
              {cloudMsg.text}
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}

