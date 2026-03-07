// ═══════════════════════════════════════════════════════════════════
// charEdge — Settings Tab Shell
// Reusable tabbed dialog shell for indicator and drawing settings.
// Provides: header (title + icon + close), animated tab bar with
// keyboard nav, scrollable body, footer (Cancel/Ok + extras).
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { C, F, M, GLASS, DEPTH } from '../../../constants.js';

/**
 * @param {Object} props
 * @param {string} props.title - Dialog title text
 * @param {string} [props.iconColor] - Colored dot in header
 * @param {{ id: string, label: string, icon?: React.ReactNode }[]} props.tabs
 * @param {string} props.activeTab - Currently active tab id
 * @param {(tabId: string) => void} props.onTabChange
 * @param {() => void} props.onClose
 * @param {() => void} [props.onOk] - Ok / Done button handler (defaults to onClose)
 * @param {() => void} [props.onCancel] - Cancel handler (defaults to onClose)
 * @param {React.ReactNode} [props.footerExtra] - Extra footer content (e.g. template controls)
 * @param {React.ReactNode} props.children - Active tab content
 */
export default function SettingsTabShell({
    title,
    iconColor,
    tabs,
    activeTab,
    onTabChange,
    onClose,
    onOk,
    onCancel,
    footerExtra,
    children,
}) {
    const dialogRef = useRef(null);
    const tabBarRef = useRef(null);

    // ─── Close on Escape ──────────────────────────────────────────
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    // ─── Close on outside click ───────────────────────────────────
    useEffect(() => {
        const onClick = (e) => {
            if (dialogRef.current && !dialogRef.current.contains(e.target)) onClose();
        };
        const timer = setTimeout(() => window.addEventListener('mousedown', onClick), 100);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('mousedown', onClick);
        };
    }, [onClose]);

    // ─── Tab keyboard navigation ──────────────────────────────────
    const handleTabKeyDown = useCallback((e) => {
        const idx = tabs.findIndex((t) => t.id === activeTab);
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            const next = (idx + 1) % tabs.length;
            onTabChange(tabs[next].id);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = (idx - 1 + tabs.length) % tabs.length;
            onTabChange(tabs[prev].id);
        }
    }, [tabs, activeTab, onTabChange]);

    // ─── Active tab underline position ────────────────────────────
    const activeIdx = tabs.findIndex((t) => t.id === activeTab);
    const tabWidth = tabs.length > 0 ? 100 / tabs.length : 100;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(4px)',
            }}
        >
            <div
                ref={dialogRef}
                className="settings-tab-shell"
                style={{
                    width: 380,
                    maxHeight: '80vh',
                    background: GLASS.solid,
                    borderRadius: 14,
                    border: `1px solid ${C.bd}`,
                    boxShadow: DEPTH[3],
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    animation: 'settingsShellFadeIn 0.18s ease-out',
                }}
            >
                {/* ─── Header ────────────────────────────────────────── */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '14px 16px 0',
                    }}
                >
                    {iconColor && (
                        <div
                            style={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                background: iconColor,
                                flexShrink: 0,
                            }}
                        />
                    )}
                    <span
                        style={{
                            flex: 1,
                            fontSize: 14,
                            fontWeight: 700,
                            fontFamily: F,
                            color: C.t1,
                        }}
                    >
                        {title}
                    </span>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            border: `1px solid ${C.bd}`,
                            background: 'transparent',
                            color: C.t2,
                            fontSize: 14,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.12s ease',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = C.r + '20';
                            e.currentTarget.style.color = C.r;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = C.t2;
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* ─── Tab Bar ───────────────────────────────────────── */}
                <div
                    ref={tabBarRef}
                    role="tablist"
                    style={{
                        display: 'flex',
                        gap: 0,
                        padding: '10px 16px 0',
                        position: 'relative',
                    }}
                >
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            role="tab"
                            aria-selected={activeTab === t.id}
                            tabIndex={activeTab === t.id ? 0 : -1}
                            onClick={() => onTabChange(t.id)}
                            onKeyDown={handleTabKeyDown}
                            style={{
                                flex: 1,
                                padding: '8px 4px 10px',
                                background: 'transparent',
                                border: 'none',
                                borderRadius: 0,
                                color: activeTab === t.id ? C.b : C.t3,
                                fontFamily: F,
                                fontSize: 12,
                                fontWeight: activeTab === t.id ? 600 : 400,
                                cursor: 'pointer',
                                transition: 'color 0.15s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 5,
                            }}
                        >
                            {t.icon && <span style={{ fontSize: 13 }}>{t.icon}</span>}
                            {t.label}
                        </button>
                    ))}

                    {/* Animated underline */}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 16 + activeIdx * ((380 - 32) / tabs.length),
                            width: `calc((100% - 32px) / ${tabs.length})`,
                            height: 2,
                            borderRadius: 1,
                            background: C.b,
                            transition: 'left 0.2s ease, width 0.2s ease',
                        }}
                    />
                </div>

                {/* Tab bar border */}
                <div style={{ height: 1, background: C.bd, margin: '0 16px' }} />

                {/* ─── Body (scrollable) ──────────────────────────────── */}
                <div
                    role="tabpanel"
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '12px 16px',
                        minHeight: 160,
                    }}
                >
                    {children}
                </div>

                {/* ─── Footer ────────────────────────────────────────── */}
                <div
                    style={{
                        padding: '10px 16px 14px',
                        borderTop: `1px solid ${C.bd}`,
                    }}
                >
                    {footerExtra && (
                        <div style={{ marginBottom: 10 }}>{footerExtra}</div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={onCancel || onClose}
                            style={{
                                flex: 1,
                                padding: '8px 12px',
                                borderRadius: 8,
                                border: `1px solid ${C.bd}`,
                                background: 'transparent',
                                color: C.t2,
                                fontFamily: F,
                                fontSize: 12,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = C.r + '15';
                                e.currentTarget.style.borderColor = C.r + '40';
                                e.currentTarget.style.color = C.r;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.borderColor = C.bd;
                                e.currentTarget.style.color = C.t2;
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onOk || onClose}
                            style={{
                                flex: 1,
                                padding: '8px 12px',
                                borderRadius: 8,
                                border: 'none',
                                background: C.b,
                                color: '#fff',
                                fontFamily: F,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                            }}
                        >
                            Ok
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── Keyframes ───────────────────────────────────────── */}
            <style>{`
        @keyframes settingsShellFadeIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
        </div>
    );
}
