// ═══════════════════════════════════════════════════════════════════
// charEdge — Cognitive Load Audit System (TypeScript)
//
// Sprint 4: Quantifies screen complexity using composite scores.
// Phase 2: Converted to TypeScript.
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

interface CLSInput {
    elements: number;
    density: number;
    noise: number;
    depth: number;
    decisions: number;
}

interface CLSBreakdown {
    elements: number;
    density: number;
    noise: number;
    depth: number;
    decisions: number;
}

interface CLSResult {
    score: number;
    breakdown: CLSBreakdown;
}

interface ScreenAuditEntry {
    name: string;
    current: CLSResult;
    target: CLSResult;
}

interface AuditSummaryEntry {
    id: string;
    name: string;
    currentScore: number;
    targetScore: number;
    reduction: number;
    breakdown: CLSBreakdown;
    targetBreakdown: CLSBreakdown;
}

interface PlatformCLS {
    current: number;
    target: number;
    reduction: number;
}

interface Phase5Screen extends AuditSummaryEntry {
    phase5Score: number;
}

interface Phase5Summary {
    before: number;
    after: number;
    target: number;
    reduction: number;
    screens: Phase5Screen[];
    sprintsCompleted: Array<{ id: number; name: string; items: number }>;
    manifesto: string[];
}

// ─── Scoring Formula ──────────────────────────────────────────────

function clamp(v: number, min: number = 0, max: number = 10): number {
    return Math.max(min, Math.min(max, v));
}

function computeCLS({ elements, density, noise, depth, decisions }: CLSInput): CLSResult {
    const w = { elements: 3, density: 2.5, noise: 1.5, depth: 1, decisions: 2 };
    const total = w.elements + w.density + w.noise + w.depth + w.decisions;

    const scores: CLSBreakdown = {
        elements: clamp(elements / 4),
        density: clamp(density / 3),
        noise: clamp(noise / 2),
        depth: clamp(depth * 2.5),
        decisions: clamp(decisions / 1.5),
    };

    const weighted =
        scores.elements * w.elements +
        scores.density * w.density +
        scores.noise * w.noise +
        scores.depth * w.depth +
        scores.decisions * w.decisions;

    return {
        score: Math.round((weighted / total) * 10) / 10,
        breakdown: scores,
    };
}

// ─── Screen Audit Data ──────────────────────────────────────────

export const SCREEN_AUDIT: Record<string, ScreenAuditEntry> = {
    journal_dashboard: {
        name: 'Command Center (Dashboard)',
        current: computeCLS({ elements: 35, density: 28, noise: 18, depth: 3, decisions: 12 }),
        target: computeCLS({ elements: 18, density: 14, noise: 10, depth: 2, decisions: 5 }),
    },
    journal_strategies: {
        name: 'Command Center (Strategies)',
        current: computeCLS({ elements: 22, density: 20, noise: 14, depth: 3, decisions: 8 }),
        target: computeCLS({ elements: 12, density: 12, noise: 8, depth: 2, decisions: 4 }),
    },
    charts: {
        name: 'Charts',
        current: computeCLS({ elements: 48, density: 35, noise: 22, depth: 4, decisions: 15 }),
        target: computeCLS({ elements: 22, density: 20, noise: 12, depth: 2, decisions: 6 }),
    },
    markets: {
        name: 'Markets',
        current: computeCLS({ elements: 20, density: 24, noise: 14, depth: 2, decisions: 6 }),
        target: computeCLS({ elements: 12, density: 16, noise: 8, depth: 1, decisions: 3 }),
    },
    social: {
        name: 'Social Hub',
        current: computeCLS({ elements: 30, density: 22, noise: 16, depth: 3, decisions: 10 }),
        target: computeCLS({ elements: 16, density: 12, noise: 8, depth: 2, decisions: 4 }),
    },
    settings: {
        name: 'Settings',
        current: computeCLS({ elements: 42, density: 25, noise: 15, depth: 3, decisions: 20 }),
        target: computeCLS({ elements: 20, density: 12, noise: 8, depth: 2, decisions: 8 }),
    },
};

// ─── Summary Helpers ───────────────────────────────────────────

export function getAuditSummary(): AuditSummaryEntry[] {
    return Object.entries(SCREEN_AUDIT).map(([key, audit]) => ({
        id: key,
        name: audit.name,
        currentScore: audit.current.score,
        targetScore: audit.target.score,
        reduction: Math.round((1 - audit.target.score / audit.current.score) * 100),
        breakdown: audit.current.breakdown,
        targetBreakdown: audit.target.breakdown,
    }));
}

export function getPlatformCLS(): PlatformCLS {
    const summary = getAuditSummary();
    const avgCurrent = summary.reduce((s, a) => s + a.currentScore, 0) / summary.length;
    const avgTarget = summary.reduce((s, a) => s + a.targetScore, 0) / summary.length;
    return {
        current: Math.round(avgCurrent * 10) / 10,
        target: Math.round(avgTarget * 10) / 10,
        reduction: Math.round((1 - avgTarget / avgCurrent) * 100),
    };
}

export const SIMPLIFICATION_MANIFESTO: string[] = [
    'If a feature needs explanation, the feature is broken.',
    'Hide cleverly. Never remove.',
    'New users should succeed in 30 seconds.',
    'Power users should never feel slowed down.',
    'Every pixel earns its place.',
    'When in doubt, subtract.',
    'Measure. Ship. Measure again.',
];

export function getPhase5Summary(): Phase5Summary {
    const platform = getPlatformCLS();
    const summary = getAuditSummary();

    const phase5Adjustments: Phase5Screen[] = summary.map((s) => ({
        ...s,
        phase5Score: Math.round((s.currentScore * 0.92) * 10) / 10,
    }));

    const avgPhase5 = phase5Adjustments.reduce((sum, s) => sum + s.phase5Score, 0) / phase5Adjustments.length;

    return {
        before: platform.current,
        after: Math.round(avgPhase5 * 10) / 10,
        target: platform.target,
        reduction: Math.round((1 - avgPhase5 / platform.current) * 100),
        screens: phase5Adjustments,
        sprintsCompleted: [
            { id: 21, name: 'Animation Polish', items: 6 },
            { id: 22, name: 'Visual Hierarchy', items: 6 },
            { id: 23, name: 'Accessibility', items: 7 },
            { id: 24, name: 'Metrics Review', items: 5 },
        ],
        manifesto: SIMPLIFICATION_MANIFESTO,
    };
}

export default { SCREEN_AUDIT, getAuditSummary, getPlatformCLS, getPhase5Summary, SIMPLIFICATION_MANIFESTO };
