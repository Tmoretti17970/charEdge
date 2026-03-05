// ═══════════════════════════════════════════════════════════════════
// charEdge — Data & Privacy Settings Section
//
// GDPR compliance: data export (Art. 15), data deletion (Art. 17),
// and analytics consent management.
// ═══════════════════════════════════════════════════════════════════

import { C, F, M } from '../../../constants.js';
import { useConsentStore } from '../../../state/useConsentStore.js';
import { useJournalStore } from '../../../state/useJournalStore.js';
import { useUserStore } from '../../../state/useUserStore.js';
import { useGamificationStore } from '../../../state/useGamificationStore.js';
import { Card, Btn } from '../ui/UIKit.jsx';
import { SectionHeader } from './SettingsHelpers.jsx';

export default function DataPrivacySection() {
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
    } catch (_) { /* indexedDB.databases() not supported in all browsers */ }

    // Clear OPFS (Origin Private File System)
    try {
      if (navigator.storage?.getDirectory) {
        const root = await navigator.storage.getDirectory();
        for await (const name of root.keys()) {
          await root.removeEntry(name, { recursive: true });
        }
      }
    } catch (_) { /* OPFS not supported or empty */ }

    // Unregister all service workers
    try {
      const registrations = await navigator.serviceWorker?.getRegistrations() || [];
      for (const reg of registrations) await reg.unregister();
    } catch (_) { /* SW not supported */ }

    // Clear all browser caches (Cache Storage API)
    try {
      const cacheNames = await caches?.keys() || [];
      for (const name of cacheNames) await caches.delete(name);
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

        {/* Data export */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          paddingBottom: 16, marginBottom: 16, borderBottom: `1px solid ${C.bd}`,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>Export My Data</div>
            <div style={{ fontSize: 12, color: C.t3, marginTop: 2 }}>
              Download all your data as JSON ({tradeCount} trades, settings, progress)
            </div>
          </div>
          <Btn variant="ghost" onClick={handleExport} style={{ fontSize: 12, padding: '8px 14px', flexShrink: 0 }}>
            📥 Export JSON
          </Btn>
        </div>

        {/* Data deletion */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>Delete All Data</div>
            <div style={{ fontSize: 12, color: C.t3, marginTop: 2 }}>
              Permanently erase all data from this browser. Cannot be undone.
            </div>
          </div>
          <Btn variant="danger" onClick={handleDelete} style={{ fontSize: 12, padding: '8px 14px', flexShrink: 0 }}>
            🗑️ Delete Everything
          </Btn>
        </div>
      </Card>
    </section>
  );
}
