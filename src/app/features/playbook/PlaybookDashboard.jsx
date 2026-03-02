// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Playbook Dashboard
// TradeZella-style strategy-level analytics: per-playbook equity
// curve, metrics, emotional breakdown, timing patterns, and
// compliance scoring.
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import { C, F, M } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore.js';
import { Card, AutoGrid, StatCard } from '../../components/ui/UIKit.jsx';
import { fmtD } from '../../../utils.js';
import EquityCurveChart from '../../components/widgets/EquityCurveChart.jsx';
import WinRateDonut from '../../components/widgets/WinRateDonut.jsx';
import BreakdownBarChart from '../../components/widgets/BreakdownBarChart.jsx';
import { SectionLabel } from '../analytics/analytics_ui/AnalyticsPrimitives.jsx';

// ─── Compute Per-Playbook Analytics ─────────────────────────────

function computePlaybookAnalytics(trades) {
  const playbooks = {};

  for (const t of trades) {
    const name = t.playbook || t.strategy || 'Untagged';
    if (!playbooks[name]) {
      playbooks[name] = {
        name,
        trades: [],
        pnl: 0,
        wins: 0,
        losses: 0,
        grossProfit: 0,
        grossLoss: 0,
        emotions: {},
        days: {},
        hours: {},
        rValues: [],
      };
    }
    const pb = playbooks[name];
    pb.trades.push(t);
    const pnl = t.pnl || 0;
    pb.pnl += pnl;
    if (pnl > 0) {
      pb.wins++;
      pb.grossProfit += pnl;
    } else if (pnl < 0) {
      pb.losses++;
      pb.grossLoss += Math.abs(pnl);
    }

    // Emotion tracking
    const emo = t.emotion || 'Unknown';
    if (!pb.emotions[emo]) pb.emotions[emo] = { pnl: 0, count: 0, wins: 0 };
    pb.emotions[emo].pnl += pnl;
    pb.emotions[emo].count++;
    if (pnl > 0) pb.emotions[emo].wins++;

    // Day of week tracking
    if (t.date) {
      const d = new Date(t.date);
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
      if (!pb.days[dayName]) pb.days[dayName] = { pnl: 0, count: 0, wins: 0 };
      pb.days[dayName].pnl += pnl;
      pb.days[dayName].count++;
      if (pnl > 0) pb.days[dayName].wins++;

      // Hour tracking
      const hour = d.getHours();
      const hKey = `${hour}:00`;
      if (!pb.hours[hKey]) pb.hours[hKey] = { pnl: 0, count: 0, wins: 0 };
      pb.hours[hKey].pnl += pnl;
      pb.hours[hKey].count++;
      if (pnl > 0) pb.hours[hKey].wins++;
    }

    // R-value tracking
    if (t.rMultiple != null) pb.rValues.push(t.rMultiple);
  }

  // Compute derived metrics for each playbook
  return Object.values(playbooks)
    .map((pb) => {
      const count = pb.trades.length;
      const winRate = count > 0 ? (pb.wins / count) * 100 : 0;
      const profitFactor = pb.grossLoss > 0 ? pb.grossProfit / pb.grossLoss : pb.grossProfit > 0 ? Infinity : 0;
      const avgPnl = count > 0 ? pb.pnl / count : 0;
      const avgWin = pb.wins > 0 ? pb.grossProfit / pb.wins : 0;
      const avgLoss = pb.losses > 0 ? pb.grossLoss / pb.losses : 0;
      const rr = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
      const expectancy = count > 0 ? (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss : 0;

      // Equity curve
      let cum = 0;
      const eq = pb.trades
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map((t) => {
          cum += t.pnl || 0;
          return { date: (t.date || '').slice(0, 10), cum };
        });

      // Max drawdown
      let peak = 0,
        maxDd = 0;
      for (const pt of eq) {
        if (pt.cum > peak) peak = pt.cum;
        const dd = peak > 0 ? ((peak - pt.cum) / peak) * 100 : 0;
        if (dd > maxDd) maxDd = dd;
      }

      // Avg R
      const avgR = pb.rValues.length > 0 ? pb.rValues.reduce((a, b) => a + b, 0) / pb.rValues.length : null;

      // Best/worst day
      const dayEntries = Object.entries(pb.days).sort((a, b) => b[1].pnl - a[1].pnl);
      const bestDay = dayEntries[0] || null;
      const worstDay = dayEntries[dayEntries.length - 1] || null;

      // Best/worst emotion
      const emoEntries = Object.entries(pb.emotions).sort((a, b) => b[1].pnl - a[1].pnl);
      const bestEmo = emoEntries[0] || null;
      const worstEmo = emoEntries[emoEntries.length - 1] || null;

      // Streak analysis
      let curStreak = 0,
        bestStreak = 0,
        worstStreak = 0,
        curLoss = 0;
      for (const t of pb.trades) {
        if ((t.pnl || 0) > 0) {
          curStreak++;
          curLoss = 0;
          bestStreak = Math.max(bestStreak, curStreak);
        } else {
          curLoss++;
          curStreak = 0;
          worstStreak = Math.max(worstStreak, curLoss);
        }
      }

      return {
        ...pb,
        count,
        winRate,
        profitFactor,
        avgPnl,
        avgWin,
        avgLoss,
        rr,
        expectancy,
        eq,
        maxDd,
        avgR,
        bestDay,
        worstDay,
        bestEmo,
        worstEmo,
        bestStreak,
        worstStreak,
      };
    })
    .sort((a, b) => b.pnl - a.pnl);
}

// ─── Main Component ─────────────────────────────────────────────

function PlaybookDashboard() {
  const trades = useJournalStore((s) => s.trades);
  const [selectedPb, setSelectedPb] = useState(null);

  const pbAnalytics = useMemo(() => computePlaybookAnalytics(trades), [trades]);

  if (trades.length === 0) {
    return (
      <Card style={{ padding: 48, textAlign: 'center', color: C.t3, fontSize: 13 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
        <div style={{ fontWeight: 700, color: C.t2, marginBottom: 4 }}>No playbook data</div>
        <div>Tag your trades with strategies to see playbook analytics.</div>
      </Card>
    );
  }

  const active = selectedPb ? pbAnalytics.find((p) => p.name === selectedPb) : pbAnalytics[0];

  return (
    <div>
      {/* Playbook Selector Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          marginBottom: 16,
          paddingBottom: 4,
        }}
      >
        {pbAnalytics.map((pb) => {
          const isActive = pb.name === (active?.name || '');
          return (
            <button
              className="tf-btn"
              key={pb.name}
              onClick={() => setSelectedPb(pb.name)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: `1px solid ${isActive ? C.b : C.bd}`,
                background: isActive ? C.b + '18' : C.sf,
                color: isActive ? C.b : C.t2,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: F,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
            >
              <span style={{ marginRight: 6 }}>{pb.pnl >= 0 ? '🟢' : '🔴'}</span>
              {pb.name}
              <span style={{ marginLeft: 8, fontSize: 10, color: C.t3, fontFamily: M }}>{pb.count}t</span>
            </button>
          );
        })}
      </div>

      {active && <PlaybookDetail pb={active} allPlaybooks={pbAnalytics} />}
    </div>
  );
}

// ─── Playbook Detail View ───────────────────────────────────────

function PlaybookDetail({ pb, allPlaybooks }) {
  // Rank this playbook
  const rank = allPlaybooks.findIndex((p) => p.name === pb.name) + 1;
  const total = allPlaybooks.length;

  return (
    <div>
      {/* Header */}
      <Card style={{ padding: 16, marginBottom: 16, borderLeft: `4px solid ${pb.pnl >= 0 ? C.g : C.r}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: C.t1, margin: 0, fontFamily: F }}>{pb.name}</h2>
            <div style={{ fontSize: 11, color: C.t3, fontFamily: M, marginTop: 4 }}>
              Rank #{rank} of {total} strategies · {pb.count} trades
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: M, color: pb.pnl >= 0 ? C.g : C.r }}>
              {fmtD(pb.pnl)}
            </div>
            <div style={{ fontSize: 11, color: C.t3, fontFamily: M }}>Total P&L</div>
          </div>
        </div>
      </Card>

      {/* Key Metrics */}
      <AutoGrid minWidth={130} gap={8} style={{ marginBottom: 16 }}>
        <StatCard label="Win Rate" value={`${pb.winRate.toFixed(1)}%`} color={pb.winRate >= 50 ? C.g : C.r} />
        <StatCard
          label="Profit Factor"
          value={pb.profitFactor === Infinity ? '∞' : pb.profitFactor.toFixed(2)}
          color={pb.profitFactor >= 1.5 ? C.g : pb.profitFactor >= 1 ? C.y : C.r}
        />
        <StatCard label="Expectancy" value={fmtD(pb.expectancy)} color={pb.expectancy >= 0 ? C.g : C.r} />
        <StatCard label="Avg P&L" value={fmtD(pb.avgPnl)} color={pb.avgPnl >= 0 ? C.g : C.r} />
        <StatCard
          label="R:R Ratio"
          value={pb.rr === Infinity ? '∞' : pb.rr.toFixed(2)}
          color={pb.rr >= 1.5 ? C.g : pb.rr >= 1 ? C.y : C.r}
        />
        <StatCard
          label="Max DD"
          value={`${pb.maxDd.toFixed(1)}%`}
          color={pb.maxDd < 10 ? C.g : pb.maxDd < 25 ? C.y : C.r}
        />
        <StatCard label="Best Streak" value={`${pb.bestStreak}W`} color={C.g} />
        <StatCard label="Worst Streak" value={`${pb.worstStreak}L`} color={C.r} />
      </AutoGrid>

      {/* Equity Curve + Win Rate Donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, marginBottom: 16 }}>
        <Card style={{ padding: 16 }}>
          <SectionLabel text={`${pb.name} Equity Curve`} />
          <EquityCurveChart eq={pb.eq} height={220} />
        </Card>
        <Card
          style={{
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 160,
          }}
        >
          <SectionLabel text="Win Rate" />
          <WinRateDonut wins={pb.wins} losses={pb.losses} size={120} />
          <div style={{ fontSize: 10, color: C.t3, fontFamily: M, marginTop: 8 }}>
            {pb.wins}W / {pb.losses}L
          </div>
        </Card>
      </div>

      {/* Insights Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Emotional Performance */}
        <Card style={{ padding: 16 }}>
          <SectionLabel text="Performance by Emotion" />
          {Object.keys(pb.emotions).length > 0 ? (
            <BreakdownBarChart data={pb.emotions} height={Math.max(100, Object.keys(pb.emotions).length * 36)} />
          ) : (
            <div style={{ fontSize: 11, color: C.t3, padding: 16, textAlign: 'center' }}>No emotion data</div>
          )}
          {pb.bestEmo && pb.worstEmo && Object.keys(pb.emotions).length >= 2 && (
            <div style={{ fontSize: 11, color: C.t2, marginTop: 10, lineHeight: 1.6 }}>
              Best results when <strong style={{ color: C.g }}>{pb.bestEmo[0]}</strong> ({fmtD(pb.bestEmo[1].pnl)}).
              Worst when <strong style={{ color: C.r }}>{pb.worstEmo[0]}</strong> ({fmtD(pb.worstEmo[1].pnl)}).
            </div>
          )}
        </Card>

        {/* Day of Week Performance */}
        <Card style={{ padding: 16 }}>
          <SectionLabel text="Performance by Day" />
          {Object.keys(pb.days).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => {
                const d = pb.days[day];
                if (!d)
                  return (
                    <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 36, fontSize: 11, fontWeight: 600, color: C.t3, fontFamily: M }}>{day}</div>
                      <div style={{ flex: 1, height: 6, background: C.bg2, borderRadius: 3 }} />
                      <div style={{ width: 40, fontSize: 10, color: C.t3, textAlign: 'right', fontFamily: M }}>—</div>
                    </div>
                  );
                const maxPnl = Math.max(1, ...Object.values(pb.days).map((x) => Math.abs(x.pnl)));
                const barW = (Math.abs(d.pnl) / maxPnl) * 100;
                return (
                  <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 36, fontSize: 11, fontWeight: 600, color: C.t2, fontFamily: M }}>{day}</div>
                    <div style={{ flex: 1, height: 6, background: C.bg2, borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${barW}%`,
                          background: d.pnl >= 0 ? C.g : C.r,
                          borderRadius: 3,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        width: 50,
                        fontSize: 10,
                        fontWeight: 700,
                        fontFamily: M,
                        color: d.pnl >= 0 ? C.g : C.r,
                        textAlign: 'right',
                      }}
                    >
                      {fmtD(d.pnl)}
                    </div>
                    <div style={{ width: 30, fontSize: 9, fontFamily: M, color: C.t3, textAlign: 'right' }}>
                      {d.count}t
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: C.t3, padding: 16, textAlign: 'center' }}>No day data</div>
          )}
          {pb.bestDay && pb.worstDay && Object.keys(pb.days).length >= 2 && (
            <div style={{ fontSize: 11, color: C.t2, marginTop: 10, lineHeight: 1.6 }}>
              Best day: <strong style={{ color: C.g }}>{pb.bestDay[0]}</strong>. Worst:{' '}
              <strong style={{ color: C.r }}>{pb.worstDay[0]}</strong>.
            </div>
          )}
        </Card>
      </div>

      {/* Comparison vs All Strategies */}
      {allPlaybooks.length > 1 && (
        <Card style={{ padding: 16 }}>
          <SectionLabel text="vs Other Strategies" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allPlaybooks.map((p, i) => {
              const isThis = p.name === pb.name;
              const maxPnl = Math.max(1, ...allPlaybooks.map((x) => Math.abs(x.pnl)));
              const barW = (Math.abs(p.pnl) / maxPnl) * 100;
              return (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: isThis ? 1 : 0.7 }}>
                  <div
                    style={{ width: 14, fontSize: 11, fontWeight: 700, color: C.t3, fontFamily: M, textAlign: 'right' }}
                  >
                    #{i + 1}
                  </div>
                  <div
                    style={{
                      width: 100,
                      fontSize: 12,
                      fontWeight: isThis ? 700 : 500,
                      color: isThis ? C.t1 : C.t2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.name}
                  </div>
                  <div style={{ flex: 1, height: 8, background: C.bg2, borderRadius: 4, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${barW}%`,
                        background: p.pnl >= 0 ? (isThis ? C.g : C.g + '60') : isThis ? C.r : C.r + '60',
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      width: 65,
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: M,
                      color: p.pnl >= 0 ? C.g : C.r,
                      textAlign: 'right',
                    }}
                  >
                    {fmtD(p.pnl)}
                  </div>
                  <div style={{ width: 40, fontSize: 10, fontFamily: M, color: C.t3, textAlign: 'right' }}>
                    {p.winRate.toFixed(0)}%
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

export { computePlaybookAnalytics };
export default React.memo(PlaybookDashboard);
