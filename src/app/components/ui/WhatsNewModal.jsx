// ═══════════════════════════════════════════════════════════════════
// charEdge — What's New Modal
//
// Phase 6 Task 6.2.4: Shows changelog entries when the app version
// changes. Auto-triggers on version bump, dismissable.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, memo } from 'react';

const STORAGE_KEY = 'charedge_last_seen_version';

/**
 * Changelog entries. Add new entries at the top.
 * @type {Array<{ version: string, date: string, changes: Array<{ type: string, text: string }> }>}
 */
const CHANGELOG = [
    {
        version: '11.1.0',
        date: '2026-03-06',
        changes: [
            { type: 'feature', text: 'Infinite-canvas minimap — year labels, live-candle beacon, gradient fog-of-war' },
            { type: 'feature', text: 'Stream health border — ambient WS quality glow + latency badge' },
            { type: 'feature', text: 'State architecture diagram — Mermaid-powered Zustand store map' },
            { type: 'improvement', text: 'CI gates — axe-core accessibility, frame-time regression, web-vitals, benchmark guards' },
            { type: 'improvement', text: 'README rewrite — hero section, quick start, tech stack, project structure' },
            { type: 'improvement', text: 'Configuration schema — JSDoc typedefs for all chart constants' },
            { type: 'improvement', text: 'Launch playbook — Product Hunt, Discord, Reddit, Twitter templates' },
        ],
    },
    {
        version: '11.0.0',
        date: '2026-03-04',
        changes: [
            { type: 'feature', text: 'GPU context loss recovery and shader warm-up' },
            { type: 'feature', text: 'View Transitions API for smooth page morphs' },
            { type: 'feature', text: 'oklch() brand color palette' },
            { type: 'feature', text: 'High contrast mode support' },
            { type: 'feature', text: 'Screen reader chart data table' },
            { type: 'feature', text: 'JWT authentication with refresh tokens' },
            { type: 'feature', text: 'Prometheus metrics endpoint' },
            { type: 'improvement', text: 'Exit animations for dismissable elements' },
            { type: 'improvement', text: 'Price tick flash (green ↑ / red ↓)' },
            { type: 'improvement', text: 'Stagger list entrance animations' },
        ],
    },
];

const TYPE_ICONS = {
    feature: '✨',
    improvement: '⚡',
    fix: '🐛',
    breaking: '⚠️',
};

const TYPE_COLORS = {
    feature: 'var(--c-accent-green, #26A69A)',
    improvement: 'var(--c-accent-blue, #2196F3)',
    fix: 'var(--c-accent-amber, #FFC107)',
    breaking: 'var(--c-accent-red, #EF5350)',
};

const WhatsNewModal = memo(function WhatsNewModal({ currentVersion = '11.1.0' }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const lastSeen = localStorage.getItem(STORAGE_KEY);
        if (lastSeen !== currentVersion && CHANGELOG.length > 0) {
            setVisible(true);
        }
    }, [currentVersion]);

    const dismiss = () => {
        localStorage.setItem(STORAGE_KEY, currentVersion);
        setVisible(false);
    };

    if (!visible) return null;

    const latest = CHANGELOG[0];

    return (
        <div
            role="dialog"
            aria-label="What's New"
            aria-modal="true"
            style={overlayStyle}
            onClick={dismiss}
        >
            <div style={modalStyle} onClick={e => e.stopPropagation()}>
                <div style={headerStyle}>
                    <h2 style={{ margin: 0, fontSize: 'var(--fs-xl, 20px)' }}>
                        🎉 What's New in v{latest.version}
                    </h2>
                    <button onClick={dismiss} style={closeStyle} aria-label="Close">✕</button>
                </div>

                <p style={{ color: 'var(--c-fg-secondary, #8b8fa2)', fontSize: 'var(--fs-sm, 13px)', margin: '0 0 16px' }}>
                    {latest.date}
                </p>

                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {latest.changes.map((c, i) => (
                        <li key={i} style={changeStyle}>
                            <span style={{ marginRight: 8 }}>{TYPE_ICONS[c.type] || '•'}</span>
                            <span style={{ color: TYPE_COLORS[c.type], fontWeight: 500, marginRight: 6, fontSize: 'var(--fs-xs, 11px)', textTransform: 'uppercase' }}>
                                {c.type}
                            </span>
                            <span>{c.text}</span>
                        </li>
                    ))}
                </ul>

                <button onClick={dismiss} style={ctaStyle}>Got it!</button>
            </div>
        </div>
    );
});

const overlayStyle = {
    position: 'fixed', inset: 0, zIndex: 'var(--z-modal, 400)',
    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    animation: 'fadeIn 200ms ease-out',
};

const modalStyle = {
    background: 'var(--c-bg-secondary, #0e1013)', borderRadius: 'var(--br-lg, 12px)',
    border: '1px solid var(--c-border, #2a2e3a)', padding: 24,
    maxWidth: 480, width: '90vw', maxHeight: '80vh', overflow: 'auto',
    animation: 'fadeInUp 250ms ease-out',
};

const headerStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
};

const closeStyle = {
    background: 'none', border: 'none', color: 'var(--c-fg-tertiary, #7078a0)',
    fontSize: 18, cursor: 'pointer', padding: 4,
};

const changeStyle = {
    display: 'flex', alignItems: 'center', padding: '6px 0',
    fontSize: 'var(--fs-sm, 13px)', color: 'var(--c-fg-primary, #ececef)',
    borderBottom: '1px solid var(--c-border, rgba(42,46,58,0.4))',
};

const ctaStyle = {
    marginTop: 16, width: '100%', padding: '10px 16px',
    background: 'var(--c-accent-blue, #2196F3)', color: '#fff',
    border: 'none', borderRadius: 'var(--br-md, 8px)',
    fontSize: 'var(--fs-base, 15px)', fontWeight: 600, cursor: 'pointer',
};

export default WhatsNewModal;
