// ═══════════════════════════════════════════════════════════════════
// charEdge — Weekly Performance Report Card
//
// Automated end-of-week summary card shown on the Command Center.
// Displays win rate delta, P&L trend, best/worst trade, streak,
// behavioral insights, and a downloadable report link.
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { Card } from '../../components/ui/UIKit.jsx';

/** Get the start of the current week (Monday 00:00). */
function weekStart(d = new Date()) {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = 0
  copy.setDate(copy.getDate() - diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Get the start of last week. */
function lastWeekStart() {
  const ws = weekStart();
  ws.setDate(ws.getDate() - 7);
  return ws;
}

/**
 * Compute weekly metrics for a given set of trades.
 */
function computeWeek(trades) {
  if (!trades.length) return null;
  let total = 0, wins = 0, losses = 0, best = -Infinity, worst = Infinity;
  let bestTrade = null, worstTrade = null;
  const byDay = {};

  for (const t of trades) {
    const pnl = t.pnl || 0;
    total += pnl;
    if (pnl > 0) wins++;
    else if (pnl < 0) losses++;
    if (pnl > best) { best = pnl; bestTrade = t; }
    if (pnl < worst) { worst = pnl; worstTrade = t; }

    const day = new Date(t.date).toLocaleDateString('en-US', { weekday: 'short' });
    byDay[day] = (byDay[day] || 0) + pnl;
  }

  const count = trades.length;
  const winRate = count > 0 ? (wins / count) * 100 : 0;
  const avgPnl = count > 0 ? total / count : 0;

  return { total, wins, losses, count, winRate, avgPnl, best, worst, bestTrade, worstTrade, byDay };
}

export default function WeeklyReport() {
  const trades = useJournalStore((s) => s.trades);

  const { thisWeek, _lastWeek, insights } = useMemo(() => {
    const wsThis = weekStart();
    const wsLast = lastWeekStart();

    const thisWeekTrades = trades.filter((t) => new Date(t.date) >= wsThis);
    const lastWeekTrades = trades.filter((t) => {
      const d = new Date(t.date);
      return d >= wsLast && d < wsThis;
    });

    const tw = computeWeek(thisWeekTrades);
    const lw = computeWeek(lastWeekTrades);

    // Generate insights
    const ins = [];
    if (tw && lw) {
      const wrDelta = tw.winRate - lw.winRate;
      if (wrDelta > 5) ins.push({ type: 'positive', text: `Win rate up ${wrDelta.toFixed(0)}% vs last week 🔥` });
      else if (wrDelta < -5) ins.push({ type: 'warning', text: `Win rate down ${Math.abs(wrDelta).toFixed(0)}% from last week` });

      const pnlDelta = tw.total - lw.total;
      if (pnlDelta > 0) ins.push({ type: 'positive', text: `$${pnlDelta.toFixed(0)} more profit than last week` });
      else if (pnlDelta < 0) ins.push({ type: 'warning', text: `$${Math.abs(pnlDelta).toFixed(0)} less than last week` });
    }

    if (tw) {
      if (tw.wins > 0 && tw.losses === 0) ins.push({ type: 'positive', text: 'Perfect week — all trades profitable! 🎯' });
      if (tw.count >= 10 && tw.winRate < 40) ins.push({ type: 'caution', text: 'High trade count with low win rate — review your setups' });
      if (tw.count >= 5 && tw.avgPnl < 0) ins.push({ type: 'caution', text: 'Negative average P&L — consider reducing size' });
    }

    return { thisWeek: tw, lastWeek: lw, insights: ins };
  }, [trades]);

  // No trades this week
  if (!thisWeek || thisWeek.count === 0) {
    return (
      <Card style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 18 }}>📊</span>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: F }}>Weekly Report</div>
        </div>
        <div style={{ fontSize: 12, color: C.t3, fontFamily: F }}>
          No trades this week yet. Start trading to see your weekly performance summary.
        </div>
      </Card>
    );
  }

  const pnlColor = thisWeek.total >= 0 ? C.g : C.r;
  const sign = thisWeek.total >= 0 ? '+' : '';

  // Mini day sparkline (Mon-Fri)
  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const dayValues = dayOrder.map((d) => thisWeek.byDay[d] || 0);
  const maxAbs = Math.max(1, ...dayValues.map(Math.abs));

  return (
    <Card style={{ padding: 0, marginBottom: 16 }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${C.bd}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>📊</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>This Week</div>
            <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
              {thisWeek.count} trades · {thisWeek.wins}W {thisWeek.losses}L
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: M, color: pnlColor }}>
            {sign}${Math.abs(thisWeek.total).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
            {thisWeek.winRate.toFixed(0)}% win rate
          </div>
        </div>
      </div>

      {/* Day-by-day sparkline */}
      <div style={{
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 6,
        height: 60,
        borderBottom: insights.length > 0 ? `1px solid ${C.bd}` : 'none',
      }}>
        {dayOrder.map((day, i) => {
          const val = dayValues[i];
          const h = Math.max(2, Math.abs(val) / maxAbs * 36);
          const c = val > 0 ? C.g : val < 0 ? C.r : C.bd;
          return (
            <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: '100%', maxWidth: 32, height: h, borderRadius: 3,
                background: c, opacity: val === 0 ? 0.3 : 0.8,
              }} />
              <span style={{ fontSize: 8, color: C.t3, fontFamily: M }}>{day}</span>
            </div>
          );
        })}
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div style={{ padding: '10px 20px' }}>
          {insights.map((insight, i) => (
            <div
              key={i}
              style={{
                fontSize: 11,
                fontWeight: 500,
                fontFamily: F,
                color: insight.type === 'positive' ? C.g : insight.type === 'warning' ? C.y : C.r,
                padding: '3px 0',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 8 }}>
                {insight.type === 'positive' ? '▲' : insight.type === 'warning' ? '●' : '▼'}
              </span>
              {insight.text}
            </div>
          ))}
        </div>
      )}

      {/* Best/Worst trade */}
      {(thisWeek.bestTrade || thisWeek.worstTrade) && (
        <div style={{
          padding: '10px 20px 14px',
          display: 'flex',
          gap: 16,
          borderTop: `1px solid ${C.bd}`,
          fontSize: 10,
          fontFamily: M,
        }}>
          {thisWeek.bestTrade && (
            <div>
              <span style={{ color: C.t3 }}>Best: </span>
              <span style={{ color: C.g, fontWeight: 600 }}>
                {thisWeek.bestTrade.symbol} +${thisWeek.best.toFixed(2)}
              </span>
            </div>
          )}
          {thisWeek.worstTrade && (
            <div>
              <span style={{ color: C.t3 }}>Worst: </span>
              <span style={{ color: C.r, fontWeight: 600 }}>
                {thisWeek.worstTrade.symbol} -${Math.abs(thisWeek.worst).toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
