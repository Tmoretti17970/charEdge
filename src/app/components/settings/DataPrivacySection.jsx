// ═══════════════════════════════════════════════════════════════════
// charEdge — Data & Privacy Settings Section
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C } from '../../../constants.js';
import { useConsentStore } from '../../../state/useConsentStore';
import { useGamificationStore } from '../../../state/useGamificationStore';
import { useJournalStore } from '../../../state/useJournalStore';
import { useUserStore } from '../../../state/useUserStore';
import { Card, Btn } from '../ui/UIKit.jsx';
import { SectionHeader } from './SettingsHelpers.jsx';
import st from './DataPrivacySection.module.css';

function PermissionRow({ label, api }) {
  const [status, setStatus] = React.useState('checking');
  React.useEffect(() => {
    (async () => {
      try { const result = await navigator.permissions?.query({ name: api }); setStatus(result?.state || 'unknown'); }
      catch { setStatus('unknown'); }
    })();
  }, [api]);
  const colors = { granted: C.g, denied: C.r, prompt: C.y || C.t3, unknown: C.t3, checking: C.t3 };
  const labels = { granted: 'Allowed', denied: 'Blocked', prompt: 'Ask', unknown: '—', checking: '…' };
  return (
    <div className={st.permRow}>
      <span className={st.permLabel}>{label}</span>
      <span className={st.permStatus} style={{ color: colors[status] || C.t3 }}>{labels[status] || status}</span>
    </div>
  );
}

function DataPrivacySection() {
  const analytics = useConsentStore((s) => s.analytics);
  const consentedAt = useConsentStore((s) => s.consentedAt);
  const setPreference = useConsentStore((s) => s.setPreference);
  const tradeCount = useJournalStore((s) => s.trades.length);

  const handleExport = () => {
    const data = {
      exportedAt: new Date().toISOString(), version: '11.0.0',
      journal: useJournalStore.getState().toJSON?.() || { trades: useJournalStore.getState().trades, playbooks: useJournalStore.getState().playbooks },
      settings: useUserStore.getState().toJSON?.() || useUserStore.getState(),
      gamification: useGamificationStore.getState().toJSON?.() || {},
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `charedge-export-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      'Delete ALL your data? This will:\n\n' +
      `• Remove ${tradeCount} trades\n• Clear all settings and preferences\n• Reset gamification progress\n` +
      '• Clear all browser storage (IndexedDB, OPFS, caches)\n• Unregister service workers\n\nThis action CANNOT be undone. Export first if needed.'
    );
    if (!confirmed) return;
    const doubleConfirm = window.confirm('Are you absolutely sure? Type "delete" would be ideal, but click OK to proceed.');
    if (!doubleConfirm) return;
    try { const dbs = await indexedDB.databases?.() || []; for (const db of dbs) { if (db.name) indexedDB.deleteDatabase(db.name); } } catch (_) {}
    try { if (navigator.storage?.getDirectory) { const root = await navigator.storage.getDirectory(); for await (const name of root.keys()) { await root.removeEntry(name, { recursive: true }); } } } catch (_) {}
    try { const registrations = await navigator.serviceWorker?.getRegistrations() || []; for (const reg of registrations) await reg.unregister(); } catch (_) {}
    try { const cacheNames = await caches?.keys() || []; for (const name of cacheNames) await caches.delete(name); } catch (_) {}
    localStorage.clear(); sessionStorage.clear(); window.location.reload();
  };

  return (
    <section className={st.section}>
      <SectionHeader icon="shield" title="Data & Privacy" description="GDPR data rights — export, delete, and manage analytics consent" />

      <Card className={st.cardPad}>
        <div className={st.consentRow}>
          <div>
            <div className={st.consentTitle}>Analytics Consent</div>
            <div className={st.consentStatus}>
              {analytics === true && '✅ Opted in — anonymous usage analytics enabled'}
              {analytics === false && '🚫 Opted out — no analytics collected'}
              {analytics === null && '⚪ Not yet decided'}
              {consentedAt && <span className={st.consentDate}>(set {new Date(consentedAt).toLocaleDateString()})</span>}
            </div>
          </div>
          <Btn variant={analytics ? 'ghost' : 'primary'} onClick={() => setPreference('analytics', !analytics)}
            style={{ fontSize: 12, padding: '8px 14px', flexShrink: 0 }}>
            {analytics ? 'Opt Out' : 'Opt In'}
          </Btn>
        </div>
      </Card>

      <Card className={st.cardGap}>
        <div className={st.cardTitleLg}>Browser Permissions</div>
        <PermissionRow label="Notifications" api="notifications" />
        <PermissionRow label="Clipboard" api="clipboard-write" />
        <PermissionRow label="Persistent Storage" api="persistent-storage" />
      </Card>

      <Card className={st.cardGap}>
        <div className={st.cardTitle}>Data Processing</div>
        <div className={st.prose}>
          <p>🔒 <strong>Local-first architecture:</strong> All data stays in your browser. No trade data, personal information, or analytics are sent to any server unless you explicitly enable cloud sync.</p>
          <p>🧠 <strong>AI processing:</strong> All AI analysis runs in your browser using on-device models. No prompts or responses leave your machine.</p>
          <p>📊 <strong>Analytics:</strong> If opted in, only anonymous usage events (page views, feature usage) are collected. No trade data or personal information is included.</p>
        </div>
      </Card>

      <Card className={st.cardGap}>
        <div className={st.cardTitle}>What We Store</div>
        <table className={st.storageTable}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.bd}30` }}>
              <th>Data</th><th>Storage</th><th>Purpose</th>
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
                <td>{data}</td>
                <td className={st.monoCell}>{storage}</td>
                <td className={st.mutedCell}>{purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}

export default React.memo(DataPrivacySection);
