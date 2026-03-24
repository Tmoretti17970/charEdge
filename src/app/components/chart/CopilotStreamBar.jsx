// ═══════════════════════════════════════════════════════════════════
// charEdge — CopilotStreamBar (Task 4.2.2)
//
// Compact real-time insight bar below chart toolbar.
// Shows: condition chip + momentum + volume + streaming narrative.
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import useCopilotPipeline from '../../../hooks/useCopilotPipeline';
import AIOrb from '../design/AIOrb.jsx';
import s from './CopilotStreamBar.module.css';

function chipColor(label) {
    if (label.includes('Trending Up') || label.includes('🚀')) return { bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.2)', color: '#34d399' };
    if (label.includes('Trending Down') || label.includes('🔻')) return { bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.2)', color: '#f87171' };
    if (label.includes('Reversal') || label.includes('⚠️')) return { bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.2)', color: '#fb923c' };
    if (label.includes('Consolidation') || label.includes('💤')) return { bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.2)', color: '#94a3b8' };
    return { bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.2)', color: '#60a5fa' };
}

export default function CopilotStreamBar() {
    const { features, momentumLabel, volatilityLabel, volumeLabel, conditionLabel, narrative, loading, requestNarrative } = useCopilotPipeline();
    const [expanded, setExpanded] = useState(false);

    const handleAsk = useCallback(async () => { await requestNarrative(); setExpanded(true); }, [requestNarrative]);

    if (!features) {
        return (
            <div className={s.bar}>
                <span className={s.dimLabel} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AIOrb size={14} /> Co-Pilot waiting for data…</span>
            </div>
        );
    }

    const cc = chipColor(conditionLabel);

    return (
        <>
            <div className={s.bar}>
                <div className={s.chip} style={{ background: cc.bg, border: `1px solid ${cc.border}`, color: cc.color }}>{conditionLabel}</div>
                <div className={s.sep} />
                <span className={s.dimLabel}>{momentumLabel}</span>
                <span className={s.dimLabel}>{volatilityLabel}</span>
                <span className={s.dimLabel}>{volumeLabel}</span>
                <div className={s.spacer} />
                {narrative && !expanded ? (
                    <button onClick={() => setExpanded(true)} className={s.linkBtn}>Show analysis</button>
                ) : !narrative ? (
                    <button onClick={handleAsk} disabled={loading} className={s.askBtn} data-loading={loading || undefined}>
                        {loading ? '⏳ Analyzing…' : <><AIOrb size={12} style={{ marginRight: 4 }} /> Ask Co-Pilot</>}
                    </button>
                ) : (
                    <button onClick={() => setExpanded(false)} className={s.linkBtn}>▲ Collapse</button>
                )}
            </div>
            {expanded && narrative && <div className={s.expandPanel}>{narrative}</div>}
        </>
    );
}

export { CopilotStreamBar };
