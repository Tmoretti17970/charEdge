// ═══════════════════════════════════════════════════════════════════
// charEdge — TruePnLCard (Task 4.1.4)
//
// Dashboard widget displaying fee/slippage decomposition per trade.
// Shows: Gross PnL → Commissions → Funding → Slippage → Net PnL
// Uses the existing TruePnL.ts computation engine.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { useJournalStore } from '../../../state/useJournalStore.js';
import { computeBatchTruePnL } from '../../../services/TruePnL.ts';

const FONT = 'var(--forge-font, Inter, sans-serif)';
const MONO = 'var(--forge-mono, "JetBrains Mono", monospace)';

const CARD_STYLE = {
    background: 'rgba(20, 20, 30, 0.6)',
    backdropFilter: 'blur(16px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '16px',
    padding: '20px',
    minWidth: '280px',
};

const LABEL_STYLE = {
    fontSize: '11px',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.45)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '8px',
    fontFamily: FONT,
};

const COST_COLORS = {
    gross: '#60a5fa',       // blue
    commissions: '#f87171', // red
    funding: '#fb923c',     // orange
    slippage: '#a78bfa',    // purple
    net: '#34d399',         // green (positive) — overridden when negative
};

// ─── Component ──────────────────────────────────────────────────

export default function TruePnLCard() {
    const trades = useJournalStore((s) => s.trades);
    const [expanded, setExpanded] = useState(false);

    const summary = useMemo(() => {
        if (!trades || trades.length === 0) return null;
        // Map journal trades to TruePnL input format
        const mapped = trades
            .filter((t) => t.entry && t.exit)
            .map((t) => ({
                entry: t.entry,
                exit: t.exit,
                qty: t.qty || t.quantity || 1,
                fees: t.fees || t.commission || 0,
                side: t.side || 'long',
                pnl: t.pnl,
                fundingRate: t.fundingRate || 0,
                intendedEntry: t.intendedEntry,
                intendedExit: t.intendedExit,
            }));
        if (mapped.length === 0) return null;
        return computeBatchTruePnL(mapped);
    }, [trades]);

    // No data state
    if (!summary) {
        return (
            <div style={CARD_STYLE}>
                <div style={LABEL_STYLE}>True P&L Breakdown</div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: FONT, color: 'rgba(255,255,255,0.2)' }}>—</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: FONT }}>
                    Log trades with entry/exit to see fee decomposition
                </div>
            </div>
        );
    }

    const { total, avgFeeImpactPct, highFeeTradeCount, perTrade } = summary;
    const netColor = total.netPnL >= 0 ? COST_COLORS.net : '#f87171';
    const netSign = total.netPnL >= 0 ? '+' : '';

    // Stacked bar segments (proportional widths)
    const absGross = Math.abs(total.grossPnL);
    const segments = [
        { label: 'Fee', value: total.commissions, color: COST_COLORS.commissions },
        { label: 'Fund', value: total.fundingRate, color: COST_COLORS.funding },
        { label: 'Slip', value: total.slippage, color: COST_COLORS.slippage },
    ].filter((s) => s.value > 0);

    const totalCost = segments.reduce((sum, s) => sum + s.value, 0);
    const barWidth = absGross > 0 ? Math.min((totalCost / absGross) * 100, 100) : 0;

    return (
        <div style={CARD_STYLE}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={LABEL_STYLE}>True P&L Breakdown</div>
                <button
                    onClick={() => setExpanded(!expanded)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.4)',
                        fontSize: 10,
                        cursor: 'pointer',
                        fontFamily: FONT,
                        textDecoration: 'underline',
                        textDecorationColor: 'rgba(255,255,255,0.15)',
                    }}
                >
                    {expanded ? 'Collapse' : 'Details'}
                </button>
            </div>

            {/* Net PnL */}
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: FONT, fontVariantNumeric: 'tabular-nums', color: netColor, lineHeight: 1.2, marginBottom: 4 }}>
                {netSign}${total.netPnL.toFixed(2)}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: FONT, fontVariantNumeric: 'tabular-nums', marginBottom: 14 }}>
                Gross: ${total.grossPnL.toFixed(2)} · Costs: ${total.totalCosts.toFixed(2)}
                <span style={{ marginLeft: 8, opacity: 0.5 }}>({perTrade.length} trades)</span>
            </div>

            {/* Cost Impact Bar */}
            <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: FONT }}>Fee Impact</span>
                    <span style={{ fontSize: 10, color: avgFeeImpactPct > 50 ? '#f87171' : 'rgba(255,255,255,0.5)', fontWeight: 600, fontFamily: MONO }}>
                        {avgFeeImpactPct.toFixed(1)}% avg
                    </span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', display: 'flex' }}>
                    {segments.map((seg, i) => {
                        const w = absGross > 0 ? (seg.value / absGross) * 100 : 0;
                        return (
                            <div
                                key={`${seg.label}-${i}`}
                                title={`${seg.label}: $${seg.value.toFixed(2)}`}
                                style={{
                                    width: `${w}%`,
                                    height: '100%',
                                    background: seg.color,
                                    transition: 'width 0.3s ease',
                                }}
                            />
                        );
                    })}
                </div>
                {/* Legend */}
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                    {segments.map((seg, i) => (
                        <div key={`${seg.label}-legend-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: seg.color }} />
                            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: FONT }}>{seg.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* High-fee warning */}
            {highFeeTradeCount > 0 && (
                <div style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#fca5a5',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: expanded ? 12 : 0,
                }}>
                    <span>⚠️</span>
                    <span>{highFeeTradeCount} trade{highFeeTradeCount > 1 ? 's' : ''} with fees &gt;50% of gross P&L</span>
                </div>
            )}

            {/* Expanded: per-cost breakdown */}
            {expanded && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                    {[
                        { label: 'Commissions', value: total.commissions, color: COST_COLORS.commissions },
                        { label: 'Funding Rate', value: total.fundingRate, color: COST_COLORS.funding },
                        { label: 'Slippage', value: total.slippage, color: COST_COLORS.slippage },
                    ].map((row) => (
                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: row.color }} />
                                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: FONT }}>{row.label}</span>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, fontFamily: MONO, color: row.value > 0 ? row.color : 'rgba(255,255,255,0.2)', fontVariantNumeric: 'tabular-nums' }}>
                                -${row.value.toFixed(2)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export { TruePnLCard };
