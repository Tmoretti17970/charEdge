// ═══════════════════════════════════════════════════════════════════
// charEdge — Sparkline Component
//
// Tiny inline SVG sparkline for trade P&L visualization.
// Used in the Spotlight Logbook as hover tooltips on trade rows.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';

/**
 * Sparkline — Tiny SVG line chart.
 * @param {number[]} data - Array of values to plot
 * @param {number} [width=80] - SVG width in px
 * @param {number} [height=28] - SVG height in px
 * @param {string} [color] - Line color (defaults to green if net positive, red if negative)
 * @param {boolean} [showArea=true] - Whether to show gradient area fill
 */
function Sparkline({ data = [], width = 80, height = 28, color, showArea = true }) {
    if (!data || data.length < 2) {
        return (
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
                <line x1={4} y1={height / 2} x2={width - 4} y2={height / 2} stroke="#555" strokeWidth={1} strokeDasharray="2,2" />
            </svg>
        );
    }

    const pad = 2;
    const w = width - pad * 2;
    const h = height - pad * 2;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((v, i) => {
        const x = pad + (i / (data.length - 1)) * w;
        const y = pad + h - ((v - min) / range) * h;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const polyline = points.join(' ');
    const net = data[data.length - 1] - data[0];
    const lineColor = color || (net >= 0 ? '#31D158' : '#FF453A');
    const gradId = `spark-grad-${Math.random().toString(36).slice(2, 8)}`;

    // Area path: polyline + bottom-right + bottom-left
    const areaPath = `M${points[0]} ${points.slice(1).map((p) => `L${p}`).join(' ')} L${(pad + w).toFixed(1)},${(pad + h).toFixed(1)} L${pad},${(pad + h).toFixed(1)} Z`;

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
            {showArea && (
                <>
                    <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
                            <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
                        </linearGradient>
                    </defs>
                    <path d={areaPath} fill={`url(#${gradId})`} />
                </>
            )}
            <polyline
                points={polyline}
                fill="none"
                stroke={lineColor}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* End dot */}
            {data.length > 0 && (
                <circle
                    cx={parseFloat(points[points.length - 1].split(',')[0])}
                    cy={parseFloat(points[points.length - 1].split(',')[1])}
                    r={2}
                    fill={lineColor}
                />
            )}
        </svg>
    );
}

export default React.memo(Sparkline);
