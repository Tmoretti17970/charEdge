// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Analysis Panel (Apple-Tier Redesign)
//
// Ultra-compact floating palette with:
//   • Branded "Forge Intelligence" header with ambient glow
//   • Live market pulse (condition chip + momentum)
//   • Icon-only feature toggle row
//   • Quick-action chips (What's happening?, Key Levels, Grade Setup)
//   • Expandable insight card
//   • Draggable (position persisted to localStorage)
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef, useEffect } from 'react';
import { GripVertical, X, Sparkles, TrendingUp, Layers, Activity, Triangle } from 'lucide-react';
import { C, F, GLASS } from '../../../constants.js';
import { useChartStore } from '../../../state/useChartStore.js';
import { radii, transition, zIndex } from '../../../theme/tokens.js';
import { alpha } from '../../../utils/colorUtils.js';
import { ToggleSwitch } from '../ui/AppleHIG.jsx';
import useCopilotPipeline from '../../../hooks/useCopilotPipeline.js';

// ─── Feature Definitions (Icon-Only) ────────────────────────────
const AI_FEATURES = [
    { key: 'showSR', icon: Layers, tooltip: 'Support & Resistance' },
    { key: 'showPatterns', icon: Activity, tooltip: 'Candlestick Patterns' },
    { key: 'showDivergences', icon: TrendingUp, tooltip: 'RSI Divergences' },
    { key: 'showAutoFib', icon: Triangle, tooltip: 'Auto-Fibonacci' },
];

// ─── Quick Action Chips ─────────────────────────────────────────
const QUICK_ACTIONS = [
    { id: 'pulse', label: "What's happening?", emoji: '⚡' },
    { id: 'levels', label: 'Key Levels', emoji: '📍' },
    { id: 'grade', label: 'Grade Setup', emoji: '🏆' },
];

// ─── Condition Color Map ────────────────────────────────────────
function conditionColor(label) {
    if (label.includes('Up') || label.includes('🚀')) return { bg: alpha('#34d399', 0.12), border: alpha('#34d399', 0.25), text: '#34d399' };
    if (label.includes('Down') || label.includes('🔻')) return { bg: alpha('#f87171', 0.12), border: alpha('#f87171', 0.25), text: '#f87171' };
    if (label.includes('Reversal') || label.includes('⚠️')) return { bg: alpha('#fb923c', 0.12), border: alpha('#fb923c', 0.25), text: '#fb923c' };
    return { bg: alpha('#94a3b8', 0.08), border: alpha('#94a3b8', 0.15), text: '#94a3b8' };
}

/**
 * AIAnalysisPanel — Ultra-compact draggable floating intelligence palette.
 */
export default function AIAnalysisPanel({ isOpen, onClose }) {
    const intelligence = useChartStore((s) => s.intelligence);
    const toggleIntelligence = useChartStore((s) => s.toggleIntelligence);
    const toggleIntelligenceMaster = useChartStore((s) => s.toggleIntelligenceMaster);
    const symbol = useChartStore((s) => s.symbol);
    const tf = useChartStore((s) => s.tf);

    const {
        conditionLabel,
        momentumLabel,
        volumeLabel,
        features,
        loading,
        narrative,
        requestNarrative,
        requestPulse,
        requestKeyLevels,
        requestSetupGrade,
    } = useCopilotPipeline();

    // ─── Copilot input state ────────────────────────────────────
    const [copilotInput, setCopilotInput] = useState('');
    const [copilotProcessing, setCopilotProcessing] = useState(false);
    const [copilotFeedback, setCopilotFeedback] = useState(null);

    // ─── Insight card state ─────────────────────────────────────
    const [insightText, setInsightText] = useState(null);
    const [insightExpanded, setInsightExpanded] = useState(false);
    const [activeChip, setActiveChip] = useState(null);

    // ─── Drag state ─────────────────────────────────────────────
    const [pos, setPos] = useState(() => {
        try {
            const saved = localStorage.getItem('charEdge-ai-panel-pos');
            return saved ? JSON.parse(saved) : { x: window.innerWidth - 240, y: 80 };
        } catch { return { x: window.innerWidth - 240, y: 80 }; }
    });

    const onDragStart = useCallback((e) => {
        e.preventDefault();
        const startX = e.clientX - pos.x;
        const startY = e.clientY - pos.y;
        const onMove = (ev) => {
            setPos({
                x: Math.max(0, Math.min(window.innerWidth - 220, ev.clientX - startX)),
                y: Math.max(0, Math.min(window.innerHeight - 100, ev.clientY - startY)),
            });
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            setPos((p) => {
                try { localStorage.setItem('charEdge-ai-panel-pos', JSON.stringify(p)); } catch { }
                return p;
            });
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, [pos.x, pos.y]);

    // ─── Copilot submit ─────────────────────────────────────────
    const handleCopilotSubmit = useCallback((cmd) => {
        if (!cmd.trim()) return;
        setCopilotProcessing(true);
        setTimeout(() => {
            try {
                const result = useChartStore.getState().handleAICopilotCommand?.(cmd.trim());
                setCopilotFeedback(result?.success
                    ? { type: 'success', text: result.message }
                    : { type: 'info', text: `"${cmd.trim()}" sent` });
            } catch { setCopilotFeedback({ type: 'info', text: `"${cmd.trim()}" sent` }); }
            setCopilotProcessing(false);
            setCopilotInput('');
            setTimeout(() => setCopilotFeedback(null), 1800);
        }, 300);
    }, []);

    // ─── Quick action handlers ──────────────────────────────────
    const handleQuickAction = useCallback(async (actionId) => {
        setActiveChip(actionId);
        setInsightExpanded(true);

        if (actionId === 'pulse') {
            const text = await requestPulse();
            setInsightText(text || 'Waiting for data…');
        } else if (actionId === 'levels') {
            const levels = await requestKeyLevels();
            if (levels.length === 0) {
                setInsightText('Not enough data to detect key levels yet.');
            } else {
                setInsightText(levels.map(l =>
                    `${l.type === 'support' ? '🟢' : '🔴'} $${l.price.toLocaleString()} — ${l.type} (${l.distance > 0 ? '+' : ''}${l.distance}%, strength: ${l.strength})`
                ).join('\n'));
            }
        } else if (actionId === 'grade') {
            const grade = await requestSetupGrade();
            if (!grade) {
                setInsightText('Waiting for data…');
            } else {
                setInsightText(`${'⭐'.repeat(grade.stars)} **${grade.letter}** — ${grade.score}/100\n${grade.desc}`);
            }
        }
    }, [requestPulse, requestKeyLevels, requestSetupGrade]);

    // ─── Full analysis ──────────────────────────────────────────
    const handleFullAnalysis = useCallback(async () => {
        setActiveChip('full');
        setInsightExpanded(true);
        await requestNarrative();
        setInsightText(null); // Will use narrative from pipeline instead
    }, [requestNarrative]);

    if (!isOpen) return null;

    const enabled = intelligence?.enabled ?? false;
    const cc = conditionColor(conditionLabel);

    return (
        <div
            className="tf-ai-panel"
            style={{
                position: 'fixed',
                left: pos.x,
                top: pos.y,
                width: 220,
                background: GLASS.standard,
                backdropFilter: GLASS.blurLg,
                WebkitBackdropFilter: GLASS.blurLg,
                border: GLASS.border,
                borderRadius: radii.xl,
                boxShadow: `0 12px 48px rgba(0,0,0,0.4), 0 0 0 0.5px ${alpha(C.b, 0.15)}, 0 0 20px ${alpha(C.b, 0.08)}`,
                zIndex: zIndex.popover,
                fontFamily: F,
                overflow: 'hidden',
                userSelect: 'none',
                animation: 'scaleInSm 0.2s ease-out',
            }}
        >
            {/* ── Header: Branded + Drag Handle ──────────────────── */}
            <div
                onMouseDown={onDragStart}
                className="tf-ai-header"
                style={{
                    padding: '6px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    cursor: 'grab',
                    borderBottom: GLASS.border,
                    background: `linear-gradient(135deg, ${alpha(C.b, 0.15)}, ${alpha(C.b, 0.04)})`,
                }}
            >
                <GripVertical size={10} color={C.t3} strokeWidth={2} style={{ opacity: 0.4, flexShrink: 0 }} />
                <Sparkles size={12} color={C.b} strokeWidth={2.5} style={{
                    flexShrink: 0,
                    filter: `drop-shadow(0 0 4px ${alpha(C.b, 0.6)})`,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: C.t1, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                        Char
                    </div>
                    <div style={{ fontSize: 8.5, color: C.t3, lineHeight: 1, marginTop: 1 }}>
                        {symbol || 'Chart'} · {tf || '—'}
                    </div>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        background: 'transparent', border: 'none', color: C.t3,
                        cursor: 'pointer', padding: 2, borderRadius: radii.sm,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: `color ${transition.fast}`,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = C.t1; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = C.t3; }}
                >
                    <X size={12} strokeWidth={2.5} />
                </button>
            </div>

            {/* ── Copilot Input Pill ─────────────────────────────── */}
            <div style={{ padding: '5px 8px 4px' }}>
                {copilotFeedback ? (
                    <div style={{
                        fontSize: 10, padding: '4px 8px', borderRadius: radii.md,
                        background: alpha(copilotFeedback.type === 'error' ? C.r : C.g, 0.1),
                        color: copilotFeedback.type === 'error' ? C.r : C.g,
                        fontWeight: 500, textAlign: 'center',
                    }}>
                        {copilotFeedback.text}
                    </div>
                ) : (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '3px 8px', borderRadius: 20,
                        background: alpha(C.sf2, 0.4),
                        border: `1px solid ${alpha(C.bd, 0.3)}`,
                    }}>
                        <span style={{ fontSize: 9, opacity: 0.5 }}>✦</span>
                        <input
                            value={copilotInput}
                            onChange={(e) => setCopilotInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && copilotInput.trim()) {
                                    e.preventDefault();
                                    handleCopilotSubmit(copilotInput);
                                }
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            placeholder="Ask AI…"
                            disabled={copilotProcessing}
                            style={{
                                flex: 1, background: 'transparent', border: 'none',
                                color: C.t1, fontFamily: F, fontSize: 10, fontWeight: 500,
                                outline: 'none', padding: 0,
                            }}
                        />
                        {copilotProcessing && (
                            <div style={{
                                width: 8, height: 8,
                                border: `1.5px solid ${C.bd}`, borderTopColor: C.b,
                                borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0,
                            }} />
                        )}
                        <kbd style={{
                            fontSize: 7, color: C.t3, background: alpha(C.bd, 0.3),
                            padding: '1px 3px', borderRadius: 3, fontFamily: F,
                        }}>⌘K</kbd>
                    </div>
                )}
            </div>

            {/* ── Live Market Pulse ──────────────────────────────── */}
            {features && (
                <div style={{ padding: '2px 8px 4px', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{
                        fontSize: 8.5, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                        background: cc.bg, border: `1px solid ${cc.border}`, color: cc.text,
                        whiteSpace: 'nowrap', letterSpacing: '0.01em',
                    }}>
                        {conditionLabel}
                    </div>
                    <span style={{ fontSize: 8, color: C.t3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {momentumLabel} · {volumeLabel}
                    </span>
                </div>
            )}

            {/* ── Master Toggle ──────────────────────────────────── */}
            <div style={{ padding: '0 8px', marginBottom: 4 }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 6px', borderRadius: radii.sm,
                    background: alpha(C.b, enabled ? 0.08 : 0.03),
                    border: `1px solid ${alpha(C.b, enabled ? 0.2 : 0.06)}`,
                    transition: `all ${transition.base}`,
                }}>
                    <div style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: enabled ? '#34d399' : C.t3,
                        boxShadow: enabled ? '0 0 4px #34d399' : 'none',
                        transition: `all ${transition.fast}`,
                    }} />
                    <span style={{ flex: 1, fontSize: 10, color: C.t1, fontWeight: 550 }}>Enable AI</span>
                    <ToggleSwitch checked={enabled} onChange={toggleIntelligenceMaster} label="AI" size="sm" />
                </div>
            </div>

            {/* ── Icon-Only Feature Toggles ──────────────────────── */}
            <div style={{
                padding: '0 8px 4px',
                display: 'flex', gap: 3,
                opacity: enabled ? 1 : 0.35,
                pointerEvents: enabled ? 'auto' : 'none',
                transition: `opacity ${transition.fast}`,
            }}>
                {AI_FEATURES.map((feat) => {
                    const isOn = intelligence?.[feat.key] ?? false;
                    const Icon = feat.icon;
                    return (
                        <button
                            key={feat.key}
                            onClick={() => toggleIntelligence(feat.key)}
                            title={feat.tooltip}
                            style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '5px 0', borderRadius: radii.sm,
                                background: isOn ? alpha(C.b, 0.12) : alpha(C.sf2, 0.3),
                                border: `1px solid ${isOn ? alpha(C.b, 0.25) : 'transparent'}`,
                                color: isOn ? C.b : C.t3,
                                cursor: 'pointer',
                                transition: `all ${transition.fast}`,
                            }}
                        >
                            <Icon size={12} strokeWidth={isOn ? 2.5 : 1.5} />
                        </button>
                    );
                })}
            </div>

            {/* ── Quick Action Chips ─────────────────────────────── */}
            <div style={{
                padding: '2px 8px 6px',
                display: 'flex', flexWrap: 'wrap', gap: 3,
                borderTop: `1px solid ${alpha(C.bd, 0.2)}`,
                paddingTop: 6,
            }}>
                {QUICK_ACTIONS.map((action) => (
                    <button
                        key={action.id}
                        onClick={() => handleQuickAction(action.id)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 3,
                            padding: '3px 7px', borderRadius: 12,
                            background: activeChip === action.id ? alpha(C.b, 0.12) : alpha(C.sf2, 0.3),
                            border: `1px solid ${activeChip === action.id ? alpha(C.b, 0.2) : alpha(C.bd, 0.15)}`,
                            color: activeChip === action.id ? C.b : C.t2,
                            cursor: 'pointer', fontSize: 9, fontWeight: 550, fontFamily: F,
                            transition: `all ${transition.fast}`,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        <span style={{ fontSize: 8 }}>{action.emoji}</span>
                        {action.label}
                    </button>
                ))}
                <button
                    onClick={handleFullAnalysis}
                    disabled={loading}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 3,
                        padding: '3px 7px', borderRadius: 12,
                        background: activeChip === 'full' ? alpha(C.b, 0.15) : alpha(C.b, 0.06),
                        border: `1px solid ${alpha(C.b, 0.2)}`,
                        color: C.b, cursor: loading ? 'wait' : 'pointer',
                        fontSize: 9, fontWeight: 600, fontFamily: F,
                        opacity: loading ? 0.5 : 1,
                        transition: `all ${transition.fast}`,
                        whiteSpace: 'nowrap',
                    }}
                >
                    {loading ? '⏳' : '🔍'} Full Analysis
                </button>
            </div>

            {/* ── Expandable Insight Card ────────────────────────── */}
            {insightExpanded && (insightText || narrative) && (
                <div
                    className="tf-ai-insight"
                    style={{
                        margin: '0 6px 6px',
                        padding: '6px 8px',
                        borderRadius: radii.md,
                        background: alpha(C.sf2, 0.5),
                        border: `1px solid ${alpha(C.bd, 0.15)}`,
                        fontSize: 9.5,
                        fontFamily: F,
                        color: C.t2,
                        lineHeight: 1.55,
                        whiteSpace: 'pre-wrap',
                        maxHeight: 200,
                        overflowY: 'auto',
                        scrollbarWidth: 'thin',
                        animation: 'fadeInUp 0.2s ease',
                    }}
                >
                    {/* Render bold markdown */}
                    {(insightText || narrative || '').split('\n').map((line, i) => (
                        <div key={i} style={{ marginBottom: 2 }}>
                            {line.split(/(\*\*.*?\*\*)/).map((seg, j) =>
                                seg.startsWith('**') && seg.endsWith('**')
                                    ? <strong key={j} style={{ color: C.t1, fontWeight: 700 }}>{seg.slice(2, -2)}</strong>
                                    : seg
                            )}
                        </div>
                    ))}
                    <button
                        onClick={() => { setInsightExpanded(false); setInsightText(null); setActiveChip(null); }}
                        style={{
                            float: 'right', marginTop: 4,
                            background: 'none', border: 'none',
                            color: C.t3, fontSize: 8, cursor: 'pointer', fontFamily: F,
                        }}
                    >
                        ▲ Collapse
                    </button>
                </div>
            )}
        </div>
    );
}
