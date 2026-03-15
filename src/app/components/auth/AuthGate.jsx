// ═══════════════════════════════════════════════════════════════════
// charEdge — AuthGate Component
// Full-screen auth modal: email sign-in/up + OAuth (Google, GitHub).
// Shows when there's no active session; renders children when authed.
// ═══════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { useAuthStore } from '../../../state/useAuthStore.js';
import styles from './AuthGate.module.css';

// ─── SVG Icons (inline to avoid dependencies) ──────────────────

const ChartIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
);

const GoogleIcon = () => (
    <svg viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

const GitHubIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 1.27a11 11 0 0 0-3.48 21.46c.55.09.73-.28.73-.55v-1.84c-3.03.64-3.67-1.46-3.67-1.46-.5-1.29-1.21-1.6-1.21-1.6-.99-.68.07-.66.07-.66 1.09.07 1.67 1.12 1.67 1.12.97 1.66 2.55 1.18 3.18.9.1-.7.38-1.18.69-1.45-2.42-.27-4.97-1.21-4.97-5.4 0-1.19.42-2.17 1.12-2.93-.11-.28-.49-1.39.11-2.89 0 0 .92-.3 3 1.12a10.4 10.4 0 0 1 5.5 0c2.1-1.42 3-1.12 3-1.12.6 1.5.22 2.61.1 2.89.7.76 1.12 1.74 1.12 2.93 0 4.2-2.56 5.13-4.98 5.4.39.34.74 1.01.74 2.03v3.01c0 .27.18.65.74.55A11 11 0 0 0 12 1.27z" />
    </svg>
);

// ─── AuthGate Component ────────────────────────────────────────

/**
 * AuthGate wraps the app and shows a login screen when unauthenticated.
 * If Supabase isn't configured, it passes through (demo mode).
 *
 * @param {{ children: React.ReactNode }} props
 */
export default function AuthGate({ children }) {
    const { user, loading, initialized, error, signIn, signUp, signInWithOAuth, clearError } = useAuthStore();
    const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [signUpSuccess, setSignUpSuccess] = useState(false);

    // Dev-mode auth bypass for testing
    if (import.meta.env.VITE_DEV_BYPASS_AUTH === 'true') {
        return <>{children}</>;
    }

    // If Supabase isn't configured, pass through (demo mode)
    const supabaseConfigured = Boolean(
        import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
    );
    if (!supabaseConfigured) {
        return <>{children}</>;
    }

    // Show loading while checking initial session
    if (!initialized || loading) {
        return null; // App.jsx already has its own LoadingScreen
    }

    // If authenticated, render children
    if (user) {
        return <>{children}</>;
    }

    // ─── Form Submission ──────────────────────────────────────────

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !password || submitting) return;

        setSubmitting(true);
        clearError();
        setSignUpSuccess(false);

        if (mode === 'signup') {
            const { error } = await signUp(email, password);
            if (!error) {
                setSignUpSuccess(true);
                setEmail('');
                setPassword('');
            }
        } else {
            await signIn(email, password);
        }
        setSubmitting(false);
    };

    const handleOAuth = async (provider) => {
        clearError();
        await signInWithOAuth(provider);
    };

    const switchMode = (newMode) => {
        setMode(newMode);
        clearError();
        setSignUpSuccess(false);
    };

    // ─── Render ───────────────────────────────────────────────────

    return (
        <div className={styles.authOverlay}>
            <div className={styles.authCard}>
                {/* Logo */}
                <div className={styles.logoSection}>
                    <div className={styles.logoMark}>
                        <ChartIcon />
                    </div>
                    <h1 className={styles.logoTitle}>charEdge</h1>
                    <p className={styles.logoSubtitle}>
                        GPU-accelerated trading analytics
                    </p>
                </div>

                {/* Tabs */}
                <div className={styles.tabSwitcher}>
                    <button
                        className={`${styles.tab} ${mode === 'signin' ? styles.tabActive : ''}`}
                        onClick={() => switchMode('signin')}
                        type="button"
                    >
                        Sign In
                    </button>
                    <button
                        className={`${styles.tab} ${mode === 'signup' ? styles.tabActive : ''}`}
                        onClick={() => switchMode('signup')}
                        type="button"
                    >
                        Sign Up
                    </button>
                </div>

                {/* Error */}
                {error && <div className={styles.errorMsg}>{error}</div>}

                {/* Sign-up success */}
                {signUpSuccess && (
                    <div className={styles.successMsg}>
                        Check your email to confirm your account!
                    </div>
                )}

                {/* Email/Password Form */}
                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.fieldGroup}>
                        <label className={styles.label} htmlFor="auth-email">Email</label>
                        <input
                            id="auth-email"
                            className={styles.input}
                            type="email"
                            placeholder="trader@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            required
                        />
                    </div>

                    <div className={styles.fieldGroup}>
                        <label className={styles.label} htmlFor="auth-password">Password</label>
                        <input
                            id="auth-password"
                            className={styles.input}
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                            minLength={6}
                            required
                        />
                    </div>

                    <button
                        className={styles.submitBtn}
                        type="submit"
                        disabled={submitting || !email || !password}
                    >
                        {submitting
                            ? (mode === 'signup' ? 'Creating Account...' : 'Signing In...')
                            : (mode === 'signup' ? 'Create Account' : 'Sign In')
                        }
                    </button>
                </form>

                {/* Divider */}
                <div className={styles.divider}>or continue with</div>

                {/* OAuth */}
                <div className={styles.oauthGroup}>
                    <button className={styles.oauthBtn} onClick={() => handleOAuth('google')} type="button">
                        <GoogleIcon />
                        Google
                    </button>
                    <button className={styles.oauthBtn} onClick={() => handleOAuth('github')} type="button">
                        <GitHubIcon />
                        GitHub
                    </button>
                </div>
            </div>
        </div>
    );
}
