// ═══════════════════════════════════════════════════════════════════
// charEdge — MFE/MAE Visualizer (Task 4.1.12)
//
// Dashboard widget:
// - Efficiency ratio bar chart (how much MFE was captured per trade)
// - Scatter plot: MAE vs MFE per trade (for optimal stop placement)
// - Summary stats: avg efficiency, best/worst trades
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState, useRef, useEffect } from 'react';
import { useJournalStore } from '../../../state/useJournalStore';

const FONT = 'var(--forge-font, Inter, sans-serif)';
const _MONO = 'var(--forge-mono, "JetBrains Mono", monospace)';

// ─── Component ──────────────────────────────────────────────────

export default function MFEMAEVisualizer() {
    const trades = useJournalStore((s) => s.trades);
    const canvasRef = useRef(null);
    const [view, setView] = useState('efficiency'); // 'efficiency' | 'scatter'
    const [hovered, setHovered] = useState(null);

    // Filter trades with MFE/MAE data
    const mfeTrades = useMemo(() => {
        return (trades || [])
            .filter((t) => t.mfe != null && t.mae != null && t.mfe >= 0)
            .slice(-30); // Last 30 trades
    }, [trades]);

    // Summary stats
    const stats = useMemo(() => {
        if (mfeTrades.length === 0) return null;
        const efficiencies = mfeTrades
            .filter((t) => t.efficiencyRatio != null)
            .map((t) => t.efficiencyRatio);

        return {
            avgEfficiency: efficiencies.length > 0
                ? (efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length * 100).toFixed(0)
                : '—',
            bestCapture: efficiencies.length > 0 ? (Math.max(...efficiencies) * 100).toFixed(0) : '—',
            avgMFE: (mfeTrades.reduce((s, t) => s + (t.mfe || 0), 0) / mfeTrades.length).toFixed(2),
            avgMAE: (mfeTrades.reduce((s, t) => s + (t.mae || 0), 0) / mfeTrades.length).toFixed(2),
            count: mfeTrades.length,
        };
    }, [mfeTrades]);

    // Canvas rendering for scatter plot
    useEffect(() => {
        if (view !== 'scatter' || !canvasRef.current || mfeTrades.length === 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);

        // Clear
        ctx.clearRect(0, 0, w, h);

        // Find ranges
        const maxMFE = Math.max(...mfeTrades.map((t) => t.mfe || 0), 1);
        const maxMAE = Math.max(...mfeTrades.map((t) => t.mae || 0), 1);
        const pad = 30;

        // Grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const x = pad + (i / 4) * (w - pad * 2);
            const y = pad + (i / 4) * (h - pad * 2);
            ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, h - pad); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
        }

        // Labels
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('MAE →', w / 2, h - 6);
        ctx.save();
        ctx.translate(10, h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('MFE →', 0, 0);
        ctx.restore();

        // Dots
        for (const trade of mfeTrades) {
            const x = pad + ((trade.mae || 0) / maxMAE) * (w - pad * 2);
            const y = h - pad - ((trade.mfe || 0) / maxMFE) * (h - pad * 2);
            const pnl = trade.pnl || 0;

            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = pnl >= 0 ? 'rgba(52, 211, 153, 0.7)' : 'rgba(248, 113, 113, 0.7)';
            ctx.fill();

            // Outer glow
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.strokeStyle = pnl >= 0 ? 'rgba(52, 211, 153, 0.2)' : 'rgba(248, 113, 113, 0.2)';
            ctx.stroke();
        }

        // Diagonal line (MFE = MAE)
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.moveTo(pad, h - pad);
        ctx.lineTo(w - pad, pad);
        ctx.stroke();
        ctx.setLineDash([]);
    }, [view, mfeTrades]);

    // No data state
    if (!stats || mfeTrades.length === 0) {
        return (
            <div style={CARD_STYLE}>
                <div style={LABEL_STYLE}>MFE / MAE Analysis</div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: FONT, color: 'rgba(255,255,255,0.2)' }}>—</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: FONT }}>
                    Trades with MFE/MAE data will appear here
                </div>
            </div>
        );
    }

    return (
        <div style={CARD_STYLE}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={LABEL_STYLE}>MFE / MAE Analysis</div>
                <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: 2 }}>
                    {[{ key: 'efficiency', label: 'Bars' }, { key: 'scatter', label: 'Scatter' }].map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setView(key)}
                            style={{
                                padding: '3px 10px',
                                borderRadius: 4,
                                background: view === key ? 'rgba(96, 165, 250, 0.15)' : 'transparent',
                                border: 'none',
                                color: view === key ? '#60a5fa' : 'rgba(255,255,255,0.35)',
                                fontSize: 10,
                                fontWeight: 600,
                                fontFamily: FONT,
                                cursor: 'pointer',
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary cards */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <div style={STAT_CARD}>
                    <div style={STAT_LABEL}>Avg Captured</div>
                    <div style={{ ...STAT_VALUE, color: '#60a5fa' }}>{stats.avgEfficiency}%</div>
                </div>
                <div style={STAT_CARD}>
                    <div style={STAT_LABEL}>Best</div>
                    <div style={{ ...STAT_VALUE, color: '#34d399' }}>{stats.bestCapture}%</div>
                </div>
                <div style={STAT_CARD}>
                    <div style={STAT_LABEL}>Avg MFE</div>
                    <div style={{ ...STAT_VALUE, color: '#34d399' }}>${stats.avgMFE}</div>
                </div>
                <div style={STAT_CARD}>
                    <div style={STAT_LABEL}>Avg MAE</div>
                    <div style={{ ...STAT_VALUE, color: '#f87171' }}>${stats.avgMAE}</div>
                </div>
            </div>

            {/* Efficiency bar chart */}
            {view === 'efficiency' && (
                <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 80 }}>
                    {mfeTrades.map((trade, i) => {
                        const eff = trade.efficiencyRatio != null ? Math.max(0, Math.min(trade.efficiencyRatio, 1.5)) : 0;
                        const h = Math.max(2, eff * 50);
                        const color = eff >= 0.7 ? 'rgba(52, 211, 153, 0.6)' : eff >= 0.4 ? 'rgba(96, 165, 250, 0.6)' : 'rgba(251, 146, 60, 0.6)';
                        const isHov = hovered === i;
                        return (
                            <div
                                key={`bar-${trade.id || i}`}
                                title={`${trade.symbol}: ${(eff * 100).toFixed(0)}% captured`}
                                onMouseEnter={() => setHovered(i)}
                                onMouseLeave={() => setHovered(null)}
                                style={{
                                    flex: 1,
                                    height: h,
                                    borderRadius: 2,
                                    background: isHov ? color.replace('0.6', '0.9') : color,
                                    transition: 'height 0.3s ease, background 0.15s',
                                    cursor: 'pointer',
                                    minWidth: 3,
                                    maxWidth: 12,
                                }}
                            />
                        );
                    })}
                </div>
            )}

            {/* Scatter plot (canvas) */}
            {view === 'scatter' && (
                <canvas
                    ref={canvasRef}
                    style={{ width: '100%', height: 140, borderRadius: 8 }}
                />
            )}

            {/* Footer */}
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: FONT, marginTop: 8, textAlign: 'center' }}>
                {stats.count} trades · Green=win · Red=loss
                {view === 'scatter' && ' · Diagonal=MFE equals MAE'}
            </div>
        </div>
    );
}

// ─── Styles ─────────────────────────────────────────────────────

const CARD_STYLE = {
    background: 'rgba(20, 20, 30, 0.6)',
    backdropFilter: 'blur(16px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 20,
    minWidth: 280,
};

const LABEL_STYLE = {
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.45)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontFamily: 'var(--forge-font, Inter, sans-serif)',
};

const STAT_CARD = {
    flex: 1,
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.04)',
    borderRadius: 8,
    padding: '6px 8px',
    textAlign: 'center',
};

const STAT_LABEL = {
    fontSize: 8,
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase',
    fontFamily: 'var(--forge-font, Inter, sans-serif)',
    marginBottom: 2,
};

const STAT_VALUE = {
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'var(--forge-mono, "JetBrains Mono", monospace)',
    fontVariantNumeric: 'tabular-nums',
};

export { MFEMAEVisualizer };
