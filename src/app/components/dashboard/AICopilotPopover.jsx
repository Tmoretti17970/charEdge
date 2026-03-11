// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Copilot Popover (Phase 1)
//
// 380px glassmorphic popover anchored below the copilot pill.
// Shows auto-generated trade briefing + interactive suggestion pills.
// Clicking a pill swaps the briefing with a contextual AI response.
//
// Spring animation entrance, click-outside / Escape dismiss.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { C, F, GLASS, DEPTH } from '../../../constants.js';
import useHomeSummary from '../../../hooks/useHomeSummary.js';
import AIOrb from '../design/AIOrb.jsx';

// ─── Quick Action Suggestions ───────────────────────────────────

const SUGGESTIONS = [
    { id: 'best', label: 'Best trade this week', emoji: '🏆' },
    { id: 'risk', label: 'Risk assessment', emoji: '🛡️' },
    { id: 'week', label: 'Week analysis', emoji: '📊' },
    { id: 'tips', label: 'Suggestions', emoji: '💡' },
];

// ─── Response Generator ─────────────────────────────────────────

function fmtD(v) {
    return '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function generateResponse(id, summary) {
    switch (id) {
        case 'best': {
            const t = summary.bestTradeThisWeek;
            if (!t) return { title: '🏆 Best Trade This Week', body: 'No trades logged this week yet. Get out there and find your edge!' };
            const sym = t.symbol || t.ticker || 'Unknown';
            const side = t.side || 'trade';
            return {
                title: '🏆 Best Trade This Week',
                body: `Your best trade was a ${side} on ${sym} for +${fmtD(t.pnl)}. ${t.pnl > 100 ? 'Great execution — that\'s a solid winner!' : 'Every win counts. Keep stacking them up.'}`,
            };
        }
        case 'risk': {
            const level = summary.riskLevel;
            const pct = summary.riskPct || 0;
            if (level === 'HIGH') {
                return {
                    title: '🛡️ Risk Assessment',
                    body: `⚠️ Risk is HIGH — you've used ${pct}% of your daily loss limit. Consider stepping back and reviewing your plan before taking more trades.`,
                };
            }
            if (level === 'MEDIUM') {
                return {
                    title: '🛡️ Risk Assessment',
                    body: `Risk is moderate at ${pct}% of your daily limit. You still have room, but be selective with your next entries.`,
                };
            }
            const avgW = summary.avgWin;
            const avgL = summary.avgLoss;
            const rr = avgL !== 0 ? Math.abs(avgW / avgL).toFixed(1) : '∞';
            return {
                title: '🛡️ Risk Assessment',
                body: `Risk is low — you're well within your limits. Your average win/loss ratio is ${rr}:1. ${parseFloat(rr) >= 2 ? 'Strong risk management.' : 'Consider tightening stops to improve your R:R.'}`,
            };
        }
        case 'week': {
            const wc = summary.weekTradeCount;
            if (!wc) return { title: '📊 Week Analysis', body: 'No trades this week yet. Markets are waiting — what\'s your plan?' };
            const wr = summary.weekWinRate;
            const wp = summary.weekPnl;
            const parts = [`${wc} trade${wc !== 1 ? 's' : ''} this week with a ${wr}% win rate.`];
            if (wp !== 0) parts.push(`Net P&L: ${wp >= 0 ? '+' : ''}${fmtD(wp)}.`);
            if (summary.streak.count >= 2) {
                parts.push(`Currently on a ${summary.streak.count}-trade ${summary.streak.type} streak.`);
            }
            if (wr >= 60) parts.push('You\'re in the zone — stay disciplined.');
            else if (wr < 40 && wc >= 3) parts.push('Win rate is below 40%. Review your entries for patterns.');
            return { title: '📊 Week Analysis', body: parts.join(' ') };
        }
        case 'tips': {
            const tips = [];
            if (summary.streak.count >= 3 && summary.streak.type === 'losing') {
                tips.push('You\'re on a losing streak. Consider reducing position size until confidence returns.');
            }
            if (summary.todayTradeCount >= 5) {
                tips.push('You\'ve taken 5+ trades today. Overtrading can erode your edge — quality over quantity.');
            }
            if (summary.avgLoss !== 0 && Math.abs(summary.avgWin / summary.avgLoss) < 1.5) {
                tips.push('Your win/loss ratio is below 1.5:1. Try holding winners longer or cutting losers sooner.');
            }
            if (summary.weekWinRate >= 60 && summary.weekTradeCount >= 3) {
                tips.push('Strong week so far. Don\'t give it back — stick to your A+ setups.');
            }
            if (summary.todayTradeCount === 0 && summary.streak.count >= 2 && summary.streak.type === 'winning') {
                tips.push('You\'re riding a winning streak. Stay patient and wait for high-conviction setups.');
            }
            if (!tips.length) {
                tips.push('You\'re trading within your plan. Keep logging your setups and reviewing your edge daily.');
            }
            return { title: '💡 Suggestions', body: tips.join(' ') };
        }
        default:
            return { title: 'Copilot', body: 'Select a quick action above.' };
    }
}

// ─── CSS Keyframes (injected once) ──────────────────────────────

const KEYFRAMES_ID = 'tf-copilot-popover-keyframes';

function ensureKeyframes() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(KEYFRAMES_ID)) return;
    const style = document.createElement('style');
    style.id = KEYFRAMES_ID;
    style.textContent = `
    @keyframes copilotPopoverIn {
      0% { opacity: 0; transform: scale(0.95) translateY(-8px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes copilotResponseIn {
      0% { opacity: 0; transform: translateY(6px); }
      100% { opacity: 1; transform: translateY(0); }
    }
  `;
    document.head.appendChild(style);
}

// ─── Component ──────────────────────────────────────────────────

export default function AICopilotPopover({ anchorRef, onClose }) {
    const popoverRef = useRef(null);
    const summary = useHomeSummary();

    // Active suggestion response
    const [activeResponse, setActiveResponse] = useState(null); // { title, body }
    const [activePill, setActivePill] = useState(null);         // suggestion id
    const [thinking, setThinking] = useState(false);

    // Inject keyframes on first mount
    useEffect(() => ensureKeyframes(), []);

    // Click-outside dismiss
    useEffect(() => {
        function handleClickOutside(e) {
            if (
                popoverRef.current &&
                !popoverRef.current.contains(e.target) &&
                anchorRef?.current &&
                !anchorRef.current.contains(e.target)
            ) {
                onClose();
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose, anchorRef]);

    // Escape dismiss
    useEffect(() => {
        function handleKey(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        }
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    // Handle suggestion pill click
    const handleSuggestion = useCallback((suggestion) => {
        if (activePill === suggestion.id) {
            // Toggle off — go back to briefing
            setActivePill(null);
            setActiveResponse(null);
            return;
        }
        setActivePill(suggestion.id);
        setThinking(true);
        setActiveResponse(null);

        // Simulate a brief "thinking" delay (feels AI-like)
        setTimeout(() => {
            const resp = generateResponse(suggestion.id, summary);
            setActiveResponse(resp);
            setThinking(false);
        }, 500);
    }, [activePill, summary]);

    // Position below anchor
    const getPosition = useCallback(() => {
        if (!anchorRef?.current) return { top: 60, left: 80 };
        const rect = anchorRef.current.getBoundingClientRect();
        return {
            top: rect.bottom + 10,
            left: rect.left,
        };
    }, [anchorRef]);

    const pos = getPosition();

    // Stat pills for the summary
    const stats = [];
    if (summary.todayTradeCount > 0) {
        stats.push({ label: 'Today', value: `${summary.todayTradeCount} trades`, color: C.info });
        stats.push({ label: 'Win Rate', value: `${summary.todayWinRate}%`, color: summary.todayWinRate >= 50 ? C.g : C.r });
    }
    if (summary.weekTrend !== 0) {
        stats.push({ label: 'Week', value: `${summary.weekTrend >= 0 ? '+' : ''}${summary.weekTrend}%`, color: summary.weekTrend >= 0 ? C.g : C.r });
    }
    if (summary.riskLevel !== 'LOW') {
        stats.push({ label: 'Risk', value: summary.riskLevel, color: summary.riskLevel === 'HIGH' ? C.r : C.y });
    }

    // Determine what to show in the main body area
    const showResponse = activeResponse || thinking;

    return (
        <div
            ref={popoverRef}
            style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                width: 380,
                zIndex: 9999,
                background: GLASS.heavy,
                backdropFilter: GLASS.blurLg,
                WebkitBackdropFilter: GLASS.blurLg,
                border: GLASS.border,
                borderRadius: 16,
                boxShadow: DEPTH[4],
                fontFamily: F,
                animation: 'copilotPopoverIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                overflow: 'hidden',
            }}
        >
            {/* ─── Header ──────────────────────────────────────── */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px 10px',
                    borderBottom: GLASS.border,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AIOrb size={18} glow animate />
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, letterSpacing: '-0.01em' }}>
                        charEdge Copilot
                    </span>
                </div>
                <button
                    onClick={onClose}
                    aria-label="Close copilot"
                    style={{
                        background: 'none',
                        border: 'none',
                        color: C.t3,
                        fontSize: 16,
                        cursor: 'pointer',
                        padding: '2px 6px',
                        borderRadius: 6,
                        transition: 'all 0.15s ease',
                        lineHeight: 1,
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = C.sf2;
                        e.currentTarget.style.color = C.t1;
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'none';
                        e.currentTarget.style.color = C.t3;
                    }}
                >
                    ✕
                </button>
            </div>

            {/* ─── Body: Briefing or Response ────────────────────── */}
            <div style={{ padding: '14px 16px' }}>
                {showResponse ? (
                    // AI Response view
                    <div>
                        {thinking ? (
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '8px 0',
                                }}
                            >
                                <AIOrb size={14} animate />
                                <span style={{ fontSize: 12, color: C.t3, fontStyle: 'italic' }}>
                                    Analyzing your data…
                                </span>
                            </div>
                        ) : (
                            <div
                                key={activePill}
                                style={{ animation: 'copilotResponseIn 0.3s ease forwards' }}
                            >
                                <div
                                    style={{
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: C.t1,
                                        marginBottom: 8,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                    }}
                                >
                                    {activeResponse.title}
                                </div>
                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: 13,
                                        lineHeight: 1.6,
                                        color: C.t2,
                                    }}
                                >
                                    {activeResponse.body}
                                </p>
                                <button
                                    onClick={() => {
                                        setActivePill(null);
                                        setActiveResponse(null);
                                    }}
                                    style={{
                                        marginTop: 10,
                                        background: 'none',
                                        border: 'none',
                                        color: C.t3,
                                        fontSize: 11,
                                        cursor: 'pointer',
                                        padding: 0,
                                        fontFamily: F,
                                        textDecoration: 'underline',
                                        textDecorationColor: C.bd,
                                    }}
                                >
                                    ← Back to overview
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    // Default briefing view
                    <>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                marginBottom: 8,
                                fontSize: 11,
                                fontWeight: 600,
                                color: C.t3,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                            }}
                        >
                            📊 Your Day at a Glance
                        </div>
                        <p
                            style={{
                                margin: 0,
                                fontSize: 13,
                                lineHeight: 1.6,
                                color: C.t2,
                            }}
                        >
                            {summary.briefing}
                        </p>

                        {/* Inline stats chips */}
                        {stats.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                                {stats.map((s) => (
                                    <div
                                        key={s.label}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4,
                                            padding: '3px 8px',
                                            borderRadius: 8,
                                            background: s.color + '12',
                                            border: `1px solid ${s.color}20`,
                                            fontSize: 10,
                                            fontWeight: 600,
                                        }}
                                    >
                                        <span style={{ color: C.t3 }}>{s.label}</span>
                                        <span style={{ color: s.color }}>{s.value}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ─── Suggestion Pills ────────────────────────────── */}
            <div
                style={{
                    padding: '10px 16px 16px',
                    borderTop: GLASS.border,
                }}
            >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {SUGGESTIONS.map((s) => (
                        <SuggestionPill
                            key={s.id}
                            suggestion={s}
                            active={activePill === s.id}
                            onClick={() => handleSuggestion(s)}
                        />
                    ))}
                </div>
            </div>

            {/* ─── Footer Hint ─────────────────────────────────── */}
            <div
                style={{
                    padding: '8px 16px',
                    borderTop: GLASS.border,
                    display: 'flex',
                    justifyContent: 'center',
                    fontSize: 10,
                    color: C.t3,
                    opacity: 0.6,
                }}
            >
                <kbd
                    style={{
                        background: C.sf2,
                        padding: '1px 5px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontFamily: F,
                        marginRight: 4,
                        border: `1px solid ${C.bd}`,
                    }}
                >
                    ⌘K
                </kbd>
                to toggle
            </div>
        </div>
    );
}

// ─── Suggestion Pill ────────────────────────────────────────────

function SuggestionPill({ suggestion, active, onClick }) {
    const [hovered, setHovered] = React.useState(false);

    const isHighlighted = active || hovered;

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 10px',
                borderRadius: 10,
                border: `1px solid ${active ? C.b + '50' : isHighlighted ? C.b + '30' : C.bd}`,
                background: active ? C.b + '15' : isHighlighted ? C.b + '08' : C.sf2,
                color: isHighlighted ? C.t1 : C.t2,
                fontSize: 11,
                fontWeight: active ? 600 : 500,
                fontFamily: F,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textAlign: 'left',
            }}
        >
            <span style={{ fontSize: 14, lineHeight: 1 }}>{suggestion.emoji}</span>
            {suggestion.label}
        </button>
    );
}

export { AICopilotPopover };
