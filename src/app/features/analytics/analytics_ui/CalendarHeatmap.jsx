// ═══════════════════════════════════════════════════════════════════
// charEdge — Calendar Heatmap (Sprint 2: Phase B.2)
//
// GitHub-style P&L heatmap showing daily trading performance.
// Sprint 22: Migrated from inline styles → CSS Modules + tokens.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useMemo } from 'react';
import { C, M } from '@/constants.js';
import st from './CalendarHeatmap.module.css';

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CELL_SIZE = 14;
const CELL_GAP = 3;
const CELL_RADIUS = 3;

// ─── Color Scales ────────────────────────────────────────────────

function getCellColor(pnl, maxAbsPnl) {
  if (pnl === null || pnl === undefined) return `${C.bd || '#1F2937'}30`;
  if (pnl === 0) return `${C.bd || '#1F2937'}50`;

  const intensity = Math.min(1, Math.abs(pnl) / (maxAbsPnl || 1));
  const alpha = 0.15 + intensity * 0.75;

  if (pnl > 0) {
    return `rgba(16, 185, 129, ${alpha.toFixed(2)})`;
  } else {
    return `rgba(239, 68, 68, ${alpha.toFixed(2)})`;
  }
}

// ─── Build Calendar Grid ─────────────────────────────────────────

function buildCalendarData(equityCurve, trades) {
  const dailyMap = {};
  if (equityCurve?.length) {
    for (const day of equityCurve) {
      dailyMap[day.date] = { pnl: day.daily || 0, cumPnl: day.pnl || 0 };
    }
  }

  const tradeCountMap = {};
  const ruleBreakCountMap = {};
  const leakCountMap = {};
  const LEAK_TAGS = ['REVENGE_TRADE', 'FOMO_ENTRY', 'OVERSIZED', 'HOPE_TRADING'];
  if (trades?.length) {
    for (const t of trades) {
      const dateKey = t.date?.slice(0, 10);
      if (dateKey) {
        tradeCountMap[dateKey] = (tradeCountMap[dateKey] || 0) + 1;
        if (t.ruleBreak) ruleBreakCountMap[dateKey] = (ruleBreakCountMap[dateKey] || 0) + 1;
        if (t.tags?.some((tag) => LEAK_TAGS.includes(tag))) leakCountMap[dateKey] = (leakCountMap[dateKey] || 0) + 1;
      }
    }
  }

  const today = new Date();
  const endDate = new Date(today);
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 364);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const weeks = [];
  const monthLabels = [];
  let lastMonth = -1;

  const cursor = new Date(startDate);
  let weekIdx = 0;

  while (cursor <= endDate) {
    const week = [];
    for (let dow = 0; dow < 7; dow++) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const month = cursor.getMonth();

      if (dow === 0 && month !== lastMonth) {
        monthLabels.push({ weekIdx, month });
        lastMonth = month;
      }

      const data = dailyMap[dateStr];
      const isFuture = cursor > today;

      week.push({
        date: dateStr,
        dow,
        pnl: isFuture ? null : (data?.pnl ?? null),
        cumPnl: data?.cumPnl ?? null,
        trades: tradeCountMap[dateStr] || 0,
        ruleBreaks: ruleBreakCountMap[dateStr] || 0,
        leaks: leakCountMap[dateStr] || 0,
        isFuture,
        isToday: dateStr === today.toISOString().slice(0, 10),
      });

      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    weekIdx++;
  }

  return { weeks, monthLabels };
}

// ─── Tooltip Component ───────────────────────────────────────────

function Tooltip({ cell, style }) {
  if (!cell) return null;

  const dateObj = new Date(cell.date + 'T12:00:00');
  const dateStr = dateObj.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
  const hasPnl = cell.pnl !== null && cell.pnl !== undefined;
  const hasRuleBreak = cell.ruleBreaks > 0;
  const hasLeak = cell.leaks > 0;

  return (
    <div role="tooltip" className={st.tooltip} style={style}>
      <div className={st.tooltipDate}>{dateStr}</div>
      {hasPnl ? (
        <>
          <div className={st.tooltipPnl} data-dir={cell.pnl >= 0 ? 'up' : 'down'}>
            {cell.pnl >= 0 ? '+' : ''}${cell.pnl.toFixed(2)}
          </div>
          {cell.trades > 0 && (
            <div className={st.tooltipMeta}>
              {cell.trades} trade{cell.trades !== 1 ? 's' : ''}
            </div>
          )}
          {hasRuleBreak && (
            <div className={st.tooltipWarn}>
              ⚠️ {cell.ruleBreaks} rule break{cell.ruleBreaks !== 1 ? 's' : ''}
            </div>
          )}
          {hasLeak && (
            <div className={st.tooltipDanger}>
              🚨 {cell.leaks} leak{cell.leaks !== 1 ? 's' : ''}
            </div>
          )}
        </>
      ) : (
        <div className={st.tooltipEmpty}>No trades</div>
      )}
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────

function Legend() {
  const steps = [-3, -2, -1, 0, 1, 2, 3];
  return (
    <div className={st.legend}>
      <span className={st.legendLabel} style={{ marginRight: 4 }}>Less</span>
      {steps.map((s, i) => (
        <div key={i} className={st.legendCell} style={{ background: getCellColor(s * 100, 300) }} />
      ))}
      <span className={st.legendLabel} style={{ marginLeft: 4 }}>More</span>
    </div>
  );
}

// ─── Summary Stats ───────────────────────────────────────────────

function SummaryStats({ weeks }) {
  const stats = useMemo(() => {
    let totalDays = 0, profitDays = 0, lossDays = 0, totalPnl = 0;
    let bestDay = { pnl: -Infinity, date: '' };
    let worstDay = { pnl: Infinity, date: '' };
    let currentStreak = 0, bestStreak = 0, worstStreak = 0, currentLoss = 0;

    for (const week of weeks) {
      for (const cell of week) {
        if (cell.pnl === null || cell.isFuture) continue;
        totalDays++;
        totalPnl += cell.pnl;
        if (cell.pnl > 0) {
          profitDays++;
          currentStreak++;
          currentLoss = 0;
          if (currentStreak > bestStreak) bestStreak = currentStreak;
        } else if (cell.pnl < 0) {
          lossDays++;
          currentLoss++;
          currentStreak = 0;
          if (currentLoss > worstStreak) worstStreak = currentLoss;
        }
        if (cell.pnl > bestDay.pnl) bestDay = { pnl: cell.pnl, date: cell.date };
        if (cell.pnl < worstDay.pnl) worstDay = { pnl: cell.pnl, date: cell.date };
      }
    }

    return { totalDays, profitDays, lossDays, totalPnl, bestDay, worstDay, bestStreak, worstStreak };
  }, [weeks]);

  const statItems = [
    { label: 'Trading Days', value: stats.totalDays, color: 'var(--tf-t1)' },
    { label: 'Green Days', value: stats.profitDays, color: 'var(--tf-green)' },
    { label: 'Red Days', value: stats.lossDays, color: 'var(--tf-red)' },
    {
      label: 'Total P&L',
      value: `${stats.totalPnl >= 0 ? '+' : ''}$${stats.totalPnl.toFixed(0)}`,
      color: stats.totalPnl >= 0 ? 'var(--tf-green)' : 'var(--tf-red)',
    },
    {
      label: 'Best Day',
      value: stats.bestDay.pnl > -Infinity ? `+$${stats.bestDay.pnl.toFixed(0)}` : '—',
      color: 'var(--tf-green)',
    },
    {
      label: 'Worst Day',
      value: stats.worstDay.pnl < Infinity ? `-$${Math.abs(stats.worstDay.pnl).toFixed(0)}` : '—',
      color: 'var(--tf-red)',
    },
  ];

  return (
    <div className={st.statsGrid}>
      {statItems.map((s) => (
        <div key={s.label} className={st.statCard}>
          <div className={st.statLabel}>{s.label}</div>
          <div className={st.statValue} style={{ color: s.color }}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

// ═══ Main Component ═══════════════════════════════════════════════

function CalendarHeatmap({ eq, trades }) {
  const [tooltip, setTooltip] = useState(null);

  const { weeks, monthLabels } = useMemo(() => buildCalendarData(eq, trades), [eq, trades]);

  const { ruleBreakDays, leakDays } = useMemo(() => {
    const rb = new Set();
    const lk = new Set();
    const LEAK_TAGS = ['REVENGE_TRADE', 'FOMO_ENTRY', 'OVERSIZED', 'HOPE_TRADING'];
    for (const t of trades || []) {
      const dateKey = t.date?.slice(0, 10);
      if (!dateKey) continue;
      if (t.ruleBreak) rb.add(dateKey);
      if (t.tags?.some((tag) => LEAK_TAGS.includes(tag))) lk.add(dateKey);
    }
    return { ruleBreakDays: rb, leakDays: lk };
  }, [trades]);

  const maxAbsPnl = useMemo(() => {
    let max = 0;
    for (const week of weeks) {
      for (const cell of week) {
        if (cell.pnl !== null) max = Math.max(max, Math.abs(cell.pnl));
      }
    }
    return max || 100;
  }, [weeks]);

  const handleCellHover = (cell, e) => {
    if (cell.isFuture) return;
    setTooltip({ cell, x: e.clientX + 12, y: e.clientY - 50 });
  };

  return (
    <div>
      <SummaryStats weeks={weeks} />

      <div className={st.calendarBox}>
        {/* Month labels */}
        <div className={st.monthRow} style={{ gap: CELL_GAP }}>
          {weeks.map((_, wIdx) => {
            const label = monthLabels.find((m) => m.weekIdx === wIdx);
            return (
              <div key={wIdx} className={st.monthCell} style={{ width: CELL_SIZE }}>
                {label ? MONTH_NAMES[label.month] : ''}
              </div>
            );
          })}
        </div>

        {/* Grid */}
        <div className={st.gridWrap}>
          {/* Day labels */}
          <div className={st.dayLabels} style={{ gap: CELL_GAP }}>
            {DAY_LABELS.map((label, i) => (
              <div key={i} className={st.dayLabel} style={{ height: CELL_SIZE }}>
                {label}
              </div>
            ))}
          </div>

          {/* Columns (weeks) */}
          <div className={st.weeksRow} style={{ gap: CELL_GAP }}>
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className={st.weekCol} style={{ gap: CELL_GAP }}>
                {week.map((cell) => (
                  <div
                    key={cell.date}
                    role="gridcell"
                    aria-label={`${cell.date}: ${cell.pnl !== null ? `$${cell.pnl.toFixed(2)}` : 'No trades'}`}
                    className={st.cell}
                    data-future={cell.isFuture || undefined}
                    onMouseEnter={(e) => handleCellHover(cell, e)}
                    onMouseMove={(e) => handleCellHover(cell, e)}
                    onMouseLeave={() => setTooltip(null)}
                    style={{
                      width: CELL_SIZE,
                      height: CELL_SIZE,
                      borderRadius: CELL_RADIUS,
                      background: getCellColor(cell.pnl, maxAbsPnl),
                      cursor: cell.isFuture ? 'default' : 'pointer',
                      opacity: cell.isFuture ? 0.2 : 1,
                      outline: cell.isToday ? `2px solid ${C.b || '#00D4AA'}` : 'none',
                      outlineOffset: -1,
                    }}
                  >
                    {ruleBreakDays.has(cell.date) && <div className={st.ruleBreakDot} />}
                    {!ruleBreakDays.has(cell.date) && leakDays.has(cell.date) && <div className={st.leakDot} />}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <Legend />
      </div>

      {tooltip && <Tooltip cell={tooltip.cell} style={{ left: tooltip.x, top: tooltip.y }} />}
    </div>
  );
}

export default React.memo(CalendarHeatmap);
