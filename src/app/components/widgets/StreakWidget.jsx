// ═══════════════════════════════════════════════════════════════════
// charEdge — Streak Widget (C8.3)
//
// Sprint 9 #68: Extracted from DashboardWidgets.jsx.
// Displays current win/loss streak, best/worst records,
// and a mini streak history bar chart.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, memo } from 'react';
import { C, M } from '../../../constants.js';
import { Card } from '../ui/UIKit.jsx';
import { hdr, metricRow, getMetricLabel, getMetricValue } from './widgetStyles.js';

export const StreakWidget = memo(function StreakWidget({ trades }) {
    const streakData = useMemo(() => {
        if (!trades?.length) return { current: 0, type: 'none', best: 0, worst: 0, history: [] };

        const _current = 0,
            _currentType = 'none';
        let best = 0,
            worst = 0;
        const history = [];
        let streak = 0,
            streakType = null;

        for (let i = trades.length - 1; i >= 0; i--) {
            const win = (trades[i].pnl ?? 0) > 0;
            const type = win ? 'win' : 'loss';

            if (i === trades.length - 1 || type === streakType) {
                streak++;
                streakType = type;
            } else {
                history.push({ count: streak, type: streakType });
                streak = 1;
                streakType = type;
            }
        }
        if (streak > 0) history.push({ count: streak, type: streakType });

        // Current streak from most recent trades
        const sorted = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));
        let cStreak = 0;
        const firstType = (sorted[0]?.pnl ?? 0) > 0 ? 'win' : 'loss';
        for (const t of sorted) {
            const isWin = (t.pnl ?? 0) > 0;
            if ((isWin && firstType === 'win') || (!isWin && firstType === 'loss')) cStreak++;
            else break;
        }

        // Best/worst from history
        const wins = history.filter((h) => h.type === 'win');
        const losses = history.filter((h) => h.type === 'loss');
        best = wins.length ? Math.max(...wins.map((h) => h.count)) : 0;
        worst = losses.length ? Math.max(...losses.map((h) => h.count)) : 0;

        return { current: cStreak, type: firstType, best, worst, history: history.slice(0, 10) };
    }, [trades]);

    const { current, type, best, worst, history } = streakData;

    return (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={hdr()}>🔥 Current Streak</div>

            {/* Big number */}
            <div style={{ textAlign: 'center', padding: '8px 0 12px' }}>
                <div
                    style={{
                        fontSize: 36,
                        fontWeight: 800,
                        fontFamily: M,
                        color: type === 'win' ? C.g : type === 'loss' ? C.r : C.t3,
                    }}
                >
                    {current}
                </div>
                <div
                    style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: C.t3,
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                    }}
                >
                    {type === 'win' ? 'Wins in a row' : type === 'loss' ? 'Losses in a row' : 'No trades'}
                </div>
            </div>

            {/* Best / Worst */}
            <div style={metricRow}>
                <span style={getMetricLabel()}>Best Win Streak</span>
                <span style={getMetricValue(C.g)}>{best}</span>
            </div>
            <div style={metricRow}>
                <span style={getMetricLabel()}>Worst Loss Streak</span>
                <span style={getMetricValue(C.r)}>{worst}</span>
            </div>

            {/* Mini streak history bar */}
            <div style={{ display: 'flex', gap: 1, padding: '8px 14px 12px', height: 20 }}>
                {history
                    .slice(0, 20)
                    .reverse()
                    .map((h, i) => (
                        <div
                            key={i}
                            style={{
                                flex: 1,
                                maxWidth: 12,
                                height: Math.min(20, h.count * 5),
                                background: h.type === 'win' ? C.g + '60' : C.r + '60',
                                borderRadius: 2,
                                alignSelf: 'flex-end',
                            }}
                        />
                    ))}
            </div>
        </Card>
    );
});
