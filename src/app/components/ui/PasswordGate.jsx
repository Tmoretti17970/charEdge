// ═══════════════════════════════════════════════════════════════════
// charEdge — Password Gate (friends-only access)
// Simple overlay that blocks the app until the correct code is entered.
// Stores auth in sessionStorage so it persists per tab session.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useEffect, useRef } from 'react';

const PASS = 'Charts2026';
const STORAGE_KEY = 'ce_auth';

export default function PasswordGate({ children }) {
    const [authed, setAuthed] = useState(() => {
        try { return sessionStorage.getItem(STORAGE_KEY) === '1'; }
        catch { return false; }
    });
    const [value, setValue] = useState('');
    const [error, setError] = useState(false);
    const [shake, setShake] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!authed && inputRef.current) inputRef.current.focus();
    }, [authed]);

    const handleSubmit = useCallback((e) => {
        e.preventDefault();
        if (value === PASS) {
            try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch { }
            setAuthed(true);
        } else {
            setError(true);
            setShake(true);
            setTimeout(() => setShake(false), 500);
            setValue('');
        }
    }, [value]);

    if (authed) return children;

    return (
        <div style={styles.backdrop}>
            <form onSubmit={handleSubmit} style={{
                ...styles.card,
                animation: shake ? 'ce-shake 0.4s ease-in-out' : 'ce-fadeUp 0.4s ease-out',
            }}>
                {/* Logo */}
                <div style={styles.logoWrap}>
                    <div style={styles.logo}>CE</div>
                    <div style={styles.glow} />
                </div>
                <h1 style={styles.title}>charEdge</h1>
                <p style={styles.subtitle}>Private Preview</p>

                <input
                    ref={inputRef}
                    type="password"
                    placeholder="Enter access code"
                    value={value}
                    onChange={(e) => { setValue(e.target.value); setError(false); }}
                    style={{
                        ...styles.input,
                        borderColor: error ? '#ef4444' : 'rgba(255,255,255,0.1)',
                    }}
                    autoComplete="off"
                />

                {error && <p style={styles.error}>Incorrect code. Try again.</p>}

                <button type="submit" style={styles.button}>
                    Enter
                </button>
            </form>

            {/* Shake keyframes */}
            <style>{`
        @keyframes ce-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-12px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(4px); }
        }
        @keyframes ce-fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ce-glow-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%      { opacity: 0.7; transform: scale(1.15); }
        }
      `}</style>
        </div>
    );
}

const styles = {
    backdrop: {
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at 50% 30%, #1a1a2e 0%, #0a0a0f 100%)',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
    card: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '48px 40px 36px',
        borderRadius: 20,
        background: 'rgba(20, 20, 35, 0.85)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
        width: '90%',
        maxWidth: 380,
    },
    logoWrap: {
        position: 'relative',
        marginBottom: 16,
    },
    logo: {
        width: 56,
        height: 56,
        borderRadius: 14,
        background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: 20,
        color: '#fff',
        letterSpacing: '-0.5px',
        boxShadow: '0 4px 20px rgba(245,158,11,0.35)',
    },
    glow: {
        position: 'absolute',
        inset: -12,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,158,11,0.25) 0%, transparent 70%)',
        animation: 'ce-glow-pulse 3s ease-in-out infinite',
        pointerEvents: 'none',
    },
    title: {
        margin: 0,
        fontSize: 24,
        fontWeight: 700,
        color: '#f0f0f5',
        letterSpacing: '-0.5px',
    },
    subtitle: {
        margin: '6px 0 28px',
        fontSize: 13,
        color: 'rgba(255,255,255,0.4)',
        letterSpacing: '0.5px',
    },
    input: {
        width: '100%',
        padding: '12px 16px',
        fontSize: 15,
        fontFamily: "'Inter', sans-serif",
        color: '#f0f0f5',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        outline: 'none',
        textAlign: 'center',
        letterSpacing: '2px',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxSizing: 'border-box',
    },
    error: {
        margin: '10px 0 0',
        fontSize: 12,
        color: '#ef4444',
        fontWeight: 500,
    },
    button: {
        marginTop: 18,
        width: '100%',
        padding: '12px 0',
        fontSize: 14,
        fontWeight: 600,
        fontFamily: "'Inter', sans-serif",
        color: '#fff',
        background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
        border: 'none',
        borderRadius: 10,
        cursor: 'pointer',
        transition: 'opacity 0.2s, transform 0.15s',
        boxShadow: '0 4px 16px rgba(245,158,11,0.3)',
    },
};
