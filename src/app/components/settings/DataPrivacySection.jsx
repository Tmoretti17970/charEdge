// ═══════════════════════════════════════════════════════════════════
// charEdge — Data & Privacy Settings Section
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C } from '../../../constants.js';
import { useConsentStore } from '../../../state/useConsentStore';
import { Card, Btn } from '../ui/UIKit.jsx';
import st from './DataPrivacySection.module.css';
import { SectionHeader } from './SettingsHelpers.jsx';

function PermissionRow({ label, api }) {
  const [status, setStatus] = React.useState('checking');
  React.useEffect(() => {
    (async () => {
      try {
        const result = await navigator.permissions?.query({ name: api });
        setStatus(result?.state || 'unknown');
      } catch {
        setStatus('unknown');
      }
    })();
  }, [api]);
  const colors = { granted: C.g, denied: C.r, prompt: C.y || C.t3, unknown: C.t3, checking: C.t3 };
  const labels = { granted: 'Allowed', denied: 'Blocked', prompt: 'Ask', unknown: '—', checking: '…' };
  return (
    <div className={st.permRow}>
      <span className={st.permLabel}>{label}</span>
      <span className={st.permStatus} style={{ color: colors[status] || C.t3 }}>
        {labels[status] || status}
      </span>
    </div>
  );
}

function DataPrivacySection() {
  const analytics = useConsentStore((s) => s.analytics);
  const consentedAt = useConsentStore((s) => s.consentedAt);
  const setPreference = useConsentStore((s) => s.setPreference);
  return (
    <section className={st.section}>
      <SectionHeader
        icon="shield"
        title="Data & Privacy"
        description="GDPR data rights — export, delete, and manage analytics consent"
      />

      <Card className={st.cardPad}>
        <div className={st.consentRow}>
          <div>
            <div className={st.consentTitle}>Analytics Consent</div>
            <div className={st.consentStatus}>
              {analytics === true && '✅ Opted in — anonymous usage analytics enabled'}
              {analytics === false && '🚫 Opted out — no analytics collected'}
              {analytics === null && '⚪ Not yet decided'}
              {consentedAt && (
                <span className={st.consentDate}>(set {new Date(consentedAt).toLocaleDateString()})</span>
              )}
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

      <Card className={st.cardGap}>
        <div className={st.cardTitleLg}>Browser Permissions</div>
        <PermissionRow label="Notifications" api="notifications" />
        <PermissionRow label="Clipboard" api="clipboard-write" />
        <PermissionRow label="Persistent Storage" api="persistent-storage" />
      </Card>

      <Card className={st.cardGap}>
        <div className={st.cardTitle}>Data Processing</div>
        <div className={st.prose}>
          <p>
            🔒 <strong>Local-first architecture:</strong> All data stays in your browser. No trade data, personal
            information, or analytics are sent to any server unless you explicitly enable cloud sync.
          </p>
          <p>
            🧠 <strong>AI processing:</strong> All AI analysis runs in your browser using on-device models. No prompts
            or responses leave your machine.
          </p>
          <p>
            📊 <strong>Analytics:</strong> If opted in, only anonymous usage events (page views, feature usage) are
            collected. No trade data or personal information is included.
          </p>
        </div>
      </Card>

      <Card className={st.cardGap}>
        <div className={st.cardTitle}>What We Store</div>
        <table className={st.storageTable}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.bd}30` }}>
              <th>Data</th>
              <th>Storage</th>
              <th>Purpose</th>
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
