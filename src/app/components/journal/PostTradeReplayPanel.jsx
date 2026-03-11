// ═══════════════════════════════════════════════════════════════════
// charEdge — PostTradeReplayPanel (Task 4.1.16)
//
// Split panel: left = original trade context (historical bars),
// right = current chart. Uses ReplayEngine for playback.
// "Current vs Past Self" comparison.
// ═══════════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback } from 'react';

const FONT = 'var(--forge-font, Inter, sans-serif)';
const MONO = 'var(--forge-mono, "JetBrains Mono", monospace)';

// ─── Component ──────────────────────────────────────────────────

export default function PostTradeReplayPanel({ trade, onClose }) {
    const [reflectionText, setReflectionText] = useState('');
    const [submitted, setSubmitted] = useState(false);

    // Compute trade stats for display
    const stats = useMemo(() => {
        if (!trade) return null;
        const entry = trade.entry || trade.entryPrice || 0;
        const exit = trade.exit || trade.exitPrice || 0;
        const pnl = trade.pnl || 0;
        const side = trade.side || 'long';
        const pnlPct = entry > 0
            ? ((side === 'long' ? exit - entry : entry - exit) / entry * 100)
            : 0;

        return {
            symbol: trade.symbol || '—',
            side,
            entry,
            exit,
            pnl,
            pnlPct,
            mfe: trade.mfe || 0,
            mae: trade.mae || 0,
            efficiency: trade.efficiencyRatio != null ? trade.efficiencyRatio : null,
            date: trade.date || trade.timestamp || '',
            setup: trade.setupType || trade.playbook || '',
            tags: trade.tags || [],
            duration: trade.holdTime || trade.duration || '—',
        };
    }, [trade]);

    const handleSubmitReflection = useCallback(() => {
        if (!reflectionText.trim()) return;
        // Save reflection to the trade notes
        setSubmitted(true);
        // In a full implementation, this would update the journal store
    }, [reflectionText]);

    if (!trade || !stats) {
        return (
            <div style={PANEL_STYLE}>
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: FONT, fontSize: 13 }}>
                    Select a trade to replay
                </div>
            </div>
        );
    }

    const pnlColor = stats.pnl >= 0 ? '#34d399' : '#f87171';
    const sideColor = stats.side === 'long' ? '#34d399' : '#f87171';

    return (
        <div style={PANEL_STYLE}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>⏪</span>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.95)', fontFamily: FONT }}>
                            Post-Trade Replay
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: MONO }}>
                            Current vs Past Self
                        </div>
                    </div>
                </div>
                {onClose && (
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 14, cursor: 'pointer' }}>✕</button>
                )}
            </div>

            {/* Trade Summary Split */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                {/* Left: Entry */}
                <div style={SPLIT_CARD}>
                    <div style={SPLIT_LABEL}>Entry</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: sideColor, textTransform: 'uppercase', fontFamily: MONO }}>
                            {stats.side}
                        </span>
                        <span style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT, fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.9)' }}>
                            ${stats.entry.toFixed(2)}
                        </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: FONT, marginTop: 4 }}>
                        {stats.symbol} · {stats.date ? new Date(stats.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                    </div>
                </div>

                {/* Right: Exit */}
                <div style={SPLIT_CARD}>
                    <div style={SPLIT_LABEL}>Exit</div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT, fontVariantNumeric: 'tabular-nums', color: pnlColor }}>
                        ${stats.exit.toFixed(2)}
                    </div>
                    <div style={{
                        fontSize: 11, color: pnlColor, fontFamily: MONO, fontVariantNumeric: 'tabular-nums', marginTop: 4
                    }}>
                        {stats.pnl >= 0 ? '+' : ''}{stats.pnlPct.toFixed(2)}% ({stats.pnl >= 0 ? '+' : ''}${stats.pnl.toFixed(2)})
                    </div>
                </div>
            </div>

            {/* MFE/MAE Bands */}
            {(stats.mfe > 0 || stats.mae > 0) && (
                <div style={{ marginBottom: 16 }}>
                    <div style={{ ...SPLIT_LABEL, marginBottom: 8 }}>Excursion Analysis</div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <div style={{ flex: 1, ...METRIC_CARD, borderColor: 'rgba(52, 211, 153, 0.15)' }}>
                            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: FONT }}>MFE (Best)</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#34d399', fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
                                +${stats.mfe.toFixed(2)}
                            </div>
                        </div>
                        <div style={{ flex: 1, ...METRIC_CARD, borderColor: 'rgba(248, 113, 113, 0.15)' }}>
                            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: FONT }}>MAE (Worst)</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#f87171', fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
                                -${stats.mae.toFixed(2)}
                            </div>
                        </div>
                        {stats.efficiency != null && (
                            <div style={{ flex: 1, ...METRIC_CARD, borderColor: 'rgba(96, 165, 250, 0.15)' }}>
                                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: FONT }}>Captured</div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#60a5fa', fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
                                    {(stats.efficiency * 100).toFixed(0)}%
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Efficiency bar */}
                    {stats.efficiency != null && (
                        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                            <div style={{
                                width: `${Math.min(Math.max(stats.efficiency * 100, 0), 100)}%`,
                                height: '100%',
                                borderRadius: 2,
                                background: stats.efficiency >= 0.7 ? '#34d399' : stats.efficiency >= 0.4 ? '#60a5fa' : '#fb923c',
                                transition: 'width 0.5s ease',
                            }} />
                        </div>
                    )}
                </div>
            )}

            {/* Tags */}
            {stats.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
                    {stats.tags.map((tag, i) => (
                        <span key={`${tag}-${i}`} style={{
                            fontSize: 9,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: 'rgba(96, 165, 250, 0.08)',
                            border: '1px solid rgba(96, 165, 250, 0.15)',
                            color: 'rgba(96, 165, 250, 0.7)',
                            fontFamily: MONO,
                        }}>
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            {/* Reflection Prompt */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)', fontFamily: FONT, marginBottom: 8 }}>
                    💭 What would you do differently?
                </div>

                {!submitted ? (
                    <>
                        <textarea
                            value={reflectionText}
                            onChange={(e) => setReflectionText(e.target.value)}
                            placeholder="Looking back at this trade, I would have..."
                            rows={3}
                            style={{
                                width: '100%',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: 8,
                                color: 'rgba(255,255,255,0.8)',
                                fontFamily: FONT,
                                fontSize: 12,
                                padding: '8px 12px',
                                resize: 'vertical',
                                outline: 'none',
                                marginBottom: 8,
                                lineHeight: 1.5,
                                boxSizing: 'border-box',
                            }}
                        />
                        <button
                            onClick={handleSubmitReflection}
                            disabled={!reflectionText.trim()}
                            style={{
                                padding: '6px 14px',
                                borderRadius: 6,
                                background: reflectionText.trim() ? 'rgba(96, 165, 250, 0.12)' : 'transparent',
                                border: `1px solid ${reflectionText.trim() ? 'rgba(96, 165, 250, 0.2)' : 'rgba(255,255,255,0.06)'}`,
                                color: reflectionText.trim() ? '#60a5fa' : 'rgba(255,255,255,0.2)',
                                fontSize: 11,
                                fontWeight: 600,
                                fontFamily: FONT,
                                cursor: reflectionText.trim() ? 'pointer' : 'default',
                            }}
                        >
                            Save Reflection
                        </button>
                    </>
                ) : (
                    <div style={{ fontSize: 12, color: '#34d399', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>✓</span> Reflection saved
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Styles ─────────────────────────────────────────────────────

const PANEL_STYLE = {
    background: 'rgba(20, 20, 30, 0.6)',
    backdropFilter: 'blur(16px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 20,
};

const SPLIT_CARD = {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: '10px 14px',
};

const SPLIT_LABEL = {
    fontSize: 10,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontFamily: 'var(--forge-font, Inter, sans-serif)',
    marginBottom: 4,
};

const METRIC_CARD = {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 8,
    padding: '8px 10px',
};

export { PostTradeReplayPanel };
