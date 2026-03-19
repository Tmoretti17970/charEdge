// Debrief Tab for InsightsPanel
import { useState, useMemo } from 'react';
import { C, M } from '@/constants.js';
import { generateDebrief, generateWeeklyDebrief } from '../../../features/journal/DailyDebrief.js';

export default function DebriefTab({ trades }) {
  const [mode, setMode] = useState('daily');
  const [dateOffset, setDateOffset] = useState(0);

  const targetDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dateOffset);
    return d.toISOString().slice(0, 10);
  }, [dateOffset]);

  const debrief = useMemo(
    () => (mode === 'daily' ? generateDebrief(trades, targetDate) : generateWeeklyDebrief(trades)),
    [trades, targetDate, mode],
  );

  return (
    <div style={{ padding: 10 }}>
      {/* Mode + date nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <button
          className="tf-btn"
          onClick={() => setMode('daily')}
          style={{
            padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
            background: mode === 'daily' ? C.b + '20' : 'transparent',
            border: `1px solid ${mode === 'daily' ? C.b : C.bd}`,
            color: mode === 'daily' ? C.b : C.t3, cursor: 'pointer',
          }}
        >
          Daily
        </button>
        <button
          className="tf-btn"
          onClick={() => setMode('weekly')}
          style={{
            padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
            background: mode === 'weekly' ? C.b + '20' : 'transparent',
            border: `1px solid ${mode === 'weekly' ? C.b : C.bd}`,
            color: mode === 'weekly' ? C.b : C.t3, cursor: 'pointer',
          }}
        >
          Weekly
        </button>

        {mode === 'daily' && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <button className="tf-btn" onClick={() => setDateOffset((d) => d - 1)}
              style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer', fontSize: 14 }}>◀</button>
            <span style={{ fontSize: 11, color: C.t1, fontFamily: M, minWidth: 80, textAlign: 'center' }}>
              {dateOffset === 0 ? 'Today' : dateOffset === -1 ? 'Yesterday' : targetDate}
            </span>
            <button className="tf-btn" onClick={() => setDateOffset((d) => Math.min(d + 1, 0))} disabled={dateOffset >= 0}
              style={{ background: 'none', border: 'none', color: dateOffset >= 0 ? C.bd : C.t3, cursor: 'pointer', fontSize: 14 }}>▶</button>
          </div>
        )}
      </div>

      {mode === 'daily' && debrief && <DailyContent debrief={debrief} />}
      {mode === 'weekly' && debrief && <WeeklyContent summary={debrief} />}
    </div>
  );
}

function DailyContent({ debrief }) {
  if (debrief.totalTrades === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: C.t3 }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>📭</div>
        <div style={{ fontSize: 12 }}>{debrief.headline}</div>
      </div>
    );
  }

  return (
    <>
      <div style={{ padding: '10px 12px', background: C.sf, borderRadius: 8, marginBottom: 10, fontSize: 13, fontWeight: 600, color: C.t1 }}>
        {debrief.headline}
        {debrief.grade && (
          <span style={{ float: 'right', fontSize: 12, fontFamily: M, fontWeight: 800, color: debrief.grade.startsWith('A') ? C.g : debrief.grade.startsWith('D') ? C.r : C.y }}>
            Grade {debrief.grade}
          </span>
        )}
      </div>

      {debrief.sections.map((sec, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>
            {sec.title}
          </div>
          {sec.items.map((item, j) => (
            <div key={j} style={{ fontSize: 11, color: C.t2, padding: '2px 0', lineHeight: 1.5 }}>{item}</div>
          ))}
        </div>
      ))}

      {debrief.observations.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
            Observations
          </div>
          {debrief.observations.map((obs, i) => (
            <div
              key={i}
              style={{
                fontSize: 11, padding: '5px 8px', marginBottom: 3,
                background: (obs.type === 'warning' ? C.y : obs.type === 'positive' ? C.g : C.b) + '10',
                borderRadius: 4, color: C.t2, lineHeight: 1.4,
                borderLeft: `3px solid ${obs.type === 'warning' ? C.y : obs.type === 'positive' ? C.g : C.b}`,
              }}
            >
              {obs.text}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function WeeklyContent({ summary }) {
  if (summary.totalTrades === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: C.t3 }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>📭</div>
        <div style={{ fontSize: 12 }}>No trades this week</div>
      </div>
    );
  }

  const fmtD = (n) => (n >= 0 ? '+' : '-') + '$' + Math.abs(n || 0).toFixed(0);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
        {[
          { label: 'Total P&L', value: fmtD(summary.totalPnl), color: summary.totalPnl >= 0 ? C.g : C.r },
          { label: 'Win Rate', value: summary.winRate.toFixed(0) + '%', color: summary.winRate >= 50 ? C.g : C.r },
          { label: 'Trades', value: summary.totalTrades, color: C.t1 },
          { label: 'Trading Days', value: summary.tradingDays, color: C.t1 },
          { label: 'Avg P&L/Day', value: fmtD(summary.avgPnlPerDay), color: summary.avgPnlPerDay >= 0 ? C.g : C.r },
        ].map((stat, i) => (
          <div key={i} style={{ padding: '8px 10px', background: C.sf, borderRadius: 6 }}>
            <div style={{ fontSize: 9, color: C.t3, textTransform: 'uppercase' }}>{stat.label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: stat.color, fontFamily: M, marginTop: 2 }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {summary.bestDay && (
        <div style={{ fontSize: 11, color: C.t2, marginBottom: 4 }}>
          Best day: {summary.bestDay.date} ({fmtD(summary.bestDay.pnl)}, {summary.bestDay.trades} trades)
        </div>
      )}
      {summary.worstDay && (
        <div style={{ fontSize: 11, color: C.t2, marginBottom: 4 }}>
          Worst day: {summary.worstDay.date} ({fmtD(summary.worstDay.pnl)}, {summary.worstDay.trades} trades)
        </div>
      )}
    </>
  );
}
