// Debrief Tab for InsightsPanel
import { useState, useMemo } from 'react';
import { generateDebrief, generateWeeklyDebrief } from '../../../features/journal/DailyDebrief.js';
import st from './DebriefTab.module.css';
import { C } from '@/constants.js';

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
    <div className={st.root}>
      <div className={st.modeRow}>
        <button
          className={`tf-btn ${st.modeBtn} ${mode === 'daily' ? st.modeBtnActive : st.modeBtnInactive}`}
          onClick={() => setMode('daily')}
        >
          Daily
        </button>
        <button
          className={`tf-btn ${st.modeBtn} ${mode === 'weekly' ? st.modeBtnActive : st.modeBtnInactive}`}
          onClick={() => setMode('weekly')}
        >
          Weekly
        </button>

        {mode === 'daily' && (
          <div className={st.dateNav}>
            <button className={`tf-btn ${st.navBtn}`} onClick={() => setDateOffset((d) => d - 1)}>
              ◀
            </button>
            <span className={st.dateLabel}>
              {dateOffset === 0 ? 'Today' : dateOffset === -1 ? 'Yesterday' : targetDate}
            </span>
            <button
              className={`tf-btn ${st.navBtn} ${dateOffset >= 0 ? st.navBtnDisabled : ''}`}
              onClick={() => setDateOffset((d) => Math.min(d + 1, 0))}
              disabled={dateOffset >= 0}
            >
              ▶
            </button>
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
      <div className={st.empty}>
        <div className={st.emptyIcon}>📭</div>
        <div className={st.emptyText}>{debrief.headline}</div>
      </div>
    );
  }

  return (
    <>
      <div className={st.headline}>
        {debrief.headline}
        {debrief.grade && (
          <span
            className={st.gradeBadge}
            style={{ color: debrief.grade.startsWith('A') ? C.g : debrief.grade.startsWith('D') ? C.r : C.y }}
          >
            Grade {debrief.grade}
          </span>
        )}
      </div>

      {debrief.sections.map((sec, i) => (
        <div key={i} className={st.section}>
          <div className={st.sectionTitle}>{sec.title}</div>
          {sec.items.map((item, j) => (
            <div key={j} className={st.sectionItem}>
              {item}
            </div>
          ))}
        </div>
      ))}

      {debrief.observations.length > 0 && (
        <div className={st.obsSection}>
          <div className={st.obsTitle}>Observations</div>
          {debrief.observations.map((obs, i) => (
            <div
              key={i}
              className={st.obsCard}
              style={{ '--obs-color': obs.type === 'warning' ? C.y : obs.type === 'positive' ? C.g : C.b }}
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
      <div className={st.empty}>
        <div className={st.emptyIcon}>📭</div>
        <div className={st.emptyText}>No trades this week</div>
      </div>
    );
  }

  const fmtD = (n) => (n >= 0 ? '+' : '-') + '$' + Math.abs(n || 0).toFixed(0);

  return (
    <>
      <div className={st.weekGrid}>
        {[
          { label: 'Total P&L', value: fmtD(summary.totalPnl), color: summary.totalPnl >= 0 ? C.g : C.r },
          { label: 'Win Rate', value: summary.winRate.toFixed(0) + '%', color: summary.winRate >= 50 ? C.g : C.r },
          { label: 'Trades', value: summary.totalTrades, color: C.t1 },
          { label: 'Trading Days', value: summary.tradingDays, color: C.t1 },
          { label: 'Avg P&L/Day', value: fmtD(summary.avgPnlPerDay), color: summary.avgPnlPerDay >= 0 ? C.g : C.r },
        ].map((stat, i) => (
          <div key={i} className={st.statCard}>
            <div className={st.statLabel}>{stat.label}</div>
            <div className={st.statValue} style={{ color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {summary.bestDay && (
        <div className={st.weekNote}>
          Best day: {summary.bestDay.date} ({fmtD(summary.bestDay.pnl)}, {summary.bestDay.trades} trades)
        </div>
      )}
      {summary.worstDay && (
        <div className={st.weekNote}>
          Worst day: {summary.worstDay.date} ({fmtD(summary.worstDay.pnl)}, {summary.worstDay.trades} trades)
        </div>
      )}
    </>
  );
}
