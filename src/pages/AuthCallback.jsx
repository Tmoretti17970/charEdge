// ═══════════════════════════════════════════════════════════════════
// charEdge — OAuth Callback Page
// Handles redirect from OAuth providers (Google, GitHub).
// Supabase JS auto-exchanges the URL hash for a session.
// ═══════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../state/useAuthStore.js';

export default function AuthCallback() {
    const { user, initialized } = useAuthStore();
    const [error, setError] = useState(/** @type {string | null} */(null));

    useEffect(() => {
        // Supabase detectSessionInUrl handles the token exchange automatically.
        // We just wait for the session to appear, then redirect.
        const timeout = setTimeout(() => {
            if (!user) {
                setError('Authentication timed out. Please try again.');
            }
        }, 10000);

        return () => clearTimeout(timeout);
    }, [user]);

    // Once user is set, redirect to main app
    useEffect(() => {
        if (initialized && user) {
            window.location.replace('/');
        }
    }, [user, initialized]);

    if (error) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                color: 'var(--c-fg-primary)',
                background: 'var(--c-bg-primary)',
                fontFamily: 'Inter, system-ui, sans-serif',
                flexDirection: 'column',
                gap: '16px',
            }}>
                <p style={{ color: 'var(--c-accent-red)' }}>{error}</p>
                <a href="/" style={{ color: 'var(--brand-blue)', textDecoration: 'underline' }}>
                    Return to login
                </a>
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            color: 'var(--c-fg-secondary)',
            background: 'var(--c-bg-primary)',
            fontFamily: 'Inter, system-ui, sans-serif',
        }}>
            Completing sign-in...
        </div>
    );
}
