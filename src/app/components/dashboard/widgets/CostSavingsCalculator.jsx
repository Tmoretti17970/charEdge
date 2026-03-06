// ═══════════════════════════════════════════════════════════════════
// charEdge — Cost Savings Calculator (Task 4.9.4.1)
//
// Marketing widget: side-by-side comparison of charEdge vs
// Bloomberg, LSEG Eikon, CapIQ, and TradingView.
// Input: user's usage level → Output: annual savings.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react';

// ─── Data ───────────────────────────────────────────────────────

const COMPETITORS = [
    {
        name: 'Bloomberg Terminal',
        annual: 31_980,
        features: ['real-time', 'analytics', 'news', 'execution', 'research'],
        color: '#F5A623',
    },
    {
        name: 'LSEG Eikon',
        annual: 22_000,
        features: ['real-time', 'analytics', 'news', 'research'],
        color: '#0064A4',
    },
    {
        name: 'S&P Capital IQ',
        annual: 25_000,
        features: ['analytics', 'research', 'screening'],
        color: '#E31937',
    },
    {
        name: 'TradingView Premium',
        annual: 720,
        features: ['real-time', 'analytics', 'charting'],
        color: '#2962FF',
    },
];

const CHAREDGE_TIERS = [
    { id: 'free', label: 'Free', annual: 0 },
    { id: 'pro', label: 'Pro', annual: 180 },
    { id: 'institutional', label: 'Institutional', annual: 960 },
];

const FEATURE_LIST = [
    { id: 'real-time', label: 'Real-time data', charEdge: true },
    { id: 'analytics', label: 'Advanced analytics', charEdge: true },
    { id: 'ai-insights', label: 'AI behavioral insights', charEdge: true },
    { id: 'webgpu', label: 'WebGPU rendering', charEdge: true },
    { id: 'journal', label: 'Integrated journal', charEdge: true },
    { id: 'replay', label: 'Historical replay', charEdge: true },
    { id: 'gamification', label: 'Gamified learning', charEdge: true },
    { id: 'offline', label: 'Offline mode', charEdge: true },
    { id: 'news', label: 'News terminal', charEdge: false },
    { id: 'execution', label: 'Direct execution', charEdge: false },
    { id: 'research', label: 'Equity research', charEdge: false },
    { id: 'screening', label: 'Stock screening', charEdge: false },
];

// ─── Component ──────────────────────────────────────────────────

export default function CostSavingsCalculator() {
    const [selectedTier, setSelectedTier] = useState('pro');

    const tier = useMemo(
        () => CHAREDGE_TIERS.find((t) => t.id === selectedTier) || CHAREDGE_TIERS[1],
        [selectedTier],
    );

    const maxSavings = COMPETITORS[0].annual - tier.annual;

    return React.createElement('div', {
        className: 'cost-savings-calculator',
        style: {
            background: 'var(--tf-bg-card, #1a1a2e)',
            borderRadius: '16px',
            padding: '32px',
            color: 'var(--tf-text, #e0e0e0)',
            fontFamily: 'Inter, system-ui, sans-serif',
        },
    },
        // Header
        React.createElement('h2', {
            style: {
                fontSize: '24px',
                fontWeight: 700,
                marginBottom: '8px',
                background: 'linear-gradient(135deg, #e8642c, #f0b64e)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
            },
        }, 'How Much Could You Save?'),

        React.createElement('p', {
            style: { color: 'var(--tf-text-muted, #888)', marginBottom: '24px', fontSize: '14px' },
        }, 'charEdge delivers institutional-grade tools at a fraction of the cost'),

        // Tier selector
        React.createElement('div', {
            style: { display: 'flex', gap: '8px', marginBottom: '32px' },
        },
            ...CHAREDGE_TIERS.map((t) =>
                React.createElement('button', {
                    key: t.id,
                    onClick: () => setSelectedTier(t.id),
                    style: {
                        padding: '8px 20px',
                        borderRadius: '8px',
                        border: selectedTier === t.id ? '2px solid var(--tf-accent, #e8642c)' : '1px solid rgba(255,255,255,0.1)',
                        background: selectedTier === t.id ? 'rgba(232,100,44,0.15)' : 'transparent',
                        color: 'inherit',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: selectedTier === t.id ? 600 : 400,
                        transition: 'all 0.2s',
                    },
                }, `${t.label} — $${t.annual === 0 ? '0' : `${t.annual}/yr`}`),
            ),
        ),

        // Savings cards
        React.createElement('div', {
            style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '32px',
            },
        },
            ...COMPETITORS.map((comp) => {
                const savings = comp.annual - tier.annual;
                const pct = ((savings / comp.annual) * 100).toFixed(0);
                return React.createElement('div', {
                    key: comp.name,
                    style: {
                        background: 'rgba(255,255,255,0.04)',
                        borderRadius: '12px',
                        padding: '20px',
                        borderLeft: `3px solid ${comp.color}`,
                        transition: 'transform 0.2s',
                    },
                },
                    React.createElement('div', {
                        style: { fontSize: '12px', color: 'var(--tf-text-muted, #888)', marginBottom: '4px' },
                    }, `vs ${comp.name}`),
                    React.createElement('div', {
                        style: { fontSize: '28px', fontWeight: 700, color: '#2dd4a0' },
                    }, `$${savings.toLocaleString()}`),
                    React.createElement('div', {
                        style: { fontSize: '12px', color: 'var(--tf-text-muted, #888)' },
                    }, `${pct}% savings per year`),
                );
            }),
        ),

        // Hero savings
        React.createElement('div', {
            style: {
                textAlign: 'center',
                padding: '24px',
                background: 'linear-gradient(135deg, rgba(45,212,160,0.1), rgba(232,100,44,0.1))',
                borderRadius: '12px',
                marginBottom: '24px',
            },
        },
            React.createElement('div', {
                style: { fontSize: '14px', color: 'var(--tf-text-muted, #888)', marginBottom: '4px' },
            }, 'Max Annual Savings'),
            React.createElement('div', {
                style: { fontSize: '48px', fontWeight: 800, color: '#2dd4a0' },
            }, `$${maxSavings.toLocaleString()}`),
            React.createElement('div', {
                style: { fontSize: '13px', color: 'var(--tf-text-muted, #888)' },
            }, `with charEdge ${tier.label} vs Bloomberg Terminal`),
        ),

        // Feature comparison
        React.createElement('h3', {
            style: { fontSize: '16px', fontWeight: 600, marginBottom: '12px' },
        }, 'Feature Comparison'),
        React.createElement('div', {
            style: { display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '4px 16px', fontSize: '13px' },
        },
            React.createElement('div', { style: { fontWeight: 600, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' } }, 'Feature'),
            React.createElement('div', { style: { fontWeight: 600, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' } }, 'charEdge'),
            React.createElement('div', { style: { fontWeight: 600, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' } }, 'Others'),
            ...FEATURE_LIST.flatMap((f) => [
                React.createElement('div', { key: `${f.id}-label`, style: { padding: '6px 0', color: 'var(--tf-text-muted, #ccc)' } }, f.label),
                React.createElement('div', { key: `${f.id}-ce`, style: { textAlign: 'center', padding: '6px 0' } }, f.charEdge ? '✅' : '—'),
                React.createElement('div', { key: `${f.id}-other`, style: { textAlign: 'center', padding: '6px 0' } }, f.charEdge ? 'Partial' : '✅'),
            ]),
        ),
    );
}

export { COMPETITORS, CHAREDGE_TIERS, FEATURE_LIST };
