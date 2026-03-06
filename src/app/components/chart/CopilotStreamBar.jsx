// ═══════════════════════════════════════════════════════════════════
// charEdge — CopilotStreamBar (Task 4.2.2)
//
// Compact real-time insight bar below chart toolbar.
// Shows: condition chip + momentum + volume + streaming narrative.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import useCopilotPipeline from '../../../hooks/useCopilotPipeline.ts';

const FONT = 'var(--forge-font, Inter, sans-serif)';
const MONO = 'var(--forge-mono, "JetBrains Mono", monospace)';

const BAR_STYLE = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    background: 'rgba(15, 15, 25, 0.7)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    fontSize: 11,
    fontFamily: FONT,
    color: 'rgba(255, 255, 255, 0.7)',
    minHeight: 32,
    overflow: 'hidden',
};

const CHIP_STYLE = {
    padding: '2px 8px',
    borderRadius: 6,
    fontSize: 10,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    letterSpacing: '0.01em',
};

const EXPAND_PANEL = {
    padding: '12px 16px',
    background: 'rgba(15, 15, 25, 0.85)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    fontSize: 13,
    fontFamily: FONT,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    maxHeight: 300,
    overflowY: 'auto',
};

// Chip color mapping based on condition label
function chipColor(label) {
    if (label.includes('Trending Up') || label.includes('🚀')) return { bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.2)', color: '#34d399' };
    if (label.includes('Trending Down') || label.includes('🔻')) return { bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.2)', color: '#f87171' };
    if (label.includes('Reversal') || label.includes('⚠️')) return { bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.2)', color: '#fb923c' };
    if (label.includes('Consolidation') || label.includes('💤')) return { bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.2)', color: '#94a3b8' };
    return { bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.2)', color: '#60a5fa' };
}

export default function CopilotStreamBar() {
    const {
        features,
        momentumLabel,
        volatilityLabel,
        volumeLabel,
        conditionLabel,
        narrative,
        loading,
        requestNarrative,
    } = useCopilotPipeline();

    const [expanded, setExpanded] = useState(false);

    const handleAsk = useCallback(async () => {
        await requestNarrative();
        setExpanded(true);
    }, [requestNarrative]);

    // No data yet
    if (!features) {
        return (
            <div style={BAR_STYLE}>
                <span style={{ opacity: 0.4 }}>🤖 Co-Pilot waiting for data…</span>
            </div>
        );
    }

    const cc = chipColor(conditionLabel);

    return (
        <>
            <div style={BAR_STYLE}>
                {/* Condition chip */}
                <div
                    style={{
                        ...CHIP_STYLE,
                        background: cc.bg,
                        border: `1px solid ${cc.border}`,
                        color: cc.color,
                    }}
                >
                    {conditionLabel}
                </div>

                {/* Separator */}
                <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.08)' }} />

                {/* Labels */}
                <span style={{ opacity: 0.6 }}>{momentumLabel}</span>
                <span style={{ opacity: 0.6 }}>{volatilityLabel}</span>
                <span style={{ opacity: 0.6 }}>{volumeLabel}</span>

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Narrative snippet or ask button */}
                {narrative && !expanded ? (
                    <button
                        onClick={() => setExpanded(true)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'rgba(255,255,255,0.4)',
                            fontSize: 10,
                            cursor: 'pointer',
                            fontFamily: FONT,
                            textDecoration: 'underline',
                            textDecorationColor: 'rgba(255,255,255,0.15)',
                        }}
                    >
                        Show analysis
                    </button>
                ) : !narrative ? (
                    <button
                        onClick={handleAsk}
                        disabled={loading}
                        style={{
                            background: 'rgba(96, 165, 250, 0.1)',
                            border: '1px solid rgba(96, 165, 250, 0.2)',
                            borderRadius: 6,
                            color: '#60a5fa',
                            fontSize: 10,
                            fontWeight: 600,
                            fontFamily: FONT,
                            padding: '2px 10px',
                            cursor: loading ? 'wait' : 'pointer',
                            opacity: loading ? 0.5 : 1,
                            transition: 'opacity 0.2s',
                        }}
                    >
                        {loading ? '⏳ Analyzing…' : '🤖 Ask Co-Pilot'}
                    </button>
                ) : (
                    <button
                        onClick={() => setExpanded(false)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'rgba(255,255,255,0.4)',
                            fontSize: 10,
                            cursor: 'pointer',
                            fontFamily: FONT,
                        }}
                    >
                        ▲ Collapse
                    </button>
                )}
            </div>

            {/* Expanded narrative panel */}
            {expanded && narrative && (
                <div style={EXPAND_PANEL}>
                    {narrative}
                </div>
            )}
        </>
    );
}

export { CopilotStreamBar };
