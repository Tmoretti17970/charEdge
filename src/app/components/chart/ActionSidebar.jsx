import React, { useState, useRef, useEffect, Suspense } from 'react';
import AIOrb from '../design/AIOrb.jsx';
import useHotkeys from '@/hooks/useHotkeys';

// Lazy-load sidebar content
const AICopilotBar = React.lazy(() => import('./AICopilotBar.jsx'));
const _CopilotStreamBar = React.lazy(() => import('./CopilotStreamBar.jsx'));

// ─── Tab Definitions ──────────────────────────────────────────────
const SIDEBAR_TABS = [
    { id: 'copilot', label: 'AI Copilot', icon: null },
    { id: 'strategy', label: 'Strategy', icon: '⬡' },
];

export default function ActionSidebar({ isOpen, onClose, activePanel }) {
    const [activeTab, setActiveTab] = useState(activePanel || 'copilot');
    const [mounted, setMounted] = useState(false);
    const panelRef = useRef(null);

    // Sync tab when parent changes active panel
    useEffect(() => {
        if (activePanel) setActiveTab(activePanel);
    }, [activePanel]);

    // Mount/unmount with animation delay
    useEffect(() => {
        if (isOpen) {
            setMounted(true);
        } else {
            const t = setTimeout(() => setMounted(false), 350);
            return () => clearTimeout(t);
        }
    }, [isOpen]);

    // Click-outside to close
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                onClose();
            }
        };
        const t = setTimeout(() => {
            document.addEventListener('mousedown', handler);
        }, 80);
        return () => {
            clearTimeout(t);
            document.removeEventListener('mousedown', handler);
        };
    }, [isOpen, onClose]);

    // Escape to close (via useHotkeys — respects scope priority)
    useHotkeys(
        [{ key: 'Escape', handler: onClose, description: 'Close action sidebar' }],
        { scope: 'panel', enabled: isOpen },
    );

    if (!mounted && !isOpen) return null;

    return (
        <div
            ref={panelRef}
            className="tf-action-sidebar"
            role="complementary"
            aria-label="Action Sidebar"
            style={{
                transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
            }}
        >
            {/* ─── Header with Tabs ────────────────────────── */}
            <div className="tf-action-sidebar-header">
                <div className="tf-action-sidebar-tabs">
                    {SIDEBAR_TABS.map(tab => (
                        <button
                            key={tab.id}
                            className="tf-action-sidebar-tab"
                            data-active={activeTab === tab.id || undefined}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <span style={{ fontSize: 11, opacity: 0.7 }}>{tab.id === 'copilot' ? <AIOrb size={14} /> : tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>
                <button
                    className="tf-action-sidebar-close"
                    onClick={onClose}
                    aria-label="Close sidebar"
                >
                    ✕
                </button>
            </div>

            {/* ─── Content ─────────────────────────────────── */}
            <div className="tf-action-sidebar-content">
                <Suspense fallback={
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        height: 120, color: 'var(--tf-t3)', fontSize: 12,
                        fontFamily: 'var(--tf-font)',
                    }}>
                        Loading…
                    </div>
                }>
                    {activeTab === 'copilot' && <AICopilotBar />}
                    {activeTab === 'strategy' && (
                        <div style={{
                            padding: 16, color: 'var(--tf-t2)', fontSize: 13,
                            fontFamily: 'var(--tf-font)', lineHeight: 1.5,
                        }}>
                            <div style={{ fontWeight: 600, color: 'var(--tf-t1)', marginBottom: 8 }}>
                                Strategy Builder
                            </div>
                            <p style={{ margin: 0, opacity: 0.8 }}>
                                Open the Strategy Builder from the Command Center to design, backtest, and deploy trading strategies.
                            </p>
                        </div>
                    )}
                </Suspense>
            </div>
        </div>
    );
}
