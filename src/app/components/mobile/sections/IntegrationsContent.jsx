// ═══════════════════════════════════════════════════════════════════
// Mobile Settings — Integrations Section
// API keys + Cloud sync (Supabase).
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { C, M } from '../../../../constants.js';
import { getApiKey, setApiKey, getProviderStatus } from '../../../../data/DataProvider.js';
import {
    configureSupabase,
    signIn,
    signUp,
    signOut,
    getAuth,
    getSyncStatus,
    sync,
} from '../../../../data/StorageAdapter.js';
import { radii } from '../../../../theme/tokens.js';
import { MobileRow, MobileBtn, StatusPill, MobileAlert, mobileInput } from '../MobilePrimitives.jsx';

// ─── API Keys ───────────────────────────────────────────────────

function MobileApiKeys() {
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
        <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 4 }}>Market Data</div>
            <div style={{ fontSize: 11, color: C.t3, marginBottom: 12 }}>
                API keys unlock premium data. Crypto works without keys.
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {Object.entries(providers).map(([id, p]) => (
                    <StatusPill key={id} ok={p.hasKey || !p.needsKey} label={p.name} />
                ))}
            </div>

            <MobileRow label="Polygon.io" hint="polygon.io/dashboard/signup">
                <input
                    type="password"
                    value={polygonKey}
                    onChange={(e) => setPolygonKey(e.target.value)}
                    placeholder="API key..."
                    style={mobileInput}
                />
            </MobileRow>

            <MobileRow label="Alpha Vantage" hint="alphavantage.co/support/#api-key">
                <input
                    type="password"
                    value={avKey}
                    onChange={(e) => setAvKey(e.target.value)}
                    placeholder="API key..."
                    style={mobileInput}
                />
            </MobileRow>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <MobileBtn onClick={handleSave}>Save Keys</MobileBtn>
                {saved && <span style={{ fontSize: 13, color: C.g, fontWeight: 600 }}>✓ Saved</span>}
            </div>
        </div>
    );
}

// ─── Cloud Sync ─────────────────────────────────────────────────

function MobileCloudSync() {
    const auth = getAuth();
    const syncStatus = getSyncStatus();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [supaUrl, setSupaUrl] = useState(auth.supabaseUrl || '');
    const [supaKey, setSupaKey] = useState(auth.supabaseKey || '');
    const [authMsg, setAuthMsg] = useState(null);
    const [syncMsg, setSyncMsg] = useState(null);
    const [busy, setBusy] = useState(false);

    const handleConfigure = () => {
        configureSupabase(supaUrl.trim(), supaKey.trim());
        setAuthMsg({ ok: true, text: 'Configured.' });
    };

    const handleSignIn = async () => {
        setBusy(true);
        const result = await signIn(email, password);
        setBusy(false);
        setAuthMsg({ ok: result.ok, text: result.ok ? `Signed in as ${result.user?.email}` : result.error });
    };

    const handleSignUp = async () => {
        setBusy(true);
        const result = await signUp(email, password);
        setBusy(false);
        setAuthMsg({ ok: result.ok, text: result.ok ? result.message : result.error });
    };

    const handleSignOut = () => {
        signOut();
        setAuthMsg({ ok: true, text: 'Signed out.' });
    };

    const handleSync = async () => {
        setBusy(true);
        const result = await sync();
        setBusy(false);
        setSyncMsg({
            ok: result.ok,
            text: result.ok ? `${result.pushed} pushed, ${result.pulled} pulled` : result.errors.join(', '),
        });
    };

    return (
        <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 4 }}>☁️ Cloud Sync</div>
            <div style={{ fontSize: 11, color: C.t3, marginBottom: 12 }}>
                Optional. Connect Supabase to sync across devices.
            </div>

            {!auth.isAuthenticated ? (
                <>
                    <MobileRow label="Supabase URL">
                        <input
                            type="text"
                            value={supaUrl}
                            onChange={(e) => setSupaUrl(e.target.value)}
                            placeholder="https://your-project.supabase.co"
                            style={mobileInput}
                        />
                    </MobileRow>
                    <MobileRow label="Anon Key">
                        <input
                            type="password"
                            value={supaKey}
                            onChange={(e) => setSupaKey(e.target.value)}
                            placeholder="eyJhbGciOi..."
                            style={mobileInput}
                        />
                    </MobileRow>
                    <MobileBtn onClick={handleConfigure} style={{ marginBottom: 16 }}>
                        Configure
                    </MobileBtn>

                    <div style={{ paddingTop: 12, borderTop: `1px solid ${C.bd}` }}>
                        <MobileRow label="Email">
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                style={mobileInput}
                            />
                        </MobileRow>
                        <MobileRow label="Password">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                style={mobileInput}
                            />
                        </MobileRow>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <MobileBtn onClick={handleSignIn} disabled={busy}>
                                {busy ? '...' : 'Sign In'}
                            </MobileBtn>
                            <MobileBtn onClick={handleSignUp} variant="ghost" disabled={busy}>
                                Sign Up
                            </MobileBtn>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div
                        style={{
                            display: 'flex',
                            gap: 10,
                            alignItems: 'center',
                            padding: '12px 14px',
                            background: C.sf2,
                            borderRadius: radii.md,
                            marginBottom: 12,
                        }}
                    >
                        <div
                            style={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                background: syncStatus.isCloudEnabled ? C.g : C.t3,
                            }}
                        />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>{auth.user?.email || 'Authenticated'}</div>
                            <div style={{ fontSize: 11, color: C.t3, fontFamily: M }}>
                                {syncStatus.pending > 0 ? `${syncStatus.pending} pending` : 'Synced'}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <MobileBtn onClick={handleSync} disabled={busy}>
                            {busy ? 'Syncing...' : '🔄 Sync'}
                        </MobileBtn>
                        <MobileBtn variant="ghost" onClick={handleSignOut}>
                            Sign Out
                        </MobileBtn>
                    </div>
                </>
            )}

            <MobileAlert ok={authMsg?.ok} message={authMsg?.text} />
            <MobileAlert ok={syncMsg?.ok} message={syncMsg?.text} />
        </div>
    );
}

// ─── Combined Integrations Section ──────────────────────────────

export default function IntegrationsContent() {
    return (
        <div>
            <MobileApiKeys />
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.bd}` }}>
                <MobileCloudSync />
            </div>
        </div>
    );
}
