// ═══════════════════════════════════════════════════════════════════
// charEdge — Context Performance Widget (C8.7)
//
// Sprint 9 #68: Extracted from DashboardWidgets.jsx.
// Shows per-tag trading performance (win rate, avg P&L) from
// Intelligence Layer context data.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, memo } from 'react';
import { C, M } from '../../../constants.js';
import { fmtD } from '../../../utils.js';
import { Card } from '../ui/UIKit.jsx';
import { hdr } from './widgetStyles.js';

export const ContextPerformanceWidget = memo(function ContextPerformanceWidget({ trades }) {
    const tagStats = useMemo(() => {
        const withCtx = trades.filter((t) => t.context?.tags?.length > 0);
        if (!withCtx.length) return [];

        const byTag = {};
        for (const t of withCtx) {
            const pnl = t.pnl ?? 0;
            for (const tag of t.context.tags) {
                if (!byTag[tag]) byTag[tag] = { tag, count: 0, wins: 0, totalPnl: 0 };
                byTag[tag].count++;
                if (pnl > 0) byTag[tag].wins++;
                byTag[tag].totalPnl += pnl;
            }
        }

        return Object.values(byTag)
            .map((b) => ({
                ...b,
                winRate: b.count > 0 ? Math.round((b.wins / b.count) * 100) : 0,
                avgPnl: b.count > 0 ? Math.round(b.totalPnl / b.count) : 0,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);
    }, [trades]);

    return (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={hdr()}>🧠 Context Performance</div>

            {tagStats.length === 0 ? (
                <div style={{ padding: '12px 14px', fontSize: 11, color: C.t3, textAlign: 'center' }}>
                    Trade context is captured when Intelligence Layer is active
                </div>
            ) : (
                tagStats.map((s, i) => (
                    <div
                        key={i}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 50px 60px 50px',
                            padding: '6px 14px',
                            fontSize: 10,
                            borderBottom: `1px solid ${C.bd}10`,
                            alignItems: 'center',
                        }}
                    >
                        <span
                            style={{
                                fontWeight: 600,
                                color: C.t1,
                                background: C.b + '10',
                                borderRadius: 3,
                                padding: '1px 6px',
                                fontSize: 9,
                                display: 'inline-block',
                                maxWidth: 'fit-content',
                            }}
                        >
                            {s.tag}
                        </span>
                        <span style={{ textAlign: 'right', fontFamily: M, color: C.t3, fontSize: 9 }}>{s.count} trades</span>
                        <span
                            style={{
                                textAlign: 'right',
                                fontFamily: M,
                                fontWeight: 700,
                                color: s.winRate >= 50 ? C.g : C.r,
                            }}
                        >
                            {s.winRate}%
                        </span>
                        <span
                            style={{
                                textAlign: 'right',
                                fontFamily: M,
                                fontWeight: 700,
                                color: s.avgPnl >= 0 ? C.g : C.r,
                                fontSize: 9,
                            }}
                        >
                            {fmtD(s.avgPnl)}
                        </span>
                    </div>
                ))
            )}
        </Card>
    );
});
