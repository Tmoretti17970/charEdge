// ═══════════════════════════════════════════════════════════════════
// charEdge — Dashboard Primitives
//
// Shared sub-components used by both DashboardNarrativeLayout and
// DashboardCustomLayout. Extracted from DashboardPanel.jsx L900-1135.
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { C, GLASS, DEPTH } from '../../../constants.js';
import { useUserStore } from '../../../state/useUserStore';
import { text, layout, space, preset, radii } from '../../../theme/tokens.js';
import { METRIC_TIPS } from '../../../utils.js';
import { StatCard, Card } from '../ui/UIKit.jsx';
import s from './DashboardPanel.module.css';

// ─── DashHeader ────────────────────────────────────────────────

export function DashHeader({
    trades,
    _computing,
    layoutMode,
    onLayoutToggle,
    editMode,
    onToggleEdit,
    onCustomize,
    _activePreset,
}) {
    return (
        <div className={s.dashHeader}>
            <div className={s.dashHeaderLeft}>
                {trades.length > 0 && (
                    <span className={s.tradeCount} style={text.monoXs}>{trades.length} trades</span>
                )}
                <UnitToggle />
            </div>

            <div className={s.dashHeaderRight}>
                <HeaderBtn label={layoutMode === 'narrative' ? '⊞ Custom' : '☰ Story'} onClick={onLayoutToggle} />
                {layoutMode === 'custom' && (
                    <>
                        <HeaderBtn label={editMode ? '✓ Done' : 'Edit'} active={editMode} onClick={onToggleEdit} />
                        <HeaderBtn label="⚙ Widgets" onClick={onCustomize} />
                    </>
                )}
            </div>
        </div>
    );
}

// ─── UnitToggle ────────────────────────────────────────────────

export function UnitToggle() {
    const unit = useUserStore((s) => s.unit);
    const cycle = useUserStore((s) => s.cycle);
    const label = unit === 'dollar' ? '$' : unit === 'percent' ? '%' : 'R';

    return (
        <button
            onClick={cycle}
            className={`tf-btn ${s.unitToggle}`}
            title={`Display unit: ${unit} (click to cycle)`}
            style={{ ...text.monoXs, border: `1px solid ${C.b}30`, background: C.b + '10', color: C.b }}
        >
            {label}
        </button>
    );
}

// ─── HeaderBtn ─────────────────────────────────────────────────

export function HeaderBtn({ label, onClick, active }) {
    return (
        <button
            onClick={onClick}
            className={`tf-btn ${s.headerBtn}`}
            style={{ ...text.label, border: `1px solid ${active ? C.b : C.bd}`, background: active ? C.b + '15' : C.sf, color: active ? C.b : C.t2 }}
        >
            {label}
        </button>
    );
}

// ─── SectionHeader ─────────────────────────────────────────────

export function SectionHeader({ label }) {
    return (
        <div className="tf-section-accent" style={{ ...text.label, marginBottom: 12 }}>
            {label}
        </div>
    );
}

// ─── NarrativeSectionHeader ────────────────────────────────────

export function NarrativeSectionHeader({ step, label, description }) {
    return (
        <div className={`tf-section-enter ${s.narrativeHeader}`}>
            <span className={s.narrativeStep} style={{ ...text.captionSm, color: C.b, background: C.b + '12' }}>
                {step}
            </span>
            <div>
                <div className={s.narrativeLabel} style={text.h3}>{label}</div>
                {description && <div className={s.narrativeDesc} style={text.caption}>{description}</div>}
            </div>
        </div>
    );
}

// ─── NarrativeDivider ──────────────────────────────────────────

export function NarrativeDivider() {
    return (
        <div className={`tf-narrative-divider ${s.divider}`} style={{ background: `linear-gradient(90deg, transparent, ${C.bd}60, transparent)` }} />
    );
}

// ─── MetricCard ────────────────────────────────────────────────

export function MetricCard({ label, value, color }) {
    const tip = METRIC_TIPS[label];
    return <StatCard tier="secondary" label={label} value={value} color={color} style={tip ? { cursor: 'help' } : {}} />;
}

// ─── OldSectionLabel ───────────────────────────────────────────

export function OldSectionLabel({ text: label, right, style: customStyle = {} }) {
    return (
        <div style={{ ...layout.rowBetween, marginBottom: space[2] + 2, ...customStyle }}>
            <div style={preset.sectionLabel}>{label}</div>
            {right && <div style={text.monoXs}>{right}</div>}
        </div>
    );
}

// ─── MetricRow ─────────────────────────────────────────────────

export function MetricRow({ label, value, color = C.t1, tip }) {
    return (
        <div style={{ ...preset.metricRow }} title={tip || undefined}>
            <span style={{ ...text.bodySm, display: 'flex', alignItems: 'center', gap: 4 }}>
                {label}
                {tip && (
                    <span style={{ fontSize: 10, color: C.t3, cursor: 'help' }} title={tip}>ⓘ</span>
                )}
            </span>
            <span style={{ ...text.mono, fontWeight: 700, color }}>{value}</span>
        </div>
    );
}

// ─── BentoMetricCard ───────────────────────────────────────────

export function BentoMetricCard({ label, value, color, data = [], _inverse = false, tip }) {
    const [showTip, setShowTip] = useState(false);
    const width = 100;
    const height = 30;
    let sparkline = null;

    const validData = data.filter(d => typeof d === 'number' && !isNaN(d));

    if (validData.length > 2) {
        const min = Math.min(...validData);
        const max = Math.max(...validData);
        const range = max - min || 1;
        const points = validData.map((d, i) => {
            const x = (i / (validData.length - 1)) * width;
            let y = height - ((d - min) / range) * height;
            if (isNaN(y)) y = height;
            return `${x},${y}`;
        }).join(' ');

        sparkline = (
            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ marginTop: 'auto', opacity: 0.75 }}>
                <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
            </svg>
        );
    } else {
        sparkline = <div style={{ height, marginTop: 'auto' }} />;
    }

    return (
        <Card
            className="tf-glass-card"
            style={{
                padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
                background: GLASS.subtle, backdropFilter: GLASS.blurSm, WebkitBackdropFilter: GLASS.blurSm,
                position: 'relative', cursor: tip ? 'help' : 'default',
            }}
            onMouseEnter={tip ? () => setShowTip(true) : undefined}
            onMouseLeave={tip ? () => setShowTip(false) : undefined}
        >
            <div style={{ ...text.label, fontSize: 10, letterSpacing: '0.08em', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                {label}
                {tip && <span style={{ fontSize: 9, color: C.t3, opacity: 0.6 }}>ⓘ</span>}
            </div>
            <div style={{ ...text.dataLg, fontSize: 24, fontWeight: 800, color, letterSpacing: '-0.5px' }}>{value}</div>
            {sparkline}

            {tip && showTip && (
                <div className="tf-metric-tooltip" style={{
                    position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                    marginBottom: 8, padding: '10px 14px', background: GLASS.standard,
                    backdropFilter: GLASS.blurMd, WebkitBackdropFilter: GLASS.blurMd,
                    border: GLASS.border, borderRadius: radii.md, boxShadow: DEPTH[2],
                    zIndex: 50, maxWidth: 220, minWidth: 160, pointerEvents: 'none',
                }}>
                    <div style={{ ...text.caption, fontWeight: 700, color: C.t1, marginBottom: 4 }}>{label}</div>
                    <div style={{ ...text.captionSm, color: C.t2, lineHeight: 1.5 }}>{tip}</div>
                    <div style={{
                        position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%) rotate(45deg)',
                        width: 8, height: 8, background: GLASS.standard, border: GLASS.border,
                        borderTop: 'none', borderLeft: 'none',
                    }} />
                </div>
            )}
        </Card>
    );
}
