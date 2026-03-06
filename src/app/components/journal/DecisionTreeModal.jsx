// ═══════════════════════════════════════════════════════════════════
// charEdge — DecisionTreeModal (Task 4.3.16)
//
// Step-by-step wizard for pre-trade classification.
// Large pill buttons, progress dots, skip & back support.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useMemo } from 'react';
import { DecisionTreeJournal } from '../../../intelligence/DecisionTreeJournal.ts';

const FONT = 'var(--forge-font, Inter, sans-serif)';

// ─── Component ──────────────────────────────────────────────────

export default function DecisionTreeModal({ onComplete, onClose, config }) {
    const tree = useMemo(() => {
        const t = new DecisionTreeJournal(config);
        t.start();
        return t;
    }, [config]);

    const [node, setNode] = useState(() => tree.getCurrentNode());
    const [stepInfo, setStepInfo] = useState(() => tree.getStepInfo());
    const [hoveredChoice, setHoveredChoice] = useState(null);

    const handleSelect = useCallback((choiceIdx) => {
        const next = tree.selectChoice(choiceIdx);
        if (next) {
            setNode(next);
            setStepInfo(tree.getStepInfo());
        } else {
            // Tree complete
            const result = tree.getResult();
            onComplete?.(result);
        }
    }, [tree, onComplete]);

    const handleSkip = useCallback(() => {
        const next = tree.skip();
        if (next) {
            setNode(next);
            setStepInfo(tree.getStepInfo());
        } else {
            const result = tree.getResult();
            onComplete?.(result);
        }
    }, [tree, onComplete]);

    const handleBack = useCallback(() => {
        const prev = tree.goBack();
        if (prev) {
            setNode(prev);
            setStepInfo(tree.getStepInfo());
        }
    }, [tree]);

    if (!node) return null;

    const progress = tree.getProgress();

    return (
        <div style={OVERLAY}>
            <div style={MODAL}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: FONT }}>
                        Pre-Trade Classification
                    </div>
                    <button onClick={onClose} style={CLOSE_BTN}>✕</button>
                </div>

                {/* Progress dots */}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 20 }}>
                    {Array.from({ length: stepInfo.total }, (_, i) => (
                        <div key={i} style={{
                            width: i < stepInfo.current - 1 ? 20 : 8,
                            height: 8,
                            borderRadius: 4,
                            background: i < stepInfo.current - 1
                                ? 'rgba(96, 165, 250, 0.6)'
                                : i === stepInfo.current - 1
                                    ? '#60a5fa'
                                    : 'rgba(255, 255, 255, 0.1)',
                            transition: 'all 0.3s ease',
                        }} />
                    ))}
                </div>

                {/* Question */}
                <div style={{ textAlign: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.95)', fontFamily: FONT, lineHeight: 1.3 }}>
                        {node.question}
                    </div>
                    {node.description && (
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: FONT, marginTop: 6 }}>
                            {node.description}
                        </div>
                    )}
                </div>

                {/* Choices */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20, marginBottom: 20 }}>
                    {node.choices.map((choice, i) => {
                        const isHovered = hoveredChoice === i;
                        return (
                            <button
                                key={`${choice.value}-${i}`}
                                onClick={() => handleSelect(i)}
                                onMouseEnter={() => setHoveredChoice(i)}
                                onMouseLeave={() => setHoveredChoice(null)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: '14px 18px',
                                    borderRadius: 12,
                                    background: isHovered ? 'rgba(96, 165, 250, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                                    border: `1px solid ${isHovered ? 'rgba(96, 165, 250, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                                    color: isHovered ? '#93c5fd' : 'rgba(255, 255, 255, 0.8)',
                                    fontSize: 14,
                                    fontWeight: 600,
                                    fontFamily: FONT,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    textAlign: 'left',
                                    width: '100%',
                                }}
                            >
                                {choice.emoji && (
                                    <span style={{ fontSize: 20, lineHeight: 1 }}>{choice.emoji}</span>
                                )}
                                <div style={{ flex: 1 }}>
                                    <div>{choice.label}</div>
                                    {choice.description && (
                                        <div style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                                            {choice.description}
                                        </div>
                                    )}
                                </div>
                                <span style={{ fontSize: 14, opacity: isHovered ? 0.6 : 0, transition: 'opacity 0.15s' }}>→</span>
                            </button>
                        );
                    })}
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                        onClick={handleBack}
                        disabled={stepInfo.current <= 1}
                        style={{
                            ...LINK_BTN,
                            opacity: stepInfo.current <= 1 ? 0.2 : 0.5,
                            cursor: stepInfo.current <= 1 ? 'default' : 'pointer',
                        }}
                    >
                        ← Back
                    </button>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: FONT }}>
                        {stepInfo.current} / {stepInfo.total}
                    </span>
                    <button onClick={handleSkip} style={LINK_BTN}>
                        Skip →
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Styles ─────────────────────────────────────────────────────

const OVERLAY = {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 9998,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(4px)',
};

const MODAL = {
    background: 'rgba(20, 20, 30, 0.95)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: '24px 28px',
    width: 380,
    maxWidth: '92%',
    maxHeight: '85vh',
    overflowY: 'auto',
    boxShadow: '0 12px 48px rgba(0, 0, 0, 0.6)',
    animation: 'scaleInSm 0.2s ease-out',
};

const CLOSE_BTN = {
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 14,
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 6,
    lineHeight: 1,
};

const LINK_BTN = {
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'var(--forge-font, Inter, sans-serif)',
    cursor: 'pointer',
    padding: '4px 8px',
};

export { DecisionTreeModal };
