// ═══════════════════════════════════════════════════════════════════
// charEdge — Master Password Gate (Sprint 2 — Task 2.4)
//
// Modal that intercepts boot when master password is enabled.
// Prompts user for password before API keys and credentials
// can be decrypted.
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { unlockWithPassword, hasMasterPassword } from '@/security/CredentialVault';

/**
 * MasterPasswordGate — renders a password prompt overlay when
 * master password is enabled. Fires onUnlock when correct.
 *
 * @param {{ onUnlock: () => void, onSkip?: () => void }} props
 */
export default function MasterPasswordGate({ onUnlock, onSkip }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter your master password');
      return;
    }

    setLoading(true);
    setError('');

    // Small delay for UX
    await new Promise(r => setTimeout(r, 200));

    const success = unlockWithPassword(password);
    setLoading(false);

    if (success) {
      onUnlock();
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
  }, [password, onUnlock]);

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        {/* Lock icon */}
        <div style={styles.iconWrap}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h2 style={styles.title}>Master Password Required</h2>
        <p style={styles.subtitle}>
          Enter your master password to unlock API keys and broker credentials.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter master password..."
            autoFocus
            disabled={loading}
            style={styles.input}
          />

          {error && <p style={styles.error}>{error}</p>}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            style={{
              ...styles.button,
              opacity: loading || !password.trim() ? 0.5 : 1,
            }}
          >
            {loading ? 'Unlocking...' : 'Unlock'}
          </button>
        </form>

        {onSkip && (
          <button onClick={onSkip} style={styles.skipButton}>
            Skip — Continue without API keys
          </button>
        )}

        <p style={styles.hint}>
          Forgot your password? You'll need to re-enter your API keys in Settings.
        </p>
      </div>
    </div>
  );
}

/**
 * Hook to check if master password gate should be shown.
 * @returns {{ needsPassword: boolean, onUnlock: () => void, onSkip: () => void }}
 */
export function useMasterPasswordGate() {
  const [needsPassword, setNeedsPassword] = useState(() => hasMasterPassword());
  const onUnlock = useCallback(() => setNeedsPassword(false), []);
  const onSkip = useCallback(() => setNeedsPassword(false), []);
  return { needsPassword, onUnlock, onSkip };
}

// ─── Styles ─────────────────────────────────────────────────────

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(12px)',
    zIndex: 99999,
  },
  card: {
    background: 'var(--color-surface, #18181b)',
    border: '1px solid var(--color-border, #27272a)',
    borderRadius: '16px',
    padding: '2.5rem 2rem',
    maxWidth: '420px',
    width: '100%',
    textAlign: 'center',
    color: 'var(--color-text, #fafafa)',
  },
  iconWrap: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'var(--color-accent-bg, rgba(232, 100, 44, 0.15))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1.25rem',
    color: 'var(--color-accent, #e8642c)',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 600,
    margin: '0 0 0.5rem',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'var(--color-text-secondary, #a1a1aa)',
    margin: '0 0 1.5rem',
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  input: {
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    border: '1px solid var(--color-border, #27272a)',
    background: 'var(--color-surface-elevated, #27272a)',
    color: 'var(--color-text, #fafafa)',
    fontSize: '0.9375rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
  error: {
    color: '#ef4444',
    fontSize: '0.8125rem',
    margin: 0,
  },
  button: {
    padding: '0.75rem 1.5rem',
    borderRadius: '8px',
    border: 'none',
    background: 'var(--color-accent, #e8642c)',
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.9375rem',
    cursor: 'pointer',
    transition: 'opacity 150ms',
  },
  skipButton: {
    marginTop: '1rem',
    padding: '0.5rem',
    border: 'none',
    background: 'none',
    color: 'var(--color-text-secondary, #a1a1aa)',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  hint: {
    marginTop: '1.5rem',
    fontSize: '0.75rem',
    color: 'var(--color-text-tertiary, #71717a)',
    lineHeight: 1.4,
  },
};
