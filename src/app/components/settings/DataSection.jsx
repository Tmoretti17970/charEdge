import React from 'react';
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
import s from './DataSection.module.css';
import StorageDashboard from './StorageDashboard.jsx';
import AutoBackupScheduler from './AutoBackupScheduler.jsx';
import BootWaterfall from './BootWaterfall.jsx';
import PipelineDashboard from './PipelineDashboard.jsx';

// ─── Cloud Sync Card (migrated from IntegrationsSection) ────────
function CloudSyncCard() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [supaUrl, setSupaUrl] = useState('');
  const [supaKey, setSupaKey] = useState('');
  const [authMsg, setAuthMsg] = useState(null);
  const [syncMsg, setSyncMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [auth, setAuth] = useState({ isAuthenticated: false, user: null, supabaseUrl: '', supabaseKey: '' });
  const [syncStatus, setSyncStatus] = useState({ isCloudEnabled: false, pending: 0, lastSync: null });

  useEffect(() => {
    try {
      import('../../../data/StorageAdapter.js').then(mod => {
        setAuth(mod.getAuth());
        setSyncStatus(mod.getSyncStatus());
      });
    } catch { /* */ }
  }, []);

  const handleConfigure = async () => {
    const { configureSupabase, getAuth } = await import('../../../data/StorageAdapter.js');
    configureSupabase(supaUrl.trim(), supaKey.trim());
    setAuth(getAuth());
    setAuthMsg({ ok: true, text: 'Supabase configured.' });
  };
  const handleSignIn = async () => {
    setBusy(true);
    const { signIn } = await import('../../../data/StorageAdapter.js');
    const result = await signIn(email, password);
    setBusy(false);
    setAuthMsg({ ok: result.ok, text: result.ok ? `Signed in as ${result.user?.email}` : result.error });
  };
  const handleSignUp = async () => {
    setBusy(true);
    const { signUp } = await import('../../../data/StorageAdapter.js');
    const result = await signUp(email, password);
    setBusy(false);
    setAuthMsg({ ok: result.ok, text: result.ok ? result.message : result.error });
  };
  const handleSignOut = async () => {
    const { signOut } = await import('../../../data/StorageAdapter.js');
    signOut();
    setAuth({ isAuthenticated: false, user: null, supabaseUrl: '', supabaseKey: '' });
    setAuthMsg({ ok: true, text: 'Signed out. Local-only mode.' });
  };
  const handleSync = async () => {
    setBusy(true);
    const { sync, getSyncStatus } = await import('../../../data/StorageAdapter.js');
    const result = await sync();
    setBusy(false);
    setSyncStatus(getSyncStatus());
    setSyncMsg({ ok: result.ok, text: result.ok ? `Synced: ${result.pushed} pushed, ${result.pulled} pulled.` : `Sync errors: ${result.errors.join(', ')}` });
  };

  return (
    <Card className={s.cloudCardWrap}>
      <div className={s.cloudLabel}>☁️ Cloud Sync</div>
      <div className={s.cloudHint}>Connect your own Supabase project to sync trades across devices. Everything works locally without this.</div>
      {!auth.isAuthenticated ? (
        <>
          <div className={s.formCol}>
            <input type="text" value={supaUrl} onChange={e => setSupaUrl(e.target.value)} placeholder="Supabase Project URL" style={inputStyle} />
            <input type="password" value={supaKey} onChange={e => setSupaKey(e.target.value)} placeholder="Supabase Anon Key" style={inputStyle} />
            <Btn onClick={handleConfigure} disabled={!supaUrl.trim()} style={{ fontSize: 12, padding: '7px 14px', alignSelf: 'flex-start' }}>Configure</Btn>
          </div>
          <div className={s.formColBorder}>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" style={inputStyle} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" style={inputStyle} />
            <div className={s.btnRow}>
              <Btn onClick={handleSignIn} disabled={busy} style={{ fontSize: 12, padding: '8px 14px' }}>{busy ? '...' : 'Sign In'}</Btn>
              <Btn variant="ghost" onClick={handleSignUp} disabled={busy} style={{ fontSize: 12, padding: '8px 14px' }}>Sign Up</Btn>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className={s.statusRowLarge}>
            <div className={s.statusDot} style={{ background: syncStatus.isCloudEnabled ? C.g : C.t3 }} />
            <div style={{ flex: 1 }}>
              <div className={s.authUserLabel}>{auth.user?.email || 'Authenticated'}</div>
              <div className={s.authStatusHint}>
                {syncStatus.pending > 0 ? `${syncStatus.pending} pending writes` : 'All synced'}
                {syncStatus.lastSync && ` · Last sync: ${new Date(syncStatus.lastSync).toLocaleTimeString()}`}
              </div>
            </div>
          </div>
          <div className={s.btnRow}>
            <Btn onClick={handleSync} disabled={busy} style={{ fontSize: 12, padding: '8px 14px' }}>{busy ? 'Syncing...' : '🔄 Sync Now'}</Btn>
            <Btn variant="ghost" onClick={handleSignOut} disabled={false} style={{ fontSize: 12, padding: '8px 14px' }}>Sign Out</Btn>
          </div>
        </>
      )}
      {authMsg && <div className={`${s.authMsg} ${authMsg.ok ? s.authMsgOk : s.authMsgErr}`}>{authMsg.text}</div>}
      {syncMsg && <div className={`${s.syncMsg} ${syncMsg.ok ? s.authMsgOk : s.authMsgErr}`}>{syncMsg.text}</div>}
    </Card>
  );
}

function DataSection() {
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

  // ─── Tab state ─────────────────────────────────────────────
  const [dataTab, setDataTab] = useState('import');
  const DATA_TABS = [
    { id: 'import', label: '📥 Import', hint: 'Bring in trades' },
    { id: 'export', label: '📤 Export', hint: 'CSV, JSON, Reports' },
    { id: 'backup', label: '💾 Backup', hint: 'File & cloud' },
  ];

  return (
    <section className={s.sectionWrap}>
      <SectionHeader icon="folder" title="Data" description="Import trades, export backups, and generate reports" />

      {/* ─── Sub-tab bar ───────────────────────────────────────── */}
      <div className={s.tabBar}>
        {DATA_TABS.map((tab) => {
          const isActive = dataTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setDataTab(tab.id)}
              className={`tf-btn ${s.tabBtn}`}
              data-active={isActive ? 'true' : undefined}
            >
              {tab.label}
              <div className={s.tabHint}>{tab.hint}</div>
            </button>
          );
        })}
      </div>

      <Card className={s.cardWrap}>
        {/* Trade count summary — always visible */}
        <div className={s.statsSummary}>
          <div className={s.statsIcon}>📊</div>
          <div>
            <div className={s.statsCount}>{trades.length}</div>
            <div className={s.statsHint}>trade{trades.length !== 1 ? 's' : ''} stored locally</div>
          </div>
        </div>

        {/* ═══ IMPORT TAB ═══ */}
        {dataTab === 'import' && (
          <div>
            <div className={s.sectionLabel}>Import</div>
            <div className={s.sectionHint}>
              Supports Tradovate, NinjaTrader, ThinkorSwim, TradeStation, IBKR, Robinhood, Webull, MT5, Binance, Coinbase, Kraken, Bybit, Fidelity, or generic CSV/JSON
            </div>
            <SettingRow label="Choose file">
              <input type="file" accept=".csv,.json,.txt" onChange={handleImport} disabled={importing} className="tf-input"
                style={inputStyle} />
            </SettingRow>
            {importing && <div className={s.parseMsg}>Parsing file...</div>}
            {importResult && <AlertBanner ok={importResult.ok} message={importResult.message} />}
            {importResult?.trades?.length > 0 && (
              <div className={s.importWrap}>
                <div className={s.dupLabel}>Duplicate handling</div>
                <div className={s.s4}>
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
                  <div className={s.dupMsg}>
                    ⚠️ {importResult.duplicates} duplicate{importResult.duplicates !== 1 ? 's' : ''} detected
                  </div>
                )}
                <Btn onClick={confirmImport} className={s.s5}>✅ Confirm Import ({importResult.trades.length} trades)</Btn>
              </div>
            )}
          </div>
        )}

        {/* ═══ EXPORT TAB ═══ */}
        {dataTab === 'export' && (
          <div>
            <div className={s.sectionLabelMb10}>Export</div>
            <div className={s.s0}>
              <Btn onClick={handleExportCSV} className={s.s1}>📥 Export CSV</Btn>
              <Btn onClick={handleExportJSON} className={s.s2}>📥 Export JSON</Btn>
              <Btn onClick={handleExportReport} className={s.s3}>📊 Performance Report</Btn>
            </div>
          </div>
        )}

        {/* ═══ BACKUP TAB ═══ */}
        {dataTab === 'backup' && (
          <div>
            {/* ─── File System Backup & Sync ────────────────────── */}
            <div>
              <div className={s.s6}>
                <span className={s.iconEmoji}>🔒</span>
                <div>
                  <div className={s.sectionTitle}>Backup & Sync</div>
                  <div className={s.sectionSubtitle}>
                    Your data stays on your device. Back up to a folder you control.
                  </div>
                </div>
              </div>

              {fsSupported ? (
                <div className={s.wrapMb12}>
                  {!backupStatus.isConfigured ? (
                    <div>
                      <div className={s.sectionHint8}>
                        Pick a folder on your computer. charEdge will auto-save all your data there every 60 seconds.
                        {' '}If the folder is inside Dropbox, OneDrive, or Google Drive — it syncs to the cloud automatically. You own it.
                      </div>
                      <Btn onClick={handlePickFolder} disabled={backupBusy} className={s.s7}>
                        📁 Choose Backup Folder
                      </Btn>
                    </div>
                  ) : (
                    <div>
                      <div className={s.statusPane}>
                        <span className={s.statusIcon}>📁</span>
                        <div style={{ flex: 1 }}>
                          <div className={s.statusTitle}>{backupStatus.folderName}</div>
                          <div className={s.statusSubtitle}>
                            {backupStatus.isAutoSaving ? '🟢 Auto-saving every 60s' : '⏸️ Auto-save paused'}
                            {backupStatus.lastBackup && ` · Last: ${new Date(backupStatus.lastBackup).toLocaleTimeString()}`}
                            {backupStatus.backupCount > 0 && ` · ${backupStatus.backupCount} backup${backupStatus.backupCount !== 1 ? 's' : ''} this session`}
                          </div>
                        </div>
                      </div>
                      <div className={s.s8}>
                        <Btn onClick={handleToggleAutoSave} disabled={backupBusy} className={s.s9}>
                          {backupStatus.isAutoSaving ? '⏸️ Pause' : '▶️ Resume'} Auto-Save
                        </Btn>
                        <Btn onClick={handleManualBackup} disabled={backupBusy} className={s.s10}>
                          💾 Backup Now
                        </Btn>
                        <Btn onClick={handleRestore} disabled={backupBusy} className={s.s11}>
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
                <div className={s.wrapMb12}>
                  <div className={s.sectionHint8}>
                    Your browser doesn't support auto-save to a folder. Use manual backup & restore instead.
                  </div>
                  <div className={s.s12}>
                    <Btn onClick={handleFallbackDownload} disabled={backupBusy} className={s.s13}>
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
                      <Btn onClick={() => restoreFileRef.current?.click()} disabled={backupBusy} className={s.s14}>
                        📂 Restore from File
                      </Btn>
                    </div>
                  </div>
                </div>
              )}

              {backupMsg && (
                <div className={`${s.statusMsg} ${backupMsg.ok ? s.statusMsgOk : s.statusMsgErr}`}>
                  {backupMsg.text}
                </div>
              )}
            </div>

            {/* ─── Cloud Backup ─────────────────────────────────── */}
            <div className={s.cloudDivider}>
              <div className={s.s15}>
                <span className={s.iconEmoji}>☁️</span>
                <div>
                  <div className={s.sectionTitle}>Cloud Backup</div>
                  <div className={s.sectionSubtitle}>
                    Back up to YOUR Google Drive or Dropbox. Encrypted end-to-end — we never see your data.
                  </div>
                </div>
              </div>

              {!cloudStatus.connected ? (
                <div>
                  <div className={s.sectionHint}>
                    Connect your own cloud storage. All backups are encrypted with your passphrase before upload.
                  </div>
                  <div className={s.s16}>
                    <Btn onClick={() => handleCloudConnect('google-drive')} disabled={cloudBusy}
                      className={s.s17}>
                      <span className={s.statusIcon}>🔵</span> Connect Google Drive
                    </Btn>
                    <Btn onClick={() => handleCloudConnect('dropbox')} disabled={cloudBusy}
                      className={s.s18}>
                      <span className={s.statusIcon}>🔷</span> Connect Dropbox
                    </Btn>
                  </div>
                </div>
              ) : (
                <div>
                  <div className={s.statusPaneCloud}>
                    <span className={s.statusIcon}>{cloudStatus.provider === 'google-drive' ? '🔵' : '🔷'}</span>
                    <div style={{ flex: 1 }}>
                      <div className={s.cloudStatusTitle}>
                        {getProviderDisplayName(cloudStatus.provider)}
                      </div>
                      <div className={s.cloudStatusSub}>
                        🟢 Connected
                        {cloudStatus.lastSync && ` · Last sync: ${new Date(cloudStatus.lastSync).toLocaleTimeString()}`}
                      </div>
                    </div>
                  </div>

                  <div className={s.passWrap}>
                    <div className={s.passLabel}>Encryption passphrase</div>
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
                    <div className={s.passHint}>
                      🔐 Remember this passphrase — it's needed to restore your backups
                    </div>
                  </div>

                  <div className={s.s19}>
                    <Btn onClick={handleCloudBackup} disabled={cloudBusy} className={s.s20}>
                      ☁️ Backup to Cloud
                    </Btn>
                    <Btn onClick={handleListBackups} disabled={cloudBusy} className={s.s21}>
                      📋 List Backups
                    </Btn>
                    <Btn onClick={handleCloudDisconnect} style={{ fontSize: 11, padding: '6px 12px', color: C.r, borderColor: C.r + '40' }}>
                      ✕ Disconnect
                    </Btn>
                  </div>

                  {showBackupList && cloudBackups.length > 0 && (
                    <div className={s.backupListWrap}>
                      <div className={s.backupListHeader}>Available backups</div>
                      {cloudBackups.map((bk) => (
                        <div key={bk.name} className={s.backupRow}>
                          <div>
                            <div className={s.backupName}>{bk.name}</div>
                            <div className={s.backupDetail}>
                              {bk.modified && new Date(bk.modified).toLocaleString()}
                              {bk.size > 0 && ` · ${(bk.size / 1024).toFixed(1)} KB`}
                            </div>
                          </div>
                          <Btn
                            onClick={() => handleCloudRestore(bk.name)}
                            disabled={cloudBusy}
                            className={s.s22}
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
                <div className={`${s.statusMsg} ${cloudMsg.ok ? s.statusMsgOk : s.statusMsgErr}`}>
                  {cloudMsg.text}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Storage, Auto-backup, & Cloud Sync — only on backup tab */}
      {dataTab === 'backup' && (
        <>
          <StorageDashboard />
          <AutoBackupScheduler />
          <CloudSyncCard />
          <BootWaterfall />
          <PipelineDashboard />
        </>
      )}
    </section>
  );
}

export default React.memo(DataSection);
