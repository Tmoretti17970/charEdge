// ═══════════════════════════════════════════════════════════════════
// charEdge — Tops Economic Events Strip
//
// Compact horizontal strip showing upcoming high-impact economic events.
// Surfaces existing EconomicCalendar.getEventsInRange().
// ═══════════════════════════════════════════════════════════════════

import { memo, useEffect, useState } from 'react';
import styles from './TopsEconStrip.module.css';

const IMPACT_COLORS = {
  high: '#FF3B30',
  medium: '#F59E0B',
  low: '#34C759',
};

export default memo(function TopsEconStrip() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { default: EconomicCalendar } = await import(
          '../../../charting_library/calendar/EconomicCalendar.js'
        );
        const calendar = new EconomicCalendar();
        const now = Date.now();
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        const upcoming = calendar.getEventsInRange(now, now + oneWeek);
        // Only show high/medium impact
        const filtered = upcoming
          .filter((e) => e.impact === 'high' || e.impact === 'medium')
          .slice(0, 8);
        if (!cancelled) setEvents(filtered);
      } catch {
        // Calendar may not be available
      }
    })();

    return () => { cancelled = true; };
  }, []);

  if (!events.length) return null;

  return (
    <div className={styles.container}>
      <span className={styles.label}>Economic Events</span>
      <div className={styles.scroll}>
        {events.map((evt, i) => (
          <div key={`${evt.title}-${i}`} className={styles.chip}>
            <span
              className={styles.dot}
              style={{ background: IMPACT_COLORS[evt.impact] || IMPACT_COLORS.low }}
            />
            <div className={styles.chipContent}>
              <span className={styles.chipTitle}>{evt.title}</span>
              <span className={styles.chipMeta}>
                {formatEventDate(evt.timestamp)} · {evt.country}
                {evt.forecast ? ` · Est: ${evt.forecast}` : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

function formatEventDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
