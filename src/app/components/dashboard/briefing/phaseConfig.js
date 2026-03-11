// ═══════════════════════════════════════════════════════════════════
// Morning Briefing — Phase Configuration
// Session phase detection, greetings, and phase-specific styling.
// ═══════════════════════════════════════════════════════════════════

import { GLASS } from '../../../../constants.js';

// ─── Session Phase Detection ─────────────────────────────────────

export function getSessionPhase() {
    const h = new Date().getHours();
    const m = new Date().getMinutes();
    const minutes = h * 60 + m;
    if (minutes < 570) return 'pre-market';    // Before 9:30
    if (minutes < 960) return 'active';         // 9:30–4pm
    return 'post-market';                       // After 4pm
}

export function getGreeting(phase) {
    const h = new Date().getHours();
    if (phase === 'pre-market') {
        return h < 5
            ? { emoji: '🌙', text: 'Night Owl', sub: 'Burning the midnight oil? Prep your edge for tomorrow.' }
            : { emoji: '☀️', text: 'Good Morning', sub: 'Markets open soon. Review your plan and set your levels.' };
    }
    if (phase === 'active') {
        return { emoji: '📊', text: 'Session Active', sub: 'Markets are live. Stay disciplined, follow your rules.' };
    }
    return h < 20
        ? { emoji: '📋', text: 'Session Wrap', sub: 'Markets closed. Time to review and journal your trades.' }
        : { emoji: '🌙', text: 'Good Evening', sub: 'Tomorrow is a new opportunity. Rest up.' };
}

// ─── Phase Styling Config ────────────────────────────────────────

export const PHASE_CONFIG = {
    'pre-market': {
        gradient: () => 'linear-gradient(135deg, rgba(232,100,44,0.06), rgba(255,152,0,0.03))',
        glass: GLASS.standard,
        blur: GLASS.blurMd,
        border: () => `1px solid rgba(232,100,44,0.15)`,
        accent: (c) => c.o,
        label: 'PRE-MARKET',
        labelBg: (c) => `${c.o}15`,
        dot: (c) => c.o,
        orbColor: 'rgba(232,100,44,0.15)',
    },
    active: {
        gradient: () => 'linear-gradient(135deg, rgba(45,212,160,0.06), rgba(38,166,154,0.03))',
        glass: GLASS.standard,
        blur: GLASS.blurMd,
        border: () => `1px solid rgba(45,212,160,0.12)`,
        accent: (c) => c.g,
        label: 'LIVE SESSION',
        labelBg: (c) => `${c.g}15`,
        dot: (c) => c.g,
        orbColor: 'rgba(45,212,160,0.12)',
    },
    'post-market': {
        gradient: () => 'linear-gradient(135deg, rgba(192,132,252,0.06), rgba(124,58,237,0.03))',
        glass: GLASS.standard,
        blur: GLASS.blurMd,
        border: () => `1px solid rgba(192,132,252,0.12)`,
        accent: (c) => c.p,
        label: 'POST-MARKET',
        labelBg: (c) => `${c.p}15`,
        dot: (c) => c.p,
        orbColor: 'rgba(192,132,252,0.12)',
    },
};

// ─── Helpers ─────────────────────────────────────────────────────

export function startOfDay(d) {
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    return dt;
}

export function daysBetween(a, b) {
    return Math.floor((startOfDay(b) - startOfDay(a)) / 86400000);
}
