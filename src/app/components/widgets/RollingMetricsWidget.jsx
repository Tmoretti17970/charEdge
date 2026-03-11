// ═══════════════════════════════════════════════════════════════════
// charEdge — Rolling Metrics Widget (C8.4)
//
// Sprint 9 #68: Extracted from DashboardWidgets.jsx.
// 7/30/90-day rolling performance summary table.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, memo } from 'react';
import { safeSum } from '../../../charting_library/model/Money.js';
import { C, M } from '../../../constants.js';
import { fmtD } from '../../../utils.js';
import { Card } from '../ui/UIKit.jsx';
import { hdr } from './widgetStyles.js';

export const RollingMetricsWidget = memo(function RollingMetricsWidget({ trades }) {
    const rolling = useMemo(() => {
        const now = new Date();
        const periods = [
            { label: '7 Days', days: 7 },
            { label: '30 Days', days: 30 },
            { label: '90 Days', days: 90 },
        ];

        return periods.map((p) => {
            const cutoff = new Date(now - p.days * 86400000);
            const filtered = trades.filter((t) => new Date(t.date) >= cutoff);
            const pnls = filtered.map((t) => t.pnl ?? 0);
            const wins = pnls.filter((p) => p > 0).length;
            const totalPnl = safeSum(pnls);
            const avgPnl = pnls.length ? totalPnl / pnls.length : 0;

            return {
                label: p.label,
                count: filtered.length,
                totalPnl,
                avgPnl,
                winRate: pnls.length ? Math.round((wins / pnls.length) * 100) : 0,
                avgPerDay: p.days > 0 ? totalPnl / p.days : 0,
            };
        });
    }, [trades]);

    return (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={hdr()}>📈 Rolling Performance</div>

            {/* Header row */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '80px repeat(4, 1fr)',
                    padding: '6px 14px',
                    fontSize: 9,
                    color: C.t3,
                    fontWeight: 700,
                    fontFamily: M,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    borderBottom: `1px solid ${C.bd}`,
                }}
            >
                <span>Period</span>
                <span style={{ textAlign: 'right' }}>Trades</span>
                <span style={{ textAlign: 'right' }}>P&L</span>
                <span style={{ textAlign: 'right' }}>Win%</span>
                <span style={{ textAlign: 'right' }}>Avg/Day</span>
            </div>

            {rolling.map((r, i) => (
                <div
                    key={i}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '80px repeat(4, 1fr)',
                        padding: '7px 14px',
                        fontSize: 11,
                        borderBottom: i < rolling.length - 1 ? `1px solid ${C.bd}15` : 'none',
                    }}
                >
                    <span style={{ fontWeight: 600, color: C.t1 }}>{r.label}</span>
                    <span style={{ textAlign: 'right', fontFamily: M, color: C.t2 }}>{r.count}</span>
                    <span style={{ textAlign: 'right', fontFamily: M, fontWeight: 700, color: r.totalPnl >= 0 ? C.g : C.r }}>
                        {fmtD(r.totalPnl)}
                    </span>
                    <span style={{ textAlign: 'right', fontFamily: M, color: r.winRate >= 50 ? C.g : C.r }}>{r.winRate}%</span>
                    <span style={{ textAlign: 'right', fontFamily: M, fontSize: 10, color: r.avgPerDay >= 0 ? C.g : C.r }}>
                        {fmtD(r.avgPerDay)}
                    </span>
                </div>
            ))}
        </Card>
    );
});
