// ═══════════════════════════════════════════════════════════════════
// charEdge — NPS Survey
//
// Phase 6 Task 6.2.5: Net Promoter Score survey component.
// Auto-triggers monthly, dismissable, with optional comment.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, memo, useCallback } from 'react';
import { logger } from '@/observability/logger';

const STORAGE_KEY = 'charedge_nps_last';
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

const NPSSurvey = memo(function NPSSurvey({ onSubmit }) {
    const [visible, setVisible] = useState(false);
    const [score, setScore] = useState(null);
    const [comment, setComment] = useState('');
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        const last = localStorage.getItem(STORAGE_KEY);
        if (!last || Date.now() - parseInt(last, 10) > THIRTY_DAYS) {
            // Delay showing by 60s to not interrupt flow
            const t = setTimeout(() => setVisible(true), 60_000);
            return () => clearTimeout(t);
        }
    }, []);

    const dismiss = useCallback(() => {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
        setVisible(false);
    }, []);

    const handleSubmit = useCallback(() => {
        if (score === null) return;
        const data = { score, comment: comment.trim() || undefined, timestamp: Date.now() };

        if (onSubmit) {
            onSubmit(data);
        } else {
            logger.ui.info('[NPS] Survey submitted:', data);
        }

        localStorage.setItem(STORAGE_KEY, String(Date.now()));
        setSubmitted(true);
        setTimeout(() => setVisible(false), 2000);
    }, [score, comment, onSubmit]);

    if (!visible) return null;

    return (
        <div style={bannerStyle} role="dialog" aria-label="NPS Survey">
            {submitted ? (
                <p style={{ textAlign: 'center', color: 'var(--c-accent-green, #26A69A)', fontWeight: 600 }}>
                    Thank you for your feedback! 🎉
                </p>
            ) : (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--fs-base, 15px)' }}>
                            How likely are you to recommend charEdge?
                        </p>
                        <button onClick={dismiss} style={dismissStyle} aria-label="Dismiss">✕</button>
                    </div>

                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 12 }}>
                        {Array.from({ length: 11 }, (_, i) => (
                            <button
                                key={i}
                                onClick={() => setScore(i)}
                                aria-label={`Score ${i}`}
                                style={{
                                    ...scoreBtn,
                                    background: score === i
                                        ? (i <= 6 ? 'var(--c-accent-red, #EF5350)' : i <= 8 ? 'var(--c-accent-amber, #FFC107)' : 'var(--c-accent-green, #26A69A)')
                                        : 'var(--c-bg-tertiary, #1d2027)',
                                    color: score === i ? '#fff' : 'var(--c-fg-secondary, #8b8fa2)',
                                }}
                            >
                                {i}
                            </button>
                        ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs, 11px)', color: 'var(--c-fg-muted, #555)', marginBottom: 12 }}>
                        <span>Not likely</span>
                        <span>Very likely</span>
                    </div>

                    {score !== null && (
                        <>
                            <textarea
                                placeholder="Any additional feedback? (optional)"
                                value={comment}
                                onChange={e => setComment(e.target.value)}
                                rows={2}
                                style={textareaStyle}
                            />
                            <button onClick={handleSubmit} style={submitStyle}>Submit</button>
                        </>
                    )}
                </>
            )}
        </div>
    );
});

const bannerStyle = {
    position: 'fixed', bottom: 16, right: 16, zIndex: 'var(--z-toast, 600)',
    background: 'var(--c-bg-secondary, #0e1013)', borderRadius: 'var(--br-lg, 12px)',
    border: '1px solid var(--c-border, #2a2e3a)', padding: 16,
    maxWidth: 400, width: '90vw', boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.5))',
    animation: 'fadeInUp 250ms ease-out',
};

const scoreBtn = {
    width: 32, height: 32, border: '1px solid var(--c-border, #2a2e3a)',
    borderRadius: 'var(--br-sm, 4px)', cursor: 'pointer',
    fontSize: 'var(--fs-xs, 11px)', fontWeight: 600,
    transition: 'all 150ms ease',
};

const dismissStyle = {
    background: 'none', border: 'none', color: 'var(--c-fg-tertiary, #7078a0)',
    fontSize: 16, cursor: 'pointer', padding: 4,
};

const textareaStyle = {
    width: '100%', background: 'var(--c-bg-primary, #08090a)',
    border: '1px solid var(--c-border, #2a2e3a)', borderRadius: 'var(--br-md, 8px)',
    padding: 8, color: 'var(--c-fg-primary, #ececef)', fontSize: 'var(--fs-sm, 13px)',
    resize: 'vertical', marginBottom: 8, fontFamily: 'inherit',
};

const submitStyle = {
    width: '100%', padding: '8px 16px',
    background: 'var(--c-accent-blue, #2196F3)', color: '#fff',
    border: 'none', borderRadius: 'var(--br-md, 8px)',
    fontSize: 'var(--fs-sm, 13px)', fontWeight: 600, cursor: 'pointer',
};

export default NPSSurvey;
