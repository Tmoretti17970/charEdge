// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Behavioral Alert (Sprint 5)
//
// Floating mini-card that surfaces behavioral warnings
// (FOMO, tilt, overtrading) anchored bottom-right of chart.
// Uses AI Design Kit tokens for consistent brand identity.
//
// Props:
//   alert  - { type, severity, icon, title, message, timestamp }
//   onDismiss - callback when dismissed
//   autoDismissMs - auto-dismiss after N ms (default: 10000)
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState, useCallback } from 'react';

const SEVERITY_CONFIG = {
    high: {
        borderColor: 'var(--ai-glow-error, #ff453a)',
        bgGradient: 'linear-gradient(135deg, rgba(255, 69, 58, 0.08), rgba(255, 69, 58, 0.02))',
        orbState: 'error',
    },
    mid: {
        borderColor: 'var(--ai-glow-2, #f0b64e)',
        bgGradient: 'linear-gradient(135deg, rgba(240, 182, 78, 0.08), rgba(240, 182, 78, 0.02))',
        orbState: 'thinking',
    },
    low: {
        borderColor: 'var(--ai-glow-1, #6e5ce6)',
        bgGradient: 'linear-gradient(135deg, rgba(110, 92, 230, 0.06), rgba(110, 92, 230, 0.01))',
        orbState: 'idle',
    },
};

/**
 * @param {{ alert: Object, onDismiss: Function, autoDismissMs?: number }} props
 */
export default function AIBehavioralAlert({ alert, onDismiss, autoDismissMs = 10000 }) {
    const [visible, setVisible] = useState(false);
    const [exiting, setExiting] = useState(false);
    const timerRef = useRef(null);

    // Enter animation
    useEffect(() => {
        if (alert) {
            requestAnimationFrame(() => setVisible(true));
            // Auto-dismiss
            timerRef.current = setTimeout(() => {
                handleDismiss();
            }, autoDismissMs);
            return () => clearTimeout(timerRef.current);
        }
    }, [alert]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleDismiss = useCallback(() => {
        setExiting(true);
        setTimeout(() => {
            setVisible(false);
            setExiting(false);
            onDismiss?.();
        }, 300);
    }, [onDismiss]);

    if (!alert) return null;

    const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low;

    return (
        <div
            id="ai-behavioral-alert"
            style={{
                position: 'absolute',
                bottom: 48,
                right: 16,
                zIndex: 900,
                maxWidth: 340,
                minWidth: 260,
                borderRadius: 12,
                border: `1px solid ${config.borderColor}`,
                background: config.bgGradient,
                backdropFilter: 'blur(20px) saturate(1.4)',
                WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
                boxShadow: `0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 20px ${config.borderColor}20`,
                padding: '12px 14px',
                fontFamily: "'Inter', -apple-system, sans-serif",
                transition: 'all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                transform: visible && !exiting ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
                opacity: visible && !exiting ? 1 : 0,
                pointerEvents: visible ? 'auto' : 'none',
            }}
        >
            {/* Header Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                {/* Orb dot (simplified — just a glowing dot) */}
                <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: config.borderColor,
                    boxShadow: `0 0 8px ${config.borderColor}`,
                    animation: alert.severity === 'high' ? 'aiPulse 1.5s ease-in-out infinite' : undefined,
                    flexShrink: 0,
                }} />
                <span style={{ fontSize: 15, lineHeight: 1 }}>{alert.icon}</span>
                <span style={{
                    fontSize: 12, fontWeight: 700,
                    color: 'var(--text-primary, #f5f5f7)',
                    letterSpacing: '-0.01em',
                    flex: 1,
                }}>
                    {alert.title}
                </span>
                <button
                    onClick={handleDismiss}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-tertiary, #86868b)',
                        fontSize: 14, padding: '0 2px', lineHeight: 1,
                        opacity: 0.6,
                        transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; }}
                    aria-label="Dismiss alert"
                >
                    ✕
                </button>
            </div>

            {/* Message */}
            <div style={{
                fontSize: 11,
                lineHeight: 1.5,
                color: 'var(--text-secondary, #a1a1a6)',
                paddingLeft: 16, // align with text after orb
            }}>
                {alert.message}
            </div>

            {/* Progress bar (auto-dismiss countdown) */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 12,
                right: 12,
                height: 2,
                borderRadius: 1,
                background: 'rgba(255,255,255,0.05)',
                overflow: 'hidden',
            }}>
                <div style={{
                    width: '100%',
                    height: '100%',
                    background: config.borderColor,
                    opacity: 0.4,
                    animation: `aiAlertCountdown ${autoDismissMs}ms linear forwards`,
                    transformOrigin: 'left',
                }} />
            </div>
        </div>
    );
}
