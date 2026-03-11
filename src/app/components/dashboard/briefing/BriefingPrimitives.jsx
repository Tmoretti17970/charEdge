// ═══════════════════════════════════════════════════════════════════
// Morning Briefing — Shared UI Primitives
// BriefingTile, MiniStat, MiniSparkline, PhaseIndicator
// ═══════════════════════════════════════════════════════════════════

import { C, M, GLASS } from '../../../../constants.js';

// ─── Button Style ────────────────────────────────────────────────

export const btnStyle = {
    background: 'none',
    border: 'none',
    color: C.t3,
    fontSize: 14,
    cursor: 'pointer',
    padding: '0 2px',
    opacity: 0.5,
    transition: 'opacity 0.15s',
};

// ─── Phase Indicator Pill ────────────────────────────────────────

export function PhaseIndicator({ config }) {
    return (
        <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 10px',
            borderRadius: 100,
            background: config.labelBg(C),
            border: `1px solid ${config.accent(C)}25`,
        }}>
            <div
                className="tf-pulse-dot"
                style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: config.dot(C),
                    boxShadow: `0 0 8px ${config.dot(C)}`,
                    animation: 'tf-pulse 2s ease-in-out infinite',
                }}
            />
            <span style={{
                fontSize: 9, fontWeight: 800, fontFamily: M,
                color: config.accent(C),
                textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>
                {config.label}
            </span>
        </div>
    );
}

// ─── Briefing Tile ───────────────────────────────────────────────

export function BriefingTile({ title, children, isMobile, style = {} }) {
    return (
        <div style={{
            padding: isMobile ? '8px 12px' : '10px 14px',
            borderRadius: 10,
            background: GLASS.subtle,
            backdropFilter: GLASS.blurSm,
            WebkitBackdropFilter: GLASS.blurSm,
            border: GLASS.border,
            marginBottom: isMobile ? 8 : 0,
            transition: 'border-color 0.15s ease',
            ...style,
        }}>
            <div style={{
                fontSize: 9, color: C.t3, fontFamily: M,
                fontWeight: 700, marginBottom: 4,
                letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
                {title}
            </div>
            {children}
        </div>
    );
}

// ─── Mini Stat ───────────────────────────────────────────────────

export function MiniStat({ label, value, color }) {
    return (
        <div>
            <div style={{ fontSize: 9, color: C.t3, fontFamily: M, fontWeight: 600, marginBottom: 1 }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 800, fontFamily: M, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
        </div>
    );
}

// ─── Mini Sparkline ──────────────────────────────────────────────

export function MiniSparkline({ points, width = 60, height = 20 }) {
    if (!points || points.length < 2) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const path = points
        .map((p, i) => {
            const x = (i / (points.length - 1)) * width;
            const y = height - ((p - min) / range) * (height - 4) - 2;
            return `${x},${y}`;
        })
        .join(' ');
    const lastVal = points[points.length - 1];
    const color = lastVal >= 0 ? C.g : C.r;
    return (
        <svg width={width} height={height} style={{ display: 'block', marginTop: 4, marginLeft: 'auto' }}>
            <polyline
                points={path}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.7"
            />
        </svg>
    );
}
