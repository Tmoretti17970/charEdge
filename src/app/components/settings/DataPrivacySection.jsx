// ═══════════════════════════════════════════════════════════════════
// charEdge — Data & Privacy Settings Section
//
// GDPR compliance: data export (Art. 15), data deletion (Art. 17),
// and analytics consent management.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, F, M } from '../../../constants.js';
import { useConsentStore } from '../../../state/useConsentStore';
import { useGamificationStore } from '../../../state/useGamificationStore';
import { useJournalStore } from '../../../state/useJournalStore';
import { useUserStore } from '../../../state/useUserStore';
import { Card, Btn } from '../ui/UIKit.jsx';
import { SectionHeader } from './SettingsHelpers.jsx';

function PermissionRow({ label, api }) {
  const [status, setStatus] = React.useState('checking');
  React.useEffect(() => {
    (async () => {
      try {
        const result = await navigator.permissions?.query({ name: api });
        setStatus(result?.state || 'unknown');
      } catch { setStatus('unknown'); }
    })();
  }, [api]);
  const colors = { granted: C.g, denied: C.r, prompt: C.y || C.t3, unknown: C.t3, checking: C.t3 };
  const labels = { granted: 'Allowed', denied: 'Blocked', prompt: 'Ask', unknown: '—', checking: '…' };
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
      <span style={{ fontSize: 12, color: C.t2, fontFamily: F }}>{label}</span>
      <span style={{ fontSize: 10, fontWeight: 600, color: colors[status] || C.t3, fontFamily: M }}>
        {labels[status] || status}
      </span>
    </div>
  );
}

function DataPrivacySection() {
  const analytics = useConsentStore((s) => s.analytics);
  const consentedAt = useConsentStore((s) => s.consentedAt);
  const setPreference = useConsentStore((s) => s.setPreference);
  const tradeCount = useJournalStore((s) => s.trades.length);

  // ─── Export all data as JSON ──────────────────────────────
  const handleExport = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      version: '11.0.0',
      journal: useJournalStore.getState().toJSON?.() || {
        trades: useJournalStore.getState().trades,
        playbooks: useJournalStore.getState().playbooks,
      },
      settings: useUserStore.getState().toJSON?.() || useUserStore.getState(),
      gamification: useGamificationStore.getState().toJSON?.() || {},
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `charedge-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Delete all data (GDPR Art. 17 — Right to Erasure) ───
  const handleDelete = async () => {
    const confirmed = window.confirm(
      'Delete ALL your data? This will:\n\n' +
      `• Remove ${tradeCount} trades\n` +
      '• Clear all settings and preferences\n' +
      '• Reset gamification progress\n' +
      '• Clear all browser storage (IndexedDB, OPFS, caches)\n' +
      '• Unregister service workers\n\n' +
      'This action CANNOT be undone. Export first if needed.'
    );
    if (!confirmed) return;

    // Double confirmation for destructive action
    const doubleConfirm = window.confirm(
      'Are you absolutely sure? Type "delete" would be ideal, but click OK to proceed.'
    );
    if (!doubleConfirm) return;

    try {
      // Clear IndexedDB databases
      const dbs = await indexedDB.databases?.() || [];
      for (const db of dbs) {
        if (db.name) indexedDB.deleteDatabase(db.name);
      }
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) { /* indexedDB.databases() not supported in all browsers */ }

    // Clear OPFS (Origin Private File System)
    try {
      if (navigator.storage?.getDirectory) {
        const root = await navigator.storage.getDirectory();
        for await (const name of root.keys()) {
          await root.removeEntry(name, { recursive: true });
        }
      }
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) { /* OPFS not supported or empty */ }

    // Unregister all service workers
    try {
      const registrations = await navigator.serviceWorker?.getRegistrations() || [];
      for (const reg of registrations) await reg.unregister();
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) { /* SW not supported */ }

    // Clear all browser caches (Cache Storage API)
    try {
      const cacheNames = await caches?.keys() || [];
      for (const name of cacheNames) await caches.delete(name);
    // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (_) { /* caches API not available */ }

    // Clear all localStorage (including SecureStore salt)
    localStorage.clear();

    // Clear sessionStorage
    sessionStorage.clear();

    // Reload to fresh state
    window.location.reload();
  };

  return (
    <section style={{ marginBottom: 40 }}>
      <SectionHeader icon="shield" title="Data & Privacy" description="GDPR data rights — export, delete, and manage analytics consent" />

      <Card style={{ padding: 20 }}>
        {/* Analytics consent toggle */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          paddingBottom: 16, marginBottom: 16, borderBottom: `1px solid ${C.bd}`,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>Analytics Consent</div>
            <div style={{ fontSize: 12, color: C.t3, marginTop: 2 }}>
              {analytics === true && '✅ Opted in — anonymous usage analytics enabled'}
              {analytics === false && '🚫 Opted out — no analytics collected'}
              {analytics === null && '⚪ Not yet decided'}
              {consentedAt && <span style={{ fontFamily: M, fontSize: 11, marginLeft: 8, opacity: 0.6 }}>
                (set {new Date(consentedAt).toLocaleDateString()})
              </span>}
            </div>
          </div>
          <Btn
            variant={analytics ? 'ghost' : 'primary'}
            onClick={() => setPreference('analytics', !analytics)}
            style={{ fontSize: 12, padding: '8px 14px', flexShrink: 0 }}
          >
            {analytics ? 'Opt Out' : 'Opt In'}
          </Btn>
        </div>
      </Card>

      {/* Permissions Status */}
      <Card style={{ padding: 20, marginTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, marginBottom: 12 }}>Browser Permissions</div>
        <PermissionRow label="Notifications" api="notifications" />
        <PermissionRow label="Clipboard" api="clipboard-write" />
        <PermissionRow label="Persistent Storage" api="persistent-storage" />
      </Card>

      {/* Data Processing Statement */}
      <Card style={{ padding: 20, marginTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, marginBottom: 8 }}>Data Processing</div>
        <div style={{ fontSize: 11, color: C.t3, lineHeight: 1.6, fontFamily: F }}>
          <p style={{ margin: '0 0 8px' }}>🔒 <strong>Local-first architecture:</strong> All data stays in your browser. No trade data, personal information, or analytics are sent to any server unless you explicitly enable cloud sync.</p>
          <p style={{ margin: '0 0 8px' }}>🧠 <strong>AI processing:</strong> All AI analysis runs in your browser using on-device models. No prompts or responses leave your machine.</p>
          <p style={{ margin: 0 }}>📊 <strong>Analytics:</strong> If opted in, only anonymous usage events (page views, feature usage) are collected. No trade data or personal information is included.</p>
        </div>
      </Card>

      {/* Storage Breakdown */}
      <Card style={{ padding: 20, marginTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, marginBottom: 8 }}>What We Store</div>
        <table style={{ width: '100%', fontSize: 11, color: C.t2, fontFamily: F, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.bd}30` }}>
              <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 10, fontWeight: 700, color: C.t3 }}>Data</th>
              <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 10, fontWeight: 700, color: C.t3 }}>Storage</th>
              <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 10, fontWeight: 700, color: C.t3 }}>Purpose</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Trades & Journal', 'IndexedDB', 'Your trading history'],
              ['Settings', 'localStorage', 'App preferences'],
              ['AI Models', 'OPFS / Cache', 'On-device AI inference'],
              ['Consent', 'localStorage', 'Your privacy choices'],
              ['Session', 'sessionStorage', 'Current session state'],
            ].map(([data, storage, purpose]) => (
              <tr key={data} style={{ borderBottom: `1px solid ${C.bd}10` }}>
                <td style={{ padding: '6px 0' }}>{data}</td>
                <td style={{ padding: '6px 0', fontFamily: M, fontSize: 10 }}>{storage}</td>
                <td style={{ padding: '6px 0', color: C.t3 }}>{purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}

export default React.memo(DataPrivacySection);
