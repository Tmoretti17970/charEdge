// ═══════════════════════════════════════════════════════════════════
// Mobile Settings — Shared Primitives
// Reusable UI primitives for mobile settings sections.
// ═══════════════════════════════════════════════════════════════════

import { C, F, M } from '../../../constants.js';
import { radii } from '../../../theme/tokens.js';
import { Btn, inputStyle } from '../ui/UIKit.jsx';

// ─── Mobile Input Style ─────────────────────────────────────────

export const mobileInput = {
    ...inputStyle,
    minHeight: 44,
    fontSize: 14,
    padding: '10px 14px',
    borderRadius: radii.md,
    width: '100%',
    boxSizing: 'border-box',
};

// ─── Accordion Section ──────────────────────────────────────────

export function AccordionSection({ id, icon, label, isOpen, onToggle, isDanger, children }) {
    return (
        <div
            style={{
                marginBottom: 8,
                borderRadius: 14,
                border: `1px solid ${isDanger && isOpen ? C.r + '30' : C.bd}`,
                background: isDanger && isOpen ? C.r + '04' : C.sf,
                overflow: 'hidden',
            }}
            role="region"
            aria-label={label}
        >
            <button
                onClick={onToggle}
                className="tf-btn"
                aria-expanded={isOpen}
                aria-controls={`section-${id}`}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '16px 16px',
                    minHeight: 52,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                }}
            >
                <span style={{ fontSize: 18 }}>{icon}</span>
                <span
                    style={{
                        flex: 1,
                        fontSize: 15,
                        fontWeight: 600,
                        fontFamily: F,
                        color: isDanger ? C.r : C.t1,
                    }}
                >
                    {label}
                </span>
                <span
                    style={{
                        fontSize: 14,
                        color: C.t3,
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                    }}
                >
                    ▼
                </span>
            </button>

            {isOpen && (
                <div id={`section-${id}`} className="tf-fade-scale" style={{ padding: '0 16px 16px' }}>
                    {children}
                </div>
            )}
        </div>
    );
}

// ─── Mobile Setting Row ─────────────────────────────────────────

export function MobileRow({ label, hint, children }) {
    return (
        <div style={{ marginBottom: 16 }}>
            <label
                style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    color: C.t2,
                    marginBottom: 6,
                }}
            >
                {label}
            </label>
            {children}
            {hint && <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>{hint}</div>}
        </div>
    );
}

// ─── Mobile Button ──────────────────────────────────────────────

export function MobileBtn({ children, onClick, variant, disabled, style }) {
    return (
        <Btn
            onClick={onClick}
            variant={variant}
            disabled={disabled}
            style={{
                fontSize: 14,
                padding: '12px 18px',
                minHeight: 44,
                ...style,
            }}
        >
            {children}
        </Btn>
    );
}

// ─── Status Pill ────────────────────────────────────────────────

export function StatusPill({ ok, label }) {
    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                borderRadius: 12,
                background: ok ? C.g + '12' : C.bd + '30',
                border: `1px solid ${ok ? C.g + '40' : C.bd}`,
                fontSize: 11,
                fontFamily: M,
                fontWeight: 600,
                color: ok ? C.g : C.t3,
            }}
        >
            {ok ? '●' : '○'} {label}
        </span>
    );
}

// ─── Alert Banner ───────────────────────────────────────────────

export function MobileAlert({ ok, message }) {
    if (!message) return null;
    return (
        <div
            style={{
                marginTop: 10,
                padding: '10px 14px',
                borderRadius: radii.md,
                background: ok ? C.g + '12' : C.r + '12',
                borderLeft: `3px solid ${ok ? C.g : C.r}`,
                fontSize: 13,
                fontFamily: M,
                color: ok ? C.g : C.r,
            }}
        >
            {message}
        </div>
    );
}
