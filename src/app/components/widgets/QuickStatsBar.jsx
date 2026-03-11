// ═══════════════════════════════════════════════════════════════════
// charEdge — Quick Stats Bar (C8.11)
//
// Sprint 9 #68: Extracted from DashboardWidgets.jsx.
// Sticky top-of-page compact stats strip: Total P&L, Today,
// Win Rate, Trade Count, Profit Factor.
// ═══════════════════════════════════════════════════════════════════

import { memo } from 'react';
import { C, M } from '../../../constants.js';
import { fmtD } from '../../../utils.js';

export const QuickStatsBar = memo(function QuickStatsBar({ result, todayPnl, _todayCount }) {
    if (!result) return null;

    const stats = [
        { label: 'Total P&L', value: fmtD(result.totalPnl), color: result.totalPnl >= 0 ? C.g : C.r },
        { label: 'Today', value: fmtD(todayPnl), color: todayPnl >= 0 ? C.g : todayPnl < 0 ? C.r : C.t3 },
        {
            label: 'Win Rate',
            value: `${result.winCount && result.tradeCount ? Math.round((result.winCount / result.tradeCount) * 100) : 0}%`,
            color: C.t1,
        },
        { label: 'Trades', value: `${result.tradeCount}`, color: C.t2 },
        { label: 'PF', value: result.pf === Infinity ? '∞' : result.pf?.toFixed(2), color: result.pf >= 1.5 ? C.g : C.t2 },
    ];

    return (
        <div
            style={{
                display: 'flex',
                gap: 16,
                padding: '8px 14px',
                background: C.sf,
                borderRadius: 8,
                marginBottom: 16,
                overflow: 'auto',
                border: `1px solid ${C.bd}`,
            }}
        >
            {stats.map((s, i) => (
                <div key={i} style={{ textAlign: 'center', minWidth: 60 }}>
                    <div style={{ fontSize: 9, color: C.t3, fontWeight: 600, fontFamily: M, marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, fontFamily: M, color: s.color }}>{s.value}</div>
                </div>
            ))}
        </div>
    );
});
