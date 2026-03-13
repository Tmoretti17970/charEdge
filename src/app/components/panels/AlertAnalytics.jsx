// ═══════════════════════════════════════════════════════════════════
// charEdge — Alert Analytics Dashboard (Phase D4)
//
// Full analytics view consuming useAlertHistory:
// hero stats, outcome histogram, symbol breakdown, time-of-day
// heatmap, and condition effectiveness analysis.
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { useAlertHistory } from '../../../state/useAlertHistory';

// ─── Helpers ────────────────────────────────────────────────────

function pct(n, d) {
  return d === 0 ? 0 : Math.round((n / d) * 1000) / 10;
}

function OutcomePill({ value }) {
  if (value == null) return <span style={{ color: C.t3, fontSize: 10 }}>—</span>;
  const green = value >= 0;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, fontFamily: M,
      color: green ? '#26A69A' : '#EF5350',
    }}>
      {green ? '+' : ''}{value.toFixed(2)}%
    </span>
  );
}

// ─── Mini Bar Chart ─────────────────────────────────────────────

function MiniHistogram({ data, label }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 0.1);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: C.t2, marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 40 }}>
        {data.map((d, i) => {
          const h = Math.max(2, (Math.abs(d.value) / max) * 36);
          const green = d.value >= 0;
          return (
            <div
              key={i}
              title={`${d.label}: ${d.value >= 0 ? '+' : ''}${d.value.toFixed(1)}%`}
              style={{
                flex: 1,
                height: h,
                background: green ? '#26A69A' : '#EF5350',
                borderRadius: '2px 2px 0 0',
                opacity: 0.7,
                transition: 'opacity 0.15s',
                cursor: 'default',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────

function AlertAnalytics() {
  const entries = useAlertHistory((s) => s.entries);

  // Hero stats
  const stats = useMemo(() => {
    const total = entries.length;
    const withOutcome = entries.filter((e) => e.outcome15m != null);
    const wins = withOutcome.filter((e) => (e.outcome15m || 0) > 0).length;
    const winRate = withOutcome.length > 0 ? pct(wins, withOutcome.length) : 0;
    const avgOutcome = withOutcome.length > 0
      ? withOutcome.reduce((s, e) => s + (e.outcome15m || 0), 0) / withOutcome.length
      : 0;

    // Best symbol
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

  // Outcome distribution (last 20 entries with outcomes)
  const histogram = useMemo(() => {
    return entries
      .filter((e) => e.outcome15m != null)
      .slice(0, 20)
      .reverse()
      .map((e) => ({ label: e.symbol, value: e.outcome15m || 0 }));
  }, [entries]);

  // Condition breakdown
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

  // Time-of-day breakdown
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

  const cardStyle = {
    background: C.sf,
    borderRadius: 6,
    padding: '8px 10px',
    textAlign: 'center',
    flex: 1,
  };

  if (entries.length === 0) {
    return (
      <div style={{ height: '100%', overflow: 'auto', padding: 12, fontFamily: F, background: C.bg, color: C.t2 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, marginBottom: 12 }}>📈 Alert Analytics</div>
        <div style={{ textAlign: 'center', padding: '24px 12px', color: C.t3, fontSize: 12 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📈</div>
          <div>No alert data yet</div>
          <div style={{ fontSize: 10, marginTop: 4 }}>Analytics will appear once alerts start triggering.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 12, fontFamily: F, background: C.bg, color: C.t2 }}>
      {/* Header */}
      <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, marginBottom: 12 }}>📈 Alert Analytics</div>

      {/* Hero Stats */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.t1, fontFamily: M }}>{stats.total}</div>
          <div style={{ fontSize: 8, color: C.t3, marginTop: 2 }}>Total Fired</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 18, fontWeight: 800, color: stats.winRate >= 50 ? '#26A69A' : '#EF5350', fontFamily: M }}>
            {stats.winRate}%
          </div>
          <div style={{ fontSize: 8, color: C.t3, marginTop: 2 }}>Win Rate</div>
        </div>
        <div style={cardStyle}>
          <OutcomePill value={stats.avgOutcome} />
          <div style={{ fontSize: 8, color: C.t3, marginTop: 2 }}>Avg +15m</div>
        </div>
        {stats.bestSymbol && (
          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.b, fontFamily: M }}>{stats.bestSymbol[0]}</div>
            <div style={{ fontSize: 8, color: C.t3, marginTop: 2 }}>Best Symbol</div>
          </div>
        )}
      </div>

      {/* Outcome Distribution */}
      <MiniHistogram data={histogram} label="Recent Outcomes (+15m %)" />

      {/* Time of Day */}
      {hourStats.length > 0 && (
        <MiniHistogram data={hourStats} label="P&L by Hour" />
      )}

      {/* Symbol Breakdown */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: C.t2, marginBottom: 4 }}>Symbol Breakdown</div>
        <div style={{ borderRadius: 6, overflow: 'hidden', border: `1px solid ${C.bd}` }}>
          {Object.entries(stats.bySymbol)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 8)
            .map(([sym, v], i) => (
              <div
                key={sym}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '4px 8px', background: i % 2 === 0 ? C.sf : 'transparent',
                  fontSize: 10, fontFamily: M,
                }}
              >
                <span style={{ fontWeight: 700, color: C.t1, width: 50 }}>{sym}</span>
                <span style={{ color: C.t3 }}>{v.count} alerts</span>
                <span style={{ color: C.t3 }}>{v.total > 0 ? pct(v.wins, v.total) : '—'}% WR</span>
                <OutcomePill value={v.total > 0 ? v.pnl / v.total : null} />
              </div>
            ))}
        </div>
      </div>

      {/* Condition Effectiveness */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: C.t2, marginBottom: 4 }}>Condition Effectiveness</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {conditionStats.map(([cond, v]) => (
            <div
              key={cond}
              style={{
                background: C.sf, borderRadius: 4, padding: '4px 8px',
                border: `1px solid ${C.bd}`, fontSize: 9, fontFamily: M,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}
            >
              <span style={{ fontWeight: 700, color: C.t1, textTransform: 'capitalize' }}>
                {cond.replace('_', ' ')}
              </span>
              <span style={{ color: C.t3 }}>{v.count}x</span>
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
