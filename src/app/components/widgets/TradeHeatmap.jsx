// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — TradeHeatmap
//
// Calendar-style P&L heatmap widget. Each cell = one day.
// Color intensity scales with P&L magnitude.
// Green = profit, Red = loss, blank = no trades.
//
// Features:
//   - Month navigation (prev/next)
//   - Hover tooltip with day stats (trade count, total P&L, win rate)
//   - Click handler for drill-down (filters journal to that day)
//   - Responsive: works in DashboardPage cards or full-width
//
// Usage:
//   <TradeHeatmap trades={trades} onDayClick={(date) => { ... }} />
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useMemo, useState, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';

// ─── Date Helpers ───────────────────────────────────────────────

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Get YYYY-MM-DD key from a Date. */
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Get first day of month (0=Sun). */
function firstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

/** Get number of days in month. */
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// ─── Color Scaling ──────────────────────────────────────────────

/**
 * Map a P&L value to a color with opacity based on magnitude.
 * @param {number} pnl - Daily P&L
 * @param {number} maxAbsPnl - Max absolute P&L in the month (for normalization)
 * @returns {{ bg: string, text: string }}
 */
function pnlToColor(pnl, maxAbsPnl) {
  if (pnl === 0) return { bg: C.sf, text: C.t3 };

  const intensity = Math.min(1, Math.abs(pnl) / (maxAbsPnl || 1));
  // Minimum opacity: 15%, max: 80%
  const alpha = Math.round(15 + intensity * 65);
  const alphaHex = alpha.toString(16).padStart(2, '0');

  if (pnl > 0) {
    return { bg: C.g + alphaHex, text: intensity > 0.4 ? '#fff' : C.g };
  } else {
    return { bg: C.r + alphaHex, text: intensity > 0.4 ? '#fff' : C.r };
  }
}

// ─── Aggregation ────────────────────────────────────────────────

/**
 * Aggregate trades by day for a given month.
 * @param {Array} trades - Trade array
 * @param {number} year
 * @param {number} month - 0-indexed
 * @returns {{ dayMap: Map<string, { pnl, count, wins, losses }>, maxAbsPnl: number, monthPnl: number }}
 */
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

  // Calculate max absolute daily P&L for color scaling
  for (const [, day] of dayMap) {
    maxAbsPnl = Math.max(maxAbsPnl, Math.abs(day.pnl));
  }

  return { dayMap, maxAbsPnl, monthPnl };
}

// ─── Heatmap Component ──────────────────────────────────────────

function TradeHeatmap({ trades = [], onDayClick = null, initialDate = null }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(initialDate ? initialDate.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate ? initialDate.getMonth() : today.getMonth());
  const [hoveredDay, setHoveredDay] = useState(null);

  // Month data
  const { dayMap, maxAbsPnl, monthPnl } = useMemo(
    () => aggregateMonth(trades, viewYear, viewMonth),
    [trades, viewYear, viewMonth],
  );

  const totalDays = daysInMonth(viewYear, viewMonth);
  const firstDay = firstDayOfMonth(viewYear, viewMonth);

  // Navigation
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

  // Build grid cells
  const cells = useMemo(() => {
    const result = [];
    const _today = new Date();
    const tDate = _today.getDate();
    const tMonth = _today.getMonth();
    const tYear = _today.getFullYear();

    // Leading blanks for alignment
    for (let i = 0; i < firstDay; i++) {
      result.push({ day: null, key: `blank-${i}` });
    }

    // Actual days
    for (let d = 1; d <= totalDays; d++) {
      const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const data = dayMap.get(key) || null;
      const isToday = d === tDate && viewMonth === tMonth && viewYear === tYear;
      result.push({ day: d, key, data, isToday });
    }

    return result;
  }, [dayMap, firstDay, totalDays, viewYear, viewMonth]);

  // Month stats
  const tradingDays = dayMap.size;
  const winDays = Array.from(dayMap.values()).filter((d) => d.pnl > 0).length;

  return (
    <div style={{ fontFamily: F }}>
      {/* Header: month nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NavBtn onClick={prevMonth}>‹</NavBtn>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.t1, minWidth: 140, textAlign: 'center' }}>
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <NavBtn onClick={nextMonth}>›</NavBtn>
          <button
            className="tf-btn"
            onClick={goToToday}
            style={{
              background: 'none',
              border: `1px solid ${C.bd}`,
              borderRadius: 4,
              color: C.t3,
              fontSize: 9,
              fontFamily: M,
              cursor: 'pointer',
              padding: '2px 6px',
              marginLeft: 4,
            }}
          >
            Today
          </button>
        </div>

        {/* Month summary */}
        <div style={{ display: 'flex', gap: 12, fontSize: 10, fontFamily: M, color: C.t3 }}>
          <span>
            P&L:{' '}
            <span style={{ color: monthPnl >= 0 ? C.g : C.r, fontWeight: 700 }}>
              {monthPnl >= 0 ? '+' : ''}${monthPnl.toFixed(0)}
            </span>
          </span>
          <span>{tradingDays} days</span>
          <span>{tradingDays > 0 ? ((winDays / tradingDays) * 100).toFixed(0) : 0}% win</span>
        </div>
      </div>

      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            style={{ textAlign: 'center', fontSize: 9, fontWeight: 600, color: C.t3, fontFamily: M, padding: '2px 0' }}
          >
            {w}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, position: 'relative' }}>
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
    return <div style={{ aspectRatio: '1', minHeight: 32 }} />;
  }

  const hasData = data && data.count > 0;
  const color = hasData ? pnlToColor(data.pnl, maxAbsPnl) : { bg: 'transparent', text: C.t3 };

  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onClick}
      style={{
        aspectRatio: '1',
        minHeight: 32,
        borderRadius: 4,
        background: hasData ? color.bg : hovered ? C.sf : 'transparent',
        border: isToday ? `1.5px solid ${C.b}` : `1px solid ${hovered ? C.bd : 'transparent'}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: hasData ? 'pointer' : 'default',
        transition: 'background 0.1s, border-color 0.15s',
        position: 'relative',
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: isToday ? 800 : 500,
          color: hasData ? color.text : isToday ? C.b : C.t3,
          fontFamily: M,
        }}
      >
        {day}
      </span>
      {hasData && (
        <span
          style={{
            fontSize: 8,
            fontWeight: 700,
            color: color.text,
            fontFamily: M,
            marginTop: 1,
          }}
        >
          {data.pnl >= 0 ? '+' : ''}
          {data.pnl >= 100 || data.pnl <= -100 ? `$${(data.pnl / 1000).toFixed(1)}k` : `$${data.pnl.toFixed(0)}`}
        </span>
      )}
      {/* Trade count dot */}
      {hasData && data.count > 1 && (
        <div
          style={{
            position: 'absolute',
            top: 2,
            right: 3,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: C.sf,
            fontSize: 7,
            fontWeight: 700,
            fontFamily: M,
            color: C.t2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
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
    <div
      style={{
        marginTop: 8,
        padding: '8px 12px',
        background: C.sf,
        border: `1px solid ${C.bd}`,
        borderRadius: 6,
        fontSize: 11,
        fontFamily: F,
        color: C.t1,
        display: 'flex',
        gap: 16,
        justifyContent: 'center',
      }}
    >
      <span style={{ fontWeight: 600 }}>{formatted}</span>
      <span>
        P&L:{' '}
        <span style={{ color: data.pnl >= 0 ? C.g : C.r, fontWeight: 700, fontFamily: M }}>
          {data.pnl >= 0 ? '+' : ''}${data.pnl.toFixed(2)}
        </span>
      </span>
      <span style={{ color: C.t3 }}>{data.count} trades</span>
      <span style={{ color: C.t3 }}>{winRate}% win</span>
    </div>
  );
}

// ─── Nav Button ─────────────────────────────────────────────────

function NavBtn({ onClick, children }) {
  return (
    <button
      className="tf-btn"
      onClick={onClick}
      style={{
        width: 24,
        height: 24,
        borderRadius: 4,
        background: 'none',
        border: `1px solid ${C.bd}`,
        color: C.t2,
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.1s',
      }}
    >
      {children}
    </button>
  );
}

// ─── Pure utility exports (for testing) ─────────────────────────

export { dateKey, pnlToColor, aggregateMonth, daysInMonth, firstDayOfMonth };

export default React.memo(TradeHeatmap);
