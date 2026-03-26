// ═══════════════════════════════════════════════════════════════════
// charEdge — Prediction Event Calendar
//
// Calendar view showing market resolution dates.
// Highlights days with markets closing. Click date to see markets.
// ═══════════════════════════════════════════════════════════════════

import { memo, useMemo, useState } from 'react';
import usePredictionDetailStore from '../../../state/usePredictionDetailStore.js';
import usePredictionStore from '../../../state/usePredictionStore.js';
import styles from './PredictionCalendar.module.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

export default memo(function PredictionCalendar() {
  const markets = usePredictionStore((s) => s.markets);
  const openMarket = usePredictionDetailStore((s) => s.openMarket);
  const [selectedDate, setSelectedDate] = useState(null);

  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());

  // Group markets by close date
  const marketsByDate = useMemo(() => {
    const map = {};
    for (const m of markets) {
      if (!m.closeDate) continue;
      const d = new Date(m.closeDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map[key]) map[key] = [];
      map[key].push(m);
    }
    return map;
  }, [markets]);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else setViewMonth(viewMonth - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else setViewMonth(viewMonth + 1);
  };

  const selectedMarkets = selectedDate ? marketsByDate[selectedDate] || [] : [];

  return (
    <div className={styles.calendar}>
      <div className={styles.header}>
        <h3 className={styles.title}>Resolution Calendar</h3>
      </div>

      {/* Month navigation */}
      <div className={styles.monthNav}>
        <button className={styles.navBtn} onClick={prevMonth} aria-label="Previous month">
          ‹
        </button>
        <span className={styles.monthLabel}>
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button className={styles.navBtn} onClick={nextMonth} aria-label="Next month">
          ›
        </button>
      </div>

      {/* Day headers */}
      <div className={styles.dayHeaders}>
        {DAYS.map((d) => (
          <span key={d} className={styles.dayHeader}>
            {d}
          </span>
        ))}
      </div>

      {/* Calendar grid */}
      <div className={styles.grid}>
        {/* Empty cells for padding */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className={styles.cell} />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const count = marketsByDate[dateKey]?.length || 0;
          const isToday = dateKey === today;
          const isSelected = dateKey === selectedDate;

          return (
            <button
              key={day}
              className={`${styles.cell} ${isToday ? styles.today : ''} ${isSelected ? styles.selected : ''} ${count > 0 ? styles.hasMarkets : ''}`}
              onClick={() => setSelectedDate(dateKey === selectedDate ? null : dateKey)}
              aria-label={`${MONTHS[viewMonth]} ${day}${count > 0 ? `, ${count} markets closing` : ''}`}
            >
              <span className={styles.dayNum}>{day}</span>
              {count > 0 && <span className={styles.dotCount}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Selected date markets */}
      {selectedMarkets.length > 0 && (
        <div className={styles.selectedList}>
          <div className={styles.selectedHeader}>
            {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} —{' '}
            {selectedMarkets.length} market{selectedMarkets.length > 1 ? 's' : ''} closing
          </div>
          {selectedMarkets.map((m) => (
            <button key={m.id} className={styles.selectedItem} onClick={() => openMarket(m, markets)}>
              <span className={styles.selectedTitle}>{m.question}</span>
              <span className={styles.selectedProb}>{m.outcomes?.[0]?.probability || 0}%</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
