// ═══════════════════════════════════════════════════════════════════
// Shared Risk Calculator sub-components
// RiskGauge, Label, SideBtn, Warning, InfoBox, SectionLabel
// ═══════════════════════════════════════════════════════════════════

import { C, M } from '@/constants.js';

export function RiskGauge({ level, color }) {
    const segments = 10;
    const arcWidth = 140;
    const arcHeight = 50;

    return (
        <svg width={arcWidth} height={arcHeight + 12} viewBox={`0 0 ${arcWidth} ${arcHeight + 12}`}>
            {Array.from({ length: segments }).map((_, i) => {
                const startAngle = Math.PI + (i / segments) * Math.PI;
                const endAngle = Math.PI + ((i + 1) / segments) * Math.PI;
                const cx = arcWidth / 2;
                const cy = arcHeight + 2;
                const r = 45;
                const x1 = cx + r * Math.cos(startAngle);
                const y1 = cy + r * Math.sin(startAngle);
                const x2 = cx + r * Math.cos(endAngle);
                const y2 = cy + r * Math.sin(endAngle);
                const filled = i < level;
                const segColor = i < 3 ? C.g : i < 5 ? '#66BB6A' : i < 7 ? C.y : i < 9 ? '#FF9800' : C.r;

                return (
                    <path
                        key={i}
                        d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
                        stroke={filled ? segColor : C.bd}
                        strokeWidth={6}
                        fill="none"
                        strokeLinecap="round"
                        opacity={filled ? 1 : 0.3}
                    />
                );
            })}
            <text
                x={arcWidth / 2}
                y={arcHeight}
                textAnchor="middle"
                fill={color}
                fontSize="14"
                fontWeight="800"
                fontFamily={M}
            >
                {level}/10
            </text>
        </svg>
    );
}

export function Label({ children, style: s }) {
    return (
        <label
            style={{
                display: 'block',
                fontSize: 10,
                fontWeight: 600,
                color: C.t3,
                marginBottom: 3,
                fontFamily: M,
                ...s,
            }}
        >
            {children}
        </label>
    );
}

export function SideBtn({ children, active, color, onClick }) {
    return (
        <button
            className="tf-btn"
            onClick={onClick}
            style={{
                flex: 1,
                padding: '6px 0',
                borderRadius: 5,
                border: `1px solid ${active ? color : C.bd}`,
                background: active ? color + '15' : 'transparent',
                color: active ? color : C.t3,
                fontSize: 11,
                fontWeight: 700,
                fontFamily: M,
                cursor: 'pointer',
            }}
        >
            {children}
        </button>
    );
}

export function Warning({ children }) {
    return (
        <div
            style={{
                padding: '8px 12px',
                background: C.y + '0c',
                borderLeft: `3px solid ${C.y}`,
                borderRadius: '0 6px 6px 0',
                fontSize: 11,
                color: C.y,
                fontFamily: M,
                marginBottom: 6,
            }}
        >
            ⚠ {children}
        </div>
    );
}

export function InfoBox({ children }) {
    return (
        <div
            style={{
                padding: '10px 14px',
                background: C.b + '08',
                borderLeft: `3px solid ${C.b}`,
                borderRadius: '0 6px 6px 0',
                marginTop: 10,
                fontSize: 11,
                color: C.t2,
                lineHeight: 1.6,
            }}
        >
            {children}
        </div>
    );
}

export function SectionLabel({ text }) {
    return (
        <div
            style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.t3,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 8,
                fontFamily: M,
            }}
        >
            {text}
        </div>
    );
}
