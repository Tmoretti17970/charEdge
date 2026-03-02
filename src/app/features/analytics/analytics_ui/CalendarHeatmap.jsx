// ═══════════════════════════════════════════════════════════════════
// charEdge — Calendar Heatmap (Sprint 2: Phase B.2)
//
// GitHub-style P&L heatmap showing daily trading performance.
// Green cells = profitable days, red cells = losing days.
// Click a cell to see trade details for that day.
//
// Data comes from computeFast's equity curve (eq array).
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react';
import { C, F, M } from '../../../../constants.js';

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
  // Graduated opacity: 0.15 → 0.9
  const alpha = 0.15 + intensity * 0.75;

  if (pnl > 0) {
    // Green spectrum: light → deep green
    return `rgba(16, 185, 129, ${alpha.toFixed(2)})`;  // emerald
  } else {
    // Red spectrum: light → deep red
    return `rgba(239, 68, 68, ${alpha.toFixed(2)})`;   // red
  }
}

// ─── Build Calendar Grid ─────────────────────────────────────────

function buildCalendarData(equityCurve, trades) {
  // Build a daily map from equity curve
  const dailyMap = {};
  if (equityCurve?.length) {
    for (const day of equityCurve) {
      dailyMap[day.date] = { pnl: day.daily || 0, cumPnl: day.pnl || 0 };
    }
  }

  // Count trades per day
  const tradeCountMap = {};
  if (trades?.length) {
    for (const t of trades) {
      const dateKey = t.date?.slice(0, 10);
      if (dateKey) tradeCountMap[dateKey] = (tradeCountMap[dateKey] || 0) + 1;
    }
  }

  // Build 53-week × 7-day grid for the last year
  const today = new Date();
  const endDate = new Date(today);
  endDate.setHours(23, 59, 59, 999);

  // Start from 52 weeks ago, on Sunday
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 364);
  // Adjust to start on Sunday
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

      // Track month boundary labels
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
  const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const hasPnl = cell.pnl !== null && cell.pnl !== undefined;

  return (
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        zIndex: 1000,
        background: '#1a1f2e',
        border: `1px solid ${C.bd || '#1F2937'}`,
        borderRadius: 8,
        padding: '8px 12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        pointerEvents: 'none',
        minWidth: 140,
        ...style,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: C.t1 || '#F9FAFB', marginBottom: 4, fontFamily: F }}>
        {dateStr}
      </div>
      {hasPnl ? (
        <>
          <div style={{ fontSize: 13, fontWeight: 800, color: cell.pnl >= 0 ? '#10B981' : '#EF4444', fontFamily: M, fontVariantNumeric: 'tabular-nums' }}>
            {cell.pnl >= 0 ? '+' : ''}${cell.pnl.toFixed(2)}
          </div>
          {cell.trades > 0 && (
            <div style={{ fontSize: 10, color: C.t3 || '#9CA3AF', marginTop: 2, fontFamily: M }}>
              {cell.trades} trade{cell.trades !== 1 ? 's' : ''}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 11, color: C.t3 || '#9CA3AF', fontFamily: M }}>No trades</div>
      )}
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────

function Legend() {
  const steps = [-3, -2, -1, 0, 1, 2, 3];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 12, justifyContent: 'flex-end' }}>
      <span style={{ fontSize: 10, color: C.t3 || '#9CA3AF', fontFamily: M, marginRight: 4 }}>Less</span>
      {steps.map((s, i) => (
        <div
          key={i}
          style={{
            width: 12,
            height: 12,
            borderRadius: 2,
            background: getCellColor(s * 100, 300),
          }}
        />
      ))}
      <span style={{ fontSize: 10, color: C.t3 || '#9CA3AF', fontFamily: M, marginLeft: 4 }}>More</span>
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
    { label: 'Trading Days', value: stats.totalDays, color: C.t1 },
    { label: 'Green Days', value: stats.profitDays, color: '#10B981' },
    { label: 'Red Days', value: stats.lossDays, color: '#EF4444' },
    { label: 'Total P&L', value: `${stats.totalPnl >= 0 ? '+' : ''}$${stats.totalPnl.toFixed(0)}`, color: stats.totalPnl >= 0 ? '#10B981' : '#EF4444' },
    { label: 'Best Day', value: stats.bestDay.pnl > -Infinity ? `+$${stats.bestDay.pnl.toFixed(0)}` : '—', color: '#10B981' },
    { label: 'Worst Day', value: stats.worstDay.pnl < Infinity ? `-$${Math.abs(stats.worstDay.pnl).toFixed(0)}` : '—', color: '#EF4444' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, marginBottom: 16 }}>
      {statItems.map((s) => (
        <div key={s.label} style={{ background: `${C.bg2 || '#111827'}`, border: `1px solid ${C.bd || '#1F2937'}40`, borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.t3 || '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2, fontFamily: M }}>{s.label}</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: s.color, fontFamily: M, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

// ═══ Main Component ═══════════════════════════════════════════════

export default function CalendarHeatmap({ eq, trades }) {
  const [tooltip, setTooltip] = useState(null);

  const { weeks, monthLabels } = useMemo(() => buildCalendarData(eq, trades), [eq, trades]);

  // Compute max absolute P&L for color scaling
  const maxAbsPnl = useMemo(() => {
    let max = 0;
    for (const week of weeks) {
      for (const cell of week) {
        if (cell.pnl !== null) max = Math.max(max, Math.abs(cell.pnl));
      }
    }
    return max || 100;
  }, [weeks]);

  const gridWidth = weeks.length * (CELL_SIZE + CELL_GAP) + 30; // 30 for day labels

  const handleCellHover = (cell, e) => {
    if (cell.isFuture) return;
    setTooltip({ cell, x: e.clientX + 12, y: e.clientY - 50 });
  };

  return (
    <div>
      <SummaryStats weeks={weeks} />

      <div
        style={{
          background: `${C.sf || '#0f1523'}`,
          border: `1px solid ${C.bd || '#1F2937'}60`,
          borderRadius: 12,
          padding: '16px 20px',
          overflowX: 'auto',
        }}
      >
        {/* Month labels */}
        <div style={{ display: 'flex', paddingLeft: 30, marginBottom: 4, gap: CELL_GAP }}>
          {weeks.map((_, wIdx) => {
            const label = monthLabels.find((m) => m.weekIdx === wIdx);
            return (
              <div
                key={wIdx}
                style={{
                  width: CELL_SIZE,
                  flexShrink: 0,
                  fontSize: 9,
                  fontWeight: 600,
                  color: C.t3 || '#9CA3AF',
                  fontFamily: M,
                  textAlign: 'center',
                }}
              >
                {label ? MONTH_NAMES[label.month] : ''}
              </div>
            );
          })}
        </div>

        {/* Grid */}
        <div style={{ display: 'flex', gap: 0 }}>
          {/* Day labels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: CELL_GAP, marginRight: 6, paddingTop: 0 }}>
            {DAY_LABELS.map((label, i) => (
              <div
                key={i}
                style={{
                  height: CELL_SIZE,
                  fontSize: 9,
                  fontWeight: 600,
                  color: C.t3 || '#9CA3AF',
                  fontFamily: M,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  width: 24,
                }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Columns (weeks) */}
          <div style={{ display: 'flex', gap: CELL_GAP }}>
            {weeks.map((week, wIdx) => (
              <div key={wIdx} style={{ display: 'flex', flexDirection: 'column', gap: CELL_GAP }}>
                {week.map((cell) => (
                  <div
                    key={cell.date}
                    role="gridcell"
                    aria-label={`${cell.date}: ${cell.pnl !== null ? `$${cell.pnl.toFixed(2)}` : 'No trades'}`}
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
                      transition: 'transform 0.1s, box-shadow 0.1s',
                      outline: cell.isToday ? `2px solid ${C.b || '#00D4AA'}` : 'none',
                      outlineOffset: -1,
                    }}
                    onMouseOver={(e) => {
                      if (!cell.isFuture) e.currentTarget.style.transform = 'scale(1.3)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  />
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
