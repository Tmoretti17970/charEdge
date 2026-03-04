import { useState } from 'react';
import { C, F, M } from '../../../constants.js';
import { radii } from '../../../theme/tokens.js';
import { getApiKey, setApiKey, getProviderStatus } from '../../../data/DataProvider.js';
import { configureSupabase, signIn, signUp, signOut, getAuth, getSyncStatus, sync } from '../../../data/StorageAdapter.js';
import { Card, Btn, inputStyle } from '../ui/UIKit.jsx';
import { SectionHeader, SettingRow, StatusBadge, AlertBanner } from './SettingsHelpers.jsx';

export default function IntegrationsSection() {
  return (
    <section style={{ marginBottom: 40 }}>
      <SectionHeader icon="plug" title="Integrations" description="API keys, data sources, and cloud sync" />
      <ApiKeySettings />
      <div style={{ marginTop: 16 }}><CloudSyncSection /></div>
    </section>
  );
}

// ─── API Key Settings ───────────────────────────────────────────

function ApiKeySettings() {
  const providers = getProviderStatus();
  const [polygonKey, setPolygonKey] = useState(getApiKey('polygon'));
  const [avKey, setAvKey] = useState(getApiKey('alphavantage'));
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setApiKey('polygon', polygonKey.trim());
    setApiKey('alphavantage', avKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 4 }}>Market Data Providers</div>
      <div style={{ fontSize: 11, color: C.t3, marginBottom: 14 }}>Add API keys to unlock premium data sources. Crypto data works without keys.</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {Object.entries(providers).map(([id, p]) => (<StatusBadge key={id} ok={p.hasKey || !p.needsKey} label={p.name} />))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} autoComplete="off">
        <SettingRow label="Polygon.io API Key" hint="Free tier: 5 req/min, delayed equities · polygon.io/dashboard/signup">
          <input type="password" value={polygonKey} onChange={(e) => setPolygonKey(e.target.value)} placeholder="Enter Polygon.io API key..." autoComplete="off" style={inputStyle} />
        </SettingRow>
        <SettingRow label="Alpha Vantage API Key" hint="Free tier: 25 req/day · alphavantage.co/support/#api-key">
          <input type="password" value={avKey} onChange={(e) => setAvKey(e.target.value)} placeholder="Enter Alpha Vantage API key..." autoComplete="off" style={inputStyle} />
        </SettingRow>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Btn onClick={handleSave} style={{ fontSize: 12, padding: '8px 16px' }}>Save API Keys</Btn>
          {saved && <span style={{ fontSize: 12, color: C.g, fontWeight: 600 }}>✓ Saved</span>}
        </div>
      </form>
    </Card>
  );
}

// ─── Cloud Sync Section ─────────────────────────────────────────

function CloudSyncSection() {
  const auth = getAuth();
  const syncStatus = getSyncStatus();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [supaUrl, setSupaUrl] = useState(auth.supabaseUrl || '');
  const [supaKey, setSupaKey] = useState(auth.supabaseKey || '');
  const [authMsg, setAuthMsg] = useState(null);
  const [syncMsg, setSyncMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleConfigure = () => { configureSupabase(supaUrl.trim(), supaKey.trim()); setAuthMsg({ ok: true, text: 'Supabase configured.' }); };
  const handleSignIn = async () => { setBusy(true); const result = await signIn(email, password); setBusy(false); setAuthMsg({ ok: result.ok, text: result.ok ? `Signed in as ${result.user?.email}` : result.error }); };
  const handleSignUp = async () => { setBusy(true); const result = await signUp(email, password); setBusy(false); setAuthMsg({ ok: result.ok, text: result.ok ? result.message : result.error }); };
  const handleSignOut = () => { signOut(); setAuthMsg({ ok: true, text: 'Signed out. Local-only mode.' }); };
  const handleSync = async () => {
    setBusy(true);
    const result = await sync();
    setBusy(false);
    setSyncMsg({ ok: result.ok, text: result.ok ? `Synced: ${result.pushed} pushed, ${result.pulled} pulled.` : `Sync errors: ${result.errors.join(', ')}` });
  };

  return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 4 }}>☁️ Cloud Sync</div>
      <div style={{ fontSize: 11, color: C.t3, marginBottom: 14 }}>Connect your own Supabase project to sync trades across devices. Everything works locally without this.</div>
      {!auth.isAuthenticated ? (
        <>
          <form onSubmit={(e) => { e.preventDefault(); handleConfigure(); }} autoComplete="off">
            <SettingRow label="Supabase Project URL"><input type="text" value={supaUrl} onChange={(e) => setSupaUrl(e.target.value)} placeholder="https://your-project.supabase.co" autoComplete="off" style={inputStyle} /></SettingRow>
            <SettingRow label="Supabase Anon Key"><input type="password" value={supaKey} onChange={(e) => setSupaKey(e.target.value)} placeholder="eyJhbGciOi..." autoComplete="off" style={inputStyle} /></SettingRow>
            <Btn onClick={handleConfigure} style={{ fontSize: 12, padding: '7px 14px', marginBottom: 16 }}>Configure</Btn>
          </form>
          <form onSubmit={(e) => { e.preventDefault(); handleSignIn(); }} style={{ paddingTop: 16, borderTop: `1px solid ${C.bd}` }}>
            <SettingRow label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" style={inputStyle} /></SettingRow>
            <SettingRow label="Password"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" style={inputStyle} /></SettingRow>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={handleSignIn} disabled={busy} style={{ fontSize: 12, padding: '8px 14px' }}>{busy ? '...' : 'Sign In'}</Btn>
              <Btn variant="ghost" onClick={handleSignUp} disabled={busy} style={{ fontSize: 12, padding: '8px 14px' }}>Sign Up</Btn>
            </div>
          </form>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', background: C.sf2, borderRadius: radii.md, marginBottom: 16 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: syncStatus.isCloudEnabled ? C.g : C.t3 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{auth.user?.email || 'Authenticated'}</div>
              <div style={{ fontSize: 11, color: C.t3, fontFamily: M }}>
                {syncStatus.pending > 0 ? `${syncStatus.pending} pending writes` : 'All synced'}
                {syncStatus.lastSync && ` · Last sync: ${new Date(syncStatus.lastSync).toLocaleTimeString()}`}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={handleSync} disabled={busy} style={{ fontSize: 12, padding: '8px 14px' }}>{busy ? 'Syncing...' : '🔄 Sync Now'}</Btn>
            <Btn variant="ghost" onClick={handleSignOut} style={{ fontSize: 12, padding: '8px 14px' }}>Sign Out</Btn>
          </div>
        </>
      )}
      <AlertBanner ok={authMsg?.ok} message={authMsg?.text} />
      <AlertBanner ok={syncMsg?.ok} message={syncMsg?.text} />
    </Card>
  );
}
