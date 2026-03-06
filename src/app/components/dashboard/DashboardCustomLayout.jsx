// ═══════════════════════════════════════════════════════════════════
// charEdge — Dashboard Custom Layout (Widget Grid)
//
// Extracted from DashboardPanel.jsx. The drag-and-drop widget grid
// for power users who want to arrange their own dashboard.
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import s from './DashboardPanel.module.css';
import { C, F, M } from '../../../constants.js';
import { text } from '../../../theme/tokens.js';
import { fmtD, timeAgo, METRIC_TIPS } from '../../../utils.js';
import { useLayoutStore } from '../../../state/useLayoutStore.js';
import { Card, StatCard, AutoGrid } from '../ui/UIKit.jsx';
import WidgetBoundary from '../ui/WidgetBoundary.jsx';
import WidgetGrid from '../widgets/WidgetGrid.jsx';
import WidgetCustomizer from '../widgets/WidgetCustomizer.jsx';
import {
    StreakWidget,
    RollingMetricsWidget,
    GoalProgressWidget,
    SmartAlertFeedWidget,
    ContextPerformanceWidget,
    DailyDebriefWidget,
    QuickStatsBar,
    WIDGET_REGISTRY,
    DashboardPollWidget,
} from '../widgets/DashboardWidgets.jsx';
import EquityCurveChart from '../widgets/EquityCurveChart.jsx';
import DailyPnlChart from '../widgets/DailyPnlChart.jsx';
import TradeHeatmap from '../widgets/TradeHeatmap.jsx';
import WinRateDonut from '../widgets/WinRateDonut.jsx';
import DailyChallengeCard from '../widgets/DailyChallengeCard.jsx';
import XPActivityFeed from '../widgets/XPActivityFeed.jsx';
import WeeklyChallengeCard from '../widgets/WeeklyChallengeCard.jsx';
import WeeklyReport from './WeeklyReport.jsx';
import SimilarTrades from './SimilarTrades.jsx';
import TradeReplayPanel from './TradeReplayPanel.jsx';
import ExpectancyCard from './ExpectancyCard.jsx';
import { DashHeader, OldSectionLabel, MetricRow } from './DashboardPrimitives.jsx';

export default function DashboardCustomLayout({
    trades,
    result,
    computing,
    todayStats,
    recentTrades,
    goals,
    isMobile,
    isTablet,
    setPage,
    activeWidgets,
    setActiveWidgets,
    activePreset,
    editMode,
    toggleEditMode,
    applyPreset,
    onLayoutToggle,
}) {
    const [showCustomizer, setShowCustomizer] = useState(false);
    const cols = isMobile ? 1 : isTablet ? 1 : 2;

    const widgetComponents = {
        'stat-cards': (
            <Card style={{ padding: 12 }}>
                <AutoGrid minWidth={isMobile ? 100 : 120} gap={8}>
                    <StatCard label="Total P&L" value={fmtD(result.totalPnl)} color={result.totalPnl >= 0 ? C.g : C.r} />
                    <StatCard label="Today" value={fmtD(todayStats.pnl)} color={todayStats.pnl >= 0 ? C.g : todayStats.pnl < 0 ? C.r : C.t3} />
                    <StatCard label="Profit Factor" value={result.pf === Infinity ? '∞' : result.pf.toFixed(2)} color={result.pf >= 1.5 ? C.g : result.pf >= 1 ? C.y : C.r} />
                    <StatCard label="Expectancy" value={fmtD(result.expectancy)} color={result.expectancy >= 0 ? C.g : C.r} />
                    <StatCard label="Sharpe" value={result.sharpe.toFixed(2)} color={result.sharpe >= 1 ? C.g : result.sharpe >= 0 ? C.y : C.r} />
                    <StatCard label="Max DD" value={`${result.maxDd.toFixed(1)}%`} color={result.maxDd < 10 ? C.g : result.maxDd < 25 ? C.y : C.r} />
                </AutoGrid>
            </Card>
        ),
        'win-donut': (
            <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                <WidgetBoundary name="Win Rate" height={130}>
                    <WinRateDonut wins={result.winCount} losses={result.lossCount} size={130} />
                </WidgetBoundary>
            </Card>
        ),
        'equity-curve': (
            <Card style={{ padding: 16 }}>
                <OldSectionLabel text="Equity Curve" right={`${result.tradeCount} trades`} />
                <WidgetBoundary name="Equity Curve" height={260}>
                    <EquityCurveChart eq={result.eq} height={260} />
                </WidgetBoundary>
            </Card>
        ),
        'daily-pnl': (
            <Card style={{ padding: 16 }}>
                <OldSectionLabel text="Daily P&L" />
                <WidgetBoundary name="Daily P&L" height={200}>
                    <DailyPnlChart eq={result.eq} height={200} />
                </WidgetBoundary>
            </Card>
        ),
        calendar: (
            <Card style={{ padding: 16 }}>
                <OldSectionLabel text="Calendar" />
                <WidgetBoundary name="Calendar Heatmap" height={180}>
                    <TradeHeatmap trades={trades} onDayClick={() => setPage('journal')} />
                </WidgetBoundary>
            </Card>
        ),
        streaks: <StreakWidget trades={trades} />,
        rolling: <RollingMetricsWidget trades={trades} />,
        goals: <GoalProgressWidget trades={trades} goals={goals} />,
        debrief: <DailyDebriefWidget trades={trades} result={result} />,
        alerts: <SmartAlertFeedWidget alerts={[]} />,
        'context-perf': <ContextPerformanceWidget trades={trades} />,
        expectancy: <ExpectancyCard />,
        'community-poll': <DashboardPollWidget />,
        'daily-challenge': <DailyChallengeCard />,
        'xp-activity': <XPActivityFeed />,
        'weekly-challenge': <WeeklyChallengeCard />,
        'weekly-report': <WeeklyReport />,
        'similar-trades': recentTrades.length > 0 ? <SimilarTrades criteria={recentTrades[0]} /> : null,
        'trade-replay': <TradeReplayPanel />,
        'recent-trades': (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.bd}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <OldSectionLabel text="Recent Trades" style={{ marginBottom: 0 }} />
                    <button onClick={() => setPage('journal')} className="tf-link" style={{ background: 'none', border: 'none', fontSize: 11, fontWeight: 600, fontFamily: F, cursor: 'pointer' }}>
                        View all →
                    </button>
                </div>
                {recentTrades.map((t) => (
                    <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '70px 60px 1fr auto', gap: 8, padding: '8px 16px', borderBottom: `1px solid ${C.bd}`, fontSize: 12, alignItems: 'center' }}>
                        <div style={{ fontFamily: M, fontSize: 11, color: C.t3 }} title={t.date}>{timeAgo(t.date)}</div>
                        <div style={{ fontWeight: 700, color: C.t1 }}>{t.symbol}</div>
                        <div style={{ color: t.side === 'long' ? C.g : C.r, fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>{t.side}</div>
                        <div style={{ fontFamily: M, fontWeight: 700, color: (t.pnl || 0) >= 0 ? C.g : C.r, textAlign: 'right' }}>{fmtD(t.pnl)}</div>
                    </div>
                ))}
                {recentTrades.length === 0 && (
                    <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: C.t3 }}>No trades yet</div>
                )}
            </Card>
        ),
        insights: (
            <Card style={{ padding: 16 }}>
                <OldSectionLabel text="Insights" />
                {result.insights?.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {result.insights.map((ins, i) => (
                            <div key={i} style={{ padding: '8px 12px', background: ins.t === 'positive' ? C.g + '0c' : ins.t === 'warning' ? C.y + '0c' : C.b + '0c', borderLeft: `3px solid ${ins.t === 'positive' ? C.g : ins.t === 'warning' ? C.y : C.b}`, borderRadius: '0 6px 6px 0', fontSize: 12, lineHeight: 1.5, color: C.t2 }}>
                                {ins.x}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ fontSize: 13, color: C.t3, padding: '20px 0', textAlign: 'center' }}>Add more trades to unlock insights</div>
                )}
            </Card>
        ),
        'risk-metrics': (
            <Card style={{ padding: 16 }}>
                <OldSectionLabel text="Streaks & Risk" />
                <MetricRow label="Best Streak" value={`${result.best} wins`} color={C.g} />
                <MetricRow label="Worst Streak" value={`${result.worst} losses`} color={C.r} />
                <MetricRow label="Avg Win" value={fmtD(result.avgWin)} color={C.g} />
                <MetricRow label="Avg Loss" value={fmtD(result.avgLoss)} color={C.r} />
                <MetricRow label="Win/Loss Ratio" value={result.rr === Infinity ? '∞' : result.rr.toFixed(2)} color={C.t1} />
                <MetricRow label="Consec. 3+ Losses" value={`${result.consLoss3}x`} color={result.consLoss3 > 3 ? C.r : C.t2} />
            </Card>
        ),
        'advanced-metrics': (
            <Card style={{ padding: 16 }}>
                <OldSectionLabel text="Advanced" />
                <MetricRow label="Kelly Criterion" value={`${(result.kelly * 100).toFixed(1)}%`} color={C.b} tip={METRIC_TIPS['Kelly Criterion']} />
                <MetricRow label="Risk of Ruin" value={`${result.ror.toFixed(1)}%`} color={result.ror < 5 ? C.g : result.ror < 30 ? C.y : C.r} tip={METRIC_TIPS['Risk of Ruin']} />
                <MetricRow label="Sortino Ratio" value={result.sortino.toFixed(2)} color={result.sortino >= 1 ? C.g : C.t2} tip={METRIC_TIPS['Sortino']} />
                <MetricRow label="Total Fees" value={fmtD(result.totalFees)} color={C.y} />
                <MetricRow label="Rule Breaks" value={`${result.ruleBreaks}`} color={result.ruleBreaks > 0 ? C.r : C.g} />
                <MetricRow label="Largest Win" value={fmtD(result.lw)} color={C.g} />
                <MetricRow label="Largest Loss" value={fmtD(result.ll)} color={C.r} />
            </Card>
        ),
    };

    const widgets = activeWidgets
        .filter((id) => widgetComponents[id])
        .map((id) => ({
            id,
            span: WIDGET_REGISTRY[id]?.span || 1,
            component: widgetComponents[id],
        }));

    return (
        <div className={`${s.page} ${isMobile ? s.pageMobile : s.pageDesktop}`}>
            <DashHeader
                trades={trades}
                computing={computing}
                layoutMode="custom"
                onLayoutToggle={onLayoutToggle}
                editMode={editMode}
                onToggleEdit={toggleEditMode}
                onCustomize={() => setShowCustomizer(true)}
                activePreset={activePreset}
            />

            <QuickStatsBar result={result} todayPnl={todayStats.pnl} todayCount={todayStats.count} />

            <WidgetGrid
                widgets={widgets}
                cols={cols}
                gap={isMobile ? 12 : 16}
                editable={editMode}
                onLayoutChange={(order) => {
                    const newOrder = order.map((i) => widgets[i]?.id).filter(Boolean);
                    if (newOrder.length === widgets.length) {
                        useLayoutStore.getState().setActiveWidgets(newOrder);
                    }
                }}
            />

            {editMode && (
                <div style={{ marginTop: 16, padding: '12px 16px', background: C.b + '10', borderRadius: 8, border: `1px dashed ${C.b}40`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 12, color: C.b, fontWeight: 600 }}>Drag widgets to rearrange</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setShowCustomizer(true)} style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${C.b}40`, background: C.b + '15', color: C.b, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                            Add/Remove
                        </button>
                        <button onClick={toggleEditMode} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: C.b, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                            Done
                        </button>
                    </div>
                </div>
            )}

            <WidgetCustomizer
                isOpen={showCustomizer}
                onClose={() => setShowCustomizer(false)}
                activeWidgets={activeWidgets}
                onUpdateWidgets={setActiveWidgets}
                onApplyPreset={applyPreset}
            />
        </div>
    );
}
