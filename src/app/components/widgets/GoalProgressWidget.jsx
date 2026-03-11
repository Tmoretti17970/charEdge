// ═══════════════════════════════════════════════════════════════════
// charEdge — Goal Progress Widget (C8.5)
//
// Sprint 9 #68: Extracted from DashboardWidgets.jsx.
// Shows daily/weekly/monthly/yearly goal progress bars.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, memo } from 'react';
import { safeSum } from '../../../charting_library/model/Money.js';
import { C, M } from '../../../constants.js';
import { fmtD } from '../../../utils.js';
import { Card } from '../ui/UIKit.jsx';
import { hdr } from './widgetStyles.js';

export const GoalProgressWidget = memo(function GoalProgressWidget({ trades, goals }) {
    const progress = useMemo(() => {
        if (!goals) return [];

        const now = new Date();
        const result = [];

        const periods = {
            daily: { label: 'Daily', filter: (t) => t.date?.startsWith(now.toISOString().slice(0, 10)) },
            weekly: {
                label: 'Weekly',
                filter: (t) => {
                    const d = new Date(t.date);
                    const weekStart = new Date(now);
                    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                    weekStart.setHours(0, 0, 0, 0);
                    return d >= weekStart;
                },
            },
            monthly: { label: 'Monthly', filter: (t) => t.date?.startsWith(now.toISOString().slice(0, 7)) },
            yearly: { label: 'Yearly', filter: (t) => t.date?.startsWith(now.toISOString().slice(0, 4)) },
        };

        for (const [key, period] of Object.entries(periods)) {
            const goal = goals[key];
            if (!goal?.enabled || !goal.target) continue;

            const filtered = trades.filter(period.filter);
            const pnl = safeSum(filtered.map((t) => t.pnl ?? 0));
            const pct = goal.target > 0 ? Math.min(100, Math.round((pnl / goal.target) * 100)) : 0;

            result.push({
                label: period.label,
                target: goal.target,
                current: pnl,
                pct: Math.max(0, pct),
                exceeded: pnl >= goal.target,
                trades: filtered.length,
            });
        }

        return result;
    }, [trades, goals]);

    if (!progress.length) {
        return (
            <Card style={{ padding: 14, textAlign: 'center' }}>
                <div style={hdr()}>🎯 Goals</div>
                <div style={{ fontSize: 11, color: C.t3, padding: '16px 0' }}>Set goals in Settings → Goals</div>
            </Card>
        );
    }

    return (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={hdr()}>🎯 Goal Progress</div>

            {progress.map((g, i) => (
                <div key={i} style={{ padding: '6px 14px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.t1 }}>{g.label}</span>
                        <span style={{ fontSize: 10, fontFamily: M, color: g.exceeded ? C.g : C.t2 }}>
                            {fmtD(g.current)} / {fmtD(g.target)}
                        </span>
                    </div>
                    <div
                        style={{
                            height: 8,
                            borderRadius: 4,
                            background: C.bd,
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                height: '100%',
                                borderRadius: 4,
                                width: `${g.pct}%`,
                                background: g.exceeded
                                    ? `linear-gradient(90deg, ${C.g}, ${C.g}CC)`
                                    : `linear-gradient(90deg, ${C.b}, ${C.b}CC)`,
                                transition: 'width 0.5s ease',
                            }}
                        />
                    </div>
                    <div style={{ fontSize: 9, color: C.t3, marginTop: 2, fontFamily: M }}>
                        {g.pct}% · {g.trades} trades
                    </div>
                </div>
            ))}
        </Card>
    );
});
