// ═══════════════════════════════════════════════════════════════════
// charEdge — PWA Install Prompt
//
// Phase 7 Task 7.3.7: Deferred PWA install banner.
// Captures the `beforeinstallprompt` event and shows a branded
// install CTA when the user is eligible.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, memo } from 'react';

const STORAGE_KEY = 'charedge_pwa_dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

const PWAInstallPrompt = memo(function PWAInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [visible, setVisible] = useState(false);
    const [installed, setInstalled] = useState(false);

    useEffect(() => {
        // Check if already dismissed recently
        const dismissed = localStorage.getItem(STORAGE_KEY);
        if (dismissed && Date.now() - parseInt(dismissed, 10) < DISMISS_DURATION) return;

        // Check if already installed (standalone mode)
        if (window.matchMedia?.('(display-mode: standalone)')?.matches) return;

        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            // Delay showing to avoid interrupting first visit
            setTimeout(() => setVisible(true), 30_000);
        };

        window.addEventListener('beforeinstallprompt', handler);
        window.addEventListener('appinstalled', () => setInstalled(true));

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = useCallback(async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        if (result.outcome === 'accepted') {
            setInstalled(true);
        }
        setDeferredPrompt(null);
        setVisible(false);
    }, [deferredPrompt]);

    const dismiss = useCallback(() => {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
        setVisible(false);
    }, []);

    if (!visible || installed) return null;

    return (
        <div style={bannerStyle} role="banner" aria-label="Install charEdge">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src="/logo-mark.svg" alt="charEdge" width={32} height={32} style={{ borderRadius: 6 }} />
                <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--fs-sm, 13px)' }}>
                        Install charEdge
                    </p>
                    <p style={{ margin: 0, fontSize: 'var(--fs-xs, 11px)', color: 'var(--c-fg-secondary, #8b8fa2)' }}>
                        Add to your dock for instant access
                    </p>
                </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={dismiss} style={laterStyle}>Later</button>
                <button onClick={handleInstall} style={installStyle}>Install</button>
            </div>
        </div>
    );
});

const bannerStyle = {
    position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
    zIndex: 'var(--z-toast, 600)',
    background: 'var(--c-bg-secondary, #0e1013)', borderRadius: 'var(--br-lg, 12px)',
    border: '1px solid var(--c-border, #2a2e3a)', padding: '12px 16px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
    maxWidth: 420, width: '92vw',
    boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.5))',
    animation: 'fadeInUp 250ms ease-out',
};

const laterStyle = {
    padding: '6px 12px', background: 'transparent',
    border: '1px solid var(--c-border, #2a2e3a)', borderRadius: 'var(--br-md, 8px)',
    color: 'var(--c-fg-secondary, #8b8fa2)', fontSize: 'var(--fs-xs, 11px)',
    cursor: 'pointer', fontWeight: 500,
};

const installStyle = {
    padding: '6px 16px', background: 'var(--c-accent-blue, #2196F3)',
    border: 'none', borderRadius: 'var(--br-md, 8px)',
    color: '#fff', fontSize: 'var(--fs-xs, 11px)',
    cursor: 'pointer', fontWeight: 600,
};

export default PWAInstallPrompt;
