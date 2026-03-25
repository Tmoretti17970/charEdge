// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — TradeHeatmap
//
// Calendar-style P&L heatmap widget. Each cell = one day.
// Sprint 22: Migrated from inline styles → CSS Modules + tokens.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useMemo, useState, useCallback } from 'react';
import { C } from '../../../constants.js';
import st from './TradeHeatmap.module.css';

// ─── Date Helpers ───────────────────────────────────────────────

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function firstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// ─── Color Scaling ──────────────────────────────────────────────

function pnlToColor(pnl, maxAbsPnl) {
  if (pnl === 0) return { bg: C.sf, text: C.t3 };

  const intensity = Math.min(1, Math.abs(pnl) / (maxAbsPnl || 1));
  const alpha = Math.round(15 + intensity * 65);
  const alphaHex = alpha.toString(16).padStart(2, '0');

  if (pnl > 0) {
    return { bg: C.g + alphaHex, text: intensity > 0.4 ? '#fff' : C.g };
  } else {
    return { bg: C.r + alphaHex, text: intensity > 0.4 ? '#fff' : C.r };
  }
}

// ─── Aggregation ────────────────────────────────────────────────

function aggregateMonth(trades, year, month) {
  const dayMap = new Map();
  let maxAbsPnl = 0;
  let monthPnl = 0;

  for (const t of trades) {
    if (!t.date) continue;
    const d = new Date(t.date);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;

    const key = dateKey(d);
    const existing = dayMap.get(key) || { pnl: 0, count: 0, wins: 0, losses: 0 };

    const pnl = t.pnl || 0;
    existing.pnl += pnl;
    existing.count += 1;
    if (pnl > 0) existing.wins += 1;
    else if (pnl < 0) existing.losses += 1;

    dayMap.set(key, existing);
    monthPnl += pnl;
  }

  for (const [, day] of dayMap) {
    maxAbsPnl = Math.max(maxAbsPnl, Math.abs(day.pnl));
  }

  return { dayMap, maxAbsPnl, monthPnl };
}

// ─── Heatmap Component ──────────────────────────────────────────

function TradeHeatmap({ trades = [], onDayClick = null, initialDate = null, compact = false }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(initialDate ? initialDate.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate ? initialDate.getMonth() : today.getMonth());
  const [hoveredDay, setHoveredDay] = useState(null);

  const { dayMap, maxAbsPnl, monthPnl } = useMemo(
    () => aggregateMonth(trades, viewYear, viewMonth),
    [trades, viewYear, viewMonth],
  );

  const totalDays = daysInMonth(viewYear, viewMonth);
  const firstDay = firstDayOfMonth(viewYear, viewMonth);

  const prevMonth = useCallback(() => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else setViewMonth((m) => m - 1);
  }, [viewMonth]);

  const nextMonth = useCallback(() => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else setViewMonth((m) => m + 1);
  }, [viewMonth]);

  const goToToday = useCallback(() => {
    const d = new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, []);

  const cells = useMemo(() => {
    const result = [];
    const _today = new Date();
    const tDate = _today.getDate();
    const tMonth = _today.getMonth();
    const tYear = _today.getFullYear();

    for (let i = 0; i < firstDay; i++) {
      result.push({ day: null, key: `blank-${i}` });
    }

    for (let d = 1; d <= totalDays; d++) {
      const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const data = dayMap.get(key) || null;
      const isToday = d === tDate && viewMonth === tMonth && viewYear === tYear;
      result.push({ day: d, key, data, isToday });
    }

    return result;
  }, [dayMap, firstDay, totalDays, viewYear, viewMonth]);

  const tradingDays = dayMap.size;
  const winDays = Array.from(dayMap.values()).filter((d) => d.pnl > 0).length;

  return (
    <div className={st.container}>
      {/* Header: month nav */}
      <div className={st.header}>
        <div className={st.navGroup}>
          {!compact && <button className={`tf-btn ${st.navBtn}`} onClick={prevMonth}>‹</button>}
          <span className={st.monthLabel}>{MONTHS[viewMonth]} {viewYear}</span>
          {!compact && <button className={`tf-btn ${st.navBtn}`} onClick={nextMonth}>›</button>}
          {!compact && <button className={`tf-btn ${st.todayBtn}`} onClick={goToToday}>Today</button>}
        </div>

        {/* Month summary — hidden in compact */}
        {!compact && (
          <div className={st.summaryRow}>
            <span>
              P&L:{' '}
              <span className={monthPnl >= 0 ? st.pnlUp : st.pnlDown}>
                {monthPnl >= 0 ? '+' : ''}${monthPnl.toFixed(0)}
              </span>
            </span>
            <span>{tradingDays} days</span>
            <span>{tradingDays > 0 ? ((winDays / tradingDays) * 100).toFixed(0) : 0}% win</span>
          </div>
        )}
      </div>

      {/* Weekday headers */}
      <div className={st.weekdayGrid}>
        {WEEKDAYS.map((w) => (
          <div key={w} className={st.weekdayLabel}>{w}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className={st.calendarGrid}>
        {cells.map((cell) => (
          <DayCell
            key={cell.key}
            day={cell.day}
            data={cell.data}
            isToday={cell.isToday}
            maxAbsPnl={maxAbsPnl}
            hovered={hoveredDay === cell.key}
            onHover={() => cell.day && setHoveredDay(cell.key)}
            onLeave={() => setHoveredDay(null)}
            onClick={() => cell.day && onDayClick && onDayClick(new Date(viewYear, viewMonth, cell.day), cell.data)}
          />
        ))}
      </div>

      {/* Hover tooltip */}
      {hoveredDay && dayMap.has(hoveredDay) && <DayTooltip dayKey={hoveredDay} data={dayMap.get(hoveredDay)} />}
    </div>
  );
}

// ─── Day Cell ───────────────────────────────────────────────────

function DayCell({ day, data, isToday, maxAbsPnl, hovered, onHover, onLeave, onClick }) {
  if (day === null) {
    return <div className={st.blankCell} />;
  }

  const hasData = data && data.count > 0;
  const color = hasData ? pnlToColor(data.pnl, maxAbsPnl) : { bg: 'transparent', text: C.t3 };

  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onClick}
      className={st.cell}
      style={{
        background: hasData ? color.bg : hovered ? C.sf : 'transparent',
        border: isToday ? `1.5px solid ${C.b}` : `1px solid ${hovered ? C.bd : 'transparent'}`,
        cursor: hasData ? 'pointer' : 'default',
      }}
    >
      <span
        className={st.dayNum}
        style={{
          fontWeight: isToday ? 800 : 500,
          color: hasData ? color.text : isToday ? C.b : C.t3,
        }}
      >
        {day}
      </span>
      {hasData && (
        <span className={st.dayPnl} style={{ color: color.text }}>
          {data.pnl >= 0 ? '+' : ''}
          {data.pnl >= 100 || data.pnl <= -100 ? `$${(data.pnl / 1000).toFixed(1)}k` : `$${data.pnl.toFixed(0)}`}
        </span>
      )}
      {hasData && data.count > 1 && (
        <div className={st.countDot}>
          {data.count > 9 ? '9+' : data.count}
        </div>
      )}
    </div>
  );
}

// ─── Tooltip ────────────────────────────────────────────────────

function DayTooltip({ dayKey, data }) {
  const parts = dayKey.split('-');
  const date = new Date(+parts[0], +parts[1] - 1, +parts[2]);
  const formatted = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const winRate = data.count > 0 ? ((data.wins / data.count) * 100).toFixed(0) : '0';

  return (
    <div className={st.tooltip}>
      <span className={st.tooltipDate}>{formatted}</span>
      <span>
        P&L:{' '}
        <span className={`${st.tooltipPnl} ${data.pnl >= 0 ? st.pnlUp : st.pnlDown}`}>
          {data.pnl >= 0 ? '+' : ''}${data.pnl.toFixed(2)}
        </span>
      </span>
      <span className={st.tooltipMuted}>{data.count} trades</span>
      <span className={st.tooltipMuted}>{winRate}% win</span>
    </div>
  );
}

// ─── Pure utility exports (for testing) ─────────────────────────

export { dateKey, pnlToColor, aggregateMonth, daysInMonth, firstDayOfMonth };

export default React.memo(TradeHeatmap);
