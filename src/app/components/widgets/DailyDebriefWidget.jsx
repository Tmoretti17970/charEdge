// ═══════════════════════════════════════════════════════════════════
// charEdge — Daily Debrief Widget (C8.8)
//
// Sprint 9 #68: Extracted from DashboardWidgets.jsx.
// Today's trading summary: P&L hero, best/worst trades,
// rule breaks, and emotional state distribution.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, memo } from 'react';
import { safeSum } from '../../../charting_library/model/Money.js';
import { C, M } from '../../../constants.js';
import { fmtD } from '../../../utils.js';
import { Card } from '../ui/UIKit.jsx';
import { hdr, metricRow, getMetricLabel, getMetricValue } from './widgetStyles.js';

export const DailyDebriefWidget = memo(function DailyDebriefWidget({ trades, _result }) {
    const debrief = useMemo(() => {
        const today = new Date().toISOString().slice(0, 10);
        const todayTrades = trades.filter((t) => t.date?.startsWith(today));
        const pnls = todayTrades.map((t) => t.pnl ?? 0);
        const totalPnl = safeSum(pnls);
        const wins = pnls.filter((p) => p > 0).length;
        const losses = pnls.filter((p) => p < 0).length;
        const winRate = pnls.length ? Math.round((wins / pnls.length) * 100) : 0;
        const bestTrade = todayTrades.length ? todayTrades.reduce((a, b) => ((a.pnl ?? 0) > (b.pnl ?? 0) ? a : b)) : null;
        const worstTrade = todayTrades.length ? todayTrades.reduce((a, b) => ((a.pnl ?? 0) < (b.pnl ?? 0) ? a : b)) : null;

        // Emotion distribution
        const emotions = {};
        for (const t of todayTrades) {
            if (t.emotion) emotions[t.emotion] = (emotions[t.emotion] || 0) + 1;
        }

        // Rule breaks today
        const ruleBreaks = todayTrades.filter((t) => t.rulesFollowed === false).length;

        return {
            count: todayTrades.length,
            totalPnl,
            wins,
            losses,
            winRate,
            bestTrade,
            worstTrade,
            emotions,
            ruleBreaks,
        };
    }, [trades]);

    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? '🌅 Good morning' : hour < 17 ? '☀️ Good afternoon' : '🌙 Good evening';

    return (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div
                style={{
                    ...hdr(),
                    background: debrief.totalPnl >= 0 ? C.g + '08' : debrief.totalPnl < 0 ? C.r + '08' : 'transparent',
                }}
            >
                {greeting}
            </div>

            {debrief.count === 0 ? (
                <div style={{ padding: '20px 14px', fontSize: 13, color: C.t3, textAlign: 'center' }}>
                    No trades logged today
                </div>
            ) : (
                <>
                    {/* Today's P&L hero */}
                    <div style={{ textAlign: 'center', padding: '8px 0' }}>
                        <div
                            style={{
                                fontSize: 28,
                                fontWeight: 800,
                                fontFamily: M,
                                color: debrief.totalPnl >= 0 ? C.g : C.r,
                            }}
                        >
                            {fmtD(debrief.totalPnl)}
                        </div>
                        <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
                            {debrief.count} trades · {debrief.wins}W / {debrief.losses}L · {debrief.winRate}%
                        </div>
                    </div>

                    {/* Best / Worst */}
                    {debrief.bestTrade && (
                        <div style={metricRow}>
                            <span style={getMetricLabel()}>Best Trade</span>
                            <span style={getMetricValue(C.g)}>
                                {debrief.bestTrade.symbol} {fmtD(debrief.bestTrade.pnl)}
                            </span>
                        </div>
                    )}
                    {debrief.worstTrade && debrief.worstTrade.id !== debrief.bestTrade?.id && (
                        <div style={metricRow}>
                            <span style={getMetricLabel()}>Worst Trade</span>
                            <span style={getMetricValue(C.r)}>
                                {debrief.worstTrade.symbol} {fmtD(debrief.worstTrade.pnl)}
                            </span>
                        </div>
                    )}

                    {/* Rule breaks */}
                    {debrief.ruleBreaks > 0 && (
                        <div
                            style={{
                                margin: '4px 14px 8px',
                                padding: '6px 10px',
                                background: C.r + '10',
                                borderRadius: 6,
                                fontSize: 10,
                                color: C.r,
                                fontWeight: 600,
                            }}
                        >
                            ⚠ {debrief.ruleBreaks} rule break{debrief.ruleBreaks > 1 ? 's' : ''} today
                        </div>
                    )}

                    {/* Emotions */}
                    {Object.keys(debrief.emotions).length > 0 && (
                        <div style={{ padding: '4px 14px 10px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {Object.entries(debrief.emotions).map(([emo, count]) => (
                                <span
                                    key={emo}
                                    style={{
                                        fontSize: 9,
                                        fontWeight: 600,
                                        fontFamily: M,
                                        padding: '2px 6px',
                                        borderRadius: 4,
                                        background: C.b + '10',
                                        color: C.t2,
                                    }}
                                >
                                    {emo} ×{count}
                                </span>
                            ))}
                        </div>
                    )}
                </>
            )}
        </Card>
    );
});
