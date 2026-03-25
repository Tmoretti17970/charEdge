// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Compare & Goals Panel (Sprint 4.4 + 4.7)
//
// Two-tab panel:
//   1. Compare — period-over-period performance comparison
//   2. Goals — financial goal progress tracking
//
// Usage:
//   <ComparePanel trades={trades} />
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useMemo } from 'react';
import { C } from '../../../constants.js';
import { useGamificationStore } from '../../../state/useGamificationStore';
import {
  comparePeriods,
  computeEquityCurve,
  computeCalendarData,
} from '../../features/analytics/PerformanceCompare.js';
import s from './ComparePanel.module.css';

const PERIOD_OPTIONS = [
  { id: 'week', label: 'Weekly' },
  { id: 'month', label: 'Monthly' },
  { id: 'quarter', label: 'Quarterly' },
  { id: 'year', label: 'Yearly' },
];

function fmtD(n) {
  return (n >= 0 ? '+' : '-') + '$' + Math.abs(n || 0).toFixed(0);
}
function _fmtPct(n) {
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
}

function ComparePanel({ trades = [] }) {
  const [tab, setTab] = useState('compare');

  return (
    <div className={s.panelRoot}>
      {/* Tab bar */}
      <div className={s.tabBar}>
        {[
          { id: 'compare', label: '📊 Compare' },
          { id: 'goals', label: '🎯 Goals' },
          { id: 'equity', label: '📈 Equity' },
        ].map((t) => (
          <button
            className={`tf-btn ${s.tabBtn}`}
            key={t.id}
            onClick={() => setTab(t.id)}
            data-active={tab === t.id ? 'true' : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={s.s0}>
        {tab === 'compare' && <CompareTab trades={trades} />}
        {tab === 'goals' && <GoalsTab trades={trades} />}
        {tab === 'equity' && <EquityTab trades={trades} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 1: Period Comparison
// ═══════════════════════════════════════════════════════════════════

function CompareTab({ trades }) {
  const [period, setPeriod] = useState('week');
  const comparison = useMemo(() => comparePeriods(trades, period), [trades, period]);

  const { current: curr, previous: prev, deltas } = comparison;

  const STATS = [
    { label: 'P&L', curr: fmtD(curr.pnl), prev: fmtD(prev.pnl), delta: deltas.pnl, fmt: fmtD, isPnl: true },
    {
      label: 'Win Rate',
      curr: curr.winRate.toFixed(1) + '%',
      prev: prev.winRate.toFixed(1) + '%',
      delta: deltas.winRate,
      fmt: (v) => v.toFixed(1) + '%',
    },
    { label: 'Trades', curr: curr.trades, prev: prev.trades, delta: deltas.trades, fmt: (v) => (v > 0 ? '+' + v : v) },
    {
      label: 'Profit Factor',
      curr: curr.profitFactor === Infinity ? '∞' : curr.profitFactor.toFixed(2),
      prev: prev.profitFactor === Infinity ? '∞' : prev.profitFactor.toFixed(2),
      delta: deltas.profitFactor,
      fmt: (v) => v.toFixed(2),
    },
    {
      label: 'Expectancy',
      curr: fmtD(curr.expectancy),
      prev: fmtD(prev.expectancy),
      delta: deltas.expectancy,
      fmt: fmtD,
      isPnl: true,
    },
    { label: 'Best Trade', curr: fmtD(curr.bestTrade), prev: fmtD(prev.bestTrade) },
    { label: 'Worst Trade', curr: fmtD(curr.worstTrade), prev: fmtD(prev.worstTrade) },
    { label: 'Trading Days', curr: curr.tradingDays, prev: prev.tradingDays },
  ];

  return (
    <div className={s.padded}>
      {/* Period selector */}
      <div className={s.s1}>
        {PERIOD_OPTIONS.map((p) => (
          <button
            className={`tf-btn ${s.periodBtn}`}
            key={p.id}
            onClick={() => setPeriod(p.id)}
            data-active={period === p.id ? 'true' : undefined}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Comparison header */}
      <div className={s.s2}>
        <div className={s.compareCard} style={{ borderLeft: `3px solid ${C.b}` }}>
          <div className={s.cardLabel}>{curr.label}</div>
          <div className={s.cardPnl} style={{ color: curr.pnl >= 0 ? C.g : C.r }}>
            {fmtD(curr.pnl)}
          </div>
          <div className={s.cardMeta}>
            {curr.trades} trades · {curr.winRate.toFixed(0)}% WR
          </div>
        </div>

        <div className={s.compareCard} style={{ borderLeft: `3px solid ${C.t3}` }}>
          <div className={s.cardLabel}>{prev.label}</div>
          <div className={s.cardPnl} style={{ color: prev.pnl >= 0 ? C.g : C.r }}>
            {fmtD(prev.pnl)}
          </div>
          <div className={s.cardMeta}>
            {prev.trades} trades · {prev.winRate.toFixed(0)}% WR
          </div>
        </div>
      </div>

      {/* Delta P&L badge */}
      <div
        className={s.deltaBadge}
        style={{
          background: deltas.pnl >= 0 ? C.g + '10' : C.r + '10',
          borderLeft: `3px solid ${deltas.pnl >= 0 ? C.g : C.r}`,
        }}
      >
        <span className={s.deltaIcon}>{deltas.pnl >= 0 ? '📈' : '📉'}</span>
        <span className={s.deltaLabel} style={{ color: deltas.pnl >= 0 ? C.g : C.r }}>
          {fmtD(deltas.pnl)} vs {prev.label.toLowerCase()}
        </span>
      </div>

      {/* Stat comparison table */}
      {STATS.map((stat, i) => (
        <div
          key={i}
          className={s.statRow}
          style={{ borderBottom: i < STATS.length - 1 ? `1px solid ${C.bd}20` : 'none' }}
        >
          <span className={s.statLabel}>{stat.label}</span>
          <span className={s.statCurr} style={{ color: stat.isPnl ? (curr.pnl >= 0 ? C.g : C.r) : C.t1 }}>
            {stat.curr}
          </span>
          <span className={s.statPrev}>{stat.prev}</span>
          {stat.delta !== undefined && (
            <span className={s.statDelta} style={{ color: stat.delta >= 0 ? C.g : C.r }}>
              {stat.delta >= 0 ? '▲' : '▼'} {typeof stat.fmt === 'function' ? stat.fmt(stat.delta) : stat.delta}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 2: Goal Tracking
// ═══════════════════════════════════════════════════════════════════

function GoalsTab({ trades }) {
  const goals = useGamificationStore((s) => s.goals);
  const setGoal = useGamificationStore((s) => s.setGoal);
  const toggleGoal = useGamificationStore((s) => s.toggleGoal);
  const dailyLossLimit = useGamificationStore((s) => s.dailyLossLimit);
  const dailyLossEnabled = useGamificationStore((s) => s.dailyLossEnabled);
  const setDailyLossLimit = useGamificationStore((s) => s.setDailyLossLimit);
  const toggleDailyLoss = useGamificationStore((s) => s.toggleDailyLoss);
  const getProgress = useGamificationStore((s) => s.getProgress);

  const progress = useMemo(() => getProgress(trades), [trades, getProgress]);

  const GOAL_ROWS = [
    { key: 'daily', label: 'Daily P&L', emoji: '📅', period: 'daily' },
    { key: 'weekly', label: 'Weekly P&L', emoji: '📆', period: 'weekly' },
    { key: 'monthly', label: 'Monthly P&L', emoji: '🗓️', period: 'monthly' },
    { key: 'yearly', label: 'Yearly P&L', emoji: '📊', period: 'yearly' },
  ];

  return (
    <div className={s.padded}>
      <div className={s.sectionLabel}>P&L Targets</div>

      {GOAL_ROWS.map((row) => {
        const goal = goals[row.period];
        const prog = progress[row.period];

        return (
          <div key={row.key} className={s.goalCard}>
            <div className={s.s3}>
              <span className={s.goalEmoji}>{row.emoji}</span>
              <span className={s.goalLabel}>{row.label}</span>
              <label className={s.s4}>
                <input
                  aria-label="Compare symbol"
                  type="checkbox"
                  checked={goal.enabled}
                  onChange={() => toggleGoal(row.period)}
                  className={s.s5}
                />
              </label>
            </div>

            {goal.enabled && (
              <>
                <div className={s.s6}>
                  <span className={s.goalTarget}>Target: $</span>
                  <input
                    type="number"
                    value={goal.target || ''}
                    onChange={(e) => setGoal(row.period, parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className={s.goalInput}
                  />
                </div>

                {prog && (
                  <>
                    <div className={s.progressTrack}>
                      <div
                        className={s.progressFill}
                        style={{
                          width: `${Math.min(100, Math.max(0, prog.pct))}%`,
                          background: prog.hit ? C.g : prog.pct > 50 ? C.b : C.y,
                        }}
                      />
                    </div>
                    <div className={s.progressLabel}>
                      <span style={{ color: prog.current >= 0 ? C.g : C.r }}>{fmtD(prog.current)}</span>
                      <span style={{ color: C.t3 }}>
                        {prog.pct.toFixed(0)}% of ${prog.target.toLocaleString()}
                      </span>
                      {prog.hit && <span style={{ color: C.g }}>✅ Hit!</span>}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        );
      })}

      {/* Daily loss limit */}
      <div className={s.sectionLabelRisk}>Risk Limits</div>

      <div className={s.riskCard}>
        <div className={s.s7}>
          <span className={s.goalEmoji}>🚫</span>
          <span className={s.goalLabel}>Daily Loss Limit</span>
          <label className={s.s8}>
            <input type="checkbox" checked={dailyLossEnabled} onChange={toggleDailyLoss} className={s.s9} />
          </label>
        </div>
        {dailyLossEnabled && (
          <div className={s.s10}>
            <span className={s.goalTarget}>Max loss: $</span>
            <input
              type="number"
              value={dailyLossLimit || ''}
              onChange={(e) => setDailyLossLimit(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className={s.goalInput}
            />
            {progress.dailyLoss && (
              <span className={s.riskStatus} style={{ color: progress.dailyLoss.breached ? C.r : C.t3 }}>
                {progress.dailyLoss.breached ? '⚠ BREACHED' : `${progress.dailyLoss.pct.toFixed(0)}% used`}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 3: Equity Curve (text-based summary)
// ═══════════════════════════════════════════════════════════════════

function EquityTab({ trades }) {
  const curve = useMemo(() => computeEquityCurve(trades), [trades]);
  const _calendar = useMemo(() => computeCalendarData(trades), [trades]);

  if (curve.length === 0) {
    return (
      <div className={s.emptyState}>
        <div className={s.s11}>📈</div>
        <div className={s.emptyText}>No trades to chart</div>
      </div>
    );
  }

  const last = curve[curve.length - 1];
  const maxDD = Math.min(...curve.map((c) => c.drawdown));
  const totalDays = curve.length;
  const greenDays = curve.filter((c) => c.dayPnl > 0).length;
  const redDays = curve.filter((c) => c.dayPnl < 0).length;

  // Mini sparkline using unicode blocks
  const recentDays = curve.slice(-20);
  const maxPnl = Math.max(1, ...recentDays.map((c) => Math.abs(c.dayPnl)));
  const sparkline = recentDays.map((c) => {
    const ratio = c.dayPnl / maxPnl;
    if (ratio > 0.5) return '█';
    if (ratio > 0.2) return '▆';
    if (ratio > 0) return '▃';
    if (ratio > -0.2) return '▁';
    if (ratio > -0.5) return '▃';
    return '█';
  });

  return (
    <div className={s.padded}>
      {/* Summary stats */}
      <div className={s.s12}>
        {[
          { label: 'Final Equity', value: fmtD(last.equity), color: last.equity >= 0 ? C.g : C.r },
          { label: 'Peak Equity', value: fmtD(last.peak), color: C.b },
          { label: 'Max Drawdown', value: maxDD.toFixed(1) + '%', color: C.r },
          { label: 'Trading Days', value: totalDays, color: C.t1 },
          {
            label: 'Green Days',
            value: `${greenDays} (${totalDays > 0 ? ((greenDays / totalDays) * 100).toFixed(0) : 0}%)`,
            color: C.g,
          },
          {
            label: 'Red Days',
            value: `${redDays} (${totalDays > 0 ? ((redDays / totalDays) * 100).toFixed(0) : 0}%)`,
            color: C.r,
          },
        ].map((stat, i) => (
          <div key={i} className={s.statCard}>
            <div className={s.statCardLabel}>{stat.label}</div>
            <div className={s.statCardValue} style={{ color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Text sparkline */}
      <div className={s.sparkWrap}>
        <div className={s.sparkLabel}>Last {recentDays.length} Days</div>
        <div className={s.sparkChars}>
          {recentDays.map((c, i) => (
            <span key={i} style={{ color: c.dayPnl >= 0 ? C.g : C.r }}>
              {sparkline[i]}
            </span>
          ))}
        </div>
        <div className={s.sparkRange}>
          <span>{recentDays[0]?.date}</span>
          <span>{recentDays[recentDays.length - 1]?.date}</span>
        </div>
      </div>

      {/* Recent day-by-day P&L */}
      <div className={s.dayLabel}>Day-by-Day (Last 15)</div>
      {curve
        .slice(-15)
        .reverse()
        .map((day, _i) => (
          <div key={day.date} className={s.dayRow}>
            <span className={s.dayDate}>{day.date}</span>
            <span className={s.dayCount}>
              {day.trades} trade{day.trades !== 1 ? 's' : ''}
            </span>
            <span className={s.dayPnl} style={{ color: day.dayPnl >= 0 ? C.g : C.r }}>
              {fmtD(day.dayPnl)}
            </span>
            <span className={s.dayEquity}>Eq: {fmtD(day.equity)}</span>
          </div>
        ))}
    </div>
  );
}

export { ComparePanel };

export default React.memo(ComparePanel);
