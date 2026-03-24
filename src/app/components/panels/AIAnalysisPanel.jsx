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

import React from 'react';
import { GripVertical, X, Sparkles, TrendingUp, Layers, Activity, Triangle } from 'lucide-react';
import { useState, useCallback } from 'react';
import { C } from '../../../constants.js';
import useCopilotPipeline from '../../../hooks/useCopilotPipeline.js';
import { ToggleSwitch } from '../ui/AppleHIG.jsx';
import { alpha } from '@/shared/colorUtils';
import { useChartCoreStore } from '../../../state/chart/useChartCoreStore';
import { useChartFeaturesStore } from '../../../state/chart/useChartFeaturesStore';
import st from './AIAnalysisPanel.module.css';

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

function AIAnalysisPanel({ isOpen, onClose }) {
    const intelligence = useChartFeaturesStore((s) => s.intelligence);
    const toggleIntelligence = useChartFeaturesStore((s) => s.toggleIntelligence);
    const toggleIntelligenceMaster = useChartFeaturesStore((s) => s.toggleIntelligenceMaster);
    const symbol = useChartCoreStore((s) => s.symbol);
    const tf = useChartCoreStore((s) => s.tf);

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

    const [copilotInput, setCopilotInput] = useState('');
    const [copilotProcessing, setCopilotProcessing] = useState(false);
    const [copilotFeedback, setCopilotFeedback] = useState(null);

    const [insightText, setInsightText] = useState(null);
    const [insightExpanded, setInsightExpanded] = useState(false);
    const [activeChip, setActiveChip] = useState(null);

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
                try { localStorage.setItem('charEdge-ai-panel-pos', JSON.stringify(p)); } catch { /* no-op */ }
                return p;
            });
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, [pos.x, pos.y]);

    const handleCopilotSubmit = useCallback((cmd) => {
        if (!cmd.trim()) return;
        setCopilotProcessing(true);
        setTimeout(() => {
            try {
                const result = useChartCoreStore.getState().handleAICopilotCommand?.(cmd.trim());
                setCopilotFeedback(result?.success
                    ? { type: 'success', text: result.message }
                    : { type: 'info', text: `"${cmd.trim()}" sent` });
            } catch { setCopilotFeedback({ type: 'info', text: `"${cmd.trim()}" sent` }); }
            setCopilotProcessing(false);
            setCopilotInput('');
            setTimeout(() => setCopilotFeedback(null), 1800);
        }, 300);
    }, []);

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

    const handleFullAnalysis = useCallback(async () => {
        setActiveChip('full');
        setInsightExpanded(true);
        await requestNarrative();
        setInsightText(null);
    }, [requestNarrative]);

    if (!isOpen) return null;

    const enabled = intelligence?.enabled ?? false;
    const cc = conditionColor(conditionLabel);

    return (
        <div
            className={`tf-ai-panel ${st.root}`}
            style={{ left: pos.x, top: pos.y }}
        >
            {/* ── Header: Branded + Drag Handle ──────────────────── */}
            <div onMouseDown={onDragStart} className={`tf-ai-header ${st.header}`}>
                <GripVertical size={10} color={C.t3} strokeWidth={2} style={{ opacity: 0.4, flexShrink: 0 }} />
                <Sparkles size={12} color={C.b} strokeWidth={2.5} style={{
                    flexShrink: 0,
                    filter: `drop-shadow(0 0 4px ${alpha(C.b, 0.6)})`,
                }} />
                <div className={st.headerBody}>
                    <div className={st.headerTitle}>Char</div>
                    <div className={st.headerSub}>{symbol || 'Chart'} · {tf || '—'}</div>
                </div>
                <button onClick={onClose} className={st.closeBtn}>
                    <X size={12} strokeWidth={2.5} />
                </button>
            </div>

            {/* ── Copilot Input Pill ─────────────────────────────── */}
            <div className={st.copilotWrap}>
                {copilotFeedback ? (
                    <div
                        className={st.copilotFeedback}
                        style={{
                            background: alpha(copilotFeedback.type === 'error' ? C.r : C.g, 0.1),
                            color: copilotFeedback.type === 'error' ? C.r : C.g,
                        }}
                    >
                        {copilotFeedback.text}
                    </div>
                ) : (
                    <div className={st.copilotPill}>
                        <span className={st.copilotStar}>✦</span>
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
                            className={st.copilotInput}
                        />
                        {copilotProcessing && <div className={st.copilotSpinner} />}
                        <kbd className={st.kbd}>⌘K</kbd>
                    </div>
                )}
            </div>

            {/* ── Live Market Pulse ──────────────────────────────── */}
            {features && (
                <div className={st.pulseRow}>
                    <div
                        className={st.condChip}
                        style={{ '--cond-bg': cc.bg, '--cond-border': cc.border, '--cond-text': cc.text }}
                    >
                        {conditionLabel}
                    </div>
                    <span className={st.pulseMeta}>
                        {momentumLabel} · {volumeLabel}
                    </span>
                </div>
            )}

            {/* ── Master Toggle ──────────────────────────────────── */}
            <div className={st.toggleWrap}>
                <div
                    className={st.toggleRow}
                    style={{
                        background: alpha(C.b, enabled ? 0.08 : 0.03),
                        border: `1px solid ${alpha(C.b, enabled ? 0.2 : 0.06)}`,
                    }}
                >
                    <div className={`${st.statusDot} ${enabled ? st.statusDotOn : st.statusDotOff}`} />
                    <span className={st.toggleLabel}>Enable AI</span>
                    <ToggleSwitch checked={enabled} onChange={toggleIntelligenceMaster} label="AI" size="sm" />
                </div>
            </div>

            {/* ── Icon-Only Feature Toggles ──────────────────────── */}
            <div className={`${st.featureRow} ${!enabled ? st.featureRowDisabled : ''}`}>
                {AI_FEATURES.map((feat) => {
                    const isOn = intelligence?.[feat.key] ?? false;
                    const Icon = feat.icon;
                    return (
                        <button
                            key={feat.key}
                            onClick={() => toggleIntelligence(feat.key)}
                            title={feat.tooltip}
                            className={st.featureBtn}
                            style={{
                                background: isOn ? alpha(C.b, 0.12) : alpha(C.sf2, 0.3),
                                border: `1px solid ${isOn ? alpha(C.b, 0.25) : 'transparent'}`,
                                color: isOn ? C.b : C.t3,
                            }}
                        >
                            <Icon size={12} strokeWidth={isOn ? 2.5 : 1.5} />
                        </button>
                    );
                })}
            </div>

            {/* ── Quick Action Chips ─────────────────────────────── */}
            <div className={st.chipRow}>
                {QUICK_ACTIONS.map((action) => (
                    <button
                        key={action.id}
                        onClick={() => handleQuickAction(action.id)}
                        className={st.chip}
                        style={{
                            background: activeChip === action.id ? alpha(C.b, 0.12) : alpha(C.sf2, 0.3),
                            border: `1px solid ${activeChip === action.id ? alpha(C.b, 0.2) : alpha(C.bd, 0.15)}`,
                            color: activeChip === action.id ? C.b : C.t2,
                        }}
                    >
                        <span className={st.chipEmoji}>{action.emoji}</span>
                        {action.label}
                    </button>
                ))}
                <button
                    onClick={handleFullAnalysis}
                    disabled={loading}
                    className={st.chip}
                    style={{
                        background: activeChip === 'full' ? alpha(C.b, 0.15) : alpha(C.b, 0.06),
                        border: `1px solid ${alpha(C.b, 0.2)}`,
                        color: C.b,
                        cursor: loading ? 'wait' : 'pointer',
                        opacity: loading ? 0.5 : 1,
                    }}
                >
                    {loading ? '⏳' : '🔍'} Full Analysis
                </button>
            </div>

            {/* ── Expandable Insight Card ────────────────────────── */}
            {insightExpanded && (insightText || narrative) && (
                <div className={`tf-ai-insight ${st.insightCard}`}>
                    {(insightText || narrative || '').split('\n').map((line, i) => (
                        <div key={i} className={st.insightLine}>
                            {line.split(/(\*\*.*?\*\*)/).map((seg, j) =>
                                seg.startsWith('**') && seg.endsWith('**')
                                    ? <strong key={j} className={st.insightBold}>{seg.slice(2, -2)}</strong>
                                    : seg
                            )}
                        </div>
                    ))}
                    <button
                        onClick={() => { setInsightExpanded(false); setInsightText(null); setActiveChip(null); }}
                        className={st.collapseBtn}
                    >
                        ▲ Collapse
                    </button>
                </div>
            )}
        </div>
    );
}

export default React.memo(AIAnalysisPanel);
