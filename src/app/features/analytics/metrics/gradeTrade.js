// ═══════════════════════════════════════════════════════════════════
// Sprint 4: Automated Trade Grading (A+, B, C, F)
// ═══════════════════════════════════════════════════════════════════

/**
 * Analyzes R-Multiple, Playbook Adherence, and Result to assign a grade.
 * @param {Object} t - Trade object
 * @returns {{ grade: string, score: number }}
 */
export function gradeTrade(t) {
    if (!t) return { grade: '?', score: 0 };

    // Rule breaking is an automatic F
    if (t.followedRules === false) return { grade: 'F', score: 0 };

    if (t.rMultiple != null && !isNaN(t.rMultiple)) {
        const r = Number(t.rMultiple);
        if (r >= 2) return { grade: 'A+', score: 5 };
        if (r >= 1) return { grade: 'A', score: 4 };
        if (r >= 0) return { grade: 'B', score: 3 };
        if (r >= -1) return { grade: 'C', score: 2 };
        if (r >= -1.5) return { grade: 'D', score: 1 };
        return { grade: 'F', score: 0 };
    }

    // Fallback heuristics if no R-multiple
    if (t.pnl > 0) return { grade: 'B', score: 3 };
    if (t.pnl === 0) return { grade: 'C', score: 2 };
    if (t.pnl < 0) return { grade: 'D', score: 1 };

    return { grade: '?', score: 0 };
}
