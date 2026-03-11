// ═══════════════════════════════════════════════════════════════════
// charEdge — Demo Mode Banner (Task 3.2.4)
//
// Shows a non-intrusive top banner when running in public demo mode
// (no Supabase auth configured). Includes a CTA to sign up and
// a one-time dismiss. Data is local-only in demo mode.
// ═══════════════════════════════════════════════════════════════════
import { useState, useCallback } from 'react';

const DISMISS_KEY = 'charEdge-demo-dismissed';

/**
 * Demo mode banner — renders at the top of the app when no auth is configured.
 * Dismissable with localStorage persistence.
 */
export default function DemoBanner() {
    const supabaseConfigured = Boolean(
        import.meta.env?.VITE_SUPABASE_URL && import.meta.env?.VITE_SUPABASE_ANON_KEY
    );

    const [dismissed, setDismissed] = useState(() => {
        try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
    });

    const handleDismiss = useCallback(() => {
        setDismissed(true);
        try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ok */ }
    }, []);

    // Don't show if auth is configured or already dismissed
    if (supabaseConfigured || dismissed) return null;

    return (
        <div style={styles.banner} role="status" aria-live="polite">
            <div style={styles.inner}>
                <span style={styles.badge}>DEMO</span>
                <span style={styles.text}>
                    You're using charEdge in demo mode — data is stored locally only.
                </span>
                <a
                    href="https://charedge.app/signup"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.cta}
                >
                    Create Free Account →
                </a>
                <button
                    onClick={handleDismiss}
                    style={styles.dismiss}
                    aria-label="Dismiss demo banner"
                    type="button"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}

// ─── Inline Styles ──────────────────────────────────────────────

const styles = {
    banner: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'linear-gradient(90deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%)',
        borderBottom: '1px solid rgba(255, 176, 32, 0.3)',
        padding: '6px 16px',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 13,
    },
    inner: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        maxWidth: 960,
        margin: '0 auto',
    },
    badge: {
        background: 'linear-gradient(135deg, #FFB020, #e8a824)',
        color: '#1a1a2e',
        padding: '2px 8px',
        borderRadius: 4,
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    text: {
        color: 'rgba(255, 255, 255, 0.8)',
    },
    cta: {
        color: '#FFB020',
        textDecoration: 'none',
        fontWeight: 600,
        whiteSpace: 'nowrap',
    },
    dismiss: {
        background: 'none',
        border: 'none',
        color: 'rgba(255, 255, 255, 0.4)',
        cursor: 'pointer',
        padding: '2px 6px',
        fontSize: 14,
        lineHeight: 1,
    },
};
