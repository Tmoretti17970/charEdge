// ═══════════════════════════════════════════════════════════════════
// charEdge — Alert Analytics Dashboard (Phase D4)
//
// Full analytics view consuming useAlertHistory:
// hero stats, outcome histogram, symbol breakdown, time-of-day
// heatmap, and condition effectiveness analysis.
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { C } from '../../../constants.js';
import { useAlertStore } from '../../../state/useAlertStore';
import st from './AlertAnalytics.module.css';

// ─── Helpers ────────────────────────────────────────────────────

function pct(n, d) {
  return d === 0 ? 0 : Math.round((n / d) * 1000) / 10;
}

function OutcomePill({ value }) {
  if (value == null) return <span className={st.outcomeNull}>—</span>;
  const green = value >= 0;
  return (
    <span className={st.outcomePill} style={{ color: green ? '#26A69A' : '#EF5350' }}>
      {green ? '+' : ''}{value.toFixed(2)}%
    </span>
  );
}

// ─── Mini Bar Chart ─────────────────────────────────────────────

function MiniHistogram({ data, label }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 0.1);
  return (
    <div className={st.histSection}>
      <div className={st.histLabel}>{label}</div>
      <div className={st.histBars}>
        {data.map((d, i) => {
          const h = Math.max(2, (Math.abs(d.value) / max) * 36);
          const green = d.value >= 0;
          return (
            <div
              key={i}
              title={`${d.label}: ${d.value >= 0 ? '+' : ''}${d.value.toFixed(1)}%`}
              className={st.histBar}
              style={{ height: h, background: green ? '#26A69A' : '#EF5350' }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────

function AlertAnalytics() {
  const entries = useAlertStore((s) => s.historyEntries);

  const stats = useMemo(() => {
    const total = entries.length;
    const withOutcome = entries.filter((e) => e.outcome15m != null);
    const wins = withOutcome.filter((e) => (e.outcome15m || 0) > 0).length;
    const winRate = withOutcome.length > 0 ? pct(wins, withOutcome.length) : 0;
    const avgOutcome = withOutcome.length > 0
      ? withOutcome.reduce((s, e) => s + (e.outcome15m || 0), 0) / withOutcome.length
      : 0;

    const bySymbol = {};
    for (const e of entries) {
      if (!bySymbol[e.symbol]) bySymbol[e.symbol] = { count: 0, pnl: 0, wins: 0, total: 0 };
      bySymbol[e.symbol].count++;
      if (e.outcome15m != null) {
        bySymbol[e.symbol].pnl += e.outcome15m || 0;
        bySymbol[e.symbol].total++;
        if ((e.outcome15m || 0) > 0) bySymbol[e.symbol].wins++;
      }
    }
    const bestSymbol = Object.entries(bySymbol)
      .filter(([, v]) => v.total >= 2)
      .sort((a, b) => b[1].pnl - a[1].pnl)[0];

    return { total, withOutcome: withOutcome.length, winRate, avgOutcome, bestSymbol, bySymbol };
  }, [entries]);

  const histogram = useMemo(() => {
    return entries
      .filter((e) => e.outcome15m != null)
      .slice(0, 20)
      .reverse()
      .map((e) => ({ label: e.symbol, value: e.outcome15m || 0 }));
  }, [entries]);

  const conditionStats = useMemo(() => {
    const byCondition = {};
    for (const e of entries) {
      const c = e.condition || 'unknown';
      if (!byCondition[c]) byCondition[c] = { count: 0, pnl: 0, wins: 0, total: 0 };
      byCondition[c].count++;
      if (e.outcome15m != null) {
        byCondition[c].pnl += e.outcome15m || 0;
        byCondition[c].total++;
        if ((e.outcome15m || 0) > 0) byCondition[c].wins++;
      }
    }
    return Object.entries(byCondition).sort((a, b) => b[1].count - a[1].count);
  }, [entries]);

  const hourStats = useMemo(() => {
    const byHour = {};
    for (const e of entries) {
      const h = new Date(e.triggeredAt).getHours();
      if (!byHour[h]) byHour[h] = { count: 0, pnl: 0 };
      byHour[h].count++;
      if (e.outcome15m != null) byHour[h].pnl += e.outcome15m || 0;
    }
    return Object.entries(byHour)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([h, v]) => ({ label: `${h}:00`, value: v.pnl, count: v.count }));
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className={st.root}>
        <div className={st.title}>📈 Alert Analytics</div>
        <div className={st.empty}>
          <div className={st.emptyIcon}>📈</div>
          <div>No alert data yet</div>
          <div className={st.emptyHint}>Analytics will appear once alerts start triggering.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={st.root}>
      <div className={st.title}>📈 Alert Analytics</div>

      {/* Hero Stats */}
      <div className={st.heroRow}>
        <div className={st.heroCard}>
          <div className={st.heroValue}>{stats.total}</div>
          <div className={st.heroLabel}>Total Fired</div>
        </div>
        <div className={st.heroCard}>
          <div className={st.heroValue} style={{ color: stats.winRate >= 50 ? '#26A69A' : '#EF5350' }}>
            {stats.winRate}%
          </div>
          <div className={st.heroLabel}>Win Rate</div>
        </div>
        <div className={st.heroCard}>
          <OutcomePill value={stats.avgOutcome} />
          <div className={st.heroLabel}>Avg +15m</div>
        </div>
        {stats.bestSymbol && (
          <div className={st.heroCard}>
            <div className={st.heroValue} style={{ fontSize: 14, color: C.b }}>{stats.bestSymbol[0]}</div>
            <div className={st.heroLabel}>Best Symbol</div>
          </div>
        )}
      </div>

      <MiniHistogram data={histogram} label="Recent Outcomes (+15m %)" />
      {hourStats.length > 0 && <MiniHistogram data={hourStats} label="P&L by Hour" />}

      {/* Symbol Breakdown */}
      <div className={st.breakdownSection}>
        <div className={st.breakdownLabel}>Symbol Breakdown</div>
        <div className={st.breakdownTable}>
          {Object.entries(stats.bySymbol)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 8)
            .map(([sym, v], i) => (
              <div key={sym} className={`${st.breakdownRow} ${i % 2 === 0 ? st.breakdownRowAlt : ''}`}>
                <span className={st.breakdownSym}>{sym}</span>
                <span className={st.breakdownMeta}>{v.count} alerts</span>
                <span className={st.breakdownMeta}>{v.total > 0 ? pct(v.wins, v.total) : '—'}% WR</span>
                <OutcomePill value={v.total > 0 ? v.pnl / v.total : null} />
              </div>
            ))}
        </div>
      </div>

      {/* Condition Effectiveness */}
      <div className={st.condSection}>
        <div className={st.condLabel}>Condition Effectiveness</div>
        <div className={st.condGrid}>
          {conditionStats.map(([cond, v]) => (
            <div key={cond} className={st.condCard}>
              <span className={st.condName}>{cond.replace('_', ' ')}</span>
              <span className={st.condCount}>{v.count}x</span>
              {v.total > 0 && <OutcomePill value={v.pnl / v.total} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { AlertAnalytics };
export default React.memo(AlertAnalytics);
